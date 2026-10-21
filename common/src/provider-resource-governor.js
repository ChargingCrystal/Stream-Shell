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
    // Window snapshots are asynchronous. A later visibility/focus request or
    // native push must not be overwritten by an older, delayed reply.
    let providerResourceWindowRefreshSequence = 0;
    let providerResourceWindowPushRevision = 0;
    const providerResourceGovernorListeners = new Set();
    const providerResourceGovernorWorkloads = new Map();
    // A provider feature owns its page-lifetime event listeners/DOM observers.
    // The polling-loop guard alone cannot stop duplicate listeners when two
    // startup paths overlap across an awaited storage read. Keep the promise
    // registered before invoking the initializer so reentrant starts are safe.
    const providerResourceFeatureStarts = new Map();

    function startProviderFeatureOnce(name, initialize) {
        const key = String(name || "").trim();
        if (!key || typeof initialize !== "function") {
            return Promise.reject(new TypeError("Invalid provider feature initializer."));
        }

        const existing = providerResourceFeatureStarts.get(key);
        if (existing) return existing;

        let resolveStart;
        let rejectStart;
        const started = new Promise((resolve, reject) => {
            resolveStart = resolve;
            rejectStart = reject;
        });
        providerResourceFeatureStarts.set(key, started);

        try {
            // Invoked synchronously: do not postpone the existing startup
            // order. A rejected/partial initialization stays owned; retrying
            // it without teardown would duplicate subscriptions.
            Promise.resolve(initialize()).then(resolveStart, rejectStart);
        } catch (error) {
            rejectStart(error);
        }
        return started;
    }

    // One owned polling loop per workload name within this provider document.
    const providerResourceGovernorLoopHandles = new Map();

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

        // SPA reinitialization may request an existing named loop. Stop its
        // timer and governor listener before registering the replacement.
        // An in-flight async callback cannot be interrupted, but its stopped
        // handle will not reschedule work when it eventually settles.
        providerResourceGovernorLoopHandles.get(key)?.stop();

        const workloadState = {
            name: key,
            kind: String(workload || "poll"),
            baseMs: Math.max(25, Number(baseMs) || 25),
            delayMs: null,
            lastRunAt: null,
            lastDurationMs: null,
            consecutiveFailures: 0,
            totalFailures: 0,
            lastFailureAt: null,
            lastError: null
        };

        providerResourceGovernorWorkloads.set(key, workloadState);

        const schedule = delayOverride => {
            if (stopped) return;
            if (timer) clearTimeout(timer);

            const regularDelay = Number.isFinite(delayOverride)
                ? Math.max(0, delayOverride)
                : getProviderResourceDelay(
                    workloadState.baseMs,
                    workloadState.kind
                );
            // An error must not restart the same broken DOM task at full speed.
            // Clamp the maximum backoff; recovery remains automatic.
            const backoff = workloadState.consecutiveFailures > 0
                ? Math.min(60000, Math.max(1000, workloadState.baseMs) *
                    Math.pow(2, Math.min(6, workloadState.consecutiveFailures)))
                : 0;
            const delayMs = Math.max(regularDelay, backoff);

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
            const startedAt = Date.now();
            workloadState.lastRunAt = startedAt;
            try {
                await callback();
                workloadState.consecutiveFailures = 0;
                workloadState.lastError = null;
            } catch (error) {
                workloadState.consecutiveFailures += 1;
                workloadState.totalFailures += 1;
                workloadState.lastFailureAt = Date.now();
                workloadState.lastError = String(error?.message || error).slice(0, 180);
                // Log first error and powers of two only; no console flood.
                const failures = workloadState.consecutiveFailures;
                if (failures === 1 || (failures & (failures - 1)) === 0) {
                    console.warn(`Stream Shell workload ${key} failed (${failures}x):`, error);
                }
            } finally {
                workloadState.lastDurationMs = Date.now() - startedAt;
                running = false;
                schedule();
            }
        };

        const unsubscribe = onProviderResourceGovernorChange(
            (next, previous) => {
                // Focus alone affects metadata, not the workload pace.
                // Avoid restarting all provider DOM/poll timers on every
                // ordinary Opera/WuWa focus switch.
                if (!previous ||
                    next.mode !== previous.mode ||
                    next.visible !== previous.visible ||
                    next.watchContext !== previous.watchContext ||
                    next.playing !== previous.playing ||
                    next.videoPresent !== previous.videoPresent) {
                    schedule(0);
                }
            }
        );

        const handle = {
            stop() {
                if (stopped) return;
                stopped = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                unsubscribe();
                // Stale handles must never delete a newer loop's state.
                if (providerResourceGovernorLoopHandles.get(key) === handle) {
                    providerResourceGovernorLoopHandles.delete(key);
                    providerResourceGovernorWorkloads.delete(key);
                }
            },
            wake() {
                schedule(0);
            }
        };

        providerResourceGovernorLoopHandles.set(key, handle);
        schedule(immediate ? 0 : undefined);
        return handle;
    }

    async function refreshProviderResourceWindowState(
        reason = "background"
    ) {
        const requestSequence = ++providerResourceWindowRefreshSequence;
        const pushRevision = providerResourceWindowPushRevision;

        try {
            const state = await chrome.runtime.sendMessage({
                type: "provider-resource-state"
            });

            // Visibility/focus and native window events can overlap. Only
            // the newest outstanding request may commit, and a native push
            // always takes precedence over a snapshot begun before it.
            if (
                state?.managed === true &&
                requestSequence === providerResourceWindowRefreshSequence &&
                pushRevision === providerResourceWindowPushRevision &&
                (!state.provider ||
                    state.provider === providerResourceGovernorWindowState.provider)
            ) {
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

            // Invalidate any asynchronous state request that was started
            // before this fresher native/background push arrived.
            providerResourceWindowPushRevision += 1;
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
