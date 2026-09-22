const PROVIDER_NAMES = {
    youtube:
        "YouTube",

    netflix:
        "Netflix",

    prime:
        "Prime Video",

    disney:
        "Disney+",

    crunchyroll:
        "Crunchyroll"
};


const PROVIDERS =
    new Set(
        Object.keys(
            PROVIDER_NAMES
        )
    );


const WORDMARKS = {
    youtube:
        "assets/providers/wordmarks/youtube.svg",

    netflix:
        "assets/providers/wordmarks/netflix.svg",

    prime:
        "assets/providers/wordmarks/prime.svg",

    disney:
        "assets/providers/wordmarks/disney.svg",

    crunchyroll:
        "assets/providers/wordmarks/crunchyroll.svg"
};


const RIGHT_MODE_NAMES = {
    dashboard:
        "Dashboard",

    discord:
        "Discord"
};


const clock =
    document.getElementById(
        "clock"
    );


const date =
    document.getElementById(
        "date"
    );


const brandArea =
    document.getElementById(
        "brand-area"
    );


const leftStatus =
    document.getElementById(
        "left-status"
    );


const rightStatus =
    document.getElementById(
        "right-status"
    );


const statusGroup =
    document.querySelector(
        ".status-group"
    );


const nowPlayingSlot =
    document.getElementById(
        "now-playing-slot"
    );


const nowPlayingPanel =
    document.getElementById(
        "now-playing"
    );


const nowPlayingSettingsButton =
    document.getElementById(
        "now-playing-settings"
    );


const settingsCenter =
    document.getElementById(
        "settings-center"
    );


const settingsProviderTabs =
    document.getElementById(
        "settings-provider-tabs"
    );


const settingsSidebar =
    document.getElementById(
        "settings-sidebar"
    );


const settingsContent =
    document.getElementById(
        "settings-content"
    );


const settingsImportFile =
    document.getElementById(
        "settings-import-file"
    );

const settingsIoStatus =
    document.getElementById(
        "settings-io-status"
    );


const settingsDiagnosticsOverlay =
    document.getElementById(
        "settings-diagnostics-overlay"
    );

const settingsDiagnosticsContent =
    document.getElementById(
        "settings-diagnostics-content"
    );

const settingsDiagnosticsStatus =
    document.getElementById(
        "settings-diagnostics-status"
    );

const reloadLeftSlot =
    document.getElementById(
        "reload-left-slot"
    );


const reloadLeftButton =
    document.getElementById(
        "reload-left"
    );


const nowPlayingArtwork =
    document.getElementById(
        "now-playing-artwork"
    );


const nowPlayingTitleViewport =
    document.getElementById(
        "now-playing-title-viewport"
    );


const nowPlayingTitle =
    document.getElementById(
        "now-playing-title"
    );


const nowPlayingState =
    document.getElementById(
        "now-playing-state"
    );


const nowPlayingRating =
    document.getElementById(
        "now-playing-rating"
    );


const nowPlayingProgress =
    document.getElementById(
        "now-playing-progress"
    );


const nowPlayingTime =
    document.getElementById(
        "now-playing-time"
    );


const panorama =
    document.getElementById(
        "panorama-background"
    );


const providerWordmark =
    document.getElementById(
        "provider-wordmark"
    );


const SELECTED_MEDIA_KEY =
    "streamShellSelectedMedia";


const SELECTED_AVAILABILITY_KEY =
    "streamShellSelectedAvailability";


const NOW_PLAYING_KEY_PREFIX =
    "streamShellNowPlaying_";


const NOW_PLAYING_KEYS =
    Object.fromEntries(
        Object.keys(
            PROVIDER_NAMES
        ).map(
            provider => [
                provider,
                `${NOW_PLAYING_KEY_PREFIX}${provider}`
            ]
        )
    );


let selectedMedia =
    null;


let selectedAvailability =
    null;


let nowPlayingByProvider =
    {};


let currentLeftMode =
    "landing";


let nowPlayingMarqueeSignature =
    "";


const nowPlayingArtworkFallbacks =
    new Map();


const nowPlayingTmdbMatches =
    new Map();


const failedNowPlayingArtworkSources =
    new Set();


/*
 * ============================================================
 * CONTEXTUAL DASHBOARD MOTION
 * ============================================================
 */

function syncContextualSlotWidth(
    slot,
    control
) {
    if (
        !slot ||
        !control ||
        slot.hidden
    ) {
        return;
    }


    const width =
        Math.ceil(
            control
                .getBoundingClientRect()
                .width
        );


    if (
        width > 0
    ) {
        slot.style.setProperty(
            "--contextual-slot-width",
            `${width}px`
        );
    }
}


function setContextualControlVisible(
    slot,
    control,
    visible
) {
    if (
        !slot ||
        !control
    ) {
        return;
    }


    const shouldShow =
        Boolean(
            visible
        );


    slot.dataset.requestedVisible =
        shouldShow
            ? "true"
            : "false";


    if (
        shouldShow
    ) {
        if (
            slot.hidden
        ) {
            slot.hidden =
                false;


            control.hidden =
                false;


            slot.classList.remove(
                "visible"
            );


            slot.classList.add(
                "measuring"
            );


            const measuredWidth =
                Math.ceil(
                    control
                        .getBoundingClientRect()
                        .width
                );


            slot.classList.remove(
                "measuring"
            );


            if (
                measuredWidth > 0
            ) {
                slot.style.setProperty(
                    "--contextual-slot-width",
                    `${measuredWidth}px`
                );
            }


            void slot.offsetWidth;
        }


        syncContextualSlotWidth(
            slot,
            control
        );


        requestAnimationFrame(
            () => {
                if (
                    slot.dataset.requestedVisible ===
                    "true"
                ) {
                    slot.classList.add(
                        "visible"
                    );
                }
            }
        );


        return;
    }


    if (
        slot.hidden
    ) {
        return;
    }


    syncContextualSlotWidth(
        slot,
        control
    );


    slot.classList.remove(
        "visible"
    );


    const finish =
        () => {
            if (
                slot.dataset.requestedVisible ===
                "false" &&
                !slot.classList.contains(
                    "visible"
                )
            ) {
                slot.hidden =
                    true;


                control.hidden =
                    true;
            }
        };


    setTimeout(
        finish,
        220
    );
}
/*
 * ============================================================
 * NOW PLAYING
 * ============================================================
 */

function syncNowPlayingWidth() {
    if (
        !statusGroup ||
        !nowPlayingPanel
    ) {
        return;
    }


    const width =
        Math.round(
            statusGroup
                .getBoundingClientRect()
                .width
        );


    if (
        width > 0
    ) {
        nowPlayingPanel.style.width =
            `${width}px`;


        syncContextualSlotWidth(
            nowPlayingSlot,
            nowPlayingPanel
        );
    }
}


function refreshNowPlayingMarquee(
    force = false
) {
    if (
        !nowPlayingTitle ||
        !nowPlayingTitleViewport
    ) {
        return;
    }


    requestAnimationFrame(
        () => {
            const viewportWidth =
                Math.max(
                    0,
                    Math.round(
                        nowPlayingTitleViewport.clientWidth
                    )
                );


            const overflow =
                Math.ceil(
                    nowPlayingTitle.scrollWidth -
                    viewportWidth
                );


            if (
                overflow <= 2
            ) {
                nowPlayingMarqueeSignature =
                    "";


                nowPlayingTitle.classList.remove(
                    "scrolling"
                );


                nowPlayingTitle.style.removeProperty(
                    "--now-playing-scroll-distance"
                );


                nowPlayingTitle.style.removeProperty(
                    "--now-playing-scroll-duration"
                );


                return;
            }


            const distance =
                overflow + 18;


            const duration =
                Math.max(
                    14,
                    Math.min(
                        30,
                        10 +
                        distance / 24
                    )
                );


            const signature =
                JSON.stringify([
                    nowPlayingTitle.textContent,
                    viewportWidth,
                    distance,
                    duration
                ]);


            /*
             * Playback progress updates every ~1.5 seconds. Do not restart
             * an already-correct marquee on every progress tick; otherwise
             * a playing title never survives the animation delay long enough
             * to visibly move.
             */
            if (
                !force &&
                signature ===
                    nowPlayingMarqueeSignature &&
                nowPlayingTitle.classList.contains(
                    "scrolling"
                )
            ) {
                return;
            }


            nowPlayingMarqueeSignature =
                signature;


            nowPlayingTitle.classList.remove(
                "scrolling"
            );


            nowPlayingTitle.style.setProperty(
                "--now-playing-scroll-distance",
                `${distance}px`
            );


            nowPlayingTitle.style.setProperty(
                "--now-playing-scroll-duration",
                `${duration}s`
            );


            /*
             * Force a fresh animation only when title/layout actually changed.
             */
            void nowPlayingTitle.offsetWidth;


            nowPlayingTitle.classList.add(
                "scrolling"
            );
        }
    );
}



function setNowPlayingArtwork(
    src,
    onError = null
) {
    const value =
        String(
            src ||
            ""
        ).trim();


    if (
        value &&
        nowPlayingArtwork.dataset.streamShellSource ===
            value &&
        nowPlayingArtwork.hasAttribute(
            "src"
        )
    ) {
        return;
    }


    nowPlayingPanel.classList.remove(
        "has-artwork"
    );


    nowPlayingPanel.style.removeProperty(
        "--now-playing-artwork-width"
    );


    nowPlayingArtwork.removeAttribute(
        "src"
    );


    delete nowPlayingArtwork.dataset.streamShellSource;


    if (
        !/^https?:\/\//i.test(
            value
        )
    ) {
        return;
    }


    nowPlayingArtwork.referrerPolicy =
        "no-referrer";


    nowPlayingArtwork.onload =
        () => {
            const naturalWidth =
                Number(
                    nowPlayingArtwork.naturalWidth
                );


            const naturalHeight =
                Number(
                    nowPlayingArtwork.naturalHeight
                );


            if (
                Number.isFinite(
                    naturalWidth
                ) &&
                Number.isFinite(
                    naturalHeight
                ) &&
                naturalWidth > 0 &&
                naturalHeight > 0
            ) {
                /*
                 * Keep the artwork height fixed while matching the real
                 * image ratio. This naturally yields 96x54 for 16:9,
                 * 54x54 for square art and ~36x54 for a 2:3 poster.
                 * Clamp only pathological extremes so one odd asset cannot
                 * consume the whole footer.
                 */
                const ratio =
                    Math.max(
                        0.6,
                        Math.min(
                            16 / 9,
                            naturalWidth /
                                naturalHeight
                        )
                    );


                const width =
                    Math.round(
                        54 * ratio * 10
                    ) / 10;


                nowPlayingPanel.style.setProperty(
                    "--now-playing-artwork-width",
                    `${width}px`
                );
            }


            nowPlayingPanel.classList.add(
                "has-artwork"
            );


            refreshNowPlayingMarquee(
                true
            );
        };


    nowPlayingArtwork.onerror =
        () => {
            nowPlayingPanel.classList.remove(
                "has-artwork"
            );


            nowPlayingPanel.style.removeProperty(
                "--now-playing-artwork-width"
            );


            nowPlayingArtwork.removeAttribute(
                "src"
            );


            delete nowPlayingArtwork.dataset.streamShellSource;


            if (
                typeof onError ===
                    "function"
            ) {
                onError();
            }
        };


    nowPlayingArtwork.dataset.streamShellSource =
        value;


    nowPlayingArtwork.src =
        value;
}


function formatPlaybackTime(
    seconds
) {
    const value =
        Number(
            seconds
        );


    if (
        !Number.isFinite(
            value
        ) ||
        value < 0
    ) {
        return "--:--";
    }


    const total =
        Math.floor(
            value
        );


    const hours =
        Math.floor(
            total / 3600
        );


    const minutes =
        Math.floor(
            (total % 3600) / 60
        );


    const secs =
        total % 60;


    if (
        hours > 0
    ) {
        return `${hours}:${String(
            minutes
        ).padStart(
            2,
            "0"
        )}:${String(
            secs
        ).padStart(
            2,
            "0"
        )}`;
    }


    return `${minutes}:${String(
        secs
    ).padStart(
        2,
        "0"
    )}`;
}


function formatSessionAge(
    startedAt
) {
    const value =
        Number(
            startedAt
        );


    if (
        !Number.isFinite(
            value
        ) ||
        value <= 0
    ) {
        return "";
    }


    const elapsedMinutes =
        Math.max(
            0,
            Math.floor(
                (
                    Date.now() -
                    value
                ) / 60000
            )
        );


    if (
        elapsedMinutes < 60
    ) {
        return `${elapsedMinutes}m`;
    }


    const hours =
        Math.floor(
            elapsedMinutes / 60
        );


    const minutes =
        elapsedMinutes % 60;


    return minutes
        ? `${hours}h ${minutes}m`
        : `${hours}h`;
}


function getPlaybackLabel(
    state
) {
    const labels = {
        playing:
            "PLAYING",

        paused:
            "PAUSED",

        ready:
            "READY",

        ended:
            "ENDED",

        unknown:
            "ACTIVE"
    };


    return (
        labels[
            state
        ] ||
        "ACTIVE"
    );
}


function renderProviderPlaybackIndicators() {
    const visibleProvider =
        PROVIDERS.has(
            currentLeftMode
        )
            ? currentLeftMode
            : null;


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                const buttonProvider =
                    button.dataset.provider;


                const media =
                    nowPlayingByProvider[
                        buttonProvider
                    ];


                const state =
                    media?.playbackState ||
                    "unknown";


                /*
                 * A provider may keep a valid player document alive while its
                 * window is minimized underneath the currently selected one.
                 * The dashboard indicator is intentionally about what is on
                 * the left side NOW, not about stale/background player state.
                 */
                const compactLayout =
                    document.body?.dataset?.layoutProfile ===
                        "compact";


                const active =
                    compactLayout
                        ? Boolean(
                            media?.title
                        ) &&
                        (
                            state === "playing" ||
                            state === "paused" ||
                            state === "ready"
                        )
                        : (
                            buttonProvider ===
                                visibleProvider &&
                            Boolean(
                                media?.title
                            )
                        );


                button.classList.toggle(
                    "now-playing-active",
                    active
                );


                button.classList.toggle(
                    "now-playing-paused",
                    active &&
                    (
                        state ===
                            "paused" ||
                        state ===
                            "ready"
                    )
                );
            }
        );
}


function normalizeNowPlayingArtworkQuery(
    rawTitle
) {
    let title =
        String(
            rawTitle ||
            ""
        ).trim();


    if (
        !title
    ) {
        return "";
    }


    /*
     * Player titles often append episode metadata to the show name, e.g.
     * "Rick and Morty E7: ...". TMDB works much better with the series
     * title than with the complete episode label.
     */
    title =
        title
            .replace(
                /\s+(?:S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*)?E(?:P(?:ISODE)?)?\s*\d+.*$/i,
                ""
            )
            .replace(
                /\s+S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*F(?:olge)?\s*\d+.*$/i,
                ""
            )
            .replace(
                /\s+[·–—-]\s*(?:S\d+\s*)?E\d+\b.*$/i,
                ""
            )
            .replace(
                /\s+[·–—-]\s*(?:Episode|Folge|Chapter|Kapitel)\s+\d+\b.*$/i,
                ""
            )
            .replace(
                /\s+(?:Episode|Folge|Chapter|Kapitel)\s+\d+\b.*$/i,
                ""
            )
            .replace(
                /\s*[·–—-]\s*$/,
                ""
            )
            .trim();


    return title;
}


async function resolveNowPlayingTmdbMatch(
    provider,
    rawTitle
) {
    if (
        provider ===
            "youtube"
    ) {
        return null;
    }


    const query =
        normalizeNowPlayingArtworkQuery(
            rawTitle
        );


    if (
        query.length <
            2
    ) {
        return null;
    }


    const cacheKey =
        `${provider}|${query.toLowerCase()}`;


    if (
        nowPlayingTmdbMatches.has(
            cacheKey
        )
    ) {
        return nowPlayingTmdbMatches.get(
            cacheKey
        );
    }


    const promise =
        (async () => {
            try {
                const api =
                    window.StreamShellMediaApi;


                if (
                    !api ||
                    !await api.hasToken()
                ) {
                    return null;
                }


                const results =
                    await api.searchMedia(
                        query
                    );


                if (
                    !Array.isArray(
                        results
                    ) ||
                    results.length ===
                        0
                ) {
                    return null;
                }


                const normalizedQuery =
                    query.toLocaleLowerCase();


                return results.find(
                    item =>
                        [
                            item.title,
                            item.originalTitle
                        ]
                            .filter(Boolean)
                            .some(
                                value =>
                                    String(
                                        value
                                    )
                                        .trim()
                                        .toLocaleLowerCase() ===
                                    normalizedQuery
                            )
                ) ||
                results[0] ||
                null;

            } catch {
                return null;
            }
        })();


    nowPlayingTmdbMatches.set(
        cacheKey,
        promise
    );


    const result =
        await promise;


    nowPlayingTmdbMatches.set(
        cacheKey,
        result
    );


    return result;
}


async function resolveNowPlayingArtworkFallback(
    provider,
    rawTitle
) {
    if (
        provider ===
            "youtube"
    ) {
        return "";
    }


    const query =
        normalizeNowPlayingArtworkQuery(
            rawTitle
        );


    if (
        query.length <
            2
    ) {
        return "";
    }


    const cacheKey =
        `${provider}|${query.toLowerCase()}`;


    if (
        nowPlayingArtworkFallbacks.has(
            cacheKey
        )
    ) {
        return nowPlayingArtworkFallbacks.get(
            cacheKey
        );
    }


    const promise =
        resolveNowPlayingTmdbMatch(
            provider,
            rawTitle
        )
            .then(
                match =>
                    String(
                        match?.backdropUrl ||
                        match?.posterUrl ||
                        ""
                    ).trim()
            );


    nowPlayingArtworkFallbacks.set(
        cacheKey,
        promise
    );


    const result =
        await promise;


    nowPlayingArtworkFallbacks.set(
        cacheKey,
        result
    );


    return result;
}


async function applyNowPlayingRating(
    provider,
    media
) {
    if (!nowPlayingRating) return;

    const clearRating = () => {
        nowPlayingRating.hidden = true;
        nowPlayingRating.textContent = "";
        nowPlayingRating.title = "";
        delete nowPlayingRating.dataset.identity;
        delete nowPlayingRating.dataset.ratingKind;
        nowPlayingPanel?.classList.remove("has-rating");
    };

    if (!media?.title) {
        clearRating();
        return;
    }

    if (provider === "youtube") {
        if (
            media.likeRatio === null ||
            media.likeRatio === undefined ||
            media.likeRatio === ""
        ) {
            clearRating();
            return;
        }

        const ratio = Number(media.likeRatio);
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
            clearRating();
            return;
        }

        const like = Math.min(100, Math.max(0, ratio));
        const dislike = Math.max(0, 100 - like);
        const likeText = like.toFixed(1);
        const dislikeText = dislike.toFixed(1);

        nowPlayingRating.dataset.identity = `youtube|${media.url || media.title}`;
        nowPlayingRating.dataset.ratingKind = "youtube";
        nowPlayingRating.textContent = `👍 ${likeText}% · 👎 ${dislikeText}%`;
        nowPlayingRating.title = "Like / dislike ratio from Return YouTube Dislike";
        nowPlayingRating.hidden = false;
        nowPlayingPanel?.classList.add("has-rating");
        return;
    }

    const rawTitle = String(media.title || "").trim();
    const title = provider === "netflix"
        ? normalizeNowPlayingArtworkQuery(rawTitle) || rawTitle
        : rawTitle;
    const identity = `${provider}|${title}`;

    if (
        nowPlayingRating.dataset.identity === identity &&
        nowPlayingRating.dataset.ratingKind === "tmdb" &&
        !nowPlayingRating.hidden &&
        nowPlayingRating.textContent
    ) {
        return;
    }

    nowPlayingRating.hidden = true;
    nowPlayingRating.textContent = "";
    nowPlayingRating.dataset.identity = identity;
    nowPlayingRating.dataset.ratingKind = "tmdb";
    nowPlayingPanel?.classList.remove("has-rating");

    const match = await resolveNowPlayingTmdbMatch(provider, rawTitle);
    const currentProvider = currentLeftMode;
    const currentRawTitle = String(
        nowPlayingByProvider[currentProvider]?.title || ""
    ).trim();
    const currentTitle = currentProvider === "netflix"
        ? normalizeNowPlayingArtworkQuery(currentRawTitle) || currentRawTitle
        : currentRawTitle;
    const currentIdentity = `${currentProvider}|${currentTitle}`;

    if (
        identity !== currentIdentity ||
        nowPlayingRating.dataset.identity !== identity
    ) {
        return;
    }

    const rating = Number(match?.rating);
    if (!Number.isFinite(rating) || rating <= 0) return;

    const display = rating.toFixed(1);
    nowPlayingRating.textContent = `TMDB ${display}`;
    nowPlayingRating.title = `TMDB rating ${display} / 10`;
    nowPlayingRating.hidden = false;
    nowPlayingPanel?.classList.add("has-rating");
}


