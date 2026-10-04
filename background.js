/*
 * Shared provider resume URL canonicalization + stable media identity.
 * This file is concatenated into both common/shell.js and background.js.
 * Keep it dependency-free and DOM-free.
 */
function normalizeProviderResumeUrl(providerName, rawUrl) {
    try {
        const url = new URL(String(rawUrl || ""));
        url.hash = "";

        if (providerName === "youtube") {
            const videoId = url.searchParams.get("v");
            if (videoId) {
                const clean = new URL(`${url.origin}/watch`);
                clean.searchParams.set("v", videoId);

                for (const key of ["list", "index"]) {
                    const value = url.searchParams.get(key);
                    if (value) clean.searchParams.set(key, value);
                }

                return clean.toString();
            }

            for (const key of ["t", "start", "time_continue"]) {
                url.searchParams.delete(key);
            }
            return url.toString();
        }

        if (providerName === "netflix") {
            const match = url.pathname.match(/^\/watch\/([^/]+)/i);
            if (match) url.pathname = `/watch/${match[1]}`;
            url.search = "";
            return url.toString();
        }

        if (providerName === "prime") {
            const match = url.pathname.match(/^(.*?\/(?:gp\/video\/)?detail\/[^/]+)/i);
            if (match) url.pathname = match[1];
            url.search = "";
            return url.toString();
        }

        return url.toString();
    } catch {
        return String(rawUrl || "").split("#")[0];
    }
}

function getProviderMediaIdentity(providerName, rawUrl) {
    try {
        const normalized = normalizeProviderResumeUrl(providerName, rawUrl);
        const url = new URL(String(normalized || rawUrl || ""));
        const pathname = url.pathname.replace(/\/+$/, "") || "/";

        if (providerName === "youtube") {
            const videoId = url.searchParams.get("v");
            return videoId ? `youtube:${videoId}` : `youtube:${pathname}`;
        }

        if (providerName === "netflix") {
            const match = pathname.match(/^\/watch\/([^/]+)/i);
            return match ? `netflix:watch:${match[1]}` : `netflix:${url.origin}${pathname}`;
        }

        if (providerName === "prime") {
            const match = pathname.match(/\/(?:gp\/video\/)?detail\/([^/]+)/i);
            return match ? `prime:detail:${match[1]}` : `prime:${url.origin}${pathname}`;
        }

        if (providerName === "crunchyroll") {
            const match = pathname.match(/^\/watch\/([^/]+)/i);
            return match ? `crunchyroll:watch:${match[1]}` : `crunchyroll:${url.origin}${pathname}`;
        }

        return `${providerName}:${url.origin}${pathname}`;
    } catch {
        return `${providerName}:${String(rawUrl || "").split("#")[0]}`;
    }
}

/*
 * Resolve a persisted provider media identity back to a provider-owned URL.
 * This is intentionally deterministic and network-free: dedicated adapters
 * can call it with their current origin, while the service worker uses it as
 * a safe fallback when a freshly opened content script is not ready yet.
 */
function isProviderOwnedMediaUrl(providerName, rawUrl) {
    try {
        const url = new URL(String(rawUrl || ""));
        const host = url.hostname.toLowerCase();

        switch (providerName) {
            case "youtube":
                return host === "youtube.com" || host.endsWith(".youtube.com");
            case "netflix":
                return host === "netflix.com" || host.endsWith(".netflix.com");
            case "prime":
                return host === "primevideo.com" ||
                    host.endsWith(".primevideo.com") ||
                    host === "amazon.de" ||
                    host.endsWith(".amazon.de");
            case "disney":
                return host === "disneyplus.com" || host.endsWith(".disneyplus.com");
            case "crunchyroll":
                return host === "crunchyroll.com" || host.endsWith(".crunchyroll.com");
            default:
                return false;
        }
    } catch {
        return false;
    }
}

function getResolvableProviderIdentity(providerName, rawIdentity, fallbackUrl = "") {
    const identity = String(rawIdentity || "").trim();

    const fromIdentity = (() => {
        if (providerName === "youtube") {
            const match = identity.match(/^youtube:([A-Za-z0-9_-]{6,32})$/);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        if (providerName === "netflix") {
            const match = identity.match(/^netflix:watch:([^:/?#]+)$/i);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        if (providerName === "prime") {
            const match = identity.match(/^prime:detail:([^:/?#]+)$/i);
            if (match) return { identity, kind: "detail", mediaId: match[1] };
        }

        if (providerName === "crunchyroll") {
            const match = identity.match(/^crunchyroll:watch:([^:/?#]+)$/i);
            if (match) return { identity, kind: "watch", mediaId: match[1] };
        }

        return null;
    })();

    if (fromIdentity) return fromIdentity;

    if (!isProviderOwnedMediaUrl(providerName, fallbackUrl)) return null;

    const derived = getProviderMediaIdentity(providerName, fallbackUrl);
    if (!derived || derived === identity) return null;

    return getResolvableProviderIdentity(providerName, derived, "");
}

function resolveProviderMediaLink(
    providerName,
    rawIdentity,
    fallbackUrl = "",
    preferredOrigin = ""
) {
    const fallback = isProviderOwnedMediaUrl(providerName, fallbackUrl)
        ? normalizeProviderResumeUrl(providerName, fallbackUrl)
        : "";

    const resolvable = getResolvableProviderIdentity(
        providerName,
        rawIdentity,
        fallback
    );

    let url = "";
    let strategy = "canonical-fallback";

    if (resolvable?.mediaId) {
        const mediaId = encodeURIComponent(resolvable.mediaId);

        if (providerName === "youtube") {
            const target = new URL("https://www.youtube.com/watch");
            target.searchParams.set("v", resolvable.mediaId);

            try {
                const old = new URL(fallback);
                if (
                    isProviderOwnedMediaUrl("youtube", old.toString()) &&
                    old.searchParams.get("v") === resolvable.mediaId
                ) {
                    for (const key of ["list", "index"]) {
                        const value = old.searchParams.get(key);
                        if (value) target.searchParams.set(key, value);
                    }
                }
            } catch {
            }

            url = target.toString();
            strategy = "youtube-watch-id";
        }

        if (providerName === "netflix") {
            url = `https://www.netflix.com/watch/${mediaId}`;
            strategy = "netflix-watch-id";
        }

        if (providerName === "prime") {
            let origin = "https://www.primevideo.com";

            try {
                const candidate = new URL(String(preferredOrigin || ""));
                if (isProviderOwnedMediaUrl("prime", candidate.toString())) {
                    origin = candidate.origin;
                }
            } catch {
            }

            const host = new URL(origin).hostname.toLowerCase();
            url = host === "amazon.de" || host.endsWith(".amazon.de")
                ? `${origin}/gp/video/detail/${mediaId}`
                : `${origin}/detail/${mediaId}`;
            strategy = "prime-detail-id";
        }

        if (providerName === "crunchyroll") {
            url = `https://www.crunchyroll.com/watch/${mediaId}`;
            strategy = "crunchyroll-watch-id";
        }
    }

    if (!url && fallback) {
        url = fallback;
    }

    if (!url || !isProviderOwnedMediaUrl(providerName, url)) {
        return null;
    }

    const identity = getProviderMediaIdentity(providerName, url);

    return {
        provider: providerName,
        identity,
        url: normalizeProviderResumeUrl(providerName, url),
        strategy,
        reconstructed: Boolean(
            resolvable &&
            strategy !== "canonical-fallback"
        )
    };
}

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

const TWITCH_SPLIT_LAB_STORAGE_KEY =
    "streamShellTwitchSplitLab";

const TWITCH_WORKSPACE_V2_STORAGE_KEY =
    "streamShellTwitchWorkspaceV2";

const TWITCH_WORKSPACE_SLOT_URL =
    chrome.runtime.getURL("twitch-workspace/slot.html");

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
    6;

const TITLEBAR_RECONCILE_INTERVAL_MS =
    2500;


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
    const providerEntries = Object.entries(providerWindows);

    await Promise.all(
        providerEntries.map(([providerName, windowId]) =>
            pauseProviderWindowPlayback(
                windowId,
                providerName,
                "shell-home"
            )
        )
    );

    for (const [providerName, windowId] of providerEntries) {
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



/*
 * ============================================================
 * DIAGNOSTICS FLIGHT RECORDER
 * ============================================================
 * Session-scoped structured ringbuffer. The service worker is the single
 * writer so provider pages and Dashboard only submit small event records.
 */
const STREAM_SHELL_FLIGHT_RECORDER_KEY = "streamShellFlightRecorder";
const STREAM_SHELL_FLIGHT_RECORDER_VERSION = 1;
const STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS = 200;

let flightRecorderHydrated = false;
let flightRecorderEvents = [];
let flightRecorderSequence = 0;
let flightRecorderWriteQueue = Promise.resolve();

function sanitizeFlightRecorderValue(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return value.slice(0, 240);
    if (depth >= 2) return String(value).slice(0, 240);

    if (Array.isArray(value)) {
        return value
            .slice(0, 12)
            .map(item => sanitizeFlightRecorderValue(item, depth + 1));
    }

    if (typeof value === "object") {
        const result = {};
        for (const [key, item] of Object.entries(value).slice(0, 16)) {
            result[String(key).slice(0, 80)] = sanitizeFlightRecorderValue(
                item,
                depth + 1
            );
        }
        return result;
    }

    return String(value).slice(0, 240);
}

async function hydrateFlightRecorder() {
    if (flightRecorderHydrated) return;
    flightRecorderHydrated = true;

    try {
        const stored = await chrome.storage.session.get(
            STREAM_SHELL_FLIGHT_RECORDER_KEY
        );
        const snapshot = stored[STREAM_SHELL_FLIGHT_RECORDER_KEY];
        if (Array.isArray(snapshot?.events)) {
            flightRecorderEvents = snapshot.events
                .slice(-STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);
        }
    } catch {
        flightRecorderEvents = [];
    }
}

function normalizeFlightRecorderEvent(input = {}) {
    const action = String(input.action || "event").slice(0, 100);
    const source = String(input.source || "background").slice(0, 40);
    const category = String(input.category || "runtime").slice(0, 60);
    const level = ["info", "warn", "error"].includes(input.level)
        ? input.level
        : "info";
    const provider = PROVIDERS[input.provider] ? input.provider : null;
    const at = Date.now();

    return {
        id: `${at.toString(36)}-${(++flightRecorderSequence).toString(36)}`,
        at,
        iso: new Date(at).toISOString(),
        source,
        category,
        action,
        level,
        provider,
        detail: sanitizeFlightRecorderValue(input.detail || {})
    };
}

function recordFlightEvent(input = {}) {
    const event = normalizeFlightRecorderEvent(input);

    flightRecorderWriteQueue = flightRecorderWriteQueue
        .then(async () => {
            await hydrateFlightRecorder();
            flightRecorderEvents.push(event);
            flightRecorderEvents = flightRecorderEvents
                .slice(-STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS);

            try {
                await chrome.storage.session.set({
                    [STREAM_SHELL_FLIGHT_RECORDER_KEY]: {
                        format: "stream-shell-flight-recorder",
                        version: STREAM_SHELL_FLIGHT_RECORDER_VERSION,
                        maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
                        updatedAt: event.at,
                        events: flightRecorderEvents
                    }
                });
            } catch {
            }
        })
        .catch(() => {});

    return flightRecorderWriteQueue.then(() => event);
}

async function getFlightRecorderSnapshot(limit = null) {
    await flightRecorderWriteQueue;
    await hydrateFlightRecorder();

    const numericLimit = Number(limit);
    const events = Number.isFinite(numericLimit) && numericLimit > 0
        ? flightRecorderEvents.slice(-Math.floor(numericLimit))
        : flightRecorderEvents.slice();

    return {
        format: "stream-shell-flight-recorder",
        version: STREAM_SHELL_FLIGHT_RECORDER_VERSION,
        maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
        count: flightRecorderEvents.length,
        updatedAt: flightRecorderEvents.at(-1)?.at || null,
        events
    };
}
/*
 * ============================================================
 * DISPLAY PROFILE / LAYOUT TARGET DETECTION
 * ============================================================
 *
 * 0.13.x introduces the display-profile foundation for the two personal
 * target layouts:
 *   - wide    -> 3840x1080 / 32:9
 *   - compact -> 16:9 or 16:10 single-surface targets
 *
 * Auto target priority is deliberately opinionated:
 *   32:9 > 16:9 > 16:10.
 * 16:9 reuses Compact's exact titlebar and single-surface layout.
 *
 * Chromium exposes logical display bounds on desktop, so classification
 * intentionally uses aspect ratio; the native resolutions above are reference
 * targets rather than values inferred from OS DPI scaling. 0.13.1 also owns
 * the legacy-pane geometry so every shell window is anchored to the selected
 * display instead of assuming virtual-desktop origin 0,0. The real Compact
 * single-surface host remains a later migration.
 */

const STREAM_SHELL_DISPLAY_MODE_KEY =
    "streamShellDisplayMode";

const STREAM_SHELL_DISPLAY_PROFILE_VERSION = 2;
const STREAM_SHELL_WIDE_ASPECT = 32 / 9;
const STREAM_SHELL_STANDARD_ASPECT = 16 / 9;
const STREAM_SHELL_COMPACT_ASPECT = 16 / 10;
const STREAM_SHELL_ASPECT_TOLERANCE = 0.12;

let streamShellDisplayProfileCache = null;


function normalizeDisplayModeOverride(value) {
    const normalized = String(value || "auto").toLowerCase();
    return ["auto", "wide", "compact"].includes(normalized)
        ? normalized
        : "auto";
}


function normalizeDisplayRect(rect) {
    return {
        left: Number(rect?.left) || 0,
        top: Number(rect?.top) || 0,
        width: Math.max(0, Number(rect?.width) || 0),
        height: Math.max(0, Number(rect?.height) || 0)
    };
}


function displayAspectDistance(display, targetAspect) {
    return Math.abs(
        Number(display?.aspectRatio || 0) - targetAspect
    );
}


function isWideDisplayCandidate(display) {
    return displayAspectDistance(
        display,
        STREAM_SHELL_WIDE_ASPECT
    ) <= STREAM_SHELL_ASPECT_TOLERANCE;
}


function isStandardDisplayCandidate(display) {
    return displayAspectDistance(
        display,
        STREAM_SHELL_STANDARD_ASPECT
    ) <= STREAM_SHELL_ASPECT_TOLERANCE;
}


function isCompact16x10DisplayCandidate(display) {
    return displayAspectDistance(
        display,
        STREAM_SHELL_COMPACT_ASPECT
    ) <= STREAM_SHELL_ASPECT_TOLERANCE;
}


function isCompactDisplayCandidate(display) {
    return (
        isStandardDisplayCandidate(display) ||
        isCompact16x10DisplayCandidate(display)
    );
}


function normalizeDisplayUnit(display) {
    const bounds = normalizeDisplayRect(display?.bounds);
    const workArea = normalizeDisplayRect(display?.workArea);
    const displayZoomFactor = Number(display?.displayZoomFactor);
    const safeDisplayZoomFactor = Number.isFinite(displayZoomFactor) && displayZoomFactor > 0
        ? displayZoomFactor
        : 1;
    const aspectRatio = bounds.height > 0
        ? bounds.width / bounds.height
        : 0;

    const normalized = {
        id: String(display?.id || ""),
        name: String(display?.name || ""),
        isPrimary: display?.isPrimary === true,
        isInternal: display?.isInternal === true,
        isEnabled: display?.isEnabled !== false,
        rotation: Number(display?.rotation) || 0,
        displayZoomFactor: safeDisplayZoomFactor,
        dpiX: Number(display?.dpiX) || null,
        dpiY: Number(display?.dpiY) || null,
        bounds,
        workArea,
        aspectRatio: Number(aspectRatio.toFixed(4)),
        targetClass: "other",
        referenceTarget: null
    };

    if (isWideDisplayCandidate(normalized)) {
        normalized.targetClass = "wide-32:9";
        normalized.referenceTarget = "32:9";
    } else if (isStandardDisplayCandidate(normalized)) {
        normalized.targetClass = "compact-16:9";
        normalized.referenceTarget = "16:9";
    } else if (isCompact16x10DisplayCandidate(normalized)) {
        normalized.targetClass = "compact-16:10";
        normalized.referenceTarget = "16:10";
    }

    return normalized;
}


function displayArea(display) {
    return (
        Number(display?.bounds?.width) || 0
    ) * (
        Number(display?.bounds?.height) || 0
    );
}


function chooseDisplayForMode(displays, mode) {
    const enabled = displays.filter(display => display.isEnabled !== false);
    const targetCandidates = enabled.filter(
        mode === "wide"
            ? isWideDisplayCandidate
            : isCompactDisplayCandidate
    );

    const candidates = targetCandidates.length
        ? targetCandidates
        : enabled;

    return [...candidates]
        .sort((a, b) => {
            if (mode === "compact") {
                /*
                 * 16:9 intentionally wins over 16:10 whenever both are
                 * connected. Only compare internal/primary status after the
                 * requested aspect priority has been resolved.
                 */
                const compactTargetPriority = display =>
                    isStandardDisplayCandidate(display)
                        ? 2
                        : (isCompact16x10DisplayCandidate(display) ? 1 : 0);
                const targetPriorityDelta =
                    compactTargetPriority(b) - compactTargetPriority(a);
                if (targetPriorityDelta) return targetPriorityDelta;

                const internalDelta = Number(b.isInternal) - Number(a.isInternal);
                if (internalDelta) return internalDelta;
            }

            const primaryDelta = Number(b.isPrimary) - Number(a.isPrimary);
            if (primaryDelta) return primaryDelta;

            const targetDelta = Number(Boolean(b.referenceTarget)) - Number(Boolean(a.referenceTarget));
            if (targetDelta) return targetDelta;

            return displayArea(b) - displayArea(a);
        })[0] || null;
}


function chooseAutomaticDisplayProfile(displays) {
    const wideCandidates = displays.filter(isWideDisplayCandidate);
    if (wideCandidates.length) {
        return {
            mode: "wide",
            target: chooseDisplayForMode(wideCandidates, "wide"),
            reason: "auto-wide-present",
            supportedTarget: true
        };
    }

    const standardCandidates = displays.filter(isStandardDisplayCandidate);
    if (standardCandidates.length) {
        return {
            mode: "compact",
            target: chooseDisplayForMode(standardCandidates, "compact"),
            reason: "auto-16:9-present",
            supportedTarget: true
        };
    }

    const compact16x10Candidates = displays.filter(isCompact16x10DisplayCandidate);
    if (compact16x10Candidates.length) {
        return {
            mode: "compact",
            target: chooseDisplayForMode(compact16x10Candidates, "compact"),
            reason: "auto-16:10-present",
            supportedTarget: true
        };
    }

    /*
     * Stream Shell is intentionally not a general-purpose responsive app.
     * Unknown layouts receive a deterministic fallback only so Diagnostics
     * can describe them; no support promise is implied by this branch.
     */
    const primary = displays.find(display => display.isPrimary) || displays[0] || null;
    const fallbackMode = Number(primary?.aspectRatio || 0) >= 2.8
        ? "wide"
        : "compact";

    return {
        mode: fallbackMode,
        target: primary,
        reason: "auto-unsupported-fallback",
        supportedTarget: false
    };
}


function plannedDisplayLayout(mode, target) {
    if (!target?.bounds) {
        return {
            full: null,
            left: null,
            right: null
        };
    }

    const full = { ...target.bounds };

    if (mode !== "wide") {
        return {
            full,
            left: full,
            right: null
        };
    }

    const leftWidth = Math.floor(full.width / 2);
    const rightWidth = Math.max(0, full.width - leftWidth);

    return {
        full,
        left: {
            left: full.left,
            top: full.top,
            width: leftWidth,
            height: full.height
        },
        right: {
            left: full.left + leftWidth,
            top: full.top,
            width: rightWidth,
            height: full.height
        }
    };
}


function appliedLegacyWindowGeometry(profile) {
    const target = profile?.targetDisplay || null;

    if (!target) {
        return {
            left: { ...LEFT },
            right: { ...RIGHT },
            source: "legacy-fallback"
        };
    }

    const rawRect = profile.mode === "compact"
        ? (target.workArea?.width && target.workArea?.height
            ? target.workArea
            : target.bounds)
        : target.bounds;

    const full = normalizeDisplayRect(rawRect);
    if (!full.width || !full.height) {
        return {
            left: { ...LEFT },
            right: { ...RIGHT },
            source: "legacy-fallback"
        };
    }

    if (profile.mode === "compact") {
        /*
         * Compact is a true single-surface shell. Dashboard and provider
         * windows deliberately share the same full work-area geometry and
         * the window manager decides which one is visible. Keeping both LEFT
         * and RIGHT equal also lets the existing Discord/native integrations
         * reuse the selected display without learning a third geometry type.
         */
        const surface = {
            left: full.left,
            top: full.top,
            width: full.width,
            height: full.height
        };

        return {
            left: { ...surface },
            right: { ...surface },
            source: "target-display-compact-single-surface"
        };
    }

    const leftWidth = Math.floor(full.width / 2);
    const rightWidth = Math.max(1, full.width - leftWidth);

    return {
        left: {
            left: full.left,
            top: full.top,
            width: Math.max(1, leftWidth),
            height: full.height
        },
        right: {
            left: full.left + leftWidth,
            top: full.top,
            width: rightWidth,
            height: full.height
        },
        source: "target-display-wide"
    };
}

function applyStreamShellDisplayGeometry(profile) {
    const geometry = appliedLegacyWindowGeometry(profile);

    Object.assign(LEFT, geometry.left);
    Object.assign(RIGHT, geometry.right);

    return geometry;
}


async function collectStreamShellDisplays() {
    if (!chrome.system?.display?.getInfo) {
        return {
            apiAvailable: false,
            displays: []
        };
    }

    try {
        const displays = await chrome.system.display.getInfo();
        return {
            apiAvailable: true,
            displays: (Array.isArray(displays) ? displays : [])
                .map(normalizeDisplayUnit)
                .filter(display => display.isEnabled !== false)
        };
    } catch {
        return {
            apiAvailable: false,
            displays: []
        };
    }
}


async function resolveStreamShellDisplayProfile() {
    let override = "auto";

    try {
        const stored = await chrome.storage.local.get(
            STREAM_SHELL_DISPLAY_MODE_KEY
        );
        override = normalizeDisplayModeOverride(
            stored[STREAM_SHELL_DISPLAY_MODE_KEY]
        );
    } catch {
    }

    const collected = await collectStreamShellDisplays();
    const displays = collected.displays;

    let resolution;

    if (!collected.apiAvailable || !displays.length) {
        resolution = {
            mode: override === "compact" ? "compact" : "wide",
            target: null,
            reason: collected.apiAvailable
                ? "display-list-empty"
                : "display-api-unavailable",
            supportedTarget: false
        };
    } else if (override === "wide" || override === "compact") {
        const target = chooseDisplayForMode(displays, override);
        resolution = {
            mode: override,
            target,
            reason: `override-${override}`,
            supportedTarget: target
                ? (
                    override === "wide"
                        ? isWideDisplayCandidate(target)
                        : isCompactDisplayCandidate(target)
                )
                : false
        };
    } else {
        resolution = chooseAutomaticDisplayProfile(displays);
    }

    const target = resolution.target || null;
    const profile = {
        version: STREAM_SHELL_DISPLAY_PROFILE_VERSION,
        override,
        mode: resolution.mode,
        reason: resolution.reason,
        supportedTarget: resolution.supportedTarget === true,
        apiAvailable: collected.apiAvailable === true,
        displayCount: displays.length,
        targetDisplayId: target?.id || null,
        targetDisplay: target,
        displays,
        plannedLayout: plannedDisplayLayout(
            resolution.mode,
            target
        ),
        compactHostReady: true,
        appliedLayout: resolution.mode === "wide"
            ? "wide-target-panes"
            : "compact-single-surface",
        detectedAt: Date.now()
    };

    profile.appliedGeometry = applyStreamShellDisplayGeometry(profile);
    return profile;
}


function streamShellDisplayProfileSignature(profile) {
    return JSON.stringify({
        override: profile?.override || "auto",
        mode: profile?.mode || null,
        reason: profile?.reason || null,
        supportedTarget: profile?.supportedTarget === true,
        targetDisplayId: profile?.targetDisplayId || null,
        displayCount: Number(profile?.displayCount) || 0,
        bounds: profile?.targetDisplay?.bounds || null,
        displayZoomFactor: profile?.targetDisplay?.displayZoomFactor || null
    });
}


async function refreshStreamShellDisplayProfile(reason = "refresh") {
    const previous = streamShellDisplayProfileCache;
    const next = await resolveStreamShellDisplayProfile();
    streamShellDisplayProfileCache = next;

    if (
        !previous ||
        streamShellDisplayProfileSignature(previous) !==
            streamShellDisplayProfileSignature(next)
    ) {
        recordFlightEvent({
            source: "background",
            category: "display-profile",
            action: previous ? "changed" : "detected",
            level: next.supportedTarget ? "info" : "warn",
            detail: {
                mode: next.mode,
                override: next.override,
                supportedTarget: next.supportedTarget,
                displayCount: next.displayCount,
                targetClass: next.targetDisplay?.targetClass || null,
                referenceTarget: next.targetDisplay?.referenceTarget || null,
                reason
            }
        }).catch(() => {});
    }

    return next;
}


async function getStreamShellDisplayProfile() {
    if (streamShellDisplayProfileCache) {
        return streamShellDisplayProfileCache;
    }

    return refreshStreamShellDisplayProfile("lazy");
}


if (chrome.system?.display?.onDisplayChanged?.addListener) {
    chrome.system.display.onDisplayChanged.addListener(
        () => {
            refreshStreamShellDisplayProfile("display-changed")
                .catch(() => {});
        }
    );
}


chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (
            areaName !== "local" ||
            !Object.prototype.hasOwnProperty.call(
                changes,
                STREAM_SHELL_DISPLAY_MODE_KEY
            )
        ) {
            return;
        }

        refreshStreamShellDisplayProfile("override-changed")
            .catch(() => {});
    }
);
function streamShellWindowBoundsMatch(
    window,
    bounds,
    tolerance = 8
) {
    if (
        !window ||
        !bounds
    ) {
        return false;
    }

    return (
        Math.abs(Number(window.left) - Number(bounds.left)) <= tolerance &&
        Math.abs(Number(window.top) - Number(bounds.top)) <= tolerance &&
        Math.abs(Number(window.width) - Number(bounds.width)) <= tolerance &&
        Math.abs(Number(window.height) - Number(bounds.height)) <= tolerance
    );
}


async function restoreWindow(
    windowId,
    bounds,
    focused
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        /*
         * A remembered warm provider can be minimized with a browser-owned
         * restore rectangle. Opera may briefly restore that rectangle before a
         * following bounds update lands. Keep focus away until LEFT/RIGHT is
         * verified so a stale 32:9 restore rectangle can never become the
         * claimed Stream Shell surface.
         */
        await chrome.windows.update(
            windowId,
            {
                state:
                    "normal",

                focused:
                    false
            }
        );

        if (
            shuttingDown
        ) {
            return;
        }

        const delays =
            [0, 40, 100];

        let geometryReady =
            false;

        for (
            let attempt = 0;
            attempt < delays.length;
            attempt++
        ) {
            const delay =
                delays[attempt];

            if (delay > 0) {
                await new Promise(
                    resolve =>
                        setTimeout(resolve, delay)
                );
            }

            if (
                shuttingDown
            ) {
                return;
            }

            try {
                await chrome.windows.update(
                    windowId,
                    {
                        left:
                            bounds.left,

                        top:
                            bounds.top,

                        width:
                            bounds.width,

                        height:
                            bounds.height,

                        focused:
                            false
                    }
                );

                const observed =
                    await chrome.windows.get(
                        windowId
                    );

                if (
                    streamShellWindowBoundsMatch(
                        observed,
                        bounds
                    )
                ) {
                    geometryReady =
                        true;

                    break;
                }
            } catch {
            }
        }

        if (
            focused &&
            !shuttingDown
        ) {
            await chrome.windows.update(
                windowId,
                {
                    focused:
                        true
                }
            );
        }

        if (!geometryReady) {
            console.warn(
                "Could not verify restored window geometry:",
                windowId,
                bounds
            );
        }
    } catch (error) {
        console.warn(
            "Could not restore window:",
            windowId,
            error
        );
    }
}


async function getStreamShellParkingBounds(
    referenceBounds = LEFT
) {
    let displays = [];

    try {
        displays = await chrome.system.display.getInfo();
    } catch {
    }

    const rects = (Array.isArray(displays) ? displays : [])
        .map(display => display?.bounds)
        .filter(bounds =>
            Number.isFinite(Number(bounds?.left)) &&
            Number.isFinite(Number(bounds?.top)) &&
            Number(bounds?.width) > 0 &&
            Number(bounds?.height) > 0
        );

    const virtualBottom = rects.length
        ? Math.max(...rects.map(bounds => Number(bounds.top) + Number(bounds.height)))
        : Number(referenceBounds?.top || 0) + Number(referenceBounds?.height || 1080);

    const width = Math.max(320, Number(referenceBounds?.width) || 960);
    const height = Math.max(240, Number(referenceBounds?.height) || 540);

    return {
        left: Number(referenceBounds?.left) || 0,
        top: virtualBottom + 240,
        width,
        height
    };
}


async function parkWindowOffscreen(
    windowId,
    referenceBounds = LEFT
) {
    if (
        shuttingDown ||
        !Number.isInteger(windowId)
    ) {
        return;
    }

    try {
        const bounds = await getStreamShellParkingBounds(referenceBounds);

        await chrome.windows.update(windowId, {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            focused: false
        });
    } catch {
    }
}


async function safelyMinimizeWindow(
    windowId
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        await chrome.windows.update(
            windowId,
            {
                state:
                    "minimized"
            }
        );
    } catch {
    }
}


async function safelyRemoveWindow(
    windowId
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        await chrome.windows.remove(
            windowId
        );
    } catch {
    }
}


async function getProviderWindows() {
    const stored =
        await chrome.storage.local.get(
            "providerWindows"
        );

    return (
        stored.providerWindows ||
        {}
    );
}


async function saveProviderWindows(
    windows
) {
    await chrome.storage.local.set({
        providerWindows:
            windows
    });
}


async function ensureProviderWindow(
    providerName,
    options = null
) {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Stream Shell is shutting down."
        );
    }

    if (
        providerCreationLocks.has(
            providerName
        )
    ) {
        return providerCreationLocks.get(
            providerName
        );
    }

    const promise =
        _ensureProviderWindow(
            providerName,
            options
        )
            .finally(
                () => {
                    providerCreationLocks.delete(
                        providerName
                    );
                }
            );

    providerCreationLocks.set(
        providerName,
        promise
    );

    return promise;
}


async function _ensureProviderWindow(
    providerName,
    options = null
) {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    const provider =
        PROVIDERS[
            providerName
        ];

    if (
        !provider
    ) {
        throw new Error(
            `Unknown provider: ${providerName}`
        );
    }

    const parkedCreation =
        options?.parked === true;

    const windows =
        await getProviderWindows();

    let windowId =
        windows[
            providerName
        ];

    if (
        windowId
    ) {
        try {
            const existingWindow =
                await chrome.windows.get(
                    windowId
                );

            /*
             * The remembered warm provider is the only provider created while
             * hidden. Older builds created it minimized without a target
             * restore rectangle, allowing Opera to remember the full 32:9
             * display. Repair that stale window once instead of letting it
             * restore fullscreen and fail the native LEFT-pane claim.
             */
            if (
                parkedCreation &&
                !streamShellWindowBoundsMatch(
                    existingWindow,
                    LEFT
                )
            ) {
                /*
                 * Home deliberately parks provider windows below the virtual
                 * desktop. Normalize the remembered provider's restore bounds
                 * in place instead of recreating its tab/session. Landing is
                 * already visible above it and restoreWindow keeps it unfocused.
                 */
                await restoreWindow(
                    windowId,
                    LEFT,
                    false
                );

                await safelyMinimizeWindow(
                    windowId
                );
            }

            return windowId;
        } catch {
            delete windows[
                providerName
            ];

            await saveProviderWindows(
                windows
            );

            windowId =
                null;
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    /*
     * Always create provider popups at their real LEFT-pane geometry. A warm
     * provider is minimized immediately afterwards, but its native restore
     * rectangle remains the same 16:9 pane as every normally opened provider.
     */
    const createData = {
        type: "popup",
        state: "normal",
        focused: false,
        url: provider.url,
        left: LEFT.left,
        top: LEFT.top,
        width: LEFT.width,
        height: LEFT.height
    };

    const win =
        await chrome.windows.create(
            createData
        );

    if (
        shuttingDown
    ) {
        if (
            win?.id
        ) {
            await safelyRemoveWindow(
                win.id
            );
        }

        throw new Error(
            "Provider creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            `${providerName} window could not be created.`
        );
    }

    windowId =
        win.id;

    windows[
        providerName
    ] =
        windowId;

    await saveProviderWindows(
        windows
    );

    await setWindowMuted(
        windowId,
        true
    );

    if (parkedCreation) {
        await safelyMinimizeWindow(
            windowId
        );
    }

    recordFlightEvent({
        source: "background",
        category: "provider-window",
        action: "opened",
        provider: providerName,
        detail: { windowId }
    }).catch(() => {});

    return windowId;
}


async function switchProvider(
    providerName
) {
    if (
        shuttingDown
    ) {
        return;
    }

    if (
        !PROVIDERS[
            providerName
        ]
    ) {
        throw new Error(
            `Unknown provider: ${providerName}`
        );
    }

    titlebarFullscreenActive = false;
    titlebarFullscreenWindowId = null;

    await stopVolumeCaptureForProviderChange(
        providerName
    );

    const targetWindowId =
        await ensureProviderWindow(
            providerName
        );

    if (
        shuttingDown
    ) {
        return;
    }

    const windows =
        await getProviderWindows();

    const inactiveProviders =
        Object.entries(
            windows
        )
            .filter(
                ([name, windowId]) =>
                    name !== providerName &&
                    Number.isInteger(windowId)
            );

    /*
     * Pause outgoing/parked provider playback through the provider adapter
     * before muting and minimizing. Keep the pause requests parallel so an
     * async provider bridge (notably Netflix) cannot serially delay switching.
     */
    await Promise.all(
        inactiveProviders.map(
            ([name, windowId]) =>
                pauseProviderWindowPlayback(
                    windowId,
                    name,
                    "provider-switch"
                )
        )
    );

    for (
        const [name, windowId]
        of inactiveProviders
    ) {
        await setWindowMuted(
            windowId,
            true
        );

        await safelyMinimizeWindow(
            windowId
        );


        /*
         * A minimized provider must not keep advertising an old playback
         * session on the Dashboard while another provider is on top.
         */
        await chrome.storage.local.remove(
            `streamShellNowPlaying_${name}`
        );
    }

    if (
        shuttingDown
    ) {
        return;
    }

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    const compact = displayProfile?.mode === "compact";

    /*
     * Publish provider intent before the native focus transition in both layout
     * profiles. This keeps the extension as the source of truth for ownership.
     */
    await chrome.storage.local.set({
        activeProvider: providerName,
        leftMode: providerName
    });

    if (compact) {
        /* Compact is a true single-surface host. */
        const dashboardWindowId = await getDashboardWindowId();
        if (Number.isInteger(dashboardWindowId)) {
            await safelyMinimizeWindow(
                dashboardWindowId
            );
        }
    }

    await restoreWindow(
        targetWindowId,
        LEFT,
        true
    );

    await claimFocusedTitlebarSurface(
        targetWindowId
    );
    scheduleTitlebarClaimRetries(
        targetWindowId
    );

    if (
        shuttingDown
    ) {
        return;
    }

    await setWindowMuted(
        targetWindowId,
        false
    );

    await chrome.storage.local.set({
        activeProvider:
            providerName,

        leftMode:
            providerName
    });

    recordFlightEvent({
        source: "background",
        category: "provider-window",
        action: "activated",
        provider: providerName,
        detail: { windowId: targetWindowId }
    }).catch(() => {});

    await broadcastState();
}


async function pauseProviderWindowPlayback(
    windowId,
    providerName = null,
    reason = "provider-switch"
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return false;
    }

    let tabs;

    try {
        tabs =
            await chrome.tabs.query({
                windowId
            });
    } catch {
        return false;
    }

    let delivered = false;

    for (
        const tab
        of tabs
    ) {
        if (
            !Number.isInteger(
                tab.id
            )
        ) {
            continue;
        }

        try {
            await chrome.tabs.sendMessage(
                tab.id,
                {
                    type: "stream-shell-playback-pause",
                    reason,
                    provider:
                        providerName ||
                        null
                }
            );

            delivered = true;
        } catch {
            /*
             * A provider tab can be between documents or not yet have the
             * shared content runtime. Parking/muting must still continue.
             */
        }
    }

    return delivered;
}


async function setWindowMuted(
    windowId,
    muted
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    let tabs;

    try {
        tabs =
            await chrome.tabs.query({
                windowId
            });
    } catch {
        return;
    }

    for (
        const tab
        of tabs
    ) {
        if (
            !tab.id
        ) {
            continue;
        }

        try {
            await chrome.tabs.update(
                tab.id,
                {
                    muted
                }
            );
        } catch {
        }
    }
}




/*
 * ============================================================
 * CONTINUE WATCHING RESUME
 * ============================================================
 */
function providerOwnsResumeUrl(providerName, rawUrl) {
    return isProviderOwnedMediaUrl(providerName, rawUrl);
}

async function resumeProviderFromContinue(providerName, rawUrl, currentTime, identity = "") {
    const raw = String(rawUrl || "").trim();
    const targetTime = Number(currentTime);

    if (!PROVIDERS[providerName]) throw new Error("Unknown provider.");
    if (!Number.isFinite(targetTime) || targetTime < 1) {
        throw new Error("Resume timestamp is invalid.");
    }

    /*
     * Resolve persisted media identity before navigation. The dedicated
     * provider adapter gets first shot; shared deterministic reconstruction
     * is only the fallback for a newly-created/not-yet-ready content script.
     */
    const windowId = await ensureProviderWindow(providerName);
    const tabs = await chrome.tabs.query({ windowId });
    const tab = tabs.find(item => Number.isInteger(item.id));
    if (!tab?.id) throw new Error("Provider tab is unavailable.");

    const resolved = await resolveSavedProviderMediaLink(
        providerName,
        identity,
        raw,
        tab
    );

    const url = resolved.url;
    const resumeIdentity = resolved.identity;
    if (!providerOwnsResumeUrl(providerName, url)) {
        throw new Error("Resolved media URL does not belong to the selected provider.");
    }

    const pendingKey = `streamShellPendingResume_${providerName}`;
    const requestedAt = Date.now();

    await chrome.storage.local.set({
        [pendingKey]: {
            provider: providerName,
            url,
            identity: resumeIdentity,
            currentTime: targetTime,
            requestedAt
        }
    });

    recordFlightEvent({
        source: "background",
        category: "resume",
        action: "requested",
        provider: providerName,
        detail: {
            targetTime,
            requestedAt,
            linkStrategy: resolved.strategy,
            linkSource: resolved.source
        }
    }).catch(() => {});

    const currentIdentity = providerOwnsResumeUrl(providerName, tab.url)
        ? getProviderMediaIdentity(providerName, tab.url)
        : "";

    /*
     * Do not reload an already-open matching title. The live content script
     * receives the pending-resume storage event and can seek in place. This
     * also avoids a race where it applies the seek immediately and a forced
     * reload would then throw that seek away again.
     */
    if (currentIdentity !== resumeIdentity) {
        await chrome.tabs.update(tab.id, { url });
    }

    await switchProvider(providerName);
    return true;
}
async function ensureLandingWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
        );
    }

    if (
        landingCreationLock
    ) {
        return landingCreationLock;
    }

    landingCreationLock =
        _ensureLandingWindow()
            .finally(
                () => {
                    landingCreationLock =
                        null;
                }
            );

    return landingCreationLock;
}


async function _ensureLandingWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
        );
    }

    const stored =
        await chrome.storage.local.get(
            "landingWindowId"
        );

    let windowId =
        stored.landingWindowId;

    if (
        windowId
    ) {
        try {
            await chrome.windows.get(
                windowId
            );

            return windowId;
        } catch {
            await chrome.storage.local.remove(
                "landingWindowId"
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
        );
    }

    const win =
        await chrome.windows.create({
            type:
                "popup",

            state:
                "normal",

            focused:
                false,

            left:
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            url:
                LANDING_URL
        });

    if (
        shuttingDown
    ) {
        if (
            win?.id
        ) {
            await safelyRemoveWindow(
                win.id
            );
        }

        throw new Error(
            "Landing creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            "Landing window could not be created."
        );
    }

    windowId =
        win.id;

    await chrome.storage.local.set({
        landingWindowId:
            windowId
    });

    return windowId;
}


