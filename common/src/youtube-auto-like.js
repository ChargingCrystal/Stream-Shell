    function getActiveYouTubeVideo() {
        return getPrimaryVideo();
    }


    function isYouTubeSubscribed() {
        const subscribeButton =
            document.querySelector(
                "ytd-subscribe-button-renderer button, ytd-subscribe-button-renderer tp-yt-paper-button"
            );


        if (
            !subscribeButton
        ) {
            return false;
        }


        const text =
            String(
                subscribeButton.textContent ||
                subscribeButton.getAttribute(
                    "aria-label"
                ) ||
                ""
            )
                .trim()
                .toLowerCase();


        return subscribeButton.hasAttribute(
            "subscribed"
        ) ||
            text.includes(
                "subscribed"
            ) ||
            text.includes(
                "abonniert"
            );
    }


    function getYouTubeLikeButtons() {
        const shorts =
            location.pathname.startsWith(
                "/shorts/"
            );


        const scope =
            shorts
                ? getActiveYouTubeShortsRenderer()
                : document;


        if (
            shorts &&
            !scope
        ) {
            return {
                like: null,
                dislike: null
            };
        }


        const like =
            scope.querySelector(
                "#segmented-like-button button, like-button-view-model button, #like-button button"
            );


        const dislike =
            scope.querySelector(
                "#segmented-dislike-button button, dislike-button-view-model button, #dislike-button button"
            );


        return {
            like,
            dislike
        };
    }


    function isPressedButton(
        button
    ) {
        return button?.getAttribute(
            "aria-pressed"
        ) ===
            "true" ||
            button?.getAttribute(
                "aria-checked"
            ) ===
                "true";
    }


    function runYouTubeAutoLike() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_ENABLED_KEY
            ] !==
                true
        ) {
            return;
        }


        const shorts =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (
            shorts &&
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_SHORTS_KEY
            ] !==
                true
        ) {
            return;
        }


        const videoId =
            getYouTubeVideoId();


        if (
            !videoId ||
            youtubeAutoLikedVideoIds.has(
                videoId
            )
        ) {
            return;
        }


        const player =
            getYouTubePlayer();


        const adActive =
            player?.classList?.contains(
                "ad-showing"
            ) ===
            true;


        if (
            adActive
        ) {
            youtubeLastAdSeenAt =
                Date.now();


            return;
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY
            ] ===
                true &&
            Date.now() -
                youtubeLastAdSeenAt <
                1500
        ) {
            return;
        }


        const video =
            getActiveYouTubeVideo();


        if (
            !video ||
            !Number.isFinite(
                video.currentTime
            )
        ) {
            return;
        }


        const trigger =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_AUTO_LIKE_TRIGGER_KEY
                ] ||
                "percent"
            );


        let reached =
            false;


        if (
            trigger ===
                "seconds"
        ) {
            const seconds =
                Math.max(
                    1,
                    Number(
                        youtubeUtilitySettings[
                            YOUTUBE_AUTO_LIKE_SECONDS_KEY
                        ]
                    ) ||
                    30
                );


            reached =
                video.currentTime >=
                seconds;

        } else {

            const duration =
                Number(
                    video.duration
                );


            if (
                !Number.isFinite(
                    duration
                ) ||
                duration <= 0
            ) {
                return;
            }


            const percent =
                Math.max(
                    1,
                    Math.min(
                        100,
                        Number(
                            youtubeUtilitySettings[
                                YOUTUBE_AUTO_LIKE_PERCENT_KEY
                            ]
                        ) ||
                        69
                    )
                );


            reached =
                video.currentTime /
                duration *
                100 >=
                percent;
        }


        if (
            !reached
        ) {
            return;
        }


        /*
         * Subscribed-only is intentionally checked at the trigger boundary,
         * not once per second for the entire video.
         */
        if (
            youtubeUtilitySettings[
                YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY
            ] ===
                true &&
            !isYouTubeSubscribed()
        ) {
            return;
        }


        const {
            like,
            dislike
        } = getYouTubeLikeButtons();


        if (
            !like
        ) {
            return;
        }


        if (
            isPressedButton(
                like
            )
        ) {
            youtubeAutoLikedVideoIds.add(
                videoId
            );
            return;
        }


        if (
            isPressedButton(
                dislike
            )
        ) {
            youtubeAutoLikedVideoIds.add(
                videoId
            );
            return;
        }


        try {
            like.click();


            youtubeAutoLikedVideoIds.add(
                videoId
            );
        } catch {
        }
    }


