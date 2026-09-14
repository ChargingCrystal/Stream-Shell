    async function extractNowPlaying(
        provider
    ) {
        const adapter =
            getProviderAdapter(
                provider
            );


        if (
            !adapter
        ) {
            return null;
        }


        return adapter
            .getMediaSnapshot();
    }


    function startNowPlayingTracking() {
        const provider =
            getCurrentProvider();


        if (
            !provider
        ) {
            return;
        }


        const providerAdapter =
            getProviderAdapter(
                provider
            );


        if (
            !providerAdapter
        ) {
            return;
        }


        const isCurrentWatchContext =
            () => providerAdapter
                .isWatchContext?.() ===
                true;


        const storageKey =
            `${NOW_PLAYING_KEY_PREFIX}${provider}`;


        let lastSignature =
            null;


        let currentSessionIdentity =
            null;


        let sessionStartedAt =
            null;


        let lastStableMedia =
            null;


        let lastStableWatchIdentity =
            null;


        let lastContinueWriteAt =
            0;


        let lastContinueIdentity =
            null;


        async function canPublishWhileHidden() {
            if (
                document.visibilityState !==
                    "hidden"
            ) {
                return true;
            }


            try {
                const response =
                    await chrome.runtime.sendMessage({
                        type:
                            "provider-now-playing-eligible"
                    });


                return Boolean(
                    response?.eligible
                );

            } catch {
                return false;
            }
        }


        async function publish(
            forceContinueWrite = false
        ) {
            const eligible =
                await canPublishWhileHidden();


            const watchIdentity =
                `${provider}:${window.location.pathname}${window.location.search}`;


            const canReuseNetflixMedia =
                provider ===
                    "netflix" &&
                eligible &&
                isCurrentWatchContext() &&
                lastStableMedia &&
                lastStableWatchIdentity ===
                    watchIdentity &&
                Boolean(
                    getPrimaryVideo()
                );


            let media =
                canReuseNetflixMedia
                    ? {
                        ...lastStableMedia,
                        url:
                            window.location.href,
                        ...getPlaybackSnapshot()
                    }
                    : eligible
                        ? await extractNowPlaying(
                            provider
                        )
                        : null;


            /*
             * RYD can briefly remove/recreate its tooltip while YouTube
             * changes player/layout state. Once a valid ratio has been seen
             * for this exact watch URL, keep it until RYD publishes a newer
             * valid value or navigation changes the watch identity.
             */
            if (
                provider === "youtube" &&
                media &&
                !Number.isFinite(media.likeRatio) &&
                lastStableMedia &&
                lastStableWatchIdentity === watchIdentity &&
                Number.isFinite(lastStableMedia.likeRatio)
            ) {
                media.likeRatio =
                    lastStableMedia.likeRatio;
            }


            if (
                media
            ) {
                lastStableMedia =
                    {
                        ...media
                    };

                lastStableWatchIdentity =
                    watchIdentity;

            } else if (
                eligible &&
                isCurrentWatchContext() &&
                lastStableMedia &&
                lastStableWatchIdentity ===
                    watchIdentity
            ) {
                /*
                 * Provider controls are often removed from the DOM after a
                 * few idle seconds. Keep the last valid metadata while the
                 * same watch URL and video are still alive; only playback
                 * state/progress needs to be refreshed.
                 */
                const playback =
                    getPlaybackSnapshot();


                if (
                    getPrimaryVideo()
                ) {
                    media = {
                        ...lastStableMedia,
                        url:
                            window.location.href,
                        ...playback
                    };
                }
            }


            if (
                !isCurrentWatchContext()
            ) {
                lastStableMedia =
                    null;

                lastStableWatchIdentity =
                    null;
            }


            if (
                media
            ) {
                const identity =
                    JSON.stringify([
                        media.title,
                        media.url
                    ]);


                if (
                    identity !==
                    currentSessionIdentity
                ) {
                    currentSessionIdentity =
                        identity;


                    sessionStartedAt =
                        Date.now();
                }


                media.sessionStartedAt =
                    sessionStartedAt;
            } else {
                currentSessionIdentity =
                    null;


                sessionStartedAt =
                    null;
            }


            if (
                media &&
                Number.isFinite(
                    media.currentTime
                ) &&
                Number.isFinite(
                    media.duration
                ) &&
                media.duration > 0
            ) {
                const now =
                    Date.now();


                const continueIdentity =
                    media.identity ||
                    getProviderMediaIdentity(
                        provider,
                        media.url
                    );


                const progressPercent =
                    media.currentTime /
                    media.duration *
                    100;


                const completionChanged =
                    progressPercent >=
                        continueWatchingCompletePercent &&
                    continueIdentity !==
                        lastContinueIdentity;


                if (
                    forceContinueWrite ||
                    completionChanged ||
                    now - lastContinueWriteAt >=
                        10000
                ) {
                    lastContinueWriteAt =
                        now;

                    lastContinueIdentity =
                        continueIdentity;


                    updateContinueWatching(
                        media
                    ).catch(
                        () => {}
                    );
                }
            }


            const signature =
                media
                    ? JSON.stringify([
                        media.title,
                        media.image,
                        media.url,
                        media.likeRatio,
                        media.playbackState,
                        Number.isFinite(
                            media.currentTime
                        )
                            ? media.playbackState ===
                                "playing"
                                ? Math.floor(
                                    media.currentTime /
                                    60
                                )
                                : Math.floor(
                                    media.currentTime
                                )
                            : null,
                        Number.isFinite(
                            media.duration
                        )
                            ? Math.floor(
                                media.duration
                            )
                            : null,
                        sessionStartedAt
                            ? Math.floor(
                                (
                                    Date.now() -
                                    sessionStartedAt
                                ) /
                                60000
                            )
                            : null
                    ])
                    : "__none__";


            if (
                signature ===
                lastSignature
            ) {
                return;
            }


            lastSignature =
                signature;


            try {
                if (
                    media
                ) {
                    await chrome.storage.local.set({
                        [storageKey]: {
                            ...media,

                            updatedAt:
                                Date.now()
                        }
                    });

                } else {

                    await chrome.storage.local.remove(
                        storageKey
                    );
                }
            } catch {
            }
        }


        publish();


        createProviderResourceLoop(
            `now-playing-${provider}`,
            publish,
            1500,
            "metadata"
        );


        const forcePublish =
            (forceContinueWrite = false) => {
                lastSignature =
                    null;

                publish(
                    forceContinueWrite
                );
            };


        providerApiOn(
            "continuethresholdchange",
            () => {
                forcePublish(true);
            }
        );


        providerApiOn(
            "statechange",
            event => {
                const reason =
                    event?.reason ||
                    "statechange";


                forcePublish(
                    reason === "pause" ||
                    reason === "ended" ||
                    reason === "seeked"
                );
            }
        );
    }


