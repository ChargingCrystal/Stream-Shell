    /*
     * ============================================================
     * START
     * ============================================================
     */

    async function start() {
        await waitForDocumentElement();


        const managed =
            await waitUntilManaged();


        if (
            !managed
        ) {
            return;
        }


        /*
         * 0.9.29: the in-page floating navbar is retired. Navigation now
         * lives in the native left titlebar toolbar. Keep only the managed
         * marker here because the provider themes are intentionally scoped
         * to Stream Shell windows.
         */
        await initializeManagedLayoutProfile();


        startManagedMarkerGuard();


        await initializeProviderSafeMode();


        await initializeContinueWatchingCompletePercent();


        startProviderApi();


        startProviderResourceGovernor();


        startWindowedPlayer();


        startPlaybackUtilities();


        startNetflixEnhancements();


        startCrunchyrollEnhancements();


        startPrimeEnhancements();


        startYouTubeUtilities();


        startNowPlayingTracking();
    }


    start();
})();