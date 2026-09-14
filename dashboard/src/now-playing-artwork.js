function normalizeNowPlayingArtworkQuery(
    rawTitle
) {
    let title =
        String(
            rawTitle ||
            ""
        ).trim();


    if (
        !title
    ) {
        return "";
    }


    /*
     * Player titles often append episode metadata to the show name, e.g.
     * "Rick and Morty E7: ...". TMDB works much better with the series
     * title than with the complete episode label.
     */
    title =
        title
            .replace(
                /\s+(?:S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*)?E(?:P(?:ISODE)?)?\s*\d+.*$/i,
                ""
            )
            .replace(
                /\s+S(?:eason|taffel)?\s*\d+\s*[:·/\-]?\s*F(?:olge)?\s*\d+.*$/i,
                ""
            )
            .replace(
                /\s+[·–—-]\s*(?:S\d+\s*)?E\d+\b.*$/i,
                ""
            )
            .replace(
                /\s+[·–—-]\s*(?:Episode|Folge|Chapter|Kapitel)\s+\d+\b.*$/i,
                ""
            )
            .replace(
                /\s+(?:Episode|Folge|Chapter|Kapitel)\s+\d+\b.*$/i,
                ""
            )
            .replace(
                /\s*[·–—-]\s*$/,
                ""
            )
            .trim();


    return title;
}


async function resolveNowPlayingTmdbMatch(
    provider,
    rawTitle
) {
    if (
        provider ===
            "youtube"
    ) {
        return null;
    }


    const query =
        normalizeNowPlayingArtworkQuery(
            rawTitle
        );


    if (
        query.length <
            2
    ) {
        return null;
    }


    const cacheKey =
        `${provider}|${query.toLowerCase()}`;


    if (
        nowPlayingTmdbMatches.has(
            cacheKey
        )
    ) {
        return nowPlayingTmdbMatches.get(
            cacheKey
        );
    }


    const promise =
        (async () => {
            try {
                const api =
                    window.StreamShellMediaApi;


                if (
                    !api ||
                    !await api.hasToken()
                ) {
                    return null;
                }


                const results =
                    await api.searchMedia(
                        query
                    );


                if (
                    !Array.isArray(
                        results
                    ) ||
                    results.length ===
                        0
                ) {
                    return null;
                }


                const normalizedQuery =
                    query.toLocaleLowerCase();


                return results.find(
                    item =>
                        [
                            item.title,
                            item.originalTitle
                        ]
                            .filter(Boolean)
                            .some(
                                value =>
                                    String(
                                        value
                                    )
                                        .trim()
                                        .toLocaleLowerCase() ===
                                    normalizedQuery
                            )
                ) ||
                results[0] ||
                null;

            } catch {
                return null;
            }
        })();


    nowPlayingTmdbMatches.set(
        cacheKey,
        promise
    );


    const result =
        await promise;


    nowPlayingTmdbMatches.set(
        cacheKey,
        result
    );


    return result;
}


async function resolveNowPlayingArtworkFallback(
    provider,
    rawTitle
) {
    if (
        provider ===
            "youtube"
    ) {
        return "";
    }


    const query =
        normalizeNowPlayingArtworkQuery(
            rawTitle
        );


    if (
        query.length <
            2
    ) {
        return "";
    }


    const cacheKey =
        `${provider}|${query.toLowerCase()}`;


    if (
        nowPlayingArtworkFallbacks.has(
            cacheKey
        )
    ) {
        return nowPlayingArtworkFallbacks.get(
            cacheKey
        );
    }


    const promise =
        resolveNowPlayingTmdbMatch(
            provider,
            rawTitle
        )
            .then(
                match =>
                    String(
                        match?.backdropUrl ||
                        match?.posterUrl ||
                        ""
                    ).trim()
            );


    nowPlayingArtworkFallbacks.set(
        cacheKey,
        promise
    );


    const result =
        await promise;


    nowPlayingArtworkFallbacks.set(
        cacheKey,
        result
    );


    return result;
}


