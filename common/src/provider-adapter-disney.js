    /*
     * ============================================================
     * DISNEY+ PROVIDER ADAPTER
     * ============================================================
     * Owns the Disney+-specific watch-route/title/subtitle contract.
     * The subtitle renderer is still styled by shared CSS, but marker and
     * runtime state now live behind the provider adapter instead of the
     * generic playback utility layer knowing Disney+ details directly.
     */

    let disneyAdapterNavigationTimer = null;

    const DISNEY_ADAPTER_TITLE_SELECTORS = [
        '[data-testid="title"]',
        '[class*="player"] h1',
        '[class*="Player"] h1'
    ];

    const DISNEY_ADAPTER_SUBTITLE_SELECTORS = [
        'span.dss-subtitle-renderer-cue',
        '.dss-subtitle-renderer-cue-window',
        '.dss-subtitle-renderer-line'
    ];

    function isDisneyAdapterWatchContext() {
        const path = String(window.location.pathname || "");
        return (
            path.includes("/video/") ||
            path.includes("/play/")
        ) && Boolean(getPrimaryVideo());
    }

    function getDisneyAdapterTitle() {
        return cleanProviderTitle(
            getTextFromSelectors(DISNEY_ADAPTER_TITLE_SELECTORS) ||
            getMetaContent('meta[property="og:title"]') ||
            document.title,
            "disney"
        );
    }

    function setDisneyAdapterBooleanMarker(attribute, enabled) {
        const root = document.documentElement;
        if (!root) return false;

        if (enabled) {
            root.setAttribute(attribute, "true");
        } else {
            root.removeAttribute(attribute);
        }

        return true;
    }

    function syncDisneyAdapterSubtitleStyling(
        settings = playbackUtilitySettings
    ) {
        const root = document.documentElement;
        if (!root) return false;

        if (isProviderSafeModeEnabled("disney")) {
            clearGenericSubtitleSafeModeState();
            providerApiNotifyExtensionChange("disneySubtitleStyling", {
                enabled: false,
                anarchy: false,
                safeMode: true
            });
            return true;
        }

        const anarchy = subtitleAnarchyEnabled("disney");
        const enabled = anarchy || settings[
            "streamShellSubtitleOverride_disney"
        ] === true;

        setDisneyAdapterBooleanMarker(
            "data-stream-shell-subtitle-override",
            enabled
        );
        root.setAttribute(
            "data-stream-shell-subtitle-provider",
            "disney"
        );

        if (!anarchy) {
            root.style.setProperty(
                "--stream-shell-subtitle-scale",
                String(normalizeSubtitleScale(
                    settings["streamShellSubtitleScale_disney"]
                ))
            );
            root.style.setProperty(
                "--stream-shell-subtitle-color",
                normalizeSubtitleColor(
                    settings["streamShellSubtitleColor_disney"]
                )
            );
        }

        const font = String(
            settings["streamShellSubtitleFont_disney"] || "default"
        );
        const stack = SUBTITLE_FONT_STACKS[font];

        setDisneyAdapterBooleanMarker(
            "data-stream-shell-subtitle-font-override",
            Boolean(stack)
        );

        if (stack) {
            root.style.setProperty(
                "--stream-shell-subtitle-font",
                stack
            );
        } else {
            root.style.removeProperty(
                "--stream-shell-subtitle-font"
            );
        }

        providerApiNotifyExtensionChange("disneySubtitleStyling", {
            enabled,
            anarchy
        });

        return true;
    }

    function getDisneyAdapterExtensionState() {
        const root = document.documentElement;
        const title = getDisneyAdapterTitle();
        const safeMode = isProviderSafeModeEnabled("disney");
        const subtitleNodes = document.querySelectorAll(
            DISNEY_ADAPTER_SUBTITLE_SELECTORS.join(",")
        ).length;
        const marker = root?.getAttribute(
            "data-stream-shell-subtitle-override"
        ) || null;
        const providerMarker = root?.getAttribute(
            "data-stream-shell-subtitle-provider"
        ) || null;
        const fontMarker = root?.getAttribute(
            "data-stream-shell-subtitle-font-override"
        ) || null;

        return {
            safeMode,
            metadata: {
                titleAvailable: Boolean(title),
                source: title ? "player-or-page-dom" : "waiting"
            },
            subtitles: {
                enabled: !safeMode && playbackUtilitySettings[
                    "streamShellSubtitleOverride_disney"
                ] === true,
                configuredEnabled: playbackUtilitySettings[
                    "streamShellSubtitleOverride_disney"
                ] === true,
                anarchy: !safeMode && playbackUtilitySettings[
                    "streamShellSubtitleAnarchy"
                ] === true,
                configuredAnarchy: playbackUtilitySettings[
                    "streamShellSubtitleAnarchy"
                ] === true,
                suppressed: safeMode,
                marker: marker === "true",
                providerMarker,
                fontMarker: fontMarker === "true",
                configuredScale: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleScale_disney"
                    ] ?? "1"
                ),
                configuredColor: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleColor_disney"
                    ] || "#ffffff"
                ),
                configuredFont: String(
                    playbackUtilitySettings[
                        "streamShellSubtitleFont_disney"
                    ] || "default"
                ),
                appliedScale: root?.style?.getPropertyValue(
                    "--stream-shell-subtitle-scale"
                ) || null,
                appliedColor: root?.style?.getPropertyValue(
                    "--stream-shell-subtitle-color"
                ) || null,
                cueNodes: subtitleNodes
            },
            rootReady: Boolean(root),
            watchContext: isDisneyAdapterWatchContext()
        };
    }

    function getDisneyAdapterExtensionCapabilities({ watchContext }) {
        const state = getDisneyAdapterExtensionState();
        const subtitleEnabled = state.subtitles.enabled ||
            state.subtitles.anarchy;

        return {
            titleMetadata: makeCapability(
                true,
                state.metadata.titleAvailable,
                state.metadata.titleAvailable ? "ready" : "waiting"
            ),
            subtitleStyling: makeCapability(
                true,
                state.rootReady,
                state.subtitles.anarchy
                    ? "anarchy"
                    : (subtitleEnabled
                        ? `on · ${state.subtitles.configuredScale}x`
                        : "off"),
                state.subtitles.cueNodes > 0
                    ? `${state.subtitles.cueNodes} cue node(s)`
                    : "cue DOM not currently visible"
            ),
            playerRoute: makeCapability(
                true,
                watchContext,
                watchContext ? "active" : "inactive"
            )
        };
    }

    function startDisneyAdapterNavigationWatch(
        emitState,
        applyPendingResume
    ) {
        if (disneyAdapterNavigationTimer) return;

        let lastUrl = String(location.href || "");

        disneyAdapterNavigationTimer = createProviderResourceLoop(
            "disney-navigation",
            () => {
                const nextUrl = String(location.href || "");
                if (nextUrl === lastUrl) return;

                lastUrl = nextUrl;
                emitState?.("disney-navigation");
                setTimeout(
                    () => applyPendingResume?.(),
                    80
                );
            },
            750,
            "navigation"
        );
    }

    function createDisneyProviderAdapter(baseAdapter) {
        const extensions = {
            subtitleStyling: {
                sync: syncDisneyAdapterSubtitleStyling,
                getState: () => getDisneyAdapterExtensionState().subtitles
            },
            metadata: {
                getState: () => getDisneyAdapterExtensionState().metadata
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "disney",
            resumeStrategy: "clean-player-url + pending-seek (unverified)",
            linkResolverStrategy: "canonical provider fallback (identity mapping unverified)",
            resumeConfirmation: {
                delayMs: 350,
                checks: 2,
                toleranceSeconds: 5
            },
            extensions,
            isWatchContext: isDisneyAdapterWatchContext,
            getTitle: async () => getDisneyAdapterTitle(),
            getExtensionState: getDisneyAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                startDisneyAdapterNavigationWatch(
                    emitState,
                    applyPendingResume
                );
            }
        };

        adapter.getMediaSnapshot = () =>
            getProviderMediaSnapshot("disney", adapter);
        adapter.getExtensionCapabilities = context =>
            getDisneyAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("disney", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "disney",
        createDisneyProviderAdapter
    );
