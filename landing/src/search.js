/*
 * ============================================================
 * SEARCH
 * ============================================================
 */

const mediaSearchSource = document.getElementById("media-search-source");
const mediaSourceTabs = {
    tmdb: document.getElementById("media-search-tmdb-tab"),
    fmhy: document.getElementById("media-search-fmhy-tab")
};
// One media search: TMDB and AniList queried together, with one multi-select.
const streamShellSearchFilterTypes = Object.freeze({
    tmdb: [["movie", "Movies"], ["tv", "Series"], ["anime", "Anime"],
           ["manga", "Manga"], ["novel", "Novels"]]
});
const streamShellSearchSelectedTypes = { tmdb: new Set() };
const streamShellSearchResultCache = {tmdb: null, anilist: null};
let streamShellSevenSeasAcknowledged = false;
function streamShellSearchMatchesType(item, source) {
    const selected = streamShellSearchSelectedTypes.tmdb;
    return !selected.size || selected.has(item.mediaType);
}
function streamShellSearchTypeSubtitle(source, summary) {
    if (mediaSearchSource?.value !== "tmdb") return;
    const host = createElement("div", "ss-search-filter-bar");
    host.appendChild(createElement("div", "ss-search-filter-summary", summary));
    const filters = createElement("div", "ss-search-filter-chips");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Search media types (multiple allowed)");
    for (const [type, label] of streamShellSearchFilterTypes.tmdb) {
        const chip = createElement("button", "ss-library-filter", label);
        chip.type = "button";
        const active = streamShellSearchSelectedTypes.tmdb.has(type);
        chip.classList.toggle("selected", active);
        chip.setAttribute("aria-pressed", String(active));
        chip.addEventListener("click", () => {
            const selected = streamShellSearchSelectedTypes.tmdb;
            if (selected.has(type)) selected.delete(type); else selected.add(type);
            if (mediaSearchSource?.value !== "tmdb") return;
            const query = mediaSearchInput.value.trim();
            if (streamShellSearchResultCache.tmdb?.query === query ||
                streamShellSearchResultCache.anilist?.query === query) {
                void streamShellRenderUnifiedResults(query, searchGeneration).catch(console.error);
            } else showSearchHint();
        });
        filters.appendChild(chip);
    }
    host.appendChild(filters);
    mediaPanelSubtitle.replaceChildren(host);
}
function streamShellSetSevenSeasSearchAccess(enabled) {
    streamShellSevenSeasAcknowledged = enabled === true;
    const tab = mediaSourceTabs.fmhy;
    if (tab) {
        tab.disabled = !streamShellSevenSeasAcknowledged;
        tab.title = streamShellSevenSeasAcknowledged ? "Browse FMHY resources" :
            "Disabled until Seven Seas is acknowledged in General settings";
        tab.setAttribute("aria-disabled", String(!streamShellSevenSeasAcknowledged));
    }
    if (!streamShellSevenSeasAcknowledged && mediaSearchSource?.value === "fmhy") {
        setMediaSearchSource("tmdb");
    }
}
if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
    chrome.storage.local.get("streamShellSevenSeasAcknowledged")
        .then(stored => streamShellSetSevenSeasSearchAccess(stored.streamShellSevenSeasAcknowledged === true))
        .catch(() => streamShellSetSevenSeasSearchAccess(false));
    chrome.storage.onChanged?.addListener((changes, area) => {
        if (area === "local" && changes.streamShellSevenSeasAcknowledged)
            streamShellSetSevenSeasSearchAccess(changes.streamShellSevenSeasAcknowledged.newValue === true);
    });
}
function setMediaSearchSource(source) {
    if (!mediaSearchSource || !mediaSourceTabs[source]) return;
    if (source === "fmhy" && !streamShellSevenSeasAcknowledged) return;
    mediaSearchSource.value = source;
    mediaSearchInput.placeholder = source === "fmhy" ? "Search resources..." :
        "Search movies, series, anime, manga and novels...";
    mediaSearchInput.setAttribute("aria-label", mediaSearchInput.placeholder);
    for (const [kind, tab] of Object.entries(mediaSourceTabs)) {
        if (!tab) continue;
        const selected = kind === source;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
    }
    scheduleSearch(true);
}
for (const [kind, tab] of Object.entries(mediaSourceTabs)) {
    tab?.addEventListener("click", () => setMediaSearchSource(kind));
}
function showSearchHint() {
    if (mediaSearchSource?.value === "fmhy") {
        streamShellFmhySubtitle("Select an Area to discover resources, or enter a keyword.");
        renderPanelMessage("Discover FMHY resources",
            "Choose a category like Gaming or enter a search term. Community picks are listed first.", {icon:"⌕"});
    } else {
        streamShellSearchTypeSubtitle("tmdb", "TMDB · movies and series · AniList · anime, manga and novels");
        renderPanelMessage("What do you want to watch?",
            "Search all five media types together, or select the types you want above.", {icon:"⌕"});
    }
}

