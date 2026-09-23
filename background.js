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
        rightMode: "dashboard"
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
        await chrome.windows.update(
            windowId,
            {
                state:
                    "normal"
            }
        );

        if (
            shuttingDown
        ) {
            return;
        }

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
                    focused
            }
        );
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
            await chrome.windows.get(
                windowId
            );

            return windowId;
        } catch {
            delete windows[
                providerName
            ];

            await saveProviderWindows(
                windows
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    const parkedCreation =
        options?.parked === true;

    const createData = {
        type: "popup",
        state: parkedCreation ? "minimized" : "normal",
        focused: false,
        url: provider.url
    };

    if (!parkedCreation) {
        Object.assign(createData, {
            left: LEFT.left,
            top: LEFT.top,
            width: LEFT.width,
            height: LEFT.height
        });
    }

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
        await safelyMinimizeWindow(windowId);
        await parkWindowOffscreen(windowId, LEFT);
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

    for (
        const [name, windowId]
        of Object.entries(
            windows
        )
    ) {
        if (
            name ===
            providerName
        ) {
            continue;
        }

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

    for (
        const windowId
        of Object.values(
            providerWindows
        )
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
        for (const windowId of Object.values(providerWindows)) {
            if (Number.isInteger(windowId)) {
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
 * surface used for normal Twitch viewing and Drops. The visible Twitch popup is
 * strictly single-tab and is the only live Twitch browser window Stream Shell
 * intentionally keeps. Drops automation runs in that managed document whenever
 * Twitch exposes claim UI; no companion Inventory browser window is created.
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

    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId) || tab.windowId !== windowId) return false;

    if (tab.autoDiscardable !== false) {
        await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
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
    return (await getTwitchWindowId()) === windowId;
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
    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);

    if (forceMinimize || !keepActive) {
        await safelyMinimizeWindow(windowId);
    }
    /* Keep-active deliberately means do nothing: the real on-screen Twitch
     * window remains at RIGHT and the next restored surface simply covers it. */
}

async function showTwitch(target = "resume") {
    if (shuttingDown) return;

    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch utility is available from the Wide Landing layout.");
    }

    const dashboardId = await ensureDashboardWindow();
    const twitchWindowId = await ensureTwitchWindow();

    await hideDiscordForDashboard();
    await restoreWindow(dashboardId, RIGHT, false);

    await activateTwitchTargetInMainWindow(twitchWindowId, target);

    await syncTwitchAutoMuteForWindow(twitchWindowId);

    await chrome.storage.local.set({ rightMode: "twitch" });

    await restoreWindow(twitchWindowId, RIGHT, true);
    await claimFocusedTitlebarSurface(twitchWindowId);
    scheduleTitlebarClaimRetries(twitchWindowId);

    await broadcastState();
}

async function isManagedTwitchWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    return (await getTwitchWindowId()) === windowId;
}

async function armTwitchRaidGuard(tab, sourceUrl) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const sourceChannel = twitchChannelKey(sourceUrl);
    if (!sourceChannel) return false;

    const normalizedSource = `https://www.twitch.tv/${sourceChannel}`;
    await chrome.storage.session.set({
        [TWITCH_RAID_GUARD_SESSION_KEY]: {
            tabId: tab.id,
            windowId: tab.windowId,
            sourceUrl: normalizedSource,
            sourceChannel,
            expiresAt: Date.now() + 45000
        }
    });

    return true;
}

async function disarmTwitchRaidGuard(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    const guard = stored[TWITCH_RAID_GUARD_SESSION_KEY];
    if (!guard || guard.tabId !== tab.id) return false;

    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
    return true;
}


async function enforceTwitchRaidGuard(tabId, url) {
    if (!isTwitchUrl(url)) return;

    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    const guard = stored[TWITCH_RAID_GUARD_SESSION_KEY];
    if (!guard || guard.tabId !== tabId) return;

    if (!Number.isFinite(guard.expiresAt) || guard.expiresAt < Date.now()) {
        await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
        return;
    }

    const nextChannel = twitchChannelKey(url);
    if (!nextChannel || nextChannel === guard.sourceChannel) return;

    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab?.url || tab?.pendingUrl;

    if (url) {
        enforceTwitchRaidGuard(tabId, url).catch(() => {});
        resolveTwitchSpawnCandidate(tabId, url, tab).catch(() => {});
    }

    if (tab?.windowId) {
        getTwitchWindowId()
            .then(windowId => {
                if (windowId === tab.windowId && isTwitchUrl(url) && !isTwitchDropsUrl(url)) {
                    return rememberTwitchContentUrl(url);
                }
            })
            .catch(() => {});
        syncTwitchAutoMuteForTab(tab).catch(() => {});
    }
});

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

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchPreventRaids") && changes.streamShellTwitchPreventRaids.newValue === false) {
        chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
    }
});

