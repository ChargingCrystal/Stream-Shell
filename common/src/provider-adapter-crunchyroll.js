    /*
     * ============================================================
     * CRUNCHYROLL PROVIDER ADAPTER
     * ============================================================
     * Owns Crunchyroll-specific route/player knowledge, windowed-mode
     * targeting, skip-event automation, spoiler presentation and diagnostics
     * state.
     */

    let crunchyrollAdapterSkipEvents = null;
    let crunchyrollAdapterSkipEventsEpisodeId = "";
    let crunchyrollAdapterEnhancementTimer = null;
    let crunchyrollAdapterNavigationTimer = null;
    let crunchyrollAdapterLastUrl = String(location.href || "");
    const crunchyrollAdapterNavigationListeners = new Set();

    function getCrunchyrollAdapterEpisodeId() {
        const match = String(location.pathname || "")
            .match(/^\/watch\/([A-Z0-9]+)/i);
        return String(match?.[1] || "").toUpperCase();
    }

    function isCrunchyrollAdapterWatchContext() {
        return /^\/watch\//i.test(
            String(window.location.pathname || "")
        );
    }

    function crunchyrollAdapterSubscribeNavigation(listener) {
        if (typeof listener === "function") {
            crunchyrollAdapterNavigationListeners.add(listener);
        }

        if (crunchyrollAdapterNavigationTimer) return;

        crunchyrollAdapterLastUrl = String(location.href || "");
        crunchyrollAdapterNavigationTimer = createProviderResourceLoop(
            "crunchyroll-navigation",
            () => {
                const nextUrl = String(location.href || "");
                if (nextUrl === crunchyrollAdapterLastUrl) return;

                const previousUrl = crunchyrollAdapterLastUrl;
                crunchyrollAdapterLastUrl = nextUrl;

                for (const callback of [...crunchyrollAdapterNavigationListeners]) {
                    try {
                        callback({ previousUrl, nextUrl });
                    } catch {
                    }
                }
            },
            400,
            "navigation"
        );
    }

    function setCrunchyrollAdapterBooleanMarker(attribute, enabled) {
        const root = document.documentElement;
        if (!root) return false;

        if (enabled) {
            root.setAttribute(attribute, "true");
        } else {
            root.removeAttribute(attribute);
        }
        return true;
    }

    function syncCrunchyrollAdapterPresentation(
        settings = crunchyrollEnhancementSettings
    ) {
        const enabled = !isProviderSafeModeEnabled("crunchyroll") &&
            settings?.streamShellCrunchyrollBlurEpisodeThumbnails === true;

        setCrunchyrollAdapterBooleanMarker(
            "data-stream-shell-crunchyroll-blur-thumbnails",
            enabled
        );

        providerApiNotifyExtensionChange("crunchyrollPresentation", {
            blurEpisodeThumbnails: enabled
        });

        return true;
    }

    async function loadCrunchyrollAdapterSkipEvents(force = false) {
        const episodeId = getCrunchyrollAdapterEpisodeId();

        if (!episodeId) {
            const changed = Boolean(
                crunchyrollAdapterSkipEventsEpisodeId ||
                crunchyrollAdapterSkipEvents
            );
            crunchyrollAdapterSkipEvents = null;
            crunchyrollAdapterSkipEventsEpisodeId = "";
            if (changed) {
                providerApiNotifyExtensionChange("crunchyrollSkipData", {
                    state: "inactive"
                });
            }
            return false;
        }

        if (
            !force &&
            episodeId === crunchyrollAdapterSkipEventsEpisodeId
        ) {
            return Boolean(crunchyrollAdapterSkipEvents);
        }

        crunchyrollAdapterSkipEventsEpisodeId = episodeId;
        crunchyrollAdapterSkipEvents = null;

        try {
            const response = await chrome.runtime.sendMessage({
                type: "crunchyroll-skip-events",
                episodeId
            });

            if (
                response?.ok &&
                response.events &&
                typeof response.events === "object"
            ) {
                crunchyrollAdapterSkipEvents = response.events;
                const eventKinds = Object.keys(response.events);
                providerApiNotifyExtensionChange("crunchyrollSkipData", {
                    state: "loaded",
                    eventKinds
                });
                recordProviderFlightEvent("detected", {
                    category: "skip",
                    provider: "crunchyroll",
                    detail: { kinds: eventKinds }
                });
                return true;
            }
        } catch {
        }

        providerApiNotifyExtensionChange("crunchyrollSkipData", {
            state: "unavailable"
        });
        return false;
    }

    function crunchyrollAdapterEventEnabled(
        kind,
        settings = crunchyrollEnhancementSettings
    ) {
        if (isProviderSafeModeEnabled("crunchyroll")) return false;

        if (kind === "intro") {
            return settings?.streamShellCrunchyrollAutoSkipIntro === true;
        }
        if (kind === "recap") {
            return settings?.streamShellCrunchyrollAutoSkipRecap === true;
        }
        if (kind === "credits") {
            return settings?.streamShellCrunchyrollAutoSkipCredits === true;
        }
        return false;
    }

    function getCrunchyrollAdapterEvent(kind) {
        const event = crunchyrollAdapterSkipEvents?.[kind];
        const start = Number(event?.start);
        const end = Number(event?.end);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return null;
        }

        return { start, end };
    }

    function runCrunchyrollAdapterAutoSkip(
        settings = crunchyrollEnhancementSettings
    ) {
        const video = getPrimaryVideo();
        if (!video || !crunchyrollAdapterSkipEvents) return false;

        const currentTime = Number(video.currentTime);
        if (!Number.isFinite(currentTime)) return false;

        for (const kind of ["recap", "intro", "credits"]) {
            if (!crunchyrollAdapterEventEnabled(kind, settings)) {
                continue;
            }

            const event = getCrunchyrollAdapterEvent(kind);
            if (!event) continue;

            if (
                currentTime >= event.start &&
                currentTime < event.end - 0.08
            ) {
                const target = Math.min(
                    Number.isFinite(video.duration)
                        ? video.duration
                        : event.end + 0.05,
                    event.end + 0.05
                );

                try {
                    video.currentTime = target;
                    providerApiNotifyExtensionChange(
                        "crunchyrollAutoSkip",
                        { kind, target }
                    );
                    recordProviderFlightEvent("executed", {
                        category: "skip",
                        provider: "crunchyroll",
                        detail: { kind, target }
                    });
                    return true;
                } catch {
                    return false;
                }
            }
        }

        return false;
    }

    function syncCrunchyrollAdapterWindowedPlayer(enabled) {
        const active = !isProviderSafeModeEnabled("crunchyroll") &&
            Boolean(enabled) &&
            isCrunchyrollAdapterWatchContext();

        setWindowedPlayerRootMarker(
            "crunchyroll",
            active
        );

        providerApiNotifyExtensionChange("windowedPlayer", {
            active
        });
        return active;
    }

    function crunchyrollAdapterMatchesPlayerTarget(target) {
        return target instanceof Element && Boolean(
            target.closest(
                "#vilosRoot, #velocity-player-package, " +
                "[data-testid*='player'], .video-player-wrapper, " +
                "#player-container, .bitmovinplayer-container"
            )
        );
    }

    function getCrunchyrollAdapterSkipState(
        kind,
        settings = crunchyrollEnhancementSettings
    ) {
        const watchContext = isCrunchyrollAdapterWatchContext();
        const enabled = crunchyrollAdapterEventEnabled(kind, settings);
        const event = getCrunchyrollAdapterEvent(kind);

        return {
            enabled,
            watchContext,
            eventAvailable: Boolean(event),
            start: event?.start ?? null,
            end: event?.end ?? null
        };
    }

    function getCrunchyrollAdapterExtensionState() {
        const root = document.documentElement;
        const windowedMarker = root?.getAttribute(
            "data-stream-shell-windowed-player"
        ) || null;
        const blurMarker = root?.getAttribute(
            "data-stream-shell-crunchyroll-blur-thumbnails"
        ) || null;
        const safeMode = isProviderSafeModeEnabled("crunchyroll");
        const titleAvailable = Boolean(
            cleanProviderTitle(
                getCrunchyrollProviderTitle(),
                "crunchyroll"
            )
        );

        return {
            safeMode,
            metadata: {
                titleAvailable
            },
            windowedPlayer: {
                active: windowedMarker === "crunchyroll",
                watchContext: isCrunchyrollAdapterWatchContext(),
                playerTargetPresent: Boolean(document.querySelector(
                    "#vilosRoot, #velocity-player-package, " +
                    "[data-testid*='player'], .video-player-wrapper, " +
                    "#player-container, .bitmovinplayer-container"
                ))
            },
            skipData: {
                episodeId: getCrunchyrollAdapterEpisodeId() || null,
                loadedEpisodeId: crunchyrollAdapterSkipEventsEpisodeId || null,
                loaded: Boolean(crunchyrollAdapterSkipEvents),
                eventKinds: crunchyrollAdapterSkipEvents
                    ? Object.keys(crunchyrollAdapterSkipEvents)
                    : []
            },
            skipIntro: getCrunchyrollAdapterSkipState("intro"),
            skipRecap: getCrunchyrollAdapterSkipState("recap"),
            skipCredits: getCrunchyrollAdapterSkipState("credits"),
            spoilerProtection: {
                enabled: !safeMode && crunchyrollEnhancementSettings
                    .streamShellCrunchyrollBlurEpisodeThumbnails === true,
                configuredEnabled: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollBlurEpisodeThumbnails === true,
                marker: blurMarker === "true"
            },
            rootReady: Boolean(root)
        };
    }

    function getCrunchyrollAdapterExtensionCapabilities({ watchContext }) {
        const state = getCrunchyrollAdapterExtensionState();

        const skipCapability = skipState => makeCapability(
            true,
            watchContext,
            skipState.enabled
                ? (skipState.eventAvailable ? "armed · timing ready" : "armed · timing waiting")
                : "disabled"
        );

        return {
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable
                    ? "ready"
                    : "waiting"
            ),
            windowedPlayer: makeCapability(
                true,
                watchContext,
                state.windowedPlayer.active ? "on" : "off",
                state.windowedPlayer.playerTargetPresent
                    ? "player target present"
                    : "player target not currently present"
            ),
            skipData: makeCapability(
                true,
                state.skipData.loaded,
                state.skipData.loaded
                    ? `${state.skipData.eventKinds.length} event type(s)`
                    : (watchContext ? "waiting" : "inactive")
            ),
            skipIntro: skipCapability(state.skipIntro),
            skipRecap: skipCapability(state.skipRecap),
            skipCredits: skipCapability(state.skipCredits),
            spoilerProtection: makeCapability(
                true,
                state.rootReady,
                state.spoilerProtection.marker
                    ? "on"
                    : (state.spoilerProtection.enabled
                        ? "marker-missing"
                        : "off")
            )
        };
    }

    function startCrunchyrollAdapterEnhancements() {
        syncCrunchyrollAdapterPresentation();
        loadCrunchyrollAdapterSkipEvents().catch(() => {});

        crunchyrollAdapterSubscribeNavigation(() => {
            crunchyrollAdapterSkipEventsEpisodeId = "";
            loadCrunchyrollAdapterSkipEvents(true).catch(() => {});
        });

        if (!crunchyrollAdapterEnhancementTimer) {
            crunchyrollAdapterEnhancementTimer = createProviderResourceLoop(
                "crunchyroll-enhancements",
                () => {
                    const episodeId = getCrunchyrollAdapterEpisodeId();
                    if (episodeId !== crunchyrollAdapterSkipEventsEpisodeId) {
                        loadCrunchyrollAdapterSkipEvents().catch(() => {});
                    }
                    runCrunchyrollAdapterAutoSkip();
                },
                350,
                "dom"
            );
        }

        return true;
    }

    function syncCrunchyrollAdapterEnhancementSettings() {
        syncCrunchyrollAdapterPresentation();
        runCrunchyrollAdapterAutoSkip();
        providerApiNotifyExtensionChange(
            "crunchyrollEnhancementSettings",
            {
                autoSkipIntro: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipIntro === true,
                autoSkipRecap: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipRecap === true,
                autoSkipCredits: crunchyrollEnhancementSettings
                    .streamShellCrunchyrollAutoSkipCredits === true
            }
        );
        return true;
    }

    function createCrunchyrollProviderAdapter(baseAdapter) {
        const extensions = {
            windowedPlayer: {
                sync: syncCrunchyrollAdapterWindowedPlayer,
                start(sync) {
                    crunchyrollAdapterSubscribeNavigation(sync);
                },
                matchesTarget: crunchyrollAdapterMatchesPlayerTarget,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().windowedPlayer
            },
            enhancements: {
                start: startCrunchyrollAdapterEnhancements,
                syncSettings: syncCrunchyrollAdapterEnhancementSettings,
                getState: getCrunchyrollAdapterExtensionState
            },
            skipEvents: {
                load: loadCrunchyrollAdapterSkipEvents,
                run: runCrunchyrollAdapterAutoSkip,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().skipData
            },
            spoilerProtection: {
                sync: syncCrunchyrollAdapterPresentation,
                getState: () =>
                    getCrunchyrollAdapterExtensionState().spoilerProtection
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "crunchyroll",
            resumeStrategy: "clean-watch-url + pending-seek",
            linkResolverStrategy: "episode-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 250,
                checks: 1,
                toleranceSeconds: 5
            },
            extensions,
            isWatchContext: isCrunchyrollAdapterWatchContext,
            getTitle: async () => cleanProviderTitle(
                getCrunchyrollProviderTitle(),
                "crunchyroll"
            ),
            getExtensionState: getCrunchyrollAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                crunchyrollAdapterSubscribeNavigation(() => {
                    emitState?.("crunchyroll-navigation");
                    setTimeout(
                        () => applyPendingResume?.(),
                        80
                    );
                });
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("crunchyroll", adapter);
        adapter.getExtensionCapabilities = context =>
            getCrunchyrollAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("crunchyroll", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "crunchyroll",
        createCrunchyrollProviderAdapter
    );
