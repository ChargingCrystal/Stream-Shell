(() => {
    "use strict";


    /*
     * ============================================================
     * CONFIG
     * ============================================================
     */

    const API_BASE =
        "https://api.themoviedb.org/3";


    const LANGUAGE =
        "de-DE";


    const REGION =
        "DE";


    const TOKEN_STORAGE_KEY =
        "streamShellTmdbBearerToken";


    const SEARCH_LIMIT =
        8;


    /*
     * ============================================================
     * ERRORS
     * ============================================================
     */

    function createTokenMissingError() {
        const error =
            new Error(
                "TMDB Read Access Token is missing."
            );


        error.code =
            "TMDB_TOKEN_MISSING";


        return error;
    }


    /*
     * ============================================================
     * TOKEN
     * ============================================================
     */

    async function getToken() {
        const stored =
            await chrome.storage.local.get(
                TOKEN_STORAGE_KEY
            );


        return String(
            stored[
                TOKEN_STORAGE_KEY
            ] ||
            ""
        ).trim();
    }


    async function hasToken() {
        return Boolean(
            await getToken()
        );
    }


    /*
     * ============================================================
     * HTTP REQUEST
     * ============================================================
     */

    async function request(
        path,
        query = {},
        tokenOverride = null
    ) {
        const token =
            String(
                tokenOverride ||
                await getToken()
            ).trim();


        if (
            !token
        ) {
            throw createTokenMissingError();
        }


        const url =
            new URL(
                `${API_BASE}${path}`
            );


        /*
         * Query parameters.
         */

        for (
            const [key, value]
            of Object.entries(
                query
            )
        ) {
            if (
                value ===
                    undefined ||
                value ===
                    null ||
                value ===
                    ""
            ) {
                continue;
            }


            url.searchParams.set(
                key,
                String(
                    value
                )
            );
        }


        let response;


        try {
            response =
                await fetch(
                    url.toString(),
                    {
                        method:
                            "GET",

                        headers: {
                            Accept:
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

        } catch (error) {

            const networkError =
                new Error(
                    `TMDB network request failed: ${error.message}`
                );


            networkError.code =
                "TMDB_NETWORK_ERROR";


            networkError.cause =
                error;


            throw networkError;
        }


        /*
         * HTTP error.
         */

        if (
            !response.ok
        ) {
            let responseBody =
                null;


            try {
                responseBody =
                    await response.json();

            } catch {
            }


            const error =
                new Error(
                    responseBody?.status_message ||
                    `TMDB returned HTTP ${response.status}.`
                );


            error.status =
                response.status;


            error.tmdbResponse =
                responseBody;


            if (
                response.status ===
                    401 ||
                response.status ===
                    403
            ) {
                error.code =
                    "TMDB_TOKEN_INVALID";

            } else {

                error.code =
                    "TMDB_HTTP_ERROR";
            }


            throw error;
        }


        return response.json();
    }


    /*
     * ============================================================
     * TOKEN VALIDATION
     * ============================================================
     */

    async function validateToken(
        rawToken
    ) {
        const token =
            String(
                rawToken ||
                ""
            ).trim();


        if (
            !token
        ) {
            throw createTokenMissingError();
        }


        /*
         * /configuration is small and requires normal API auth,
         * therefore useful as a simple token validation request.
         */

        await request(
            "/configuration",
            {},
            token
        );


        return true;
    }


    async function saveToken(
        rawToken
    ) {
        const token =
            String(
                rawToken ||
                ""
            ).trim();


        if (
            !token
        ) {
            throw createTokenMissingError();
        }


        await validateToken(
            token
        );


        await chrome.storage.local.set({
            [TOKEN_STORAGE_KEY]:
                token
        });


        return true;
    }


    async function clearToken() {
        await chrome.storage.local.remove(
            TOKEN_STORAGE_KEY
        );
    }


    /*
     * ============================================================
     * MEDIA NORMALIZATION
     * ============================================================
     */

    function normalizeDate(
        value
    ) {
        if (
            typeof value !==
                "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(
                value
            )
        ) {
            return "";
        }


        return value;
    }


    function normalizeSearchResult(
        item
    ) {
        if (
            !item ||
            (
                item.media_type !==
                    "movie" &&
                item.media_type !==
                    "tv"
            )
        ) {
            return null;
        }


        const isMovie =
            item.media_type ===
            "movie";


        const title =
            String(
                isMovie
                    ? item.title || ""
                    : item.name || ""
            ).trim();


        if (
            !title
        ) {
            return null;
        }


        const originalTitle =
            String(
                isMovie
                    ? item.original_title || ""
                    : item.original_name || ""
            ).trim();


        const releaseDate =
            normalizeDate(
                isMovie
                    ? item.release_date
                    : item.first_air_date
            );


        const ratingNumber =
            Number(
                item.vote_average
            );


        return {
            id:
                Number(
                    item.id
                ),

            mediaType:
                item.media_type,

            title,

            originalTitle,

            releaseDate,

            year:
                releaseDate
                    ? releaseDate.slice(
                        0,
                        4
                    )
                    : "",

            overview:
                String(
                    item.overview ||
                    ""
                ).trim(),

            posterPath:
                String(
                    item.poster_path ||
                    ""
                ).trim(),

            backdropPath:
                String(
                    item.backdrop_path ||
                    ""
                ).trim(),

            posterUrl:
                item.poster_path
                    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    : "",

            backdropUrl:
                item.backdrop_path
                    ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                    : "",

            rating:
                Number.isFinite(
                    ratingNumber
                )
                    ? ratingNumber
                    : null
        };
    }


    /*
     * ============================================================
     * SEARCH
     * ============================================================
     */

    async function searchMedia(
        rawQuery
    ) {
        const query =
            String(
                rawQuery ||
                ""
            ).trim();


        if (
            query.length <
            2
        ) {
            return [];
        }


        const payload =
            await request(
                "/search/multi",
                {
                    query,

                    language:
                        LANGUAGE,

                    include_adult:
                        false,

                    page:
                        1
                }
            );


        const results =
            Array.isArray(
                payload?.results
            )
                ? payload.results
                : [];


        return results
            .map(
                normalizeSearchResult
            )
            .filter(
                Boolean
            )
            .slice(
                0,
                SEARCH_LIMIT
            );
    }


    /*
     * ============================================================
     * MEDIA VALIDATION
     * ============================================================
     */

    function validateMedia(
        media
    ) {
        if (
            !media ||
            !Number.isInteger(
                Number(
                    media.id
                )
            ) ||
            (
                media.mediaType !==
                    "movie" &&
                media.mediaType !==
                    "tv"
            )
        ) {
            throw new Error(
                "Invalid Stream Shell media object."
            );
        }
    }


    /*
     * ============================================================
     * WATCH PROVIDERS
     * ============================================================
     */

    async function getWatchProviders(
        media
    ) {
        validateMedia(
            media
        );


        const payload =
            await request(
                `/${media.mediaType}/${media.id}/watch/providers`
            );


        /*
         * Only German availability is relevant to Stream Shell.
         */

        return (
            payload
                ?.results
                ?.[REGION] ||
            null
        );
    }


    /*
     * ============================================================
     * PUBLIC API
     * ============================================================
     */

    window.StreamShellMediaApi = {
        API_BASE,

        LANGUAGE,

        REGION,

        TOKEN_STORAGE_KEY,

        getToken,

        hasToken,

        request,

        validateToken,

        saveToken,

        clearToken,

        searchMedia,

        getWatchProviders
    };


    console.debug(
        "[Stream Shell] Media API module loaded."
    );
})();