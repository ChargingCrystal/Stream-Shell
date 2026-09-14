    /*
     * ============================================================
     * RESOURCE GOVERNOR V2
     * ============================================================
     * Adaptive pacing for Stream Shell's own polling/DOM work. Provider
     * windows remain open; only our loops and observers are slowed or parked
     * when a provider is inactive, hidden/minimized, outside watch context or
     * paused. Event-driven playback/resume commands stay immediate.
     */

    const PROVIDER_RESOURCE_PROFILES = {
        "foreground-playing": {
            poll: 1,
            metadata: 1,
            navigation: 1,
            dom: 1,
            visual: 1
        },
        "foreground-paused": {
            poll: 1.6,
            metadata: 1.8,
            navigation: 1.25,
            dom: 1.5,
            visual: 1
        },
        "idle-visible": {
            poll: 2.5,
            metadata: 3,
            navigation: 1.6,
            dom: 2.5,
            visual: 1.5
        },
        "background-playing": {
            poll: 2.5,
            metadata: 2.75,
            navigation: 2,
            dom: 1.75,
            visual: 8
        },
        "sleeping": {
            poll: 8,
            metadata: 8,
            navigation: 4,
            dom: 8,
            visual: 12
        }
    };

    let providerResourceGovernorWindowState = {
        managed: true,
        provider: null,
        windowId: null,
        windowState: null,
        minimized: false,
        focused: false,
        shellActive: true,
        activeProvider: null,
        leftMode: null
    };

    let providerResourceGovernorState = null;
    let providerResourceGovernorStarted = false;
    let providerResourceGovernorLastFlightSignature = "";
    const providerResourceGovernorListeners = new Set();
    const providerResourceGovernorWorkloads = new Map();

    function getProviderResourceGovernorMode({
        visible,
        watchContext,
        playing
    }) {
        if (!visible) {
            return playing && watchContext
                ? "background-playing"
                : "sleeping";
        }

        if (!watchContext) {
            return "idle-visible";
        }

        return playing
            ? "foreground-playing"
            : "foreground-paused";
    }

    function computeProviderResourceGovernorState(
        reason = "state"
    ) {
        const provider = getCurrentProvider();
        const adapter = provider
            ? getProviderAdapter(provider)
            : null;
        const video = getPrimaryVideo();
        const watchContext = adapter?.isWatchContext?.() === true;
        const playing = Boolean(
            video &&
            video.paused !== true &&
            video.ended !== true
        );
        const documentVisible = document.visibilityState !== "hidden";
        const minimized = providerResourceGovernorWindowState.minimized === true;
        const shellActive = providerResourceGovernorWindowState.shellActive !== false;
        const visible = documentVisible && !minimized && shellActive;
        const focused = Boolean(
            providerResourceGovernorWindowState.focused === true ||
            document.hasFocus?.()
        );
        const mode = getProviderResourceGovernorMode({
            visible,
            watchContext,
            playing
        });
        const domObserversAllowed = Boolean(
            visible ||
            (watchContext && playing)
        );
        const visualWorkAllowed = visible === true;
        const profile = PROVIDER_RESOURCE_PROFILES[mode] ||
            PROVIDER_RESOURCE_PROFILES["foreground-playing"];

        return {
            provider: provider || null,
            mode,
            reason: String(reason || "state"),
            documentVisible,
            visible,
            minimized,
            focused,
            shellActive,
            watchContext,
            playing,
            domObserversAllowed,
            visualWorkAllowed,
            paused: Boolean(video && !playing),
            videoPresent: Boolean(video),
            profile: { ...profile },
            windowState: providerResourceGovernorWindowState.windowState || null,
            windowId: providerResourceGovernorWindowState.windowId || null,
            activeProvider: providerResourceGovernorWindowState.activeProvider || null,
            leftMode: providerResourceGovernorWindowState.leftMode || null,
            updatedAt: Date.now()
        };
    }

    function resourceGovernorStateSignature(state) {
        if (!state) return "";
        return JSON.stringify([
            state.mode,
            state.visible,
            state.minimized,
            state.focused,
            state.shellActive,
            state.watchContext,
            state.playing,
            state.videoPresent
        ]);
    }

    function updateProviderResourceGovernor(
        reason = "state"
    ) {
        const previous = providerResourceGovernorState;
        const next = computeProviderResourceGovernorState(reason);
        const previousSignature = resourceGovernorStateSignature(previous);
        const nextSignature = resourceGovernorStateSignature(next);

        providerResourceGovernorState = next;

        document.documentElement?.setAttribute(
            "data-stream-shell-resource-mode",
            next.mode
        );

        if (previousSignature === nextSignature) {
            return next;
        }

        for (const listener of [...providerResourceGovernorListeners]) {
            try {
                listener(next, previous);
            } catch {
            }
        }

        const flightSignature = JSON.stringify([
            next.mode,
            next.minimized,
            next.shellActive,
            next.watchContext,
            next.playing
        ]);

        if (
            next.provider &&
            flightSignature !== providerResourceGovernorLastFlightSignature
        ) {
            providerResourceGovernorLastFlightSignature = flightSignature;
            recordProviderFlightEvent("state-changed", {
                category: "resource-governor",
                provider: next.provider,
                detail: {
                    mode: next.mode,
                    minimized: next.minimized,
                    shellActive: next.shellActive,
                    watchContext: next.watchContext,
                    playing: next.playing,
                    reason: next.reason
                }
            });
        }

        return next;
    }

    function getProviderResourceGovernorState() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("snapshot");

        return {
            ...state,
            profile: { ...state.profile },
            workloads: [...providerResourceGovernorWorkloads.values()]
                .map(workload => ({ ...workload }))
        };
    }

    function onProviderResourceGovernorChange(listener) {
        if (typeof listener !== "function") return () => {};
        providerResourceGovernorListeners.add(listener);
        return () => providerResourceGovernorListeners.delete(listener);
    }

    function getProviderResourceDelay(
        baseMs,
        workload = "poll"
    ) {
        const base = Math.max(25, Number(baseMs) || 25);
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("delay");
        const multiplier = Number(state.profile?.[workload]) || 1;
        return Math.max(
            25,
            Math.min(15000, Math.round(base * multiplier))
        );
    }

    function shouldProviderResourceObserveDom() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("observer");

        /*
         * Keep automation responsive while media is actually playing, even
         * in a background provider. A hidden/minimized paused provider can
         * drop broad DOM observers entirely until state changes again.
         */
        return state.domObserversAllowed === true;
    }

    function shouldProviderResourceRunVisualWork() {
        const state = providerResourceGovernorState ||
            computeProviderResourceGovernorState("visual");
        return state.visualWorkAllowed === true;
    }

    function createProviderResourceLoop(
        name,
        callback,
        baseMs,
        workload = "poll",
        {
            immediate = false
        } = {}
    ) {
        let timer = null;
        let stopped = false;
        let running = false;
        const key = String(name || "loop");

        const workloadState = {
            name: key,
            kind: String(workload || "poll"),
            baseMs: Math.max(25, Number(baseMs) || 25),
            delayMs: null,
            lastRunAt: null
        };

        providerResourceGovernorWorkloads.set(key, workloadState);

        const schedule = delayOverride => {
            if (stopped) return;
            if (timer) clearTimeout(timer);

            const delayMs = Number.isFinite(delayOverride)
                ? Math.max(0, delayOverride)
                : getProviderResourceDelay(
                    workloadState.baseMs,
                    workloadState.kind
                );

            workloadState.delayMs = delayMs;
            timer = setTimeout(tick, delayMs);
        };

        const tick = async () => {
            timer = null;
            if (stopped || running) {
                if (!stopped) schedule();
                return;
            }

            running = true;
            workloadState.lastRunAt = Date.now();
            try {
                await callback();
            } catch {
            } finally {
                running = false;
                schedule();
            }
        };

        const unsubscribe = onProviderResourceGovernorChange(
            () => schedule(0)
        );

        const handle = {
            stop() {
                stopped = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                unsubscribe();
                providerResourceGovernorWorkloads.delete(key);
            },
            wake() {
                schedule(0);
            }
        };

        schedule(immediate ? 0 : undefined);
        return handle;
    }

    async function refreshProviderResourceWindowState(
        reason = "background"
    ) {
        try {
            const state = await chrome.runtime.sendMessage({
                type: "provider-resource-state"
            });

            if (state?.managed === true) {
                providerResourceGovernorWindowState = {
                    ...providerResourceGovernorWindowState,
                    ...state
                };
            }
        } catch {
        }

        return updateProviderResourceGovernor(reason);
    }

    function startProviderResourceGovernor() {
        if (providerResourceGovernorStarted) return;
        const provider = getCurrentProvider();
        if (!provider) return;

        providerResourceGovernorStarted = true;
        providerResourceGovernorWindowState.provider = provider;

        chrome.runtime.onMessage.addListener(message => {
            if (message?.type !== "stream-shell-resource-window-state") {
                return;
            }

            if (
                message.state?.provider &&
                message.state.provider !== provider
            ) {
                return;
            }

            providerResourceGovernorWindowState = {
                ...providerResourceGovernorWindowState,
                ...(message.state || {})
            };
            updateProviderResourceGovernor("window-state");
        });

        document.addEventListener(
            "visibilitychange",
            () => {
                updateProviderResourceGovernor("visibilitychange");
                refreshProviderResourceWindowState("visibilitychange")
                    .catch(() => {});
            }
        );

        window.addEventListener(
            "focus",
            () => refreshProviderResourceWindowState("focus")
                .catch(() => {}),
            true
        );

        window.addEventListener(
            "blur",
            () => refreshProviderResourceWindowState("blur")
                .catch(() => {}),
            true
        );

        for (const eventName of [
            "play",
            "pause",
            "ended",
            "loadedmetadata",
            "emptied"
        ]) {
            document.addEventListener(
                eventName,
                () => updateProviderResourceGovernor(eventName),
                true
            );
        }

        providerApiOn(
            "statechange",
            event => updateProviderResourceGovernor(
                event?.reason || "provider-state"
            )
        );

        updateProviderResourceGovernor("startup");
        refreshProviderResourceWindowState("startup")
            .catch(() => {});
    }
