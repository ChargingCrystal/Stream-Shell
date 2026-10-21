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

/* The five built-ins keep their specialized adapters. Custom registry entries
 * are basic HTTPS targets only and are never registered as content scripts. */
async function refreshStreamShellProviderTargets() {
    const stored = await chrome.storage.local.get(STREAM_SHELL_PROVIDER_REGISTRY_KEY);
    const registry = normalizeStreamShellProviderRegistry(stored[STREAM_SHELL_PROVIDER_REGISTRY_KEY]);
    const valid = new Set(registry.providers.filter(item => item.enabled).map(item => item.id));
    for (const id of Object.keys(PROVIDERS)) {
        if (!STREAM_SHELL_BUILTIN_IDS.has(id) && !valid.has(id)) delete PROVIDERS[id];
    }
    for (const provider of registry.providers) {
        if (provider.kind === "custom" && provider.enabled) {
            PROVIDERS[provider.id] = { label: provider.name, url: provider.url, kind: "custom" };
        }
    }
    return registry;
}

let providerRemovalReconcile = Promise.resolve();
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY]) return;
    providerRemovalReconcile = providerRemovalReconcile.catch(() => {}).then(async () => {
        const oldRegistry = normalizeStreamShellProviderRegistry(changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY].oldValue);
        const nextRegistry = await refreshStreamShellProviderTargets();
        const ids = new Set(nextRegistry.providers.map(p => p.id));
        const removed = oldRegistry.providers.filter(p => p.kind === "custom" && !ids.has(p.id));
        if (!removed.length) return;
        const state = await chrome.storage.local.get(["activeProvider", "leftMode"]);
        if (removed.some(p => p.id === state.leftMode) && !shuttingDown) {
            // Preserve rightMode. A removed active provider should never strand a popup.
            await switchProvider("youtube");
        }
        const windows = await getProviderWindows();
        for (const removedProvider of removed) {
            const windowId = windows[removedProvider.id];
            if (Number.isInteger(windowId)) {
                await safelyRemoveWindow(windowId);
                delete windows[removedProvider.id];
            }
        }
        await saveProviderWindows(windows);
        await chrome.storage.local.remove(removed.map(p => `streamShellCustomWindowUrl_${p.id}`));
        const after = await chrome.storage.local.get("activeProvider");
        if (removed.some(p => p.id === after.activeProvider)) {
            await chrome.storage.local.set({ activeProvider: "youtube" });
        }
    }).catch(error => console.warn("Custom provider cleanup failed:", error));
});

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
    9;

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


/*
 * Opera window creation/focus is expensive at startup, especially when a left
 * provider is activated while the four Twitch surfaces are coming online.
 * Only explicit shell-wide transitions share this bounded FIFO. Playback,
 * Twitch chat, MoS autojoin, and provider polling NEVER wait on it.
 */
const STREAM_SHELL_TRANSITION_MAX_WAITERS = 2;
let streamShellTransitionTail = Promise.resolve();
let streamShellTransitionWaiters = 0;
let streamShellTransitionActive = null;

/*
 * v0.20.9 – Renderer-startup admission control.
 * The FIFO only serializes extension calls; chrome.windows.create() returns
 * while the new YouTube/Twitch renderer is still loading. On Opera GX,
 * starting a different high-cost surface immediately afterwards can saturate
 * the browser process (including unrelated Opera windows). A ~5 second gap
 * between launches was independently reproducible as the stable path.
 *
 * This lease is held only for a CROSS-SURFACE handoff, and the wait itself
 * occurs inside the existing bounded FIFO. Background chat, MoS autojoin,
 * video playback, and all renderer timers never participate in this queue.
 */
const STREAM_SHELL_RENDERER_HANDOFF_GRACE_MS = 5500;
const STREAM_SHELL_RENDERER_HANDOFF_WARM_MS = 3000;
const STREAM_SHELL_RENDERER_WARM_AFTER_MS = 30000;
let streamShellRendererColdUntil = Date.now() + STREAM_SHELL_RENDERER_WARM_AFTER_MS;
let streamShellTransitionVisualSerial = 0;

// UI-only notification; never await renderer acknowledgements while starting windows.
function notifyStreamShellTransitionVisual(event) {
    if (shuttingDown) return;
    try {
        const sent = chrome.runtime.sendMessage({type:'stream-shell-transition-visual', ...event});
        if (sent?.catch) sent.catch(() => {});
    } catch { /* Dashboard may not be ready yet. */ }
}

function isStreamShellRendererCold(kind, name) {
    // A worker wake may briefly have no cache. Prefer the safe startup gap.
    if (!shellWideFocusCacheReady) return true;
    if (kind === 'twitch') {
        const record = shellWideFocusCache[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        return !['a','b','c','d'].every(slot =>
            Number.isInteger(record?.slots?.[slot]?.windowId));
    }
    if (kind === 'provider') {
        const provider = name.slice('provider:'.length);
        return !Number.isInteger(shellWideFocusCache.providerWindows?.[provider]);
    }
    return false;
}

let streamShellLastRendererLaunchKind = null;
let streamShellLastRendererLaunchFinishedAt = 0;

function streamShellRendererLaunchKind(name) {
    if (name.startsWith('provider:')) return 'provider';
    if (name.startsWith('twitch:')) return 'twitch';
    return null;
}

async function waitForStreamShellRendererHandoff(name) {
    const kind = streamShellRendererLaunchKind(name);
    if (!kind || !streamShellLastRendererLaunchKind ||
        streamShellLastRendererLaunchKind === kind) return 0;
    const cold = Date.now() < streamShellRendererColdUntil ||
        isStreamShellRendererCold(kind, name);
    const graceMs = cold
        ? STREAM_SHELL_RENDERER_HANDOFF_GRACE_MS
        : STREAM_SHELL_RENDERER_HANDOFF_WARM_MS;
    const remaining = graceMs - (Date.now() - streamShellLastRendererLaunchFinishedAt);
    if (remaining <= 0) return 0;
    await new Promise(resolve => setTimeout(resolve, remaining));
    recordFlightEvent({
        category: 'window-transition', action: 'renderer-handoff-staggered',
        detail: { from: streamShellLastRendererLaunchKind, to: kind,
            delayMs: remaining, graceMs, cold }
    }).catch(() => {});
    return remaining;
}

/* Diagnostics only: timestamp expensive steps without changing their order. */
async function measureShellWindowStep(name, task) {
    const startedAt = Date.now();
    try {
        return await task();
    } finally {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= 350) {
            recordFlightEvent({
                category: "window-transition", action: "step-timing",
                level: durationMs > 1500 ? "warn" : "info",
                detail: { name, durationMs }
            }).catch(() => {});
        }
    }
}

