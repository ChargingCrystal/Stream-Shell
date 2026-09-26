const PROVIDERS = {
    youtube: {
        label: "YouTube",
        url: "https://www.youtube.com/"
    },

    netflix: {
        label: "Netflix",
        url: "https://www.netflix.com/browse"
    },

    prime: {
        label: "Prime Video",
        url: "https://www.primevideo.com/"
    },

    disney: {
        label: "Disney+",
        url: "https://www.disneyplus.com/"
    },

    crunchyroll: {
        label: "Crunchyroll",
        url: "https://www.crunchyroll.com/"
    }
};

const SUBSCRIPTION_STORAGE_KEY =
    "streamShellSubscriptions";


const SUBSCRIPTION_PROVIDERS = [
    {
        id:
            "youtube",

        url:
            "https://www.youtube.com/paid_memberships"
    },
    {
        id:
            "netflix",

        url:
            "https://www.netflix.com/account"
    },
    {
        id:
            "prime",

        url:
            "https://www.amazon.de/gp/primecentral"
    },
    {
        id:
            "disney",

        url:
            "https://www.disneyplus.com/account"
    },
    {
        id:
            "crunchyroll",

        url:
            "https://www.crunchyroll.com/account/membership"
    }
];


const GOOGLE_PLAY_SUBSCRIPTIONS_URL =
    "https://play.google.com/store/account/subscriptions";


const PRIME_CENTRAL_URL =
    "https://www.amazon.de/gp/primecentral";


const LEFT = {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080
};

const RIGHT = {
    left: 1920,
    top: 0,
    width: 1920,
    height: 1080
};

const LANDING_URL =
    chrome.runtime.getURL(
        "landing/landing.html"
    );


const DASHBOARD_URL =
    chrome.runtime.getURL(
        "dashboard/dashboard.html"
    );


const TWITCH_HOME_URL =
    "https://www.twitch.tv/";

const TWITCH_DROPS_URL =
    "https://www.twitch.tv/drops/inventory";

const TWITCH_WINDOW_STORAGE_KEY =
    "twitchWindowId";

const TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY =
    "twitchDropsWorkerWindowId";

const TWITCH_RAID_GUARD_SESSION_KEY =
    "streamShellTwitchRaidGuard";

const TWITCH_DROPS_MAINTENANCE_ALARM =
    "streamShellTwitchDropsMaintenance";


const POPUP_URL =
    chrome.runtime.getURL(
        "popup/popup.html"
    );


const DISCORD_NATIVE_HOST =
    "com.streamshell.discord";


const TITLEBAR_NATIVE_HOST =
    "com.streamshell.titlebar";

const TITLEBAR_PROTOCOL_VERSION =
    4;

const TITLEBAR_RECONCILE_INTERVAL_MS =
    1500;


const DISCORD_EXECUTABLE_PATH =
    "";

const providerCreationLocks =
    new Map();

let landingCreationLock =
    null;

let dashboardCreationLock =
    null;

let twitchCreationLock =
    null;

let subscriptionSyncLock =
    null;

let shuttingDown =
    false;

let titlebarPort =
    null;

let titlebarConnectPromise =
    null;

let titlebarProtocolReady =
    false;

let titlebarLastStateKey =
    null;

let titlebarSettingsOpen =
    false;

let titlebarVolumeActive =
    false;

let titlebarFullscreenActive =
    false;

let titlebarFullscreenWindowId =
    null;

/*
 * Managed browser windows can exist before Chromium publishes their first real
 * page title. Retry plans are idempotent and may overlap; this generation only
 * invalidates all outstanding plans when focus moves to an unmanaged window.
 */
let titlebarClaimRetryGeneration =
    0;

let titlebarReconcileTimer =
    null;

let titlebarLastNativeStatus =
    null;


