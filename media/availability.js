(() => {
    "use strict";


    /*
     * ============================================================
     * CONFIG
     * ============================================================
     */

    const CACHE_TTL =
        24 * 60 * 60 * 1000;


    const SELECTED_MEDIA_KEY =
        "streamShellSelectedMedia";


    const SELECTED_AVAILABILITY_KEY =
        "streamShellSelectedAvailability";


    const DASHBOARD_PROVIDERS = [
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll"
    ];


    const availabilityCache =
        new Map();


    /*
     * ============================================================
     * DASHBOARD STATUS
     * ============================================================
     */

    function createEmptyDashboardStatus() {
        return {
            state:
                "unavailable",

            providerNames:
                []
        };
    }


    function createDashboardStatuses() {
        return Object.fromEntries(
            DASHBOARD_PROVIDERS.map(
                provider => [
                    provider,
                    createEmptyDashboardStatus()
                ]
            )
        );
    }


    /*
     * ============================================================
     * PROVIDER NAME NORMALIZATION
     * ============================================================
     */

    function normalizeName(
        value
    ) {
        return String(
            value || ""
        )
            .trim()
            .toLowerCase();
    }


    /*
     * Maps TMDB / JustWatch provider names to the five providers
     * represented directly on the Stream Shell dashboard.
     */

    function getDashboardProviderMatch(
        providerName
    ) {
        const name =
            normalizeName(
                providerName
            );


        /*
         * Netflix
         */

        if (
            name.includes(
                "netflix"
            )
        ) {
            return {
                provider:
                    "netflix",

                direct:
                    true
            };
        }


        /*
         * Disney+
         */

        if (
            name.includes(
                "disney plus"
            ) ||
            name.includes(
                "disney+"
            )
        ) {
            return {
                provider:
                    "disney",

                direct:
                    true
            };
        }


        /*
         * Crunchyroll
         *
         * Crunchyroll itself = direct.
         * Crunchyroll Amazon Channel = add-on.
         */

        if (
            name.includes(
                "crunchyroll"
            )
        ) {
            return {
                provider:
                    "crunchyroll",

                direct:
                    !name.includes(
                        "amazon channel"
                    ) &&
                    !name.includes(
                        "prime video channel"
                    )
            };
        }


        /*
         * YouTube
         */

        if (
            name ===
                "youtube" ||
            name.includes(
                "youtube premium"
            )
        ) {
            return {
                provider:
                    "youtube",

                direct:
                    true
            };
        }


        /*
         * Prime Video subscription
         */

        if (
            name ===
                "amazon prime video" ||
            name ===
                "amazon prime video with ads" ||
            name ===
                "prime video"
        ) {
            return {
                provider:
                    "prime",

                direct:
                    true
            };
        }


        /*
         * Amazon Video / Prime Channels
         *
         * These are purchase, rental or add-on services and
         * therefore count as "extra" on the dashboard.
         */

        if (
            name ===
                "amazon video" ||
            name.includes(
                "amazon channel"
            ) ||
            name.includes(
                "prime video channel"
            )
        ) {
            return {
                provider:
                    "prime",

                direct:
                    false
            };
        }


        return null;
    }


    /*
     * ============================================================
     * MODE LABELS
     * ============================================================
     */

    function getModeLabel(
        mode
    ) {
        switch (
            mode
        ) {
            case "flatrate":
                return "Subscription";


            case "free":
                return "Free";


            case "ads":
                return "With Ads";


            case "buy":
                return "Buy";


            case "rent":
                return "Rent";


            default:
                return String(
                    mode || ""
                );
        }
    }


    /*
     * ============================================================
     * NORMALIZE TMDB WATCH PROVIDERS
     * ============================================================
     */

    function normalizeAvailability(
        regionalData
    ) {
        const dashboard =
            createDashboardStatuses();


        const providerMap =
            new Map();


        /*
         * TMDB has no German result at all.
         */

        if (
            !regionalData
        ) {
            return {
                regionAvailable:
                    false,

                link:
                    "",

                providers:
                    [],

                dashboard
            };
        }


        const modeOrder = [
            "flatrate",
            "free",
            "ads",
            "buy",
            "rent"
        ];


        /*
         * --------------------------------------------------------
         * COLLECT PROVIDERS
         * --------------------------------------------------------
         */

        for (
            const mode
            of modeOrder
        ) {
            const entries =
                Array.isArray(
                    regionalData[
                        mode
                    ]
                )
                    ? regionalData[
                        mode
                    ]
                    : [];


            for (
                const entry
                of entries
            ) {
                const providerName =
                    String(
                        entry?.provider_name ||
                        ""
                    ).trim();


                if (
                    !providerName
                ) {
                    continue;
                }


                const providerId =
                    Number(
                        entry?.provider_id
                    ) ||
                    0;


                const mapKey =
                    providerId
                        ? `id:${providerId}`
                        : `name:${normalizeName(
                            providerName
                        )}`;


                /*
                 * First appearance of provider.
                 */

                if (
                    !providerMap.has(
                        mapKey
                    )
                ) {
                    providerMap.set(
                        mapKey,
                        {
                            id:
                                providerId,

                            name:
                                providerName,

                            modes:
                                [],

                            modeLabels:
                                [],

                            displayPriority:
                                Number(
                                    entry
                                        ?.display_priority
                                ) ||
                                9999
                        }
                    );
                }


                const provider =
                    providerMap.get(
                        mapKey
                    );


                /*
                 * A provider may appear in more than one mode,
                 * e.g. buy + rent.
                 */

                if (
                    !provider
                        .modes
                        .includes(
                            mode
                        )
                ) {
                    provider
                        .modes
                        .push(
                            mode
                        );


                    provider
                        .modeLabels
                        .push(
                            getModeLabel(
                                mode
                            )
                        );
                }


                /*
                 * ------------------------------------------------
                 * DASHBOARD MAPPING
                 * ------------------------------------------------
                 */

                const match =
                    getDashboardProviderMatch(
                        providerName
                    );


                if (
                    !match
                ) {
                    continue;
                }


                const status =
                    dashboard[
                        match.provider
                    ];


                if (
                    !status
                        .providerNames
                        .includes(
                            providerName
                        )
                ) {
                    status
                        .providerNames
                        .push(
                            providerName
                        );
                }


                const includedMode =
                    mode ===
                        "flatrate" ||
                    mode ===
                        "free" ||
                    mode ===
                        "ads";


                /*
                 * Direct provider + included mode:
                 *
                 * green check on Dashboard.
                 */

                if (
                    match.direct &&
                    includedMode
                ) {
                    status.state =
                        "available";


                    continue;
                }


                /*
                 * Never downgrade an already available provider.
                 */

                if (
                    status.state ===
                    "available"
                ) {
                    continue;
                }


                /*
                 * Purchase / rental / channel add-on.
                 *
                 * We intentionally only show this special
                 * dashboard state for Prime and YouTube.
                 */

                if (
                    match.provider ===
                        "prime" ||
                    match.provider ===
                        "youtube"
                ) {
                    status.state =
                        "extra";
                }
            }
        }


        /*
         * --------------------------------------------------------
         * SORT PROVIDER CHIPS
         * --------------------------------------------------------
         *
         * Subscription/free first.
         * Purchase/rental afterwards.
         */

        const providers =
            Array.from(
                providerMap.values()
            )
                .sort(
                    (
                        left,
                        right
                    ) => {
                        const leftIncluded =
                            left.modes.some(
                                mode =>
                                    mode ===
                                        "flatrate" ||
                                    mode ===
                                        "free" ||
                                    mode ===
                                        "ads"
                            );


                        const rightIncluded =
                            right.modes.some(
                                mode =>
                                    mode ===
                                        "flatrate" ||
                                    mode ===
                                        "free" ||
                                    mode ===
                                        "ads"
                            );


                        if (
                            leftIncluded !==
                            rightIncluded
                        ) {
                            return leftIncluded
                                ? -1
                                : 1;
                        }


                        if (
                            left.displayPriority !==
                            right.displayPriority
                        ) {
                            return (
                                left.displayPriority -
                                right.displayPriority
                            );
                        }


                        return left.name.localeCompare(
                            right.name,
                            "en"
                        );
                    }
                );


        return {
            regionAvailable:
                true,

            link:
                String(
                    regionalData.link ||
                    ""
                ),

            providers,

            dashboard
        };
    }


    /*
     * ============================================================
     * CACHE
     * ============================================================
     */

    function getCacheKey(
        media
    ) {
        return `${media.mediaType}:${media.id}`;
    }


    function clearAvailabilityCache(
        media = null
    ) {
        if (
            !media
        ) {
            availabilityCache.clear();

            return;
        }


        availabilityCache.delete(
            getCacheKey(
                media
            )
        );
    }


    /*
     * ============================================================
     * FETCH
     * ============================================================
     */

    async function fetchAvailability(
        media
    ) {
        /*
         * Fail loudly and clearly if media-api.js did not load.
         */

        if (
            !window
                .StreamShellMediaApi ||
            typeof window
                .StreamShellMediaApi
                .getWatchProviders !==
                "function"
        ) {
            throw new Error(
                "StreamShellMediaApi.getWatchProviders is unavailable."
            );
        }


        const regionalData =
            await window
                .StreamShellMediaApi
                .getWatchProviders(
                    media
                );


        const availability =
            normalizeAvailability(
                regionalData
            );


        availabilityCache.set(
            getCacheKey(
                media
            ),
            {
                createdAt:
                    Date.now(),

                value:
                    availability
            }
        );


        return availability;
    }


    /*
     * ============================================================
     * NORMAL GET
     * ============================================================
     */

    async function getAvailability(
        media
    ) {
        const key =
            getCacheKey(
                media
            );


        const cached =
            availabilityCache.get(
                key
            );


        if (
            cached &&
            Date.now() -
                cached.createdAt <
                CACHE_TTL
        ) {
            return cached.value;
        }


        return fetchAvailability(
            media
        );
    }


    /*
     * ============================================================
     * MANUAL REFRESH
     * ============================================================
     *
     * Explicitly ignores the local 24-hour cache.
     */

    async function refreshAvailability(
        media
    ) {
        clearAvailabilityCache(
            media
        );


        return fetchAvailability(
            media
        );
    }


    /*
     * ============================================================
     * SELECTED MEDIA
     * ============================================================
     */

    async function selectMedia(
        media,
        availability
    ) {
        await chrome.storage.local.set({
            [SELECTED_MEDIA_KEY]:
                media,

            [SELECTED_AVAILABILITY_KEY]:
                availability ||
                null
        });
    }


    async function clearSelectedMedia() {
        await chrome.storage.local.remove([
            SELECTED_MEDIA_KEY,
            SELECTED_AVAILABILITY_KEY
        ]);
    }


    /*
     * ============================================================
     * PROVIDER SEARCH URLS
     * ============================================================
     */

    function buildProviderSearchUrl(
        provider,
        media
    ) {
        const rawTitle =
            String(
                media?.title ||
                ""
            ).trim();


        if (
            !rawTitle
        ) {
            return null;
        }


        const title =
            encodeURIComponent(
                rawTitle
            );


        switch (
            provider
        ) {
            case "youtube":

                return (
                    "https://www.youtube.com/" +
                    `results?search_query=${title}`
                );


            case "netflix":

                return (
                    "https://www.netflix.com/" +
                    `search?q=${title}`
                );


            case "prime":

                return (
                    "https://www.primevideo.com/" +
                    "search/ref=atv_nb_sr?" +
                    `phrase=${title}`
                );


            case "disney":

                return (
                    "https://www.disneyplus.com/" +
                    "search"
                );


            case "crunchyroll":

                return (
                    "https://www.crunchyroll.com/" +
                    `search?q=${title}`
                );


            default:

                return null;
        }
    }


    /*
     * ============================================================
     * NAVIGATE AN ALREADY OPEN PROVIDER WINDOW
     * ============================================================
     */

    async function navigateProviderToMedia(
        provider,
        media
    ) {
        const url =
            buildProviderSearchUrl(
                provider,
                media
            );


        if (
            !url
        ) {
            return false;
        }


        const stored =
            await chrome.storage.local.get(
                "providerWindows"
            );


        const windowId =
            stored
                .providerWindows?.[
                    provider
                ];


        if (
            !Number.isInteger(
                windowId
            )
        ) {
            return false;
        }


        const tabs =
            await chrome.tabs.query({
                windowId
            });


        const tab =
            tabs.find(
                item =>
                    Number.isInteger(
                        item.id
                    )
            );


        if (
            !tab?.id
        ) {
            return false;
        }


        await chrome.tabs.update(
            tab.id,
            {
                url
            }
        );


        return true;
    }


    /*
     * ============================================================
     * PUBLIC API
     * ============================================================
     *
     * IMPORTANT:
     *
     * landing.js expects this exact global object.
     */

    window.StreamShellAvailability = {
        CACHE_TTL,

        SELECTED_MEDIA_KEY,

        SELECTED_AVAILABILITY_KEY,

        DASHBOARD_PROVIDERS,

        normalizeAvailability,

        getAvailability,

        refreshAvailability,

        clearAvailabilityCache,

        selectMedia,

        clearSelectedMedia,

        buildProviderSearchUrl,

        navigateProviderToMedia
    };


    /*
     * Useful confirmation in DevTools.
     */

    console.debug(
        "[Stream Shell] Availability module loaded."
    );
})();