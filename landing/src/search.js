/*
 * ============================================================
 * SEARCH
 * ============================================================
 */

function showSearchHint() {
    searchHeaderTitle.textContent =
        "Search";


    mediaPanelSubtitle.textContent =
        "Movies and series · current availability in Germany";


    renderPanelMessage(
        "What do you want to watch?",
        "Enter at least two characters. Stream Shell will search for movies and series and check their current streaming availability.",
        {
            icon:
                "⌕"
        }
    );
}


function renderSearchResults(
    results,
    generation
) {
    searchHeaderTitle.textContent =
        "Search Results";


    mediaPanelSubtitle.textContent =
        `${results.length} ${
            results.length ===
                1
                ? "result"
                : "results"
        } · Germany`;


    if (
        results.length ===
        0
    ) {
        renderPanelMessage(
            "No results",
            "No matching movies or series were found.",
            {
                icon:
                    "×"
            }
        );


        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (
        const media
        of results
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "search",

                    saved:
                        isSaved(
                            media
                        ),

                    generation
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


async function runSearch(
    query,
    generation
) {
    try {
        const hasToken =
            await window
                .StreamShellMediaApi
                .hasToken();


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        if (
            !hasToken
        ) {
            await renderTokenSetup(
                () => {
                    if (
                        activePanel ===
                        "search"
                    ) {
                        scheduleSearch(
                            true
                        );
                    }
                }
            );


            return;
        }


        renderPanelMessage(
            "Searching...",
            `Searching for “${query}” and checking streaming availability.`,
            {
                icon:
                    "…"
            }
        );


        const results =
            await window
                .StreamShellMediaApi
                .searchMedia(
                    query
                );


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        searchResults =
            results;


        await refreshWatchlistCache();


        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        renderSearchResults(
            results,
            generation
        );

    } catch (error) {

        if (
            generation !==
            searchGeneration
        ) {
            return;
        }


        console.error(
            "Media search failed:",
            error
        );


        if (
            error?.code ===
                "TMDB_TOKEN_MISSING" ||
            error?.code ===
                "TMDB_TOKEN_INVALID"
        ) {
            await renderTokenSetup(
                () => {
                    scheduleSearch(
                        true
                    );
                }
            );


            return;
        }


        renderPanelMessage(
            "Search failed",
            "TMDB could not be reached. Try again.",
            {
                icon:
                    "×",

                error:
                    true
            }
        );
    }
}


function scheduleSearch(
    immediate =
        false
) {
    openPanel(
        "search"
    );


    const query =
        mediaSearchInput
            .value
            .trim();


    mediaSearchClear.hidden =
        query.length ===
        0;


    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    const generation =
        searchGeneration;


    searchResults =
        [];


    if (
        query.length <
        2
    ) {
        showSearchHint();

        return;
    }


    searchTimer =
        setTimeout(
            () => {
                runSearch(
                    query,
                    generation
                );
            },

            immediate
                ? 0
                : 300
        );
}


async function clearSearch() {
    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    searchResults =
        [];


    selectedMediaKey =
        null;


    mediaSearchInput.value =
        "";


    mediaSearchClear.hidden =
        true;


    await window
        .StreamShellAvailability
        .clearSelectedMedia();


    openPanel(
        "search"
    );


    showSearchHint();


    mediaSearchInput.focus();
}


