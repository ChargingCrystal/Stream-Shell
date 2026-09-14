    /*
     * ============================================================
     * CRUNCHYROLL ENHANCEMENTS
     * ============================================================
     * Settings/lifecycle layer only. Crunchyroll-specific route, player,
     * skip-event, presentation and marker behavior lives in
     * provider-adapter-crunchyroll.
     */

    const CRUNCHYROLL_ENHANCEMENT_DEFAULTS = {
        streamShellCrunchyrollAutoSkipIntro: false,
        streamShellCrunchyrollAutoSkipRecap: false,
        streamShellCrunchyrollAutoSkipCredits: false,
        streamShellCrunchyrollBlurEpisodeThumbnails: false
    };

    let crunchyrollEnhancementSettings = {
        ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS
    };

    async function startCrunchyrollEnhancements() {
        if (getCurrentProvider() !== "crunchyroll") {
            return;
        }

        try {
            const stored = await chrome.storage.local.get(
                Object.keys(CRUNCHYROLL_ENHANCEMENT_DEFAULTS)
            );

            crunchyrollEnhancementSettings = {
                ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                ...stored
            };
        } catch {
        }

        const adapter = getProviderAdapter("crunchyroll");
        adapter?.extensions?.enhancements?.start?.();

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                for (const [key, change] of Object.entries(changes)) {
                    if (!Object.prototype.hasOwnProperty.call(
                        CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                        key
                    )) {
                        continue;
                    }

                    crunchyrollEnhancementSettings[key] =
                        change.newValue === undefined
                            ? CRUNCHYROLL_ENHANCEMENT_DEFAULTS[key]
                            : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    adapter?.extensions?.enhancements
                        ?.syncSettings?.();
                }
            }
        );
    }