function applyNowPlayingArtwork(
    provider,
    media
) {
    const directArtwork =
        String(
            media?.image ||
            ""
        ).trim();


    const title =
        String(
            media?.title ||
            ""
        ).trim();


    const identity =
        `${provider}|${title}`;


    const identityIsCurrent =
        () =>
            currentLeftMode ===
                provider &&
            `${provider}|${String(
                nowPlayingByProvider[
                    provider
                ]?.title ||
                ""
            ).trim()}` ===
                identity;


    const applyFallback =
        async (
            fallbackOnMiss =
                ""
        ) => {
            const fallback =
                await resolveNowPlayingArtworkFallback(
                    provider,
                    title
                );


            if (
                !identityIsCurrent()
            ) {
                return;
            }


            if (
                fallback
            ) {
                setNowPlayingArtwork(
                    fallback
                );

                return;
            }


            if (
                fallbackOnMiss &&
                !failedNowPlayingArtworkSources.has(
                    fallbackOnMiss
                )
            ) {
                setNowPlayingArtwork(
                    fallbackOnMiss
                );

                return;
            }


            setNowPlayingArtwork(
                ""
            );
        };


    if (
        provider ===
            "netflix"
    ) {
        /*
         * Netflix now supplies artwork from its member metadata endpoint.
         * Prefer that real title artwork first; TMDB remains the safety net
         * if Netflix returns nothing or the image cannot be loaded.
         */
        if (
            directArtwork &&
            !failedNowPlayingArtworkSources.has(
                directArtwork
            )
        ) {
            setNowPlayingArtwork(
                directArtwork,
                () => {
                    failedNowPlayingArtworkSources.add(
                        directArtwork
                    );

                    applyFallback();
                }
            );

            return;
        }


        applyFallback();

        return;
    }


    if (
        directArtwork &&
        !failedNowPlayingArtworkSources.has(
            directArtwork
        )
    ) {
        /*
         * Some providers expose an URL that exists in metadata but cannot be
         * hot-linked from an extension page. If the image element rejects it,
         * remember that source and fall back to the TMDB backdrop instead of
         * retrying the same broken URL on every progress update.
         */
        setNowPlayingArtwork(
            directArtwork,
            () => {
                failedNowPlayingArtworkSources.add(
                    directArtwork
                );


                applyFallback();
            }
        );


        return;
    }


    applyFallback();
}


function getLiveNowPlayingCurrentTime(
    media
) {
    let currentTime =
        Number(
            media?.currentTime
        );


    if (
        !Number.isFinite(
            currentTime
        ) ||
        currentTime < 0
    ) {
        return null;
    }


    if (
        media?.playbackState ===
            "playing" &&
        Number.isFinite(
            Number(
                media?.updatedAt
            )
        )
    ) {
        currentTime +=
            Math.max(
                0,
                Date.now() -
                    Number(
                        media.updatedAt
                    )
            ) /
            1000;
    }


    const duration =
        Number(
            media?.duration
        );


    if (
        Number.isFinite(
            duration
        ) &&
        duration > 0
    ) {
        currentTime =
            Math.min(
                currentTime,
                duration
            );
    }


    return currentTime;
}


function refreshNowPlayingProgress() {
    const provider =
        PROVIDERS.has(
            currentLeftMode
        )
            ? currentLeftMode
            : null;


    const media =
        provider
            ? nowPlayingByProvider[
                provider
            ]
            : null;


    if (
        !media?.title
    ) {
        return;
    }


    const currentTime =
        getLiveNowPlayingCurrentTime(
            media
        );


    const duration =
        Number(
            media.duration
        );


    const hasCurrentTime =
        Number.isFinite(
            currentTime
        ) &&
        currentTime >= 0;


    const hasDuration =
        Number.isFinite(
            duration
        ) &&
        duration > 0;


    const progress =
        (
            hasCurrentTime &&
            hasDuration
        )
            ? Math.max(
                0,
                Math.min(
                    100,
                    currentTime /
                    duration *
                    100
                )
            )
            : 0;


    nowPlayingProgress.style.width =
        `${progress}%`;


    nowPlayingTime.textContent =
        `${formatPlaybackTime(
            hasCurrentTime
                ? currentTime
                : null
        )} / ${formatPlaybackTime(
            hasDuration
                ? duration
                : null
        )}`;


    nowPlayingState.textContent =
        [
            getPlaybackLabel(
                String(
                    media.playbackState ||
                    "unknown"
                )
            ),
            formatSessionAge(
                media.sessionStartedAt
            )
        ]
            .filter(Boolean)
            .join(
                " · "
            );
}


function renderNowPlaying() {
    const provider =
        PROVIDERS.has(
            currentLeftMode
        )
            ? currentLeftMode
            : null;


    const media =
        provider
            ? nowPlayingByProvider[
                provider
            ]
            : null;


    renderProviderPlaybackIndicators();


    if (
        !media?.title
    ) {
        setContextualControlVisible(
            nowPlayingSlot,
            nowPlayingPanel,
            false
        );


        nowPlayingPanel.classList.add(
            "empty"
        );


        nowPlayingPanel.removeAttribute(
            "data-provider"
        );


        nowPlayingPanel.dataset.playbackState =
            "unknown";


        nowPlayingPanel.setAttribute(
            "aria-disabled",
            "true"
        );


        nowPlayingPanel.tabIndex =
            -1;


        nowPlayingPanel.title =
            "No active player";


        nowPlayingTitle.textContent =
            "Nothing playing";


        nowPlayingState.textContent =
            "—";


        if (
            nowPlayingRating
        ) {
            nowPlayingRating.hidden =
                true;
            nowPlayingRating.textContent =
                "";
            delete nowPlayingRating.dataset.identity;
            delete nowPlayingRating.dataset.ratingKind;
            nowPlayingPanel.classList.remove(
                "has-rating"
            );
        }


        nowPlayingProgress.style.width =
            "0%";


        nowPlayingTime.textContent =
            "--:-- / --:--";


        setNowPlayingArtwork(
            ""
        );


        refreshNowPlayingMarquee();

        return;
    }


    const playbackState =
        String(
            media.playbackState ||
            "unknown"
        );


    const currentTime =
        getLiveNowPlayingCurrentTime(
            media
        );


    const duration =
        Number(
            media.duration
        );


    const hasCurrentTime =
        Number.isFinite(
            currentTime
        ) &&
        currentTime >= 0;


    const hasDuration =
        Number.isFinite(
            duration
        ) &&
        duration > 0;


    const progress =
        (
            hasCurrentTime &&
            hasDuration
        )
            ? Math.max(
                0,
                Math.min(
                    100,
                    currentTime /
                    duration *
                    100
                )
            )
            : 0;


    const sessionAge =
        formatSessionAge(
            media.sessionStartedAt
        );


    setContextualControlVisible(
        nowPlayingSlot,
        nowPlayingPanel,
        true
    );


    nowPlayingPanel.classList.remove(
        "empty"
    );


    nowPlayingPanel.dataset.provider =
        provider;


    if (
        nowPlayingSettingsButton
    ) {
        const providerName =
            PROVIDER_NAMES[provider] ||
            provider;


        nowPlayingSettingsButton.title =
            `${providerName} settings`;


        nowPlayingSettingsButton.setAttribute(
            "aria-label",
            `Open ${providerName} settings`
        );
    }


    nowPlayingPanel.dataset.playbackState =
        playbackState;


    nowPlayingPanel.setAttribute(
        "aria-disabled",
        "false"
    );


    nowPlayingPanel.tabIndex =
        0;


    nowPlayingPanel.title =
        `Return to ${PROVIDER_NAMES[
            provider
        ] || provider}`;


    const displayTitle =
        provider ===
            "netflix"
            ? normalizeNowPlayingArtworkQuery(
                media.title
            ) ||
                String(
                    media.title
                ).trim()
            : String(
                media.title
            ).trim();


    nowPlayingTitle.textContent =
        displayTitle;


    nowPlayingState.textContent =
        [
            getPlaybackLabel(
                playbackState
            ),
            sessionAge
        ]
            .filter(Boolean)
            .join(
                " · "
            );


    nowPlayingProgress.style.width =
        `${progress}%`;


    nowPlayingTime.textContent =
        `${formatPlaybackTime(
            hasCurrentTime
                ? currentTime
                : null
        )} / ${formatPlaybackTime(
            hasDuration
                ? duration
                : null
        )}`;


    applyNowPlayingArtwork(
        provider,
        provider ===
            "netflix"
            ? {
                ...media,
                title:
                    displayTitle
            }
            : media
    );


    applyNowPlayingRating(
        provider,
        provider ===
            "netflix"
            ? {
                ...media,
                title:
                    displayTitle
            }
            : media
    ).catch(
        () => {}
    );


    refreshNowPlayingMarquee();
}

async function loadNowPlaying() {
    const keys =
        Object.values(
            NOW_PLAYING_KEYS
        );


    const stored =
        await chrome.storage.local.get(
            keys
        );


    nowPlayingByProvider =
        {};


    for (
        const [provider, key]
        of Object.entries(
            NOW_PLAYING_KEYS
        )
    ) {
        if (
            stored[key]?.title
        ) {
            nowPlayingByProvider[provider] =
                stored[key];
        }
    }


    renderNowPlaying();
}


syncNowPlayingWidth();


if (
    typeof ResizeObserver ===
    "function"
) {
    new ResizeObserver(
        () => {
            syncNowPlayingWidth();
            refreshNowPlayingMarquee();
        }
    ).observe(
        statusGroup
    );
}


window.addEventListener(
    "resize",
    () => {
        syncNowPlayingWidth();
        refreshNowPlayingMarquee();
    }
);


loadNowPlaying()
    .catch(
        () => {}
    );


let nowPlayingProgressTimer = null;

function scheduleNowPlayingProgressRefresh(
    immediate = false
) {
    if (nowPlayingProgressTimer) {
        clearTimeout(nowPlayingProgressTimer);
    }

    const hidden =
        document.visibilityState ===
            "hidden";

    nowPlayingProgressTimer = setTimeout(
        () => {
            nowPlayingProgressTimer = null;

            if (
                document.visibilityState !==
                    "hidden"
            ) {
                refreshNowPlayingProgress();
            }

            scheduleNowPlayingProgressRefresh();
        },
        immediate
            ? 0
            : (hidden ? 5000 : 1000)
    );
}

scheduleNowPlayingProgressRefresh();

document.addEventListener(
    "visibilitychange",
    () => {
        scheduleNowPlayingProgressRefresh(
            document.visibilityState !==
                "hidden"
        );
    }
);


/*
 * ============================================================
 * CLOCK
 * ============================================================
 */

const clockTimeFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }
);

const clockDateFormatter = new Intl.DateTimeFormat(
    "en-GB",
    {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }
);

let clockUpdateTimer = null;

function updateClock() {
    const now = new Date();

    clock.textContent =
        clockTimeFormatter.format(now);

    date.textContent =
        clockDateFormatter.format(now);
}

function scheduleClockUpdate() {
    if (clockUpdateTimer) {
        clearTimeout(clockUpdateTimer);
    }

    updateClock();

    const now = Date.now();
    const delay = 60000 - (now % 60000) + 50;

    clockUpdateTimer = setTimeout(
        scheduleClockUpdate,
        delay
    );
}

scheduleClockUpdate();

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.visibilityState !== "hidden") {
            scheduleClockUpdate();
        }
    }
);
/*
 * ============================================================
 * SVG HELPERS
 * ============================================================
 */

function createSvgElement(
    name,
    attributes = {}
) {
    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );


    for (
        const [key, value]
        of Object.entries(
            attributes
        )
    ) {
        element.setAttribute(
            key,
            String(
                value
            )
        );
    }


    return element;
}


function createAvailabilityIcon(
    state
) {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    if (
        state ===
        "available"
    ) {
        svg.appendChild(
            createSvgElement(
                "circle",
                {
                    cx:
                        12,

                    cy:
                        12,

                    r:
                        8.5
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M8.2 12.2L10.7 14.7L15.9 9.4"
                }
            )
        );


        return svg;
    }


    if (
        state ===
        "extra"
    ) {
        svg.appendChild(
            createSvgElement(
                "rect",
                {
                    x:
                        3.5,

                    y:
                        6,

                    width:
                        17,

                    height:
                        12,

                    rx:
                        2.8
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M3.8 9.5H20.2"
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M15.5 14.2H17.7"
                }
            )
        );


        return svg;
    }


    if (
        state ===
        "unavailable"
    ) {
        svg.appendChild(
            createSvgElement(
                "circle",
                {
                    cx:
                        12,

                    cy:
                        12,

                    r:
                        8.5
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M8.5 12H15.5"
                }
            )
        );


        return svg;
    }


    svg.appendChild(
        createSvgElement(
            "circle",
            {
                cx:
                    12,

                cy:
                    12,

                r:
                    8.5
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M9.8 9.4C10.2 8.2 11.1 7.6 12.3 7.6C14 7.6 15 8.5 15 9.8C15 11.1 14.2 11.7 13.1 12.3C12.2 12.8 11.9 13.3 11.9 14.1"
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "circle",
            {
                cx:
                    11.9,

                cy:
                    16.7,

                r:
                    .75,

                fill:
                    "currentColor",

                stroke:
                    "none"
            }
        )
    );


    return svg;
}


/*
 * ============================================================
 * AVAILABILITY INDICATORS
 * ============================================================
 */

function ensureAvailabilityIndicators() {
    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                if (
                    button.querySelector(
                        ".provider-availability"
                    )
                ) {
                    return;
                }


                const indicator =
                    document.createElement(
                        "span"
                    );


                indicator.className =
                    "provider-availability";


                indicator.setAttribute(
                    "aria-hidden",
                    "true"
                );


                button.appendChild(
                    indicator
                );
            }
        );
}


function setAvailabilityIndicator(
    indicator,
    state
) {
    indicator.replaceChildren();


    indicator.className =
        `provider-availability visible ${state}`;


    indicator.appendChild(
        createAvailabilityIcon(
            state
        )
    );
}


function clearAvailabilityIndicators() {
    ensureAvailabilityIndicators();


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                const indicator =
                    button.querySelector(
                        ".provider-availability"
                    );


                indicator.replaceChildren();


                indicator.className =
                    "provider-availability";


                button.title =
                    PROVIDER_NAMES[
                        button.dataset.provider
                    ] ||
                    "";
            }
        );
}


function renderAvailabilityIndicators() {
    ensureAvailabilityIndicators();


    if (
        !selectedMedia
    ) {
        clearAvailabilityIndicators();

        return;
    }


    const dashboard =
        selectedAvailability
            ?.dashboard;


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                const provider =
                    button.dataset.provider;


                const indicator =
                    button.querySelector(
                        ".provider-availability"
                    );


                const status =
                    dashboard?.[
                        provider
                    ];


                if (
                    !status
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "unknown"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · Availability unknown`;


                    return;
                }


                if (
                    status.state ===
                    "available"
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "available"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · ${selectedMedia.title} available`;


                    return;
                }


                if (
                    status.state ===
                    "extra"
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "extra"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · ${selectedMedia.title} requires purchase, rental or add-on`;


                    return;
                }


                setAvailabilityIndicator(
                    indicator,
                    "unavailable"
                );


                button.title =
                    `${PROVIDER_NAMES[
                        provider
                    ]} · ${selectedMedia.title} not listed`;
            }
        );
}


/*
 * ============================================================
 * PROVIDER SEARCH
 * ============================================================
 */

function buildProviderSearchUrl(
    provider,
    media
) {
    const title =
        encodeURIComponent(
            String(
                media?.title ||
                ""
            ).trim()
        );


    if (
        !title
    ) {
        return null;
    }


    switch (
        provider
    ) {
        case "youtube":

            return `https://www.youtube.com/results?search_query=${title}`;


        case "netflix":

            return `https://www.netflix.com/search?q=${title}`;


        case "prime":

            return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`;


        case "disney":

            return "https://www.disneyplus.com/search";


        case "crunchyroll":

            return `https://www.crunchyroll.com/search?q=${title}`;


        default:

            return null;
    }
}


async function navigateProviderToSelectedMedia(
    provider
) {
    if (
        !selectedMedia
    ) {
        return false;
    }


    const url =
        buildProviderSearchUrl(
            provider,
            selectedMedia
        );


    if (
        !url
    ) {
        return false;
    }


    const stored =
        await chrome.storage.local.get(
            "providerWindows"
        );


    const windowId =
        stored
            .providerWindows?.[
                provider
            ];


    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return false;
    }


    const tabs =
        await chrome.tabs.query({
            windowId
        });


    const tab =
        tabs.find(
            item =>
                Number.isInteger(
                    item.id
                )
        );


    if (
        !tab?.id
    ) {
        return false;
    }


    await chrome.tabs.update(
        tab.id,
        {
            url
        }
    );


    return true;
}


/*
 * ============================================================
 * OPEN PROVIDER + ADD TO RECENT
 * ============================================================
 */

async function openProvider(
    provider
) {
    try {
        const response =
            await chrome.runtime.sendMessage({
                type:
                    "dashboard-switch-provider",

                provider
            });


        if (
            !response?.ok ||
            !selectedMedia
        ) {
            return;
        }


        const opened =
            await navigateProviderToSelectedMedia(
                provider
            );


        if (
            opened
        ) {
            await window
                .StreamShellHistory
                .add(
                    selectedMedia,
                    provider
                );
        }

    } catch (error) {

        console.error(
            "Provider open failed:",
            error
        );
    }
}


/*
 * ============================================================
 * SELECTED MEDIA
 * ============================================================
 */

async function loadSelectedMedia() {
    const stored =
        await chrome.storage.local.get([
            SELECTED_MEDIA_KEY,
            SELECTED_AVAILABILITY_KEY
        ]);


    selectedMedia =
        stored[
            SELECTED_MEDIA_KEY
        ] ||
        null;


    selectedAvailability =
        stored[
            SELECTED_AVAILABILITY_KEY
        ] ||
        null;


    renderAvailabilityIndicators();
}


ensureAvailabilityIndicators();