/* Remove the obsolete 0.16.0-0.16.2 Inventory worker immediately after
 * an extension upgrade/reload. No Twitch browser window exists solely for
 * auto-claim anymore. */
cleanupLegacyTwitchDropsWorker().catch(() => {});

/* Reconcile an already-open managed Twitch window after extension reload. */
reconcileTwitchAudioPolicy().catch(() => {});
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
            "rightMode"
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
        visibilityMode
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

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode"
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
            `${state.leftMode || "landing"}|${state.rightMode || "dashboard"}|${visibilityMode}|${streamShellDisplayProfileCache?.mode || "wide"}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

        startTitlebarReconcileLoop();
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
        } else {
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

        titlebarPort.postMessage({
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
        });

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
                 * Re-announce the focused managed surface. Claims are
                 * idempotent, so a missed focus/title event heals itself while
                 * an unrelated Opera/native app simply fails the managed-window
                 * checks above and reaches no native trust path.
                 */
                claimFocusedTitlebarSurface()
                    .catch(
                        () => {}
                    );
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
    visibilityMode = "none"
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

    const layoutProfile =
        streamShellDisplayProfileCache?.mode || "wide";

    const key =
        `${nextLeft}|${nextRight}|${nextVisibility}|${layoutProfile}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

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
                "rightMode"
            ]),
            getTitlebarVisibilityMode()
        ]);

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode
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
    if (
        shuttingDown
    ) {
        return;
    }

    await stopVolumeCapture(false);

    shuttingDown =
        true;

    providerCreationLocks.clear();

    landingCreationLock =
        null;

    dashboardCreationLock =
        null;

    stopTitlebarNative();

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

    await chrome.storage.local.remove([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        "leftMode",
        "rightMode"
    ]);

    for (
        const windowId
        of Object.values(
            providerWindows
        )
    ) {
        await safelyRemoveWindow(
            windowId
        );
    }

    /*
     * Stream Shell does not own Discord's lifetime. Leave the native app
     * untouched when killing the shell instead of forcing another Electron
     * minimize/restore cycle.
     */

    await safelyRemoveWindow(
        stored.landingWindowId
    );

    await safelyRemoveWindow(
        stored.dashboardWindowId
    );

    await safelyRemoveWindow(
        stored[TWITCH_WINDOW_STORAGE_KEY]
    );

    await safelyRemoveWindow(
        stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY]
    );

    await chrome.storage.session.remove(
        TWITCH_RAID_GUARD_SESSION_KEY
    ).catch(() => {});
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
                getStreamShellDisplayProfile()
            ])
                .then(
                    ([
                        state,
                        landingExposed,
                        displayProfile
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
                "rightMode"
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
        titlebarVisibilityMode
    );

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

        claimFocusedTitlebarSurface(
            tab.windowId
        )
            .catch(
                () => {}
            );
    }
);


chrome.windows.onFocusChanged.addListener(
    focusedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

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
                            TWITCH_WINDOW_STORAGE_KEY
                        ]);

                    const managedWindowIds =
                        new Set([
                            state.landingWindowId,
                            state.dashboardWindowId,
                            state[TWITCH_WINDOW_STORAGE_KEY],
                            ...Object.values(
                                state.providerWindows || {}
                            )
                        ].filter(Number.isInteger));

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
                () =>
                    Promise.allSettled([
                        syncDiscordVisibilityState(),
                        reconcileProviderPlaybackWindows(),
                        claimFocusedTitlebarSurface(
                            focusedWindowId
                        )
                    ])
            )
            .finally(
                () => {
                    broadcastState()
                        .catch(
                            () => {}
                        );
                }
            );
    }
);


chrome.windows.onBoundsChanged.addListener(
    () => {
        if (
            shuttingDown
        ) {
            return;
        }

        reconcileProviderPlaybackWindows()
            .catch(
                () => {}
            )
            .finally(
                () => {
                    broadcastState()
                        .catch(
                            () => {}
                        );
                }
            );
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