async function showLanding(
    focused = true
) {
    if (
        shuttingDown
    ) {
        return;
    }

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    if (displayProfile?.mode === "compact") {
        await showDashboard();
        return;
    }

    await stopVolumeCaptureForProviderChange(
        "landing"
    );

    const landingId =
        await ensureLandingWindow();

    if (
        shuttingDown
    ) {
        return;
    }

    const providerWindows =
        await getProviderWindows();

    const providerEntries =
        Object.entries(
            providerWindows
        );

    await Promise.all(
        providerEntries.map(
            ([providerName, windowId]) =>
                pauseProviderWindowPlayback(
                    windowId,
                    providerName,
                    "landing"
                )
        )
    );

    for (
        const [, windowId]
        of providerEntries
    ) {
        await setWindowMuted(
            windowId,
            true
        );

        await safelyMinimizeWindow(
            windowId
        );
    }

    await chrome.storage.local.set({
        leftMode:
            "landing"
    });

    await restoreWindow(
        landingId,
        LEFT,
        focused
    );

    if (
        shuttingDown
    ) {
        return;
    }

    if (focused) {
        await claimFocusedTitlebarSurface(landingId);
        scheduleTitlebarClaimRetries(landingId);
    }

    await broadcastState();
}


async function reloadLeft() {
    if (
        shuttingDown
    ) {
        return;
    }

    const stored =
        await chrome.storage.local.get([
            "leftMode",
            "landingWindowId",
            "providerWindows"
        ]);

    const leftMode =
        stored.leftMode ||
        "landing";

    let windowId =
        null;

    if (
        leftMode ===
        "landing"
    ) {
        windowId =
            stored.landingWindowId;
    } else {
        windowId =
            stored.providerWindows?.[
                leftMode
            ];
    }

    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        const tabs =
            await chrome.tabs.query({
                windowId
            });

        const tab =
            tabs.find(
                current =>
                    current.active
            ) ||
            tabs[0];

        if (
            tab?.id
        ) {
            await chrome.tabs.reload(
                tab.id
            );
        }
    } catch (error) {
        console.error(
            "Left-side reload failed:",
            error
        );
    }
}


async function getDashboardWindowId() {
    const stored =
        await chrome.storage.local.get(
            "dashboardWindowId"
        );

    return (
        stored.dashboardWindowId ||
        null
    );
}


async function ensureDashboardWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    if (
        dashboardCreationLock
    ) {
        return dashboardCreationLock;
    }

    dashboardCreationLock =
        _ensureDashboardWindow()
            .finally(
                () => {
                    dashboardCreationLock =
                        null;
                }
            );

    return dashboardCreationLock;
}


async function _ensureDashboardWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    let windowId =
        await getDashboardWindowId();

    if (
        windowId
    ) {
        try {
            await chrome.windows.get(
                windowId
            );

            return windowId;
        } catch {
            await chrome.storage.local.remove(
                "dashboardWindowId"
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    const win =
        await chrome.windows.create({
            type:
                "popup",

            state:
                "normal",

            focused:
                false,

            left:
                RIGHT.left,

            top:
                RIGHT.top,

            width:
                RIGHT.width,

            height:
                RIGHT.height,

            url:
                DASHBOARD_URL
        });

    if (
        shuttingDown
    ) {
        if (
            win?.id
        ) {
            await safelyRemoveWindow(
                win.id
            );
        }

        throw new Error(
            "Dashboard creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            "Dashboard window could not be created."
        );
    }

    windowId =
        win.id;

    await chrome.storage.local.set({
        dashboardWindowId:
            windowId
    });

    return windowId;
}


async function showDashboard() {
    if (shuttingDown) return;

    const dashboardId = await ensureDashboardWindow();
    if (shuttingDown) return;

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    const compact = displayProfile?.mode === "compact";

    await deactivateTwitchForRightSurface({
        forceMinimize: compact
    });

    if (compact) {
        /* Avoid a native Discord round-trip on every Compact Home/Settings
         * click when Discord is not the active surface (or not installed). */
        const rightState = await chrome.storage.local.get("rightMode");
        if (rightState.rightMode === "discord") {
            await hideDiscordForDashboard();
        }
    } else {
        /* Preserve the established Wide behavior byte-for-byte in spirit. */
        await hideDiscordForDashboard();
    }

    if (shuttingDown) return;

    /* Publish Dashboard intent before its native focus transition. */
    await chrome.storage.local.set({
        ...(compact ? { leftMode: "dashboard" } : {}),
        rightMode: "dashboard"
    });

    if (compact) {
        /*
         * Compact uses mutually exclusive full-surface windows. Minimize every
         * provider before restoring Dashboard.
         */
        const providerWindows = await getProviderWindows();
        const providerEntries = Object.entries(providerWindows);

        await Promise.all(
            providerEntries.map(([providerName, windowId]) =>
                pauseProviderWindowPlayback(
                    windowId,
                    providerName,
                    "compact-dashboard"
                )
            )
        );

        for (const [, windowId] of providerEntries) {
            if (Number.isInteger(windowId)) {
                await setWindowMuted(windowId, true);
                await safelyMinimizeWindow(windowId);
            }
        }
    }

    if (shuttingDown) return;

    await restoreWindow(
        dashboardId,
        compact ? LEFT : RIGHT,
        true
    );

    await claimFocusedTitlebarSurface(
        dashboardId
    );
    scheduleTitlebarClaimRetries(
        dashboardId
    );

    if (shuttingDown) return;

    await broadcastState();
}


async function sendDiscordNative(
    action
) {
    const response =
        await chrome.runtime.sendNativeMessage(
            DISCORD_NATIVE_HOST,
            {
                action,

                executablePath:
                    DISCORD_EXECUTABLE_PATH,

                left:
                    RIGHT.left,

                top:
                    RIGHT.top,

                width:
                    RIGHT.width,

                height:
                    RIGHT.height
            }
        );

    if (
        !response?.ok
    ) {
        throw new Error(
            response?.error ||
            "Discord native helper did not respond successfully."
        );
    }

    return response;
}


async function hideDiscordForDashboard() {
    try {
        await sendDiscordNative(
            "hide"
        );
    } catch {
        /*
         * Dashboard/provider navigation must still work if Discord is closed,
         * the native host is unavailable, or the helper has not been installed.
         */
    }
}


async function showDiscord() {
    if (
        shuttingDown
    ) {
        return;
    }

    await deactivateTwitchForRightSurface();

    /*
     * Keep Dashboard alive behind the native Discord window so
     * switching back is instant.
     */
    const dashboardId =
        await ensureDashboardWindow();

    if (
        shuttingDown
    ) {
        return;
    }

    await restoreWindow(
        dashboardId,
        RIGHT,
        false
    );

    if (
        shuttingDown
    ) {
        return;
    }

    await sendDiscordNative(
        "show"
    );

    if (
        shuttingDown
    ) {
        return;
    }

    await chrome.storage.local.set({
        rightMode:
            "discord"
    });

    await broadcastState();
}


async function getDiscordNativeStatus() {
    try {
        const response =
            await sendDiscordNative(
                "status"
            );


        return {
            ok:
                true,

            running:
                response.running ===
                    true,

            visible:
                response.visible ===
                    true
        };

    } catch {

        return {
            ok:
                false,

            running:
                false,

            visible:
                false
        };
    }
}


async function syncDiscordVisibilityState() {
    const status =
        await getDiscordNativeStatus();


    if (
        !status.ok
    ) {
        return status;
    }


    const stored =
        await chrome.storage.local.get(
            "rightMode"
        );


    if (
        stored.rightMode ===
            "discord" &&
        !status.visible
    ) {
        await chrome.storage.local.set({
            rightMode:
                "dashboard"
        });


        await broadcastState();
    }


    return status;
}


/*
 * ============================================================
 * TWITCH AUXILIARY WINDOW
 * ============================================================
 *
 * Twitch is intentionally not a core provider. It is a Wide-only utility
 * surface used for normal Twitch viewing and Drops. Wide mode can keep either
 * the legacy single Twitch popup or the persistent two-member Split View. Each
 * Twitch window remains single-tab; Split View keeps the two browser documents
 * alive while Dashboard/Discord covers them.
 */

function isTwitchUrl(url) {
    try {
        const parsed = new URL(String(url || ""));
        return parsed.protocol === "https:" && /(^|\.)twitch\.tv$/i.test(parsed.hostname);
    } catch {
        return false;
    }
}

function isTwitchDropsUrl(url) {
    if (!isTwitchUrl(url)) return false;
    try {
        const parsed = new URL(url);
        return parsed.pathname.toLowerCase().startsWith("/drops/inventory");
    } catch {
        return false;
    }
}


const twitchSpawnCandidates = new Map();
let twitchRecentUserInteractionUntil = 0;

function isExtensionMutedTab(tab) {
    return Boolean(
        tab?.mutedInfo?.muted === true &&
        tab.mutedInfo.reason === "extension" &&
        (
            !tab.mutedInfo.extensionId ||
            tab.mutedInfo.extensionId === chrome.runtime.id
        )
    );
}

async function syncTwitchAutoMuteForTab(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    const tabUrl = tab.url || tab.pendingUrl;
    if (!isTwitchUrl(tabUrl)) return false;

    if (!(await isStreamShellTwitchAutomationWindow(tab.windowId))) return false;

    if (tab.autoDiscardable !== false) {
        await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    }

    /* Workspace V2 owns mute per slot. A manual HUD unmute must survive
     * Twitch SPA/tab updates instead of being immediately re-muted by the
     * legacy global Auto Mute policy. Non-workspace Twitch keeps the old
     * setting behavior. */
    const workspaceAudio = await getTwitchWorkspaceV2AudioPolicy(tab.windowId).catch(() => null);
    if (workspaceAudio) {
        const desiredMuted = workspaceAudio.muted === true;
        if ((tab.mutedInfo?.muted === true) !== desiredMuted) {
            await chrome.tabs.update(tab.id, { muted: desiredMuted }).catch(() => {});
        }
        return desiredMuted;
    }

    if (isTwitchDropsUrl(tabUrl)) return false;

    const enabled = await getTwitchSetting("streamShellTwitchAutoMute", true);
    const currentlyMuted = tab.mutedInfo?.muted === true;

    if (enabled) {
        if (!currentlyMuted) {
            await chrome.tabs.update(tab.id, { muted: true }).catch(() => {});
        }
        return true;
    }

    if (isExtensionMutedTab(tab)) {
        await chrome.tabs.update(tab.id, { muted: false }).catch(() => {});
    }

    return false;
}

async function syncTwitchAutoMuteForWindow(windowId = null) {
    const managedWindowId = Number.isInteger(windowId)
        ? windowId
        : await getTwitchWindowId();

    if (!Number.isInteger(managedWindowId)) return;

    const tabs = await getTwitchWindowTabs(managedWindowId);
    await Promise.all(tabs.map(tab => syncTwitchAutoMuteForTab(tab)));
}

async function reconcileTwitchAudioPolicy(windowId = null) {
    await syncTwitchAutoMuteForWindow(windowId);

    if (!(await getTwitchSetting("streamShellTwitchAutoMute", true))) return;

    const session = await getVolumeCaptureSession().catch(() => null);
    if (session?.provider === "twitch") {
        await stopVolumeCapture().catch(() => {});
    }
}

async function markTwitchUserInteraction(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    /* Pointer activity is still useful for spawned-window adoption, but it is
     * not itself proof that the user wants to cancel an armed raid guard.
     * Explicit Twitch channel-link navigation and Stream Shell slot edits
     * disarm their own tab guard at the point of navigation instead. */
    twitchRecentUserInteractionUntil = Date.now() + 3000;
    return true;
}

async function closeSpawnedTwitchTarget(tabId, windowId = null) {
    let targetWindowId = Number.isInteger(windowId) ? windowId : null;
    if (!targetWindowId) {
        try {
            targetWindowId = (await chrome.tabs.get(tabId)).windowId;
        } catch {}
    }

    await chrome.tabs.remove(tabId).catch(() => {});

    if (!Number.isInteger(targetWindowId)) return;
    const managedWindowId = await getTwitchWindowId();
    if (targetWindowId === managedWindowId) return;

    try {
        const remaining = await chrome.tabs.query({ windowId: targetWindowId });
        const disposable = remaining.length === 0 || remaining.every(tab => {
            const url = String(tab.url || tab.pendingUrl || "");
            return !url || url === "about:blank" || url.startsWith("chrome://newtab");
        });
        if (disposable) {
            await chrome.windows.remove(targetWindowId).catch(() => {});
        }
    } catch {}
}

async function redirectSpawnedTwitchTarget(tabId, url, sourceTabId, targetWindowId = null) {
    if (!Number.isInteger(tabId) || !Number.isInteger(sourceTabId) || !isTwitchUrl(url)) return false;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(sourceTabId);
    } catch {
        return false;
    }

    const managedWindowId = await getTwitchWindowId();

    if (sourceTab.windowId === managedWindowId) {
        await chrome.tabs.update(sourceTabId, { url, active: true }).catch(() => {});
        await closeSpawnedTwitchTarget(tabId, targetWindowId);
        await syncTwitchAutoMuteForTab(await chrome.tabs.get(sourceTabId).catch(() => null));
        return true;
    }


    return false;
}

async function adoptTwitchSpawnedTab(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;

    const managedWindowId = await getTwitchWindowId();
    if (!Number.isInteger(managedWindowId)) return false;

    if (tab.windowId === managedWindowId) {
        await syncTwitchAutoMuteForTab(tab);
        return false;
    }


    let sourceTabId = Number.isInteger(tab.openerTabId) ? tab.openerTabId : null;
    if (!sourceTabId && Date.now() <= twitchRecentUserInteractionUntil) {
        const mainTabs = await getTwitchWindowTabs(managedWindowId);
        sourceTabId = mainTabs.find(candidate => candidate.active)?.id || mainTabs[0]?.id || null;
    }
    if (!Number.isInteger(sourceTabId)) return false;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(sourceTabId);
    } catch {
        return false;
    }
    if (sourceTab.windowId !== managedWindowId) return false;

    const url = String(tab.pendingUrl || tab.url || "");
    const unresolved = !url || url === "about:blank" || url.startsWith("chrome://newtab");

    if (unresolved) {
        twitchSpawnCandidates.set(tab.id, {
            sourceTabId,
            sourceWindowId: tab.windowId,
            expiresAt: Date.now() + 7000
        });
        return false;
    }

    return redirectSpawnedTwitchTarget(tab.id, url, sourceTabId, tab.windowId);
}

async function resolveTwitchSpawnCandidate(tabId, url, tab) {
    const pending = twitchSpawnCandidates.get(tabId);
    if (!pending) return false;

    if (pending.expiresAt < Date.now()) {
        twitchSpawnCandidates.delete(tabId);
        return false;
    }

    if (!url || url === "about:blank") return false;

    twitchSpawnCandidates.delete(tabId);
    if (!isTwitchUrl(url)) return false;

    return redirectSpawnedTwitchTarget(
        tabId,
        url,
        pending.sourceTabId,
        tab?.windowId ?? pending.sourceWindowId
    );
}

async function handleTwitchCreatedNavigationTarget(details) {
    if (!details || !Number.isInteger(details.tabId) || !Number.isInteger(details.sourceTabId)) return;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(details.sourceTabId);
    } catch {
        return;
    }

    const managedWindowId = await getTwitchWindowId();
    if (sourceTab.windowId !== managedWindowId) return;

    let targetTab = null;
    try {
        targetTab = await chrome.tabs.get(details.tabId);
    } catch {}

    const targetUrl = String(details.url || targetTab?.pendingUrl || targetTab?.url || "");
    if (isTwitchUrl(targetUrl)) {
        await redirectSpawnedTwitchTarget(
            details.tabId,
            targetUrl,
            details.sourceTabId,
            targetTab?.windowId
        );
        return;
    }

    if (!targetUrl || targetUrl === "about:blank" || targetUrl.startsWith("chrome://newtab")) {
        twitchSpawnCandidates.set(details.tabId, {
            sourceTabId: details.sourceTabId,
            sourceWindowId: targetTab?.windowId,
            expiresAt: Date.now() + 7000
        });
    }
}

async function adoptRecentTwitchWindow(windowId) {
    if (!Number.isInteger(windowId) || Date.now() > twitchRecentUserInteractionUntil) return false;

    const managedWindowId = await getTwitchWindowId();
    if (!Number.isInteger(managedWindowId) || windowId === managedWindowId) return false;

    for (const delay of [80, 220, 500, 900, 1500]) {
        await new Promise(resolve => setTimeout(resolve, delay));

        let tabs = [];
        try {
            tabs = await chrome.tabs.query({ windowId });
        } catch {
            return false;
        }

        const twitchTab = tabs.find(tab => isTwitchUrl(tab.url || tab.pendingUrl));
        if (!twitchTab) continue;

        const mainTabs = await getTwitchWindowTabs(managedWindowId);
        const sourceTab = mainTabs.find(tab => tab.active) || mainTabs[0];
        if (!sourceTab?.id) return false;

        return redirectSpawnedTwitchTarget(
            twitchTab.id,
            twitchTab.url || twitchTab.pendingUrl,
            sourceTab.id,
            windowId
        );
    }

    return false;
}

function twitchChannelKey(url) {
    if (!isTwitchUrl(url)) return null;

    try {
        const parsed = new URL(url);
        const first = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
        const reserved = new Set([
            "directory", "downloads", "drops", "friends", "inventory", "jobs",
            "login", "messages", "p", "payments", "search", "settings", "signup",
            "subscriptions", "turbo", "videos", "wallet"
        ]);
        return first && !reserved.has(first) ? first : null;
    } catch {
        return null;
    }
}

async function getTwitchWindowId() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_WINDOW_STORAGE_KEY);
        const windowId = stored[TWITCH_WINDOW_STORAGE_KEY];
        if (!Number.isInteger(windowId)) return null;

        const win = await chrome.windows.get(windowId, { populate: true });
        const hasTwitchTab = (win.tabs || []).some(
            tab => isTwitchUrl(tab.url || tab.pendingUrl)
        );

        if (!hasTwitchTab) {
            await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY);
            return null;
        }

        return windowId;
    } catch {
        await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY).catch(() => {});
        return null;
    }
}

async function cleanupLegacyTwitchDropsWorker() {
    /* 0.16.0-0.16.2 used a second Inventory popup. Opera may surface that
     * popup as a full normal browser window, so retire it aggressively on
     * upgrade and clear the old maintenance alarm/storage state. */
    try {
        const stored = await chrome.storage.local.get(TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY);
        const windowId = stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY];
        await chrome.storage.local.remove(TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY).catch(() => {});
        if (Number.isInteger(windowId)) {
            await chrome.windows.remove(windowId).catch(() => {});
        }
    } catch {}

    await chrome.alarms.clear(TWITCH_DROPS_MAINTENANCE_ALARM).catch(() => {});
}

async function isStreamShellTwitchAutomationWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;

    if ((await getTwitchWindowId()) === windowId) {
        return true;
    }

    if (await isTwitchWorkspaceV2ContentWindowId(windowId)) {
        return true;
    }

    return isTwitchSplitLabWindowId(windowId);
}

async function getTwitchLastContentUrl() {
    try {
        const stored = await chrome.storage.local.get("streamShellTwitchLastContentUrl");
        const url = String(stored.streamShellTwitchLastContentUrl || "");
        return isTwitchUrl(url) && !isTwitchDropsUrl(url) ? url : null;
    } catch {
        return null;
    }
}

async function rememberTwitchContentUrl(url) {
    if (!isTwitchUrl(url) || isTwitchDropsUrl(url)) return;
    await chrome.storage.local.set({ streamShellTwitchLastContentUrl: url }).catch(() => {});
}

async function getTwitchSetting(key, fallback) {
    try {
        const stored = await chrome.storage.local.get(key);
        return Object.prototype.hasOwnProperty.call(stored, key)
            ? stored[key]
            : fallback;
    } catch {
        return fallback;
    }
}


function getTwitchSplitLabRects() {
    const widthA = Math.floor(RIGHT.width / 2);
    const widthB = RIGHT.width - widthA;

    return {
        a: {
            left: RIGHT.left,
            top: RIGHT.top,
            width: widthA,
            height: RIGHT.height
        },
        b: {
            left: RIGHT.left + widthA,
            top: RIGHT.top,
            width: widthB,
            height: RIGHT.height
        }
    };
}

async function getTwitchSplitLabRecord() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_SPLIT_LAB_STORAGE_KEY);
        const record = stored[TWITCH_SPLIT_LAB_STORAGE_KEY];
        return record && typeof record === "object" ? record : null;
    } catch {
        return null;
    }
}

async function isTwitchSplitLabWindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;

    const record = await getTwitchSplitLabRecord();
    return Array.isArray(record?.windowIds) && record.windowIds.includes(windowId);
}

async function getTwitchSplitLabWindowSnapshot(record = null) {
    const activeRecord = record || await getTwitchSplitLabRecord();
    const ids = Array.isArray(activeRecord?.windowIds)
        ? activeRecord.windowIds.filter(Number.isInteger)
        : [];
    const windows = [];

    for (const id of ids) {
        try {
            windows.push(await chrome.windows.get(id, { populate: true }));
        } catch {
            windows.push(null);
        }
    }

    return windows;
}

async function focusExistingTwitchSplitLab(record, preferredMember = null) {
    const windows = await getTwitchSplitLabWindowSnapshot(record);
    if (windows.length !== 2 || windows.some(window => !Number.isInteger(window?.id))) {
        return false;
    }

    /*
     * Do not resize or navigate the proven Twitch surfaces on resume. The two
     * popups keep their original compositor surfaces while Dashboard/Discord
     * merely cover them. Raise both halves, then focus the requested member.
     * This gives the Landing Twitch/Drops buttons useful focus semantics
     * without replacing either document.
     */
    const preferredIndex = preferredMember === "a"
        ? 0
        : preferredMember === "b"
            ? 1
            : 1;
    const order = preferredIndex === 0 ? [1, 0] : [0, 1];

    for (const index of order) {
        const window = windows[index];
        if (window.state === "minimized") {
            await chrome.windows.update(window.id, { state: "normal" });
        }
        await chrome.windows.update(window.id, { focused: true });
    }

    return true;
}