loadSelectedMedia()
    .catch(
        () => {}
    );


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


        for (
            const [provider, key]
            of Object.entries(
                NOW_PLAYING_KEYS
            )
        ) {
            if (
                !changes[key]
            ) {
                continue;
            }


            const value =
                changes[key]
                    .newValue;


            if (
                value?.title
            ) {
                nowPlayingByProvider[provider] =
                    value;

            } else {

                delete nowPlayingByProvider[provider];
            }


            renderNowPlaying();
        }


        let changed =
            false;


        if (
            changes[
                SELECTED_MEDIA_KEY
            ]
        ) {
            selectedMedia =
                changes[
                    SELECTED_MEDIA_KEY
                ].newValue ||
                null;


            changed =
                true;
        }


        if (
            changes[
                SELECTED_AVAILABILITY_KEY
            ]
        ) {
            selectedAvailability =
                changes[
                    SELECTED_AVAILABILITY_KEY
                ].newValue ||
                null;


            changed =
                true;
        }


        if (
            changed
        ) {
            renderAvailabilityIndicators();
        }
    }
);


/*
 * ============================================================
 * PROVIDER SETTINGS CENTER
 * ============================================================
 */

const SETTINGS_DEFAULTS = {
    streamShellDisplayMode: "auto",

    streamShellTwitchKeepActive: true,
    streamShellTwitchAutoClaimPoints: true,
    streamShellTwitchAutoClaimDrops: true,
    streamShellTwitchPreventRaids: true,
    streamShellTwitchAutoMute: true,
    streamShellVolumeBoost_twitch: 100,
    streamShellAudioProfile_twitch: "normal",

    streamShellYoutubeThemeEnabled: true,
    streamShellNetflixThemeEnabled: true,
    streamShellWindowedPlayer_youtube: false,
    streamShellWindowedPlayer_crunchyroll: false,

    streamShellProviderSafeMode_youtube: false,
    streamShellProviderSafeMode_netflix: false,
    streamShellProviderSafeMode_prime: false,
    streamShellProviderSafeMode_disney: false,
    streamShellProviderSafeMode_crunchyroll: false,
    streamShellYoutubeExtrasEnabled: true,
    streamShellPrimeUiFixEnabled: true,
    streamShellPrimeHideXray: true,
    streamShellPrimeHideOverlay: true,
    streamShellPrimeAutoSkipIntro: false,
    streamShellPrimeAutoSkipRecap: false,
    streamShellPrimeAutoSkipPromos: true,
    streamShellPrimeSubtitleScale: "0.5",
    streamShellPrimeSubtitleColor: "#ffffff",
    streamShellPrimeSubtitleFont: "default",

    streamShellNetflixAutoSkipIntro: false,
    streamShellNetflixAutoSkipRecap: false,
    streamShellNetflixAutoNextEpisode: false,
    streamShellNetflixContinueWatching: true,

    streamShellCrunchyrollAutoSkipIntro: false,
    streamShellCrunchyrollAutoSkipRecap: false,
    streamShellCrunchyrollAutoSkipCredits: false,

    streamShellYoutubeKeepPlaying: true,
    streamShellYoutubeLoopEnabled: false,
    streamShellYoutubeLoopVideos: false,
    streamShellYoutubeLoopShorts: true,

    streamShellPlaybackSpeed_youtube: "1",
    streamShellPlaybackSpeed_netflix: "1",
    streamShellPlaybackSpeed_prime: "1",
    streamShellPlaybackSpeed_disney: "1",
    streamShellPlaybackSpeed_crunchyroll: "1",

    streamShellPlaybackAnarchy: false,
    streamShellSubtitleAnarchy: false,
    streamShellDvdAnarchy: false,


    streamShellDoubleClickWindowed_youtube: false,
    streamShellDoubleClickWindowed_crunchyroll: false,

    streamShellSubtitleOverride_youtube: false,
    streamShellSubtitleOverride_netflix: false,
    streamShellSubtitleOverride_disney: false,
    streamShellSubtitleScale_youtube: "1",
    streamShellSubtitleScale_netflix: "1",
    streamShellSubtitleScale_disney: "1",
    streamShellSubtitleColor_youtube: "#ffffff",
    streamShellSubtitleColor_netflix: "#ffffff",
    streamShellSubtitleColor_disney: "#ffffff",
    streamShellSubtitleFont_youtube: "default",
    streamShellSubtitleFont_netflix: "default",
    streamShellSubtitleFont_disney: "default",

    streamShellVolumeBoost_youtube: 100,
    streamShellVolumeBoost_netflix: 100,
    streamShellVolumeBoost_prime: 100,
    streamShellVolumeBoost_disney: 100,
    streamShellVolumeBoost_crunchyroll: 100,

    streamShellAudioProfile_youtube: "normal",
    streamShellAudioProfile_netflix: "normal",
    streamShellAudioProfile_prime: "normal",
    streamShellAudioProfile_disney: "normal",
    streamShellAudioProfile_crunchyroll: "normal",

    streamShellSleepTimerAction: "pause",
    streamShellContinueWatchingCompletePercent: 95,

    streamShellCrunchyrollBlurEpisodeThumbnails: false,

    streamShellYoutubeQualityEnabled: true,
    streamShellYoutubeQuality: "hd1080",

    streamShellYoutubeUploadDateEnabled: true,
    streamShellYoutubeUploadDateFormat: "friendly",
    streamShellYoutubeUploadDateRelativeEnabled: true,
    streamShellYoutubeUploadDateRelativeDays: 1,

    streamShellYoutubeAutoLikeEnabled: true,
    streamShellYoutubeAutoLikeTrigger: "percent",
    streamShellYoutubeAutoLikePercent: 69,
    streamShellYoutubeAutoLikeSeconds: 30,
    streamShellYoutubeAutoLikeSubscribedOnly: false,
    streamShellYoutubeAutoLikeWaitForAds: false,
    streamShellYoutubeAutoLikeShorts: true,

    streamShellYoutubeCleanupHideHomeFeed: false,
    streamShellYoutubeCleanupHideHomePromotions: true,
    streamShellYoutubeCleanupHidePlayables: true,
    streamShellYoutubeCleanupHideVideoSidebar: false,
    streamShellYoutubeCleanupHideRecommended: false,
    streamShellYoutubeCleanupHideLiveChat: false,
    streamShellYoutubeCleanupHidePlaylist: false,
    streamShellYoutubeCleanupHideFundraiser: false,
    streamShellYoutubeCleanupHideTranscriptChapters: false,
    streamShellYoutubeCleanupHideEndScreenFeed: false,
    streamShellYoutubeCleanupHideEndScreenCards: false,
    streamShellYoutubeCleanupHideComments: false,
    streamShellYoutubeCleanupHideProfilePhotos: false,
    streamShellYoutubeCleanupHideMixes: false,
    streamShellYoutubeCleanupHideMerch: true,
    streamShellYoutubeCleanupHideVideoInfo: false,
    streamShellYoutubeCleanupHideTopHeader: false,
    streamShellYoutubeCleanupHideNotifications: false,
    streamShellYoutubeCleanupHideInaptSearchResults: true,
    streamShellYoutubeCleanupHideExploreTrending: false,
    streamShellYoutubeCleanupHideMoreFromYouTube: true,
    streamShellYoutubeCleanupHideShortsTab: false,
    streamShellYoutubeCleanupHideSubscriptions: false,
    streamShellYoutubeCleanupDisableAutoplay: false,
    streamShellYoutubeCleanupDisableAnnotations: false
};

