    async function startYouTubeUtilities() {
        if (
            getCurrentProvider() !==
                "youtube"
        ) {
            return;
        }


        const keys = [
            ...Object.keys(
                YOUTUBE_UTILITY_DEFAULTS
            )
        ];


        try {
            const stored =
                await chrome.storage.local.get(
                    keys
                );


            youtubeUtilitySettings = {
                ...YOUTUBE_UTILITY_DEFAULTS,
                ...stored
            };

        } catch {
        }


        setYouTubeThemeMarker();
        syncYouTubeCleanupMarkers();
        handleYouTubeUtilityNavigation();


        chrome.storage.onChanged.addListener(
            (
                changes,
                areaName
            ) => {
                if (
                    areaName !==
                        "local"
                ) {
                    return;
                }


                let relevant =
                    false;


                for (
                    const [key, change]
                    of Object.entries(
                        changes
                    )
                ) {
                    if (
                        !Object.prototype.hasOwnProperty.call(
                            YOUTUBE_UTILITY_DEFAULTS,
                            key
                        )
                    ) {
                        continue;
                    }


                    youtubeUtilitySettings[key] =
                        change.newValue ===
                            undefined
                            ? YOUTUBE_UTILITY_DEFAULTS[key]
                            : change.newValue;


                    relevant =
                        true;
                }


                if (
                    !relevant
                ) {
                    return;
                }


                setYouTubeThemeMarker();
                syncYouTubeCleanupMarkers();
                applyYouTubeUploadDate();
                syncYouTubeLoopSetting();
                dismissYouTubeContinueWatching();
                scheduleYouTubePreferredQuality();


                providerApiNotifyExtensionChange(
                    "youtubeUtilities",
                    {
                        reason: "settings"
                    }
                );
            }
        );


        document.addEventListener(
            "yt-navigate-finish",
            handleYouTubeUtilityNavigation,
            true
        );


        document.addEventListener(
            "yt-popup-opened",
            () => {
                scheduleYouTubeUtilityDomSync(
                    "popup",
                    0
                );
            },
            true
        );


        document.addEventListener(
            "loadedmetadata",
            () => {
                if (
                    !shouldProviderResourceObserveDom()
                ) {
                    return;
                }


                applyYouTubePreferredQuality(
                    true
                );


                applyYouTubeUploadDate();
                syncYouTubeLoopSetting();
            },
            true
        );


        syncYouTubeRuntimeObservers();


        onProviderResourceGovernorChange(
            state => {
                if (
                    state?.domObserversAllowed ===
                        true
                ) {
                    syncYouTubeRuntimeObservers();
                    scheduleYouTubeNavigationSettle();

                } else {
                    clearYouTubeUtilityDomTimer();
                    cancelYouTubeUtilitySettlePasses();
                    disconnectYouTubeRuntimeObservers();
                }
            }
        );


        youtubeAutoLikeTimer =
            createProviderResourceLoop(
                "youtube-auto-like",
                () => {
                    if (
                        shouldProviderResourceObserveDom()
                    ) {
                        runYouTubeAutoLike();
                    }
                },
                1000,
                "dom"
            );
    }