async function getTwitchSplitMemberTab(record, member) {
    const index = member === "b" ? 1 : 0;
    const windowId = Array.isArray(record?.windowIds) ? record.windowIds[index] : null;
    if (!Number.isInteger(windowId)) return null;

    try {
        const tabs = await chrome.tabs.query({ windowId });
        return tabs.find(tab => tab.active) || tabs[0] || null;
    } catch {
        return null;
    }
}

async function ensureTwitchSplitTarget(record, target) {
    if (!record || record.mode !== "mixed") return false;

    if (target === "drops") {
        const tab = await getTwitchSplitMemberTab(record, "b");
        const currentUrl = String(tab?.url || tab?.pendingUrl || "");
        if (!Number.isInteger(tab?.id)) return false;
        if (!isTwitchDropsUrl(currentUrl)) {
            await chrome.tabs.update(tab.id, { url: TWITCH_DROPS_URL });
        }
        return true;
    }

    const tab = await getTwitchSplitMemberTab(record, "a");
    const currentUrl = String(tab?.url || tab?.pendingUrl || "");
    if (!Number.isInteger(tab?.id)) return false;

    if (!isTwitchUrl(currentUrl) || isTwitchDropsUrl(currentUrl)) {
        const fallback = (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
        await chrome.tabs.update(tab.id, { url: fallback });
    }
    return true;
}

async function markTwitchSplitReuse(record, preferredMember, reason) {
    const next = {
        ...record,
        reuseCount: Number(record?.reuseCount || 0) + 1,
        lastActivatedAt: Date.now(),
        lastFocusedMember: preferredMember === "a" ? "a" : "b",
        lastActivationReason: String(reason || "resume")
    };
    await chrome.storage.local.set({ [TWITCH_SPLIT_LAB_STORAGE_KEY]: next });
    return next;
}

async function claimTwitchSplitLabNativeWindow(windowId, member, rect) {
    if (shuttingDown || !Number.isInteger(windowId) || !rect) return false;

    if (!titlebarPort) {
        await ensureTitlebarNative();
    }
    if (!titlebarPort || !titlebarProtocolReady) return false;

    try {
        const win = await chrome.windows.get(windowId, { populate: true });
        if (!Number.isInteger(win?.id) || win.state === "minimized") return false;

        const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
        const titleHint = typeof tab?.title === "string"
            ? tab.title.trim().slice(0, 180)
            : "";
        if (!titleHint) return false;

        titlebarPort.postMessage({
            type: "claim",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            layoutProfile: "wide",
            side: "right",
            mode: "twitch",
            member,
            titleHint,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        return true;
    } catch {
        return false;
    }
}

function scheduleTwitchSplitLabNativeClaims(record) {
    const ids = Array.isArray(record?.windowIds) ? record.windowIds : [];
    const rects = record?.layout || {};
    const members = [
        { id: ids[0], member: "a", rect: rects.a },
        { id: ids[1], member: "b", rect: rects.b }
    ];
    const delays = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6500];

    for (const delay of delays) {
        setTimeout(() => {
            if (shuttingDown) return;
            for (const entry of members) {
                claimTwitchSplitLabNativeWindow(entry.id, entry.member, entry.rect).catch(() => {});
            }
        }, delay);
    }
}

async function closeTwitchSplitLab() {
    const record = await getTwitchSplitLabRecord();
    const windowIds = Array.isArray(record?.windowIds)
        ? record.windowIds.filter(Number.isInteger)
        : [];

    /*
     * Clear ownership before removing windows so the generic onRemoved path
     * cannot mistake deliberate lab teardown for a user-closing transition.
     */
    await chrome.storage.local.remove(TWITCH_SPLIT_LAB_STORAGE_KEY).catch(() => {});

    for (const windowId of windowIds) {
        await safelyRemoveWindow(windowId);
    }
}

async function createDirectTwitchSplitPopup(url, rect, focused) {
    const win = await chrome.windows.create({
        type: "popup",
        url,
        state: "normal",
        focused,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    });

    if (!Number.isInteger(win?.id)) {
        throw new Error("Opera did not return a Twitch split-lab window id.");
    }

    return win;
}

async function closeManagedTwitchWindowForSplitLab() {
    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    const tabs = await getTwitchWindowTabs(windowId);
    const activeTab = tabs.find(tab => tab.active) || tabs[0] || null;
    const currentUrl = String(activeTab?.url || activeTab?.pendingUrl || "");

    if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
        await rememberTwitchContentUrl(currentUrl);
    }

    /*
     * Remove logical ownership before the physical popup. The ordinary
     * Twitch-window onRemoved handler would otherwise restore Dashboard while
     * the two replacement lab windows are being created.
     */
    await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY).catch(() => {});
    await safelyRemoveWindow(windowId);
}

async function getTwitchSplitLabDiagnostics() {
    const record = await getTwitchSplitLabRecord();
    if (!record) {
        return {
            active: false,
            windowCount: 0,
            windows: []
        };
    }

    const ids = Array.isArray(record.windowIds)
        ? record.windowIds.filter(Number.isInteger)
        : [];
    const windows = [];

    for (const id of ids) {
        try {
            const win = await chrome.windows.get(id, { populate: true });
            const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
            const automationManaged = await isTwitchSplitLabWindowId(id);
            let automationMarker = false;
            let documentIdentity = null;

            if (Number.isInteger(tab?.id)) {
                const markerResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement?.dataset?.streamShellTwitch === "true"
                }).catch(() => []);
                automationMarker = markerResults.some(result => result?.result === true);

                const identityResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => ({
                        href: location.href,
                        timeOrigin: Number.isFinite(performance.timeOrigin)
                            ? Math.round(performance.timeOrigin)
                            : null,
                        navigationType: performance.getEntriesByType("navigation")?.[0]?.type || null
                    })
                }).catch(() => []);
                documentIdentity = identityResults.find(result => result?.result)?.result || null;
            }

            windows.push({
                id: win.id,
                state: win.state,
                focused: win.focused === true,
                left: win.left,
                top: win.top,
                width: win.width,
                height: win.height,
                automationManaged,
                automationMarker,
                documentIdentity,
                tab: tab
                    ? {
                        id: tab.id,
                        status: tab.status,
                        url: tab.url || tab.pendingUrl || null,
                        title: tab.title || null,
                        audible: tab.audible === true,
                        muted: tab.mutedInfo?.muted === true,
                        discarded: tab.discarded === true
                    }
                    : null
            });
        } catch {
            windows.push({
                id,
                missing: true
            });
        }
    }

    const surfaceState = await chrome.storage.local.get("rightMode").catch(() => ({}));

    return {
        active: true,
        visible: surfaceState.rightMode === "twitch",
        covered: surfaceState.rightMode !== "twitch",
        createdAt: record.createdAt || null,
        urls: record.urls || null,
        layout: record.layout || null,
        mode: record.mode || "mixed",
        lifecycle: record.lifecycle || null,
        nativeTitlebarClaimed: record.nativeTitlebarClaimed || null,
        nativeClusterMembers: Number.isInteger(titlebarLastNativeStatus?.twitchClusterMembers)
            ? titlebarLastNativeStatus.twitchClusterMembers
            : null,
        nativeClusterMap: titlebarLastNativeStatus?.twitchClusterMap || null,
        reuseCount: Number(record.reuseCount || 0),
        lastActivatedAt: record.lastActivatedAt || record.createdAt || null,
        lastFocusedMember: record.lastFocusedMember || null,
        lastActivationReason: record.lastActivationReason || null,
        windowCount: windows.filter(window => window?.missing !== true).length,
        windows
    };
}

async function showTwitchSplitLab(mode = "mixed", preferredMember = null) {
    if (shuttingDown) return;

    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch split lab is available from the Wide Landing layout.");
    }

    const dashboardId = await ensureDashboardWindow();
    await hideDiscordForDashboard();
    await restoreWindow(dashboardId, RIGHT, false);
    await closeManagedTwitchWindowForSplitLab();

    const referenceMode = mode === "reference";
    const requestedMode = referenceMode ? "reference" : "mixed";
    const existing = await getTwitchSplitLabRecord();

    if (existing?.mode === requestedMode) {
        const member = preferredMember === "a" || preferredMember === "b"
            ? preferredMember
            : (existing.lastFocusedMember === "a" ? "a" : "b");

        await chrome.storage.local.set({
            rightMode: "twitch",
            twitchTarget: member === "b" ? "drops" : "resume"
        });

        if (await focusExistingTwitchSplitLab(existing, member)) {
            const reused = await markTwitchSplitReuse(existing, member, "split-button");
            scheduleTwitchSplitLabNativeClaims(reused);
            await recordFlightEvent({
                source: "background",
                category: "twitch-split-lab",
                action: "resumed",
                provider: "twitch",
                detail: {
                    windowIds: reused.windowIds,
                    mode: reused.mode,
                    preferredMember: member,
                    reuseCount: reused.reuseCount,
                    lifecycle: "persistent-cover-resume"
                }
            }).catch(() => {});
            await broadcastState();
            return getTwitchSplitLabDiagnostics();
        }
    }

    /* A deliberate mode change or a partially missing pair gets one clean
     * rebuild. Ordinary Dashboard/Discord switches no longer come through here
     * as teardown, so Drops/stream documents survive those transitions. */
    await closeTwitchSplitLab();

    const rects = getTwitchSplitLabRects();
    const urlA = referenceMode
        ? "https://www.twitch.tv/gronkhtv"
        : (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
    const urlB = referenceMode
        ? "https://www.twitch.tv/rainbow6"
        : TWITCH_DROPS_URL;

    let winA = null;
    let winB = null;

    try {
        winA = await createDirectTwitchSplitPopup(urlA, rects.a, false);
        winB = await createDirectTwitchSplitPopup(urlB, rects.b, true);
    } catch (error) {
        if (Number.isInteger(winA?.id)) await safelyRemoveWindow(winA.id);
        if (Number.isInteger(winB?.id)) await safelyRemoveWindow(winB.id);
        throw error;
    }

    const record = {
        createdAt: Date.now(),
        urls: { a: urlA, b: urlB },
        windowIds: [winA.id, winB.id],
        layout: {
            rightPane: { ...RIGHT },
            a: rects.a,
            b: rects.b
        },
        nativeTitlebarClaimed: "requested",
        lifecycle: "direct-final-geometry+persistent-cover",
        management: "twitch-content-automation+native-cluster",
        mode: requestedMode,
        reuseCount: 0,
        lastActivatedAt: Date.now(),
        lastFocusedMember: preferredMember === "a" ? "a" : "b",
        lastActivationReason: "created"
    };

    await chrome.storage.local.set({
        [TWITCH_SPLIT_LAB_STORAGE_KEY]: record,
        rightMode: "twitch",
        twitchTarget: record.lastFocusedMember === "b" ? "drops" : "resume"
    });

    scheduleTwitchSplitLabNativeClaims(record);

    await recordFlightEvent({
        source: "background",
        category: "twitch-split-lab",
        action: "created",
        provider: "twitch",
        detail: {
            windowIds: record.windowIds,
            urls: record.urls,
            layout: record.layout,
            nativeTitlebarClaimed: "requested",
            mode: record.mode
        }
    }).catch(() => {});

    await broadcastState();
    return getTwitchSplitLabDiagnostics();
}


async function reconcileClosedTwitchSplitLabWindow(windowId) {
    if (!Number.isInteger(windowId)) return;

    const record = await getTwitchSplitLabRecord();
    if (!Array.isArray(record?.windowIds) || !record.windowIds.includes(windowId)) {
        return;
    }

    const remaining = record.windowIds.filter(id => id !== windowId && Number.isInteger(id));

    await recordFlightEvent({
        source: "background",
        category: "twitch-split-lab",
        action: "window-closed",
        provider: "twitch",
        detail: {
            windowId,
            remainingWindowIds: remaining
        }
    }).catch(() => {});

    if (remaining.length) {
        await chrome.storage.local.set({
            [TWITCH_SPLIT_LAB_STORAGE_KEY]: {
                ...record,
                windowIds: remaining
            }
        });
        return;
    }

    await chrome.storage.local.remove(TWITCH_SPLIT_LAB_STORAGE_KEY).catch(() => {});

    const state = await chrome.storage.local.get(["rightMode", TWITCH_WINDOW_STORAGE_KEY]);
    if (
        state.rightMode === "twitch" &&
        !Number.isInteger(state[TWITCH_WINDOW_STORAGE_KEY])
    ) {
        await showDashboard().catch(async () => {
            await chrome.storage.local.set({ rightMode: "dashboard" });
            await broadcastState();
        });
    }
}


async function ensureTwitchWindow() {
    if (shuttingDown) {
        throw new Error("Twitch creation cancelled.");
    }

    if (twitchCreationLock) {
        return twitchCreationLock;
    }

    twitchCreationLock = _ensureTwitchWindow().finally(() => {
        twitchCreationLock = null;
    });

    return twitchCreationLock;
}

async function _ensureTwitchWindow() {
    let windowId = await getTwitchWindowId();

    if (Number.isInteger(windowId)) {
        try {
            await chrome.windows.get(windowId);
            /* Migrate any legacy multi-tab Twitch popup left behind by 0.16.0/
             * 0.16.1 back to the single-visible-tab invariant immediately. */
            await consolidateVisibleTwitchWindow(windowId).catch(() => {});
            return windowId;
        } catch {
            await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY);
        }
    }

    const win = await chrome.windows.create({
        type: "popup",
        state: "normal",
        focused: false,
        left: RIGHT.left,
        top: RIGHT.top,
        width: RIGHT.width,
        height: RIGHT.height,
        url: TWITCH_HOME_URL
    });

    if (!Number.isInteger(win?.id)) {
        throw new Error("Twitch utility window could not be created.");
    }

    windowId = win.id;
    await chrome.storage.local.set({
        [TWITCH_WINDOW_STORAGE_KEY]: windowId
    });

    return windowId;
}

async function getTwitchWindowTabs(windowId) {
    try {
        return await chrome.tabs.query({ windowId });
    } catch {
        return [];
    }
}

async function consolidateVisibleTwitchWindow(windowId) {
    const tabs = await getTwitchWindowTabs(windowId);
    if (!tabs.length) return null;

    const keep =
        tabs.find(tab => tab.active && isTwitchUrl(tab.url || tab.pendingUrl)) ||
        tabs.find(tab => isTwitchUrl(tab.url || tab.pendingUrl)) ||
        tabs[0];

    const extraIds = tabs
        .filter(tab => tab.id !== keep.id)
        .map(tab => tab.id)
        .filter(Number.isInteger);

    if (extraIds.length) {
        await chrome.tabs.remove(extraIds).catch(() => {});
    }

    return keep;
}

async function activateTwitchTargetInMainWindow(windowId, target = "resume") {
    let tab = await consolidateVisibleTwitchWindow(windowId);
    if (!tab?.id) return null;

    const currentUrl = String(tab.url || tab.pendingUrl || "");

    if (target === "drops") {
        if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
            await rememberTwitchContentUrl(currentUrl);
        }

        if (!isTwitchDropsUrl(currentUrl)) {
            tab = await chrome.tabs.update(tab.id, { url: TWITCH_DROPS_URL, active: true });
        } else if (!tab.active) {
            tab = await chrome.tabs.update(tab.id, { active: true });
        }
        return tab;
    }

    /* Main Twitch actions are resume/show semantics, not navigation. If the
     * utility is already on a channel, keep that channel exactly where it is.
     * Returning from the Inventory restores the last non-Inventory Twitch URL. */
    if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
        await rememberTwitchContentUrl(currentUrl);
        if (!tab.active) tab = await chrome.tabs.update(tab.id, { active: true });
        return tab;
    }

    const resumeUrl = await getTwitchLastContentUrl();
    const destination = resumeUrl || TWITCH_HOME_URL;
    if (currentUrl !== destination) {
        tab = await chrome.tabs.update(tab.id, { url: destination, active: true });
    } else if (!tab.active) {
        tab = await chrome.tabs.update(tab.id, { active: true });
    }

    return tab;
}

async function deactivateTwitchForRightSurface(options = {}) {
    await deactivateTwitchWorkspaceV2(options).catch(() => {});

    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);

    const splitRecord = await getTwitchSplitLabRecord();
    const splitIds = Array.isArray(splitRecord?.windowIds)
        ? splitRecord.windowIds.filter(Number.isInteger)
        : [];

    if (splitIds.length) {
        if (forceMinimize || !keepActive) {
            for (const windowId of splitIds) {
                await safelyMinimizeWindow(windowId);
            }
        }
        /* Wide keep-active mirrors the established single Twitch behavior: do
         * not destroy, park, navigate or resize the Twitch surfaces. Dashboard
         * or Discord simply covers the two warm half-windows. */
    }

    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    if (forceMinimize || !keepActive) {
        await safelyMinimizeWindow(windowId);
    }
}

async function syncManagedTwitchTargetFromUrl(windowId, url) {
    if (!Number.isInteger(windowId) || !isTwitchUrl(url)) return;

    const managedWindowId = await getTwitchWindowId();
    if (managedWindowId !== windowId) return;

    const nextTarget = isTwitchDropsUrl(url) ? "drops" : "resume";
    const state = await chrome.storage.local.get(["rightMode", "twitchTarget"]);

    if (state.rightMode !== "twitch" || state.twitchTarget === nextTarget) return;

    await chrome.storage.local.set({ twitchTarget: nextTarget });
    await broadcastState();
}

async function showTwitch(target = "resume") {
    if (shuttingDown) return;

    const twitchTarget = target === "drops" ? "drops" : "resume";
    await showTwitchWorkspaceV2(twitchTarget);
}

async function isManagedTwitchWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;

    if ((await getTwitchWindowId()) === windowId) {
        return true;
    }

    if (await isTwitchWorkspaceV2ContentWindowId(windowId)) {
        return true;
    }

    return isTwitchSplitLabWindowId(windowId);
}

function normalizeTwitchRaidGuardMap(value) {
    if (!value || typeof value !== "object") return {};

    /* Migrate the short-lived legacy single-guard shape in place. */
    if (Number.isInteger(value.tabId)) {
        return { [String(value.tabId)]: value };
    }

    const guards = {};
    for (const [key, guard] of Object.entries(value)) {
        if (!guard || typeof guard !== "object" || !Number.isInteger(guard.tabId)) continue;
        guards[String(guard.tabId)] = guard;
    }
    return guards;
}

async function getTwitchRaidGuardMap() {
    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    return normalizeTwitchRaidGuardMap(stored[TWITCH_RAID_GUARD_SESSION_KEY]);
}

async function setTwitchRaidGuardMap(guards) {
    const entries = Object.entries(guards || {});
    if (!entries.length) {
        await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
        return;
    }
    await chrome.storage.session.set({ [TWITCH_RAID_GUARD_SESSION_KEY]: Object.fromEntries(entries) });
}

async function armTwitchRaidGuard(tab, sourceUrl) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const sourceChannel = twitchChannelKey(sourceUrl);
    if (!sourceChannel) return false;

    const normalizedSource = `https://www.twitch.tv/${sourceChannel}`;
    const guards = await getTwitchRaidGuardMap();
    guards[String(tab.id)] = {
        tabId: tab.id,
        windowId: tab.windowId,
        sourceUrl: normalizedSource,
        sourceChannel,
        expiresAt: Date.now() + 45000
    };
    await setTwitchRaidGuardMap(guards);
    return true;
}

async function disarmTwitchRaidGuard(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const guards = await getTwitchRaidGuardMap();
    const key = String(tab.id);
    if (!guards[key]) return false;
    delete guards[key];
    await setTwitchRaidGuardMap(guards);
    return true;
}

async function enforceTwitchRaidGuard(tabId, url) {
    if (!isTwitchUrl(url)) return;

    const guards = await getTwitchRaidGuardMap();
    const key = String(tabId);
    const guard = guards[key];
    if (!guard) return;

    if (!Number.isFinite(guard.expiresAt) || guard.expiresAt < Date.now()) {
        delete guards[key];
        await setTwitchRaidGuardMap(guards);
        return;
    }

    const nextChannel = twitchChannelKey(url);
    if (!nextChannel || nextChannel === guard.sourceChannel) return;

    delete guards[key];
    await setTwitchRaidGuardMap(guards);
    await chrome.tabs.update(tabId, { url: guard.sourceUrl }).catch(() => {});
}


chrome.tabs.onCreated.addListener(tab => {
    adoptTwitchSpawnedTab(tab).catch(() => {});
});

chrome.windows.onCreated.addListener(window => {
    adoptRecentTwitchWindow(window?.id).catch(() => {});
});

if (chrome.webNavigation?.onCreatedNavigationTarget) {
    chrome.webNavigation.onCreatedNavigationTarget.addListener(details => {
        handleTwitchCreatedNavigationTarget(details).catch(() => {});
    });
}

chrome.tabs.onRemoved.addListener(tabId => {
    twitchSpawnCandidates.delete(tabId);
});

chrome.windows.onRemoved.addListener(windowId => {
    reconcileClosedTwitchSplitLabWindow(windowId).catch(() => {});
    reconcileClosedTwitchWorkspaceV2Window(windowId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const urlChanged = typeof changeInfo.url === "string";
    const loadCompleted = changeInfo.status === "complete";
    const muteChanged = Object.prototype.hasOwnProperty.call(changeInfo, "mutedInfo");
    const url = changeInfo.url || tab?.url || tab?.pendingUrl;

    /* Most tab updates are title/favicon/audible noise. Do the expensive
     * workspace/storage lookups only for actual navigation, completed loads or
     * mute-policy changes. */
    if (urlChanged && url) {
        enforceTwitchRaidGuard(tabId, url).catch(() => {});
        resolveTwitchSpawnCandidate(tabId, url, tab).catch(() => {});
    }

    if (tab?.windowId && urlChanged) {
        getTwitchWindowId()
            .then(windowId => {
                if (windowId === tab.windowId && isTwitchUrl(url) && !isTwitchDropsUrl(url)) {
                    return rememberTwitchContentUrl(url);
                }
            })
            .catch(() => {});
        syncManagedTwitchTargetFromUrl(tab.windowId, url).catch(() => {});
        syncTwitchWorkspaceV2Location(tab).catch(() => {});
    }

    if (tab?.windowId && (urlChanged || loadCompleted || muteChanged)) {
        syncTwitchAutoMuteForTab(tab).catch(() => {});
    }
});

if (chrome.webNavigation?.onHistoryStateUpdated) {
    chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
        if (details.frameId !== 0 || !isTwitchUrl(details.url)) return;
        chrome.tabs.get(details.tabId)
            .then(tab => {
                if (!tab?.windowId) return;
                return Promise.allSettled([
                    syncManagedTwitchTargetFromUrl(tab.windowId, details.url),
                    syncTwitchWorkspaceV2Location({ ...tab, url: details.url })
                ]);
            })
            .catch(() => {});
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchAutoMute")) {
        reconcileTwitchAudioPolicy().catch(() => {});
    }

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchKeepActive") && changes.streamShellTwitchKeepActive.newValue === false) {
        chrome.storage.local.get("rightMode")
            .then(state => {
                if (state.rightMode !== "twitch") {
                    return deactivateTwitchForRightSurface({ forceMinimize: true });
                }
            })
            .catch(() => {});
    }

});

/* Remove the obsolete 0.16.0-0.16.2 Inventory worker immediately after
 * an extension upgrade/reload. No Twitch browser window exists solely for
 * auto-claim anymore. */
cleanupLegacyTwitchDropsWorker().catch(() => {});

/* Reconcile an already-open managed Twitch window after extension reload. */
reconcileTwitchAudioPolicy().catch(() => {});
/*
 * ============================================================
 * TWITCH WORKSPACE V2 — DIRECT 4-SLOT WINDOW COMPOSITOR
 * ============================================================
 *
 * The 0.18.34-0.18.37 experiments proved that Opera GX reliably renders
 * multiple Twitch documents when every popup is born directly at its final
 * geometry and is never parked/resized as part of normal surface switching.
 *
 * V2 makes that lifecycle the product architecture:
 *   - four fixed content slots (A-D), each backed by at most one real Twitch
 *     popup window;
 *   - empty slots own no browser window at all;
 *   - Dashboard/Discord only cover live Twitch windows;
 *   - normal Twitch pages stay real top-level Twitch pages;
 *   - stream slots get content-side cleanup instead of iframe embedding;
 *   - audio mute is owned per slot and persists across Twitch navigation.
 *
 * Normal surface switching never resizes content windows. Reassigning a slot
 * navigates the existing tab by explicit user action; pane fullscreen is the
 * only deliberate geometry transition and restores the exact 2x2 slot bounds.
 */

const TWITCH_WORKSPACE_V2_VERSION = 7;
const TWITCH_WORKSPACE_V2_LIFECYCLE = "direct-final-geometry-4slot+persistent-controllers+caption-overlap-20+chatless-audio+event-claims+surface-wake+pane-fullscreen";
const TWITCH_WORKSPACE_V2_SLOT_IDS = ["a", "b", "c", "d"];
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX = "streamShellTwitchWorkspaceStreamRefresh:";
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES = 60;
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_STAGGER_MINUTES = 3;
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_DEFER_MINUTES = 10;
const TWITCH_WORKSPACE_V2_CAPTION_OVERLAP = 20;
const TWITCH_WORKSPACE_V2_PANE_CAPTION_FALLBACK = 34;
const twitchWorkspaceV2NativeCaptionHeights = new Map();

function rememberTwitchWorkspaceV2NativeCaption(message) {
    const member = String(message?.member || "").trim().toLowerCase();
    const height = Number(message?.titlebarHeight);
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(member) || !Number.isFinite(height)) return false;
    if (height < 8 || height > 96) return false;
    twitchWorkspaceV2NativeCaptionHeights.set(member, Math.round(height));
    return true;
}

function getTwitchWorkspaceV2PaneCaptionOverscan(slotId) {
    const measured = Number(twitchWorkspaceV2NativeCaptionHeights.get(slotId));
    if (Number.isFinite(measured) && measured >= 8 && measured <= 96) return Math.round(measured);
    return TWITCH_WORKSPACE_V2_PANE_CAPTION_FALLBACK;
}

function twitchWorkspaceV2EmptySlot(id) {
    return {
        id,
        kind: "empty",
        kindSource: "auto",
        url: null,
        label: `Slot ${id.toUpperCase()}`,
        audioMuted: true,
        raidProtectionEnabled: false,
        windowId: null,
        tabId: null,
        createdAt: null,
        updatedAt: Date.now()
    };
}

function getTwitchWorkspaceV2Rects() {
    const leftWidth = Math.floor(RIGHT.width / 2);
    const rightWidth = RIGHT.width - leftWidth;
    const topHeight = Math.floor(RIGHT.height / 2);
    const bottomHeight = RIGHT.height - topHeight;
    const overlap = Math.min(TWITCH_WORKSPACE_V2_CAPTION_OVERLAP, Math.max(0, topHeight - 1));
    const upperHeight = topHeight + overlap;
    const lowerTop = RIGHT.top + topHeight - overlap;
    const lowerHeight = bottomHeight + overlap;

    return {
        a: { left: RIGHT.left, top: RIGHT.top, width: leftWidth, height: upperHeight },
        b: { left: RIGHT.left + leftWidth, top: RIGHT.top, width: rightWidth, height: upperHeight },
        c: { left: RIGHT.left, top: lowerTop, width: leftWidth, height: lowerHeight },
        d: { left: RIGHT.left + leftWidth, top: lowerTop, width: rightWidth, height: lowerHeight }
    };
}

function twitchWorkspaceV2ControllerUrl(slotId) {
    const id = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) ? slotId : "a";
    return `${TWITCH_WORKSPACE_SLOT_URL}?slot=${encodeURIComponent(id)}`;
}

function twitchWorkspaceV2StreamRefreshAlarmName(slotId) {
    return `${TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX}${slotId}`;
}

async function scheduleTwitchWorkspaceV2StreamRefresh(slotId, delayMinutes = null) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const index = TWITCH_WORKSPACE_V2_SLOT_IDS.indexOf(slotId);
    const firstDelay = Number.isFinite(delayMinutes)
        ? Math.max(1, Number(delayMinutes))
        : TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES +
            index * TWITCH_WORKSPACE_V2_STREAM_REFRESH_STAGGER_MINUTES;
    chrome.alarms.create(twitchWorkspaceV2StreamRefreshAlarmName(slotId), {
        delayInMinutes: firstDelay,
        periodInMinutes: TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES
    });
    return true;
}

async function syncTwitchWorkspaceV2StreamRefreshAlarms(record = null) {
    const current = record || await getTwitchWorkspaceV2Record();
    for (const slotId of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const name = twitchWorkspaceV2StreamRefreshAlarmName(slotId);
        const slot = current?.slots?.[slotId];
        const shouldRefresh = slot?.kind === "stream" && isTwitchUrl(slot?.url);
        const existing = await chrome.alarms.get(name).catch(() => null);
        if (shouldRefresh) {
            if (!existing) await scheduleTwitchWorkspaceV2StreamRefresh(slotId);
        } else if (existing) {
            await chrome.alarms.clear(name).catch(() => {});
        }
    }
}

async function handleTwitchWorkspaceV2StreamRefreshAlarm(alarm) {
    const name = String(alarm?.name || "");
    if (!name.startsWith(TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX)) return;

    const slotId = name.slice(TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX.length);
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) || shuttingDown) return;

    const record = await getTwitchWorkspaceV2Record();
    const slot = record?.slots?.[slotId];
    if (!slot || slot.kind !== "stream" || !isTwitchUrl(slot.url)) {
        await chrome.alarms.clear(name).catch(() => {});
        return;
    }

    const win = await getTwitchWorkspaceV2Window(slot.windowId);
    const tab = win?.tabs?.find(candidate => candidate.active) || win?.tabs?.[0] || null;
    if (!Number.isInteger(tab?.id)) return;

    /* Maintenance must not yank an actively used Twitch pane out from under the
     * user. If this slot is focused/fullscreen, retry in ten minutes. Covered
     * background streams can refresh immediately. */
    const surface = await chrome.storage.local.get("rightMode").catch(() => ({}));
    if (record.paneFullscreenSlot === slotId || (surface.rightMode === "twitch" && win.focused === true)) {
        await scheduleTwitchWorkspaceV2StreamRefresh(
            slotId,
            TWITCH_WORKSPACE_V2_STREAM_REFRESH_DEFER_MINUTES
        );
        return;
    }

    await chrome.tabs.reload(tab.id).catch(() => {});
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});

    await recordFlightEvent({
        source: "background",
        category: "twitch-workspace-v2",
        action: "maintenance-reload",
        provider: "twitch",
        detail: { slotId, intervalMinutes: TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES }
    }).catch(() => {});
}

function isTwitchWorkspaceV2ControllerUrl(url) {
    try {
        const parsed = new URL(String(url || ""));
        const base = new URL(TWITCH_WORKSPACE_SLOT_URL);
        return parsed.origin === base.origin && parsed.pathname === base.pathname;
    } catch {
        return false;
    }
}