function runStreamShellWindowTransition(name, operation) {
    if (shuttingDown) return Promise.reject(new Error("Stream Shell is shutting down."));
    if (streamShellTransitionWaiters >= STREAM_SHELL_TRANSITION_MAX_WAITERS) {
        return Promise.reject(new Error("Stream Shell is busy switching windows; try again shortly."));
    }
    const queuedAt = Date.now();
    streamShellTransitionWaiters += 1;
    const execute = async () => {
        streamShellTransitionWaiters -= 1;
        if (shuttingDown) throw new Error("Stream Shell is shutting down.");
        const startedAt = Date.now();
        streamShellTransitionActive = name;
        const kind = streamShellRendererLaunchKind(name);
        const visualId = ++streamShellTransitionVisualSerial;
        const showTwitchLoading = kind === 'twitch' &&
            (isStreamShellRendererCold(kind, name) ||
             (streamShellLastRendererLaunchKind === 'provider' &&
              Date.now() - streamShellLastRendererLaunchFinishedAt < STREAM_SHELL_RENDERER_HANDOFF_GRACE_MS));
        if (showTwitchLoading) notifyStreamShellTransitionVisual({
            surface:'twitch', stage:'waiting', id:visualId
        });
        try {
            // Explicit commands stay ordered, but renderer initialization
            // must also be given room to settle before crossing surfaces.
            const delayMs = await waitForStreamShellRendererHandoff(name);
            if (shuttingDown) throw new Error("Stream Shell is shutting down.");
            if (showTwitchLoading) notifyStreamShellTransitionVisual({
                surface:'twitch', stage:'creating', id:visualId,
                delayMs
            });
            const result = await operation();
            if (kind) {
                streamShellLastRendererLaunchKind = kind;
                streamShellLastRendererLaunchFinishedAt = Date.now();
            }
            if (showTwitchLoading) notifyStreamShellTransitionVisual({
                surface:'twitch', stage:'done', id:visualId
            });
            return result;
        } catch (error) {
            if (showTwitchLoading) notifyStreamShellTransitionVisual({
                surface:'twitch', stage:'failed', id:visualId
            });
            recordFlightEvent({
                category: "window-transition", action: "failed", level: "error",
                detail: { name, message: String(error?.message || error).slice(0, 160) }
            }).catch(() => {});
            throw error;
        } finally {
            streamShellTransitionActive = null;
            const durationMs = Date.now() - startedAt;
            if (durationMs > 1500 || startedAt - queuedAt > 200) {
                recordFlightEvent({
                    category: "window-transition", action: "timing",
                    level: durationMs > 5000 ? "warn" : "info",
                    detail: { name, durationMs, waitMs: startedAt - queuedAt }
                }).catch(() => {});
            }
        }
    };
    const result = streamShellTransitionTail.then(execute, execute);
    // A failed operation must never poison or indefinitely grow the queue.
    streamShellTransitionTail = result.then(() => undefined, () => undefined);
    return result;
}

function openShellHome() {
    return runStreamShellWindowTransition("open-home", _openShellHome);
}

async function _openShellHome() {
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
        if (compact) {
            await parkWindowOffscreenAndMinimize(windowId, LEFT);
        } else {
            await safelyMinimizeWindow(windowId);
            await parkWindowOffscreen(windowId, LEFT);
        }
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

function openShellWarmLastProvider() {
    return runStreamShellWindowTransition("startup-warm", _openShellWarmLastProvider);
}

async function _openShellWarmLastProvider() {
    await refreshStreamShellProviderTargets();
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
    await _openShellHome();

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

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    if (displayProfile?.mode === "compact") {
        await parkWindowOffscreenAndMinimize(
            windowId,
            LEFT
        );
    } else {
        await safelyMinimizeWindow(
            windowId
        );
    }

    await chrome.storage.local.remove(
        `streamShellNowPlaying_${providerName}`
    );

    /*
     * Reassert the visual state after the warm-up window was created. The
     * remembered provider must never make its titlebar button look selected
     * while it is parked behind the current Home surface.
     */
    await chrome.storage.local.set({
        leftMode:
            displayProfile?.mode === "compact"
                ? "dashboard"
                : "landing"
    });

    await broadcastState();
    // A parked warm provider still starts a Chromium renderer. Twitch opened
    // immediately after Shell launch must honor the same settling lease as a
    // deliberate provider click, even though startup-warm is not a provider:
    // command in the transition FIFO.
    streamShellLastRendererLaunchKind = 'provider';
    streamShellLastRendererLaunchFinishedAt = Date.now();
}