async function openShellHome() {
    if (
        shuttingDown
    ) {
        return;
    }

    let displayProfile = null;
    try {
        displayProfile = await refreshStreamShellDisplayProfile(
            "shell-open"
        );
    } catch {
        /* Legacy 0,0 geometry remains available if display discovery fails. */
    }

    const compact = displayProfile?.mode === "compact";

    titlebarFullscreenActive = false;
    titlebarFullscreenWindowId = null;

    await deactivateTwitchForRightSurface({
        forceMinimize: compact
    });

    await stopVolumeCaptureForProviderChange(
        compact ? "dashboard" : "landing"
    );

    let landingId = null;
    if (!compact) {
        landingId = await ensureLandingWindow();
        if (shuttingDown) return;
    } else {
        /* A pre-existing Wide Landing must never leak into Compact. */
        const storedLanding = await chrome.storage.local.get("landingWindowId");
        if (Number.isInteger(storedLanding.landingWindowId)) {
            await safelyRemoveWindow(storedLanding.landingWindowId);
            await chrome.storage.local.remove("landingWindowId");
        }
    }

    const dashboardId = await ensureDashboardWindow();
    if (shuttingDown) return;

    const providerWindows = await getProviderWindows();
    for (const [providerName, windowId] of Object.entries(providerWindows)) {
        await setWindowMuted(windowId, true);
        await safelyMinimizeWindow(windowId);
        await parkWindowOffscreen(windowId, LEFT);
        await chrome.storage.local.remove(`streamShellNowPlaying_${providerName}`);
    }

    if (shuttingDown) return;

    /*
     * Publish the intended shell surfaces before restoring/focusing them. Native
     * claims validate this intent and never infer ownership from geometry alone.
     */
    await chrome.storage.local.set({
        leftMode: compact ? "dashboard" : "landing",
        rightMode: "dashboard",
        twitchTarget: "resume"
    });

    await ensureTitlebarNative();

    if (!compact) {
        await restoreWindow(landingId, LEFT, true);
        if (shuttingDown) return;

        /* Wide can resolve a managed left surface by the extension-provided
         * title fingerprint + left-pane geometry even after Dashboard receives
         * focus a moment later. */
        await claimFocusedTitlebarSurface(landingId);
        scheduleTitlebarClaimRetries(landingId);

        await restoreWindow(dashboardId, RIGHT, true);
        if (shuttingDown) return;

        await claimFocusedTitlebarSurface(dashboardId);
        scheduleTitlebarClaimRetries(dashboardId);
    } else {
        await restoreWindow(dashboardId, LEFT, true);
        if (shuttingDown) return;

        await claimFocusedTitlebarSurface(dashboardId);
        scheduleTitlebarClaimRetries(dashboardId);
    }

    runStreamShellLaunchSelfTest()
        .catch(() => {});

    await broadcastState();
}

async function openShellWarmLastProvider() {
    const stored =
        await chrome.storage.local.get(
            "activeProvider"
        );

    const providerName =
        stored.activeProvider;

    /*
     * The visible shell always starts on its Home surface (Landing in Wide,
     * Dashboard in Compact). activeProvider is only a persistent hint for
     * which service should be warm in the background; leftMode remains the
     * source of truth for what is actually visible.
     */
    await openShellHome();

    if (
        shuttingDown ||
        !PROVIDERS[
            providerName
        ]
    ) {
        return;
    }

    const windowId =
        await ensureProviderWindow(
            providerName,
            { parked: true }
        );

    if (
        shuttingDown
    ) {
        return;
    }

    await setWindowMuted(
        windowId,
        true
    );

    await safelyMinimizeWindow(
        windowId
    );

    await parkWindowOffscreen(
        windowId,
        LEFT
    );

    await chrome.storage.local.remove(
        `streamShellNowPlaying_${providerName}`
    );

    /*
     * Reassert the visual state after the warm-up window was created. The
     * remembered provider must never make its titlebar button look selected
     * while it is parked behind the current Home surface.
     */
    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    await chrome.storage.local.set({
        leftMode:
            displayProfile?.mode === "compact"
                ? "dashboard"
                : "landing"
    });

    await broadcastState();
}