function twitchWorkspaceV2ChannelFromUrl(url) {
    const key = twitchChannelKey(url);
    return key || null;
}

function inferTwitchWorkspaceV2Kind(url) {
    if (!isTwitchUrl(url)) return "page";
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter(Boolean);
        /* Auto-cleanup is intentionally conservative: only a bare channel root
         * is a stream surface. /channel/videos, /about, Drops, directories and
         * every other Twitch route stay ordinary pages unless the user
         * explicitly marks the slot as Stream. */
        return segments.length === 1 && twitchWorkspaceV2ChannelFromUrl(url)
            ? "stream"
            : "page";
    } catch {
        return "page";
    }
}

function normalizeTwitchWorkspaceV2Input(input, preferredKind = null) {
    const raw = String(input || "").trim();
    if (!raw) return null;

    let url = raw;
    if (!/^https?:\/\//i.test(raw)) {
        const compact = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
        if (!compact || /\s/.test(compact)) return null;
        url = `https://www.twitch.tv/${compact}`;
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !/(^|\.)twitch\.tv$/i.test(parsed.hostname)) {
            return null;
        }
        parsed.hash = "";
        const normalized = parsed.toString();
        const explicitKind = preferredKind === "page" || preferredKind === "stream";
        return {
            url: normalized,
            kind: explicitKind ? preferredKind : inferTwitchWorkspaceV2Kind(normalized),
            kindSource: explicitKind ? "explicit" : "auto",
            channel: twitchWorkspaceV2ChannelFromUrl(normalized)
        };
    } catch {
        return null;
    }
}

async function getTwitchWorkspaceV2Record() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_WORKSPACE_V2_STORAGE_KEY);
        const record = stored[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        if (!record || typeof record !== "object") return null;

        if (record.version === TWITCH_WORKSPACE_V2_VERSION) return record;

        /* 0.19.10 adds only transient pane-fullscreen state. Keep every live
         * v6 A-D window exactly where it is; no recreation or navigation is
         * needed for this schema step. */
        if (record.version === 6) {
            const upgraded = {
                ...record,
                version: TWITCH_WORKSPACE_V2_VERSION,
                lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
                paneFullscreenSlot: null,
                updatedAt: Date.now()
            };
            await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: upgraded });
            return upgraded;
        }

        /*
         * 0.19.6 is the last geometry calibration pass for this compositor:
         * every cell is born at 960x560 on the 3840x1080 Wide reference,
         * producing a 40px shared middle seam (20px from each row). The old
         * standalone chat drawer is retired because it competed with B/D for
         * z-order. Slot-level browser mute becomes persistent workspace state.
         *
         * Recreate legacy slot windows once instead of resizing GPU-backed
         * Twitch surfaces in place. Preserve the currently observed browser
         * mute state when available, then close any legacy chat window.
         */
        if (Number.isInteger(record.version) && record.version >= 1 && record.version <= 5) {
            const retiredIds = [];
            const slots = { ...record.slots };

            for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
                const previous = record.slots?.[id] || twitchWorkspaceV2EmptySlot(id);
                const liveWindow = await getTwitchWorkspaceV2Window(previous.windowId);
                const liveTab = liveWindow?.tabs?.find(candidate => candidate.active) || liveWindow?.tabs?.[0] || null;
                const observedMuted = typeof liveTab?.mutedInfo?.muted === "boolean"
                    ? liveTab.mutedInfo.muted
                    : null;
                const audioMuted = typeof previous.audioMuted === "boolean"
                    ? previous.audioMuted
                    : (observedMuted ?? true);

                if (Number.isInteger(previous.windowId)) retiredIds.push(previous.windowId);
                slots[id] = {
                    ...previous,
                    audioMuted,
                    windowId: null,
                    tabId: null,
                    updatedAt: Date.now()
                };
            }

            const legacyChatId = Number.isInteger(record.chat?.windowId)
                ? record.chat.windowId
                : null;
            const upgraded = {
                ...record,
                version: TWITCH_WORKSPACE_V2_VERSION,
                lifecycle: "direct-final-geometry-4slot+persistent-controllers+caption-overlap-20+chatless-audio",
                slots,
                chat: null,
                updatedAt: Date.now()
            };
            await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: upgraded });

            for (const windowId of retiredIds) {
                await safelyRemoveWindow(windowId);
            }
            if (Number.isInteger(legacyChatId)) await safelyRemoveWindow(legacyChatId);
            return upgraded;
        }

        return null;
    } catch {
        return null;
    }
}

async function setTwitchWorkspaceV2Record(record, broadcast = true) {
    const next = {
        ...record,
        version: TWITCH_WORKSPACE_V2_VERSION,
        lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
        updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: next });
    if (broadcast) await broadcastState().catch(() => {});
    return next;
}

async function createInitialTwitchWorkspaceV2Record() {
    const last = (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
    const slots = {};
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) slots[id] = twitchWorkspaceV2EmptySlot(id);

    slots.a = {
        ...slots.a,
        kind: inferTwitchWorkspaceV2Kind(last),
        kindSource: "auto",
        url: last,
        label: twitchWorkspaceV2ChannelFromUrl(last) || "Twitch"
    };
    slots.b = {
        ...slots.b,
        kind: "page",
        kindSource: "auto",
        url: TWITCH_DROPS_URL,
        label: "Drops"
    };

    return {
        version: TWITCH_WORKSPACE_V2_VERSION,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
        selectedSlot: "a",
        activationCount: 0,
        paneFullscreenSlot: null,
        slots,
        chat: null
    };
}

async function migrateIntoTwitchWorkspaceV2() {
    let record = await getTwitchWorkspaceV2Record();
    if (record) return record;

    /* Retire the 0.18.34-0.18.37 lab pair exactly once. Its direct-window
     * findings survive here, but its mixed/reference state machine does not. */
    await closeTwitchSplitLab().catch(() => {});
    await closeManagedTwitchWindowForSplitLab().catch(() => {});

    record = await createInitialTwitchWorkspaceV2Record();
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
    return record;
}

async function isTwitchWorkspaceV2WindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    return TWITCH_WORKSPACE_V2_SLOT_IDS.some(id => record.slots?.[id]?.windowId === windowId);
}

async function isTwitchWorkspaceV2ContentWindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    return TWITCH_WORKSPACE_V2_SLOT_IDS.some(id => record.slots?.[id]?.windowId === windowId);
}

async function getTwitchWorkspaceV2AudioPolicy(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return null;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return null;
    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return null;
    return {
        slotId,
        muted: record.slots?.[slotId]?.audioMuted !== false
    };
}

function getTwitchWorkspaceV2SlotByWindowId(record, windowId) {
    if (!record || !Number.isInteger(windowId)) return null;
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        if (record.slots?.[id]?.windowId === windowId) return id;
    }
    return null;
}

async function getTwitchWorkspaceV2Window(windowId) {
    if (!Number.isInteger(windowId)) return null;
    try {
        return await chrome.windows.get(windowId, { populate: true });
    } catch {
        return null;
    }
}

async function getTwitchWorkspaceV2SlotTab(slot) {
    if (!Number.isInteger(slot?.windowId)) return null;
    const win = await getTwitchWorkspaceV2Window(slot.windowId);
    return win?.tabs?.find(tab => tab.active) || win?.tabs?.[0] || null;
}

async function createTwitchWorkspaceV2Popup(url, rect, focused = false) {
    const win = await chrome.windows.create({
        type: "popup",
        url,
        state: "normal",
        focused,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    });

    if (!Number.isInteger(win?.id)) {
        throw new Error("Opera did not return a Twitch workspace window id.");
    }
    return win;
}

async function ensureTwitchWorkspaceV2Slot(record, slotId, focused = false) {
    const slot = record?.slots?.[slotId];
    if (!slot) return { record, window: null };

    const empty = slot.kind === "empty" || !isTwitchUrl(slot.url);
    const desiredUrl = empty
        ? twitchWorkspaceV2ControllerUrl(slotId)
        : slot.url;

    const existing = await getTwitchWorkspaceV2Window(slot.windowId);
    if (existing?.id) {
        if (existing.state === "minimized") {
            await chrome.windows.update(existing.id, { state: "normal" }).catch(() => {});
        }

        const tab = existing.tabs?.find(candidate => candidate.active) || existing.tabs?.[0] || null;
        if (Number.isInteger(tab?.id)) {
            const currentUrl = String(tab.url || tab.pendingUrl || "");
            if (empty && !isTwitchWorkspaceV2ControllerUrl(currentUrl)) {
                await chrome.tabs.update(tab.id, { url: desiredUrl, active: true }).catch(() => {});
            }
            const tabPatch = { autoDiscardable: false };
            if (!empty) tabPatch.muted = slot.audioMuted !== false;
            await chrome.tabs.update(tab.id, tabPatch).catch(() => {});
        }

        if (focused) {
            await chrome.windows.update(existing.id, { focused: true }).catch(() => {});
        }

        const tabId = Number.isInteger(tab?.id) ? tab.id : slot.tabId;
        if (slot.tabId !== tabId) {
            const next = {
                ...record,
                slots: {
                    ...record.slots,
                    [slotId]: { ...slot, tabId, updatedAt: Date.now() }
                }
            };
            return { record: await setTwitchWorkspaceV2Record(next, false), window: existing };
        }
        return { record, window: existing };
    }

    const rect = getTwitchWorkspaceV2Rects()[slotId];
    const win = await createTwitchWorkspaceV2Popup(desiredUrl, rect, focused);
    const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
    if (Number.isInteger(tab?.id)) {
        const tabPatch = { autoDiscardable: false };
        if (!empty) tabPatch.muted = slot.audioMuted !== false;
        await chrome.tabs.update(tab.id, tabPatch).catch(() => {});
    }

    const next = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: {
                ...slot,
                windowId: win.id,
                tabId: Number.isInteger(tab?.id) ? tab.id : null,
                createdAt: slot.createdAt || Date.now(),
                updatedAt: Date.now()
            }
        }
    };
    return { record: await setTwitchWorkspaceV2Record(next, false), window: win };
}

const twitchWorkspaceV2ClaimedWindowIds = new Set();

function resetTwitchWorkspaceV2ClaimCache(windowId = null) {
    if (Number.isInteger(windowId)) {
        twitchWorkspaceV2ClaimedWindowIds.delete(windowId);
        return;
    }
    twitchWorkspaceV2ClaimedWindowIds.clear();
}

async function claimTwitchWorkspaceV2WindowById(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    const member = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!member) return false;
    const rect = getTwitchWorkspaceV2Rects()[member];
    return claimTwitchWorkspaceV2Window(windowId, member, rect);
}

async function claimTwitchWorkspaceV2Window(windowId, member, rect) {
    if (shuttingDown || !Number.isInteger(windowId) || !rect) return false;
    if (twitchWorkspaceV2ClaimedWindowIds.has(windowId)) return true;
    if (!titlebarPort) await ensureTitlebarNative();
    if (!titlebarPort || !titlebarProtocolReady) return false;

    try {
        const win = await chrome.windows.get(windowId, { populate: true });
        if (!Number.isInteger(win?.id) || win.state === "minimized") return false;
        const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
        const titleHint = typeof tab?.title === "string" ? tab.title.trim().slice(0, 180) : "";
        if (!titleHint) return false;

        titlebarPort.postMessage({
            type: "claim",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            layoutProfile: "wide",
            side: "right",
            mode: "twitch",
            member,
            titleHint,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        /* The native claim keeps retrying its HWND match after this post. Avoid
         * re-queuing the same A-D claim on every Twitch title/SPA update. */
        twitchWorkspaceV2ClaimedWindowIds.add(windowId);
        return true;
    } catch {
        return false;
    }
}

let twitchWorkspaceV2ClaimGeneration = 0;

function scheduleTwitchWorkspaceV2Claims(record) {
    const generation = ++twitchWorkspaceV2ClaimGeneration;
    const rects = getTwitchWorkspaceV2Rects();
    const members = [];
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const windowId = record?.slots?.[id]?.windowId;
        if (Number.isInteger(windowId)) members.push({ member: id, windowId, rect: rects[id] });
    }
    /*
     * Claim at most twice. 0.19.1 could manufacture 9 claim waves and every
     * delayed z-order retry scheduled another 9-wave batch, which turned one
     * click into a native-message storm. The first pass catches controller and
     * already-loaded Twitch windows; the second catches slow Twitch titles.
     */
    for (const delay of [0, 700]) {
        setTimeout(() => {
            if (shuttingDown || generation !== twitchWorkspaceV2ClaimGeneration) return;
            Promise.all(
                members.map(entry =>
                    claimTwitchWorkspaceV2Window(entry.windowId, entry.member, entry.rect)
                        .catch(() => false)
                )
            ).catch(() => {});
        }, delay);
    }
}

function raiseTwitchWorkspaceV2NativeCluster(preferredSlot = null) {
    if (shuttingDown || !titlebarPort || !titlebarProtocolReady) return;
    try {
        titlebarPort.postMessage({
            type: "raise-twitch-cluster",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            selectedMember: TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
                ? preferredSlot
                : "a"
        });
    } catch {
        /* Native z-order is a best-effort enhancement. */
    }
}

async function setTwitchWorkspaceV2NativePaneFullscreen(slotId, enabled, rect) {
    if (shuttingDown || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) || !rect) return false;
    if (!titlebarPort) await ensureTitlebarNative();
    if (!titlebarPort || !titlebarProtocolReady) return false;
    try {
        titlebarPort.postMessage({
            type: "set-twitch-pane-fullscreen",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            member: slotId,
            enabled: enabled === true,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        return true;
    } catch {
        return false;
    }
}

async function applyTwitchWorkspaceV2PaneFullscreenGeometry(record, slotId) {
    if (!record || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const windowId = record.slots?.[slotId]?.windowId;
    if (!Number.isInteger(windowId)) return false;

    /* IMPORTANT: browser geometry must remain browser-owned. 0.19.10/0.19.11
     * moved the Opera HWND a second time through SetWindowPos after
     * chrome.windows.update(). Opera then kept Chromium's input/compositor
     * coordinates for the browser-owned rect while Windows painted the HWND at
     * the native rect. The visible page could therefore sit roughly one caption
     * height below its hit targets, and Page slots could lose their compositor
     * surface entirely after returning to the grid.
     *
     * Keep the same borderless trick, but ask Chromium itself to overscan the
     * caption above the pane. The native helper now only tracks cluster/fullscreen
     * ownership and never mutates this HWND's geometry. */
    const caption = getTwitchWorkspaceV2PaneCaptionOverscan(slotId);
    const paneRect = {
        left: RIGHT.left,
        top: RIGHT.top - caption,
        width: RIGHT.width,
        height: RIGHT.height + caption
    };

    await setTwitchWorkspaceV2NativePaneFullscreen(slotId, true, RIGHT).catch(() => false);
    const patch = {
        state: "normal",
        left: paneRect.left,
        top: paneRect.top,
        width: paneRect.width,
        height: paneRect.height,
        focused: true
    };
    await chrome.windows.update(windowId, patch).catch(() => {});

    /* One bounded verification only. If Opera rejects the negative top on this
     * machine, leave the browser-owned pane geometry intact rather than falling
     * back to native SetWindowPos and reintroducing input/compositor desync. */
    await new Promise(resolve => setTimeout(resolve, 90));
    const observed = await chrome.windows.get(windowId).catch(() => null);
    if (!twitchWorkspaceV2WindowMatchesRect(observed, paneRect, 3)) {
        await chrome.windows.update(windowId, patch).catch(() => {});
    }
    return true;
}

function twitchWorkspaceV2WindowMatchesRect(win, rect, tolerance = 2) {
    if (!win || !rect) return false;
    const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
    return near(win.left, rect.left) && near(win.top, rect.top) &&
        near(win.width, rect.width) && near(win.height, rect.height);
}

async function restoreTwitchWorkspaceV2GridGeometry(record, slotId, focused = true) {
    if (!record || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const slot = record.slots?.[slotId];
    const windowId = slot?.windowId;
    const rect = getTwitchWorkspaceV2Rects()[slotId];
    if (!Number.isInteger(windowId) || !rect) return false;

    /* Browser API owns both halves of the transition. Do not ask the native
     * helper to move the HWND before/after this resize: that was the source of
     * the one-caption hit-test offset and the persistent black Page surface. */
    const patch = {
        state: "normal",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        focused: focused === true
    };
    await chrome.windows.update(windowId, patch).catch(() => {});

    await new Promise(resolve => setTimeout(resolve, 90));
    const observed = await chrome.windows.get(windowId).catch(() => null);
    if (!twitchWorkspaceV2WindowMatchesRect(observed, rect)) {
        await chrome.windows.update(windowId, patch).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 70));
    }

    /* Drop native fullscreen ownership only after Chromium has committed the
     * grid rect. This keeps the helper chrome from racing a still-overscanned
     * browser window and exposing a second Opera titlebar underneath it. */
    await setTwitchWorkspaceV2NativePaneFullscreen(slotId, false, rect).catch(() => false);
    resetTwitchWorkspaceV2ClaimCache(windowId);
    await claimTwitchWorkspaceV2Window(windowId, slotId, rect).catch(() => false);
    raiseTwitchWorkspaceV2NativeCluster(slotId);

    if (Number.isInteger(slot.tabId)) {
        for (const delay of [0, 120, 320]) {
            setTimeout(() => {
                chrome.tabs.sendMessage(slot.tabId, { type: "stream-shell-twitch-workspace-wake" }).catch(() => {});
            }, delay);
        }
    }
    return true;
}

async function raiseTwitchWorkspaceV2(record, preferredSlot = null) {
    let next = record;
    const live = [];

    /* Ensure each cell exists, but do not focus A -> B -> C -> D. The old
     * focus carousel was visible to Windows/Opera and was the main source of
     * compositor/titlebar thrash in 0.19.1. */
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const ensured = await ensureTwitchWorkspaceV2Slot(next, id, false);
        next = ensured.record;
        if (Number.isInteger(ensured.window?.id)) live.push({ id, windowId: ensured.window.id });
    }

    const fullscreenId = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(next.paneFullscreenSlot)
        ? next.paneFullscreenSlot
        : null;
    const focusId = fullscreenId || (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
        ? preferredSlot
        : (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(next.selectedSlot) ? next.selectedSlot : live[0]?.id));
    const selected = live.find(entry => entry.id === focusId) || live[0] || null;

    /* One browser focus transition only. Pane fullscreen intentionally keeps
     * the other three cells underneath the selected member. */
    if (selected) {
        await chrome.windows.update(selected.windowId, { focused: true }).catch(() => {});
    }
    if (fullscreenId && selected?.id === fullscreenId) {
        await setTwitchWorkspaceV2NativePaneFullscreen(fullscreenId, true, RIGHT).catch(() => false);
    }
    raiseTwitchWorkspaceV2NativeCluster(selected?.id || focusId || "a");

    return next;
}

async function raiseExistingTwitchWorkspaceV2(preferredSlot = null) {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    const selected = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
        ? preferredSlot
        : (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.selectedSlot) ? record.selectedSlot : "a");

    /* Lightweight z-order repair only; never restart the full workspace. */
    raiseTwitchWorkspaceV2NativeCluster(selected);
    return true;
}

function pulseTwitchWorkspaceV2Tabs(record) {
    if (shuttingDown || !record) return;
    const tabIds = new Set();
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const tabId = record.slots?.[id]?.tabId;
        if (Number.isInteger(tabId)) tabIds.add(tabId);
    }
    for (const tabId of tabIds) {
        chrome.tabs.sendMessage(tabId, { type: "stream-shell-twitch-workspace-wake" })
            .catch(() => {});
    }
}

let twitchWorkspaceV2WakeGeneration = 0;

function scheduleTwitchWorkspaceV2SurfaceWake(record, preferredSlot, coldStart = false) {
    const generation = ++twitchWorkspaceV2WakeGeneration;
    const selected = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot) ? preferredSlot : "a";
    const delays = coldStart ? [90, 420, 1350] : [70, 240];

    for (const delay of delays) {
        setTimeout(() => {
            if (shuttingDown || (!coldStart && generation !== twitchWorkspaceV2WakeGeneration)) return;
            chrome.storage.local.get(["rightMode", TWITCH_WORKSPACE_V2_STORAGE_KEY])
                .then(state => {
                    if (state.rightMode !== "twitch") return;
                    const current = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
                    if (!current || current.version !== TWITCH_WORKSPACE_V2_VERSION) return;
                    /* On a cold launch claims can finish after the selected A window
                     * has already taken foreground. One final no-activate cluster raise
                     * after onboarding keeps B-D above Dashboard without focus churn. */
                    if (coldStart && delay === delays[delays.length - 1]) {
                        raiseTwitchWorkspaceV2NativeCluster(selected);
                    }
                    pulseTwitchWorkspaceV2Tabs(current);
                })
                .catch(() => {});
        }, delay);
    }
}

async function showTwitchWorkspaceV2(target = "workspace") {
    if (shuttingDown) return null;
    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch Workspace is available from the Wide Landing layout.");
    }

    await ensureDashboardWindow();
    const surfaceBeforeShow = await chrome.storage.local.get("rightMode").catch(() => ({}));
    if (surfaceBeforeShow.rightMode === "discord") {
        await hideDiscordForDashboard();
    }

    let record = await migrateIntoTwitchWorkspaceV2();
    let preferredSlot = record.selectedSlot || "a";

    if (target === "drops") {
        preferredSlot = TWITCH_WORKSPACE_V2_SLOT_IDS.find(id => isTwitchDropsUrl(record.slots?.[id]?.url)) || "b";
        const current = record.slots?.[preferredSlot];
        if (!current || current.kind === "empty") {
            record = await assignTwitchWorkspaceV2Slot(preferredSlot, TWITCH_DROPS_URL, "page", false);
        }
    } else if (target === "resume") {
        preferredSlot = record.slots?.a?.kind !== "empty" ? "a" : (record.selectedSlot || "a");
    }

    if (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.paneFullscreenSlot)) {
        preferredSlot = record.paneFullscreenSlot;
    }

    const coldStart = !TWITCH_WORKSPACE_V2_SLOT_IDS.every(
        id => Number.isInteger(record.slots?.[id]?.windowId)
    );

    record = {
        ...record,
        selectedSlot: preferredSlot,
        activationCount: Number(record.activationCount || 0) + 1,
        lastActivatedAt: Date.now()
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    await chrome.storage.local.set({
        rightMode: "twitch",
        twitchTarget: target === "drops" ? "drops" : "resume"
    });

    record = await raiseTwitchWorkspaceV2(record, preferredSlot);
    scheduleTwitchWorkspaceV2Claims(record);
    scheduleTwitchWorkspaceV2SurfaceWake(record, preferredSlot, coldStart);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});

    await recordFlightEvent({
        source: "background",
        category: "twitch-workspace-v2",
        action: "shown",
        provider: "twitch",
        detail: {
            preferredSlot,
            activationCount: record.activationCount,
            coldStart,
            liveSlots: TWITCH_WORKSPACE_V2_SLOT_IDS.filter(id => Number.isInteger(record.slots?.[id]?.windowId)),
            lifecycle: record.lifecycle
        }
    }).catch(() => {});

    await broadcastState();
    return getTwitchWorkspaceV2Diagnostics();
}

async function assignTwitchWorkspaceV2Slot(slotId, input, preferredKind = null, makeVisible = true) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    const normalized = normalizeTwitchWorkspaceV2Input(input, preferredKind);
    if (!normalized) throw new Error("Enter a Twitch channel name or twitch.tv URL.");

    let record = await migrateIntoTwitchWorkspaceV2();
    const current = record.slots?.[slotId] || twitchWorkspaceV2EmptySlot(slotId);
    let windowId = current.windowId;
    let tabId = current.tabId;

    const liveWindow = await getTwitchWorkspaceV2Window(windowId);
    if (liveWindow?.id) {
        const tab = liveWindow.tabs?.find(candidate => candidate.active) || liveWindow.tabs?.[0] || null;
        tabId = Number.isInteger(tab?.id) ? tab.id : tabId;
        if (Number.isInteger(tabId)) {
            const currentUrl = String(tab?.url || tab?.pendingUrl || "");
            if (currentUrl !== normalized.url) {
                /* Editing a workspace slot is always deliberate navigation.
                 * Clear any short-lived anti-raid guard before moving away so
                 * it cannot restore the previous channel. */
                await disarmTwitchRaidGuard({ id: tabId, windowId: liveWindow.id }).catch(() => {});
                await chrome.tabs.update(tabId, { url: normalized.url, active: true });
            }
            await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
        }
    } else {
        windowId = null;
        tabId = null;
    }

    const label = normalized.channel || (isTwitchDropsUrl(normalized.url) ? "Drops" : new URL(normalized.url).pathname || "Twitch");
    record = {
        ...record,
        selectedSlot: slotId,
        slots: {
            ...record.slots,
            [slotId]: {
                ...current,
                id: slotId,
                kind: normalized.kind,
                kindSource: normalized.kindSource,
                url: normalized.url,
                label,
                windowId,
                tabId,
                updatedAt: Date.now()
            }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    const ensured = await ensureTwitchWorkspaceV2Slot(record, slotId, false);
    record = ensured.record;
    if (makeVisible) {
        await chrome.storage.local.set({ rightMode: "twitch", twitchTarget: "resume" });
        if (Number.isInteger(ensured.window?.id)) {
            await chrome.windows.update(ensured.window.id, { focused: true }).catch(() => {});
        }
        raiseTwitchWorkspaceV2NativeCluster(slotId);
    }
    scheduleTwitchWorkspaceV2Claims(record);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    await broadcastState().catch(() => {});
    return record;
}

async function clearTwitchWorkspaceV2Slot(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    const slot = record.slots?.[slotId] || twitchWorkspaceV2EmptySlot(slotId);
    if (record.paneFullscreenSlot === slotId) {
        record = { ...record, paneFullscreenSlot: null, updatedAt: Date.now() };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
        await restoreTwitchWorkspaceV2GridGeometry(record, slotId, true).catch(() => false);
    }
    const liveWindow = await getTwitchWorkspaceV2Window(slot.windowId);
    const tab = liveWindow?.tabs?.find(candidate => candidate.active) || liveWindow?.tabs?.[0] || null;

    const empty = {
        ...twitchWorkspaceV2EmptySlot(slotId),
        audioMuted: slot.audioMuted !== false,
        raidProtectionEnabled: slot.raidProtectionEnabled === true,
        windowId: Number.isInteger(liveWindow?.id) ? liveWindow.id : null,
        tabId: Number.isInteger(tab?.id) ? tab.id : null,
        createdAt: slot.createdAt || Date.now()
    };

    record = {
        ...record,
        selectedSlot: record.selectedSlot === slotId ? "a" : record.selectedSlot,
        slots: { ...record.slots, [slotId]: empty }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, {
            url: twitchWorkspaceV2ControllerUrl(slotId),
            active: true,
            autoDiscardable: false
        }).catch(() => {});
    } else {
        const ensured = await ensureTwitchWorkspaceV2Slot(record, slotId, true);
        record = ensured.record;
    }

    scheduleTwitchWorkspaceV2Claims(record);
    if (Number.isInteger(record.slots?.[slotId]?.windowId)) {
        await chrome.windows.update(record.slots[slotId].windowId, { focused: true }).catch(() => {});
    }
    raiseTwitchWorkspaceV2NativeCluster(slotId);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    await broadcastState().catch(() => {});
    return true;
}

async function setTwitchWorkspaceV2SlotMuted(slotId, muted) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) {
        throw new Error("Invalid Twitch workspace slot.");
    }
    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const desired = muted === true;
    const slot = record.slots?.[slotId];
    if (!slot) throw new Error("Twitch workspace slot is missing.");

    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: { ...slot, audioMuted: desired, updatedAt: Date.now() }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    const tab = await getTwitchWorkspaceV2SlotTab(record.slots[slotId]);
    if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, { muted: desired, autoDiscardable: false }).catch(() => {});
    }
    return desired;
}

async function setTwitchWorkspaceV2SlotRaidProtection(slotId, enabled) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) {
        throw new Error("Invalid Twitch workspace slot.");
    }

    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const slot = record.slots?.[slotId];
    if (!slot) throw new Error("Twitch workspace slot is missing.");

    const desired = enabled === true;
    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: { ...slot, raidProtectionEnabled: desired, updatedAt: Date.now() }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    if (!desired) {
        const tab = await getTwitchWorkspaceV2SlotTab(record.slots[slotId]);
        if (Number.isInteger(tab?.id)) {
            await disarmTwitchRaidGuard(tab).catch(() => {});
        }
    }

    return desired;
}

async function reloadTwitchWorkspaceV2Slot(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    const record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");
    const tab = await getTwitchWorkspaceV2SlotTab(record.slots?.[slotId]);
    if (!Number.isInteger(tab?.id)) throw new Error("Twitch workspace slot has no live tab.");
    await chrome.tabs.reload(tab.id);
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    return true;
}

async function toggleTwitchWorkspaceV2PaneFullscreen(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const currentFullscreen = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.paneFullscreenSlot)
        ? record.paneFullscreenSlot
        : null;

    /* Exit the currently expanded member first. This also handles switching
     * directly from one full-pane slot to another without recreating either. */
    if (currentFullscreen) {
        const previous = record.slots?.[currentFullscreen];
        const previousWindowId = previous?.windowId;
        record = { ...record, paneFullscreenSlot: null, updatedAt: Date.now() };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
        if (Number.isInteger(previousWindowId)) {
            await restoreTwitchWorkspaceV2GridGeometry(
                record,
                currentFullscreen,
                currentFullscreen === slotId
            );
        }

        if (currentFullscreen === slotId) {
            raiseTwitchWorkspaceV2NativeCluster(slotId);
            await broadcastState().catch(() => {});
            return { fullscreen: false, slotId };
        }
    }

    const slot = record.slots?.[slotId];
    if (!slot || !Number.isInteger(slot.windowId)) throw new Error("Twitch workspace slot has no live window.");

    record = {
        ...record,
        selectedSlot: slotId,
        paneFullscreenSlot: slotId,
        updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });

    /* Storage changes make Stream slots expose their normal Page chrome before
     * the window grows. The persisted kind itself is untouched, so leaving
     * fullscreen automatically restores Stream cleanup when that was the prior mode. */
    await new Promise(resolve => setTimeout(resolve, 70));
    await applyTwitchWorkspaceV2PaneFullscreenGeometry(record, slotId);
    raiseTwitchWorkspaceV2NativeCluster(slotId);
    await broadcastState().catch(() => {});
    return { fullscreen: true, slotId };
}

