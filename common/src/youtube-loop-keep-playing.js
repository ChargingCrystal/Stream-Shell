    function syncYouTubeLoopSetting() {
        const video =
            getPrimaryVideo();


        if (
            !video ||
            !getYouTubeVideoId()
        ) {
            return;
        }


        const isShort =
            location.pathname.startsWith(
                "/shorts/"
            );


        if (isProviderSafeModeEnabled("youtube")) {
            if (video.loop !== isShort) {
                video.loop = isShort;
            }
            return;
        }


        const overrideEnabled =
            youtubeUtilitySettings[
                YOUTUBE_LOOP_KEY
            ] === true;


        /*
         * With the override disabled, restore YouTube's normal split:
         * regular videos do not loop, Shorts do. The old master switch
         * forced video.loop=false globally and accidentally disabled the
         * native Shorts loop as well.
         */
        const enabled =
            overrideEnabled
                ? (
                    isShort
                        ? youtubeUtilitySettings[
                            YOUTUBE_LOOP_SHORTS_KEY
                        ] === true
                        : youtubeUtilitySettings[
                            YOUTUBE_LOOP_VIDEOS_KEY
                        ] === true
                )
                : isShort;


        if (
            video.loop !==
                enabled
        ) {
            video.loop =
                enabled;
        }
    }


    function dismissYouTubeContinueWatching() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_KEEP_PLAYING_KEY
            ] !== true
        ) {
            return;
        }


        const dialogs =
            document.querySelectorAll(
                "ytd-popup-container yt-confirm-dialog-renderer, ytd-popup-container tp-yt-paper-dialog, ytd-popup-container [role='dialog']"
            );


        for (
            const dialog
            of dialogs
        ) {
            const text =
                String(
                    dialog.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .toLocaleLowerCase();


            if (
                ![
                    "video paused",
                    "continue watching",
                    "video pausiert",
                    "wiedergabe pausiert",
                    "weiterschauen",
                    "weiter ansehen"
                ].some(
                    token =>
                        text.includes(
                            token
                        )
                )
            ) {
                continue;
            }


            const confirm =
                dialog.querySelector(
                    "#confirm-button button, button#confirm-button, #confirm-button, yt-button-shape#confirm-button button"
                );


            try {
                confirm?.click();


                getPrimaryVideo()
                    ?.play?.()
                    ?.catch?.(
                        () => {}
                    );


                return;

            } catch {
            }
        }
    }


    let youtubeTranslatedAudioSurveyLastScanAt =
        0;


    function isYouTubeTranslatedAudioSurveyText(value) {
        const text =
            String(
                value ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim()
                .toLocaleLowerCase();


        return (
            text.includes(
                "how satisfied are you with the translated audio"
            ) ||
            text.includes(
                "translated audio in this video"
            )
        );
    }


    function hideYouTubeTranslatedAudioSurveyElement(element) {
        if (
            !(element instanceof Element)
        ) {
            return false;
        }


        element.setAttribute(
            "data-stream-shell-translated-audio-survey-hidden",
            "true"
        );


        return true;
    }


    function dismissYouTubeTranslatedAudioSurvey() {
        if (isProviderSafeModeEnabled("youtube")) {
            document
                .querySelectorAll(
                    "[data-stream-shell-translated-audio-survey-hidden]"
                )
                .forEach(
                    element => {
                        element.removeAttribute(
                            "data-stream-shell-translated-audio-survey-hidden"
                        );
                    }
                );


            youtubeTranslatedAudioSurveyLastScanAt =
                0;


            return false;
        }


        /*
         * This runs from YouTube's shared DOM observer. The 0.15.7 fallback
         * read textContent from the whole player/popup tree and, once a
         * wording match existed, walked every descendant. On a busy watch
         * page that turned a tiny survey cleanup into repeated full-DOM work.
         *
         * The survey is rare and does not need sub-200 ms reaction time, so
         * keep the scan narrow, bounded and throttled. If YouTube changes the
         * wrapper again we intentionally fail closed instead of searching the
         * entire page.
         */
        const now =
            Date.now();


        if (
            now - youtubeTranslatedAudioSurveyLastScanAt <
                1200
        ) {
            return false;
        }


        youtubeTranslatedAudioSurveyLastScanAt =
            now;


        const selector = [
            "yt-survey-renderer",
            "ytd-survey-renderer",
            "ytd-player-survey-renderer",
            "[role='dialog']",
            "tp-yt-paper-dialog"
        ].join(",");


        const roots = [
            document.getElementById(
                "movie_player"
            ),
            document.querySelector(
                "ytd-popup-container"
            )
        ].filter(Boolean);


        for (
            const root
            of roots
        ) {
            const candidates = [
                ...(
                    root.matches?.(selector)
                        ? [root]
                        : []
                ),
                ...root.querySelectorAll(
                    selector
                )
            ];


            for (
                const candidate
                of candidates
            ) {
                if (
                    !isYouTubeTranslatedAudioSurveyText(
                        candidate.textContent
                    )
                ) {
                    continue;
                }


                return hideYouTubeTranslatedAudioSurveyElement(
                    candidate
                );
            }
        }


        return false;
    }

