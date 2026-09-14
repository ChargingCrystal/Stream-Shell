    let youtubeQualityGeneration =
        0;


    function applyYouTubePreferredQuality(
        force = false
    ) {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_QUALITY_ENABLED_KEY
            ] ===
                false
        ) {
            return;
        }


        const videoId =
            getYouTubeVideoId();


        if (
            !force &&
            videoId &&
            videoId ===
                youtubeLastQualityVideoId
        ) {
            return;
        }


        const preferred =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_QUALITY_KEY
                ] ||
                "hd1080"
            );


        chrome.runtime.sendMessage({
            type:
                "youtube-set-quality",

            preferred
        })
            .then(
                response => {
                    if (
                        response?.ok &&
                        videoId ===
                            getYouTubeVideoId()
                    ) {
                        youtubeLastQualityVideoId =
                            videoId;
                    }
                }
            )
            .catch(
                () => {}
            );
    }


    function scheduleYouTubePreferredQuality() {
        youtubeLastQualityVideoId =
            "";


        const generation =
            ++youtubeQualityGeneration;

        const videoId =
            getYouTubeVideoId();


        for (
            const timeout
            of [250, 700, 1500, 3000]
        ) {
            setTimeout(
                () => {
                    if (
                        generation !==
                            youtubeQualityGeneration ||
                        videoId !==
                            getYouTubeVideoId() ||
                        !shouldProviderResourceObserveDom()
                    ) {
                        return;
                    }


                    applyYouTubePreferredQuality(
                        timeout >= 1500
                    );
                },
                timeout
            );
        }
    }


