    /*
     * ============================================================
     * NETFLIX ENHANCEMENTS
     * ============================================================
     * Settings + scheduling lifecycle only. Netflix DOM knowledge now
     * lives in the dedicated Provider API adapter.
     */

    const NETFLIX_ENHANCEMENT_DEFAULTS = {
        streamShellNetflixAutoSkipIntro: false,
        streamShellNetflixAutoSkipRecap: false,
        streamShellNetflixAutoNextEpisode: false,
        streamShellNetflixContinueWatching: true
    };

    let netflixEnhancementSettings = {
        ...NETFLIX_ENHANCEMENT_DEFAULTS
    };

    let netflixEnhancementObserver = null;
    let netflixEnhancementObserverActive = false;
    let netflixEnhancementTimer = null;
    let netflixEnhancementScheduleTimer = null;

    function runNetflixEnhancements() {
        const automation = getProviderAdapter("netflix")
            ?.extensions
            ?.automation;

        if (typeof automation?.run !== "function") {
            return false;
        }

        try {
            return automation.run(netflixEnhancementSettings) === true;
        } catch {
            return false;
        }
    }

    function scheduleNetflixEnhancementRun() {
        if (netflixEnhancementScheduleTimer) {
            return;
        }

        netflixEnhancementScheduleTimer = setTimeout(
            () => {
                netflixEnhancementScheduleTimer = null;
                runNetflixEnhancements();
            },
            100
        );
    }


    function syncNetflixEnhancementObserver() {
        if (typeof MutationObserver !== "function") {
            return false;
        }

        const automationEnabled = Boolean(
            netflixEnhancementSettings.streamShellNetflixAutoSkipIntro ||
            netflixEnhancementSettings.streamShellNetflixAutoSkipRecap ||
            netflixEnhancementSettings.streamShellNetflixAutoNextEpisode ||
            netflixEnhancementSettings.streamShellNetflixContinueWatching
        );

        const shouldObserve =
            automationEnabled &&
            !isProviderSafeModeEnabled("netflix") &&
            shouldProviderResourceObserveDom();

        if (!netflixEnhancementObserver) {
            netflixEnhancementObserver = new MutationObserver(
                scheduleNetflixEnhancementRun
            );
        }

        if (shouldObserve && !netflixEnhancementObserverActive) {
            netflixEnhancementObserver.observe(
                document.documentElement,
                {
                    childList: true,
                    subtree: true
                }
            );
            netflixEnhancementObserverActive = true;
            return true;
        }

        if (!shouldObserve && netflixEnhancementObserverActive) {
            netflixEnhancementObserver.disconnect();
            netflixEnhancementObserverActive = false;
        }

        return netflixEnhancementObserverActive;
    }

    async function startNetflixEnhancements() {
        if (getCurrentProvider() !== "netflix") {
            return;
        }

        try {
            const stored = await chrome.storage.local.get(
                Object.keys(NETFLIX_ENHANCEMENT_DEFAULTS)
            );

            netflixEnhancementSettings = {
                ...NETFLIX_ENHANCEMENT_DEFAULTS,
                ...stored
            };
        } catch {
        }

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                for (const [key, change] of Object.entries(changes)) {
                    if (!Object.prototype.hasOwnProperty.call(
                        NETFLIX_ENHANCEMENT_DEFAULTS,
                        key
                    )) {
                        continue;
                    }

                    netflixEnhancementSettings[key] = change.newValue === undefined
                        ? NETFLIX_ENHANCEMENT_DEFAULTS[key]
                        : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    syncNetflixEnhancementObserver();
                    scheduleNetflixEnhancementRun();
                    providerApiNotifyExtensionChange("netflixAutomationSettings");
                }
            }
        );

        syncNetflixEnhancementObserver();

        netflixEnhancementTimer = createProviderResourceLoop(
            "netflix-enhancements",
            runNetflixEnhancements,
            750,
            "dom"
        );

        onProviderResourceGovernorChange(() => {
            syncNetflixEnhancementObserver();
            scheduleNetflixEnhancementRun();
        });

        runNetflixEnhancements();
    }
