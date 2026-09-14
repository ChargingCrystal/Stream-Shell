    function getActiveYouTubeShortsRenderer() {
        if (
            getCurrentProvider?.() !==
                "youtube" ||
            !location.pathname.startsWith(
                "/shorts/"
            )
        ) {
            return null;
        }


        const shortsVideos =
            document.querySelectorAll(
                "ytd-reel-video-renderer video"
            );


        // A playing media element is the strongest available signal. It also
        // survives cases where YouTube leaves Polymer's is-active marker stale
        // or applies it late after a long non-Shorts session.
        for (
            const video
            of shortsVideos
        ) {
            if (
                video.paused ||
                video.ended ||
                video.readyState < 2
            ) {
                continue;
            }


            const renderer =
                video.closest?.(
                    "ytd-reel-video-renderer"
                );


            if (
                renderer
            ) {
                return renderer;
            }
        }


        const marked =
            document.querySelector(
                "ytd-reel-video-renderer[is-active]"
            );


        if (
            marked
        ) {
            try {
                const rect =
                    marked.getBoundingClientRect();

                if (
                    rect.bottom > 0 &&
                    rect.right > 0 &&
                    rect.top < window.innerHeight &&
                    rect.left < window.innerWidth
                ) {
                    return marked;
                }
            } catch {
            }
        }


        try {
            const centered =
                document.elementFromPoint(
                    Math.max(
                        0,
                        Math.min(
                            window.innerWidth - 1,
                            window.innerWidth / 2
                        )
                    ),
                    Math.max(
                        0,
                        Math.min(
                            window.innerHeight - 1,
                            window.innerHeight / 2
                        )
                    )
                )?.closest?.(
                    "ytd-reel-video-renderer"
                );


            if (
                centered
            ) {
                return centered;
            }
        } catch {
        }


        const renderers =
            document.querySelectorAll(
                "ytd-reel-video-renderer"
            );


        let best =
            null;

        let bestVisibleArea =
            0;


        for (
            const renderer
            of renderers
        ) {
            const rect =
                renderer.getBoundingClientRect();


            const visibleWidth =
                Math.max(
                    0,
                    Math.min(
                        rect.right,
                        window.innerWidth
                    ) -
                    Math.max(
                        rect.left,
                        0
                    )
                );

            const visibleHeight =
                Math.max(
                    0,
                    Math.min(
                        rect.bottom,
                        window.innerHeight
                    ) -
                    Math.max(
                        rect.top,
                        0
                    )
                );

            const visibleArea =
                visibleWidth *
                visibleHeight;


            if (
                visibleArea >
                    bestVisibleArea
            ) {
                best =
                    renderer;

                bestVisibleArea =
                    visibleArea;
            }
        }


        if (
            best
        ) {
            return best;
        }


        return marked || null;
    }


    function getPrimaryVideo() {
        /*
         * YouTube is by far the hottest caller of this helper. Its active
         * video is already addressable without enumerating every <video> and
         * forcing geometry reads, so take the cheap provider-specific path
         * first and keep the generic area scan as a fallback for everyone
         * else.
         */
        if (
            getCurrentProvider?.() ===
                "youtube"
        ) {
            if (
                location.pathname.startsWith(
                    "/shorts/"
                )
            ) {
                const activeShort =
                    getActiveYouTubeShortsRenderer()
                        ?.querySelector?.(
                            "video"
                        );


                if (
                    activeShort
                ) {
                    return activeShort;
                }
            }


            const moviePlayerVideo =
                document.querySelector(
                    "#movie_player video"
                ) ||
                document.querySelector(
                    "video.html5-main-video"
                );


            if (
                moviePlayerVideo
            ) {
                return moviePlayerVideo;
            }
        }


        const videos =
            document.querySelectorAll(
                "video"
            );


        if (
            videos.length ===
                1
        ) {
            return videos[0];
        }


        if (
            videos.length ===
                0
        ) {
            return null;
        }


        let best =
            null;

        let bestArea =
            0;


        for (
            const video
            of videos
        ) {
            const rect =
                video.getBoundingClientRect();


            const area =
                Math.max(
                    0,
                    rect.width
                ) *
                Math.max(
                    0,
                    rect.height
                );


            if (
                area > bestArea
            ) {
                best =
                    video;

                bestArea =
                    area;
            }
        }


        return best;
    }


    function getPlaybackSnapshot() {
        const video =
            getPrimaryVideo();


        if (
            !video
        ) {
            return {
                playbackState:
                    "unknown",

                currentTime:
                    null,

                duration:
                    null
            };
        }


        const currentTime =
            Number.isFinite(
                video.currentTime
            )
                ? Math.max(
                    0,
                    video.currentTime
                )
                : null;


        const duration =
            Number.isFinite(
                video.duration
            ) &&
            video.duration > 0
                ? video.duration
                : null;


        let playbackState =
            "unknown";


        if (
            video.ended
        ) {
            playbackState =
                "ended";

        } else if (
            video.paused
        ) {
            playbackState =
                currentTime !== null &&
                currentTime > .25
                    ? "paused"
                    : "ready";

        } else {

            playbackState =
                "playing";
        }


        return {
            playbackState,

            currentTime,

            duration
        };
    }


