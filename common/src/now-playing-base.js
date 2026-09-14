    /*
     * ============================================================
     * NOW PLAYING TRACKER
     * ============================================================
     *
     * The Dashboard reads one small storage record per provider.
     * Nothing is sent outside Stream Shell; title/artwork are taken
     * from the already-open provider page itself.
     */

    const NOW_PLAYING_KEY_PREFIX =
        "streamShellNowPlaying_";


    function getCurrentProvider() {
        const hostname =
            String(
                window.location.hostname ||
                ""
            ).toLowerCase();


        for (
            const [provider, config]
            of Object.entries(
                PROVIDERS
            )
        ) {
            if (
                config.hosts.some(
                    host =>
                        hostname === host ||
                        hostname.endsWith(
                            `.${host}`
                        )
                )
            ) {
                return provider;
            }
        }


        return null;
    }


    function getMetaContent(
        selector
    ) {
        return String(
            document
                .querySelector(
                    selector
                )
                ?.getAttribute(
                    "content"
                ) ||
            ""
        ).trim();
    }


    function getTextFromSelectors(
        selectors
    ) {
        for (
            const selector
            of selectors
        ) {
            const elements =
                document.querySelectorAll(
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


    function getAttributeFromSelectors(
        selectors,
        attribute
    ) {
        for (
            const selector
            of selectors
        ) {
            const elements =
                document.querySelectorAll(
                    selector
                );


            for (
                const element
                of elements
            ) {
                const value =
                    String(
                        attribute === "src"
                            ? element.currentSrc ||
                                element.getAttribute?.(
                                    "src"
                                ) ||
                                ""
                            : element.getAttribute?.(
                                attribute
                            ) ||
                                ""
                    ).trim();


                if (
                    value
                ) {
                    return value;
                }
            }
        }


        return "";
    }


    function isGenericProviderTitle(
        title,
        provider
    ) {
        const value =
            String(
                title ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            !value
        ) {
            return true;
        }


        if (
            provider ===
                "prime"
        ) {
            return (
                /^(?:amazon\s+)?prime\s*video(?:\b|\s*[:|\-])/i.test(
                    value
                ) ||
                /^watch\s+(?:movies|tv|shows|prime\s*video)/i.test(
                    value
                ) ||
                /^amazon\.(?:com|de)\b/i.test(
                    value
                )
            );
        }


        return false;
    }


    function cleanProviderTitle(
        rawTitle,
        provider
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


        const suffixes = {
            youtube: [
                /\s*-\s*YouTube\s*$/i
            ],

            netflix: [
                /^Watch\s+/i,
                /\s*[|\-]\s*Netflix\s*$/i
            ],

            prime: [
                /\s*[|\-]\s*Prime Video\s*$/i,
                /\s*[|\-]\s*Amazon Prime Video\s*$/i
            ],

            disney: [
                /\s*[|\-]\s*Disney\+\s*$/i
            ],

            crunchyroll: [
                /\s*[|\-]\s*Crunchyroll\s*$/i
            ]
        };


        for (
            const pattern
            of suffixes[provider] || []
        ) {
            title =
                title.replace(
                    pattern,
                    ""
                ).trim();
        }


        if (
            /^(Netflix|YouTube|Prime Video|Amazon Prime Video|Disney\+|Crunchyroll)$/i.test(
                title
            )
        ) {
            return "";
        }


        return title;
    }