async function getTwitchWorkspaceV2Context(windowId) {
    const record = await getTwitchWorkspaceV2Record();
    if (!record || !Number.isInteger(windowId)) return { managed: false };

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return { managed: false };
    const slot = record.slots[slotId];
    const muted = slot.audioMuted !== false;
    const paneFullscreen = record.paneFullscreenSlot === slotId;
    const effectiveKind = paneFullscreen && slot.kind === "stream" ? "page" : slot.kind;

    return {
        managed: true,
        role: "slot",
        slotId,
        selectedSlot: record.selectedSlot || "a",
        kind: slot.kind,
        effectiveKind,
        paneFullscreen,
        kindSource: slot.kindSource || "auto",
        label: slot.label,
        url: slot.url,
        channel: twitchWorkspaceV2ChannelFromUrl(slot.url),
        muted,
        raidControlVisible: await getTwitchSetting("streamShellTwitchPreventRaids", true),
        raidProtectionEnabled: slot.raidProtectionEnabled === true,
        selected: record.selectedSlot === slotId,
        slots: TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => ({
            id,
            kind: record.slots?.[id]?.kind || "empty",
            label: record.slots?.[id]?.label || `Slot ${id.toUpperCase()}`,
            channel: twitchWorkspaceV2ChannelFromUrl(record.slots?.[id]?.url),
            muted: record.slots?.[id]?.audioMuted !== false,
            raidProtectionEnabled: record.slots?.[id]?.raidProtectionEnabled === true
        }))
    };
}

async function syncTwitchWorkspaceV2Location(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    const url = String(tab.url || tab.pendingUrl || "");
    if (!isTwitchUrl(url)) return false;

    let record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, tab.windowId);
    if (!slotId) return false;
    const slot = record.slots[slotId];
    if (!slot) return false;

    const kind = slot.kindSource === "explicit" && (slot.kind === "stream" || slot.kind === "page")
        ? slot.kind
        : inferTwitchWorkspaceV2Kind(url);
    const label = twitchWorkspaceV2ChannelFromUrl(url) || (isTwitchDropsUrl(url) ? "Drops" : "Twitch Page");
    if (slot.url === url && slot.kind === kind && slot.tabId === tab.id && slot.label === label) return true;

    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: {
                ...slot,
                url,
                kind,
                label,
                tabId: tab.id,
                updatedAt: Date.now()
            }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    if (!isTwitchDropsUrl(url)) await rememberTwitchContentUrl(url);
    return true;
}

async function reconcileClosedTwitchWorkspaceV2Window(windowId) {
    if (!Number.isInteger(windowId)) return;
    resetTwitchWorkspaceV2ClaimCache(windowId);
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return;

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return;
    record = {
        ...record,
        paneFullscreenSlot: record.paneFullscreenSlot === slotId ? null : record.paneFullscreenSlot,
        slots: {
            ...record.slots,
            [slotId]: { ...record.slots[slotId], windowId: null, tabId: null, updatedAt: Date.now() }
        }
    };
    await setTwitchWorkspaceV2Record(record);
}

async function deactivateTwitchWorkspaceV2(options = {}) {
    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);
    if (!forceMinimize && keepActive) return;

    const record = await getTwitchWorkspaceV2Record();
    if (!record) return;
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        if (Number.isInteger(record.slots?.[id]?.windowId)) {
            await safelyMinimizeWindow(record.slots[id].windowId);
        }
    }
}

async function closeTwitchWorkspaceV2Windows(preserveDefinition = true) {
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return;

    const windowIds = TWITCH_WORKSPACE_V2_SLOT_IDS
        .map(id => record.slots?.[id]?.windowId)
        .filter(Number.isInteger);
    if (Number.isInteger(record.chat?.windowId)) windowIds.push(record.chat.windowId);

    /* Detach runtime ids first. During shutdown onRemoved is suppressed, and this
     * lets all physical windows close concurrently instead of serially waiting
     * for four independent Opera teardown round-trips. */
    if (!preserveDefinition) {
        await chrome.storage.local.remove(TWITCH_WORKSPACE_V2_STORAGE_KEY);
    } else {
        const slots = {};
        for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
            slots[id] = { ...record.slots[id], windowId: null, tabId: null, updatedAt: Date.now() };
        }
        record = {
            ...record,
            lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
            paneFullscreenSlot: null,
            slots,
            chat: null,
            updatedAt: Date.now()
        };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
    }

    for (const windowId of windowIds) resetTwitchWorkspaceV2ClaimCache(windowId);
    await Promise.allSettled(windowIds.map(windowId => safelyRemoveWindow(windowId)));
}

async function getTwitchWorkspaceV2Summary() {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return { active: false, version: TWITCH_WORKSPACE_V2_VERSION, slots: [] };
    return {
        active: true,
        version: record.version,
        selectedSlot: record.selectedSlot,
        paneFullscreenSlot: record.paneFullscreenSlot || null,
        activationCount: Number(record.activationCount || 0),
        slots: TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => ({
            id,
            kind: record.slots?.[id]?.kind || "empty",
            kindSource: record.slots?.[id]?.kindSource || "auto",
            url: record.slots?.[id]?.url || null,
            label: record.slots?.[id]?.label || `Slot ${id.toUpperCase()}`,
            alive: Number.isInteger(record.slots?.[id]?.windowId),
            controller: (record.slots?.[id]?.kind || "empty") === "empty",
            channel: twitchWorkspaceV2ChannelFromUrl(record.slots?.[id]?.url),
            muted: record.slots?.[id]?.audioMuted !== false,
            raidProtectionEnabled: record.slots?.[id]?.raidProtectionEnabled === true
        }))
    };
}

async function getTwitchWorkspaceV2Diagnostics() {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return { active: false, version: TWITCH_WORKSPACE_V2_VERSION, windows: [] };
    const rects = getTwitchWorkspaceV2Rects();
    const windows = [];

    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const slot = record.slots?.[id];
        const win = await getTwitchWorkspaceV2Window(slot?.windowId);
        const tab = win?.tabs?.find(candidate => candidate.active) || win?.tabs?.[0] || null;
        let identity = null;
        if (Number.isInteger(tab?.id)) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    href: location.href,
                    timeOrigin: Number.isFinite(performance.timeOrigin) ? Math.round(performance.timeOrigin) : null,
                    navigationType: performance.getEntriesByType("navigation")?.[0]?.type || null,
                    workspaceRole: document.documentElement?.dataset?.streamShellTwitchWorkspaceRole || null,
                    workspaceSlot: document.documentElement?.dataset?.streamShellTwitchWorkspaceSlot || null
                })
            }).catch(() => []);
            identity = results.find(result => result?.result)?.result || null;
        }
        windows.push({
            slot: id,
            kind: slot?.kind || "empty",
            kindSource: slot?.kindSource || "auto",
            configuredUrl: slot?.url || null,
            configuredMuted: slot?.audioMuted !== false,
            raidProtectionEnabled: slot?.raidProtectionEnabled === true,
            configuredRect: rects[id],
            id: win?.id || null,
            state: win?.state || null,
            focused: win?.focused === true,
            bounds: win ? { left: win.left, top: win.top, width: win.width, height: win.height } : null,
            documentIdentity: identity,
            tab: tab ? {
                id: tab.id,
                status: tab.status,
                url: tab.url || tab.pendingUrl || null,
                title: tab.title || null,
                audible: tab.audible === true,
                muted: tab.mutedInfo?.muted === true,
                discarded: tab.discarded === true,
                autoDiscardable: tab.autoDiscardable !== false
            } : null
        });
    }

    const surfaceState = await chrome.storage.local.get("rightMode").catch(() => ({}));

    return {
        active: true,
        version: record.version,
        lifecycle: record.lifecycle,
        paneFullscreenSlot: record.paneFullscreenSlot || null,
        visible: surfaceState.rightMode === "twitch",
        covered: surfaceState.rightMode !== "twitch",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        selectedSlot: record.selectedSlot,
        activationCount: Number(record.activationCount || 0),
        nativeClusterMembers: Number.isInteger(titlebarLastNativeStatus?.twitchClusterMembers)
            ? titlebarLastNativeStatus.twitchClusterMembers
            : null,
        nativeClusterMap: titlebarLastNativeStatus?.twitchClusterMap || null,
        layout: { rightPane: { ...RIGHT }, ...rects },
        windows
    };
}

chrome.alarms.onAlarm.addListener(alarm => {
    handleTwitchWorkspaceV2StreamRefreshAlarm(alarm).catch(() => {});
});

/* Alarms normally persist, but Chromium does not guarantee that across every
 * browser restart/update. Reconcile them whenever the service worker starts. */
getTwitchWorkspaceV2Record()
    .then(record => syncTwitchWorkspaceV2StreamRefreshAlarms(record))
    .catch(() => {});

/*
 * ================================================================
 * OPTIONAL NATIVE TITLEBAR TOOLBAR
 * ================================================================
 *
 * This is intentionally a second native host, separate from Discord.
 * If it is not installed (or if it crashes), Stream Shell continues to
 * work normally; Landing/Dashboard controls remain available inside the
 * shell pages. The old in-page floating navbar was retired in 0.9.29.
 */
function getTitlebarGeometryStateKey() {
    return [
        LEFT.left,
        LEFT.top,
        LEFT.width,
        LEFT.height,
        RIGHT.left,
        RIGHT.top,
        RIGHT.width,
        RIGHT.height
    ].join(",");
}


async function syncConnectedTitlebarNative() {
    if (
        shuttingDown ||
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode",
            "twitchTarget"
        ]);

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    const visibilityMode =
        await getTitlebarVisibilityMode();

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode,
        state.twitchTarget ||
            "resume"
    );
}


async function ensureTitlebarNative() {
    if (
        shuttingDown
    ) {
        return;
    }

    if (
        titlebarPort &&
        titlebarProtocolReady
    ) {
        await syncConnectedTitlebarNative();
        return;
    }

    if (
        titlebarConnectPromise
    ) {
        await titlebarConnectPromise;
        return;
    }

    titlebarConnectPromise =
        connectTitlebarNative();

    try {
        await titlebarConnectPromise;
    } finally {
        titlebarConnectPromise =
            null;
    }
}


async function connectTitlebarNative() {
    let port;

    try {
        port =
            chrome.runtime.connectNative(
                TITLEBAR_NATIVE_HOST
            );
    } catch {
        return;
    }

    titlebarLastStateKey =
        null;
    titlebarProtocolReady =
        false;

    port.onMessage.addListener(
        message => {
            handleTitlebarNativeMessage(
                message
            );
        }
    );

    port.onDisconnect.addListener(
        () => {
            if (
                titlebarPort ===
                port
            ) {
                titlebarPort =
                    null;

                titlebarLastStateKey =
                    null;

                titlebarProtocolReady =
                    false;

                stopTitlebarReconcileLoop();
            }

            try {
                void chrome.runtime.lastError;
            } catch {
            }
        }
    );

    /*
     * Negotiate before sending init. An old helper therefore never receives
     * geometry/state messages it might interpret with an incompatible trust
     * model; it simply times out and is disconnected fail-closed.
     */
    const protocolAccepted =
        await new Promise(
            resolve => {
                let settled = false;

                const finish =
                    accepted => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        clearTimeout(timeoutId);
                        try {
                            port.onMessage.removeListener(
                                handshakeListener
                            );
                        } catch {
                        }
                        resolve(accepted);
                    };

                const handshakeListener =
                    message => {
                        if (
                            message?.event ===
                                "hello-ack"
                        ) {
                            finish(
                                message.protocolVersion ===
                                    TITLEBAR_PROTOCOL_VERSION
                            );
                        }
                    };

                port.onMessage.addListener(
                    handshakeListener
                );

                const timeoutId =
                    setTimeout(
                        () => finish(false),
                        1200
                    );

                try {
                    port.postMessage({
                        type:
                            "hello",

                        protocolVersion:
                            TITLEBAR_PROTOCOL_VERSION
                    });
                } catch {
                    finish(false);
                }
            }
        );

    if (
        !protocolAccepted ||
        shuttingDown
    ) {
        titlebarLastNativeStatus = {
            event:
                "protocol-unavailable",
            expected:
                TITLEBAR_PROTOCOL_VERSION
        };

        try {
            port.disconnect();
        } catch {
        }
        return;
    }

    titlebarPort =
        port;
    titlebarProtocolReady =
        true;
    resetTwitchWorkspaceV2ClaimCache();

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode",
            "twitchTarget"
        ]);

    let volumeShortcut =
        "";

    try {
        const commands =
            await chrome.commands.getAll();

        volumeShortcut =
            commands.find(
                command =>
                    command.name === "toggle-volume-booster"
            )?.shortcut ||
            "";
    } catch {
    }

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    const visibilityMode =
        await getTitlebarVisibilityMode();

    if (
        titlebarPort !==
            port ||
        !titlebarProtocolReady ||
        shuttingDown
    ) {
        return;
    }

    try {
        port.postMessage({
            type:
                "init",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            left:
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            rightLeft:
                RIGHT.left,

            rightTop:
                RIGHT.top,

            rightWidth:
                RIGHT.width,

            rightHeight:
                RIGHT.height,

            layoutProfile:
                streamShellDisplayProfileCache?.mode || "wide",

            leftMode:
                state.leftMode ||
                "landing",

            rightMode:
                state.rightMode ||
                "dashboard",

            twitchTarget:
                state.twitchTarget ||
                "resume",

            visibilityMode,

            settingsOpen:
                titlebarSettingsOpen,

            volumeActive:
                titlebarVolumeActive,

            fullscreenActive:
                titlebarFullscreenActive,

            volumeShortcut
        });

        titlebarLastStateKey =
            `${state.leftMode || "landing"}|${state.rightMode || "dashboard"}|${state.twitchTarget || "resume"}|${visibilityMode}|${streamShellDisplayProfileCache?.mode || "wide"}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

        startTitlebarReconcileLoop();

        /* A native-host restart loses the HWND member map while the browser
         * windows themselves survive. Re-announce A-D once after reconnect. */
        getTwitchWorkspaceV2Record()
            .then(record => {
                if (record) scheduleTwitchWorkspaceV2Claims(record);
            })
            .catch(() => {});
    } catch {
        try {
            port.disconnect();
        } catch {
        }
    }
}


function stopTitlebarNative() {
    const port =
        titlebarPort;

    titlebarPort =
        null;

    titlebarProtocolReady =
        false;

    titlebarLastStateKey =
        null;

    titlebarSettingsOpen =
        false;

    titlebarVolumeActive =
        false;

    titlebarFullscreenActive =
        false;

    titlebarFullscreenWindowId =
        null;

    resetTwitchWorkspaceV2ClaimCache();
    stopTitlebarReconcileLoop();

    if (
        !port
    ) {
        return;
    }

    try {
        port.postMessage({
            type:
                "shutdown"
        });
    } catch {
    }

    try {
        port.disconnect();
    } catch {
    }
}


async function getTitlebarVisibilityMode() {
    if (
        shuttingDown
    ) {
        return "none";
    }

    try {
        const [
            state,
            browserWindows
        ] =
            await Promise.all([
                chrome.storage.local.get([
                    "providerWindows",
                    "landingWindowId",
                    "dashboardWindowId",
                    TWITCH_WINDOW_STORAGE_KEY,
                    TWITCH_SPLIT_LAB_STORAGE_KEY,
                    TWITCH_WORKSPACE_V2_STORAGE_KEY,
                    "rightMode"
                ]),
                chrome.windows.getAll({
                    populate:
                        false
                })
            ]);

        const shellWindowIds =
            new Set();

        if (
            Number.isInteger(
                state.landingWindowId
            )
        ) {
            shellWindowIds.add(
                state.landingWindowId
            );
        }

        if (
            Number.isInteger(
                state.dashboardWindowId
            )
        ) {
            shellWindowIds.add(
                state.dashboardWindowId
            );
        }

        if (
            Number.isInteger(
                state[TWITCH_WINDOW_STORAGE_KEY]
            )
        ) {
            shellWindowIds.add(
                state[TWITCH_WINDOW_STORAGE_KEY]
            );
        }

        const splitWindowIds =
            Array.isArray(state[TWITCH_SPLIT_LAB_STORAGE_KEY]?.windowIds)
                ? state[TWITCH_SPLIT_LAB_STORAGE_KEY].windowIds
                : [];

        for (const windowId of splitWindowIds) {
            if (Number.isInteger(windowId)) {
                shellWindowIds.add(windowId);
            }
        }

        const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        for (const slotId of ["a", "b", "c", "d"]) {
            const windowId = workspaceRecord?.slots?.[slotId]?.windowId;
            if (Number.isInteger(windowId)) shellWindowIds.add(windowId);
        }
        if (Number.isInteger(workspaceRecord?.chat?.windowId)) {
            shellWindowIds.add(workspaceRecord.chat.windowId);
        }

        for (
            const windowId
            of Object.values(
                state.providerWindows || {}
            )
        ) {
            if (
                Number.isInteger(
                    windowId
                )
            ) {
                shellWindowIds.add(
                    windowId
                );
            }
        }

        const focusedBrowserWindow =
            browserWindows.find(
                window =>
                    window.focused
            );

        if (
            focusedBrowserWindow
        ) {
            return shellWindowIds.has(
                focusedBrowserWindow.id
            )
                ? "shell"
                : "none";
        }

        return state.rightMode ===
            "discord"
                ? "discord"
                : "none";
    } catch {
        return "none";
    }
}


async function claimFocusedTitlebarSurface(
    expectedWindowId = null
) {
    if (
        shuttingDown
    ) {
        return false;
    }

    if (!titlebarPort) {
        await ensureTitlebarNative();
    }

    if (
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return false;
    }

    try {
        const layoutProfile =
            streamShellDisplayProfileCache?.mode || "wide";

        const state =
            await chrome.storage.local.get([
                "providerWindows",
                "landingWindowId",
                "dashboardWindowId",
                TWITCH_WINDOW_STORAGE_KEY,
                TWITCH_WORKSPACE_V2_STORAGE_KEY,
                "leftMode",
                "rightMode"
            ]);

        let focusedWindow = null;

        if (
            Number.isInteger(
                expectedWindowId
            )
        ) {
            focusedWindow =
                await chrome.windows.get(
                    expectedWindowId,
                    {
                        populate:
                            true
                    }
                );

            if (
                layoutProfile === "compact" &&
                focusedWindow?.focused !==
                    true
            ) {
                return false;
            }
        } else {
            focusedWindow =
                await chrome.windows.getLastFocused({
                    populate:
                        true
                });

            if (focusedWindow?.focused !== true) {
                return false;
            }
        }

        if (
            !Number.isInteger(
                focusedWindow?.id
            ) ||
            focusedWindow.state ===
                "minimized"
        ) {
            return false;
        }

        let surfaceMode = null;
        let surfaceSide = null;
        let surfaceMember = null;

        if (
            focusedWindow.id ===
                state.landingWindowId &&
            layoutProfile ===
                "wide"
        ) {
            surfaceMode = "landing";
            surfaceSide = "left";
        } else if (
            focusedWindow.id ===
                state.dashboardWindowId
        ) {
            surfaceMode = "dashboard";
            surfaceSide =
                layoutProfile === "compact"
                    ? "left"
                    : "right";
        } else if (
            layoutProfile === "wide" &&
            focusedWindow.id === state[TWITCH_WINDOW_STORAGE_KEY]
        ) {
            surfaceMode = "twitch";
            surfaceSide = "right";
        } else if (layoutProfile === "wide") {
            const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
            for (const slotId of ["a", "b", "c", "d"]) {
                if (workspaceRecord?.slots?.[slotId]?.windowId === focusedWindow.id) {
                    surfaceMode = "twitch";
                    surfaceSide = "right";
                    surfaceMember = slotId;
                    break;
                }
            }
            if (!surfaceMember && workspaceRecord?.chat?.windowId === focusedWindow.id) {
                surfaceMode = "twitch";
                surfaceSide = "right";
                surfaceMember = "chat";
            }

            if (!surfaceMode) {
                const providerEntry =
                Object.entries(
                    state.providerWindows || {}
                )
                    .find(
                        ([provider, windowId]) =>
                            PROVIDERS[provider] &&
                            windowId ===
                                focusedWindow.id
                    );

            surfaceMode =
                providerEntry?.[0] ||
                null;
                surfaceSide =
                    surfaceMode
                        ? "left"
                        : null;
            }
        }

        if (
            !surfaceMode ||
            !surfaceSide
        ) {
            return false;
        }

        const intendedSurface =
            surfaceSide === "left"
                ? state.leftMode
                : state.rightMode;

        if (
            intendedSurface !==
                surfaceMode
        ) {
            return false;
        }

        const activeTab =
            focusedWindow.tabs?.find(
                tab =>
                    tab.active
            ) ||
            focusedWindow.tabs?.[0] ||
            null;

        const titleHint =
            typeof activeTab?.title === "string"
                ? activeTab.title.trim().slice(0, 180)
                : "";

        /*
         * HWND identity is fail-closed. A managed chrome.windows ID alone is
         * not enough because Chromium and Win32 focus can race. Compact requires
         * the matching native foreground HWND; Wide validates the explicit claim
         * against its pane plus this non-empty title fingerprint so left/right
         * surfaces can be onboarded concurrently.
         */
        if (!titleHint) {
            return false;
        }

        const claim = {
            type:
                "claim",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            layoutProfile,

            side:
                surfaceSide,

            mode:
                surfaceMode,

            titleHint
        };

        if (surfaceMember) {
            const rect = getTwitchWorkspaceV2Rects()[surfaceMember];
            if (rect) {
                claim.member = surfaceMember;
                claim.left = rect.left;
                claim.top = rect.top;
                claim.width = rect.width;
                claim.height = rect.height;
            }
        }

        titlebarPort.postMessage(claim);

        return true;
    } catch {
        return false;
    }
}


function cancelTitlebarClaimRetries(
    notifyNative = false
) {
    titlebarClaimRetryGeneration +=
        1;

    if (
        !notifyNative ||
        !titlebarPort
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "claim-cancel",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION
        });
    } catch {
    }
}


function scheduleTitlebarClaimRetries(
    expectedWindowId
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            expectedWindowId
        )
    ) {
        return;
    }

    const generation =
        titlebarClaimRetryGeneration;

    /*
     * First probes are deliberately tight so a brand-new provider gets native
     * chrome/taskbar identity as soon as Chromium exposes its first title. The
     * later probes cover slower DRM/login startups without polling forever.
     */
    const delays =
        [80, 180, 350, 700, 1200, 2000, 3200, 5000, 7500];

    for (const delay of delays) {
        setTimeout(
            () => {
                if (
                    shuttingDown ||
                    generation !==
                        titlebarClaimRetryGeneration
                ) {
                    return;
                }

                claimFocusedTitlebarSurface(
                    expectedWindowId
                )
                    .catch(
                        () => {}
                    );
            },
            delay
        );
    }
}


function stopTitlebarReconcileLoop() {
    if (
        titlebarReconcileTimer !==
            null
    ) {
        clearInterval(
            titlebarReconcileTimer
        );
        titlebarReconcileTimer =
            null;
    }
}


function startTitlebarReconcileLoop() {
    stopTitlebarReconcileLoop();

    if (
        shuttingDown ||
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    let titlebarReconcileTick = 0;

    titlebarReconcileTimer =
        setInterval(
            () => {
                if (
                    shuttingDown ||
                    !titlebarPort ||
                    !titlebarProtocolReady
                ) {
                    stopTitlebarReconcileLoop();
                    return;
                }

                try {
                    titlebarPort.postMessage({
                        type:
                            "heartbeat",

                        protocolVersion:
                            TITLEBAR_PROTOCOL_VERSION
                    });
                } catch {
                    return;
                }

                /*
                 * Heartbeats need to remain comfortably inside the native
                 * 6.5-second freshness window. Surface claims are already
                 * event-driven, so use the periodic path only as a 10-second
                 * self-heal instead of re-querying browser/native state on
                 * every heartbeat.
                 */
                titlebarReconcileTick += 1;
                if (titlebarReconcileTick % 4 === 0) {
                    claimFocusedTitlebarSurface()
                        .catch(
                            () => {}
                        );
                }
            },
            TITLEBAR_RECONCILE_INTERVAL_MS
        );
}


function requestTitlebarFocus(
    side
) {
    if (
        !titlebarPort ||
        !titlebarProtocolReady ||
        (
            side !== "left" &&
            side !== "right"
        )
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "focus",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            side
        });
    } catch {
    }
}


function sendTitlebarState(
    leftMode,
    rightMode,
    visibilityMode = "none",
    twitchTarget = "resume"
) {
    if (
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    const nextLeft =
        leftMode ||
        "landing";

    const nextRight =
        rightMode ||
        "dashboard";

    const nextVisibility =
        visibilityMode ||
        "none";

    const nextTwitchTarget =
        twitchTarget === "drops"
            ? "drops"
            : "resume";

    const layoutProfile =
        streamShellDisplayProfileCache?.mode || "wide";

    const key =
        `${nextLeft}|${nextRight}|${nextTwitchTarget}|${nextVisibility}|${layoutProfile}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

    if (
        key ===
        titlebarLastStateKey
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "state",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            layoutProfile,

            leftMode:
                nextLeft,

            rightMode:
                nextRight,

            twitchTarget:
                nextTwitchTarget,

            visibilityMode:
                nextVisibility,

            settingsOpen:
                titlebarSettingsOpen,

            volumeActive:
                titlebarVolumeActive,

            fullscreenActive:
                titlebarFullscreenActive,

            left:
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            rightLeft:
                RIGHT.left,

            rightTop:
                RIGHT.top,

            rightWidth:
                RIGHT.width,

            rightHeight:
                RIGHT.height
        });

        titlebarLastStateKey =
            key;
    } catch {
    }
}


async function setTitlebarSettingsOpen(
    open
) {
    const nextOpen =
        open === true;

    if (
        titlebarSettingsOpen ===
        nextOpen
    ) {
        return;
    }

    titlebarSettingsOpen =
        nextOpen;

    const [
        state,
        visibilityMode
    ] =
        await Promise.all([
            chrome.storage.local.get([
                "leftMode",
                "rightMode",
                "twitchTarget"
            ]),
            getTitlebarVisibilityMode()
        ]);

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode,
        state.twitchTarget ||
            "resume"
    );
}


function handleTitlebarNativeMessage(
    message
) {
    if (
        shuttingDown
    ) {
        return;
    }

    if (
        message?.event ===
            "status"
    ) {
        titlebarLastNativeStatus =
            message;
        return;
    }

    if (
        message?.event ===
            "protocol-mismatch"
    ) {
        titlebarLastNativeStatus =
            message;
        titlebarProtocolReady =
            false;
        stopTitlebarReconcileLoop();
        try {
            titlebarPort?.disconnect();
        } catch {
        }
        return;
    }

    if (
        message?.event ===
            "claim-accepted"
    ) {
        try {
            rememberTwitchWorkspaceV2NativeCaption(message);
        } catch {
        }
        /*
         * Claims are idempotent. Leave any already scheduled onboarding probes
         * alive so concurrent Wide surfaces cannot cancel each other. A real
         * unmanaged-window transition cancels the whole generation instead.
         */
        return;
    }

    if (
        message?.event !==
            "action"
    ) {
        return;
    }

    const action =
        message.action;

    Promise.resolve()
        .then(
            async () => {
                if (
                    action ===
                    "landing"
                ) {
                    if (streamShellDisplayProfileCache?.mode === "compact") {
                        await showDashboard();
                    } else {
                        await showLanding(true);
                    }
                    return;
                }

                if (action === "reload") {
                    await reloadLeft();
                    return;
                }

                if (
                    PROVIDERS[
                        action
                    ]
                ) {
                    await switchProvider(
                        action
                    );
                    return;
                }

                if (
                    action ===
                    "dashboard"
                ) {
                    await showDashboard();
                    requestTitlebarFocus(
                        streamShellDisplayProfileCache?.mode === "compact" ? "left" : "right"
                    );
                    return;
                }

                if (
                    action ===
                    "settings"
                ) {
                    await showDashboard();
                    requestTitlebarFocus(
                        streamShellDisplayProfileCache?.mode === "compact" ? "left" : "right"
                    );

                    const state =
                        await chrome.storage.local.get([
                            "leftMode",
                            "activeProvider"
                        ]);

                    const provider =
                        PROVIDERS[state.leftMode]
                            ? state.leftMode
                            : (
                                PROVIDERS[state.activeProvider]
                                    ? state.activeProvider
                                    : "youtube"
                            );

                    try {
                        await chrome.runtime.sendMessage({
                            type:
                                "dashboard-toggle-settings",

                            provider
                        });
                    } catch {
                    }

                    return;
                }

                if (
                    action ===
                    "discord"
                ) {
                    await showDiscord();
                    return;
                }

                if (
                    action ===
                    "twitch"
                ) {
                    await showTwitch("resume");
                    return;
                }

                if (
                    action ===
                    "twitch-drops"
                ) {
                    await showTwitch("drops");
                    return;
                }

                if (
                    action ===
                    "kill"
                ) {
                    await killStreamShell();
                }
            }
        )
        .catch(
            error => {
                console.error(
                    "Native titlebar action failed:",
                    error
                );
            }
        );
}


/*
 * ============================================================
 * TAB-LEVEL VOLUME BOOSTER
 * ============================================================
 *
 * DRM providers cannot safely be routed through
 * createMediaElementSource(). Stream Shell therefore captures the current
 * provider tab and replays its audio through an offscreen AudioContext.
 * The native titlebar button is bridged through a Chromium command so the
 * tabCapture API receives the activeTab grant it explicitly requires.
 */

const VOLUME_CAPTURE_SESSION_KEY =
    "streamShellVolumeCaptureSession";

const VOLUME_CAPTURE_COMMAND =
    "toggle-volume-booster";

const VOLUME_CAPTURE_OFFSCREEN_URL =
    "offscreen/volume-audio.html";

const VOLUME_CAPTURE_STORAGE_PREFIX =
    "streamShellVolumeBoost_";

const VOLUME_CAPTURE_PROFILE_PREFIX =
    "streamShellAudioProfile_";

const VOLUME_CAPTURE_MIN =
    100;

const VOLUME_CAPTURE_MAX =
    600;

let volumeOffscreenCreation =
    null;


function normalizeVolumeCapturePercent(value) {
    const numeric =
        Number(value);

    if (!Number.isFinite(numeric)) {
        return VOLUME_CAPTURE_MIN;
    }

    return Math.min(
        VOLUME_CAPTURE_MAX,
        Math.max(
            VOLUME_CAPTURE_MIN,
            numeric
        )
    );
}


function volumeCaptureStorageKey(provider) {
    return `${VOLUME_CAPTURE_STORAGE_PREFIX}${provider}`;
}


function volumeCaptureProfileKey(provider) {
    return `${VOLUME_CAPTURE_PROFILE_PREFIX}${provider}`;
}


function normalizeVolumeCaptureProfile(value) {
    const profile = String(value || "normal").toLowerCase();
    return ["normal", "dialogue", "night"].includes(profile)
        ? profile
        : "normal";
}


function isVolumeCaptureProvider(provider) {
    return Boolean(PROVIDERS[provider] || provider === "twitch");
}

function volumeCaptureProviders() {
    return [...Object.keys(PROVIDERS), "twitch"];
}

function providerFromVolumeTabUrl(url) {
    const value =
        String(url || "").toLowerCase();

    if (value.includes("youtube.com")) return "youtube";
    if (value.includes("netflix.com")) return "netflix";
    if (value.includes("primevideo.com") || value.includes("amazon.de/gp/video")) return "prime";
    if (value.includes("disneyplus.com")) return "disney";
    if (value.includes("crunchyroll.com")) return "crunchyroll";
    if (value.includes("twitch.tv")) return "twitch";

    return null;
}


async function getVolumeCaptureSession() {
    try {
        const stored =
            await chrome.storage.session.get(
                VOLUME_CAPTURE_SESSION_KEY
            );

        const session =
            stored[VOLUME_CAPTURE_SESSION_KEY];

        return (
            session &&
            Number.isInteger(session.tabId) &&
            isVolumeCaptureProvider(session.provider)
        )
            ? session
            : null;
    } catch {
        return null;
    }
}


