    /*
     * ============================================================
     * YOUTUBE PROVIDER ADAPTER
     * ============================================================
     * First provider-specific Provider API implementation. All shared
     * shell consumers should talk to this adapter instead of knowing
     * YouTube selectors, root markers or utility internals directly.
     */

    let youtubeNowPlayingStaticCache =
        null;


    function readYouTubeAdapterMarker(name) {
        const root = document.documentElement;
        if (!root?.hasAttribute(name)) return null;
        return root.getAttribute(name) || "true";
    }

    function getYouTubeCleanupAdapterState() {
        const entries = Object.entries(YOUTUBE_CLEANUP_SETTINGS);
        const configuredEnabled = entries
            .filter(([key]) => youtubeUtilitySettings[key] === true)
            .map(([key]) => key.replace(/^streamShellYoutubeCleanup/, ""));
        const safeMode = isProviderSafeModeEnabled("youtube");
        const enabled = safeMode ? [] : configuredEnabled;

        const activeMarkers = entries.filter(([, attribute]) =>
            document.documentElement?.hasAttribute(attribute)
        ).length;

        return {
            enabledCount: enabled.length,
            configuredEnabledCount: configuredEnabled.length,
            configuredCount: entries.length,
            activeMarkerCount: activeMarkers,
            enabledRules: enabled,
            safeMode
        };
    }

    function getYouTubeAdapterExtensionState() {
        const root = document.documentElement;
        const player = getYouTubePlayer();
        const video = getPrimaryVideo();
        const videoId = getYouTubeVideoId();
        const rydRatio = getYouTubeRydLikeRatio();
        const uploadDatePresent = Boolean(
            document.querySelector("[data-stream-shell-upload-date]")
        );
        const windowedMarker = readYouTubeAdapterMarker(
            "data-stream-shell-windowed-player"
        );
        const extrasMarker = readYouTubeAdapterMarker(
            "data-stream-shell-youtube-extras"
        );
        const themeMarker = readYouTubeAdapterMarker(
            "data-stream-shell-youtube-theme"
        );
        const safeMode = isProviderSafeModeEnabled("youtube");

        return {
            safeMode,
            theme: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_THEME_STORAGE_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_THEME_STORAGE_KEY] !== false,
                marker: themeMarker === "true"
            },
            windowedPlayer: {
                active: windowedMarker === "youtube",
                watchContext: isWindowedPlayerWatchContext("youtube"),
                theater: Boolean(getYouTubeWatchContainer()?.hasAttribute("theater"))
            },
            extras: {
                enabled: !safeMode && youtubeExtrasEnabled !== false,
                configuredEnabled: youtubeExtrasEnabled !== false,
                active: extrasMarker === "true"
            },
            ryd: {
                available: Number.isFinite(rydRatio),
                ratio: Number.isFinite(rydRatio) ? rydRatio : null,
                tooltipPresent: Boolean(document.querySelector("#ryd-dislike-tooltip")),
                barWidth: document.querySelector("#ryd-bar")?.style?.width || null
            },
            quality: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_QUALITY_ENABLED_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_QUALITY_ENABLED_KEY] !== false,
                preferred: String(youtubeUtilitySettings[YOUTUBE_QUALITY_KEY] || "hd1080"),
                playerPresent: Boolean(player)
            },
            uploadDate: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_ENABLED_KEY] !== false,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_ENABLED_KEY] !== false,
                present: uploadDatePresent,
                format: String(youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_FORMAT_KEY] || "friendly"),
                relativeEnabled: youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY] !== false,
                relativeDays: Number(youtubeUtilitySettings[YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY]) || 1
            },
            autoLike: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_ENABLED_KEY] === true,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_ENABLED_KEY] === true,
                trigger: String(youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_TRIGGER_KEY] || "percent"),
                subscribedOnly: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY] === true,
                shorts: youtubeUtilitySettings[YOUTUBE_AUTO_LIKE_SHORTS_KEY] === true,
                handledCurrent: Boolean(videoId && youtubeAutoLikedVideoIds.has(videoId))
            },
            keepPlaying: {
                enabled: !safeMode && youtubeUtilitySettings[YOUTUBE_KEEP_PLAYING_KEY] === true,
                configuredEnabled: youtubeUtilitySettings[YOUTUBE_KEEP_PLAYING_KEY] === true
            },
            loop: {
                overrideEnabled: !safeMode && youtubeUtilitySettings[YOUTUBE_LOOP_KEY] === true,
                configuredOverrideEnabled: youtubeUtilitySettings[YOUTUBE_LOOP_KEY] === true,
                videos: youtubeUtilitySettings[YOUTUBE_LOOP_VIDEOS_KEY] === true,
                shorts: youtubeUtilitySettings[YOUTUBE_LOOP_SHORTS_KEY] === true,
                currentVideoLoop: video ? video.loop === true : null
            },
            cleanup: getYouTubeCleanupAdapterState(),
            rootReady: Boolean(root)
        };
    }

    function getYouTubeAdapterExtensionCapabilities({ watchContext, video }) {
        const state = getYouTubeAdapterExtensionState();

        return {
            rydRatio: makeCapability(
                true,
                state.ryd.available,
                state.ryd.available ? `${state.ryd.ratio}%` : "missing"
            ),
            windowedPlayer: makeCapability(
                true,
                watchContext,
                state.windowedPlayer.active ? "on" : "off"
            ),
            extras: makeCapability(
                true,
                watchContext,
                state.extras.active ? "on" : (state.extras.enabled ? "ready" : "disabled")
            ),
            theme: makeCapability(
                true,
                state.rootReady,
                state.theme.marker ? "on" : (state.theme.enabled ? "marker-missing" : "off")
            ),
            uploadDate: makeCapability(
                true,
                state.uploadDate.present,
                state.uploadDate.enabled
                    ? (state.uploadDate.present ? "present" : "not-present")
                    : "disabled"
            ),
            qualityControl: makeCapability(
                true,
                state.quality.playerPresent,
                state.quality.enabled
                    ? (state.quality.playerPresent ? `ready · ${state.quality.preferred}` : "player-missing")
                    : "disabled"
            ),
            autoLike: makeCapability(
                true,
                watchContext && Boolean(video),
                state.autoLike.enabled ? "armed" : "disabled"
            ),
            keepPlaying: makeCapability(
                true,
                watchContext,
                state.keepPlaying.enabled ? "armed" : "disabled"
            ),
            loop: makeCapability(
                true,
                watchContext && Boolean(video),
                state.loop.overrideEnabled ? "override" : "native"
            ),
            cleanup: makeCapability(
                true,
                state.rootReady,
                `${state.cleanup.enabledCount}/${state.cleanup.configuredCount} active`
            )
        };
    }

    function syncYouTubeAdapterWindowedPlayer(enabled) {
        const active = !isProviderSafeModeEnabled("youtube") &&
            Boolean(enabled) &&
            isWindowedPlayerWatchContext("youtube");

        setWindowedPlayerRootMarker("youtube", active);
        bindYouTubeTopUiPointer(active);

        if (active) {
            scheduleYouTubeTheaterMode();
        } else {
            restoreYouTubeTheaterModeIfNeeded();
            clearYouTubeTopUiTimer();
            setYouTubeTopUiVisible(false);
        }

        syncYouTubeExtrasMode(active && youtubeExtrasEnabled);
        providerApiNotifyExtensionChange("windowedPlayer", {
            active
        });

        return active;
    }

    function createYouTubeProviderAdapter(baseAdapter) {
        const extensions = {
            ryd: {
                getRatio: () => getYouTubeRydLikeRatio()
            },
            windowedPlayer: {
                storageKeys: [YOUTUBE_EXTRAS_STORAGE_KEY],
                hydrate(stored) {
                    youtubeExtrasEnabled = stored?.[YOUTUBE_EXTRAS_STORAGE_KEY] !== false;
                },
                handleStorageChanges(changes) {
                    if (!Object.prototype.hasOwnProperty.call(
                        changes || {},
                        YOUTUBE_EXTRAS_STORAGE_KEY
                    )) {
                        return false;
                    }

                    youtubeExtrasEnabled = changes[YOUTUBE_EXTRAS_STORAGE_KEY]
                        ?.newValue !== false;
                    return true;
                },
                sync: syncYouTubeAdapterWindowedPlayer,
                start(sync) {
                    document.addEventListener(
                        "yt-navigate-finish",
                        sync,
                        true
                    );
                },
                matchesTarget(target) {
                    return target instanceof Element &&
                        Boolean(target.closest("#movie_player"));
                },
                getState: () => getYouTubeAdapterExtensionState().windowedPlayer
            },
            extras: {
                getState: () => getYouTubeAdapterExtensionState().extras,
                sync: enabled => syncYouTubeExtrasMode(Boolean(enabled))
            },
            theme: {
                getState: () => getYouTubeAdapterExtensionState().theme,
                sync: setYouTubeThemeMarker
            },
            quality: {
                getState: () => getYouTubeAdapterExtensionState().quality,
                applyPreferred: force => applyYouTubePreferredQuality(force === true),
                schedulePreferred: scheduleYouTubePreferredQuality
            },
            uploadDate: {
                getState: () => getYouTubeAdapterExtensionState().uploadDate,
                refresh: applyYouTubeUploadDate,
                restore: restoreYouTubeUploadDate
            },
            autoLike: {
                getState: () => getYouTubeAdapterExtensionState().autoLike,
                run: runYouTubeAutoLike
            },
            keepPlaying: {
                getState: () => getYouTubeAdapterExtensionState().keepPlaying,
                dismissPrompt: dismissYouTubeContinueWatching
            },
            loop: {
                getState: () => getYouTubeAdapterExtensionState().loop,
                sync: syncYouTubeLoopSetting
            },
            cleanup: {
                getState: getYouTubeCleanupAdapterState,
                sync: syncYouTubeCleanupMarkers
            }
        };

        const adapter = {
            ...baseAdapter,
            adapterKind: "youtube",
            resumeStrategy: "clean-watch-url + stabilized-seek",
            linkResolverStrategy: "video-id -> current /watch path",
            resumeConfirmation: {
                delayMs: 750,
                checks: 3,
                toleranceSeconds: 4
            },
            extensions,
            getExtensionState: getYouTubeAdapterExtensionState,
            bindProviderApiEvents({ emitState, applyPendingResume }) {
                document.addEventListener(
                    "yt-navigate-finish",
                    () => {
                        /*
                         * YouTube updates the /watch?v= URL before every
                         * piece of watch metadata has necessarily settled.
                         * A metadata tick in that gap can therefore cache
                         * the previous video's title under the new video ID.
                         * yt-navigate-finish is the authoritative boundary:
                         * invalidate before publishing so the finished page
                         * repopulates the static snapshot once.
                         */
                        youtubeNowPlayingStaticCache =
                            null;

                        emitState?.("yt-navigate-finish");
                        setTimeout(
                            () => applyPendingResume?.(),
                            80
                        );
                    },
                    true
                );
            },
            async getMediaSnapshot() {
                const identity =
                    adapter.getIdentity?.() ||
                    getProviderMediaIdentity(
                        "youtube",
                        window.location.href
                    );

                const videoId =
                    getYouTubeVideoId();

                const staticKey =
                    videoId ||
                    identity ||
                    `${window.location.pathname}${window.location.search}`;


                if (
                    youtubeNowPlayingStaticCache?.key ===
                        staticKey &&
                    youtubeNowPlayingStaticCache.title
                ) {
                    return {
                        provider:
                            "youtube",

                        title:
                            youtubeNowPlayingStaticCache.title,

                        image:
                            youtubeNowPlayingStaticCache.image,

                        url:
                            youtubeNowPlayingStaticCache.url,

                        identity:
                            youtubeNowPlayingStaticCache.identity,

                        likeRatio:
                            getYouTubeRydLikeRatio(),

                        ...getPlaybackSnapshot()
                    };
                }


                const media =
                    await getProviderMediaSnapshot(
                        "youtube",
                        adapter
                    );


                if (
                    !media
                ) {
                    return null;
                }


                youtubeNowPlayingStaticCache = {
                    key:
                        staticKey,

                    title:
                        media.title,

                    image:
                        media.image,

                    url:
                        media.url,

                    identity:
                        media.identity
                };


                media.likeRatio =
                    getYouTubeRydLikeRatio();


                return media;
            }
        };

        adapter.getExtensionCapabilities = context =>
            getYouTubeAdapterExtensionCapabilities(context);
        adapter.getCapabilities = () =>
            getProviderCapabilities("youtube", adapter);

        return adapter;
    }

    registerProviderAdapter(
        "youtube",
        createYouTubeProviderAdapter
    );
