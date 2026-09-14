    /*
     * ============================================================
     * YOUTUBE RUNTIME 0.17
     * ============================================================
     * No global documentElement observer. Each hot surface gets a narrow
     * observer and a small work queue. SPA navigation is handled by bounded
     * settle passes; the resource governor can park all DOM work.
     */

    function clearYouTubeUtilityDomTimer() {
        if (
            youtubeUtilityDomTimer
        ) {
            clearTimeout(
                youtubeUtilityDomTimer
            );


            youtubeUtilityDomTimer =
                null;
        }


        youtubeUtilityPendingWork.clear();
    }


    function cancelYouTubeUtilitySettlePasses() {
        youtubeUtilitySettleGeneration +=
            1;


        for (
            const timer
            of youtubeUtilitySettleTimers
        ) {
            clearTimeout(
                timer
            );
        }


        youtubeUtilitySettleTimers.clear();
    }


    function runYouTubeUtilityWork(
        kinds
    ) {
        const work =
            new Set(
                kinds
            );


        const all =
            work.has(
                "all"
            );


        if (
            all ||
            work.has(
                "guide"
            )
        ) {
            syncYouTubeTextCleanupTargets();
        }


        if (
            all ||
            work.has(
                "player"
            )
        ) {
            syncYouTubeAutoplaySetting();
            applyYouTubeUploadDate();
            syncYouTubeLoopSetting();
            dismissYouTubeTranslatedAudioSurvey();
        }


        if (
            all ||
            work.has(
                "popup"
            )
        ) {
            dismissYouTubeTranslatedAudioSurvey();
            dismissYouTubeContinueWatching();
        }


        if (
            all ||
            work.has(
                "shorts"
            )
        ) {
            syncYouTubeShortsLikeIcon();
            syncYouTubeShortsLikeObserver();
        }


        syncYouTubeRuntimeObservers();
    }


    function scheduleYouTubeUtilityDomSync(
        kind =
            "all",
        delay =
            120
    ) {
        if (
            !shouldProviderResourceObserveDom()
        ) {
            clearYouTubeUtilityDomTimer();
            return;
        }


        youtubeUtilityPendingWork.add(
            String(
                kind ||
                "all"
            )
        );


        if (
            youtubeUtilityDomTimer
        ) {
            return;
        }


        youtubeUtilityDomTimer =
            setTimeout(
                () => {
                    youtubeUtilityDomTimer =
                        null;


                    if (
                        !shouldProviderResourceObserveDom()
                    ) {
                        youtubeUtilityPendingWork.clear();
                        return;
                    }


                    const kinds =
                        [...youtubeUtilityPendingWork];


                    youtubeUtilityPendingWork.clear();


                    runYouTubeUtilityWork(
                        kinds
                    );
                },
                Math.max(
                    0,
                    Number(
                        delay
                    ) ||
                    0
                )
            );
    }


    function getYouTubeRuntimeObserverRoot(
        kind
    ) {
        if (
            kind ===
                "popup"
        ) {
            return document.querySelector(
                "ytd-popup-container"
            );
        }


        if (
            kind ===
                "player"
        ) {
            return document.getElementById(
                "movie_player"
            ) ||
                document.querySelector(
                    "ytd-watch-flexy"
                );
        }


        if (
            kind ===
                "guide"
        ) {
            return document.querySelector(
                "ytd-guide-renderer, #guide-content, tp-yt-app-drawer"
            );
        }


        return null;
    }


    function disconnectYouTubeRuntimeObserver(
        kind
    ) {
        try {
            youtubeRuntimeObservers[
                kind
            ]?.disconnect?.();
        } catch {
        }


        youtubeRuntimeObserverRoots[
            kind
        ] =
            null;
    }


    function disconnectYouTubeRuntimeObservers() {
        for (
            const kind
            of [
                "popup",
                "player",
                "guide"
            ]
        ) {
            disconnectYouTubeRuntimeObserver(
                kind
            );
        }


        youtubeRuntimeObserversActive =
            false;


        syncYouTubeShortsLikeObserver(
            false
        );
    }


    function ensureYouTubeRuntimeObserver(
        kind
    ) {
        const root =
            getYouTubeRuntimeObserverRoot(
                kind
            );


        if (
            !root
        ) {
            disconnectYouTubeRuntimeObserver(
                kind
            );
            return false;
        }


        if (
            youtubeRuntimeObserverRoots[
                kind
            ] ===
                root
        ) {
            return true;
        }


        disconnectYouTubeRuntimeObserver(
            kind
        );


        if (
            !youtubeRuntimeObservers[
                kind
            ]
        ) {
            youtubeRuntimeObservers[
                kind
            ] =
                new MutationObserver(
                    mutations => {
                        if (
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        if (
                            kind ===
                                "guide"
                        ) {
                            for (
                                const mutation
                                of mutations
                            ) {
                                for (
                                    const node
                                    of mutation.addedNodes
                                ) {
                                    if (
                                        node instanceof
                                            Element
                                    ) {
                                        syncYouTubeTextCleanupTargets(
                                            node
                                        );
                                    }
                                }
                            }


                            return;
                        }


                        scheduleYouTubeUtilityDomSync(
                            kind
                        );
                    }
                );
        }


        youtubeRuntimeObservers[
            kind
        ].observe(
            root,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );


        youtubeRuntimeObserverRoots[
            kind
        ] =
            root;


        return true;
    }


    function syncYouTubeRuntimeObservers() {
        if (
            typeof MutationObserver !==
                "function" ||
            isProviderSafeModeEnabled(
                "youtube"
            ) ||
            !shouldProviderResourceObserveDom()
        ) {
            disconnectYouTubeRuntimeObservers();
            return false;
        }


        const states =
            [
                "popup",
                "player",
                "guide"
            ].map(
                ensureYouTubeRuntimeObserver
            );


        syncYouTubeShortsLikeObserver();


        youtubeRuntimeObserversActive =
            states.some(
                Boolean
            );


        return youtubeRuntimeObserversActive;
    }


    function scheduleYouTubeNavigationSettle() {
        cancelYouTubeUtilitySettlePasses();


        if (
            !shouldProviderResourceObserveDom()
        ) {
            return;
        }


        const generation =
            youtubeUtilitySettleGeneration;


        for (
            const delay
            of [
                0,
                120,
                350,
                900,
                1800
            ]
        ) {
            const timer =
                setTimeout(
                    () => {
                        youtubeUtilitySettleTimers.delete(
                            timer
                        );


                        if (
                            generation !==
                                youtubeUtilitySettleGeneration ||
                            !shouldProviderResourceObserveDom()
                        ) {
                            return;
                        }


                        syncYouTubeRuntimeObservers();
                        scheduleYouTubeUtilityDomSync(
                            "all",
                            0
                        );
                    },
                    delay
                );


            youtubeUtilitySettleTimers.add(
                timer
            );
        }
    }


    function handleYouTubeUtilityNavigation() {
        restoreYouTubeUploadDate();
        clearYouTubeTextCleanupTargets();

        youtubeTranslatedAudioSurveyLastScanAt =
            0;

        youtubeLastQualityVideoId =
            "";

        youtubeNowPlayingStaticCache =
            null;


        scheduleYouTubePreferredQuality();

        disconnectYouTubeRuntimeObservers();
        scheduleYouTubeNavigationSettle();


        providerApiNotifyExtensionChange(
            "youtubeUtilities",
            {
                reason:
                    "navigation"
            }
        );
    }


    function getYouTubeRuntimeDiagnosticState() {
        return {
            globalObserver:
                false,

            observersActive:
                youtubeRuntimeObserversActive,

            observers: {
                popup:
                    Boolean(
                        youtubeRuntimeObserverRoots.popup
                    ),

                player:
                    Boolean(
                        youtubeRuntimeObserverRoots.player
                    ),

                guide:
                    Boolean(
                        youtubeRuntimeObserverRoots.guide
                    ),

                shortsLike:
                    Boolean(
                        youtubeShortsLikeObserverRoot
                    )
            },

            pendingWork:
                [...youtubeUtilityPendingWork],

            settlePasses:
                youtubeUtilitySettleTimers.size,

            domTimer:
                Boolean(
                    youtubeUtilityDomTimer
                )
        };
    }