async function setVolumeCaptureSession(session) {
    try {
        if (!session) {
            await chrome.storage.session.remove(
                VOLUME_CAPTURE_SESSION_KEY
            );
            return;
        }

        await chrome.storage.session.set({
            [VOLUME_CAPTURE_SESSION_KEY]: session
        });
    } catch {
    }
}


async function getStoredVolumeCapturePercent(provider) {
    const key =
        volumeCaptureStorageKey(provider);

    try {
        const stored =
            await chrome.storage.local.get(key);

        return normalizeVolumeCapturePercent(
            stored[key]
        );
    } catch {
        return VOLUME_CAPTURE_MIN;
    }
}


async function getStoredVolumeCaptureProfile(provider) {
    const key = volumeCaptureProfileKey(provider);

    try {
        const stored = await chrome.storage.local.get(key);
        return normalizeVolumeCaptureProfile(stored[key]);
    } catch {
        return "normal";
    }
}


async function ensureVolumeOffscreenDocument() {
    const offscreenUrl =
        chrome.runtime.getURL(
            VOLUME_CAPTURE_OFFSCREEN_URL
        );

    try {
        const existing =
            await chrome.runtime.getContexts({
                contextTypes: [
                    "OFFSCREEN_DOCUMENT"
                ],
                documentUrls: [
                    offscreenUrl
                ]
            });

        if (existing.length) {
            return;
        }
    } catch {
        /* Continue with creation; older Chromium builds simply reject getContexts. */
    }

    if (volumeOffscreenCreation) {
        await volumeOffscreenCreation;
        return;
    }

    volumeOffscreenCreation =
        chrome.offscreen.createDocument({
            url:
                VOLUME_CAPTURE_OFFSCREEN_URL,
            reasons: [
                "USER_MEDIA"
            ],
            justification:
                "Replay the active provider tab through the user-controlled Stream Shell audio processing chain."
        });

    try {
        await volumeOffscreenCreation;
    } finally {
        volumeOffscreenCreation =
            null;
    }
}


async function closeVolumeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
    } catch {
    }
}


async function sendVolumeOffscreenMessage(message) {
    try {
        return await chrome.runtime.sendMessage({
            ...message,
            target:
                "stream-shell-volume-offscreen"
        });
    } catch {
        return null;
    }
}



async function waitForVolumeCaptureRelease(tabId, timeoutMs = 1200) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const captures = await chrome.tabCapture.getCapturedTabs();
            const active = captures.some(info =>
                info.tabId === tabId &&
                (info.status === "pending" || info.status === "active")
            );

            if (!active) return true;
        } catch {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 35));
    }

    return false;
}


async function suspendVolumeCaptureForFullscreen(tabId) {
    const session = await getVolumeCaptureSession();

    if (!session || session.tabId !== tabId) {
        return {
            ok: true,
            suspended: false
        };
    }

    if (session.fullscreenSuspended === true) {
        return {
            ok: true,
            suspended: true
        };
    }

    // Persist the logical booster session before stopping tabCapture. The
    // tabCapture "stopped" event is therefore distinguishable from a real
    // user/track shutdown and must not clear the titlebar state.
    await setVolumeCaptureSession({
        ...session,
        fullscreenSuspended: true
    });

    titlebarVolumeActive = true;

    await sendVolumeOffscreenMessage({
        type: "volume-capture-stop",
        tabId
    });

    let released = await waitForVolumeCaptureRelease(tabId, 450);

    if (!released) {
        // Force-close the offscreen owner as a deterministic fallback. It is
        // recreated on resume; this still stays well inside Chromium's
        // transient user-activation window for requestFullscreen().
        await closeVolumeOffscreenDocument();
        released = await waitForVolumeCaptureRelease(tabId, 750);
    }

    return {
        ok: released,
        suspended: released
    };
}


async function resumeVolumeCaptureAfterFullscreen(tabId) {
    const session = await getVolumeCaptureSession();

    if (
        !session ||
        session.tabId !== tabId ||
        session.fullscreenSuspended !== true
    ) {
        return {
            ok: true,
            resumed: false
        };
    }

    let tab;
    try {
        tab = await chrome.tabs.get(tabId);
    } catch {
        tab = null;
    }

    const provider = providerFromVolumeTabUrl(tab?.url) || session.provider;

    if (!tab?.id || provider !== session.provider) {
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: "Provider tab is no longer available."
        };
    }

    await ensureVolumeOffscreenDocument();

    let streamId = null;
    let lastError = null;

    // A just-stopped capture can remain pending in Chromium for a handful of
    // milliseconds. Retry that race locally; permission failures are not
    // hidden and will fall through to the normal inactive state.
    for (const delay of [0, 60, 140]) {
        if (delay) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            streamId = await chrome.tabCapture.getMediaStreamId({
                targetTabId: tabId
            });
            if (streamId) break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!streamId) {
        await closeVolumeOffscreenDocument();
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: lastError?.message || "Volume capture could not resume."
        };
    }

    const response = await sendVolumeOffscreenMessage({
        type: "volume-capture-start",
        tabId,
        provider: session.provider,
        percent: normalizeVolumeCapturePercent(session.percent),
        profile: normalizeVolumeCaptureProfile(session.profile),
        streamId
    });

    if (!response?.ok) {
        await closeVolumeOffscreenDocument();
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: response?.error || "Offscreen audio routing could not resume."
        };
    }

    await setVolumeCaptureSession({
        ...session,
        fullscreenSuspended: false
    });

    titlebarVolumeActive = true;

    if (!shuttingDown) {
        await broadcastState();
    }

    return {
        ok: true,
        resumed: true
    };
}


async function refreshTitlebarVolumeActive(leftMode = null, rightMode = null) {
    const session =
        await getVolumeCaptureSession();

    if (!session) {
        titlebarVolumeActive =
            false;
        return false;
    }

    if (session.fullscreenSuspended === true) {
        titlebarVolumeActive =
            session.provider === "twitch"
                ? (rightMode ? rightMode === "twitch" : true)
                : (leftMode ? session.provider === leftMode : true);
        return titlebarVolumeActive;
    }

    let captured =
        false;

    try {
        const captures =
            await chrome.tabCapture.getCapturedTabs();

        captured =
            captures.some(
                info =>
                    info.tabId === session.tabId &&
                    (
                        info.status === "pending" ||
                        info.status === "active"
                    )
            );
    } catch {
        /* Keep the persisted session as the fallback if the status API is unavailable. */
        captured =
            true;
    }

    if (!captured) {
        await setVolumeCaptureSession(null);
        titlebarVolumeActive =
            false;
        return false;
    }

    titlebarVolumeActive =
        session.provider === "twitch"
            ? (rightMode ? rightMode === "twitch" : true)
            : (leftMode ? session.provider === leftMode : true);

    return titlebarVolumeActive;
}


async function updateActiveVolumeCaptureGain(provider, percent) {
    const session =
        await getVolumeCaptureSession();

    if (
        !session ||
        session.provider !== provider
    ) {
        return false;
    }

    const normalized =
        normalizeVolumeCapturePercent(percent);

    if (session.fullscreenSuspended === true) {
        await setVolumeCaptureSession({
            ...session,
            percent: normalized
        });
        return true;
    }

    const response =
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-set-gain",
            tabId:
                session.tabId,
            percent:
                normalized
        });

    if (response?.ok) {
        await setVolumeCaptureSession({
            ...session,
            percent:
                normalized
        });
        return true;
    }

    return false;
}


async function updateActiveVolumeCaptureProfile(provider, profile) {
    const session = await getVolumeCaptureSession();

    if (!session || session.provider !== provider) {
        return false;
    }

    const normalized = normalizeVolumeCaptureProfile(profile);

    if (session.fullscreenSuspended === true) {
        await setVolumeCaptureSession({
            ...session,
            profile: normalized
        });
        return true;
    }

    const response = await sendVolumeOffscreenMessage({
        type: "volume-capture-set-profile",
        tabId: session.tabId,
        profile: normalized
    });

    if (response?.ok) {
        await setVolumeCaptureSession({
            ...session,
            profile: normalized
        });
        return true;
    }

    return false;
}


async function stopVolumeCapture(shouldBroadcast = true) {
    const session =
        await getVolumeCaptureSession();

    await setVolumeCaptureSession(null);
    titlebarVolumeActive =
        false;

    if (session) {
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-stop",
            tabId:
                session.tabId
        });
    }

    await closeVolumeOffscreenDocument();

    if (
        shouldBroadcast &&
        !shuttingDown
    ) {
        await broadcastState();
    }
}


async function stopVolumeCaptureForProviderChange(nextProvider) {
    const session =
        await getVolumeCaptureSession();

    if (
        session &&
        session.provider !== nextProvider
    ) {
        await stopVolumeCapture(false);
    }
}


async function startVolumeCapture(tab, provider) {
    if (
        shuttingDown ||
        !tab?.id ||
        !isVolumeCaptureProvider(provider)
    ) {
        return false;
    }

    const existing =
        await getVolumeCaptureSession();

    if (
        existing &&
        existing.tabId === tab.id
    ) {
        await stopVolumeCapture();
        return false;
    }

    if (existing) {
        await stopVolumeCapture(false);
    }

    const [percent, profile] =
        await Promise.all([
            getStoredVolumeCapturePercent(provider),
            getStoredVolumeCaptureProfile(provider)
        ]);

    await ensureVolumeOffscreenDocument();

    let streamId;

    try {
        streamId =
            await chrome.tabCapture.getMediaStreamId({
                targetTabId:
                    tab.id
            });
    } catch (error) {
        await closeVolumeOffscreenDocument();
        console.warn(
            "Stream Shell volume capture could not start:",
            error
        );
        return false;
    }

    const response =
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-start",
            tabId:
                tab.id,
            provider,
            percent,
            profile,
            streamId
        });

    if (!response?.ok) {
        await closeVolumeOffscreenDocument();
        console.warn(
            "Stream Shell offscreen volume routing failed:",
            response?.error || "unknown error"
        );
        return false;
    }

    await setVolumeCaptureSession({
        tabId:
            tab.id,
        provider,
        percent,
        profile
    });

    titlebarVolumeActive =
        true;

    await broadcastState();
    return true;
}


async function toggleVolumeCaptureFromCommand(tab) {
    if (shuttingDown) {
        return;
    }

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode",
            "providerWindows",
            TWITCH_WINDOW_STORAGE_KEY
        ]);

    const tabProvider = providerFromVolumeTabUrl(tab?.url);
    let provider = null;
    let expectedWindowId = null;

    if (
        tabProvider === "twitch" &&
        state.rightMode === "twitch" &&
        tab?.windowId === state[TWITCH_WINDOW_STORAGE_KEY]
    ) {
        provider = "twitch";
        expectedWindowId = state[TWITCH_WINDOW_STORAGE_KEY];
    } else if (PROVIDERS[state.leftMode]) {
        provider = state.leftMode;
        expectedWindowId = state.providerWindows?.[provider];
    } else if (tabProvider && tabProvider !== "twitch") {
        provider = tabProvider;
        expectedWindowId = state.providerWindows?.[provider];
    }

    if (!provider || !Number.isInteger(expectedWindowId)) {
        return;
    }

    if (
        provider === "twitch" &&
        await getTwitchSetting("streamShellTwitchAutoMute", true)
    ) {
        const session = await getVolumeCaptureSession();
        if (session?.provider === "twitch") {
            await stopVolumeCapture();
        }
        return;
    }

    let targetTab =
        tab;

    if (
        !targetTab?.id ||
        (
            Number.isInteger(expectedWindowId) &&
            targetTab.windowId !== expectedWindowId
        )
    ) {
        try {
            const tabs =
                await chrome.tabs.query({
                    active:
                        true,
                    windowId:
                        expectedWindowId
                });

            targetTab =
                tabs[0] || null;
        } catch {
            targetTab =
                null;
        }
    }

    if (!targetTab?.id) {
        return;
    }

    const activeProvider =
        providerFromVolumeTabUrl(
            targetTab.url
        );

    if (
        activeProvider &&
        activeProvider !== provider
    ) {
        return;
    }

    await startVolumeCapture(
        targetTab,
        provider
    );
}


chrome.commands.onCommand.addListener(
    (command, tab) => {
        if (
            command !== VOLUME_CAPTURE_COMMAND
        ) {
            return;
        }

        toggleVolumeCaptureFromCommand(tab)
            .catch(
                error => {
                    console.error(
                        "Stream Shell volume command failed:",
                        error
                    );
                }
            );
    }
);


chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (
            areaName !== "local"
        ) {
            return;
        }

        for (
            const provider
            of volumeCaptureProviders()
        ) {
            const gainKey = volumeCaptureStorageKey(provider);
            const profileKey = volumeCaptureProfileKey(provider);

            if (Object.prototype.hasOwnProperty.call(changes, gainKey)) {
                updateActiveVolumeCaptureGain(
                    provider,
                    changes[gainKey].newValue
                ).catch(() => {});
            }

            if (Object.prototype.hasOwnProperty.call(changes, profileKey)) {
                updateActiveVolumeCaptureProfile(
                    provider,
                    changes[profileKey].newValue
                ).catch(() => {});
            }
        }
    }
);


chrome.tabs.onRemoved.addListener(
    tabId => {
        getVolumeCaptureSession()
            .then(
                session => {
                    if (
                        session?.tabId === tabId
                    ) {
                        return stopVolumeCapture();
                    }
                }
            )
            .catch(() => {});
    }
);


chrome.tabCapture.onStatusChanged.addListener(
    info => {
        if (
            info.status !== "stopped" &&
            info.status !== "error"
        ) {
            return;
        }

        getVolumeCaptureSession()
            .then(
                async session => {
                    if (
                        session?.tabId !== info.tabId
                    ) {
                        return;
                    }

                    if (session.fullscreenSuspended === true) {
                        return;
                    }

                    await setVolumeCaptureSession(null);
                    titlebarVolumeActive =
                        false;

                    if (!shuttingDown) {
                        await broadcastState();
                    }
                }
            )
            .catch(() => {});
    }
);


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message?.type !== "volume-capture-ended" ||
            message?.source !== "stream-shell-volume-offscreen"
        ) {
            return;
        }

        getVolumeCaptureSession()
            .then(
                async session => {
                    if (
                        !session ||
                        session.tabId !== message.tabId
                    ) {
                        return;
                    }

                    if (session.fullscreenSuspended === true) {
                        return;
                    }

                    await setVolumeCaptureSession(null);
                    titlebarVolumeActive =
                        false;

                    if (!shuttingDown) {
                        await broadcastState();
                    }
                }
            )
            .catch(() => {});
    }
);
async function fetchCrunchyrollSkipEvents(
    episodeId
) {
    const id = String(episodeId || "")
        .trim()
        .toUpperCase();

    if (!/^[A-Z0-9]+$/.test(id)) {
        return null;
    }

    try {
        const response = await fetch(
            `https://static.crunchyroll.com/skip-events/production/${encodeURIComponent(id)}.json`,
            {
                cache: "force-cache",
                credentials: "omit"
            }
        );

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();

        if (!payload || typeof payload !== "object") {
            return null;
        }

        const normalized = {};

        for (const kind of ["recap", "intro", "credits", "preview"]) {
            const start = Number(payload[kind]?.start);
            const end = Number(payload[kind]?.end);

            if (
                Number.isFinite(start) &&
                Number.isFinite(end) &&
                end > start
            ) {
                normalized[kind] = {
                    start,
                    end
                };
            }
        }

        return normalized;
    } catch {
        return null;
    }
}
/*
 * ============================================================
 * SLEEP TIMER
 * ============================================================
 * One global timer targets the selected provider tab. Fixed-duration
 * timers use chrome.alarms so they survive service-worker suspension;
 * end-of-video mode is armed inside the provider content script.
 */

const SLEEP_TIMER_SESSION_KEY = "streamShellSleepTimerSession";
const SLEEP_TIMER_ALARM = "stream-shell-sleep-timer";

function normalizeSleepTimerMode(value) {
    const mode = String(value || "off");
    return ["off", "30", "60", "90", "end"].includes(mode)
        ? mode
        : "off";
}

function normalizeSleepTimerAction(value) {
    return value === "dashboard" ? "dashboard" : "pause";
}

async function getSleepTimerSession() {
    try {
        const stored = await chrome.storage.session.get(SLEEP_TIMER_SESSION_KEY);
        const session = stored[SLEEP_TIMER_SESSION_KEY];
        return session && PROVIDERS[session.provider] && Number.isInteger(session.tabId)
            ? session
            : null;
    } catch {
        return null;
    }
}

async function setSleepTimerSession(session) {
    try {
        if (session) {
            await chrome.storage.session.set({ [SLEEP_TIMER_SESSION_KEY]: session });
        } else {
            await chrome.storage.session.remove(SLEEP_TIMER_SESSION_KEY);
        }
    } catch {}
}

async function broadcastSleepTimerState(session = null) {
    try {
        await chrome.runtime.sendMessage({
            type: "sleep-timer-state",
            session
        });
    } catch {}
}

async function getProviderActiveTab(provider) {
    const windows = await getProviderWindows();
    const windowId = windows?.[provider];
    if (!Number.isInteger(windowId)) return null;

    try {
        const tabs = await chrome.tabs.query({ active: true, windowId });
        return tabs[0] || null;
    } catch {
        return null;
    }
}

async function disarmSleepTimerContent(session) {
    if (!session?.tabId || session.mode !== "end") return;
    try {
        await chrome.tabs.sendMessage(session.tabId, {
            type: "stream-shell-sleep-arm",
            armed: false
        });
    } catch {}
}

async function clearSleepTimer(broadcast = true) {
    const session = await getSleepTimerSession();
    try { await chrome.alarms.clear(SLEEP_TIMER_ALARM); } catch {}
    await disarmSleepTimerContent(session);
    await setSleepTimerSession(null);
    if (broadcast) await broadcastSleepTimerState(null);
}

async function executeSleepTimer(session) {
    if (!session) return;

    try {
        await chrome.tabs.sendMessage(session.tabId, {
            type: "stream-shell-sleep-pause"
        });
    } catch {}

    await clearSleepTimer(false);

    if (session.action === "dashboard" && !shuttingDown) {
        try { await showDashboard(); } catch {}
    }

    await broadcastSleepTimerState(null);
}

async function configureSleepTimer(provider, mode, action) {
    const normalizedMode = normalizeSleepTimerMode(mode);
    const normalizedAction = normalizeSleepTimerAction(action);

    await clearSleepTimer(false);

    if (normalizedMode === "off") {
        await broadcastSleepTimerState(null);
        return null;
    }

    const tab = await getProviderActiveTab(provider);
    if (!tab?.id) {
        await broadcastSleepTimerState(null);
        return null;
    }

    const startedAt = Date.now();
    const minutes = Number(normalizedMode);
    const session = {
        provider,
        tabId: tab.id,
        mode: normalizedMode,
        action: normalizedAction,
        startedAt,
        endsAt: Number.isFinite(minutes)
            ? startedAt + minutes * 60_000
            : null
    };

    await setSleepTimerSession(session);

    if (normalizedMode === "end") {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                type: "stream-shell-sleep-arm",
                armed: true
            });
        } catch {}
    } else {
        chrome.alarms.create(SLEEP_TIMER_ALARM, { when: session.endsAt });
    }

    await broadcastSleepTimerState(session);
    return session;
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== SLEEP_TIMER_ALARM) return;
    getSleepTimerSession()
        .then(executeSleepTimer)
        .catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
    getSleepTimerSession().then(session => {
        if (session?.tabId === tabId) return clearSleepTimer();
    }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "sleep-timer-get") {
        getSleepTimerSession()
            .then(session => sendResponse({ ok: true, session }))
            .catch(() => sendResponse({ ok: false, session: null }));
        return true;
    }

    if (message?.type === "sleep-timer-content-ready") {
        getSleepTimerSession()
            .then(session => sendResponse({
                ok: true,
                armed: Boolean(
                    session &&
                    session.mode === "end" &&
                    session.tabId === sender?.tab?.id
                )
            }))
            .catch(() => sendResponse({ ok: false, armed: false }));
        return true;
    }

    if (message?.type === "sleep-timer-set") {
        configureSleepTimer(
            message.provider,
            message.mode,
            message.action
        )
            .then(session => sendResponse({ ok: true, session }))
            .catch(error => sendResponse({
                ok: false,
                error: error?.message || String(error)
            }));
        return true;
    }

    if (message?.type === "sleep-timer-action") {
        getSleepTimerSession().then(async session => {
            if (!session) {
                sendResponse({ ok: true, session: null });
                return;
            }

            const updated = {
                ...session,
                action: normalizeSleepTimerAction(message.action)
            };
            await setSleepTimerSession(updated);
            await broadcastSleepTimerState(updated);
            sendResponse({ ok: true, session: updated });
        }).catch(error => sendResponse({
            ok: false,
            error: error?.message || String(error)
        }));
        return true;
    }

    if (message?.type === "sleep-timer-ended") {
        getSleepTimerSession().then(async session => {
            if (
                session &&
                session.mode === "end" &&
                session.tabId === sender?.tab?.id
            ) {
                await executeSleepTimer(session);
            }
        }).catch(() => {});
    }
});
async function killStreamShell() {
    if (shuttingDown) return;

    await stopVolumeCapture(false);
    shuttingDown = true;

    providerCreationLocks.clear();
    landingCreationLock = null;
    dashboardCreationLock = null;
    stopTitlebarNative();

    /* Keep the logical A-D definition but close all four physical Twitch
     * windows concurrently. */
    await closeTwitchWorkspaceV2Windows(true).catch(() => {});

    const stored = await chrome.storage.local.get([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        TWITCH_SPLIT_LAB_STORAGE_KEY
    ]);

    const providerWindows = stored.providerWindows || {};

    await chrome.storage.local.remove([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        TWITCH_SPLIT_LAB_STORAGE_KEY,
        "leftMode",
        "rightMode"
    ]);

    const splitLabWindowIds = Array.isArray(stored[TWITCH_SPLIT_LAB_STORAGE_KEY]?.windowIds)
        ? stored[TWITCH_SPLIT_LAB_STORAGE_KEY].windowIds
        : [];

    const windowIds = new Set([
        ...Object.values(providerWindows),
        stored.landingWindowId,
        stored.dashboardWindowId,
        stored[TWITCH_WINDOW_STORAGE_KEY],
        stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY],
        ...splitLabWindowIds
    ].filter(Number.isInteger));

    /* Once shuttingDown is true all window removal listeners are inert, so there
     * is no reason to serialize independent Opera close round-trips. */
    await Promise.allSettled(
        [...windowIds].map(windowId => safelyRemoveWindow(windowId))
    );

    /* Stream Shell does not own Discord's lifetime. */
    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
}

function wait(
    milliseconds
) {
    return new Promise(
        resolve => {
            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


async function navigateSubscriptionTab(
    tabId,
    url,
    timeoutMs = 14000
) {
    return new Promise(
        async (
            resolve,
            reject
        ) => {
            let finished =
                false;


            const cleanup =
                () => {
                    chrome.tabs.onUpdated.removeListener(
                        onUpdated
                    );

                    clearTimeout(
                        timeout
                    );
                };


            const finish =
                error => {
                    if (
                        finished
                    ) {
                        return;
                    }


                    finished =
                        true;

                    cleanup();


                    if (
                        error
                    ) {
                        reject(
                            error
                        );
                    } else {
                        resolve();
                    }
                };


            const onUpdated =
                (
                    updatedTabId,
                    changeInfo
                ) => {
                    if (
                        updatedTabId ===
                            tabId &&
                        changeInfo.status ===
                            "complete"
                    ) {
                        finish();
                    }
                };


            const timeout =
                setTimeout(
                    () => {
                        finish(
                            new Error(
                                "Account page timed out."
                            )
                        );
                    },
                    timeoutMs
                );


            chrome.tabs.onUpdated.addListener(
                onUpdated
            );


            try {
                await chrome.tabs.update(
                    tabId,
                    {
                        url,
                        active:
                            true
                    }
                );
            } catch (error) {
                finish(
                    error
                );
            }
        }
    );
}


async function scrapeSubscriptionTab(
    tabId,
    provider
) {
    let lastError =
        null;


    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        if (
            attempt > 0
        ) {
            await wait(
                650
            );
        }


        try {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider
                    }
                );


            if (
                response?.ok &&
                response.result?.pageReady
            ) {
                const result =
                    response.result;


                if (
                    result.status !==
                        "unknown" ||
                    attempt ===
                        4
                ) {
                    return {
                        status:
                            result.status ||
                            "unknown",

                        renewal:
                            result.renewal ||
                            null,

                        dateKind:
                            result.dateKind ||
                            null,

                        billingSource:
                            result.billingSource ||
                            null,

                        checkedAt:
                            Date.now()
                    };
                }


                lastError =
                    new Error(
                        "Account data has not rendered yet."
                    );

                continue;
            }


            lastError =
                new Error(
                    response?.error ||
                    "Account page is not ready."
                );
        } catch (error) {
            lastError =
                error;
        }
    }


    throw (
        lastError ||
        new Error(
            "Subscription scrape failed."
        )
    );
}


async function setSubscriptionSyncWindowInteractive(windowId) {
    try {
        await chrome.windows.update(
            windowId,
            {
                state: "normal",
                focused: true
            }
        );

        await chrome.windows.update(
            windowId,
            {
                left: 480,
                top: 120,
                width: 960,
                height: 780,
                focused: true
            }
        );
    } catch {
    }
}


async function minimizeSubscriptionSyncWindow(windowId) {
    try {
        await chrome.windows.update(
            windowId,
            {
                state: "minimized"
            }
        );
    } catch {
    }
}


async function waitForPrimeVerification(
    windowId,
    tabId,
    initialResult,
    timeoutMs = 120000
) {
    await setSubscriptionSyncWindowInteractive(
        windowId
    );

    const deadline =
        Date.now() + timeoutMs;

    let lastResult =
        initialResult;

    let verificationSeen =
        ["verify", "signin"].includes(
            initialResult?.status
        );

    let returnedToPrimeCentral =
        false;

    const parseAmazonUrl =
        url => {
            try {
                const parsed =
                    new URL(url);

                const isAmazon =
                    parsed.hostname ===
                        "amazon.de" ||
                    parsed.hostname.endsWith(
                        ".amazon.de"
                    );

                const route =
                    `${parsed.pathname} ${parsed.search} ${parsed.hash}`
                        .toLowerCase();

                return {
                    isAmazon,
                    isVerification:
                        isAmazon &&
                        /(?:\/ap\/signin|\/ap\/cvf|signin|auth|verification|verify|cvf)/i.test(
                            route
                        ),
                    isPrimeCentral:
                        isAmazon &&
                        /\/gp\/primecentral/i.test(
                            parsed.pathname
                        )
                };
            } catch {
                return {
                    isAmazon: false,
                    isVerification: false,
                    isPrimeCentral: false
                };
            }
        };

    const scrapePrime =
        async () => {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider:
                            "prime"
                    }
                );

            if (
                !response?.ok ||
                !response.result?.pageReady
            ) {
                return null;
            }

            const result =
                response.result;

            return {
                status:
                    result.status ||
                    "unknown",

                renewal:
                    result.renewal ||
                    null,

                dateKind:
                    result.dateKind ||
                    null,

                billingSource:
                    result.billingSource ||
                    null,

                checkedAt:
                    Date.now()
            };
        };

    try {
        while (
            Date.now() < deadline
        ) {
            await wait(
                900
            );

            let tab =
                null;

            try {
                tab =
                    await chrome.tabs.get(
                        tabId
                    );
            } catch {
            }

            const current =
                parseAmazonUrl(
                    tab?.url || ""
                );

            if (
                current.isVerification
            ) {
                verificationSeen =
                    true;
            }

            try {
                const scraped =
                    await scrapePrime();

                if (
                    scraped
                ) {
                    lastResult =
                        scraped;

                    if (
                        ["verify", "signin"].includes(
                            scraped.status
                        )
                    ) {
                        verificationSeen =
                            true;
                    }

                    if (
                        ![
                            "verify",
                            "signin",
                            "unknown"
                        ].includes(
                            scraped.status
                        )
                    ) {
                        return scraped;
                    }
                }
            } catch {
                /* Amazon may be navigating while verification completes. */
            }

            /*
             * Do NOT keep reloading Prime Central while the user is on the
             * challenge. Once we have actually seen an auth step and Amazon
             * has returned to a normal page, send the original sync tab back
             * to Prime Central exactly once and scrape the membership page.
             */
            if (
                verificationSeen &&
                current.isAmazon &&
                !current.isVerification &&
                !current.isPrimeCentral &&
                !returnedToPrimeCentral
            ) {
                returnedToPrimeCentral =
                    true;

                try {
                    await navigateSubscriptionTab(
                        tabId,
                        PRIME_CENTRAL_URL,
                        18000
                    );

                    await wait(
                        1400
                    );

                    const scraped =
                        await scrapePrime();

                    if (
                        scraped
                    ) {
                        lastResult =
                            scraped;

                        if (
                            ![
                                "verify",
                                "signin",
                                "unknown"
                            ].includes(
                                scraped.status
                            )
                        ) {
                            return scraped;
                        }

                        if (
                            ["verify", "signin"].includes(
                                scraped.status
                            )
                        ) {
                            /* Amazon asked again; keep the window interactive. */
                            returnedToPrimeCentral =
                                false;
                            verificationSeen =
                                true;
                        }
                    }
                } catch {
                    returnedToPrimeCentral =
                        false;
                }
            }
        }

        /*
         * A real auth challenge should remain VERIFY if it was never
         * completed. A merely unrecognised Prime page stays UNKNOWN instead
         * of falsely claiming that the account needs verification.
         */
        if (
            verificationSeen
        ) {
            return {
                status:
                    "verify",

                renewal:
                    null,

                dateKind:
                    null,

                billingSource:
                    null,

                checkedAt:
                    Date.now()
            };
        }

        return {
            status:
                lastResult?.status ||
                "unknown",

            renewal:
                lastResult?.renewal ||
                null,

            dateKind:
                lastResult?.dateKind ||
                null,

            billingSource:
                lastResult?.billingSource ||
                null,

            checkedAt:
                Date.now()
        };
    } finally {
        await minimizeSubscriptionSyncWindow(
            windowId
        );
    }
}


async function scrapeGooglePlaySubscriptionsTab(tabId) {
    let lastError =
        null;

    for (
        let attempt = 0;
        attempt < 6;
        attempt += 1
    ) {
        if (
            attempt > 0
        ) {
            await wait(
                700
            );
        }

        try {
            const response =
                await chrome.tabs.sendMessage(
                    tabId,
                    {
                        type:
                            "stream-shell-scrape-subscription",

                        provider:
                            "googleplay"
                    }
                );

            if (
                response?.ok &&
                response.result?.pageReady
            ) {
                return response.result;
            }

            lastError =
                new Error(
                    response?.error ||
                    "Google Play subscriptions page is not ready."
                );
        } catch (error) {
            lastError =
                error;
        }
    }

    throw (
        lastError ||
        new Error(
            "Google Play subscription scrape failed."
        )
    );
}


