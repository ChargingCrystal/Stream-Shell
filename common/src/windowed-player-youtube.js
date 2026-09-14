    function setYouTubeTopUiVisible(
        visible
    ) {
        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            visible
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-top-ui",
                "true"
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-youtube-top-ui"
            );
        }
    }


    function setYouTubeExtrasRootMarker(
        enabled
    ) {
        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            enabled
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-extras",
                "true"
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-youtube-extras"
            );
        }
    }


    function syncYouTubeExtrasMode(
        enabled
    ) {
        const active =
            !isProviderSafeModeEnabled("youtube") &&
            Boolean(
                enabled
            ) &&
            isWindowedPlayerWatchContext(
                "youtube"
            ) &&
            document.documentElement
                ?.getAttribute(
                    "data-stream-shell-windowed-player"
                ) ===
                "youtube";


        setYouTubeExtrasRootMarker(
            active
        );
    }


    function clearYouTubeTopUiTimer() {
        if (
            !youtubeTopUiHideTimer
        ) {
            return;
        }


        clearTimeout(
            youtubeTopUiHideTimer
        );


        youtubeTopUiHideTimer =
            null;
    }


    function scheduleYouTubeTopUiHide() {
        clearYouTubeTopUiTimer();


        youtubeTopUiHideTimer =
            setTimeout(
                () => {
                    setYouTubeTopUiVisible(
                        false
                    );


                    youtubeTopUiHideTimer =
                        null;
                },
                240
            );
    }


    function handleYouTubeWindowedPointerMove(
        event
    ) {
        const masthead =
            document.getElementById(
                "masthead-container"
            );


        const zone =
            event.clientY <=
                72 ||
            masthead?.contains(
                event.target
            )
                ? "top"
                : event.clientY >
                    112
                    ? "outside"
                    : "transition";


        if (
            zone ===
                youtubeTopUiPointerZone
        ) {
            return;
        }


        youtubeTopUiPointerZone =
            zone;


        if (
            zone ===
                "top"
        ) {
            clearYouTubeTopUiTimer();
            setYouTubeTopUiVisible(
                true
            );
            return;
        }


        if (
            zone ===
                "outside"
        ) {
            scheduleYouTubeTopUiHide();
        }
    }


    function bindYouTubeTopUiPointer(
        enabled =
            true
    ) {
        const shouldBind =
            enabled ===
                true;


        if (
            shouldBind ===
                youtubeTopUiPointerBound
        ) {
            return;
        }


        youtubeTopUiPointerBound =
            shouldBind;

        youtubeTopUiPointerZone =
            "outside";


        if (
            shouldBind
        ) {
            document.addEventListener(
                "pointermove",
                handleYouTubeWindowedPointerMove,
                {
                    passive:
                        true,

                    capture:
                        true
                }
            );


            return;
        }


        document.removeEventListener(
            "pointermove",
            handleYouTubeWindowedPointerMove,
            true
        );


        clearYouTubeTopUiTimer();

        setYouTubeTopUiVisible(
            false
        );
    }


    function getYouTubeWatchContainer() {
        return document.querySelector(
            "ytd-watch-flexy"
        );
    }


    function getYouTubeSizeButton() {
        return document.querySelector(
            ".ytp-size-button"
        );
    }


    function ensureYouTubeTheaterMode() {
        const watchContainer =
            getYouTubeWatchContainer();


        if (
            !watchContainer ||
            watchContainer.hasAttribute(
                "theater"
            )
        ) {
            return Boolean(
                watchContainer
            );
        }


        const sizeButton =
            getYouTubeSizeButton();


        if (
            !sizeButton
        ) {
            return false;
        }


        youtubeTheaterForcedByStreamShell =
            true;


        sizeButton.click();


        return true;
    }


    function scheduleYouTubeTheaterMode() {
        const delays = [
            0,
            120,
            350,
            800,
            1500
        ];


        for (
            const delayMs
            of delays
        ) {
            setTimeout(
                () => {
                    if (
                        document.documentElement
                            ?.getAttribute(
                                "data-stream-shell-windowed-player"
                            ) !==
                            "youtube" ||
                        !isWindowedPlayerWatchContext(
                            "youtube"
                        )
                    ) {
                        return;
                    }


                    ensureYouTubeTheaterMode();
                },
                delayMs
            );
        }
    }


    function restoreYouTubeTheaterModeIfNeeded() {
        if (
            !youtubeTheaterForcedByStreamShell
        ) {
            return;
        }


        const watchContainer =
            getYouTubeWatchContainer();


        const sizeButton =
            getYouTubeSizeButton();


        if (
            watchContainer?.hasAttribute(
                "theater"
            ) &&
            sizeButton
        ) {
            sizeButton.click();
        }


        youtubeTheaterForcedByStreamShell =
            false;
    }