const SETTINGS_SECTIONS = {
    general: [
        ["display", "Display"],
        ["anarchy", "Anarchy"],
        ["twitch", "Twitch"]
    ],
    youtube: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["quality", "Quality"],
        ["upload-date", "Upload date"],
        ["auto-like", "Auto Like"],
        ["cleanup", "Cleanup"],
        ["safe-mode", "Safe mode"]
    ],
    netflix: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    prime: [
        ["search", "Search"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    disney: [
        ["search", "Search"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    crunchyroll: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ]
};

const SETTINGS_SEARCH_ITEMS = {
    youtube: [
        ["appearance", "Stream Shell background", "background wallpaper transparent shell appearance theme"],
        ["player", "Windowed fullscreen", "windowed fullscreen player layout"],
        ["player", "Fullscreen quick actions", "like dislike share more buttons controls extras"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["playback", "Double-click windowed fullscreen", "double click fullscreen gesture"],
        ["playback", "Override loop behavior", "loop looping replay repeat"],
        ["playback", "Regular videos", "loop regular videos"],
        ["playback", "Shorts", "loop shorts vertical videos"],
        ["automation", "Keep Playing", "continue watching inactivity confirmation automation"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["quality", "Set video quality automatically", "quality resolution 1080p 4k 8k hd"],
        ["quality", "Preferred quality", "quality resolution 1080p 4k 8k hd"],
        ["upload-date", "Show exact upload date", "upload published date timestamp time"],
        ["upload-date", "Date style", "upload date 12 hour clock format"],
        ["upload-date", "Keep relative wording", "upload date hours ago relative"],
        ["auto-like", "Auto Like videos", "automatic like autolike"],
        ["auto-like", "Threshold type", "auto like percent seconds threshold"],
        ["auto-like", "Apply to Shorts", "auto like shorts"],
        ["auto-like", "Subscribed channels only", "auto like subscriptions channels"],
        ["auto-like", "Wait for ads to finish", "auto like ads"],
        ["cleanup", "Hide Home Feed", "cleanup home feed"],
        ["cleanup", "Hide Home Promotions", "cleanup home featured promo promotion banner statement youtube featured"],
        ["cleanup", "Hide Playables", "cleanup playables games instant games youtube playables"],
        ["cleanup", "Hide Video Sidebar", "cleanup sidebar recommendations"],
        ["cleanup", "Hide Recommended", "cleanup recommendations"],
        ["cleanup", "Hide Live Chat", "cleanup live chat"],
        ["cleanup", "Hide Playlist", "cleanup playlist"],
        ["cleanup", "Hide Transcript / Chapters", "cleanup transcript chapters"],
        ["cleanup", "Hide End Screen Feed", "cleanup endscreen feed"],
        ["cleanup", "Hide End Screen Cards", "cleanup endscreen cards"],
        ["cleanup", "Hide Comments", "cleanup comments"],
        ["cleanup", "Hide Mixes", "cleanup mixes radio"],
        ["cleanup", "Hide Merch, Tickets, Offers", "cleanup merch tickets offers"],
        ["cleanup", "Hide Video Info", "cleanup video info metadata"],
        ["cleanup", "Hide Top Header", "cleanup header masthead"],
        ["cleanup", "Hide Notifications", "cleanup notifications"],
        ["cleanup", "Hide Inapt Search Results", "cleanup search results shelves"],
        ["cleanup", "Hide Explore / Trending", "cleanup explore trending"],
        ["cleanup", "Hide More from YouTube", "cleanup more from youtube guide"],
        ["cleanup", "Hide Shorts Tab", "cleanup shorts navigation"],
        ["cleanup", "Hide Subscriptions", "cleanup subscriptions navigation"],
        ["cleanup", "Disable Autoplay", "cleanup autoplay"],
        ["cleanup", "Disable Annotations", "cleanup annotations cards"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    netflix: [
        ["appearance", "Stream Shell background", "background wallpaper transparent shell appearance theme"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Start next episode", "automation next episode binge credits"],
        ["automation", "Dismiss still-watching prompt", "automation continue watching inactivity"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    prime: [
        ["player", "Ultrawide player UI fix", "player ultrawide ui controls layout"],
        ["player", "Hide X-Ray", "player xray trivia cast"],
        ["player", "Hide dark overlay", "player dim overlay"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Skip promos", "automation skip promos trailer preroll"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    disney: [
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    crunchyroll: [
        ["appearance", "Blur episode thumbnails", "spoiler protection blur thumbnails artwork"],
        ["player", "Windowed fullscreen", "windowed fullscreen player layout"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["playback", "Double-click windowed fullscreen", "double click fullscreen gesture"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Skip credits", "automation skip credits outro"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ]
};


function defaultSettingsSection(provider) {
    const sections = SETTINGS_SECTIONS[provider] || [];

    return sections.find(([id]) => id !== "search")?.[0] ||
        sections[0]?.[0] ||
        "search";
}

let settingsProvider = "youtube";
let settingsSection = "appearance";
let settingsValues = {
    ...SETTINGS_DEFAULTS
};
let settingsLoaded = false;
let settingsCloseTimer = null;
let sleepTimerState = null;
let settingsIoStatusTimer = null;
let settingsSearchQuery = "";
let settingsDiagnosticsSnapshot = null;
let settingsDiagnosticsCloseTimer = null;

const ANARCHY_NEON_COLORS = [
    "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
    "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
    "#b000ff", "#7c00ff", "#651fff", "#304ffe",
    "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
    "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
    "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
    "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
    "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
];

let anarchySettingsColorTimer = null;
const anarchySettingsColorBags = { playback: [], subtitles: [], dvd: [] };

function refillAnarchyColorBag(kind) {
    const bag = [...ANARCHY_NEON_COLORS];
    for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    anarchySettingsColorBags[kind] = bag;
}

function nextAnarchyColor(kind) {
    if (!anarchySettingsColorBags[kind]?.length) {
        refillAnarchyColorBag(kind);
    }
    return anarchySettingsColorBags[kind].pop();
}

function hexToRgbTriplet(hex) {
    const numeric = Number.parseInt(String(hex || "").replace(/^#/, ""), 16);
    if (!Number.isFinite(numeric)) return "255, 0, 255";
    return `${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}`;
}

function paintAnarchySettings() {
    if (!settingsCenter || settingsSection !== "anarchy") return;
    settingsCenter.style.setProperty(
        "--anarchy-playback-rgb",
        hexToRgbTriplet(nextAnarchyColor("playback"))
    );
    settingsCenter.style.setProperty(
        "--anarchy-subtitle-rgb",
        hexToRgbTriplet(nextAnarchyColor("subtitles"))
    );
    settingsCenter.style.setProperty(
        "--anarchy-dvd-rgb",
        hexToRgbTriplet(nextAnarchyColor("dvd"))
    );
}

function startAnarchySettingsColors() {
    if (anarchySettingsColorTimer) return;
    paintAnarchySettings();
    anarchySettingsColorTimer = setInterval(paintAnarchySettings, 200);
}

function stopAnarchySettingsColors() {
    if (!anarchySettingsColorTimer) return;
    clearInterval(anarchySettingsColorTimer);
    anarchySettingsColorTimer = null;
}

function syncAnarchySettingsVisuals() {
    const active = settingsSection === "anarchy";
    settingsContent?.classList.toggle("settings-content-anarchy", active);
    if (active) startAnarchySettingsColors();
    else stopAnarchySettingsColors();
}

function notifySettingsVisibility(open) {
    chrome.runtime.sendMessage({
        type: "dashboard-settings-visibility",
        open: open === true
    }).catch(() => {});
}

function settingValue(key) {
    return Object.prototype.hasOwnProperty.call(
        settingsValues,
        key
    )
        ? settingsValues[key]
        : SETTINGS_DEFAULTS[key];
}

function settingChecked(key) {
    return settingValue(key) === true
        ? "checked"
        : "";
}

function settingSwitch(key, title, description) {
    const anarchyKind = key === "streamShellPlaybackAnarchy"
        ? "playback"
        : key === "streamShellSubtitleAnarchy"
            ? "subtitles"
            : key === "streamShellDvdAnarchy"
                ? "dvd"
                : "";
    const anarchyClass = anarchyKind
        ? ` settings-switch-anarchy settings-switch-anarchy-${anarchyKind}`
        : "";

    return `
        <label class="setting-row setting-row-switch${anarchyKind ? " setting-row-anarchy" : ""}">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-switch${anarchyClass}">
                <input type="checkbox" data-setting-key="${key}" ${settingChecked(key)}>
                <span aria-hidden="true"></span>
            </span>
        </label>
    `;
}

function settingDependentSwitch(key, title, description, enabled) {
    return `
        <label class="setting-row setting-row-switch setting-row-dependent${enabled ? "" : " is-disabled"}">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-switch">
                <input type="checkbox" data-setting-key="${key}" ${settingChecked(key)} ${enabled ? "" : "disabled"}>
                <span aria-hidden="true"></span>
            </span>
        </label>
    `;
}

function settingSelect(key, title, description, options) {
    const value = String(settingValue(key));
    const optionHtml = options.map(
        ([optionValue, label]) =>
            `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${label}</option>`
    ).join("");

    return `
        <label class="setting-row setting-row-field">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <select class="settings-select" data-setting-key="${key}">${optionHtml}</select>
        </label>
    `;
}

function settingNumber(key, title, description, min, max, suffix = "") {
    const value = Number(settingValue(key));
    return `
        <label class="setting-row setting-row-field">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-number-wrap">
                <input
                    class="settings-number"
                    type="number"
                    min="${min}"
                    max="${max}"
                    step="1"
                    value="${Number.isFinite(value) ? value : min}"
                    data-setting-key="${key}"
                    data-setting-number="true"
                >
                ${suffix ? `<span>${suffix}</span>` : ""}
            </span>
        </label>
    `;
}

function settingRange(key, title, description, min, max, step = 10, suffix = "%") {
    const rawValue = Number(settingValue(key));
    const value = Number.isFinite(rawValue)
        ? Math.min(max, Math.max(min, rawValue))
        : min;

    return `
        <label class="setting-row setting-row-range">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-range-wrap">
                <input
                    class="settings-range"
                    type="range"
                    min="${min}"
                    max="${max}"
                    step="${step}"
                    value="${value}"
                    data-setting-key="${key}"
                    data-setting-number="true"
                >
                <output data-setting-output="${key}">${value}${suffix}</output>
            </span>
        </label>
    `;
}

function renderDisplaySettings() {
    return settingsPage(
        "Display",
        settingsSubgroup(
            "Layout profile",
            settingSegmented(
                "streamShellDisplayMode",
                "Display mode",
                "Auto prefers the 32:9 target whenever it is connected; otherwise it selects the 16:10 laptop target.",
                [
                    ["auto", "Auto"],
                    ["wide", "Wide"],
                    ["compact", "Compact"]
                ]
            ),
            "Known targets: 3840×1080 (32:9) and 2880×1800 (16:10). The override is global, not provider-specific."
        ),
        "Wide is anchored to the detected 32:9 display. Compact uses the detected 16:10 target as one full-screen Shell Home/provider surface; profile changes use the next clean shell open/reopen boundary."
    );
}


function renderTwitchUtilitySettings() {
    return settingsPage(
        "Twitch",
        settingsSubgroup(
            "Window behavior",
            settingSwitch(
                "streamShellTwitchKeepActive",
                "Keep Twitch active while covered",
                "Leave the Twitch popup on its real right-pane coordinates underneath Dashboard or Discord instead of minimizing or parking it."
            ),
            "Designed for watch-time progress, Channel Points and Drops while another right-side surface is in front."
        ) +
        settingsSubgroup(
            "Automation",
            settingSwitch(
                "streamShellTwitchAutoClaimPoints",
                "Auto-claim Channel Points",
                "Claim the periodic Channel Points bonus when Twitch exposes its claim button."
            ) +
            settingSwitch(
                "streamShellTwitchAutoClaimDrops",
                "Auto-claim Twitch Drops",
                "Claim completed Twitch rewards whenever claim UI is exposed in the managed Twitch surface. No separate Inventory browser window is kept open."
            ) +
            settingSwitch(
                "streamShellTwitchPreventRaids",
                "Prevent raids",
                "Leave/cancel detected raids and block the immediate raid redirect without interfering with normal manual channel navigation."
            ),
            "All Twitch automation is local DOM automation; Stream Shell does not use Twitch OAuth or a Twitch API token."
        ) +
        settingsSubgroup(
            "Audio",
            settingSwitch(
                "streamShellTwitchAutoMute",
                "Auto-mute Twitch streams",
                "Mute managed Twitch stream tabs at the Opera/Chromium tab level without touching Twitch's own player volume or mute control."
            ) +
            settingSelect(
                "streamShellAudioProfile_twitch",
                "Processing mode",
                "Applied while the Twitch titlebar speaker is enabled and browser-level auto-mute is disabled.",
                [
                    ["normal", "Normal"],
                    ["dialogue", "Dialogue"],
                    ["night", "Night"]
                ]
            ) +
            settingRange(
                "streamShellVolumeBoost_twitch",
                "Twitch volume",
                "Volume used while the Twitch titlebar speaker is enabled and browser-level auto-mute is disabled.",
                100,
                600,
                10,
                "%"
            ),
            "Auto-mute is applied by the browser tab, not by Twitch's player UI. Playback speed is intentionally omitted for the live-first Twitch utility."
        ),
        "Twitch is an auxiliary Wide utility, not a sixth Stream Shell provider.",
        "three"
    );
}


function volumeBoostKey(provider) {
    return `streamShellVolumeBoost_${provider}`;
}

function audioProfileKey(provider) {
    return `streamShellAudioProfile_${provider}`;
}

function renderVolumeSettings(provider) {
    return settingsPage(
        "Audio",
        settingsSubgroup(
            "Sound profile",
            settingSelect(
                audioProfileKey(provider),
                "Processing mode",
                "Applied while the titlebar speaker is enabled for this provider.",
                [
                    ["normal", "Normal"],
                    ["dialogue", "Dialogue"],
                    ["night", "Night"]
                ]
            ),
            "Dialogue reduces low-end rumble and lifts speech. Night compresses loud and quiet swings for more even listening."
        ) +
        settingsSubgroup(
            "Amplification",
            settingRange(
                volumeBoostKey(provider),
                "Provider volume",
                "Volume used while the titlebar speaker is enabled.",
                100,
                600,
                10,
                "%"
            ),
            "Saved separately for each provider. 100% is normal volume; higher values boost it."
        ),
        "The titlebar speaker toggles this audio chain for the current provider.",
        "two"
    );
}


function settingsPage(title, content, note = "", layout = "stack") {
    const layoutClass = layout === "two"
        ? " settings-layout-two"
        : layout === "three"
            ? " settings-layout-three"
            : layout === "columns-three"
                ? " settings-layout-columns-three"
                : "";

    return `
        <section class="settings-group settings-group-page">
            <div class="settings-group-heading">
                <h2>${title}</h2>
                ${note ? `<p>${note}</p>` : ""}
            </div>
            <div class="settings-subgroups${layoutClass}">${content}</div>
        </section>
    `;
}

function settingsColumn(content) {
    return `<div class="settings-column">${content}</div>`;
}

function settingsSubgroup(title, content, note = "") {
    return `
        <section class="settings-subgroup">
            <div class="settings-subgroup-heading">
                <h3>${title}</h3>
                ${note ? `<p>${note}</p>` : ""}
            </div>
            <div class="settings-group-rows">${content}</div>
        </section>
    `;
}

function settingSegmented(key, title, description, options) {
    const value = String(settingValue(key));

    return `
        <div class="setting-row setting-row-segmented">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-segmented" role="radiogroup" aria-label="${title}">
                ${options.map(
                    ([optionValue, label]) => `
                        <label class="settings-segmented-option">
                            <input
                                type="radio"
                                name="${key}"
                                value="${optionValue}"
                                data-setting-key="${key}"
                                ${value === optionValue ? "checked" : ""}
                            >
                            <span>${label}</span>
                        </label>
                    `
                ).join("")}
            </span>
        </div>
    `;
}

function playbackSpeedKey(provider) {
    return `streamShellPlaybackSpeed_${provider}`;
}

function renderPlaybackSettings(provider, extraContent = "") {
    const speed = settingsSubgroup(
        "Speed",
        settingSelect(
            playbackSpeedKey(provider),
            "Default playback speed",
            "Keep the provider at this speed while a video is playing.",
            [
                ["0.5", "0.5x"],
                ["0.75", "0.75x"],
                ["1", "1.0x"],
                ["1.25", "1.25x"],
                ["1.5", "1.5x"],
                ["1.75", "1.75x"],
                ["2", "2.0x"]
            ]
        )
    );

    const content = speed + extraContent;

    return settingsPage(
        "Playback",
        content,
        "Set the normal playback speed for this provider.",
        extraContent ? "two" : "stack"
    );
}

function renderWindowedGestureSetting(provider) {
    return settingsSubgroup(
        "Gestures",
        settingSwitch(
            `streamShellDoubleClickWindowed_${provider}`,
            "Double-click windowed fullscreen",
            "Double-click the player to toggle Stream Shell's windowed fullscreen mode."
        )
    );
}

function renderSubtitleSettings(provider) {
    return settingsPage(
        "Subtitles",
        settingsSubgroup(
            "Override",
            settingSwitch(
                `streamShellSubtitleOverride_${provider}`,
                "Custom subtitle style",
                "Override the provider's subtitle size, color and font."
            )
        ) +
        settingsSubgroup(
            "Size & color",
            settingSelect(
                `streamShellSubtitleScale_${provider}`,
                "Subtitle scale",
                "Scale subtitles relative to their normal size.",
                [
                    ["0.5", "0.5x"],
                    ["0.8", "0.8x"],
                    ["1", "1.0x"],
                    ["1.25", "1.25x"],
                    ["1.5", "1.5x"],
                    ["2", "2.0x"]
                ]
            ) +
            settingSelect(
                `streamShellSubtitleColor_${provider}`,
                "Text color",
                "Choose a subtitle text color.",
                [
                    ["#ffffff", "White"],
                    ["#e8e8e8", "Soft white"],
                    ["#fff0b3", "Warm"],
                    ["#c7e6ff", "Light blue"],
                    ["#d2efd8", "Light green"]
                ]
            )
        ) +
        settingsSubgroup(
            "Font",
            settingSelect(
                `streamShellSubtitleFont_${provider}`,
                "Font family",
                "Keep the provider font or use a local font family.",
                [
                    ["default", "Default"],
                    ["Arial", "Arial"],
                    ["Helvetica", "Helvetica"],
                    ["Georgia", "Georgia"],
                    ["Times New Roman", "Times New Roman"],
                    ["Courier New", "Courier New"],
                    ["Verdana", "Verdana"],
                    ["Roboto", "Roboto"]
                ]
            )
        ),
        "Changes apply locally to subtitle text rendered by the provider.",
        "three"
    );
}

function renderAnarchySettings() {
    return settingsPage(
        "Anarchy",
        settingsSubgroup(
            "Playback",
            settingSwitch(
                "streamShellPlaybackAnarchy",
                "Playback Anarchy",
                "Continuously drift between random playback speeds with smooth, randomly timed transitions on every supported provider."
            )
        ) +
        settingsSubgroup(
            "Subtitles",
            settingSwitch(
                "streamShellSubtitleAnarchy",
                "Subtitle Anarchy",
                "Flash through neon colors every 0.2 seconds while subtitle size smoothly changes at random speeds. Applies to YouTube, Netflix, Prime Video and Disney+; Crunchyroll is excluded."
            )
        ) +
        settingsSubgroup(
            "Visual",
            settingSwitch(
                "streamShellDvdAnarchy",
                "DVD Anarchy",
                "Bounce a DVD logo around whichever supported provider occupies the active left surface, randomly changing speed and color on collisions."
            )
        ),
        "Global chaos controls. Provider Safe Mode still suppresses Anarchy locally without changing these saved global settings.",
        "three"
    );
}

function sleepTimerModeForProvider(provider) {
    return sleepTimerState?.provider === provider
        ? String(sleepTimerState.mode || "off")
        : "off";
}

function renderSleepTimerSubgroup(provider) {
    const mode = sleepTimerModeForProvider(provider);
    const foreign = sleepTimerState && sleepTimerState.provider !== provider;
    const foreignLabel = foreign
        ? PROVIDER_NAMES[sleepTimerState.provider] || sleepTimerState.provider
        : "";

    const buttons = [
        ["off", "Off"],
        ["30", "30 min"],
        ["60", "60 min"],
        ["90", "90 min"],
        ["end", "End of video"]
    ].map(([value, label]) => `
        <button
            type="button"
            class="settings-segmented-button ${mode === value ? "active" : ""}"
            data-sleep-mode="${value}"
            data-sleep-provider="${provider}"
        >${label}</button>
    `).join("");

    return settingsSubgroup(
        "Sleep timer",
        `
            <div class="setting-row setting-row-segmented setting-row-sleep">
                <span class="setting-copy">
                    <strong>Stop playback</strong>
                    <span>${foreign ? `A timer is currently running for ${foreignLabel}. Choosing a value here replaces it.` : "Choose a fixed timer or stop after the current video ends."}</span>
                </span>
                <span class="settings-segmented settings-segmented-buttons">${buttons}</span>
            </div>
        ` +
        settingSelect(
            "streamShellSleepTimerAction",
            "When it ends",
            "Choose whether Stream Shell only pauses or also brings Dashboard forward.",
            [
                ["pause", "Pause"],
                ["dashboard", "Pause + show Dashboard"]
            ]
        )
    );
}

async function refreshSleepTimerState() {
    try {
        const response = await chrome.runtime.sendMessage({ type: "sleep-timer-get" });
        sleepTimerState = response?.session || null;
    } catch {
        sleepTimerState = null;
    }
}

async function setSleepTimerFromSettings(provider, mode) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: "sleep-timer-set",
            provider,
            mode,
            action: settingValue("streamShellSleepTimerAction")
        });
        sleepTimerState = response?.session || null;
    } catch {
        sleepTimerState = null;
    }
    renderSettingsContent();
}

function showSettingsIoStatus(text) {
    if (!settingsIoStatus) return;
    settingsIoStatus.textContent = text || "";
    if (settingsIoStatusTimer) clearTimeout(settingsIoStatusTimer);
    if (text) {
        settingsIoStatusTimer = setTimeout(() => {
            settingsIoStatus.textContent = "";
            settingsIoStatusTimer = null;
        }, 2400);
    }
}

async function exportStreamShellSettings() {
    const stored = await chrome.storage.local.get(Object.keys(SETTINGS_DEFAULTS));
    const settings = {};
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        settings[key] = stored[key] === undefined ? SETTINGS_DEFAULTS[key] : stored[key];
    }

    const extensionVersion = chrome.runtime.getManifest?.().version || "unknown";
    const payload = {
        format: "stream-shell-settings",
        version: 1,
        streamShellVersion: extensionVersion,
        exportedAt: new Date().toISOString(),
        settings
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `StreamShell-settings-${extensionVersion}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showSettingsIoStatus("Exported");
}

function normalizeImportedSetting(key, value) {
    const fallback = SETTINGS_DEFAULTS[key];
    if (typeof fallback === "boolean") return value === true;
    if (typeof fallback === "number") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        if (key === "streamShellContinueWatchingCompletePercent") {
            return Math.max(1, Math.min(100, Math.round(numeric)));
        }
        return numeric;
    }
    return typeof value === "string" ? value : fallback;
}

async function importStreamShellSettings(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const source = parsed?.format === "stream-shell-settings"
        ? parsed.settings
        : parsed;

    if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error("Invalid Stream Shell settings file.");
    }

    const next = {};
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            next[key] = normalizeImportedSetting(key, source[key]);
        }
    }

    await chrome.storage.local.set(next);
    try {
        await chrome.runtime.sendMessage({
            type: "dashboard-flight-event",
            event: {
                category: "settings",
                action: "imported",
                detail: { keys: Object.keys(next).length }
            }
        });
    } catch {
    }
    await loadSettingsValues();
    renderSettingsCenter();
    showSettingsIoStatus("Imported");
}

function escapeSettingsHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function diagnosticsStatusClass(ok, neutral = false) {
    if (neutral) return "neutral";
    return ok ? "good" : "bad";
}

function diagnosticsRow(label, value, status = "neutral") {
    const safeValue = escapeSettingsHtml(value);
    return `
        <div class="settings-diagnostics-row">
            <span>${escapeSettingsHtml(label)}</span>
            <strong class="settings-diagnostics-value ${status}" title="${safeValue}">
                ${safeValue}
            </strong>
        </div>
    `;
}

function diagnosticsCard(title, rows, note = "", className = "") {
    const classes = ["settings-diagnostics-card", className]
        .filter(Boolean)
        .join(" ");
    return `
        <section class="${escapeSettingsHtml(classes)}">
            <div class="settings-diagnostics-card-heading">
                <h3>${escapeSettingsHtml(title)}</h3>
                ${note ? `<p>${escapeSettingsHtml(note)}</p>` : ""}
            </div>
            <div class="settings-diagnostics-rows">${rows}</div>
        </section>
    `;
}

function diagnosticsSection(id, title, description, content, layout = "") {
    const layoutClass = layout ? ` settings-diagnostics-layout-${escapeSettingsHtml(layout)}` : "";
    return `
        <section class="settings-diagnostics-section${layoutClass}" data-diagnostics-section="${escapeSettingsHtml(id)}">
            <div class="settings-diagnostics-section-heading">
                <span>${escapeSettingsHtml(id)}</span>
                <div>
                    <h2>${escapeSettingsHtml(title)}</h2>
                    ${description ? `<p>${escapeSettingsHtml(description)}</p>` : ""}
                </div>
            </div>
            <div class="settings-diagnostics-section-grid">${content}</div>
        </section>
    `;
}

function diagnosticsCapabilityCell(capability) {
    if (!capability || capability.supported !== true) {
        return `<span class="settings-diagnostics-cap neutral">—</span>`;
    }

    const status = capability.available === true ? "good" : "bad";
    const label = capability.available === true ? "OK" : "WAIT";
    const detail = capability.state || capability.detail || "";
    return `<span class="settings-diagnostics-cap ${status}" title="${escapeSettingsHtml(detail)}">${label}</span>`;
}

function diagnosticsCapabilityMatrix(providerStates, selfTest = {}) {
    const rows = Object.entries(PROVIDER_NAMES).map(([provider, label]) => {
        const state = providerStates[provider] || {};
        const page = state.page || {};
        const cachedReport = selfTest?.providers?.[provider]?.report || null;
        const flattened = cachedReport?.capabilities || {};
        const cachedCommon = Object.fromEntries(
            Object.entries(flattened)
                .filter(([key]) => key.startsWith("common."))
                .map(([key, value]) => [key.slice("common.".length), value])
        );
        const cachedExtensions = Object.fromEntries(
            Object.entries(flattened)
                .filter(([key]) => key.startsWith("extensions."))
                .map(([key, value]) => [key.slice("extensions.".length), value])
        );
        const common = page.api?.capabilities?.common || cachedCommon;
        const extensions = page.api?.capabilities?.extensions || cachedExtensions;
        const extensionEntries = Object.entries(extensions);
        const extensionAvailable = extensionEntries.filter(([, capability]) => capability?.supported === true && capability?.available === true).length;
        const extensionSupported = extensionEntries.filter(([, capability]) => capability?.supported === true).length;
        const adapterState = !state.known
            ? `<span class="settings-diagnostics-cap neutral">COLD</span>`
            : !state.alive
                ? `<span class="settings-diagnostics-cap bad">DOWN</span>`
                : page.ok && page.api?.adapterLoaded
                    ? `<span class="settings-diagnostics-cap good">v${escapeSettingsHtml(page.api.version || "?")}</span>`
                    : cachedReport?.adapterKind
                        ? `<span class="settings-diagnostics-cap neutral">v${escapeSettingsHtml(cachedReport.apiVersion || "?")}</span>`
                        : `<span class="settings-diagnostics-cap neutral">IDLE</span>`;

        return `
            <tr>
                <th>${escapeSettingsHtml(label)}</th>
                <td>${adapterState}</td>
                <td>${diagnosticsCapabilityCell(common.watchContext)}</td>
                <td>${diagnosticsCapabilityCell(common.playback)}</td>
                <td>${diagnosticsCapabilityCell(common.seek)}</td>
                <td>${diagnosticsCapabilityCell(common.progress)}</td>
                <td>${diagnosticsCapabilityCell(common.resume)}</td>
                <td><span class="settings-diagnostics-cap ${extensionSupported && extensionAvailable === extensionSupported ? "good" : "neutral"}">${extensionSupported ? `${extensionAvailable}/${extensionSupported}` : "—"}</span></td>
            </tr>
        `;
    }).join("");

    return `
        <section class="settings-diagnostics-card settings-diagnostics-card-wide settings-diagnostics-capability-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Provider capability matrix</h3>
                <p>Supported vs. currently available through Provider API v1. WAIT means the adapter supports it but the required page/player state is not present.</p>
            </div>
            <div class="settings-diagnostics-matrix-wrap">
                <table class="settings-diagnostics-matrix">
                    <thead>
                        <tr>
                            <th>Provider</th>
                            <th>Adapter</th>
                            <th>Watch</th>
                            <th>Playback</th>
                            <th>Seek</th>
                            <th>Progress</th>
                            <th>Resume</th>
                            <th>Extensions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function collectSettingsDiagnostics(options = {}) {
    const full = options.full === true;
    let runtime = {};
    try {
        runtime = await chrome.runtime.sendMessage({
            type: "dashboard-diagnostics",
            full
        }) || {};
    } catch {
        runtime = { ok: false };
    }

    const modifiedKeys = Object.keys(SETTINGS_DEFAULTS)
        .filter(key => {
            const current = settingValue(key);
            const baseline = SETTINGS_DEFAULTS[key];
            return JSON.stringify(current) !== JSON.stringify(baseline);
        });

    const liveProvider = PROVIDERS.has(currentLeftMode)
        ? currentLeftMode
        : null;
    const liveMedia = liveProvider
        ? nowPlayingByProvider[liveProvider] || null
        : null;
    const liveCurrentTime = liveMedia
        ? getLiveNowPlayingCurrentTime(liveMedia)
        : null;
    const liveDuration = Number(liveMedia?.duration);

    const sleep = sleepTimerState
        ? {
            active: true,
            provider: sleepTimerState.provider || null,
            mode: sleepTimerState.mode || null,
            action: sleepTimerState.action || settingValue("streamShellSleepTimerAction")
        }
        : {
            active: false,
            provider: null,
            mode: null,
            action: settingValue("streamShellSleepTimerAction")
        };

    const manifest = chrome.runtime.getManifest() || {};
    const providerStates = runtime.providerWindows || {};

    return {
        format: "stream-shell-diagnostics",
        version: 9,
        mode: full ? "full" : "panel",
        generatedAt: new Date().toISOString(),
        extensionVersion: manifest.version || "unknown",
        environment: {
            userAgent: navigator.userAgent,
            platform: navigator.platform || null,
            language: navigator.language || null,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            },
            screen: {
                width: window.screen?.width || null,
                height: window.screen?.height || null,
                availWidth: window.screen?.availWidth || null,
                availHeight: window.screen?.availHeight || null
            }
        },
        manifest: {
            manifestVersion: manifest.manifest_version || null,
            permissions: [...(manifest.permissions || [])],
            hostPermissions: [...(manifest.host_permissions || [])]
        },
        displayProfile: runtime.displayProfile || null,
        settingsUi: {
            provider: settingsProvider,
            section: settingsSection,
            searchQueryLength: settingsSearchQuery.length,
            diagnosticsOpen: diagnosticsIsOpen()
        },
        shell: {
            leftMode: runtime.leftMode || currentLeftMode || "unknown",
            rightMode: runtime.rightMode || "unknown",
            activeProvider: runtime.activeProvider || null,
            browserWindowsTotal: Number(runtime.browserWindowsTotal) || 0,
            providerWindowsAlive: Number(runtime.providerWindowsAlive) || 0,
            providerWindowsKnown: Number(runtime.providerWindowsKnown) || 0,
            providerWindows: providerStates,
            landingWindowAlive: runtime.landingWindowAlive === true,
            dashboardWindowAlive: runtime.dashboardWindowAlive === true
        },
        native: {
            titlebarConnected: runtime.titlebarConnected === true,
            titlebarVisibilityMode: runtime.titlebarVisibilityMode || "unknown",
            titlebarSettingsOpen: runtime.titlebarSettingsOpen === true,
            titlebarVolumeActive: runtime.titlebarVolumeActive === true,
            discordHelperConnected: runtime.discord?.ok === true,
            discordRunning: runtime.discord?.running === true,
            discordVisible: runtime.discord?.visible === true
        },
        audio: {
            active: runtime.audio?.active === true,
            provider: runtime.audio?.provider || null,
            percent: Number.isFinite(Number(runtime.audio?.percent))
                ? Number(runtime.audio.percent)
                : null,
            profile: runtime.audio?.profile || null,
            offscreenDocumentAlive: runtime.offscreenDocumentAlive === true
        },
        playback: {
            provider: liveProvider,
            state: liveMedia?.playbackState || null,
            currentTime: Number.isFinite(Number(liveCurrentTime)) ? Number(liveCurrentTime) : null,
            duration: Number.isFinite(liveDuration) && liveDuration > 0 ? liveDuration : null,
            progressPercent: Number.isFinite(Number(liveCurrentTime)) && Number.isFinite(liveDuration) && liveDuration > 0
                ? Math.max(0, Math.min(100, Number(liveCurrentTime) / liveDuration * 100))
                : null,
            hasRating: nowPlayingRating?.hidden === false && Boolean(nowPlayingRating?.textContent?.trim()),
            ratingKind: nowPlayingRating?.dataset?.ratingKind || null
        },
        sleepTimer: sleep,
        selfTest: runtime.launchSelfTest || null,
        flightRecorder: runtime.flightRecorder || {
            format: "stream-shell-flight-recorder",
            version: 1,
            maxEvents: 200,
            count: 0,
            updatedAt: null,
            events: []
        },
        settings: {
            loaded: settingsLoaded === true,
            keys: Object.keys(SETTINGS_DEFAULTS).length,
            modifiedFromDefaults: modifiedKeys.length,
            modifiedKeys,
            values: full
                ? Object.fromEntries(
                    Object.keys(SETTINGS_DEFAULTS).map(key => [key, settingValue(key)])
                )
                : null
        }
    };
}

function diagnosticsTimelineDetail(detail) {
    if (!detail || typeof detail !== "object") return "";
    const entries = Object.entries(detail)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .slice(0, 6);
    if (!entries.length) return "";

    return entries
        .map(([key, value]) => {
            const rendered = typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
            return `${key}=${rendered}`;
        })
        .join(" · ")
        .slice(0, 260);
}

function diagnosticsTimelineCard(flightRecorder) {
    const events = Array.isArray(flightRecorder?.events)
        ? flightRecorder.events
        : [];
    const visibleEvents = events.slice(-60).reverse();
    const rows = visibleEvents.length
        ? visibleEvents.map(event => {
            const timestamp = Number(event?.at);
            const time = Number.isFinite(timestamp)
                ? new Date(timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    fractionalSecondDigits: 3
                })
                : "—";
            const provider = event?.provider
                ? (PROVIDER_NAMES[event.provider] || event.provider)
                : "Shell";
            const detail = diagnosticsTimelineDetail(event?.detail);
            const level = ["info", "warn", "error"].includes(event?.level)
                ? event.level
                : "info";

            return `
                <div class="settings-diagnostics-event ${level}">
                    <time>${escapeSettingsHtml(time)}</time>
                    <span class="settings-diagnostics-event-provider">${escapeSettingsHtml(provider)}</span>
                    <div class="settings-diagnostics-event-copy">
                        <strong>${escapeSettingsHtml(`${event?.category || "runtime"} · ${event?.action || "event"}`)}</strong>
                        ${detail ? `<span>${escapeSettingsHtml(detail)}</span>` : ""}
                    </div>
                </div>
            `;
        }).join("")
        : `
            <div class="settings-diagnostics-event-empty">
                No flight-recorder events yet. Provider and shell transitions will appear here as they happen.
            </div>
        `;

    const total = Number(flightRecorder?.count) || events.length;
    const maxEvents = Number(flightRecorder?.maxEvents) || 200;
    const shown = Math.min(visibleEvents.length, 60);

    return `
        <section class="settings-diagnostics-card settings-diagnostics-card-wide settings-diagnostics-timeline-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Event timeline</h3>
                <p>Session flight recorder · ${escapeSettingsHtml(`${total}/${maxEvents} events`)}${total > shown ? ` · showing latest ${shown}` : ""}. Full buffer is included in JSON export.</p>
            </div>
            <div class="settings-diagnostics-timeline">${rows}</div>
        </section>
    `;
}


function diagnosticsSafeModeCard(provider, page) {
    if (!provider) {
        return diagnosticsCard(
            "Provider safe mode",
            diagnosticsRow("Safe mode", "No active provider", "neutral")
        );
    }

    const key = providerSafeModeSettingKey(provider);
    const storedEnabled = settingValue(key) === true;
    const runtimeState = page?.api?.safeMode || null;
    const runtimeEnabled = runtimeState?.initialized === true
        ? runtimeState.enabled === true
        : null;
    const runtimeMatches = runtimeEnabled === null || runtimeEnabled === storedEnabled;
    const label = PROVIDER_NAMES[provider] || provider;

    return `
        <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-safe-mode-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Provider safe mode</h3>
                <p>Isolate ${escapeSettingsHtml(label)} by suppressing Stream Shell's provider DOM/UI features without disabling Provider API, Continue/Resume, Now Playing or Diagnostics.</p>
            </div>
            <div class="settings-diagnostics-rows">
                ${diagnosticsRow("Stored state", storedEnabled ? "Enabled" : "Disabled", storedEnabled ? "neutral" : "good")}
                ${diagnosticsRow(
                    "Runtime state",
                    runtimeEnabled === null ? "Unavailable" : (runtimeEnabled ? "Enabled · UI/DOM suppressed" : "Disabled · normal features active"),
                    runtimeEnabled === null ? "neutral" : (runtimeMatches ? "good" : "bad")
                )}
            </div>
            <div class="settings-diagnostics-repair-list">
                <div class="settings-diagnostics-repair-row ${storedEnabled ? "recommended" : ""}">
                    <div class="settings-diagnostics-repair-copy">
                        <strong>${storedEnabled ? "Leave isolation" : "Enter isolation"}</strong>
                        <span>${storedEnabled
                            ? "Restore the provider-specific features using their existing saved settings."
                            : "Disable invasive provider-specific presentation and automation until Safe Mode is turned off."}</span>
                    </div>
                    <button
                        type="button"
                        class="settings-diagnostics-repair-button"
                        data-diagnostics-safe-mode="${storedEnabled ? "false" : "true"}"
                        data-diagnostics-provider="${escapeSettingsHtml(provider)}"
                    >${storedEnabled ? "Disable" : "Enable"}</button>
                </div>
            </div>
        </section>
    `;
}

async function runSettingsDiagnosticsSafeMode(provider, enabled, button = null) {
    if (!provider || !PROVIDERS.has(provider)) return;

    if (button) button.disabled = true;
    const next = enabled === true;
    setDiagnosticsStatus(`${next ? "Enabling" : "Disabling"} ${PROVIDER_NAMES[provider] || provider} Safe Mode…`);

    try {
        const key = providerSafeModeSettingKey(provider);
        settingsValues[key] = next;
        await chrome.storage.local.set({ [key]: next });
        await new Promise(resolve => setTimeout(resolve, 180));
        setDiagnosticsStatus(next ? "Safe Mode enabled" : "Safe Mode disabled");
        await refreshSettingsDiagnostics();
    } catch {
        setDiagnosticsStatus("Safe Mode update failed");
        if (button) button.disabled = false;
    }
}

const DIAGNOSTICS_REPAIR_META = {
    "restore-managed-marker": {
        label: "Restore managed marker",
        description: "Restore Stream Shell's provider scope marker without reloading the page."
    },
    "clear-pending-resume": {
        label: "Clear pending resume",
        description: "Cancel and remove the current provider resume request."
    },
    "resync-adapter": {
        label: "Resync adapter",
        description: "Rebuild the Provider API adapter instance and re-run its contract check."
    },
    "resync-content-state": {
        label: "Resync content state",
        description: "Reapply current Stream Shell markers, playback utilities and provider feature state."
    },
    "reinitialize-runtime": {
        label: "Reinitialize provider runtime",
        description: "Reload provider settings from storage, rebuild the adapter and resync runtime state."
    },
    "netflix-bridge-probe": {
        label: "Repair Netflix bridge",
        description: "Probe the MAIN-world player bridge and reinject it only if the probe fails."
    },
    "reload-provider": {
        label: "Reload provider",
        description: "Last escalation step. Reload only this provider tab, not the whole shell.",
        danger: true
    }
};

function diagnosticsRepairCard(provider, page) {
    if (!provider) {
        return diagnosticsCard(
            "Targeted repair",
            diagnosticsRow("Repair state", "No active provider", "neutral")
        );
    }

    if (!page?.ok) {
        const meta = DIAGNOSTICS_REPAIR_META["reload-provider"];
        return `
            <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-targeted-repair-card">
                <div class="settings-diagnostics-card-heading">
                    <h3>Targeted repair</h3>
                    <p>Content diagnostics are unavailable, so in-page repair cannot currently run.</p>
                </div>
                <div class="settings-diagnostics-repair-list">
                    ${diagnosticsRepairAction(
                        provider,
                        "reload-provider",
                        meta,
                        "Provider window is alive but its content runtime cannot answer diagnostics.",
                        true
                    )}
                </div>
            </section>
        `;
    }

    const repair = page.api?.repair || {};
    const recommendations = Array.isArray(repair.recommendations)
        ? repair.recommendations
        : [];
    const recommendedByAction = new Map(
        recommendations.map(item => [item.action, item])
    );
    const available = Array.isArray(repair.availableActions)
        ? repair.availableActions
        : [];

    const actions = [];
    const addAction = action => {
        if (!DIAGNOSTICS_REPAIR_META[action] || actions.includes(action)) return;
        actions.push(action);
    };

    for (const recommendation of recommendations) addAction(recommendation.action);
    for (const action of available) addAction(action);
    addAction("resync-content-state");
    addAction("reinitialize-runtime");
    addAction("reload-provider");

    const lastResult = repair.lastResult || null;
    const lastResultText = lastResult?.at
        ? `${lastResult.ok ? "Succeeded" : "Failed"} · ${new Date(lastResult.at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        })}`
        : null;

    const rows = actions.map(action => {
        const meta = DIAGNOSTICS_REPAIR_META[action];
        const recommendation = recommendedByAction.get(action);
        return diagnosticsRepairAction(
            provider,
            action,
            meta,
            recommendation?.reason || meta.description,
            Boolean(recommendation)
        );
    }).join("");

    return `
        <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-targeted-repair-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Targeted repair</h3>
                <p>${repair.healthy !== false
                    ? "No targeted repair is currently recommended. Manual low-risk repair actions remain available below."
                    : `${recommendations.length} repair action${recommendations.length === 1 ? " is" : "s are"} recommended from the current snapshot.`}</p>
            </div>
            ${lastResultText ? `
                <div class="settings-diagnostics-repair-last ${lastResult.ok ? "good" : "bad"}">
                    Last repair: ${escapeSettingsHtml(lastResultText)} · ${escapeSettingsHtml(DIAGNOSTICS_REPAIR_META[lastResult.action]?.label || lastResult.action)}
                </div>
            ` : ""}
            <div class="settings-diagnostics-repair-list">${rows}</div>
        </section>
    `;
}

function diagnosticsRepairAction(provider, action, meta, reason, recommended) {
    const danger = meta?.danger === true;
    return `
        <div class="settings-diagnostics-repair-row ${recommended ? "recommended" : ""} ${danger ? "danger" : ""}">
            <div class="settings-diagnostics-repair-copy">
                <strong>
                    ${escapeSettingsHtml(meta?.label || action)}
                    ${recommended ? '<span class="settings-diagnostics-repair-badge">Recommended</span>' : ""}
                    ${danger ? '<span class="settings-diagnostics-repair-badge last-resort">Last resort</span>' : ""}
                </strong>
                <span>${escapeSettingsHtml(reason || meta?.description || "")}</span>
            </div>
            <button
                type="button"
                class="settings-diagnostics-repair-button"
                data-diagnostics-repair="${escapeSettingsHtml(action)}"
                data-diagnostics-provider="${escapeSettingsHtml(provider)}"
            >Run</button>
        </div>
    `;
}

async function runSettingsDiagnosticsRepair(provider, action, button = null) {
    if (!provider || !action) return;

    if (button) button.disabled = true;
    setDiagnosticsStatus(`Repairing ${PROVIDER_NAMES[provider] || provider}…`);

    try {
        const result = await chrome.runtime.sendMessage({
            type: "dashboard-diagnostics-repair",
            provider,
            action
        });

        if (result?.ok === true) {
            setDiagnosticsStatus(
                action === "reload-provider"
                    ? "Provider reload requested"
                    : "Repair completed"
            );
            await new Promise(resolve => setTimeout(
                resolve,
                action === "reload-provider" ? 900 : 160
            ));
            await refreshSettingsDiagnostics();
            return;
        }

        setDiagnosticsStatus(result?.error || result?.detail?.reason || "Repair failed");
        await refreshSettingsDiagnostics();
    } catch {
        setDiagnosticsStatus("Repair failed");
        if (button) button.disabled = false;
    }
}

function renderSettingsDiagnostics(snapshot) {
    if (!settingsDiagnosticsContent) return;

    if (!snapshot) {
        settingsDiagnosticsContent.innerHTML = `
            <div class="settings-diagnostics-loading">
                <span class="settings-diagnostics-spinner" aria-hidden="true"></span>
                <strong>Collecting diagnostics…</strong>
            </div>
        `;
        return;
    }

    const shell = snapshot.shell || {};
    const native = snapshot.native || {};
    const audio = snapshot.audio || {};
    const playback = snapshot.playback || {};
    const sleep = snapshot.sleepTimer || {};
    const selfTest = snapshot.selfTest || {};
    const settings = snapshot.settings || {};
    const environment = snapshot.environment || {};
    const manifest = snapshot.manifest || {};
    const displayProfile = snapshot.displayProfile || {};
    const displayTarget = displayProfile.targetDisplay || {};
    const providerStates = shell.providerWindows || {};
    const flightRecorder = snapshot.flightRecorder || {};

    const displayModeLabel = displayProfile.mode
        ? `${String(displayProfile.mode).toUpperCase()} · ${displayProfile.override === "auto" ? "Auto" : `forced ${displayProfile.override}`}`
        : "Unknown";
    const displayTargetLabel = displayTarget.referenceTarget || (
        displayTarget.bounds?.width && displayTarget.bounds?.height
            ? `${displayTarget.bounds.width}×${displayTarget.bounds.height} logical`
            : "Unavailable"
    );
    const appliedLayoutLabel = displayProfile.mode === "compact"
        ? (displayProfile.compactHostReady === true
            ? "Compact · single-surface Shell Home"
            : "Compact staging · fitted dual-pane · host pending")
        : displayProfile.mode === "wide"
            ? "Wide · target-display dual-pane"
            : (displayProfile.appliedLayout || "Legacy wide");

    const runtimeRows =
        diagnosticsRow("Extension", `v${snapshot.extensionVersion}`, "good") +
        diagnosticsRow("Display profile", displayModeLabel, displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Target display", displayTargetLabel, displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Applied layout", appliedLayoutLabel, displayProfile.mode === "compact" && displayProfile.compactHostReady !== true ? "neutral" : "good") +
        diagnosticsRow("Settings provider", snapshot.settingsUi?.provider === "general" ? "General" : (PROVIDER_NAMES[snapshot.settingsUi?.provider] || snapshot.settingsUi?.provider), "neutral") +
        diagnosticsRow("Settings section", settingsSectionLabel(snapshot.settingsUi?.provider, snapshot.settingsUi?.section), "neutral") +
        diagnosticsRow("Left pane", shell.leftMode === "dashboard" ? "Dashboard" : (PROVIDER_NAMES[shell.leftMode] || shell.leftMode), "neutral") +
        diagnosticsRow("Right pane", shell.rightMode === "discord" ? "Discord" : "Dashboard", "neutral");

    const windowRows =
        diagnosticsRow("Browser windows", shell.browserWindowsTotal ?? 0, "neutral") +
        diagnosticsRow("Provider windows", `${shell.providerWindowsAlive}/${shell.providerWindowsKnown} alive`, shell.providerWindowsAlive === shell.providerWindowsKnown ? "good" : "neutral") +
        diagnosticsRow("Landing window", shell.landingWindowAlive ? "Alive" : "Not present", shell.landingWindowAlive ? "good" : "neutral") +
        diagnosticsRow("Dashboard window", shell.dashboardWindowAlive ? "Alive" : "Missing", shell.dashboardWindowAlive ? "good" : "bad");

    const providerRows = Object.entries(PROVIDER_NAMES).map(([provider, label]) => {
        const state = providerStates[provider] || {};
        const page = state.page || {};
        const cachedReport = selfTest?.providers?.[provider]?.report || null;
        const video = page.video || {};
        const resolution = video.width && video.height ? ` · ${video.width}×${video.height}` : "";
        const status = !state.known
            ? "Not created"
            : !state.alive
                ? "Window missing"
                : page.ok
                    ? `Content OK${video.readyState !== undefined ? ` · video ${page.counts?.video || 0}${resolution}` : ""}`
                    : cachedReport
                        ? `Window alive · cached ${cachedReport.ok ? "runtime OK" : "self-test attention"}`
                        : "Window alive · no live probe";
        const statusClass = !state.known
            ? "neutral"
            : !state.alive
                ? "bad"
                : page.ok
                    ? "good"
                    : cachedReport?.ok === false
                        ? "bad"
                        : "neutral";
        return diagnosticsRow(label, status, statusClass);
    }).join("");

    const selfTestChecks = Object.values(selfTest.checks || {});
    const selfTestProviders = Object.values(selfTest.providers || {});
    const selfTestOpenProviders = selfTestProviders.filter(entry => entry?.windowKnown === true && entry?.windowAlive === true);
    const selfTestReported = selfTestOpenProviders.filter(entry => entry?.state === "reported").length;
    const selfTestFailed = selfTestOpenProviders.filter(entry => entry?.state === "failed").length;
    const selfTestRows =
        diagnosticsRow("Launch self-test", selfTest.startedAt ? (selfTest.ok ? "Passed" : "Attention") : "Not run", selfTest.startedAt ? diagnosticsStatusClass(selfTest.ok) : "neutral") +
        diagnosticsRow("Provider API", selfTest.providerApiVersion ? `Contract v${selfTest.providerApiVersion}` : "—", selfTest.providerApiVersion ? "good" : "neutral") +
        diagnosticsRow("Core checks", selfTestChecks.length ? `${selfTestChecks.filter(check => check?.ok !== false).length}/${selfTestChecks.length} passed` : "—", selfTestChecks.some(check => check?.ok === false) ? "bad" : (selfTestChecks.length ? "good" : "neutral")) +
        diagnosticsRow("Provider reports", selfTestOpenProviders.length ? `${selfTestReported}/${selfTestOpenProviders.length} open reported${selfTestFailed ? ` · ${selfTestFailed} failed` : ""}` : "No provider open", selfTestFailed ? "bad" : (selfTestOpenProviders.length && selfTestReported === selfTestOpenProviders.length ? "good" : "neutral")) +
        diagnosticsRow("Last check", selfTest.updatedAt ? new Date(selfTest.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—", "neutral");

    const activeProviderName = shell.activeProvider || null;
    const activeProviderPage = activeProviderName ? providerStates[activeProviderName]?.page || null : null;
    let activeRows = "";
    let resumeRows = "";
    let featureRows = "";

    if (activeProviderPage?.ok) {
        const video = activeProviderPage.video || {};
        const resourceGovernor = activeProviderPage.api?.resourceGovernor || {};
        const resourceModeLabels = {
            "foreground-playing": "Foreground · playing",
            "foreground-paused": "Foreground · paused",
            "idle-visible": "Visible · outside player",
            "background-playing": "Background · playing",
            "sleeping": "Sleeping / heavily throttled"
        };
        const resourceModeLabel = resourceModeLabels[resourceGovernor.mode] ||
            resourceGovernor.mode ||
            "Unknown";
        const governedWorkloads = Array.isArray(resourceGovernor.workloads)
            ? resourceGovernor.workloads
            : [];
        activeRows =
            diagnosticsRow("Provider", PROVIDER_NAMES[activeProviderName] || activeProviderName, "good") +
            diagnosticsRow("Document", `${activeProviderPage.readyState || "?"} · ${activeProviderPage.visibility || "?"}`, "neutral") +
            diagnosticsRow("Managed marker", activeProviderPage.managed ? "Present" : "Missing", diagnosticsStatusClass(activeProviderPage.managed)) +
            diagnosticsRow(
                "Safe mode",
                activeProviderPage.api?.safeMode?.enabled ? "Enabled · provider UI/DOM suppressed" : "Disabled",
                activeProviderPage.api?.safeMode?.enabled ? "neutral" : "good"
            ) +
            diagnosticsRow(
                "Resource governor",
                resourceModeLabel,
                resourceGovernor.mode === "foreground-playing" ? "good" : "neutral"
            ) +
            diagnosticsRow(
                "Governor signals",
                `${resourceGovernor.visible ? "visible" : "hidden"} · ${resourceGovernor.shellActive ? "active" : "inactive"} · ${resourceGovernor.minimized ? "minimized" : "restored"} · ${resourceGovernor.watchContext ? "watch" : "browse"} · DOM ${resourceGovernor.domObserversAllowed ? "live" : "parked"}`,
                "neutral"
            ) +
            diagnosticsRow(
                "Governed loops",
                governedWorkloads.length
                    ? `${governedWorkloads.length} · ${governedWorkloads.map(workload => `${workload.name} ${workload.delayMs ?? "?"}ms`).join(" · ")}`
                    : "No adaptive loop registered",
                governedWorkloads.length ? "good" : "neutral"
            ) +
            diagnosticsRow("Media elements", `${activeProviderPage.counts?.video || 0} video · ${activeProviderPage.counts?.iframe || 0} iframe · ${activeProviderPage.counts?.canvas || 0} canvas`, "neutral") +
            diagnosticsRow("Video ready state", video.readyState ?? "—", video.readyState >= 2 ? "good" : "neutral") +
            diagnosticsRow("Playback rate", Number.isFinite(video.playbackRate) ? `${video.playbackRate.toFixed(2)}x` : "—", "neutral") +
            diagnosticsRow("Resolution", video.width && video.height ? `${video.width}×${video.height}` : "—", "neutral") +
            diagnosticsRow("Provider API", activeProviderPage.api?.adapterLoaded ? `v${activeProviderPage.api?.version || "?"} · ${activeProviderPage.api?.adapterKind || "generic"}` : "Adapter missing", activeProviderPage.api?.adapterLoaded ? "good" : "bad") +
            diagnosticsRow("Adapter self-test", activeProviderPage.api?.selfTest?.ok ? "Passed" : "Attention", activeProviderPage.api?.selfTest?.ok ? "good" : "bad");

        resumeRows =
            diagnosticsRow("Provider", PROVIDER_NAMES[activeProviderName] || activeProviderName, "neutral") +
            diagnosticsRow("Resume strategy", activeProviderPage.api?.resume?.strategy || "pending-seek", "neutral") +
            diagnosticsRow(
                "Stale-link resolver",
                activeProviderPage.api?.capabilities?.common?.linkResolver?.available
                    ? (activeProviderPage.api.capabilities.common.linkResolver.detail || "Ready")
                    : "Unavailable",
                activeProviderPage.api?.capabilities?.common?.linkResolver?.available ? "good" : "neutral"
            ) +
            diagnosticsRow(
                "Pending resume",
                activeProviderPage.api?.resume?.pending
                    ? `${formatPlaybackTime(activeProviderPage.api.resume.targetTime)} · ${activeProviderPage.api.resume.identityMatches === false ? "identity mismatch" : "waiting/applying"}`
                    : "None",
                activeProviderPage.api?.resume?.identityMatches === false ? "bad" : (activeProviderPage.api?.resume?.pending ? "neutral" : "good")
            );

        const extensionCapabilities = activeProviderPage.api?.capabilities?.extensions || {};
        for (const [name, capability] of Object.entries(extensionCapabilities)) {
            const label = name.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
            const value = capability?.supported !== true
                ? "Unsupported"
                : capability?.available === true
                    ? (capability.state || "Available")
                    : (capability.state || "Waiting");
            featureRows += diagnosticsRow(label, value, capability?.available === true ? "good" : "neutral");
        }

        if (activeProviderName === "netflix") {
            const netflixState = activeProviderPage.api?.extensionState || {};
            const metadata = netflixState.metadata || {};
            const wallpaper = netflixState.wallpaper || {};
            const continueWatching = netflixState.continueWatching || {};
            const skipRecap = netflixState.skipRecap || {};
            const skipIntro = netflixState.skipIntro || {};
            const nextEpisode = netflixState.nextEpisode || {};
            const automationLabel = state => state.enabled
                ? (state.buttonPresent ? "Enabled · control present" : "Enabled · armed")
                : "Disabled";

            featureRows +=
                diagnosticsRow("Netflix metadata", metadata.titleAvailable ? `Ready · ${metadata.source || "DOM"}` : "Waiting for player title", metadata.titleAvailable ? "good" : "neutral") +
                diagnosticsRow("Wallpaper runtime", wallpaper.state || "—", wallpaper.marker ? "good" : "neutral") +
                diagnosticsRow("Continue prompt", automationLabel(continueWatching), continueWatching.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Skip recap", automationLabel(skipRecap), skipRecap.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Skip intro", automationLabel(skipIntro), skipIntro.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Next episode", automationLabel(nextEpisode), nextEpisode.buttonPresent ? "good" : "neutral");
        }

        if (activeProviderName === "youtube") {
            const youtubeState = activeProviderPage.api?.extensionState || {};
            const cleanup = youtubeState.cleanup || {};
            const quality = youtubeState.quality || {};
            const uploadDate = youtubeState.uploadDate || {};
            const autoLike = youtubeState.autoLike || {};
            const loop = youtubeState.loop || {};

            featureRows +=
                diagnosticsRow("RYD tooltip", youtubeState.ryd?.tooltipPresent ? "Present" : "Missing", youtubeState.ryd?.tooltipPresent ? "good" : "neutral") +
                diagnosticsRow("Windowed runtime", youtubeState.windowedPlayer?.active ? "Active" : "Off", youtubeState.windowedPlayer?.active ? "good" : "neutral") +
                diagnosticsRow("Theme runtime", youtubeState.theme?.enabled ? (youtubeState.theme?.marker ? "Enabled · marker OK" : "Enabled · marker missing") : "Disabled", youtubeState.theme?.enabled && !youtubeState.theme?.marker ? "bad" : "neutral") +
                diagnosticsRow("Preferred quality", quality.enabled ? `${quality.preferred || "?"} · ${quality.playerPresent ? "player ready" : "player absent"}` : "Disabled", quality.playerPresent ? "good" : "neutral") +
                diagnosticsRow("Upload date", uploadDate.enabled ? `${uploadDate.format || "friendly"} · ${uploadDate.present ? "present" : "waiting"}` : "Disabled", uploadDate.present ? "good" : "neutral") +
                diagnosticsRow("Auto-like", autoLike.enabled ? `${autoLike.trigger || "percent"} · armed` : "Disabled", autoLike.enabled ? "good" : "neutral") +
                diagnosticsRow("Keep playing", youtubeState.keepPlaying?.enabled ? "Armed" : "Disabled", youtubeState.keepPlaying?.enabled ? "good" : "neutral") +
                diagnosticsRow("Loop", loop.overrideEnabled ? "Stream Shell override" : "YouTube native", "neutral") +
                diagnosticsRow("Cleanup", Number.isFinite(cleanup.enabledCount) ? `${cleanup.enabledCount}/${cleanup.configuredCount || 0} rules active` : "—", "neutral");
        }

        if (!featureRows) {
            featureRows = diagnosticsRow("Provider features", "No extension state reported", "neutral");
        }
    } else {
        const unavailable = activeProviderName ? "Content diagnostics unavailable" : "No active provider";
        activeRows = diagnosticsRow("Provider page", unavailable, "neutral");
        resumeRows = diagnosticsRow("Resume state", unavailable, "neutral");
        featureRows = diagnosticsRow("Provider features", unavailable, "neutral");
    }

    const mediaRows =
        diagnosticsRow("Now Playing provider", playback.provider ? (PROVIDER_NAMES[playback.provider] || playback.provider) : "None", playback.provider ? "good" : "neutral") +
        diagnosticsRow("Playback state", playback.state || "Idle", playback.state ? "good" : "neutral") +
        diagnosticsRow("Progress", Number.isFinite(playback.progressPercent) ? `${playback.progressPercent.toFixed(1)}%` : "—", "neutral") +
        diagnosticsRow(playback.provider === "youtube" ? "RYD ratio" : "TMDB rating", playback.hasRating ? "Available" : "Not available", playback.hasRating ? "good" : "neutral");

    const audioRows =
        diagnosticsRow("Audio capture", audio.active ? "Active" : "Idle", audio.active ? "good" : "neutral") +
        diagnosticsRow("Offscreen audio", audio.offscreenDocumentAlive ? "Alive" : "Not present", audio.active ? diagnosticsStatusClass(audio.offscreenDocumentAlive) : "neutral") +
        diagnosticsRow("Capture provider", audio.provider ? (PROVIDER_NAMES[audio.provider] || audio.provider) : "—", "neutral") +
        diagnosticsRow("Processing", audio.active ? `${audio.profile || "normal"} · ${audio.percent || 100}%` : "—", "neutral");

    const targetBounds = displayTarget.bounds;
    const targetWorkArea = displayTarget.workArea;
    const plannedLayout = displayProfile.plannedLayout || {};
    const appliedGeometry = displayProfile.appliedGeometry || {};
    const plannedLayoutText = displayProfile.mode === "wide" && plannedLayout.left && plannedLayout.right
        ? `${plannedLayout.left.width}×${plannedLayout.left.height} + ${plannedLayout.right.width}×${plannedLayout.right.height}`
        : plannedLayout.full
            ? `${plannedLayout.full.width}×${plannedLayout.full.height} single surface`
            : "Unavailable";
    const appliedGeometryText = appliedGeometry.left && appliedGeometry.right
        ? `L ${appliedGeometry.left.left},${appliedGeometry.left.top} ${appliedGeometry.left.width}×${appliedGeometry.left.height} · R ${appliedGeometry.right.left},${appliedGeometry.right.top} ${appliedGeometry.right.width}×${appliedGeometry.right.height}`
        : "Unavailable";
    const environmentRows =
        diagnosticsRow("Platform", environment.platform || "Unknown", "neutral") +
        diagnosticsRow("Language", environment.language || "Unknown", "neutral") +
        diagnosticsRow("Viewport", environment.viewport ? `${environment.viewport.width}×${environment.viewport.height} @ ${environment.viewport.devicePixelRatio || 1}x` : "Unknown", "neutral") +
        diagnosticsRow("Screen", environment.screen?.width ? `${environment.screen.width}×${environment.screen.height}` : "Unknown", "neutral") +
        diagnosticsRow("Display API", displayProfile.apiAvailable ? "Available" : "Unavailable · legacy fallback", displayProfile.apiAvailable ? "good" : "neutral") +
        diagnosticsRow("Connected displays", displayProfile.displayCount ?? 0, "neutral") +
        diagnosticsRow("Profile reason", displayProfile.reason || "Unknown", "neutral") +
        diagnosticsRow("Target class", displayTarget.targetClass || "Unknown", displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Target bounds", targetBounds ? `${targetBounds.left},${targetBounds.top} · ${targetBounds.width}×${targetBounds.height}` : "Unavailable", "neutral") +
        diagnosticsRow("Target work area", targetWorkArea ? `${targetWorkArea.left},${targetWorkArea.top} · ${targetWorkArea.width}×${targetWorkArea.height}` : "Unavailable", "neutral") +
        diagnosticsRow("Display zoom", displayTarget.displayZoomFactor ? `${displayTarget.displayZoomFactor}x` : "—", "neutral") +
        diagnosticsRow("Display DPI", displayTarget.dpiX && displayTarget.dpiY ? `${displayTarget.dpiX}×${displayTarget.dpiY}` : "—", "neutral") +
        diagnosticsRow("Applied geometry", appliedGeometryText, "neutral") +
        diagnosticsRow("Planned layout", plannedLayoutText, "neutral");

    const helperRows =
        diagnosticsRow("Titlebar helper", native.titlebarConnected ? "Connected" : "Unavailable", diagnosticsStatusClass(native.titlebarConnected)) +
        diagnosticsRow("Titlebar mode", native.titlebarVisibilityMode || "Unknown", "neutral") +
        diagnosticsRow("Settings state", native.titlebarSettingsOpen ? "Open" : "Closed", "neutral") +
        diagnosticsRow("Volume state", native.titlebarVolumeActive ? "Active" : "Idle", "neutral") +
        diagnosticsRow("Discord helper", native.discordHelperConnected ? "Connected" : "Unavailable", diagnosticsStatusClass(native.discordHelperConnected)) +
        diagnosticsRow("Discord process", native.discordRunning ? (native.discordVisible ? "Running · visible" : "Running · parked") : "Not running", native.discordRunning ? "good" : "neutral");

    const settingsRows =
        diagnosticsRow("Settings loaded", settings.loaded ? "Yes" : "No", diagnosticsStatusClass(settings.loaded)) +
        diagnosticsRow("Settings keys", settings.keys ?? 0, "neutral") +
        diagnosticsRow("Changed from defaults", settings.modifiedFromDefaults ?? 0, "neutral") +
        diagnosticsRow("Sleep timer", sleep.active ? `${PROVIDER_NAMES[sleep.provider] || sleep.provider} · ${sleep.mode}` : "Off", sleep.active ? "good" : "neutral");

    const manifestRows =
        diagnosticsRow("Manifest", manifest.manifestVersion ? `MV${manifest.manifestVersion}` : "Unknown", manifest.manifestVersion ? "good" : "neutral") +
        diagnosticsRow("Permissions", Array.isArray(manifest.permissions) ? manifest.permissions.length : 0, "neutral") +
        diagnosticsRow("Host permissions", Array.isArray(manifest.hostPermissions) ? manifest.hostPermissions.length : 0, "neutral");

    const generatedAt = snapshot.generatedAt
        ? new Date(snapshot.generatedAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";
    const rawRows =
        diagnosticsRow("Format", snapshot.format || "stream-shell-diagnostics", "neutral") +
        diagnosticsRow("Schema", `v${snapshot.version || "?"}`, "neutral") +
        diagnosticsRow("Snapshot mode", snapshot.mode === "full" ? "Full export" : "Panel · active provider live", "neutral") +
        diagnosticsRow("Generated", generatedAt, "neutral") +
        diagnosticsRow("Flight events", `${Number(flightRecorder.count) || 0}/${Number(flightRecorder.maxEvents) || 200}`, "neutral") +
        diagnosticsRow("Export", "Header download button", "good");

    settingsDiagnosticsContent.innerHTML =
        diagnosticsSection(
            "01",
            "Overview",
            "Shell status first: runtime, windows, provider reachability and launch self-test.",
            diagnosticsCard("Runtime", runtimeRows) +
            diagnosticsCard("Windows", windowRows) +
            diagnosticsCard("Provider health", providerRows) +
            diagnosticsCard("Self-test", selfTestRows),
            "overview"
        ) +
        diagnosticsSection(
            "02",
            "Active provider",
            activeProviderName ? `${PROVIDER_NAMES[activeProviderName] || activeProviderName} content/runtime state and targeted recovery.` : "No provider is currently active.",
            diagnosticsCard("Provider state", activeRows, "", "settings-diagnostics-provider-state-card") +
            diagnosticsSafeModeCard(activeProviderName, activeProviderPage) +
            diagnosticsRepairCard(activeProviderName, activeProviderPage),
            "active"
        ) +
        diagnosticsSection(
            "03",
            "Playback / Resume",
            "Current media state, provider resume path and audio processing are kept together.",
            diagnosticsCard("Playback", mediaRows) +
            diagnosticsCard("Resume", resumeRows) +
            diagnosticsCard("Audio chain", audioRows),
            "playback"
        ) +
        diagnosticsSection(
            "04",
            "Provider features",
            "Provider-specific feature state plus the shared Provider API capability contract.",
            diagnosticsCard("Active provider features", featureRows, "", "settings-diagnostics-feature-card") +
            diagnosticsCapabilityMatrix(providerStates, selfTest),
            "features"
        ) +
        diagnosticsSection(
            "05",
            "Event timeline",
            "The session flight recorder shows the event chain that led to the current state.",
            diagnosticsTimelineCard(flightRecorder),
            "timeline"
        ) +
        diagnosticsSection(
            "06",
            "Environment / Helpers",
            "Browser environment, native helpers, manifest surface and settings state.",
            diagnosticsCard("Environment", environmentRows) +
            diagnosticsCard("Native integrations", helperRows) +
            diagnosticsCard("Manifest", manifestRows) +
            diagnosticsCard("Settings", settingsRows),
            "system"
        ) +
        diagnosticsSection(
            "07",
            "Raw / Export",
            "Snapshot metadata only. The complete structured payload remains in the JSON export.",
            diagnosticsCard("Raw snapshot", rawRows, "Use the download action in the Diagnostics header for the complete JSON payload.", "settings-diagnostics-raw-card"),
            "raw"
        );
}

function setDiagnosticsStatus(text) {
    if (!settingsDiagnosticsStatus) return;
    settingsDiagnosticsStatus.textContent = text || "";
}

async function refreshSettingsDiagnostics() {
    setDiagnosticsStatus("Refreshing…");
    renderSettingsDiagnostics(null);
    const startedAt = performance.now();

    try {
        settingsDiagnosticsSnapshot = await collectSettingsDiagnostics({ full: false });
        renderSettingsDiagnostics(settingsDiagnosticsSnapshot);
        const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
        setDiagnosticsStatus(`Updated ${new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        })} · ${elapsedMs}ms`);
    } catch {
        settingsDiagnosticsSnapshot = null;
        settingsDiagnosticsContent.innerHTML = `
            <div class="settings-diagnostics-loading settings-diagnostics-error">
                <strong>Diagnostics could not be collected.</strong>
            </div>
        `;
        setDiagnosticsStatus("Failed");
    }
}

function diagnosticsIsOpen() {
    return Boolean(
        settingsDiagnosticsOverlay &&
        !settingsDiagnosticsOverlay.hidden &&
        settingsDiagnosticsOverlay.classList.contains("visible")
    );
}

function openSettingsDiagnostics() {
    if (!settingsDiagnosticsOverlay) return;

    if (settingsDiagnosticsCloseTimer) {
        clearTimeout(settingsDiagnosticsCloseTimer);
        settingsDiagnosticsCloseTimer = null;
    }

    settingsDiagnosticsOverlay.hidden = false;
    settingsCenter?.classList.add("diagnostics-open");
    requestAnimationFrame(() => {
        settingsDiagnosticsOverlay.classList.add("visible");
    });

    refreshSettingsDiagnostics();
}

function closeSettingsDiagnostics() {
    if (!settingsDiagnosticsOverlay) return;

    settingsDiagnosticsOverlay.classList.remove("visible");

    if (settingsDiagnosticsCloseTimer) {
        clearTimeout(settingsDiagnosticsCloseTimer);
    }

    settingsDiagnosticsCloseTimer = setTimeout(() => {
        if (!settingsDiagnosticsOverlay.classList.contains("visible")) {
            settingsDiagnosticsOverlay.hidden = true;
            settingsCenter?.classList.remove("diagnostics-open");
        }
        settingsDiagnosticsCloseTimer = null;
    }, 220);
}

async function exportSettingsDiagnostics() {
    setDiagnosticsStatus("Collecting full export…");
    const snapshot = await collectSettingsDiagnostics({ full: true });
    const payload = {
        ...snapshot
    };

    const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `StreamShell-diagnostics-${snapshot.extensionVersion}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setDiagnosticsStatus("Exported");
}

function renderYouTubeSettings(section) {
    if (section === "appearance") {
        return settingsPage(
            "Appearance",
            settingsSubgroup(
                "Dashboard",
                settingSwitch(
                    "streamShellYoutubeThemeEnabled",
                    "Stream Shell background",
                    "Use the custom YouTube wallpaper and transparent shell surfaces."
                )
            )
        );
    }

    if (section === "player") {
        return settingsPage(
            "Player",
            settingsSubgroup(
                "Layout",
                settingSwitch(
                    "streamShellWindowedPlayer_youtube",
                    "Windowed fullscreen",
                    "Fill the Stream Shell provider pane with the YouTube player."
                )
            ) +
            settingsSubgroup(
                "Controls",
                settingSwitch(
                    "streamShellYoutubeExtrasEnabled",
                    "Fullscreen quick actions",
                    "Show YouTube's Like, Dislike, Share and More actions in windowed fullscreen."
                )
            ),
            "",
            "two"
        );
    }

    if (section === "playback") {
        return renderPlaybackSettings(
            "youtube",
            settingsSubgroup(
                "Behavior",
                settingSwitch(
                    "streamShellDoubleClickWindowed_youtube",
                    "Double-click windowed fullscreen",
                    "Double-click the player to toggle Stream Shell's windowed fullscreen mode."
                ) +
                settingSwitch(
                    "streamShellYoutubeLoopEnabled",
                    "Override loop behavior",
                    "Control looping separately for regular videos and Shorts. Turn this off to use YouTube's normal behavior."
                ) +
                settingDependentSwitch(
                    "streamShellYoutubeLoopVideos",
                    "Regular videos",
                    "Loop regular YouTube videos when the override is enabled.",
                    settingValue("streamShellYoutubeLoopEnabled") === true
                ) +
                settingDependentSwitch(
                    "streamShellYoutubeLoopShorts",
                    "Shorts",
                    "Loop Shorts when the override is enabled.",
                    settingValue("streamShellYoutubeLoopEnabled") === true
                )
            )
        );
    }

    if (section === "automation") {
        return settingsPage(
            "Automation",
            settingsSubgroup(
                "Continuous playback",
                settingSwitch(
                    "streamShellYoutubeKeepPlaying",
                    "Keep Playing",
                    "Dismiss YouTube's inactivity confirmation and resume the video."
                )
            ) +
            renderSleepTimerSubgroup("youtube"),
            "Ordinary user pauses are left alone.",
            "two"
        );
    }

    if (section === "subtitles") {
        return renderSubtitleSettings("youtube");
    }

    if (section === "audio") {
        return renderVolumeSettings("youtube");
    }

    if (section === "quality") {
        return settingsPage(
            "Automatic quality",
            settingsSubgroup(
                "Playback quality",
                settingSwitch(
                    "streamShellYoutubeQualityEnabled",
                    "Set video quality automatically",
                    "Apply the preferred quality after navigation and when a video loads."
                ) +
                settingSelect(
                    "streamShellYoutubeQuality",
                    "Preferred quality",
                    "1080p is the current default; lower qualities are used when the video does not offer it.",
                    [
                        ["auto", "Auto"],
                        ["highest", "Highest available"],
                        ["highres", "4320p · 8K"],
                        ["hd2160", "2160p · 4K"],
                        ["hd1440", "1440p"],
                        ["hd1080", "1080p · HD"],
                        ["hd720", "720p · HD"],
                        ["large", "480p"],
                        ["medium", "360p"],
                        ["small", "240p"],
                        ["tiny", "144p"]
                    ]
                ),
                "Used automatically whenever a YouTube video starts."
            )
        );
    }

    if (section === "upload-date") {
        return settingsPage(
            "Upload date",
            settingsSubgroup(
                "Display",
                settingSwitch(
                    "streamShellYoutubeUploadDateEnabled",
                    "Show exact upload date",
                    "Replace YouTube's vague date label when a timestamp is available."
                ) +
                settingSelect(
                    "streamShellYoutubeUploadDateFormat",
                    "Date style",
                    "All styles use a 12-hour clock when a time is available.",
                    [
                        ["friendly", "Aug 28, 2026 · 5:12 PM"],
                        ["numeric", "08/28/2026 · 5:12 PM"],
                        ["iso", "2026-08-28 · 5:12 PM"]
                    ]
                )
            ) +
            settingsSubgroup(
                "Fresh uploads",
                settingSwitch(
                    "streamShellYoutubeUploadDateRelativeEnabled",
                    "Keep relative wording",
                    "Very recent videos can stay as “x hours ago” before switching to the exact date."
                ) +
                settingNumber(
                    "streamShellYoutubeUploadDateRelativeDays",
                    "Relative window",
                    "Number of days before the exact date takes over.",
                    0,
                    30,
                    "days"
                )
            ),
            "",
            "two"
        );
    }

    if (section === "auto-like") {
        const trigger = String(
            settingValue("streamShellYoutubeAutoLikeTrigger")
        );

        const threshold = trigger === "seconds"
            ? settingNumber(
                "streamShellYoutubeAutoLikeSeconds",
                "Elapsed seconds",
                "Like after this many seconds of playback.",
                1,
                7200,
                "sec"
            )
            : settingNumber(
                "streamShellYoutubeAutoLikePercent",
                "Video watched",
                "Like after this percentage of the video has played.",
                1,
                100,
                "%"
            );

        return settingsPage(
            "Auto Like",
            settingsSubgroup(
                "Automatic likes",
                settingSwitch(
                    "streamShellYoutubeAutoLikeEnabled",
                    "Auto Like videos",
                    "Automatically like videos after the selected threshold."
                )
            ) +
            settingsSubgroup(
                "Like after",
                settingSegmented(
                    "streamShellYoutubeAutoLikeTrigger",
                    "Threshold type",
                    "Choose whether the threshold uses watch percentage or elapsed time.",
                    [
                        ["percent", "Percent"],
                        ["seconds", "Seconds"]
                    ]
                ) +
                threshold
            ) +
            settingsSubgroup(
                "Scope & behavior",
                settingSwitch(
                    "streamShellYoutubeAutoLikeShorts",
                    "Apply to Shorts",
                    "Use the same threshold for the active Shorts player."
                ) +
                settingSwitch(
                    "streamShellYoutubeAutoLikeSubscribedOnly",
                    "Subscribed channels only",
                    "Leave disabled to treat every channel the same."
                ) +
                settingSwitch(
                    "streamShellYoutubeAutoLikeWaitForAds",
                    "Wait for ads to finish",
                    "Never fire the Like action while YouTube reports an active ad."
                )
            ),
            "Configure when Auto Like runs and where it applies.",
            "three"
        );
    }

    if (section === "cleanup") {
        const cleanupGroup = (title, note, items) =>
            settingsSubgroup(
                title,
                items.map(
                    ([key, label, description]) =>
                        settingSwitch(key, label, description)
                ).join(""),
                note
            );

        return settingsPage(
            "YouTube cleanup",
            settingsColumn(
                cleanupGroup(
                    "Feeds & recommendations",
                    "Hide feeds, recommendations and end-screen suggestions.",
                    [
                        ["streamShellYoutubeCleanupHideHomeFeed", "Hide Home Feed", "Remove the homepage feed."],
                        ["streamShellYoutubeCleanupHideHomePromotions", "Hide Home Promotions", "Remove YouTube featured, statement and promotional hero banners from Home."],
                        ["streamShellYoutubeCleanupHidePlayables", "Hide Playables", "Remove YouTube Playables / instant-game shelves and navigation entries."],
                        ["streamShellYoutubeCleanupHideVideoSidebar", "Hide Video Sidebar", "Remove the entire watch-page secondary column."],
                        ["streamShellYoutubeCleanupHideRecommended", "Hide Recommended", "Hide recommendation items beside videos."],
                        ["streamShellYoutubeCleanupHideMixes", "Hide Mixes", "Hide YouTube Mix / radio items."],
                        ["streamShellYoutubeCleanupHideEndScreenFeed", "Hide End Screen Feed", "Remove the end-screen feed."],
                        ["streamShellYoutubeCleanupHideEndScreenCards", "Hide End Screen Cards", "Remove individual end-screen cards."]
                    ]
                ) +
                cleanupGroup(
                    "Search",
                    "Hide unrelated shelves mixed into search results.",
                    [
                        ["streamShellYoutubeCleanupHideInaptSearchResults", "Hide Inapt Search Results", "Remove shelf-style detours mixed into search results."]
                    ]
                )
            ) +
            settingsColumn(
                cleanupGroup(
                    "Watch page",
                    "Hide optional panels and extras on watch pages.",
                    [
                        ["streamShellYoutubeCleanupHideLiveChat", "Hide Live Chat", "Hide live chat frames."],
                        ["streamShellYoutubeCleanupHidePlaylist", "Hide Playlist", "Hide the watch-page playlist panel."],
                        ["streamShellYoutubeCleanupHideFundraiser", "Hide Fundraiser", "Hide donation and fundraiser shelves."],
                        ["streamShellYoutubeCleanupHideTranscriptChapters", "Hide Transcript / Chapters", "Hide transcript and chapter engagement panels."],
                        ["streamShellYoutubeCleanupHideComments", "Hide Comments", "Remove the comments section."],
                        ["streamShellYoutubeCleanupHideProfilePhotos", "Hide Profile Photos", "Hide channel/profile avatars in YouTube content."],
                        ["streamShellYoutubeCleanupHideMerch", "Hide Merch, Tickets, Offers", "Remove merch, ticket and product shelves."],
                        ["streamShellYoutubeCleanupHideVideoInfo", "Hide Video Info", "Hide description and lower metadata blocks."]
                    ]
                )
            ) +
            settingsColumn(
                cleanupGroup(
                    "Navigation & header",
                    "Hide items from YouTube’s header and navigation.",
                    [
                        ["streamShellYoutubeCleanupHideTopHeader", "Hide Top Header", "Remove YouTube's masthead."],
                        ["streamShellYoutubeCleanupHideNotifications", "Hide Notifications", "Remove the notification button."],
                        ["streamShellYoutubeCleanupHideExploreTrending", "Hide Explore / Trending", "Hide Explore and Trending navigation entries."],
                        ["streamShellYoutubeCleanupHideMoreFromYouTube", "Hide More from YouTube", "Remove the More from YouTube guide section."],
                        ["streamShellYoutubeCleanupHideShortsTab", "Hide Shorts Tab", "Hide Shorts navigation entries."],
                        ["streamShellYoutubeCleanupHideSubscriptions", "Hide Subscriptions", "Hide the Subscriptions navigation entry."]
                    ]
                ) +
                cleanupGroup(
                    "Playback",
                    "Control autoplay and legacy annotation elements.",
                    [
                        ["streamShellYoutubeCleanupDisableAutoplay", "Disable Autoplay", "Keep YouTube's player autoplay toggle off."],
                        ["streamShellYoutubeCleanupDisableAnnotations", "Disable Annotations", "Hide legacy annotation/card teaser surfaces."]
                    ]
                )
            ),
            "Choose which parts of YouTube to hide or disable.",
            "columns-three"
        );
    }

    return "";
}

function providerSafeModeSettingKey(provider) {
    return `streamShellProviderSafeMode_${provider}`;
}

function renderProviderSafeModeSettings(provider) {
    const label = PROVIDER_NAMES[provider] || provider;

    return settingsPage(
        "Safe mode",
        settingsSubgroup(
            "Provider isolation",
            settingSwitch(
                providerSafeModeSettingKey(provider),
                `${label} Safe Mode`,
                "Temporarily suppress Stream Shell's provider-specific DOM/UI features while keeping Provider API, Continue/Resume, Now Playing and Diagnostics active."
            )
        ),
        "Your normal provider feature settings are preserved and restored when Safe Mode is disabled."
    );
}

function settingsSectionLabel(provider, section) {
    return (SETTINGS_SECTIONS[provider] || [])
        .find(([id]) => id === section)?.[1] ||
        section;
}

function renderSettingsSearchResults(provider, query) {
    const normalized = String(query || "").trim().toLowerCase();

    if (!normalized) {
        return `
            <div class="settings-search-empty">
                <strong>Search ${PROVIDER_NAMES[provider] || provider}</strong>
                <span>Type a setting, behavior or feature name to jump straight to it.</span>
            </div>
        `;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    const matches = [
        ...(SETTINGS_SEARCH_ITEMS[provider] || [])
    ]
        .filter(([section, title, keywords]) => {
            const haystack = `${settingsSectionLabel(provider, section)} ${title} ${keywords}`.toLowerCase();
            return words.every(word => haystack.includes(word));
        })
        .slice(0, 30);

    if (!matches.length) {
        return `
            <div class="settings-search-empty">
                <strong>No matching settings</strong>
                <span>Try a broader term such as “volume”, “subtitle”, “skip”, “loop” or “quality”.</span>
            </div>
        `;
    }

    return matches.map(([section, title, keywords]) => {
        const label = settingsSectionLabel(provider, section);
        const hint = String(keywords || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7)
            .join(" ");

        return `
            <button
                type="button"
                class="settings-search-result"
                data-settings-search-section="${section}"
            >
                <span class="settings-search-result-copy">
                    <strong>${title}</strong>
                    <span>${label}${hint ? ` · ${hint}` : ""}</span>
                </span>
                <span class="settings-search-result-arrow" aria-hidden="true">›</span>
            </button>
        `;
    }).join("");
}

function renderSettingsSearch(provider) {
    return `
        <section class="settings-group settings-group-page settings-search-page">
            <div class="settings-group-heading">
                <h2>Search</h2>
                <p>Find settings for ${PROVIDER_NAMES[provider] || provider} without hunting through every section.</p>
            </div>

            <div class="settings-search-box">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5"></circle>
                    <path d="M16 16L21 21"></path>
                </svg>
                <input
                    id="settings-search-input"
                    class="settings-search-input"
                    type="search"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Search ${PROVIDER_NAMES[provider] || provider} settings…"
                    aria-label="Search ${PROVIDER_NAMES[provider] || provider} settings"
                >
            </div>

            <div
                id="settings-search-results"
                class="settings-search-results"
            >${renderSettingsSearchResults(provider, settingsSearchQuery)}</div>
        </section>
    `;
}

function updateSettingsSearchResults() {
    const results = document.getElementById("settings-search-results");
    if (!results) return;
    results.innerHTML = renderSettingsSearchResults(settingsProvider, settingsSearchQuery);
}

function renderSettingsContent() {
    if (!settingsContent) {
        return;
    }

    if (settingsCenter) {
        settingsCenter.dataset.settingsSection = settingsSection;
    }

    let html = "";

    if (settingsSection === "search") {
        html = renderSettingsSearch(settingsProvider);
    }

    if (settingsSection === "display") {
        html = renderDisplaySettings();
    }

    if (settingsProvider === "general" && settingsSection === "twitch") {
        html = renderTwitchUtilitySettings();
    }

    if (settingsSection === "audio") {
        html = renderVolumeSettings(settingsProvider);
    }

    if (settingsProvider === "general" && settingsSection === "anarchy") {
        html = renderAnarchySettings();
    }

    if (settingsSection === "safe-mode") {
        html = renderProviderSafeModeSettings(settingsProvider);
    }

    if (settingsProvider === "youtube" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        html = renderYouTubeSettings(settingsSection);
    }

    if (settingsProvider === "netflix" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "appearance") {
            html = settingsPage(
                "Appearance",
                settingsSubgroup(
                    "Dashboard",
                    settingSwitch(
                        "streamShellNetflixThemeEnabled",
                        "Stream Shell background",
                        "Use the custom Netflix wallpaper outside playback routes."
                    )
                )
            );
        }

        if (settingsSection === "playback") {
            html = renderPlaybackSettings("netflix");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellNetflixAutoSkipIntro",
                        "Skip intros",
                        "Press Netflix's Skip Intro action when it appears."
                    ) +
                    settingSwitch(
                        "streamShellNetflixAutoSkipRecap",
                        "Skip recaps",
                        "Press Netflix's Skip Recap action when it appears."
                    )
                ) +
                settingsSubgroup(
                    "Binge watching",
                    settingSwitch(
                        "streamShellNetflixAutoNextEpisode",
                        "Start next episode",
                        "Start the next episode as soon as Netflix exposes the action."
                    ) +
                    settingSwitch(
                        "streamShellNetflixContinueWatching",
                        "Dismiss still-watching prompt",
                        "Confirm Netflix's inactivity prompt automatically."
                    )
                ) +
                renderSleepTimerSubgroup("netflix"),
                "Each action only runs when Netflix exposes its matching player control.",
                "three"
            );
        }

        if (settingsSection === "subtitles") {
            html = renderSubtitleSettings("netflix");
        }
    }

    if (settingsProvider === "prime" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "player") {
            html = settingsPage(
                "Player",
                settingsSubgroup(
                    "Layout",
                    settingSwitch(
                        "streamShellPrimeUiFixEnabled",
                        "Ultrawide player UI fix",
                        "Keep Prime Video's controls aligned correctly in the Stream Shell pane."
                    )
                ) +
                settingsSubgroup(
                    "Clean player",
                    settingSwitch(
                        "streamShellPrimeHideXray",
                        "Hide X-Ray",
                        "Keep cast, trivia and scene information out of the player overlay."
                    ) +
                    settingSwitch(
                        "streamShellPrimeHideOverlay",
                        "Hide dark overlay",
                        "Keep the picture clear when Prime Video shows its player controls."
                    )
                ),
                "Player cleanup without removing the controls you still use.",
                "two"
            );
        }

        if (settingsSection === "playback") {
            html = renderPlaybackSettings("prime");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellPrimeAutoSkipIntro",
                        "Skip intros",
                        "Press Prime Video's Skip Intro action as soon as it appears."
                    ) +
                    settingSwitch(
                        "streamShellPrimeAutoSkipRecap",
                        "Skip recaps",
                        "Skip previously-on and recap segments automatically."
                    ) +
                    settingSwitch(
                        "streamShellPrimeAutoSkipPromos",
                        "Skip promos",
                        "Skip pre-roll trailers and promotional clips when Prime offers a skip button."
                    )
                ) +
                renderSleepTimerSubgroup("prime"),
                "Skip actions only run when Prime Video exposes a matching control.",
                "two"
            );
        }

        if (settingsSection === "subtitles") {
            html = settingsPage(
                "Subtitles",
                settingsSubgroup(
                    "Size",
                    settingSelect(
                        "streamShellPrimeSubtitleScale",
                        "Subtitle scale",
                        "Scale Prime Video subtitles relative to their normal size.",
                        [
                            ["0.5", "0.5x"],
                            ["0.8", "0.8x"],
                            ["1", "1.0x"],
                            ["1.25", "1.25x"],
                            ["1.5", "1.5x"],
                            ["2", "2.0x"]
                        ]
                    )
                ) +
                settingsSubgroup(
                    "Color",
                    settingSelect(
                        "streamShellPrimeSubtitleColor",
                        "Text color",
                        "Choose a readable subtitle color.",
                        [
                            ["#ffffff", "White"],
                            ["#e8e8e8", "Soft white"],
                            ["#fff0b3", "Warm"],
                            ["#c7e6ff", "Light blue"],
                            ["#d2efd8", "Light green"]
                        ]
                    )
                ) +
                settingsSubgroup(
                    "Font",
                    settingSelect(
                        "streamShellPrimeSubtitleFont",
                        "Font family",
                        "Use Prime Video's font or override it locally.",
                        [
                            ["default", "Default"],
                            ["Arial", "Arial"],
                            ["Helvetica", "Helvetica"],
                            ["Georgia", "Georgia"],
                            ["Times New Roman", "Times New Roman"],
                            ["Courier New", "Courier New"],
                            ["Verdana", "Verdana"],
                            ["Roboto", "Roboto"]
                        ]
                    )
                ),
                "Subtitle styling is applied locally and updates without reloading the stream.",
                "three"
            );
        }
    }

    if (settingsProvider === "disney" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "playback") {
            html = renderPlaybackSettings("disney");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                renderSleepTimerSubgroup("disney")
            );
        }

        if (settingsSection === "subtitles") {
            html = renderSubtitleSettings("disney");
        }
    }

    if (settingsProvider === "crunchyroll" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "appearance") {
            html = settingsPage(
                "Appearance",
                settingsSubgroup(
                    "Spoiler protection",
                    settingSwitch(
                        "streamShellCrunchyrollBlurEpisodeThumbnails",
                        "Blur episode thumbnails",
                        "Blur artwork on links that open Crunchyroll episodes."
                    )
                )
            );
        }

        if (settingsSection === "player") {
            html = settingsPage(
                "Player",
                settingsSubgroup(
                    "Layout",
                    settingSwitch(
                        "streamShellWindowedPlayer_crunchyroll",
                        "Windowed fullscreen",
                        "Fill the Stream Shell provider pane with the Crunchyroll player."
                    )
                ),
                "Keep the player focused on the video while retaining normal controls."
            );
        }

        if (settingsSection === "playback") {
            html = renderPlaybackSettings(
                "crunchyroll",
                renderWindowedGestureSetting("crunchyroll")
            );
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipIntro",
                        "Skip intros",
                        "Seek past Crunchyroll's published intro segment automatically."
                    ) +
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipRecap",
                        "Skip recaps",
                        "Seek past Crunchyroll's published recap segment automatically."
                    ) +
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipCredits",
                        "Skip credits",
                        "Seek past Crunchyroll's published credits segment automatically."
                    )
                ) +
                renderSleepTimerSubgroup("crunchyroll"),
                "Uses Crunchyroll's own per-episode skip timings when they are available.",
                "two"
            );
        }

    }

    settingsContent.innerHTML = html;

    if (settingsSection === "search") {
        const searchInput = document.getElementById("settings-search-input");
        if (searchInput) {
            searchInput.value = settingsSearchQuery;
        }
    }

    syncAnarchySettingsVisuals();
}

function renderSettingsSidebar() {
    if (!settingsSidebar) {
        return;
    }

    const sections = SETTINGS_SECTIONS[settingsProvider] || [];

    if (!sections.some(([id]) => id === settingsSection)) {
        settingsSection = defaultSettingsSection(settingsProvider);
    }

    settingsSidebar.innerHTML = sections.map(
        ([id, label]) => `
            <button
                type="button"
                class="settings-section-button ${id === "search" ? "settings-section-search " : ""}${id === settingsSection ? "active" : ""}"
                data-settings-section="${id}"
            >
                ${label}
            </button>
        `
    ).join("");
}

function renderSettingsTabs() {
    settingsProviderTabs
        ?.querySelectorAll("[data-settings-provider]")
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.settingsProvider === settingsProvider
                );
            }
        );

    if (settingsCenter) {
        settingsCenter.dataset.settingsProvider = settingsProvider;
        settingsCenter.dataset.settingsSection = settingsSection;
    }
}

function renderSettingsCenter() {
    renderSettingsTabs();
    renderSettingsSidebar();
    renderSettingsContent();
}

async function loadSettingsValues() {
    try {
        const stored = await chrome.storage.local.get(
            Object.keys(SETTINGS_DEFAULTS)
        );

        settingsValues = {
            ...SETTINGS_DEFAULTS,
            ...stored
        };
    } catch {
        settingsValues = {
            ...SETTINGS_DEFAULTS
        };
    }

    settingsLoaded = true;
}

async function openSettingsCenter(provider) {
    if (
        provider &&
        SETTINGS_SECTIONS[provider]
    ) {
        settingsProvider = provider;
    } else if (PROVIDERS.has(currentLeftMode)) {
        settingsProvider = currentLeftMode;
    }

    settingsSection = defaultSettingsSection(settingsProvider);

    if (!settingsLoaded) {
        await loadSettingsValues();
    }

    await refreshSleepTimerState();

    if (settingsCloseTimer) {
        clearTimeout(settingsCloseTimer);
        settingsCloseTimer = null;
    }

    settingsCenter.hidden = false;
    renderSettingsCenter();

    requestAnimationFrame(
        () => {
            document.body.classList.add("settings-open");
            settingsCenter.classList.add("visible");
            notifySettingsVisibility(true);
        }
    );
}

function closeSettingsCenter() {
    closeSettingsDiagnostics();
    stopAnarchySettingsColors();
    settingsCenter.classList.remove("visible");
    document.body.classList.remove("settings-open");
    notifySettingsVisibility(false);

    if (settingsCloseTimer) {
        clearTimeout(settingsCloseTimer);
    }

    settingsCloseTimer = setTimeout(
        () => {
            if (!settingsCenter.classList.contains("visible")) {
                settingsCenter.hidden = true;
            }

            settingsCloseTimer = null;
        },
        260
    );
}

function settingsCenterIsOpen() {
    return Boolean(
        settingsCenter &&
        !settingsCenter.hidden &&
        settingsCenter.classList.contains("visible")
    );
}

async function toggleSettingsCenter(provider) {
    if (settingsCenterIsOpen()) {
        closeSettingsCenter();
        return;
    }

    await openSettingsCenter(provider);
}

function selectSettingsProvider(provider) {
    if (!SETTINGS_SECTIONS[provider]) {
        return;
    }

    settingsProvider = provider;
    settingsSection = defaultSettingsSection(provider);
    renderSettingsCenter();
}

function selectSettingsSection(section) {
    const sections = SETTINGS_SECTIONS[settingsProvider] || [];

    if (!sections.some(([id]) => id === section)) {
        return;
    }

    settingsSection = section;
    renderSettingsSidebar();
    renderSettingsContent();
}

function handleSettingsClick(event) {
    const button = event.target.closest("button");

    if (!button) {
        return false;
    }

    if (button.id === "now-playing-settings") {
        event.preventDefault();
        event.stopPropagation();

        toggleSettingsCenter(
            nowPlayingPanel.dataset.provider || currentLeftMode
        );
        return true;
    }

    if (button.id === "settings-diagnostics") {
        event.preventDefault();
        if (diagnosticsIsOpen()) {
            closeSettingsDiagnostics();
        } else {
            openSettingsDiagnostics();
        }
        return true;
    }

    if (button.id === "settings-diagnostics-close") {
        event.preventDefault();
        closeSettingsDiagnostics();
        return true;
    }

    if (button.id === "settings-diagnostics-refresh") {
        event.preventDefault();
        refreshSettingsDiagnostics();
        return true;
    }

    if (button.id === "settings-diagnostics-export") {
        event.preventDefault();
        exportSettingsDiagnostics()
            .catch(() => setDiagnosticsStatus("Export failed"));
        return true;
    }

    if (button.dataset.diagnosticsSafeMode) {
        event.preventDefault();
        runSettingsDiagnosticsSafeMode(
            button.dataset.diagnosticsProvider,
            button.dataset.diagnosticsSafeMode === "true",
            button
        );
        return true;
    }

    if (button.dataset.diagnosticsRepair) {
        event.preventDefault();
        runSettingsDiagnosticsRepair(
            button.dataset.diagnosticsProvider,
            button.dataset.diagnosticsRepair,
            button
        );
        return true;
    }

    if (button.id === "settings-close") {
        event.preventDefault();
        closeSettingsCenter();
        return true;
    }

    if (button.id === "settings-export") {
        event.preventDefault();
        exportStreamShellSettings().catch(() => showSettingsIoStatus("Export failed"));
        return true;
    }

    if (button.id === "settings-import") {
        event.preventDefault();
        settingsImportFile?.click();
        return true;
    }

    const searchSection = button.dataset.settingsSearchSection;
    if (searchSection) {
        event.preventDefault();
        selectSettingsSection(searchSection);
        return true;
    }

    const sleepMode = button.dataset.sleepMode;
    const sleepProvider = button.dataset.sleepProvider;
    if (sleepMode && sleepProvider) {
        event.preventDefault();
        setSleepTimerFromSettings(sleepProvider, sleepMode).catch(() => {});
        return true;
    }

    const provider = button.dataset.settingsProvider;
    if (provider) {
        event.preventDefault();
        if (diagnosticsIsOpen()) {
            closeSettingsDiagnostics();
        }
        selectSettingsProvider(provider);
        return true;
    }

    const section = button.dataset.settingsSection;
    if (section) {
        event.preventDefault();
        selectSettingsSection(section);
        return true;
    }

    return false;
}

function normalizeSettingInput(input) {
    const key = input.dataset.settingKey;
    if (!key) {
        return null;
    }

    let value;

    if (input.type === "checkbox") {
        value = input.checked;
    } else if (input.dataset.settingNumber === "true") {
        const min = Number(input.min);
        const max = Number(input.max);
        let numeric = Number(input.value);

        if (!Number.isFinite(numeric)) {
            numeric = Number(SETTINGS_DEFAULTS[key]) || 0;
        }

        if (Number.isFinite(min)) {
            numeric = Math.max(min, numeric);
        }

        if (Number.isFinite(max)) {
            numeric = Math.min(max, numeric);
        }

        input.value = String(numeric);
        value = numeric;
    } else {
        value = input.value;
    }

    return { key, value };
}

async function persistSettingInput(input) {
    const normalized = normalizeSettingInput(input);
    if (!normalized) {
        return;
    }

    settingsValues[normalized.key] = normalized.value;

    try {
        await chrome.storage.local.set({
            [normalized.key]: normalized.value
        });

        try {
            await chrome.runtime.sendMessage({
                type: "dashboard-flight-event",
                event: {
                    category: "settings",
                    action: "changed",
                    detail: { key: normalized.key }
                }
            });
        } catch {
        }

        if (
            normalized.key === "streamShellSleepTimerAction" &&
            sleepTimerState
        ) {
            const response = await chrome.runtime.sendMessage({
                type: "sleep-timer-action",
                action: normalized.value
            });
            sleepTimerState = response?.session || sleepTimerState;
        }
    } catch {
    }
}

document.addEventListener(
    "input",
    event => {
        const searchInput = event.target.closest?.("#settings-search-input");
        if (searchInput) {
            settingsSearchQuery = searchInput.value || "";
            updateSettingsSearchResults();
            return;
        }

        const input = event.target.closest?.(".settings-range[data-setting-key]");
        if (!input) {
            return;
        }

        const key = input.dataset.settingKey;
        const output = settingsContent?.querySelector(
            `[data-setting-output="${key}"]`
        );

        if (output) {
            output.textContent = `${input.value}%`;
        }
    },
    true
);

document.addEventListener(
    "change",
    event => {
        const input = event.target.closest?.("[data-setting-key]");
        if (!input) {
            return;
        }

        persistSettingInput(input);
    },
    true
);

settingsImportFile?.addEventListener(
    "change",
    () => {
        const file = settingsImportFile.files?.[0];
        settingsImportFile.value = "";
        if (!file) return;
        importStreamShellSettings(file)
            .catch(() => showSettingsIoStatus("Import failed"));
    }
);

chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "sleep-timer-state") return;
    sleepTimerState = message.session || null;
    if (!settingsCenter.hidden && settingsSection === "automation") {
        renderSettingsContent();
    }
});

document.addEventListener(
    "keydown",
    event => {
        if (event.key !== "Escape") {
            return;
        }

        if (diagnosticsIsOpen()) {
            event.preventDefault();
            closeSettingsDiagnostics();
            return;
        }

        if (!settingsCenter.hidden) {
            event.preventDefault();
            closeSettingsCenter();
        }
    },
    true
);

chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (areaName !== "local") {
            return;
        }

        let relevant = false;
        for (const [key, change] of Object.entries(changes)) {
            if (!Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, key)) {
                continue;
            }

            settingsValues[key] = change.newValue === undefined
                ? SETTINGS_DEFAULTS[key]
                : change.newValue;
            relevant = true;
        }

        if (relevant && !settingsCenter.hidden) {
            renderSettingsContent();
        }
    }
);

notifySettingsVisibility(false);
loadSettingsValues().catch(() => {});
/*
 * ============================================================
 * CLICK ROUTER
 * ============================================================
 */

document.addEventListener(
    "click",
    event => {
        if (
            document.body.dataset.layoutProfile === "compact" &&
            event.target.closest?.("#compact-home-runtime-root")
        ) {
            return;
        }

        const insideSettings =
            event.target.closest?.(
                "#settings-center"
            );


        if (
            insideSettings
        ) {
            if (
                handleSettingsClick(
                    event
                )
            ) {
                event.stopImmediatePropagation();
            }


            return;
        }


        if (
            handleSettingsClick(
                event
            )
        ) {
            event.stopImmediatePropagation();
            return;
        }


        event.stopImmediatePropagation();


        const nowPlayingTarget =
            event.target.closest(
                "#now-playing"
            );


        if (
            nowPlayingTarget &&
            !nowPlayingPanel.classList.contains(
                "empty"
            )
        ) {
            event.preventDefault();


            const provider =
                nowPlayingPanel.dataset.provider;


            if (
                provider &&
                PROVIDERS.has(
                    provider
                )
            ) {
                chrome.runtime.sendMessage({
                    type:
                        "dashboard-switch-provider",

                    provider
                });
            }


            return;
        }


        const button =
            event.target.closest(
                "button"
            );


        if (
            !button
        ) {
            return;
        }


        event.preventDefault();


        const provider =
            button.dataset.provider;


        if (
            provider &&
            PROVIDERS.has(
                provider
            )
        ) {
            openProvider(
                provider
            );


            return;
        }


        if (
            button.id ===
            "reload-left"
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-reload-left"
            });


            return;
        }


        if (
            button.id ===
            "kill-shell"
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-kill-stream-shell"
            });
        }
    },

    true
);


nowPlayingPanel.addEventListener(
    "keydown",
    event => {
        if (
            event.target.closest?.(
                "button"
            )
        ) {
            return;
        }


        if (
            (
                event.key !==
                    "Enter" &&
                event.key !==
                    " "
            ) ||
            nowPlayingPanel.classList.contains(
                "empty"
            )
        ) {
            return;
        }


        event.preventDefault();


        const provider =
            nowPlayingPanel.dataset.provider;


        if (
            provider &&
            PROVIDERS.has(
                provider
            )
        ) {
            chrome.runtime.sendMessage({
                type:
                    "dashboard-switch-provider",

                provider
            });
        }
    }
);


/*
 * ============================================================
 * COMPACT HOME LAZY LOADER
 * ============================================================
 * Wide must keep the pre-0.14 dashboard runtime surface. The much larger
 * Landing-derived Watchlist/Search/Subscriptions runtime is therefore parsed
 * only after the session has positively identified itself as Compact.
 */
let compactHomeRuntimeLoadPromise = null;

function ensureCompactHomeRuntimeLoaded(layoutProfile) {
    if (layoutProfile !== "compact") {
        return Promise.resolve(false);
    }

    if (compactHomeRuntimeLoadPromise) {
        return compactHomeRuntimeLoadPromise;
    }

    compactHomeRuntimeLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-stream-shell-compact-home]');
        if (existing) {
            resolve(true);
            return;
        }

        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("dashboard/compact-home.js");
        script.async = false;
        script.dataset.streamShellCompactHome = "true";
        script.addEventListener("load", () => resolve(true), { once: true });
        script.addEventListener("error", () => reject(new Error("compact-home-runtime-load-failed")), { once: true });
        document.head.appendChild(script);
    }).catch(error => {
        compactHomeRuntimeLoadPromise = null;
        console.error("Compact Home runtime failed:", error);
        return false;
    });

    return compactHomeRuntimeLoadPromise;
}
/*
 * ============================================================
 * STREAM SHELL STATE
 * ============================================================
 */

chrome.runtime.sendMessage({
    type:
        "get-state"
})
    .then(
        renderState
    )
    .catch(
        () => {}
    );


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message.type ===
            "state-changed"
        ) {
            renderState(
                message
            );
            return;
        }


        if (
            message.type ===
            "dashboard-toggle-settings"
        ) {
            toggleSettingsCenter(
                message.provider
            ).catch(
                () => {}
            );
        }
    }
);


function renderState(
    state
) {
    if (
        !state
    ) {
        return;
    }


    let provider =
        state.activeProvider ||
        "netflix";


    if (
        !PROVIDERS.has(
            provider
        )
    ) {
        provider =
            "netflix";
    }


    const reportedLayoutProfile =
        state.layoutProfile === "compact"
            ? "compact"
            : (state.layoutProfile === "wide" ? "wide" : null);

    /*
     * layoutProfile is session-stable for now (live dock reflow is explicitly
     * deferred). Only the initial get-state / explicit profile-bearing message
     * may touch this high-impact body attribute; ordinary state broadcasts no
     * longer trigger a full dashboard style invalidation.
     */
    if (reportedLayoutProfile) {
        document.body.dataset.layoutProfile = reportedLayoutProfile;
        ensureCompactHomeRuntimeLoaded(reportedLayoutProfile).catch(() => {});
    }

    const layoutProfile =
        document.body.dataset.layoutProfile === "compact"
            ? "compact"
            : "wide";

    const leftMode =
        state.leftMode ||
        (layoutProfile === "compact" ? "dashboard" : "landing");


    const rightMode =
        state.rightMode ||
        "dashboard";


    currentLeftMode =
        leftMode;


    if (
        reloadLeftButton
    ) {
        setContextualControlVisible(
            reloadLeftSlot,
            reloadLeftButton,
            PROVIDERS.has(
                leftMode
            )
        );
    }


    const landingExposed =
        layoutProfile === "wide" &&
        state.landingExposed === true;


    brandArea.classList.toggle(
        "landing-exposed",
        landingExposed
    );


    document.body.dataset.provider =
        provider;


    const backgroundVariant =
        layoutProfile === "compact"
            ? "compact"
            : "wide";


    panorama.style.backgroundImage =
        `url("${chrome.runtime.getURL(
            `assets/backgrounds/${provider}_${backgroundVariant}.png`
        )}")`;


    const wordmark =
        WORDMARKS[
            provider
        ];


    if (
        wordmark
    ) {
        providerWordmark.src =
            chrome.runtime.getURL(
                wordmark
            );

    } else {

        providerWordmark.removeAttribute(
            "src"
        );
    }


    leftStatus.textContent =
        leftMode ===
            "landing"
            ? "Landing"
            : (
                PROVIDER_NAMES[
                    leftMode
                ] ||
                leftMode
            );


    rightStatus.textContent =
        RIGHT_MODE_NAMES[
            rightMode
        ] ||
        rightMode;


    requestAnimationFrame(
        () => {
            syncNowPlayingWidth();
            renderNowPlaying();
        }
    );


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.provider ===
                        provider
                );
            }
        );
}