function mergeGooglePlaySubscriptionData(
    items,
    playResult
) {
    const playItems =
        playResult?.items ||
        {};

    const youtube =
        playItems.youtube;

    if (
        youtube
    ) {
        const current =
            items.youtube ||
            {};

        /*
         * Google Play's subscriptions page lists many cards together.
         * Dates extracted from flattened page text can therefore belong to
         * a neighbouring subscription (for example ChatGPT). Use Google Play
         * only to confirm the billing source/status; keep a renewal date only
         * when YouTube itself supplied it.
         */
        items.youtube = {
            ...current,

            status:
                current.status &&
                current.status !== "unknown" &&
                current.status !== "signin"
                    ? current.status
                    : youtube.status ||
                      current.status ||
                      "active",

            renewal:
                current.renewal ||
                null,

            dateKind:
                current.dateKind ||
                null,

            billingSource:
                "Google Play",

            checkedAt:
                Date.now()
        };
    }

    const discord =
        playItems.discord;

    if (
        discord
    ) {
        /*
         * For Discord the Play page is used only as proof that Nitro is billed
         * through Google Play. Do not display a Play-page date because nearby
         * subscriptions (notably Play Pass) can be mistaken for Nitro.
         */
        items.discord = {
            status:
                discord.status ||
                "active",

            renewal:
                null,

            dateKind:
                null,

            billingSource:
                "Google Play",

            checkedAt:
                Date.now()
        };
    }

    const crunchyroll =
        playItems.crunchyroll;

    if (
        crunchyroll
    ) {
        const current =
            items.crunchyroll ||
            {};

        /*
         * Crunchyroll can be billed through Google Play while its own account
         * page still owns the subscription date/status metadata. Use the Play
         * page to identify the billing source, but never replace a date supplied
         * by Crunchyroll with a date inferred from neighbouring Play cards.
         */
        items.crunchyroll = {
            ...current,

            status:
                current.status &&
                current.status !== "unknown" &&
                current.status !== "signin"
                    ? current.status
                    : crunchyroll.status ||
                      current.status ||
                      "active",

            renewal:
                current.renewal ||
                null,

            dateKind:
                current.dateKind ||
                null,

            billingSource:
                "Google Play",

            checkedAt:
                Date.now()
        };
    }
}


async function createSubscriptionSyncWindow() {
    const profile =
        await getStreamShellDisplayProfile()
            .catch(() => null);

    if (
        profile?.mode ===
            "compact"
    ) {
        /*
         * On the 200%-scaled laptop, Opera can heavily throttle a newly
         * created minimized account window before its content scripts have a
         * chance to answer. Keep the Compact sync renderer alive as a small,
         * unfocused popup behind the full-surface shell. It is removed again
         * in _syncSubscriptions()' finally block and only becomes interactive
         * if Prime explicitly requires verification.
         */
        const width =
            Math.max(
                420,
                Math.min(
                    720,
                    LEFT.width - 80
                )
            );

        const height =
            Math.max(
                360,
                Math.min(
                    620,
                    LEFT.height - 100
                )
            );

        return chrome.windows.create({
            type:
                "popup",

            state:
                "normal",

            focused:
                false,

            left:
                LEFT.left +
                Math.max(
                    20,
                    Math.floor(
                        (LEFT.width - width) / 2
                    )
                ),

            top:
                LEFT.top +
                Math.max(
                    40,
                    Math.floor(
                        (LEFT.height - height) / 2
                    )
                ),

            width,
            height,

            url:
                "about:blank"
        });
    }

    try {
        return await chrome.windows.create({
            type:
                "normal",

            state:
                "minimized",

            focused:
                false,

            url:
                "about:blank"
        });
    } catch {
        const syncWindow =
            await chrome.windows.create({
                type:
                    "normal",

                focused:
                    false,

                url:
                    "about:blank"
            });

        if (
            syncWindow?.id
        ) {
            try {
                await chrome.windows.update(
                    syncWindow.id,
                    {
                        state:
                            "minimized"
                    }
                );
            } catch {
            }
        }

        return syncWindow;
    }
}


async function _syncSubscriptions() {
    let syncWindowId =
        null;


    const items =
        {};


    try {
        const syncWindow =
            await createSubscriptionSyncWindow();


        if (
            !syncWindow?.id
        ) {
            throw new Error(
                "Subscription sync window could not be created."
            );
        }


        syncWindowId =
            syncWindow.id;


        const tabs =
            await chrome.tabs.query({
                windowId:
                    syncWindowId
            });


        const tabId =
            tabs[0]?.id;


        if (
            !Number.isInteger(
                tabId
            )
        ) {
            throw new Error(
                "Subscription sync tab could not be created."
            );
        }


        for (
            const provider
            of SUBSCRIPTION_PROVIDERS
        ) {
            try {
                await navigateSubscriptionTab(
                    tabId,
                    provider.url
                );


                await wait(
                    1100
                );


                let result =
                    await scrapeSubscriptionTab(
                        tabId,
                        provider.id
                    );


                if (
                    provider.id ===
                        "prime" &&
                    [
                        "verify",
                        "signin",
                        "unknown"
                    ].includes(
                        result.status
                    )
                ) {
                    result =
                        await waitForPrimeVerification(
                            syncWindowId,
                            tabId,
                            result
                        );
                }


                items[provider.id] =
                    result;
            } catch (error) {
                console.warn(
                    `Subscription sync failed for ${provider.id}:`,
                    error
                );


                items[provider.id] = {
                    status:
                        "unknown",

                    renewal:
                        null,

                    dateKind:
                        null,

                    billingSource:
                        null,

                    checkedAt:
                        Date.now()
                };
            }
        }


        try {
            await navigateSubscriptionTab(
                tabId,
                GOOGLE_PLAY_SUBSCRIPTIONS_URL,
                18000
            );


            await wait(
                1300
            );


            const playResult =
                await scrapeGooglePlaySubscriptionsTab(
                    tabId
                );


            mergeGooglePlaySubscriptionData(
                items,
                playResult
            );
        } catch (error) {
            console.warn(
                "Google Play subscription sync failed:",
                error
            );
        }


        if (
            !items.discord
        ) {
            items.discord = {
                status:
                    "unknown",

                renewal:
                    null,

                dateKind:
                    null,

                billingSource:
                    null,

                checkedAt:
                    Date.now()
            };
        }
    } finally {
        if (
            Number.isInteger(
                syncWindowId
            )
        ) {
            await safelyRemoveWindow(
                syncWindowId
            );
        }
    }


    const state = {
        items,
        updatedAt:
            Date.now()
    };


    await chrome.storage.local.set({
        [SUBSCRIPTION_STORAGE_KEY]:
            state
    });


    return state;
}


async function syncSubscriptions() {
    if (
        subscriptionSyncLock
    ) {
        return subscriptionSyncLock;
    }


    subscriptionSyncLock =
        _syncSubscriptions()
            .finally(
                () => {
                    subscriptionSyncLock =
                        null;
                }
            );


    return subscriptionSyncLock;
}


async function isManagedProviderWindow(
    windowId
) {
    if (
        shuttingDown
    ) {
        return false;
    }

    const windows =
        await getProviderWindows();

    return Object.values(
        windows
    ).includes(
        windowId
    );
}


function isLandingSender(
    sender
) {
    return (
        sender?.url ===
            LANDING_URL ||

        sender?.tab?.url ===
            LANDING_URL
    );
}


function isDashboardSender(
    sender
) {
    return (
        sender?.url ===
            DASHBOARD_URL ||

        sender?.tab?.url ===
            DASHBOARD_URL
    );
}


function isShellHomeUiSender(
    sender
) {
    return isLandingSender(sender) || isDashboardSender(sender);
}


function isTwitchWorkspaceSlotUiSender(sender, expectedSlotId = null) {
    const url = String(sender?.url || sender?.tab?.url || "");
    if (!url.startsWith(TWITCH_WORKSPACE_SLOT_URL)) return false;

    if (!expectedSlotId) return true;
    try {
        const parsed = new URL(url);
        return String(parsed.searchParams.get("slot") || "").toLowerCase() ===
            String(expectedSlotId || "").toLowerCase();
    } catch {
        return false;
    }
}


function isPopupSender(
    sender
) {
    return (
        sender?.url ===
            POPUP_URL
    );
}


function applyYouTubeQualityInMainWorld(
    preferred
) {
    const player =
        document.getElementById(
            "movie_player"
        );


    if (
        !player
    ) {
        return {
            ok:
                false
        };
    }


    const order = [
        "highres",
        "hd2880",
        "hd2160",
        "hd1440",
        "hd1080",
        "hd720",
        "large",
        "medium",
        "small",
        "tiny"
    ];


    let available =
        [];


    try {
        available =
            player.getAvailableQualityLevels?.() ||
            [];
    } catch {
    }


    if (
        !available.length
    ) {
        return {
            ok:
                false
        };
    }


    let chosen =
        String(
            preferred ||
            "hd1080"
        );


    if (
        chosen ===
            "highest"
    ) {
        chosen =
            order.find(
                quality =>
                    available.includes(
                        quality
                    )
            ) ||
            available[0];

    } else if (
        chosen !==
            "auto"
    ) {
        const targetIndex =
            order.indexOf(
                chosen
            );


        if (
            targetIndex >= 0
        ) {
            chosen =
                order
                    .slice(
                        targetIndex
                    )
                    .find(
                        quality =>
                            available.includes(
                                quality
                            )
                    ) ||
                order.find(
                    quality =>
                        available.includes(
                            quality
                        )
                ) ||
                available[0];
        }
    }


    try {
        if (
            typeof player.setPlaybackQualityRange ===
                "function"
        ) {
            player.setPlaybackQualityRange(
                chosen,
                chosen
            );
        }


        if (
            chosen !==
                "auto" &&
            typeof player.setPlaybackQuality ===
                "function"
        ) {
            player.setPlaybackQuality(
                chosen
            );
        }


        return {
            ok:
                true,

            chosen
        };

    } catch {
        return {
            ok:
                false
        };
    }
}



async function collectProviderDiagnosticsForDashboard(
    providerWindows,
    browserWindows,
    options = {}
) {
    const activeProvider = PROVIDERS[options.activeProvider]
        ? options.activeProvider
        : null;
    const full = options.full === true;
    const byWindowId = new Map(
        browserWindows
            .filter(window => Number.isInteger(window.id))
            .map(window => [window.id, window])
    );
    const result = {};

    for (const provider of Object.keys(PROVIDERS)) {
        const windowId = Number.isInteger(providerWindows?.[provider])
            ? providerWindows[provider]
            : null;
        const browserWindow = windowId !== null ? byWindowId.get(windowId) || null : null;
        const entry = {
            known: windowId !== null,
            alive: Boolean(browserWindow),
            windowState: browserWindow?.state || null,
            focused: browserWindow?.focused === true,
            bounds: browserWindow ? {
                left: browserWindow.left ?? null,
                top: browserWindow.top ?? null,
                width: browserWindow.width ?? null,
                height: browserWindow.height ?? null
            } : null,
            tab: null,
            page: null,
            liveProbe: false
        };

        if (browserWindow && windowId !== null) {
            try {
                const tabs = await chrome.tabs.query({ windowId, active: true });
                const tab = tabs[0] || null;
                if (tab) {
                    entry.tab = {
                        id: Number.isInteger(tab.id) ? tab.id : null,
                        status: tab.status || null,
                        audible: tab.audible === true,
                        muted: tab.mutedInfo?.muted === true,
                        discarded: tab.discarded === true
                    };

                    const shouldProbePage =
                        Number.isInteger(tab.id) &&
                        (full || provider === activeProvider);

                    if (shouldProbePage) {
                        entry.liveProbe = true;
                        try {
                            entry.page = await chrome.tabs.sendMessage(tab.id, {
                                type: "stream-shell-provider-diagnostics"
                            });
                        } catch {
                            entry.page = {
                                ok: false,
                                error: "Content diagnostics unavailable"
                            };
                        }
                    }
                }
            } catch {
            }
        }

        result[provider] = entry;
    }

    return result;
}
chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {
        if (
            message.type ===
                "kill-stream-shell" ||

            message.type ===
                "dashboard-kill-stream-shell"
        ) {
            if (
                message.type ===
                    "dashboard-kill-stream-shell" &&

                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            killStreamShell()
                .catch(
                    error => {
                        console.error(
                            "Kill switch failed:",
                            error
                        );
                    }
                );

            return;
        }


        if (
            message.type ===
                "popup-open-shell" ||
            message.type ===
                "popup-open-direct" ||
            message.type ===
                "popup-save-direct-link"
        ) {
            if (
                !isPopupSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid popup sender."
                });

                return;
            }


            if (
                message.type ===
                "popup-save-direct-link"
            ) {
                saveDirectLinkFromBrowser(
                    message.url,
                    message.title
                )
                    .then(
                        saved => {
                            sendResponse({
                                ok:
                                    Boolean(
                                        saved
                                    )
                            });
                        }
                    )
                    .catch(
                        error => {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    error.message
                            });
                        }
                    );

                return true;
            }


            shuttingDown =
                false;


            const opening =
                message.type ===
                    "popup-open-direct"
                    ? chrome.storage.local
                        .set({
                            streamShellPendingLandingPanel:
                                "direct"
                        })
                        .then(
                            () =>
                                openShellHome()
                        )
                    : openShellWarmLastProvider();


            opening
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
                "dashboard-settings-visibility"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            setTitlebarSettingsOpen(
                message.open === true
            )
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            ok:
                                false
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
                "provider-fullscreen-state"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.windowId)
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) {
                        sendResponse({ ok: false });
                        return;
                    }

                    const active = message.active === true;

                    if (active) {
                        titlebarFullscreenWindowId = sender.tab.windowId;
                        titlebarFullscreenActive = true;
                    } else if (
                        titlebarFullscreenWindowId === sender.tab.windowId
                    ) {
                        titlebarFullscreenWindowId = null;
                        titlebarFullscreenActive = false;
                    }

                    await syncConnectedTitlebarNative().catch(() => {});
                    sendResponse({ ok: true });
                })
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
                "provider-volume-fullscreen-bridge"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.id) ||
                !Number.isInteger(sender.tab.windowId) ||
                (
                    message.action !== "suspend" &&
                    message.action !== "resume"
                )
            ) {
                sendResponse({
                    ok: false,
                    suspended: false,
                    resumed: false
                });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(managed => {
                    if (!managed) {
                        sendResponse({
                            ok: false,
                            suspended: false,
                            resumed: false
                        });
                        return;
                    }

                    const operation =
                        message.action === "suspend"
                            ? suspendVolumeCaptureForFullscreen(sender.tab.id)
                            : resumeVolumeCaptureAfterFullscreen(sender.tab.id);

                    return operation.then(sendResponse);
                })
                .catch(error => {
                    sendResponse({
                        ok: false,
                        suspended: false,
                        resumed: false,
                        error: String(error?.message || error || "Fullscreen audio bridge failed.")
                    });
                });

            return true;
        }


        if (
            message.type ===
                "stream-shell-flight-event"
        ) {
            const event = message.event || {};
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.windowId) ||
                !PROVIDERS[event.provider]
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(managed => {
                    if (!managed) {
                        sendResponse({ ok: false });
                        return;
                    }

                    return recordFlightEvent({
                        source: "provider",
                        category: event.category,
                        action: event.action,
                        level: event.level,
                        provider: event.provider,
                        detail: event.detail
                    }).then(() => sendResponse({ ok: true }));
                })
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
                "dashboard-flight-event"
        ) {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }

            const event = message.event || {};
            recordFlightEvent({
                source: "dashboard",
                category: event.category,
                action: event.action,
                level: event.level,
                provider: event.provider,
                detail: event.detail
            })
                .then(() => sendResponse({ ok: true }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
                "dashboard-diagnostics-repair"
        ) {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }

            runStreamShellProviderRepair(
                message.provider,
                message.action
            )
                .then(sendResponse)
                .catch(error => sendResponse({
                    ok: false,
                    error: String(error?.message || error || "Repair failed.")
                }));

            return true;
        }


        if (
            message.type ===
                "dashboard-diagnostics"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            Promise.all([
                chrome.storage.local.get([
                    "activeProvider",
                    "leftMode",
                    "rightMode",
                    "providerWindows",
                    "landingWindowId",
                    "dashboardWindowId",
                    "streamShellLaunchSelfTest"
                ]),
                chrome.windows.getAll({
                    populate:
                        false
                }),
                getDiscordNativeStatus(),
                getVolumeCaptureSession(),
                getTitlebarVisibilityMode(),
                getFlightRecorderSnapshot(message.full === true ? null : 60),
                getStreamShellDisplayProfile()
            ])
                .then(
                    async ([
                        state,
                        browserWindows,
                        discord,
                        volumeSession,
                        titlebarVisibilityMode,
                        flightRecorder,
                        displayProfile
                    ]) => {
                        const aliveIds =
                            new Set(
                                browserWindows
                                    .map(window => window.id)
                                    .filter(Number.isInteger)
                            );

                        const providerWindowIds =
                            Object.values(
                                state.providerWindows ||
                                {}
                            )
                                .filter(Number.isInteger);

                        const fullDiagnostics = message.full === true;
                        const diagnosticsActiveProvider = PROVIDERS[state.activeProvider]
                            ? state.activeProvider
                            : (PROVIDERS[state.leftMode] ? state.leftMode : null);
                        const providerDiagnostics =
                            await collectProviderDiagnosticsForDashboard(
                                state.providerWindows || {},
                                browserWindows,
                                {
                                    activeProvider: diagnosticsActiveProvider,
                                    full: fullDiagnostics
                                }
                            );

                        const launchSelfTest =
                            state.streamShellLaunchSelfTest ||
                            null;

                        const twitchSplitLab =
                            await getTwitchSplitLabDiagnostics();

                        const twitchWorkspaceV2 =
                            await getTwitchWorkspaceV2Diagnostics();

                        let offscreenDocumentAlive = false;
                        try {
                            const contexts = await chrome.runtime.getContexts({
                                contextTypes: ["OFFSCREEN_DOCUMENT"]
                            });
                            offscreenDocumentAlive = contexts.length > 0;
                        } catch {
                        }

                        sendResponse({
                            ok: true,
                            diagnosticsMode: fullDiagnostics ? "full" : "panel",
                            activeProvider: state.activeProvider || null,
                            leftMode: state.leftMode || "landing",
                            rightMode: state.rightMode || "dashboard",
                            browserWindowsTotal: browserWindows.length,
                            providerWindowsKnown: providerWindowIds.length,
                            providerWindowsAlive: providerWindowIds.filter(id => aliveIds.has(id)).length,
                            providerWindows: providerDiagnostics,
                            launchSelfTest,
                            landingWindowAlive:
                                Number.isInteger(state.landingWindowId) &&
                                aliveIds.has(state.landingWindowId),
                            dashboardWindowAlive:
                                Number.isInteger(state.dashboardWindowId) &&
                                aliveIds.has(state.dashboardWindowId),
                            titlebarConnected: Boolean(titlebarPort),
                            titlebarProtocolReady: titlebarProtocolReady === true,
                            titlebarProtocolVersion: TITLEBAR_PROTOCOL_VERSION,
                            titlebarReconcileIntervalMs: TITLEBAR_RECONCILE_INTERVAL_MS,
                            titlebarNativeStatus: titlebarLastNativeStatus,
                            titlebarVisibilityMode: titlebarVisibilityMode || "unknown",
                            titlebarSettingsOpen: titlebarSettingsOpen === true,
                            titlebarVolumeActive: titlebarVolumeActive === true,
                            discord,
                            offscreenDocumentAlive,
                            flightRecorder,
                            displayProfile,
                            twitchSplitLab,
                            twitchWorkspaceV2,
                            audio:
                                volumeSession
                                    ? {
                                        active: true,
                                        provider: volumeSession.provider || null,
                                        percent: volumeSession.percent ?? null,
                                        profile: volumeSession.profile || null,
                                        tabId: Number.isInteger(volumeSession.tabId) ? volumeSession.tabId : null
                                    }
                                    : {
                                        active: false,
                                        provider: null,
                                        percent: null,
                                        profile: null,
                                        tabId: null
                                    }
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok: false,
                            error: error?.message || "Diagnostics failed."
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "provider-api-self-test-report"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !PROVIDERS[
                    message.provider
                ]
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (!managed) {
                            sendResponse({ ok: false });
                            return;
                        }

                        return updateProviderSelfTestReport(
                            message.provider,
                            message.report
                        )
                            .then(
                                ok => {
                                    sendResponse({ ok: ok === true });
                                }
                            );
                    }
                )
                .catch(
                    () => {
                        sendResponse({ ok: false });
                    }
                );

            return true;
        }


        if (
            shuttingDown
        ) {
            sendResponse({
                ok:
                    false,

                error:
                    "Stream Shell is shut down."
            });

            return;
        }


        if (
            message.type ===
            "provider-resource-state"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                )
            ) {
                sendResponse({
                    managed: false
                });

                return;
            }

            getProviderResourceWindowState(
                sender.tab.windowId
            )
                .then(sendResponse)
                .catch(
                    () => {
                        sendResponse({
                            managed: false
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "provider-now-playing-eligible"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                )
            ) {
                sendResponse({
                    eligible:
                        false
                });

                return;
            }


            Promise.all([
                isManagedProviderWindow(
                    sender.tab.windowId
                ),
                chrome.windows.get(
                    sender.tab.windowId
                )
            ])
                .then(
                    ([managed, window]) => {
                        sendResponse({
                            eligible:
                                Boolean(
                                    managed &&
                                    window?.state !==
                                        "minimized"
                                )
                        });
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            eligible:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "is-stream-shell-twitch-window"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ managed: false });
                return;
            }

            isStreamShellTwitchAutomationWindow(sender.tab.windowId)
                .then(managed => sendResponse({ managed }))
                .catch(() => sendResponse({ managed: false }));

            return true;
        }


        if (
            message.type ===
            "is-stream-shell-window"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    managed:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        sendResponse({
                            managed
                        });
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            managed:
                                false
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
                "crunchyroll-skip-events"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !/\.crunchyroll\.com\//i.test(
                    String(
                        sender.tab.url ||
                        ""
                    )
                )
            ) {
                sendResponse({
                    ok: false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    async managed => {
                        if (!managed) {
                            return {
                                ok: false
                            };
                        }

                        const events =
                            await fetchCrunchyrollSkipEvents(
                                message.episodeId
                            );

                        return {
                            ok: Boolean(events),
                            events: events || {}
                        };
                    }
                )
                .then(sendResponse)
                .catch(
                    () => sendResponse({
                        ok: false,
                        events: {}
                    })
                );

            return true;
        }


        if (
            message.type ===
                "youtube-set-quality"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.id
                ) ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !/\.youtube\.com\//i.test(
                    String(
                        sender.tab.url ||
                        ""
                    )
                )
            ) {
                sendResponse({
                    ok:
                        false
                });


                return;
            }


            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            return {
                                ok:
                                    false
                            };
                        }


                        return chrome.scripting.executeScript({
                            target: {
                                tabId:
                                    sender.tab.id
                            },

                            world:
                                "MAIN",

                            func:
                                applyYouTubeQualityInMainWorld,

                            args: [
                                String(
                                    message.preferred ||
                                    "hd1080"
                                )
                            ]
                        })
                            .then(
                                results =>
                                    results?.[0]?.result ||
                                    {
                                        ok:
                                            false
                                    }
                            );
                    }
                )
                .then(
                    result => {
                        sendResponse(
                            result ||
                            {
                                ok:
                                    false
                            }
                        );
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            ok:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "dashboard-switch-provider"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid dashboard sender."
                });

                return;
            }

            Promise.resolve()
                .then(
                    async () => {
                        const compact = streamShellDisplayProfileCache?.mode === "compact";
                        if (compact) {
                            const rightState = await chrome.storage.local.get("rightMode");
                            if (rightState.rightMode === "discord") {
                                await hideDiscordForDashboard();
                            }
                        } else {
                            await hideDiscordForDashboard();
                        }

                        await switchProvider(
                            message.provider
                        );
                    }
                )
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Dashboard provider switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "switch-provider"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    "Provider switch rejected."
                            });

                            return;
                        }

                        return switchProvider(
                            message.provider
                        )
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Provider switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "landing-show-twitch-workspace"
        ) {
            if (!isShellHomeUiSender(sender)) {
                sendResponse({ ok: false, error: "Invalid landing sender." });
                return;
            }

            showTwitchWorkspaceV2("workspace")
                .then(status => sendResponse({ ok: true, status }))
                .catch(error => {
                    console.error("Twitch workspace failed:", error);
                    sendResponse({ ok: false, error: error.message });
                });

            return true;
        }


        if (
            message.type ===
            "landing-show-twitch"
        ) {
            if (!isShellHomeUiSender(sender)) {
                sendResponse({ ok: false, error: "Invalid landing sender." });
                return;
            }

            const target = message.target === "drops" ? "drops" : "resume";
            showTwitch(target)
                .then(() => sendResponse({ ok: true }))
                .catch(error => {
                    console.error("Twitch utility failed:", error);
                    sendResponse({ ok: false, error: error.message });
                });

            return true;
        }


        if (
            message.type ===
            "get-stream-shell-twitch-workspace-context"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ managed: false });
                return;
            }

            getTwitchWorkspaceV2Context(sender.tab.windowId)
                .then(context => sendResponse(context))
                .catch(() => sendResponse({ managed: false }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-assign-slot"
        ) {
            const requestedSlotId = String(message.slotId || "").toLowerCase();
            if (
                isShellHomeUiSender(sender) ||
                isTwitchWorkspaceSlotUiSender(sender, requestedSlotId)
            ) {
                assignTwitchWorkspaceV2Slot(
                    requestedSlotId,
                    message.input,
                    message.kind,
                    true
                )
                    .then(() => sendResponse({ ok: true }))
                    .catch(error => sendResponse({ ok: false, error: error.message }));
                return true;
            }

            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return assignTwitchWorkspaceV2Slot(
                        String(message.slotId || "").toLowerCase(),
                        message.input,
                        message.kind,
                        true
                    );
                })
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-clear-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return clearTwitchWorkspaceV2Slot(String(message.slotId || "").toLowerCase());
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-set-muted"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return setTwitchWorkspaceV2SlotMuted(slotId, message.muted === true);
                })
                .then(muted => sendResponse({ ok: true, muted }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-set-raid-protection"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return setTwitchWorkspaceV2SlotRaidProtection(
                        slotId,
                        message.enabled === true
                    );
                })
                .then(enabled => sendResponse({ ok: true, enabled }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-reload-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return reloadTwitchWorkspaceV2Slot(slotId);
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-toggle-pane-fullscreen"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return toggleTwitchWorkspaceV2PaneFullscreen(slotId);
                })
                .then(result => sendResponse({ ok: true, ...result }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-focus-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
                    let record = await getTwitchWorkspaceV2Record();
                    const targetId = record?.slots?.[slotId]?.windowId;
                    if (!Number.isInteger(targetId)) return false;
                    if (record.selectedSlot !== slotId) {
                        record = { ...record, selectedSlot: slotId, updatedAt: Date.now() };
                        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
                    }
                    await chrome.windows.update(targetId, { focused: true }).catch(() => {});
                    raiseTwitchWorkspaceV2NativeCluster(slotId);
                    return true;
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-raise"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return raiseExistingTwitchWorkspaceV2(String(message.slotId || "").toLowerCase());
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-show"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return showTwitchWorkspaceV2("workspace");
                })
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-user-interaction"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            markTwitchUserInteraction(sender.tab)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "twitch-arm-raid-guard"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            armTwitchRaidGuard(sender.tab, message.sourceUrl || sender.tab.url)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "twitch-disarm-raid-guard"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            disarmTwitchRaidGuard(sender.tab)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "landing-show-discord"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }

            showDiscord()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Discord desktop failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "get-discord-status"
        ) {
            if (
                !isLandingSender(
                    sender
                ) &&
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    visible:
                        false
                });

                return;
            }


            syncDiscordVisibilityState()
                .then(
                    status => {
                        sendResponse(
                            status
                        );
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            ok:
                                false,

                            visible:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "show-discord"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false
                            });

                            return;
                        }

                        return showDiscord()
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "show-landing"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    "Landing switch rejected."
                            });

                            return;
                        }

                        return showLanding(
                            true
                        )
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Landing switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "sync-subscriptions"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }


            syncSubscriptions()
                .then(
                    state => {
                        sendResponse({
                            ok:
                                true,

                            state
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Subscription sync failed:",
                            error
                        );


                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "restore-home-layout"
        ) {
            if (
                !isLandingSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }

            openShellHome()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Home layout restore failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "show-dashboard"
        ) {
            showDashboard()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "dashboard-reload-left"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            reloadLeft()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "landing-resume-provider"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok: false,
                    error: "Invalid landing sender."
                });
                return;
            }

            resumeProviderFromContinue(
                message.provider,
                message.url,
                message.currentTime,
                message.identity
            )
                .then(
                    () => {
                        sendResponse({ ok: true });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok: false,
                            error: error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "open-direct-link"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });


                return;
            }


            openDirectLinkInBrowser(
                message.url
            )
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "get-state"
        ) {
            Promise.all([
                chrome.storage.local.get([
                    "activeProvider",
                    "leftMode",
                    "rightMode"
                ]),
                isLandingExposed(),
                getStreamShellDisplayProfile(),
                getTwitchWorkspaceV2Summary()
            ])
                .then(
                    ([
                        state,
                        landingExposed,
                        displayProfile,
                        twitchWorkspace
                    ]) => {
                        sendResponse({
                            activeProvider:
                                state.activeProvider ||
                                "netflix",

                            leftMode:
                                state.leftMode ||
                                "landing",

                            rightMode:
                                state.rightMode ||
                                "dashboard",

                            layoutProfile:
                                displayProfile?.mode || "wide",

                            displayProfileOverride:
                                displayProfile?.override || "auto",

                            displayTarget:
                                displayProfile?.targetDisplay?.referenceTarget || null,

                            twitchWorkspace,

                            landingExposed
                        });
                    }
                );

            return true;
        }
    }
);


function windowBounds(window) {
    if (
        !window ||
        !Number.isFinite(window.left) ||
        !Number.isFinite(window.top) ||
        !Number.isFinite(window.width) ||
        !Number.isFinite(window.height)
    ) {
        return null;
    }

    return {
        left:
            window.left,

        top:
            window.top,

        width:
            window.width,

        height:
            window.height
    };
}


function windowsOverlap(
    first,
    second
) {
    if (
        !first ||
        !second
    ) {
        return false;
    }

    return (
        first.left <
            second.left + second.width &&
        first.left + first.width >
            second.left &&
        first.top <
            second.top + second.height &&
        first.top + first.height >
            second.top
    );
}


async function getNativeForegroundBounds() {
    try {
        const response =
            await chrome.runtime.sendNativeMessage(
                DISCORD_NATIVE_HOST,
                {
                    action:
                        "foreground"
                }
            );

        if (
            !response?.ok ||
            !response?.hasWindow
        ) {
            return null;
        }

        return windowBounds(
            response
        );
    } catch {
        /*
         * Older helper builds do not know the foreground action yet.
         * In that case the caller safely treats external focus as
         * potentially covering Landing.
         */
        return null;
    }
}


