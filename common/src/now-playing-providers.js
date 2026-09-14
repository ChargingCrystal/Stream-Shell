    function isWatchContext(
        provider
    ) {
        const path =
            window.location.pathname;


        if (
            provider ===
            "youtube"
        ) {
            return (
                path ===
                "/watch"
            );
        }


        if (
            provider ===
            "netflix"
        ) {
            return path.startsWith(
                "/watch/"
            );
        }


        if (
            provider ===
            "crunchyroll"
        ) {
            return path.startsWith(
                "/watch/"
            );
        }


        if (
            provider ===
            "disney"
        ) {
            return (
                (
                    path.includes(
                        "/video/"
                    ) ||
                    path.includes(
                        "/play/"
                    )
                ) &&
                Boolean(
                    getPrimaryVideo()
                )
            );
        }


        if (
            provider ===
            "prime"
        ) {
            return (
                (
                    path.includes(
                        "/detail/"
                    ) ||
                    path.includes(
                        "/gp/video/detail/"
                    )
                ) &&
                Boolean(
                    getPrimaryVideo()
                )
            );
        }


        return false;
    }


    function getPrimeProviderTitle() {
        const direct =
            getTextFromSelectors([
                '.atvwebplayersdk-title-text',
                'h1[data-automation-id="title"]',
                '.atvwebplayersdk-player-container h1',
                '#dv-web-player h1'
            ]);


        const imageAlt =
            getAttributeFromSelectors([
                '.DVWebNode-detail-atf-wrapper picture img',
                'main div[data-automation-id="hero-background"] img'
            ], "alt");


        for (
            const candidate
            of [
                direct,
                imageAlt
            ]
        ) {
            const cleaned =
                cleanProviderTitle(
                    candidate,
                    "prime"
                );


            if (
                cleaned &&
                !isGenericProviderTitle(
                    cleaned,
                    "prime"
                )
            ) {
                return cleaned;
            }
        }


        return "";
    }


    function getCrunchyrollProviderTitle() {
        const direct =
            getTextFromSelectors([
                '.show-title-link',
                '[data-t="show-title-link"]',
                'a[href*="/series/"] > h4',
                'a[href*="/series/"] h4'
            ]);


        if (
            direct
        ) {
            return cleanProviderTitle(
                direct,
                "crunchyroll"
            );
        }


        const seriesLinks =
            document.querySelectorAll(
                'a[href*="/series/"]'
            );


        for (
            const link
            of seriesLinks
        ) {
            const text =
                String(
                    link.querySelector(
                        "h4"
                    )?.textContent ||
                    link.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();


            if (
                text.length >= 2 &&
                text.length <= 160
            ) {
                return cleanProviderTitle(
                    text,
                    "crunchyroll"
                );
            }
        }


        const scripts =
            document.head?.querySelectorAll(
                'script[type="application/ld+json"]'
            ) || [];


        for (
            const script
            of scripts
        ) {
            try {
                const data =
                    JSON.parse(
                        script.textContent ||
                        "null"
                    );


                const items =
                    Array.isArray(
                        data
                    )
                        ? data
                        : [data];


                for (
                    const item
                    of items
                ) {
                    const seriesName =
                        item?.partOfSeries?.name ||
                        item?.partOfSeries?.headline ||
                        item?.partOfSeries?.alternateName ||
                        "";


                    if (
                        String(
                            seriesName
                        ).trim()
                    ) {
                        return cleanProviderTitle(
                            seriesName,
                            "crunchyroll"
                        );
                    }
                }
            } catch {
            }
        }


        const metadataTitle =
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            getMetaContent(
                'meta[name="twitter:title"]'
            ) ||
            getMetaContent(
                'meta[name="title"]'
            );


        if (
            metadataTitle
        ) {
            return cleanProviderTitle(
                metadataTitle,
                "crunchyroll"
            );
        }


        return cleanProviderTitle(
            document.title,
            "crunchyroll"
        );
    }


    function getYouTubeProviderTitle() {
        const currentVideoId =
            typeof getYouTubeVideoId ===
                "function"
                ? getYouTubeVideoId()
                : "";


        const isWatchPage =
            window.location.pathname ===
                "/watch";


        if (
            isWatchPage &&
            currentVideoId
        ) {
            /*
             * Playlist/autoplay transitions can update /watch?v= before
             * the visible watch metadata has switched to the new video.
             * Never cache a title until the DOM explicitly belongs to the
             * current video ID. The player-title link is checked first
             * because it usually flips with the player itself; ytd-watch-
             * flexy's video-id is the authoritative DOM readiness guard.
             */
            const playerTitleLink =
                document.querySelector(
                    "#movie_player .ytp-title-link"
                );


            if (
                playerTitleLink
            ) {
                const playerTitle =
                    String(
                        playerTitleLink.textContent ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                const playerHref =
                    String(
                        playerTitleLink.getAttribute(
                            "href"
                        ) ||
                        ""
                    ).trim();


                try {
                    const playerUrl =
                        new URL(
                            playerHref,
                            window.location.href
                        );


                    const playerVideoId =
                        String(
                            playerUrl.searchParams.get(
                                "v"
                            ) ||
                            ""
                        ).trim();


                    if (
                        playerTitle &&
                        playerVideoId ===
                            currentVideoId
                    ) {
                        return playerTitle;
                    }


                    if (
                        playerVideoId &&
                        playerVideoId !==
                            currentVideoId
                    ) {
                        return "";
                    }

                } catch {
                }
            }


            const escapedVideoId =
                typeof CSS?.escape ===
                    "function"
                    ? CSS.escape(
                        currentVideoId
                    )
                    : currentVideoId;


            const watchContainer =
                document.querySelector(
                    `ytd-watch-flexy[video-id="${escapedVideoId}"]`
                );


            if (
                !watchContainer
            ) {
                return "";
            }


            const selectors = [
                "h1.ytd-watch-metadata yt-formatted-string",
                "h1 yt-formatted-string.ytd-watch-metadata",
                "#title h1 yt-formatted-string"
            ];


            for (
                const selector
                of selectors
            ) {
                const elements =
                    watchContainer.querySelectorAll(
                        selector
                    );


                for (
                    const element
                    of elements
                ) {
                    const text =
                        String(
                            element.textContent ||
                            ""
                        )
                            .replace(
                                /\s+/g,
                                " "
                            )
                            .trim();


                    if (
                        text.length >= 2 &&
                        text.length <= 220
                    ) {
                        return text;
                    }
                }
            }


            return "";
        }


        return (
            getTextFromSelectors([
                "h1.ytd-watch-metadata yt-formatted-string",
                "h1 yt-formatted-string.ytd-watch-metadata",
                "#title h1 yt-formatted-string"
            ]) ||
            getMetaContent(
                'meta[name="title"]'
            ) ||
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            document.title
        );
    }

    async function getProviderTitle(
        provider
    ) {
        let title =
            "";


        if (
            provider ===
            "youtube"
        ) {
            title =
                getYouTubeProviderTitle();
        }


        if (
            provider ===
            "netflix"
        ) {
            title =
                await getNetflixProviderTitle();
        }


        if (
            provider ===
            "prime"
        ) {
            title =
                getPrimeProviderTitle();
        }


        if (
            provider ===
            "disney"
        ) {
            title =
                getTextFromSelectors([
                    '[data-testid="title"]',
                    '[class*="player"] h1',
                    '[class*="Player"] h1'
                ]) ||
                getMetaContent(
                    'meta[property="og:title"]'
                ) ||
                document.title;
        }


        if (
            provider ===
            "crunchyroll"
        ) {
            title =
                getCrunchyrollProviderTitle();
        }


        title =
            cleanProviderTitle(
                title,
                provider
            );


        if (
            provider ===
                "netflix"
        ) {
            title =
                compactNetflixNowPlayingTitle(
                    title
                );
        }


        return title;
    }




    function parseYouTubeVoteCount(value) {
        const raw = String(value || "")
            .replace(/[\u00a0\u202f]/g, " ")
            .trim();

        if (!raw) {
            return null;
        }

        const match = raw.match(/([0-9][0-9.,]*)\s*([KMBT])?/i);
        if (!match) {
            return null;
        }

        const suffix = String(match[2] || "").toUpperCase();
        let numeric = match[1];
        let parsed = NaN;

        if (suffix) {
            const lastComma = numeric.lastIndexOf(",");
            const lastDot = numeric.lastIndexOf(".");
            const decimalIndex = Math.max(lastComma, lastDot);

            if (decimalIndex >= 0) {
                numeric = numeric
                    .slice(0, decimalIndex)
                    .replace(/[.,]/g, "") +
                    "." +
                    numeric.slice(decimalIndex + 1).replace(/[.,]/g, "");
            }

            parsed = Number(numeric);
            const multiplier = {
                K: 1e3,
                M: 1e6,
                B: 1e9,
                T: 1e12
            }[suffix] || 1;

            parsed *= multiplier;
        } else {
            parsed = Number(numeric.replace(/[.,]/g, ""));
        }

        return Number.isFinite(parsed) && parsed >= 0
            ? parsed
            : null;
    }

    function getYouTubeRydLikeRatio() {
        // Return YouTube Dislike already exposes its resolved vote counts in
        // #ryd-dislike-tooltip as "likes / dislikes". Read that finished
        // result directly instead of trying to rediscover YouTube's current
        // like/dislike button implementation.
        const tooltip =
            document.querySelector(
                "#ryd-dislike-tooltip"
            );

        const tooltipText =
            String(
                tooltip?.textContent ||
                ""
            ).trim();

        if (tooltipText) {
            const parts =
                tooltipText.split(
                    "/"
                );

            if (parts.length >= 2) {
                const likes =
                    parseYouTubeVoteCount(
                        parts[0]
                    );

                const dislikes =
                    parseYouTubeVoteCount(
                        parts[1]
                    );

                if (
                    Number.isFinite(likes) &&
                    Number.isFinite(dislikes) &&
                    likes >= 0 &&
                    dislikes >= 0 &&
                    likes + dislikes > 0
                ) {
                    return Math.round(
                        (likes / (likes + dislikes)) * 1000
                    ) / 10;
                }
            }
        }

        // RYD also publishes the final like percentage as the width of its
        // own ratio bar. This is a safe secondary source when the tooltip is
        // temporarily absent during YouTube SPA navigation.
        const bar =
            document.querySelector(
                "#ryd-bar"
            );

        const width =
            Number.parseFloat(
                String(
                    bar?.style?.width ||
                    ""
                )
            );

        if (
            Number.isFinite(width) &&
            width >= 0 &&
            width <= 100
        ) {
            return Math.round(width * 10) / 10;
        }

        return null;
    }



    async function getProviderArtwork(
        provider
    ) {
        if (
            provider ===
            "youtube"
        ) {
            const url =
                new URL(
                    window.location.href
                );


            const videoId =
                url.searchParams.get(
                    "v"
                );


            if (
                videoId
            ) {
                return `https://i.ytimg.com/vi/${encodeURIComponent(
                    videoId
                )}/hqdefault.jpg`;
            }
        }


        const video =
            getPrimaryVideo();


        const providerArtwork =
            provider ===
                "prime"
                ? getAttributeFromSelectors([
                    'main div[data-automation-id="hero-background"] img',
                    '.DVWebNode-detail-atf-wrapper picture img'
                ], "src")
                : "";


        const candidates = [
            providerArtwork,
            video?.poster,
            getMetaContent(
                'meta[property="og:image"]'
            ),
            getMetaContent(
                'meta[name="twitter:image"]'
            ),
            getMetaContent(
                'meta[property="twitter:image"]'
            )
        ];


        for (
            const candidate
            of candidates
        ) {
            const value =
                String(
                    candidate ||
                    ""
                ).trim();


            if (
                /^https?:\/\//i.test(
                    value
                )
            ) {
                return value;
            }
        }


        return "";
    }


