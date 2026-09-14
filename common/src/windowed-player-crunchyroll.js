    function startCrunchyrollWindowedNavigationWatch(
        sync
    ) {
        if (
            crunchyrollWindowedNavigationTimer
        ) {
            return;
        }


        let lastPath =
            String(
                window.location.pathname ||
                ""
            );


        /*
         * Crunchyroll changes episodes / watch routes with SPA pushState.
         * pushState does not emit popstate, so a persisted ON state could
         * remain dormant after navigating from the provider home page to
         * /watch/... until the Dashboard toggle was touched again.
         *
         * A tiny pathname watcher is deliberately less invasive than
         * monkey-patching History or observing Crunchyroll's entire DOM.
         */
        crunchyrollWindowedNavigationTimer =
            createProviderResourceLoop(
                "crunchyroll-windowed-navigation",
                () => {
                    const nextPath =
                        String(
                            window.location.pathname ||
                            ""
                        );


                    if (
                        nextPath ===
                            lastPath
                    ) {
                        return;
                    }


                    lastPath =
                        nextPath;


                    sync();
                },
                400,
                "navigation"
            );
    }