async function isLandingExposed() {
    if (
        shuttingDown
    ) {
        return false;
    }

    const stored =
        await chrome.storage.local.get([
            "leftMode",
            "landingWindowId",
            "providerWindows"
        ]);

    if (
        !Number.isInteger(
            stored.landingWindowId
        )
    ) {
        return false;
    }

    let landingWindow;

    try {
        landingWindow =
            await chrome.windows.get(
                stored.landingWindowId
            );
    } catch {
        return false;
    }

    if (
        landingWindow.state ===
        "minimized"
    ) {
        return false;
    }

    const landingBounds =
        windowBounds(
            landingWindow
        );

    if (
        !landingBounds
    ) {
        return false;
    }

    let browserWindows =
        [];

    try {
        browserWindows =
            await chrome.windows.getAll();
    } catch {
    }

    const focusedBrowserWindow =
        browserWindows.find(
            window =>
                window.focused
        );

    /*
     * Landing itself is foreground: by definition it is exposed.
     */
    if (
        focusedBrowserWindow?.id ===
            landingWindow.id
    ) {
        return true;
    }

    /*
     * Any focused Opera window physically covering the left half wins. A
     * focused Dashboard on the right does not count.
     */
    if (
        focusedBrowserWindow &&
        windowsOverlap(
            landingBounds,
            windowBounds(
                focusedBrowserWindow
            )
        )
    ) {
        return false;
    }

    /*
     * leftMode is useful as a hint, but never trust it blindly: a provider
     * can be minimized/closed manually through Windows. Only suppress the
     * adaptive clock when the stored provider window really still exists in
     * normal state and overlaps Landing.
     */
    const leftMode =
        stored.leftMode ||
        "landing";

    const providerWindows =
        stored.providerWindows ||
        {};

    const activeProviderWindowId =
        providerWindows[
            leftMode
        ];

    if (
        Number.isInteger(
            activeProviderWindowId
        )
    ) {
        try {
            const providerWindow =
                await chrome.windows.get(
                    activeProviderWindowId
                );

            if (
                providerWindow.state !==
                    "minimized" &&
                windowsOverlap(
                    landingBounds,
                    windowBounds(
                        providerWindow
                    )
                )
            ) {
                return false;
            }
        } catch {
            /* Closed provider: Landing underneath is exposed again. */
        }
    }

    if (
        !focusedBrowserWindow
    ) {
        /*
         * Opera has lost focus, so the foreground belongs to another native
         * application. Discord on the right is fine; anything overlapping
         * Landing restores the normal Stream Shell brand.
         */
        const foregroundBounds =
            await getNativeForegroundBounds();

        if (
            foregroundBounds &&
            windowsOverlap(
                landingBounds,
                foregroundBounds
            )
        ) {
            return false;
        }

        /*
         * If the helper is unavailable we cannot prove Landing is exposed.
         */
        if (
            !foregroundBounds
        ) {
            return false;
        }
    }

    return true;
}



/*
 * ============================================================
 * RESOURCE GOVERNOR WINDOW STATE
 * ============================================================
 * Background-owned provider-window facts used by the in-page governor.
 * The content script owns workload policy; the service worker only reports
 * whether a managed provider window is minimized/focused/currently selected.
 */

async function getProviderResourceWindowState(windowId) {
    if (!Number.isInteger(windowId)) {
        return {
            managed: false,
            provider: null,
            windowId: null,
            windowState: null,
            minimized: false,
            focused: false,
            shellActive: false,
            activeProvider: null,
            leftMode: null
        };
    }

    const stored = await chrome.storage.local.get([
        "providerWindows",
        "activeProvider",
        "leftMode"
    ]);

    const providerWindows = stored.providerWindows || {};
    const entry = Object.entries(providerWindows)
        .find(([, providerWindowId]) => providerWindowId === windowId);
    const provider = entry?.[0] || null;

    if (!provider) {
        return {
            managed: false,
            provider: null,
            windowId,
            windowState: null,
            minimized: false,
            focused: false,
            shellActive: false,
            activeProvider: stored.activeProvider || null,
            leftMode: stored.leftMode || "landing"
        };
    }

    let window = null;
    try {
        window = await chrome.windows.get(windowId);
    } catch {
    }

    const leftMode = stored.leftMode || "landing";

    return {
        managed: Boolean(window),
        provider,
        windowId,
        windowState: window?.state || null,
        minimized: window?.state === "minimized",
        focused: window?.focused === true,
        shellActive: leftMode === provider,
        activeProvider: stored.activeProvider || null,
        leftMode
    };
}

async function sendProviderResourceWindowState(windowId) {
    const state = await getProviderResourceWindowState(windowId);
    if (!state.managed || !Number.isInteger(windowId)) return false;

    let tabs = [];
    try {
        tabs = await chrome.tabs.query({ windowId });
    } catch {
        return false;
    }

    await Promise.allSettled(
        tabs
            .filter(tab => Number.isInteger(tab.id))
            .map(tab => chrome.tabs.sendMessage(tab.id, {
                type: "stream-shell-resource-window-state",
                state
            }))
    );

    return true;
}

async function broadcastProviderResourceWindowStates() {
    if (shuttingDown) return;

    const providerWindows = await getProviderWindows();
    await Promise.allSettled(
        Object.values(providerWindows)
            .filter(Number.isInteger)
            .map(windowId => sendProviderResourceWindowState(windowId))
    );
}
async function reconcileCompactFocusedSurface(
    focusedWindowId
) {
    if (
        shuttingDown ||
        streamShellDisplayProfileCache?.mode !==
            "compact" ||
        !Number.isInteger(
            focusedWindowId
        ) ||
        focusedWindowId ===
            chrome.windows.WINDOW_ID_NONE
    ) {
        return false;
    }

    const state =
        await chrome.storage.local.get([
            "providerWindows",
            "dashboardWindowId",
            "activeProvider",
            "leftMode"
        ]);

    const providerWindows =
        state.providerWindows ||
        {};

    /*
     * Dashboard is a Compact Home surface. If Windows activates it while
     * a provider is still the intended surface, that is not a user navigation
     * request; restore the intended provider immediately instead of rewriting
     * leftMode to Dashboard.
     */
    if (
        focusedWindowId ===
            state.dashboardWindowId
    ) {
        const intendedProvider =
            PROVIDERS[state.leftMode]
                ? state.leftMode
                : null;

        const intendedWindowId =
            intendedProvider
                ? providerWindows[
                    intendedProvider
                ]
                : null;

        if (
            intendedProvider &&
            Number.isInteger(
                intendedWindowId
            )
        ) {
            try {
                await chrome.windows.get(
                    intendedWindowId
                );
                await restoreWindow(
                    intendedWindowId,
                    LEFT,
                    true
                );

                return true;
            } catch {
            }
        }

        if (
            state.leftMode !==
                "dashboard"
        ) {
            await chrome.storage.local.set({
                leftMode:
                    "dashboard"
            });
        }

        return false;
    }

    const focusedProviderEntry =
        Object.entries(
            providerWindows
        )
            .find(
                ([provider, windowId]) =>
                    PROVIDERS[provider] &&
                    windowId ===
                        focusedWindowId
            );

    if (
        !focusedProviderEntry
    ) {
        /* A normal Opera/browser window is not Stream Shell. Preserve intent. */
        return false;
    }

    const focusedProvider =
        focusedProviderEntry[0];

    if (
        state.leftMode !==
            focusedProvider ||
        state.activeProvider !==
            focusedProvider
    ) {
        await chrome.storage.local.set({
            activeProvider:
                focusedProvider,
            leftMode:
                focusedProvider
        });
    }

    return false;
}


async function reconcileProviderPlaybackWindows() {
    if (
        shuttingDown
    ) {
        return;
    }


    const providerWindows =
        await getProviderWindows();

    const keysToRemove =
        [];


    for (
        const [provider, windowId]
        of Object.entries(
            providerWindows
        )
    ) {
        try {
            const window =
                await chrome.windows.get(
                    windowId
                );


            if (
                window.state ===
                    "minimized"
            ) {
                keysToRemove.push(
                    `streamShellNowPlaying_${provider}`
                );
            }

        } catch {
            keysToRemove.push(
                `streamShellNowPlaying_${provider}`
            );
        }
    }


    if (
        keysToRemove.length
    ) {
        await chrome.storage.local.remove(
            keysToRemove
        );
    }
}


async function broadcastState() {
    if (
        shuttingDown
    ) {
        return;
    }

    const [
        state,
        landingExposed,
        titlebarVisibilityMode
    ] =
        await Promise.all([
            chrome.storage.local.get([
                "activeProvider",
                "leftMode",
                "rightMode",
                "twitchTarget"
            ]),
            isLandingExposed(),
            getTitlebarVisibilityMode()
        ]);

    if (
        shuttingDown
    ) {
        return;
    }

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        titlebarVisibilityMode,
        state.twitchTarget ||
            "resume"
    );

    const twitchWorkspace =
        await getTwitchWorkspaceV2Summary().catch(() => ({ active: false, slots: [] }));

    try {
        await chrome.runtime.sendMessage({
            type:
                "state-changed",

            activeProvider:
                state.activeProvider ||
                "netflix",

            leftMode:
                state.leftMode ||
                "landing",

            rightMode:
                state.rightMode ||
                "dashboard",

            twitchTarget:
                state.twitchTarget ||
                "resume",

            twitchWorkspace,

            landingExposed
        });
    } catch {
    }

    broadcastProviderResourceWindowStates()
        .catch(() => {});
}


chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => {
        if (
            shuttingDown ||
            tab?.active !== true ||
            !Number.isInteger(
                tab?.windowId
            ) ||
            !(
                typeof changeInfo?.title === "string" ||
                changeInfo?.status === "complete"
            )
        ) {
            return;
        }

        /* Workspace slots are already explicitly claimed as A-D. Re-running the
         * generic focused-surface claimant on Twitch title/status changes only
         * creates duplicate native work while the user navigates inside a slot. */
        isTwitchWorkspaceV2WindowId(tab.windowId)
            .then(isWorkspaceWindow => {
                if (isWorkspaceWindow) {
                    /* A-D HWND identity is stable across Twitch SPA navigation. Queue
                     * exactly one member claim as soon as the first real title/status
                     * arrives instead of relying on fixed startup timing. */
                    return claimTwitchWorkspaceV2WindowById(tab.windowId);
                }
                return claimFocusedTitlebarSurface(tab.windowId);
            })
            .catch(() => {});
    }
);


chrome.windows.onFocusChanged.addListener(
    focusedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

        let twitchWorkspaceFastPath = false;

        /*
         * Focus loss is not a fullscreen-exit signal. Chromium can keep a
         * managed provider in true fullscreen while another application owns
         * the foreground. The provider fullscreen event, provider/window
         * teardown and explicit surface changes remain authoritative.
         */

        Promise.resolve()
            .then(
                async () => {
                    const state =
                        await chrome.storage.local.get([
                            "providerWindows",
                            "landingWindowId",
                            "dashboardWindowId",
                            TWITCH_WINDOW_STORAGE_KEY,
                            TWITCH_WORKSPACE_V2_STORAGE_KEY
                        ]);

                    const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
                    const workspaceWindowIds = [
                        workspaceRecord?.slots?.a?.windowId,
                        workspaceRecord?.slots?.b?.windowId,
                        workspaceRecord?.slots?.c?.windowId,
                        workspaceRecord?.slots?.d?.windowId,
                        workspaceRecord?.chat?.windowId
                    ];

                    const managedWindowIds =
                        new Set([
                            state.landingWindowId,
                            state.dashboardWindowId,
                            state[TWITCH_WINDOW_STORAGE_KEY],
                            ...workspaceWindowIds,
                            ...Object.values(
                                state.providerWindows || {}
                            )
                        ].filter(Number.isInteger));

                    const workspaceSlotId =
                        getTwitchWorkspaceV2SlotByWindowId(workspaceRecord, focusedWindowId);
                    const workspaceChatFocused =
                        workspaceRecord?.chat?.windowId === focusedWindowId;

                    if (workspaceSlotId || workspaceChatFocused) {
                        /* A -> C -> B focus changes are ordinary interaction inside
                         * one Twitch surface, not provider transitions. Keep them off
                         * the global reconcile/broadcast path. Record the focused slot
                         * with one lightweight storage write so only that slot renders
                         * the shared floating workspace bar. */
                        twitchWorkspaceFastPath = true;
                        if (workspaceSlotId && workspaceRecord?.selectedSlot !== workspaceSlotId) {
                            await chrome.storage.local.set({
                                [TWITCH_WORKSPACE_V2_STORAGE_KEY]: {
                                    ...workspaceRecord,
                                    selectedSlot: workspaceSlotId,
                                    updatedAt: Date.now()
                                }
                            }).catch(() => {});
                        }
                        raiseTwitchWorkspaceV2NativeCluster(
                            workspaceSlotId || workspaceRecord?.selectedSlot || "a"
                        );
                        return null;
                    }

                    if (
                        !managedWindowIds.has(
                            focusedWindowId
                        )
                    ) {
                        cancelTitlebarClaimRetries(
                            true
                        );
                    }

                    return reconcileCompactFocusedSurface(
                        focusedWindowId
                    );
                }
            )
            .then(
                () => {
                    if (twitchWorkspaceFastPath) return null;
                    return Promise.allSettled([
                        syncDiscordVisibilityState(),
                        reconcileProviderPlaybackWindows(),
                        claimFocusedTitlebarSurface(
                            focusedWindowId
                        )
                    ]);
                }
            )
            .finally(
                () => {
                    if (twitchWorkspaceFastPath) return;
                    broadcastState()
                        .catch(
                            () => {}
                        );
                }
            );
    }
);


chrome.windows.onBoundsChanged.addListener(
    changedWindow => {
        if (
            shuttingDown
        ) {
            return;
        }

        isTwitchWorkspaceV2WindowId(changedWindow?.id)
            .then(isWorkspaceWindow => {
                if (isWorkspaceWindow) return null;
                return reconcileProviderPlaybackWindows()
                    .catch(() => {})
                    .finally(() => {
                        broadcastState().catch(() => {});
                    });
            })
            .catch(() => {});
    }
);


chrome.windows.onRemoved.addListener(
    async removedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

        if (removedWindowId === titlebarFullscreenWindowId) {
            titlebarFullscreenActive = false;
            titlebarFullscreenWindowId = null;
        }

        const stored =
            await chrome.storage.local.get([
                "providerWindows",
                "landingWindowId",
                "dashboardWindowId",
                TWITCH_WINDOW_STORAGE_KEY,
                TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY
            ]);

        const providerWindows =
            stored.providerWindows ||
            {};

        let providersChanged =
            false;


        const removedProviders =
            [];


        for (
            const [name, windowId]
            of Object.entries(
                providerWindows
            )
        ) {
            if (
                windowId ===
                removedWindowId
            ) {
                delete providerWindows[
                    name
                ];


                removedProviders.push(
                    name
                );


                providersChanged =
                    true;
            }
        }

        if (
            providersChanged
        ) {
            await saveProviderWindows(
                providerWindows
            );


            await chrome.storage.local.remove(
                removedProviders.map(
                    name =>
                        `streamShellNowPlaying_${name}`
                )
            );

            for (const provider of removedProviders) {
                recordFlightEvent({
                    source: "background",
                    category: "provider-window",
                    action: "closed",
                    provider,
                    detail: { windowId: removedWindowId }
                }).catch(() => {});
            }
        }

        if (
            stored.landingWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "landingWindowId"
            );
        }

        if (
            stored.dashboardWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "dashboardWindowId"
            );
        }

        if (
            stored[TWITCH_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_WINDOW_STORAGE_KEY
            );
            await chrome.storage.session.remove(
                TWITCH_RAID_GUARD_SESSION_KEY
            ).catch(() => {});


            const rightState = await chrome.storage.local.get("rightMode");
            if (rightState.rightMode === "twitch") {
                await showDashboard().catch(async () => {
                    await chrome.storage.local.set({ rightMode: "dashboard" });
                    await broadcastState();
                });
            }
        }

        if (
            stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY
            ).catch(() => {});
        }

    }
);const DIRECT_LINK_STORAGE_KEY =
    "streamShellDirectLinks";


function normalizeDirectLinkUrl(
    value
) {
    try {
        const url =
            new URL(
                String(
                    value ||
                    ""
                ).trim()
            );

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return url.href;

    } catch {
        return "";
    }
}


async function saveDirectLinkFromBrowser(
    rawUrl,
    rawTitle
) {
    const url =
        normalizeDirectLinkUrl(
            rawUrl
        );


    if (
        !url
    ) {
        return false;
    }


    let host =
        "";


    try {
        host =
            new URL(
                url
            ).hostname.replace(
                /^www\./i,
                ""
            );
    } catch {
    }


    const title =
        String(
            rawTitle ||
            host ||
            url
        ).trim() ||
        url;


    const stored =
        await chrome.storage.local.get(
            DIRECT_LINK_STORAGE_KEY
        );


    const existing =
        Array.isArray(
            stored[
                DIRECT_LINK_STORAGE_KEY
            ]
        )
            ? stored[
                DIRECT_LINK_STORAGE_KEY
            ]
            : [];


    const next = [
        {
            url,
            title,
            host,
            savedAt:
                Date.now()
        },

        ...existing.filter(
            item =>
                normalizeDirectLinkUrl(
                    item?.url
                ) !==
                url
        )
    ];


    await chrome.storage.local.set({
        [DIRECT_LINK_STORAGE_KEY]:
            next
    });


    return true;
}


function removeLegacyDirectLinkContextMenu() {
    if (
        !chrome.contextMenus
    ) {
        return;
    }


    chrome.contextMenus.remove(
        "stream-shell-save-direct-link",
        () => {
            void chrome.runtime.lastError;
        }
    );
}


removeLegacyDirectLinkContextMenu();


async function openDirectLinkInBrowser(
    rawUrl
) {
    const url =
        normalizeDirectLinkUrl(
            rawUrl
        );


    if (
        !url
    ) {
        throw new Error(
            "Invalid direct link."
        );
    }


    const normalWindows =
        await chrome.windows.getAll({
            populate:
                false,

            windowTypes: [
                "normal"
            ]
        });


    const target =
        normalWindows.find(
            window =>
                window.focused
        ) ||
        normalWindows[0] ||
        null;


    if (
        target?.id
    ) {
        await chrome.tabs.create({
            windowId:
                target.id,

            url,

            active:
                true
        });


        await chrome.windows.update(
            target.id,
            {
                focused:
                    true
            }
        );


        return;
    }


    await chrome.windows.create({
        type:
            "normal",

        url,

        focused:
            true
    });
}
/*
 * ============================================================
 * STALE PROVIDER MEDIA LINK RESOLVER
 * ============================================================
 * Continue Watching owns persisted provider URLs. Before a resume
 * navigates, give the dedicated in-page adapter a chance to rebuild
 * the current provider path from the stable media identity. A shared,
 * deterministic resolver is the fallback when a newly-created content
 * script is not ready yet.
 */

async function requestProviderMediaLinkResolution(
    providerName,
    tabId,
    identity,
    fallbackUrl
) {
    if (!Number.isInteger(tabId)) return null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type: "stream-shell-provider-resolve-media-link",
                provider: providerName,
                identity,
                fallbackUrl
            });

            if (response?.ok && response?.result?.url) {
                return {
                    ...response.result,
                    source: "adapter"
                };
            }
        } catch {
        }

        if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }

    return null;
}


function validateResolvedProviderMediaLink(
    providerName,
    result,
    requestedIdentity,
    rawUrl
) {
    if (!result?.url || !isProviderOwnedMediaUrl(providerName, result.url)) {
        return null;
    }

    const url = normalizeProviderResumeUrl(providerName, result.url);
    if (!isProviderOwnedMediaUrl(providerName, url)) return null;

    const resolvedIdentity = getProviderMediaIdentity(providerName, url);
    const expected = getResolvableProviderIdentity(
        providerName,
        requestedIdentity,
        rawUrl
    );

    if (expected?.identity && resolvedIdentity !== expected.identity) {
        return null;
    }

    return {
        provider: providerName,
        identity: resolvedIdentity,
        url,
        strategy: String(result.strategy || "canonical-fallback"),
        reconstructed: result.reconstructed === true,
        source: String(result.source || "shared-fallback")
    };
}


async function resolveSavedProviderMediaLink(
    providerName,
    rawIdentity,
    rawUrl,
    tab
) {
    const identity = String(rawIdentity || "").trim();
    const fallbackUrl = String(rawUrl || "").trim();

    let adapterResult = null;

    if (Number.isInteger(tab?.id)) {
        adapterResult = await requestProviderMediaLinkResolution(
            providerName,
            tab.id,
            identity,
            fallbackUrl
        );
    }

    let resolved = validateResolvedProviderMediaLink(
        providerName,
        adapterResult,
        identity,
        fallbackUrl
    );

    if (!resolved) {
        let preferredOrigin = "";

        try {
            preferredOrigin = new URL(String(tab?.url || "")).origin;
        } catch {
        }

        const fallbackResult = resolveProviderMediaLink(
            providerName,
            identity,
            fallbackUrl,
            preferredOrigin
        );

        resolved = validateResolvedProviderMediaLink(
            providerName,
            fallbackResult
                ? {
                    ...fallbackResult,
                    source: "shared-fallback"
                }
                : null,
            identity,
            fallbackUrl
        );
    }

    if (!resolved) {
        recordFlightEvent({
            source: "background",
            category: "stale-link",
            action: "failed",
            level: "warn",
            provider: providerName,
            detail: {
                reason: "unresolvable-media-identity"
            }
        }).catch(() => {});

        throw new Error("Saved provider link could not be resolved.");
    }

    const normalizedOriginal = isProviderOwnedMediaUrl(
        providerName,
        fallbackUrl
    )
        ? normalizeProviderResumeUrl(providerName, fallbackUrl)
        : "";

    recordFlightEvent({
        source: "background",
        category: "stale-link",
        action: "applied",
        provider: providerName,
        detail: {
            source: resolved.source,
            strategy: resolved.strategy,
            reconstructed: resolved.reconstructed,
            changed: normalizedOriginal !== resolved.url
        }
    }).catch(() => {});

    return resolved;
}
/*
 * ============================================================
 * STREAM SHELL LAUNCH SELF-TEST
 * ============================================================
 * Cheap core checks run whenever the shell is opened. Provider DOM/player
 * checks are reported lazily by each provider content script when loaded.
 */

const STREAM_SHELL_SELF_TEST_KEY = "streamShellLaunchSelfTest";
const STREAM_SHELL_PROVIDER_API_VERSION = 1;

async function runStreamShellLaunchSelfTest() {
    const manifest = chrome.runtime.getManifest() || {};
    const startedAt = Date.now();
    let storageReadable = false;
    let providerWindows = {};
    let browserWindows = [];

    try {
        const stored = await chrome.storage.local.get(["providerWindows"]);
        storageReadable = true;
        providerWindows = stored.providerWindows || {};
    } catch {
    }

    try {
        browserWindows = await chrome.windows.getAll({ populate: false });
    } catch {
    }

    const aliveWindowIds = new Set(
        browserWindows
            .map(item => item.id)
            .filter(Number.isInteger)
    );

    const providers = {};
    for (const provider of Object.keys(PROVIDERS)) {
        const windowId = Number.isInteger(providerWindows?.[provider])
            ? providerWindows[provider]
            : null;
        providers[provider] = {
            state: windowId === null
                ? "not-opened"
                : aliveWindowIds.has(windowId)
                    ? "waiting"
                    : "window-missing",
            windowKnown: windowId !== null,
            windowAlive: windowId !== null && aliveWindowIds.has(windowId),
            report: null,
            updatedAt: null
        };
    }

    const checks = {
        storage: {
            ok: storageReadable,
            state: storageReadable ? "readable" : "unavailable"
        },
        manifest: {
            ok: Number(manifest.manifest_version) === 3,
            state: `MV${manifest.manifest_version || "?"}`
        },
        providerRegistry: {
            ok: Object.keys(PROVIDERS).length === 5,
            state: `${Object.keys(PROVIDERS).length} providers`
        },
        providerApi: {
            ok: true,
            state: `contract v${STREAM_SHELL_PROVIDER_API_VERSION}`
        },
        titlebarHelper: {
            ok: Boolean(titlebarPort),
            state: titlebarPort ? "connected" : "unavailable"
        }
    };

    const snapshot = {
        format: "stream-shell-self-test",
        version: 1,
        extensionVersion: manifest.version || "unknown",
        providerApiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
        startedAt,
        updatedAt: Date.now(),
        ok: Object.values(checks).every(check => check.ok !== false),
        checks,
        providers
    };

    try {
        await chrome.storage.local.set({
            [STREAM_SHELL_SELF_TEST_KEY]: snapshot
        });
    } catch {
    }

    recordFlightEvent({
        source: "background",
        category: "self-test",
        action: "launch",
        level: snapshot.ok ? "info" : "error",
        detail: { ok: snapshot.ok }
    }).catch(() => {});

    return snapshot;
}

async function updateProviderSelfTestReport(provider, report) {
    if (!PROVIDERS[provider] || !report || typeof report !== "object") return false;

    let snapshot = null;
    try {
        snapshot = (await chrome.storage.local.get(STREAM_SHELL_SELF_TEST_KEY))[STREAM_SHELL_SELF_TEST_KEY] || null;
    } catch {
    }

    if (!snapshot) snapshot = await runStreamShellLaunchSelfTest();

    snapshot.providers = snapshot.providers || {};
    const previousProviderState = snapshot.providers[provider]?.state || "unknown";
    const previousProviderOk = snapshot.providers[provider]?.report?.ok;

    snapshot.providers[provider] = {
        ...(snapshot.providers[provider] || {}),
        state: report.ok === false ? "failed" : "reported",
        windowKnown: true,
        windowAlive: true,
        report: {
            ok: report.ok !== false,
            apiVersion: Number(report.apiVersion) || null,
            managed: report.managed === true,
            watchContext: report.watchContext === true,
            videoPresent: report.videoPresent === true,
            failures: Array.isArray(report.failures) ? report.failures.slice(0, 20) : [],
            capabilities: report.capabilities && typeof report.capabilities === "object"
                ? report.capabilities
                : {},
            checkedAt: Number(report.checkedAt) || Date.now()
        },
        updatedAt: Date.now()
    };

    snapshot.updatedAt = Date.now();
    snapshot.ok = Object.values(snapshot.checks || {}).every(check => check?.ok !== false) &&
        Object.values(snapshot.providers || {}).every(entry => entry?.state !== "failed");

    try {
        await chrome.storage.local.set({
            [STREAM_SHELL_SELF_TEST_KEY]: snapshot
        });
    } catch {
    }

    const nextProviderState = snapshot.providers[provider].state;
    const nextProviderOk = snapshot.providers[provider].report?.ok;
    if (
        previousProviderState !== nextProviderState ||
        previousProviderOk !== nextProviderOk
    ) {
        recordFlightEvent({
            source: "background",
            category: "self-test",
            action: "provider-transition",
            level: nextProviderOk === false ? "error" : "info",
            provider,
            detail: {
                from: previousProviderState,
                to: nextProviderState,
                ok: nextProviderOk !== false
            }
        }).catch(() => {});
    }

    return true;
}
/*
 * ============================================================
 * DIAGNOSTICS SELF-HEAL / REPAIR ORCHESTRATION
 * ============================================================
 * Background owns provider tab targeting and the final escalation steps.
 */
const STREAM_SHELL_BACKGROUND_REPAIR_ACTIONS = new Set([
    "restore-managed-marker",
    "clear-pending-resume",
    "resync-adapter",
    "resync-content-state",
    "reinitialize-runtime",
    "netflix-bridge-probe",
    "reload-provider"
]);

async function getProviderRepairTarget(provider) {
    if (!PROVIDERS[provider]) return null;

    const windows = await getProviderWindows();
    const windowId = Number.isInteger(windows?.[provider])
        ? windows[provider]
        : null;
    if (windowId === null) return null;

    try {
        await chrome.windows.get(windowId);
        const tabs = await chrome.tabs.query({ windowId, active: true });
        const tab = tabs[0] || null;
        if (!Number.isInteger(tab?.id)) return null;
        return { windowId, tabId: tab.id };
    } catch {
        return null;
    }
}

async function sendProviderRepairCommand(tabId, action) {
    try {
        return await chrome.tabs.sendMessage(tabId, {
            type: "stream-shell-provider-repair",
            action
        });
    } catch (error) {
        return {
            ok: false,
            action,
            detail: {
                reason: "content-repair-unavailable",
                error: String(error?.message || error || "send-failed")
            }
        };
    }
}

async function runStreamShellProviderRepair(provider, action) {
    const normalizedProvider = String(provider || "");
    const normalizedAction = String(action || "");

    if (
        !PROVIDERS[normalizedProvider] ||
        !STREAM_SHELL_BACKGROUND_REPAIR_ACTIONS.has(normalizedAction)
    ) {
        return { ok: false, error: "Unsupported repair request." };
    }

    const target = await getProviderRepairTarget(normalizedProvider);
    if (!target) {
        return { ok: false, error: "Provider window is unavailable." };
    }

    recordFlightEvent({
        source: "background",
        category: "repair",
        action: "dispatch",
        provider: normalizedProvider,
        detail: { repairAction: normalizedAction }
    }).catch(() => {});

    if (normalizedAction === "reload-provider") {
        try {
            await chrome.tabs.reload(target.tabId);
            recordFlightEvent({
                source: "background",
                category: "repair",
                action: "provider-reloaded",
                provider: normalizedProvider,
                detail: { escalation: "last-resort" }
            }).catch(() => {});
            return {
                ok: true,
                provider: normalizedProvider,
                action: normalizedAction,
                detail: { escalation: "last-resort" }
            };
        } catch (error) {
            return {
                ok: false,
                provider: normalizedProvider,
                action: normalizedAction,
                error: String(error?.message || error || "reload-failed")
            };
        }
    }

    if (normalizedAction === "clear-pending-resume") {
        let contentResult = await sendProviderRepairCommand(
            target.tabId,
            normalizedAction
        );
        try {
            await chrome.storage.local.remove(
                `streamShellPendingResume_${normalizedProvider}`
            );
            if (!contentResult?.ok) {
                contentResult = {
                    ok: true,
                    provider: normalizedProvider,
                    action: normalizedAction,
                    detail: {
                        clearedInBackground: true,
                        contentRuntimeUnavailable: true
                    }
                };
            }
        } catch {
        }
        return contentResult;
    }

    if (normalizedAction === "netflix-bridge-probe") {
        if (normalizedProvider !== "netflix") {
            return { ok: false, error: "Netflix bridge repair is Netflix-only." };
        }

        let result = await sendProviderRepairCommand(
            target.tabId,
            normalizedAction
        );
        if (result?.ok === true) return result;

        try {
            await chrome.scripting.executeScript({
                target: { tabId: target.tabId },
                files: ["providers/player/netflix-bridge.js"],
                world: "MAIN"
            });

            await new Promise(resolve => setTimeout(resolve, 120));
            result = await sendProviderRepairCommand(
                target.tabId,
                normalizedAction
            );

            if (result?.ok === true) {
                result.detail = {
                    ...(result.detail || {}),
                    bridgeReinjected: true
                };
            }
        } catch (error) {
            result = {
                ok: false,
                provider: normalizedProvider,
                action: normalizedAction,
                error: String(error?.message || error || "bridge-reinject-failed")
            };
        }

        return result;
    }

    return sendProviderRepairCommand(target.tabId, normalizedAction);
}