async function applyNowPlayingRating(
    provider,
    media
) {
    if (!nowPlayingRating) return;

    const clearRating = () => {
        nowPlayingRating.hidden = true;
        nowPlayingRating.textContent = "";
        nowPlayingRating.title = "";
        delete nowPlayingRating.dataset.identity;
        delete nowPlayingRating.dataset.ratingKind;
        nowPlayingPanel?.classList.remove("has-rating");
    };

    if (!media?.title) {
        clearRating();
        return;
    }

    if (provider === "youtube") {
        if (
            media.likeRatio === null ||
            media.likeRatio === undefined ||
            media.likeRatio === ""
        ) {
            clearRating();
            return;
        }

        const ratio = Number(media.likeRatio);
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
            clearRating();
            return;
        }

        const like = Math.min(100, Math.max(0, ratio));
        const dislike = Math.max(0, 100 - like);
        const likeText = like.toFixed(1);
        const dislikeText = dislike.toFixed(1);

        nowPlayingRating.dataset.identity = `youtube|${media.url || media.title}`;
        nowPlayingRating.dataset.ratingKind = "youtube";
        nowPlayingRating.textContent = `👍 ${likeText}% · 👎 ${dislikeText}%`;
        nowPlayingRating.title = "Like / dislike ratio from Return YouTube Dislike";
        nowPlayingRating.hidden = false;
        nowPlayingPanel?.classList.add("has-rating");
        return;
    }

    const rawTitle = String(media.title || "").trim();
    const title = provider === "netflix"
        ? normalizeNowPlayingArtworkQuery(rawTitle) || rawTitle
        : rawTitle;
    const identity = `${provider}|${title}`;

    if (
        nowPlayingRating.dataset.identity === identity &&
        nowPlayingRating.dataset.ratingKind === "tmdb" &&
        !nowPlayingRating.hidden &&
        nowPlayingRating.textContent
    ) {
        return;
    }

    nowPlayingRating.hidden = true;
    nowPlayingRating.textContent = "";
    nowPlayingRating.dataset.identity = identity;
    nowPlayingRating.dataset.ratingKind = "tmdb";
    nowPlayingPanel?.classList.remove("has-rating");

    const match = await resolveNowPlayingTmdbMatch(provider, rawTitle);
    const currentProvider = currentLeftMode;
    const currentRawTitle = String(
        nowPlayingByProvider[currentProvider]?.title || ""
    ).trim();
    const currentTitle = currentProvider === "netflix"
        ? normalizeNowPlayingArtworkQuery(currentRawTitle) || currentRawTitle
        : currentRawTitle;
    const currentIdentity = `${currentProvider}|${currentTitle}`;

    if (
        identity !== currentIdentity ||
        nowPlayingRating.dataset.identity !== identity
    ) {
        return;
    }

    const rating = Number(match?.rating);
    if (!Number.isFinite(rating) || rating <= 0) return;

    const display = rating.toFixed(1);
    nowPlayingRating.textContent = `TMDB ${display}`;
    nowPlayingRating.title = `TMDB rating ${display} / 10`;
    nowPlayingRating.hidden = false;
    nowPlayingPanel?.classList.add("has-rating");
}


function applyNowPlayingArtwork(
    provider,
    media
) {
    const directArtwork =
        String(
            media?.image ||
            ""
        ).trim();


    const title =
        String(
            media?.title ||
            ""
        ).trim();


    const identity =
        `${provider}|${title}`;


    const identityIsCurrent =
        () =>
            currentLeftMode ===
                provider &&
            `${provider}|${String(
                nowPlayingByProvider[
                    provider
                ]?.title ||
                ""
            ).trim()}` ===
                identity;


    const applyFallback =
        async (
            fallbackOnMiss =
                ""
        ) => {
            const fallback =
                await resolveNowPlayingArtworkFallback(
                    provider,
                    title
                );


            if (
                !identityIsCurrent()
            ) {
                return;
            }


            if (
                fallback
            ) {
                setNowPlayingArtwork(
                    fallback
                );

                return;
            }


            if (
                fallbackOnMiss &&
                !failedNowPlayingArtworkSources.has(
                    fallbackOnMiss
                )
            ) {
                setNowPlayingArtwork(
                    fallbackOnMiss
                );

                return;
            }


            setNowPlayingArtwork(
                ""
            );
        };


    if (
        provider ===
            "netflix"
    ) {
        /*
         * Netflix now supplies artwork from its member metadata endpoint.
         * Prefer that real title artwork first; TMDB remains the safety net
         * if Netflix returns nothing or the image cannot be loaded.
         */
        if (
            directArtwork &&
            !failedNowPlayingArtworkSources.has(
                directArtwork
            )
        ) {
            setNowPlayingArtwork(
                directArtwork,
                () => {
                    failedNowPlayingArtworkSources.add(
                        directArtwork
                    );

                    applyFallback();
                }
            );

            return;
        }


        applyFallback();

        return;
    }


    if (
        directArtwork &&
        !failedNowPlayingArtworkSources.has(
            directArtwork
        )
    ) {
        /*
         * Some providers expose an URL that exists in metadata but cannot be
         * hot-linked from an extension page. If the image element rejects it,
         * remember that source and fall back to the TMDB backdrop instead of
         * retrying the same broken URL on every progress update.
         */
        setNowPlayingArtwork(
            directArtwork,
            () => {
                failedNowPlayingArtworkSources.add(
                    directArtwork
                );


                applyFallback();
            }
        );


        return;
    }


    applyFallback();
}


