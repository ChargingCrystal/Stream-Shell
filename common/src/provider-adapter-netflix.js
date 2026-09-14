    /*
     * ============================================================
     * NETFLIX PROVIDER ADAPTER
     * ============================================================
     * Owns Netflix-specific DOM/UI knowledge. The enhancement lifecycle,
     * Now Playing, diagnostics and future shell features consume this
     * adapter instead of reaching into Netflix selectors directly.
     */

    const NETFLIX_ADAPTER_ACTIONS = {
        continueWatching: {
            selectors: [
                "button[data-uia='interrupt-autoplay-continue']"
            ],
            tokens: [
                "continue playing",
                "weiter ansehen",
                "weiterschauen",
                "continue watching"
            ]
        },
        skipRecap: {
            selectors: [
                "button[data-uia='player-skip-recap']"
            ],
            tokens: [
                "skip recap",
                "zusammenfassung überspringen",
                "zusammenfassung ueberspringen"
            ]
        },
        skipIntro: {
            selectors: [
                "button[data-uia='player-skip-intro']",
                ".watch-video--skip-content-button"
            ],
            tokens: [
                "skip intro",
                "intro überspringen",
                "intro ueberspringen",
                "vorspann überspringen",
                "vorspann ueberspringen"
            ]
        },
        nextEpisode: {
            selectors: [
                "button[data-uia='next-episode-seamless-button']",
                "button[data-uia='next-episode-seamless-button-draining']",
                ".watch-video--skip-preplay-button"
            ],
            tokens: [
                "next episode",
                "nächste folge",
                "naechste folge"
            ]
        }
    };

    let netflixAdapterLastUrl = String(location.href || "");
    let netflixAdapterEmitState = null;
    let netflixAdapterApplyPendingResume = null;
    const NETFLIX_ADAPTER_SEMANTIC_SCAN_COOLDOWN_MS = 3000;
    const netflixAdapterSemanticActionCache = new Map();

    const NETFLIX_PLAYER_BRIDGE_CHANNEL = "stream-shell-netflix-player-bridge-v1";
    const netflixPlayerBridgePending = new Map();
    let netflixPlayerBridgeSequence = 0;
    let netflixPlayerBridgeReady = false;
    let netflixPlayerBridgeLastAckAt = 0;
    let netflixPlayerBridgeLastError = null;

    function handleNetflixPlayerBridgeMessage(event) {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.__streamShellNetflixBridge !== NETFLIX_PLAYER_BRIDGE_CHANNEL) return;

        if (data.type === "ready") {
            const wasReady = netflixPlayerBridgeReady;
            netflixPlayerBridgeReady = true;
            netflixPlayerBridgeLastError = null;
            if (!wasReady) {
                recordProviderFlightEvent("ready", {
                    category: "netflix-bridge",
                    provider: "netflix"
                });
            }
            return;
        }

        if (data.type !== "ack" || !data.id) return;
        const pending = netflixPlayerBridgePending.get(String(data.id));
        if (!pending) return;

        netflixPlayerBridgePending.delete(String(data.id));
        clearTimeout(pending.timer);
        netflixPlayerBridgeReady = true;
        netflixPlayerBridgeLastAckAt = Date.now();
        netflixPlayerBridgeLastError = data.ok === true ? null : String(data.error || "bridge-command-failed");
        recordProviderFlightEvent(
            data.ok === true ? "result" : "error",
            {
                category: "netflix-bridge",
                level: data.ok === true ? "info" : "error",
                provider: "netflix",
                detail: {
                    action: pending.action || "unknown",
                    error: data.ok === true ? null : netflixPlayerBridgeLastError
                }
            }
        );
        pending.resolve({
            ok: data.ok === true,
            result: data.result,
            error: data.error || null
        });
    }

    window.addEventListener("message", handleNetflixPlayerBridgeMessage);

    function sendNetflixPlayerBridgeCommand(action, payload = {}, timeoutMs = 900) {
        const id = `ss-nf-${Date.now().toString(36)}-${(++netflixPlayerBridgeSequence).toString(36)}`;
        const timeout = Math.max(250, Number(timeoutMs) || 900);

        recordProviderFlightEvent("command", {
            category: "netflix-bridge",
            provider: "netflix",
            detail: { action: String(action || "") }
        });

        return new Promise(resolve => {
            const timer = setTimeout(() => {
                netflixPlayerBridgePending.delete(id);
                netflixPlayerBridgeLastError = "bridge-timeout";
                recordProviderFlightEvent("error", {
                    category: "netflix-bridge",
                    level: "error",
                    provider: "netflix",
                    detail: {
                        action: String(action || ""),
                        error: "bridge-timeout"
                    }
                });
                resolve({ ok: false, result: null, error: "bridge-timeout" });
            }, timeout);

            netflixPlayerBridgePending.set(id, {
                resolve,
                timer,
                action: String(action || "")
            });
            window.postMessage({
                __streamShellNetflixBridge: NETFLIX_PLAYER_BRIDGE_CHANNEL,
                type: "command",
                id,
                action: String(action || ""),
                payload
            }, "*");
        });
    }

    async function probeNetflixPlayerBridge() {
        const response = await sendNetflixPlayerBridgeCommand("ping", {}, 700);
        netflixPlayerBridgeReady = response.ok === true;
        if (!response.ok) netflixPlayerBridgeLastError = response.error || "bridge-unavailable";
        return response.ok === true;
    }

    async function netflixAdapterBridgePlay() {
        const response = await sendNetflixPlayerBridgeCommand("play", {}, 1000);
        return response.ok === true;
    }

    async function netflixAdapterBridgePause() {
        const response = await sendNetflixPlayerBridgeCommand("pause", {}, 1000);
        return response.ok === true;
    }

    async function netflixAdapterBridgeSeekTo(seconds) {
        const video = getPrimaryVideo();
        const value = Number(seconds);
        if (!Number.isFinite(value)) return false;

        const duration = Number.isFinite(video?.duration) && video.duration > 0
            ? video.duration
            : null;
        const safeTarget = Math.max(
            0,
            duration ? Math.min(value, Math.max(0, duration - .25)) : value
        );

        const response = await sendNetflixPlayerBridgeCommand(
            "seek",
            { milliseconds: Math.round(safeTarget * 1000) },
            1100
        );
        return response.ok === true;
    }

    async function netflixAdapterBridgeSeekBy(seconds) {
        const video = getPrimaryVideo();
        const delta = Number(seconds);
        if (!video || !Number.isFinite(delta)) return false;
        return netflixAdapterBridgeSeekTo(Number(video.currentTime || 0) + delta);
    }

    async function netflixAdapterBridgeSetPlaybackRate(value) {
        const rate = Number(value);
        if (!Number.isFinite(rate) || rate <= 0) return false;
        const response = await sendNetflixPlayerBridgeCommand(
            "setPlaybackRate",
            { rate },
            1000
        );
        return response.ok === true;
    }

    async function netflixAdapterBridgeSetVolume(value) {
        const volume = Number(value);
        if (!Number.isFinite(volume)) return false;
        const response = await sendNetflixPlayerBridgeCommand(
            "setVolume",
            { volume: Math.max(0, Math.min(1, volume)) },
            1000
        );
        return response.ok === true;
    }

    function getNetflixPlayerBridgeState() {
        return {
            ready: netflixPlayerBridgeReady,
            lastAckAt: netflixPlayerBridgeLastAckAt || null,
            lastError: netflixPlayerBridgeLastError,
            commandPath: "main-world-netflix-player-api"
        };
    }

    function netflixAdapterElementVisible(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0 &&
            rect.width > 0 &&
            rect.height > 0;
    }

    function normalizeNetflixAdapterActionText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase();
    }

    function findNetflixAdapterSemanticButton(actionName, tokens) {
        const cached = netflixAdapterSemanticActionCache.get(actionName);
        if (
            cached?.element?.isConnected &&
            netflixAdapterElementVisible(cached.element)
        ) {
            const cachedText = normalizeNetflixAdapterActionText([
                cached.element.getAttribute?.("aria-label"),
                cached.element.getAttribute?.("data-uia"),
                cached.element.textContent
            ].filter(Boolean).join(" "));

            if (tokens.some(token => cachedText.includes(token))) {
                return cached.element;
            }
        }

        const now = Date.now();
        if (
            cached &&
            now - cached.checkedAt < NETFLIX_ADAPTER_SEMANTIC_SCAN_COOLDOWN_MS
        ) {
            return null;
        }

        const candidates = document.querySelectorAll(
            "button, [role='button'], a[aria-label], button[aria-label]"
        );

        for (const element of candidates) {
            if (!netflixAdapterElementVisible(element)) {
                continue;
            }

            const text = normalizeNetflixAdapterActionText([
                element.getAttribute?.("aria-label"),
                element.getAttribute?.("data-uia"),
                element.textContent
            ].filter(Boolean).join(" "));

            if (tokens.some(token => text.includes(token))) {
                netflixAdapterSemanticActionCache.set(actionName, {
                    checkedAt: now,
                    element
                });
                return element;
            }
        }

        netflixAdapterSemanticActionCache.set(actionName, {
            checkedAt: now,
            element: null
        });
        return null;
    }

    function findNetflixAdapterAction(actionName, includeSemantic = true) {
        const definition = NETFLIX_ADAPTER_ACTIONS[actionName];
        if (!definition) return null;

        for (const selector of definition.selectors) {
            const element = document.querySelector(selector);
            if (netflixAdapterElementVisible(element)) {
                return element;
            }
        }

        return includeSemantic
            ? findNetflixAdapterSemanticButton(actionName, definition.tokens)
            : null;
    }

    function triggerNetflixAdapterAction(actionName) {
        if (isProviderSafeModeEnabled("netflix")) return false;

        const element = findNetflixAdapterAction(actionName, true);
        if (!element) return false;

        try {
            element.click();
            if (actionName === "skipRecap" || actionName === "skipIntro") {
                recordProviderFlightEvent("executed", {
                    category: "skip",
                    provider: "netflix",
                    detail: { kind: actionName === "skipRecap" ? "recap" : "intro" }
                });
            }
            return true;
        } catch {
            return false;
        }
    }

    function syncNetflixAdapterNavigation() {
        const currentUrl = String(location.href || "");
        if (currentUrl === netflixAdapterLastUrl) {
            return false;
        }

        netflixAdapterLastUrl = currentUrl;
        netflixAdapterSemanticActionCache.clear();
        netflixAdapterEmitState?.("netflix-navigation");
        setTimeout(() => probeNetflixPlayerBridge(), 60);
        setTimeout(
            () => netflixAdapterApplyPendingResume?.(),
            120
        );
        return true;
    }

    function runNetflixAdapterAutomation(settings = netflixEnhancementSettings) {
        syncNetflixAdapterNavigation();

        if (isProviderSafeModeEnabled("netflix")) {
            return false;
        }

        if (!/^\/watch\//i.test(String(location.pathname || ""))) {
            return false;
        }

        let triggered = false;

        if (settings?.streamShellNetflixContinueWatching === true) {
            triggered = triggerNetflixAdapterAction("continueWatching") || triggered;
        }

        if (settings?.streamShellNetflixAutoSkipRecap === true) {
            triggered = triggerNetflixAdapterAction("skipRecap") || triggered;
        }

        if (settings?.streamShellNetflixAutoSkipIntro === true) {
            triggered = triggerNetflixAdapterAction("skipIntro") || triggered;
        }

        if (settings?.streamShellNetflixAutoNextEpisode === true) {
            triggered = triggerNetflixAdapterAction("nextEpisode") || triggered;
        }

        return triggered;
    }

    function getNetflixAdapterActionState(actionName, enabled) {
        const watchContext = /^\/watch\//i.test(String(location.pathname || ""));
        const safeMode = isProviderSafeModeEnabled("netflix");
        const buttonPresent = watchContext && Boolean(
            findNetflixAdapterAction(actionName, true)
        );

        return {
            enabled: !safeMode && enabled === true,
            configuredEnabled: enabled === true,
            watchContext,
            buttonPresent
        };
    }

    function getNetflixAdapterExtensionState() {
        const root = document.documentElement;
        const watchContext = /^\/watch\//i.test(String(location.pathname || ""));
        const wallpaperMarker = Boolean(
            root?.hasAttribute("data-stream-shell-netflix-wallpaper")
        );
        const titleAvailable = Boolean(
            getNetflixDomProviderTitle()
        );
        const safeMode = isProviderSafeModeEnabled("netflix");

        return {
            safeMode,
            playerBridge: getNetflixPlayerBridgeState(),
            metadata: {
                titleAvailable,
                source: titleAvailable ? "player-dom" : "waiting"
            },
            wallpaper: {
                marker: wallpaperMarker,
                playbackRoute: watchContext,
                state: safeMode
                    ? "safe-mode"
                    : (wallpaperMarker
                        ? "on"
                        : (watchContext ? "suppressed-on-playback" : "off-or-disabled"))
            },
            continueWatching: getNetflixAdapterActionState(
                "continueWatching",
                netflixEnhancementSettings.streamShellNetflixContinueWatching
            ),
            skipRecap: getNetflixAdapterActionState(
                "skipRecap",
                netflixEnhancementSettings.streamShellNetflixAutoSkipRecap
            ),
            skipIntro: getNetflixAdapterActionState(
                "skipIntro",
                netflixEnhancementSettings.streamShellNetflixAutoSkipIntro
            ),
            nextEpisode: getNetflixAdapterActionState(
                "nextEpisode",
                netflixEnhancementSettings.streamShellNetflixAutoNextEpisode
            )
        };
    }

    function getNetflixAdapterExtensionCapabilities({ watchContext }) {
        const state = getNetflixAdapterExtensionState();

        const automationCapability = automationState => makeCapability(
            true,
            watchContext,
            automationState.enabled
                ? (automationState.buttonPresent ? "ready-now" : "armed")
                : "disabled"
        );

        return {
            playerBridge: makeCapability(
                true,
                state.playerBridge.ready,
                state.playerBridge.ready ? "ready" : "waiting",
                state.playerBridge.lastError || state.playerBridge.commandPath
            ),
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable ? "ready" : "waiting"
            ),
            continueWatching: automationCapability(state.continueWatching),
            skipRecap: automationCapability(state.skipRecap),
            skipIntro: automationCapability(state.skipIntro),
            nextEpisode: automationCapability(state.nextEpisode),
            wallpaper: makeCapability(
                true,
                Boolean(document.documentElement),
                state.wallpaper.state
            )
        };
    }

    function createNetflixProviderAdapter(baseAdapter) {
        const extensions = {
            metadata: {
                getTitle: getNetflixProviderTitle,
                getState: () => getNetflixAdapterExtensionState().metadata
            },
            automation: {
                run: runNetflixAdapterAutomation,
                getState: getNetflixAdapterExtensionState
            },
            continueWatching: {
                trigger: () => triggerNetflixAdapterAction("continueWatching"),
                getState: () => getNetflixAdapterExtensionState().continueWatching
            },
            skipRecap: {
                trigger: () => triggerNetflixAdapterAction("skipRecap"),
                getState: () => getNetflixAdapterExtensionState().skipRecap
            },
            skipIntro: {
                trigger: () => triggerNetflixAdapterAction("skipIntro"),
                getState: () => getNetflixAdapterExtensionState().skipIntro
            },
            nextEpisode: {
                trigger: () => triggerNetflixAdapterAction("nextEpisode"),
                getState: () => getNetflixAdapterExtensionState().nextEpisode
            },
            wallpaper: {
                getState: () => getNetflixAdapterExtensionState().wallpaper
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "netflix",
            resumeStrategy: "clean-watch-url + main-world-player-api seek",
            linkResolverStrategy: "watch-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 350,
                checks: 2,
                toleranceSeconds: 5
            },
            extensions,
            getTitle: getNetflixProviderTitle,
            getExtensionState: getNetflixAdapterExtensionState,
            play: netflixAdapterBridgePlay,
            pause: netflixAdapterBridgePause,
            seekTo: netflixAdapterBridgeSeekTo,
            seekBy: netflixAdapterBridgeSeekBy,
            setPlaybackRate: netflixAdapterBridgeSetPlaybackRate,
            setVolume: netflixAdapterBridgeSetVolume,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                netflixAdapterEmitState = emitState || null;
                netflixAdapterApplyPendingResume = applyPendingResume || null;
                netflixAdapterLastUrl = String(location.href || "");
                setTimeout(() => probeNetflixPlayerBridge(), 80);
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("netflix", adapter);
        adapter.getExtensionCapabilities = context =>
            getNetflixAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("netflix", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "netflix",
        createNetflixProviderAdapter
    );
