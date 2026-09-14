    let netflixDomBodyScanUrl = "";
    let netflixDomBodyScanAt = 0;
    let netflixDomBodyScanTitle = "";


    function compactNetflixNowPlayingTitle(
        rawTitle
    ) {
        let title =
            String(
                rawTitle ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            !title
        ) {
            return "";
        }


        /*
         * Netflix's current player frequently concatenates nested text nodes
         * without a separator. In practice that can become either
         *
         *   Rick and Morty E7: Big Trouble in Little Sanchez
         *
         * or even
         *
         *   Rick and Morty E7Big Trouble in Little Sanchez
         *
         * Do not rely on a word boundary after the episode number. Strip the
         * episode suffix as soon as a season/episode marker follows the show
         * title. Movie titles are left untouched.
         */
        title =
            title
                .replace(
                    /\s+(?:S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*)?E(?:pisode)?\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s+S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*F(?:olge)?\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s+(?:Episode|Folge|Chapter|Kapitel)\s*\d+.*$/i,
                    ""
                )
                .replace(
                    /\s*[·–—-]\s*$/,
                    ""
                )
                .trim();


        return title;
    }


    function getNetflixDomProviderTitle() {
        const candidates =
            [];


        const addCandidate =
            value => {
                const text =
                    String(
                        value ||
                        ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                if (
                    text.length >= 2 &&
                    text.length <= 220 &&
                    !candidates.includes(
                        text
                    )
                ) {
                    candidates.push(
                        text
                    );
                }
            };


        const titleNodes =
            document.querySelectorAll(
                '[data-uia*="video-title"], [data-uia*="player-title"], [data-uia="video-title"], [class*="video-title"], [class*="VideoTitle"], [class*="ellipsize"]'
            );


        for (
            const node
            of titleNodes
        ) {
            addCandidate(
                node.textContent
            );

            addCandidate(
                node.getAttribute?.(
                    "aria-label"
                )
            );

            addCandidate(
                node.getAttribute?.(
                    "title"
                )
            );


            let parent =
                node.parentElement;


            for (
                let depth = 0;
                depth < 3 && parent;
                depth++
            ) {
                addCandidate(
                    parent.textContent
                );

                parent =
                    parent.parentElement;
            }
        }


        for (
            const candidate
            of candidates
        ) {
            const cleaned =
                cleanProviderTitle(
                    candidate,
                    "netflix"
                );

            const compact =
                compactNetflixNowPlayingTitle(
                    cleaned
                );


            if (
                compact &&
                compact !== cleaned &&
                compact.length >= 2
            ) {
                return compact;
            }
        }


        const structuralTitle =
            getTextFromSelectors([
                '[data-uia*="video-title"] h1',
                '[data-uia*="video-title"] h2',
                '[data-uia*="video-title"] h3',
                '[data-uia*="video-title"] h4',
                '[data-uia*="player-title"] h1',
                '[data-uia*="player-title"] h2',
                '[data-uia*="player-title"] h3',
                '[data-uia*="player-title"] h4',
                '[class*="video-title"] h1',
                '[class*="video-title"] h2',
                '[class*="video-title"] h3',
                '[class*="video-title"] h4',
                '[class*="ellipsize"] h4'
            ]);


        if (
            structuralTitle
        ) {
            return compactNetflixNowPlayingTitle(
                cleanProviderTitle(
                    structuralTitle,
                    "netflix"
                )
            );
        }


        /*
         * document.body.innerText forces a full rendered-text walk and is the
         * expensive compatibility fallback here. Do not repeat it on every
         * Now Playing tick when Netflix's normal title nodes are absent.
         */
        const bodyScanUrl =
            String(
                location.href ||
                ""
            );

        const bodyScanNow =
            Date.now();

        const shouldScanBody =
            bodyScanUrl !==
                netflixDomBodyScanUrl ||
            bodyScanNow -
                netflixDomBodyScanAt >=
                    5000;


        if (
            shouldScanBody
        ) {
            netflixDomBodyScanUrl =
                bodyScanUrl;

            netflixDomBodyScanAt =
                bodyScanNow;

            netflixDomBodyScanTitle =
                "";


            const bodyLines =
                String(
                    document.body?.innerText ||
                    ""
                )
                    .split(
                        /[\r\n]+/
                    )
                    .map(
                        line =>
                            line
                                .replace(
                                    /\s+/g,
                                    " "
                                )
                                .trim()
                    )
                    .filter(
                        line =>
                            line.length >= 4 &&
                            line.length <= 220 &&
                            /\s(?:S(?:eason|taffel)?\s*\d+\s*)?E(?:pisode)?\s*\d+/i.test(
                                line
                            )
                    );


            for (
                const line
                of bodyLines
            ) {
                const cleaned =
                    cleanProviderTitle(
                        line,
                        "netflix"
                    );

                const compact =
                    compactNetflixNowPlayingTitle(
                        cleaned
                    );


                if (
                    compact &&
                    compact !== cleaned &&
                    compact.length >= 2
                ) {
                    netflixDomBodyScanTitle =
                        compact;

                    return compact;
                }
            }
        }


        if (
            bodyScanUrl ===
                netflixDomBodyScanUrl &&
            netflixDomBodyScanTitle
        ) {
            return netflixDomBodyScanTitle;
        }


        const fallback =
            getTextFromSelectors([
                '[data-uia="video-title"]',
                '[data-uia="player-title"]',
                '[data-uia*="video-title"]'
            ]) ||
            getMetaContent(
                'meta[property="og:title"]'
            ) ||
            document.title;


        return compactNetflixNowPlayingTitle(
            cleanProviderTitle(
                fallback,
                "netflix"
            )
        );
    }


    async function getNetflixProviderTitle() {
        /*
         * Do not call Netflix's internal member metadata endpoint from the
         * playback document. The player is extremely sensitive to extra
         * same-origin traffic in some Chromium builds. Capture the title from
         * the player DOM while controls are available; startNowPlayingTracking
         * keeps that last stable metadata when Netflix later removes them.
         */
        return getNetflixDomProviderTitle();
    }