function renderSearchResults(
    results,
    generation
) {

    const visible = results.filter(item => streamShellSearchMatchesType(item, "tmdb"));
    streamShellSearchTypeSubtitle("tmdb", `${visible.length} of ${results.length} results · Germany`);


    if (
        visible.length ===
        0
    ) {
        renderPanelMessage(
            "No results",
            "No matching movies or series for the selected types.",
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
        of visible
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


let streamShellUnifiedRenderEpoch = 0;
async function streamShellRenderUnifiedResults(query, generation, warning = "") {
    const renderEpoch = ++streamShellUnifiedRenderEpoch;
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const tmdb = streamShellSearchResultCache.tmdb?.query === query
        ? streamShellSearchResultCache.tmdb.items : [];
    const anilist = streamShellSearchResultCache.anilist?.query === query
        ? streamShellSearchResultCache.anilist.items : [];
    const movies = tmdb.filter(item => streamShellSearchMatchesType(item, "tmdb"));
    const anime = anilist.filter(item => streamShellSearchMatchesType(item, "anilist"));
    streamShellSearchTypeSubtitle("tmdb", `${movies.length} TMDB · ${anime.length} AniList${warning ? " · " + warning : ""}`);
    if (!movies.length && !anime.length) {
        renderPanelMessage("No results", warning || "Try other media types or another title.", {icon:"⌕"});
        return;
    }
    const list = createElement("div", "media-list ss-unified-results");
    if (movies.length) {
        list.appendChild(createElement("div", "ss-search-result-section", `TMDB · Movies & Series (${movies.length})`));
        for (const item of movies) list.appendChild(createMediaItem(item, {
            mode:"search", saved:isSaved(item), generation
        }));
    }
    if (anime.length) {
        // Library identities stay independent; no cross-service ID guessing.
        const current = await window.StreamShellExternalLibrary.getAll();
        if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb" ||
            renderEpoch !== streamShellUnifiedRenderEpoch) return;
        const ids = new Set(current.filter(item => item.source === "anilist")
            .map(item => `${item.mediaType}:${item.anilistId}`));
        list.appendChild(createElement("div", "ss-search-result-section", `AniList · Anime, Manga & Novels (${anime.length})`));
        for (const item of anime) list.appendChild(streamShellAniListResultCard(item,
            ids.has(`${item.mediaType}:${item.anilistId}`), generation));
    }
    if (renderEpoch !== streamShellUnifiedRenderEpoch) return;
    mediaPanelBody.replaceChildren(list);
}
async function runSearch(query, generation) {
    if (mediaSearchSource?.value === "fmhy") {
        try {
            // Recheck persistent acknowledgement rather than trusting a rendered tab.
            if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
                const ack = await chrome.storage.local.get("streamShellSevenSeasAcknowledged");
                if (ack.streamShellSevenSeasAcknowledged !== true) {
                    streamShellSetSevenSeasSearchAccess(false);
                    return;
                }
            }
            streamShellFmhySubtitle("Loading FMHY areas…");
            renderPanelMessage("Loading FMHY…", "Fetching directory resources for discovery.", {icon:"⌕"});
            const entries = await streamShellFetchFmhyResources();
            if (generation !== searchGeneration || mediaSearchSource?.value !== "fmhy") return;
            fmhyDisplayedLimit = STREAM_SHELL_FMHY_PAGE_SIZE;
            renderFmhyResults(streamShellSearchFmhyIndex(entries, query), generation);
        } catch (error) {
            if (generation === searchGeneration && mediaSearchSource?.value === "fmhy") {
                console.error("FMHY search failed", error);
                renderPanelMessage("FMHY unavailable", String(error?.message || error).slice(0,180), {icon:"×",error:true});
            }
        }
        return;
    }
    streamShellSearchTypeSubtitle("tmdb", "Searching TMDB + AniList…");
    renderPanelMessage("Searching…", `Finding “${query}” across both media catalogues.`, {icon:"⌕"});
    // Each index is independent. A missing TMDB token must not block AniList.
    const tasks = [
        (async () => {
            if (!await window.StreamShellMediaApi.hasToken())
                throw new Error("TMDB token not configured");
            return window.StreamShellMediaApi.searchMedia(query);
        })(),
        window.StreamShellAniList.search(query)
    ];
    const settled = await Promise.allSettled(tasks);
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const tmdb = settled[0].status === "fulfilled" ? settled[0].value : [];
    const anilist = settled[1].status === "fulfilled" ? settled[1].value : [];
    streamShellSearchResultCache.tmdb = {query, items:tmdb};
    streamShellSearchResultCache.anilist = {query, items:anilist};
    searchResults = tmdb;
    try { await refreshWatchlistCache(); } catch (error) { console.warn("Watchlist refresh failed", error); }
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const failed = settled.map((r,i) => r.status === "rejected" ? (i ? "AniList unavailable" :
        /token/i.test(String(r.reason?.message || r.reason)) ? "TMDB token needed" : "TMDB unavailable") : null).filter(Boolean);
    await streamShellRenderUnifiedResults(query, generation, failed.join(" · "));
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
    mediaSearchClear.setAttribute("aria-hidden", String(query.length === 0));


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
        2 && !(mediaSearchSource?.value === "fmhy" && streamShellFmhyIsBrowsing(query))
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
    mediaSearchClear.setAttribute("aria-hidden", "true");


    await window
        .StreamShellAvailability
        .clearSelectedMedia();


    openPanel(
        "search"
    );


    showSearchHint();


    mediaSearchInput.focus();
}


