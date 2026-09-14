    /*
     * ============================================================
     * WINDOWED PLAYER
     * ============================================================
     *
     * Stream Shell keeps this deliberately small: state lives in
     * chrome.storage, provider-specific CSS owns the layout, and this
     * controller only toggles the root marker / native provider mode.
     */

    const WINDOWED_PLAYER_KEY_PREFIX =
        "streamShellWindowedPlayer_";


    const YOUTUBE_EXTRAS_STORAGE_KEY =
        "streamShellYoutubeExtrasEnabled";


    const WINDOWED_PLAYER_PROVIDERS =
        new Set([
            "youtube",
            "crunchyroll"
        ]);


    let youtubeTheaterForcedByStreamShell =
        false;


    let youtubeTopUiHideTimer =
        null;


    let youtubeExtrasEnabled =
        true;


    let youtubeTopUiPointerBound =
        false;

    let youtubeTopUiPointerZone =
        "outside";


    let crunchyrollWindowedNavigationTimer =
        null;


    function getWindowedPlayerStorageKey(
        provider
    ) {
        return `${WINDOWED_PLAYER_KEY_PREFIX}${provider}`;
    }


    function isWindowedPlayerWatchContext(
        provider
    ) {
        const path =
            String(
                window.location.pathname ||
                ""
            );


        if (
            provider ===
                "youtube"
        ) {
            return path ===
                "/watch";
        }


        if (
            provider ===
                "crunchyroll"
        ) {
            return /^\/watch\//i.test(
                path
            );
        }


        return false;
    }


    function setWindowedPlayerRootMarker(
        provider,
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
                "data-stream-shell-windowed-player",
                provider
            );

        } else {

            root.removeAttribute(
                "data-stream-shell-windowed-player"
            );
        }
    }


