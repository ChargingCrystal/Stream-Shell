(() => {
    "use strict";

    const ATTRIBUTE =
        "data-stream-shell-netflix-wallpaper";

    const THEME_STORAGE_KEY =
        "streamShellNetflixThemeEnabled";

    const SAFE_MODE_STORAGE_KEY =
        "streamShellProviderSafeMode_netflix";

    let lastUrl =
        "";

    let themeEnabled =
        true;

    let safeModeEnabled =
        false;

    let wallpaperPollTimer =
        null;


    function isPlaybackRoute() {
        return location.pathname.startsWith(
            "/watch/"
        );
    }


    function syncWallpaperState(
        force = false
    ) {
        if (
            !document.documentElement
        ) {
            return;
        }


        const currentUrl =
            location.href;


        if (
            !force &&
            currentUrl ===
                lastUrl
        ) {
            return;
        }


        lastUrl =
            currentUrl;


        document.documentElement.toggleAttribute(
            ATTRIBUTE,
            themeEnabled &&
            !safeModeEnabled &&
            !isPlaybackRoute()
        );
    }


    async function start() {
        try {
            const stored =
                await chrome.storage.local.get([
                    THEME_STORAGE_KEY,
                    SAFE_MODE_STORAGE_KEY
                ]);


            themeEnabled =
                stored[THEME_STORAGE_KEY] !==
                false;


            safeModeEnabled =
                stored[SAFE_MODE_STORAGE_KEY] ===
                true;

        } catch {
        }


        syncWallpaperState(
            true
        );


        chrome.storage.onChanged.addListener(
            (
                changes,
                areaName
            ) => {
                if (areaName !== "local") {
                    return;
                }


                let relevant = false;


                if (Object.prototype.hasOwnProperty.call(
                    changes,
                    THEME_STORAGE_KEY
                )) {
                    themeEnabled =
                        changes[THEME_STORAGE_KEY]
                            ?.newValue !==
                        false;
                    relevant = true;
                }


                if (Object.prototype.hasOwnProperty.call(
                    changes,
                    SAFE_MODE_STORAGE_KEY
                )) {
                    safeModeEnabled =
                        changes[SAFE_MODE_STORAGE_KEY]
                            ?.newValue ===
                        true;
                    relevant = true;
                }


                if (relevant) {
                    syncWallpaperState(
                        true
                    );
                }
            }
        );


        window.addEventListener(
            "popstate",
            () => syncWallpaperState(),
            true
        );


        window.addEventListener(
            "hashchange",
            () => syncWallpaperState(),
            true
        );


        /* Netflix SPA transitions do not consistently emit popstate. */
        const scheduleWallpaperPoll = () => {
            if (wallpaperPollTimer) {
                clearTimeout(wallpaperPollTimer);
            }

            const delay = document.visibilityState === "hidden"
                ? 3000
                : 500;

            wallpaperPollTimer = setTimeout(
                () => {
                    wallpaperPollTimer = null;
                    syncWallpaperState();
                    scheduleWallpaperPoll();
                },
                delay
            );
        };

        document.addEventListener(
            "visibilitychange",
            () => {
                syncWallpaperState(true);
                scheduleWallpaperPoll();
            }
        );

        scheduleWallpaperPoll();
    }


    if (
        document.documentElement
    ) {
        start();
    } else {
        const observer =
            new MutationObserver(
                () => {
                    if (
                        !document.documentElement
                    ) {
                        return;
                    }


                    observer.disconnect();
                    start();
                }
            );


        observer.observe(
            document,
            {
                childList:
                    true
            }
        );
    }
})();
