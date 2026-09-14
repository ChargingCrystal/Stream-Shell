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


