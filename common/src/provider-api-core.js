    /*
     * ============================================================
     * PROVIDER API CORE
     * ============================================================
     * Stable shell-facing contract above provider DOM details.
     * Shared contract, adapter registry and generic playback primitives.
     * Provider-specific DOM/state belongs in dedicated provider adapters.
     */

    const STREAM_SHELL_PROVIDER_API_VERSION = 1;
    const CONTINUE_WATCHING_STORAGE_KEY = "streamShellContinueWatching";
    const CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY = "streamShellContinueWatchingCompletePercent";
    const CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT = 95;
    const CONTINUE_WATCHING_MAX_ITEMS = 50;
    let continueWatchingCompletePercent = CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT;
    const PENDING_RESUME_KEY_PREFIX = "streamShellPendingResume_";

    const providerApiListeners = new Map();
    const providerAdapterFactories = new Map();
    const providerAdapterInstances = new Map();
    let providerApiStarted = false;
    let providerApiProgressEventAt = 0;
    let providerApiSelfTestTimer = null;
    let providerApiResumeRunning = false;
    let providerApiLastLaunchSelfTestStartedAt = null;
    let providerApiLastResumeFlightKey = "";
    let providerApiResumeGeneration = 0;

    function normalizeContinueWatchingCompletePercent(
        value,
        fallback = CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
    ) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(1, Math.min(100, Math.round(numeric)));
    }

    function setContinueWatchingCompletePercent(value) {
        continueWatchingCompletePercent = normalizeContinueWatchingCompletePercent(
            value,
            CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
        );
        return continueWatchingCompletePercent;
    }

    async function initializeContinueWatchingCompletePercent() {
        try {
            const stored = await chrome.storage.local.get(
                CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY
            );
            return setContinueWatchingCompletePercent(
                stored[CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY]
            );
        } catch {
            return setContinueWatchingCompletePercent(
                CONTINUE_WATCHING_DEFAULT_COMPLETE_PERCENT
            );
        }
    }

    function providerApiOn(type, listener) {
        if (typeof listener !== "function") return () => {};
        const listeners = providerApiListeners.get(type) || new Set();
        listeners.add(listener);
        providerApiListeners.set(type, listeners);
        return () => listeners.delete(listener);
    }

    function providerApiEmit(type, detail = {}) {
        const listeners = providerApiListeners.get(type);
        if (!listeners) return;
        for (const listener of [...listeners]) {
            try {
                listener(detail);
            } catch {
            }
        }
    }

    function registerProviderAdapter(provider, factory) {
        if (!provider || !PROVIDERS[provider] || typeof factory !== "function") {
            return false;
        }

        providerAdapterFactories.set(provider, factory);
        providerAdapterInstances.delete(provider);
        return true;
    }

    function providerApiNotifyExtensionChange(name, detail = {}) {
        const provider = getCurrentProvider();
        if (!provider) return;

        providerApiEmit("extensionchange", {
            provider,
            name: String(name || "unknown"),
            ...detail
        });

        scheduleProviderApiSelfTest(`extension:${String(name || "unknown")}`, 350);
    }


    function makeCapability(supported, available, state = null, detail = null) {
        return {
            supported: supported === true,
            available: supported === true && available === true,
            state: state === undefined ? null : state,
            detail: detail === undefined ? null : detail
        };
    }


    function getProviderCapabilities(provider, adapter = null) {
        const video = getPrimaryVideo();
        const playback = getPlaybackSnapshot();
        const watchContext = Boolean(provider && isWatchContext(provider));
        const hasDuration = Number.isFinite(playback.duration) && playback.duration > 0;

        return {
            common: {
                watchContext: makeCapability(true, watchContext, watchContext ? "active" : "inactive"),
                playback: makeCapability(true, Boolean(video), playback.playbackState),
                seek: makeCapability(true, Boolean(video) && hasDuration, Boolean(video) && hasDuration ? "ready" : "unavailable"),
                progress: makeCapability(true, Boolean(video) && hasDuration && Number.isFinite(playback.currentTime), Boolean(video) && hasDuration ? "ready" : "unavailable"),
                volume: makeCapability(true, Boolean(video), video ? "ready" : "unavailable"),
                playbackRate: makeCapability(true, Boolean(video), video ? "ready" : "unavailable"),
                resume: makeCapability(
                    true,
                    watchContext && Boolean(video) && hasDuration,
                    watchContext && Boolean(video) && hasDuration ? "ready" : "waiting",
                    adapter?.resumeStrategy || "pending-seek"
                ),
                linkResolver: makeCapability(
                    true,
                    typeof adapter?.resolveMediaUrl === "function",
                    typeof adapter?.resolveMediaUrl === "function" ? "ready" : "unavailable",
                    adapter?.linkResolverStrategy || "identity + canonical fallback"
                )
            },
            extensions: typeof adapter?.getExtensionCapabilities === "function"
                ? adapter.getExtensionCapabilities({
                    watchContext,
                    video,
                    playback
                })
                : {}
        };
    }

    async function getProviderMediaSnapshot(
        provider = getCurrentProvider(),
        adapter = null
    ) {
        const resolvedAdapter = adapter || getProviderAdapter(provider);
        const watchContext = resolvedAdapter?.isWatchContext?.() === true;
        if (!provider || !watchContext) return null;

        const title = await (
            typeof resolvedAdapter?.getTitle === "function"
                ? resolvedAdapter.getTitle()
                : getProviderTitle(provider)
        );
        if (!title) return null;

        const image = await (
            typeof resolvedAdapter?.getArtwork === "function"
                ? resolvedAdapter.getArtwork()
                : getProviderArtwork(provider)
        );
        const playback = typeof resolvedAdapter?.getPlayback === "function"
            ? resolvedAdapter.getPlayback()
            : getPlaybackSnapshot();

        const resumeUrl = typeof resolvedAdapter?.getResumeUrl === "function"
            ? resolvedAdapter.getResumeUrl()
            : normalizeProviderResumeUrl(provider, window.location.href);

        return {
            provider,
            title,
            image,
            url: resumeUrl || normalizeProviderResumeUrl(provider, window.location.href),
            identity: resolvedAdapter?.getIdentity?.() || getProviderMediaIdentity(provider, window.location.href),
            likeRatio: null,
            ...playback
        };
    }

    async function providerApiPlay() {
        const video = getPrimaryVideo();
        if (!video) return false;
        await video.play();
        return true;
    }

    function providerApiPause() {
        const video = getPrimaryVideo();
        if (!video) return false;
        video.pause();
        return true;
    }

    function providerApiSeekTo(seconds) {
        const video = getPrimaryVideo();
        const value = Number(seconds);
        if (!video || !Number.isFinite(value)) return false;
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
        video.currentTime = Math.max(0, duration ? Math.min(value, Math.max(0, duration - .25)) : value);
        return true;
    }

    function providerApiSeekBy(seconds) {
        const video = getPrimaryVideo();
        return video ? providerApiSeekTo(video.currentTime + Number(seconds || 0)) : false;
    }

    function providerApiSetVolume(value) {
        const video = getPrimaryVideo();
        const numeric = Number(value);
        if (!video || !Number.isFinite(numeric)) return false;
        video.volume = Math.max(0, Math.min(1, numeric));
        return true;
    }

    function providerApiToggleMute() {
        const video = getPrimaryVideo();
        if (!video) return false;
        video.muted = !video.muted;
        return video.muted;
    }

    function providerApiSetPlaybackRate(value) {
        const video = getPrimaryVideo();
        const numeric = Number(value);
        if (!video || !Number.isFinite(numeric) || numeric <= 0) return false;

        video.playbackRate = numeric;

        try {
            video.defaultPlaybackRate = numeric;
        } catch {
        }

        return true;
    }

    function createBaseProviderAdapter(provider) {
        const adapter = {
            id: provider,
            label: PROVIDERS[provider].label,
            apiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
            adapterKind: "generic",
            getUrl: () => window.location.href,
            getResumeUrl: () => normalizeProviderResumeUrl(provider, window.location.href),
            getIdentity: () => getProviderMediaIdentity(provider, window.location.href),
            linkResolverStrategy: "identity + canonical fallback",
            resolveMediaUrl: (identity, fallbackUrl = "") =>
                resolveProviderMediaLink(
                    provider,
                    identity,
                    fallbackUrl,
                    window.location.origin
                ),
            isWatchContext: () => isWatchContext(provider),
            getTitle: () => getProviderTitle(provider),
            getArtwork: () => getProviderArtwork(provider),
            getPlayback: () => getPlaybackSnapshot(),
            getMediaSnapshot: () => getProviderMediaSnapshot(provider),
            play: providerApiPlay,
            pause: providerApiPause,
            seekTo: providerApiSeekTo,
            seekBy: providerApiSeekBy,
            setVolume: providerApiSetVolume,
            toggleMute: providerApiToggleMute,
            setPlaybackRate: providerApiSetPlaybackRate,
            extensions: {},
            getExtensionState: () => null
        };

        adapter.getCapabilities = () => getProviderCapabilities(provider, adapter);
        return adapter;
    }

    function getProviderAdapter(provider = getCurrentProvider()) {
        if (!provider || !PROVIDERS[provider]) return null;

        if (providerAdapterInstances.has(provider)) {
            return providerAdapterInstances.get(provider);
        }

        const baseAdapter = createBaseProviderAdapter(provider);
        const factory = providerAdapterFactories.get(provider);
        let adapter = baseAdapter;

        if (factory) {
            try {
                adapter = factory(baseAdapter) || baseAdapter;
            } catch {
                adapter = baseAdapter;
            }
        }

        adapter.id = provider;
        adapter.label = adapter.label || PROVIDERS[provider].label;
        adapter.apiVersion = STREAM_SHELL_PROVIDER_API_VERSION;
        adapter.adapterKind = String(adapter.adapterKind || "generic");
        adapter.getCapabilities = typeof adapter.getCapabilities === "function"
            ? adapter.getCapabilities
            : () => getProviderCapabilities(provider, adapter);
        adapter.extensions = adapter.extensions || {};

        providerAdapterInstances.set(provider, adapter);

        recordProviderFlightEvent("initialized", {
            category: "adapter",
            provider,
            detail: {
                adapterKind: adapter.adapterKind,
                apiVersion: adapter.apiVersion
            }
        });

        return adapter;
    }

