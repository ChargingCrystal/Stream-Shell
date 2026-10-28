/*
 * ============================================================
 * CACHES
 * ============================================================
 */

let streamShellExternalLibraryCount = 0;
function updateWatchlistCount() {
    watchlistCount.textContent =
        String(
            watchlistItems.length +
            streamShellExternalLibraryCount +
            continueWatchingItems.length +
            directLinkItems.length
        );
}


async function refreshWatchlistCache() {
    watchlistItems =
        await window
            .StreamShellWatchlist
            .getAll();


    // Only count distinct displayed titles; paired TMDB/AniList records
    // remain separate in storage but must count as one Library entry.
    const externalItems = await window.StreamShellExternalLibrary.getAll();
    streamShellExternalLibraryCount = streamShellLinkLibraryEntries(watchlistItems,externalItems).length - watchlistItems.length;
    updateWatchlistCount();
}


async function refreshDirectLinkCache() {
    directLinkItems =
        await window
            .StreamShellDirectLinks
            .getAll();


    updateWatchlistCount();
}


async function refreshContinueWatchingCache() {
    continueWatchingItems =
        await window
            .StreamShellContinueWatching
            .getAll();


    updateWatchlistCount();
}


async function refreshRecentCache() {
    recentItems =
        await window
            .StreamShellHistory
            .getAll();
}


function findWatchlistMedia(
    key
) {
    return watchlistItems.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findSearchMedia(
    key
) {
    return searchResults.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findRecentMedia(
    key
) {
    return recentItems.find(
        item =>
            getMediaKey(
                item
            ) ===
            key
    ) ||
    null;
}


function findVisibleMedia(
    key
) {
    return (
        findSearchMedia(
            key
        ) ||
        findWatchlistMedia(
            key
        ) ||
        findRecentMedia(
            key
        )
    );
}


function isSaved(
    media
) {
    const key =
        getMediaKey(
            media
        );


    return watchlistItems.some(
        item =>
            getMediaKey(
                item
            ) ===
            key
    );
}


/*
 * ============================================================
 * WATCHLIST · mixed TMDB + external native-app library
 * ============================================================
 */
// Empty selection = all media types. Individual chips can be combined freely.
const streamShellLibrarySelectedTypes = new Set();
const streamShellLibraryFilterTypes = Object.freeze([
    ["movie", "Movies"], ["tv", "Series"], ["anime", "Anime"],
    ["manga", "Manga"], ["novel", "Novels"]
]);

function streamShellLibraryMatchesType(row) {
    return streamShellLibrarySelectedTypes.size === 0 ||
        streamShellLibrarySelectedTypes.has(row.media.mediaType) ||
        (row.kind === "linked" && streamShellLibrarySelectedTypes.has(row.anilist.mediaType));
}

function streamShellLibraryToolbar() {
    const host = createElement("div", "ss-library-controls");
    const filters = createElement("div", "ss-library-filters ss-library-filter-inline");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Filter library by media types (multiple allowed)");
    for (const [type, label] of streamShellLibraryFilterTypes) {
        const button = createElement("button", "ss-library-filter", label);
        button.type = "button";
        const selected = streamShellLibrarySelectedTypes.has(type);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.addEventListener("click", () => {
            if (streamShellLibrarySelectedTypes.has(type)) streamShellLibrarySelectedTypes.delete(type);
            else streamShellLibrarySelectedTypes.add(type);
            showWatchlist().catch(console.error);
        });
        filters.appendChild(button);
    }
    host.appendChild(filters);

    // Manual entry has an unambiguous type only when exactly one supported
    // native media type is selected. Multiple selections still filter normally.
    const manualTypes = {manga: "Manga", anime: "Anime", novel: "Novel"};
    const selectedType = streamShellLibrarySelectedTypes.size === 1
        ? [...streamShellLibrarySelectedTypes][0] : null;
    if (selectedType && manualTypes[selectedType]) {
        const form = createElement("form", "ss-library-add");
        const title = createElement("input", "ss-library-title", "");
        title.type = "text";
        title.placeholder = `Add ${manualTypes[selectedType].toLowerCase()} title…`;
        title.required = true;
        title.maxLength = 240;
        title.setAttribute("aria-label", `${manualTypes[selectedType]} title`);
        const add = createElement("button", "ss-library-add-button", "+ Add");
        add.type = "submit";
        const find = createElement("button", "ss-library-add-button ss-library-find", "Find on AniList");
        find.type = "button";
        find.title = "Find metadata and cover on AniList";
        find.addEventListener("click", () => {
            if (title.value.trim()) mediaSearchInput.value = title.value.trim();
            setMediaSearchSource("anilist");
            mediaSearchInput.focus();
        });
        form.append(title, find, add);
        form.addEventListener("submit", async event => {
            event.preventDefault();
            add.disabled = true;
            try {
                await window.StreamShellExternalLibrary.add(title.value, selectedType);
                await showWatchlist();
            } catch (error) {
                console.error("External library add failed", error);
                add.disabled = false;
            }
        });
        host.appendChild(form);
    }
    return host;
}

function streamShellExternalMediaRow(media) {
    const enriched = media.source === "anilist" && Number.isInteger(media.anilistId);
    const row = createElement("article", "media-item ss-library-native-item" + (enriched ? " ss-library-anilist" : ""));
    if (enriched) {
        const cover = streamShellAniListCover(media, "ss-anilist-cover") ||
            createElement("div", "ss-anilist-cover ss-anilist-cover-empty", "◈");
        row.appendChild(cover);
    }
    const main = createElement("div", "media-item-main");
    const heading = createElement("div", "media-item-title-row");
    heading.append(createElement("span", "media-item-title", media.title),
        createElement("span", "media-item-type", media.mediaType));
    main.append(heading, createElement("div", "media-item-meta", enriched
        ? streamShellAniListMeta(media,media.addedAt)
        : "Manually saved · Mangayomi"));
    const actions = createElement("div", "media-item-actions");
    const search = streamShellMangayomiSearchButton(media.title, media.mediaType);
    if (enriched) {
        const details = createElement("button", "media-item-action", "ⓘ");
        details.type = "button"; details.title = "Show AniList metadata";
        const panel = streamShellAniListDetails(media);
        panel.hidden = true;
        details.setAttribute("aria-expanded", "false");
        details.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
            details.setAttribute("aria-expanded", String(!panel.hidden));
        });
        main.appendChild(panel);
        actions.appendChild(details);
    }
    const remove = createElement("button", "media-item-action remove", "×");
    remove.type = "button"; remove.title = "Remove from local Library";
    remove.addEventListener("click", async () => {
        await window.StreamShellExternalLibrary.remove(media.id);
        await showWatchlist();
    });
    if (search) actions.appendChild(search);
    actions.appendChild(remove);
    row.append(main, actions);
    return row;
}
// Conservative, non-destructive joins. TMDB + AniList IDs are kept intact:
// only a same-year, same-title Anime/TV (or Anime movie/Movie) is shown once.
// Never merge manga/novels into a show, or uncertain/reused/remake titles.
function streamShellLibraryTitleKey(title) {
    return String(title || "").normalize("NFKC").toLocaleLowerCase("en")
        .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function streamShellLibraryYear(item) {
    const year = Number(item?.year || String(item?.releaseDate || "").slice(0,4));
    return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}
function streamShellLibraryLinkKeys(item, type) {
    const year = streamShellLibraryYear(item);
    if (!year) return [];
    const titles = [item.title, item.originalTitle, item.nativeTitle]
        .map(streamShellLibraryTitleKey).filter(Boolean);
    return [...new Set(titles)].map(title => `${type}:${year}:${title}`);
}
function streamShellLinkLibraryEntries(tmdbItems, externalItems) {
    const tmdbRows = tmdbItems.map(media => ({kind:"tmdb",media}));
    const nativeRows = externalItems.map(media => ({kind:"external",media}));
    const index = new Map();
    for (let i=0; i<tmdbItems.length; i++) {
        const tmdb = tmdbItems[i];
        for (const key of streamShellLibraryLinkKeys(tmdb, tmdb.mediaType)) {
            if (!index.has(key)) index.set(key,new Set());
            index.get(key).add(i);
        }
    }
    const candidates = new Map();
    const usedTmdb = new Map();
    for (let i=0; i<externalItems.length; i++) {
        const external = externalItems[i];
        if (external.source !== "anilist" || external.mediaType !== "anime" ||
            !Number.isInteger(external.anilistId)) continue;
        const type = String(external.format || "").toUpperCase() === "MOVIE" ? "movie" : "tv";
        const matches = new Set();
        for (const key of streamShellLibraryLinkKeys(external, type))
            for (const match of index.get(key) || []) matches.add(match);
        if (matches.size !== 1) continue; // ambiguous title: do not guess
        const match = [...matches][0];
        candidates.set(i,match);
        usedTmdb.set(match,(usedTmdb.get(match) || 0)+1);
    }
    const paired = new Set();
    for (const [externalIndex,tmdbIndex] of candidates) {
        if (usedTmdb.get(tmdbIndex) !== 1) continue;
        const external = externalItems[externalIndex];
        tmdbRows[tmdbIndex] = {kind:"linked",media:tmdbItems[tmdbIndex],anilist:external};
        paired.add(externalIndex);
    }
    return [...tmdbRows,...nativeRows.filter((_,i)=>!paired.has(i))];
}
function streamShellSortedLibrary(tmdbItems,externalItems) {
    const mode = watchlistSort.value || "added-desc";
    const out = streamShellLinkLibraryEntries(tmdbItems,externalItems);
    const title = row => String(row.media.title || "");
    const year = row => streamShellLibraryYear(row.media) || 0;
    // Preserve the original TMDB addition date when AniList enriches it.
    const date = row => Number(row.media.addedAt) || 0;
    out.sort((a,b) => {
        if (mode === "title-asc") return title(a).localeCompare(title(b));
        if (mode === "title-desc") return title(b).localeCompare(title(a));
        if (mode === "release-desc") return year(b)-year(a) || title(a).localeCompare(title(b));
        if (mode === "release-asc") return year(a)-year(b) || title(a).localeCompare(title(b));
        return mode === "added-asc" ? date(a)-date(b) : date(b)-date(a);
    });
    return out;
}

function streamShellLinkedMediaRow(tmdb, anilist) {
    // Reuse the TMDB card, including selection and JustWatch availability.
    const row = createMediaItem(tmdb,{mode:"watchlist",saved:true,addedAt:tmdb.addedAt});
    row.classList.add("ss-library-linked");
    const cover = streamShellAniListCover(anilist,"ss-anilist-cover") ||
        createElement("div","ss-anilist-cover ss-anilist-cover-empty","◈");
    const main = row.querySelector(".media-item-main");
    row.insertBefore(cover,main);
    const type = main.querySelector(".media-item-type");
    if (type) type.textContent = tmdb.mediaType === "movie" ? "ANIME MOVIE" : "ANIME · SERIES";
    const meta = main.querySelector(".media-item-meta");
    if (meta) {
        const stats = ["TMDB + AniList",anilist.episodes ? `${anilist.episodes} episodes` : null,
            anilist.score != null ? `AniList ${anilist.score}%` : null].filter(Boolean);
        meta.appendChild(createElement("span","ss-library-linked-meta",stats.join(" · ")));
    }
    const actions = row.querySelector(".media-item-actions");
    const details = createElement("button","media-item-action","ⓘ");
    details.type = "button";
    details.title = "AniList metadata";
    details.setAttribute("aria-expanded","false");
    const panel = streamShellAniListDetails(anilist);
    panel.hidden = true;
    details.addEventListener("click",() => {
        panel.hidden = !panel.hidden;
        details.setAttribute("aria-expanded",String(!panel.hidden));
    });
    const mangayomi = streamShellMangayomiSearchButton(anilist.title, "anime");
    actions.prepend(details);
    if (mangayomi) actions.prepend(mangayomi);
    row.appendChild(panel);
    // Deleting the TMDB entry leaves the AniList entry saved, intentionally.
    // Nothing is silently removed from either store.
    return row;
}

async function showWatchlist(
    customSubtitle =
        null
) {
    openPanel(
        "watchlist"
    );


    // Render the filter before the asynchronous cache refresh. Never flash
    // the old "Saved locally…" subtitle while opening the Library.
    const toolbar = streamShellLibraryToolbar();
    const filters = toolbar.firstElementChild;
    mediaPanelSubtitle.replaceChildren(filters);

    await refreshWatchlistCache();
    const externalItems = await window.StreamShellExternalLibrary.getAll();
    const tmdbItems = getSortedWatchlistItems();
    const nativeItems = externalItems;
    const visibleRows = streamShellSortedLibrary(tmdbItems,nativeItems)
        .filter(streamShellLibraryMatchesType);
    const manualAdd = Array.from(toolbar.children).find(el => el.classList?.contains("ss-library-add"));

    if (!visibleRows.length) {
        renderPanelMessage("No titles in the selected types",
            "Select another type above, or deselect all types to show everything.", { icon: "♡" });
        if (manualAdd) mediaPanelBody.prepend(manualAdd);
        return;
    }


    const list =
        createElement(
            "div",
            "media-list"
        );


    for (const row of visibleRows) {
        list.appendChild(row.kind === "linked"
            ? streamShellLinkedMediaRow(row.media,row.anilist)
            : row.kind === "tmdb"
                ? createMediaItem(row.media, {mode:"watchlist", saved:true, addedAt:row.media.addedAt})
                : streamShellExternalMediaRow(row.media));
    }
    mediaPanelBody.replaceChildren(...(manualAdd ? [manualAdd] : []), list);
}


/*
 * ============================================================
 * CONTINUE WATCHING
 * ============================================================
 */

function formatPlaybackTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}


function createContinueWatchingItem(item) {
    const row = createElement("article", "media-item continue-watching-item");

    const providerIcon = createElement("button", "continue-provider-icon");
    providerIcon.type = "button";
    providerIcon.dataset.resumeContinue = item.id;
    providerIcon.title = `Resume on ${PROVIDER_NAMES[item.provider] || item.provider}`;

    const image = document.createElement("img");
    image.src = `../assets/providers/icons/${item.provider}.svg`;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    providerIcon.appendChild(image);

    const main = createElement("button", "media-item-main continue-watching-main");
    main.type = "button";
    main.dataset.resumeContinue = item.id;

    const titleRow = createElement("div", "media-item-title-row");
    titleRow.append(
        createElement("span", "media-item-title", item.title),
        createElement("span", "media-item-type", PROVIDER_NAMES[item.provider] || item.provider)
    );

    const progress = Number(item.progressPercent);
    const meta = createElement("div", "media-item-meta");
    meta.append(
        createElement("span", "", `${Number.isFinite(progress) ? progress.toFixed(1) : "—"}% watched`),
        createElement("span", "", `${formatPlaybackTime(item.currentTime)} / ${formatPlaybackTime(item.duration)}`),
        createElement("span", "", `Updated ${formatDateTime(item.updatedAt)}`)
    );

    const track = createElement("div", "continue-progress-track");
    const fill = createElement("div", "continue-progress-fill");
    fill.style.width = `${Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0}%`;
    track.appendChild(fill);

    main.append(titleRow, meta, track);

    const actions = createElement("div", "media-item-actions");
    const remove = createElement("button", "media-item-action remove", "×");
    remove.type = "button";
    remove.dataset.removeContinue = item.id;
    remove.title = "Remove from Continue Watching";
    actions.appendChild(remove);

    row.append(providerIcon, main, actions);
    return row;
}


function renderContinueWatchingSubtitle(completePercent) {
    mediaPanelSubtitle.replaceChildren();
    mediaPanelSubtitle.append(
        document.createTextNode("Resume across providers · completed at ")
    );

    const input = document.createElement("input");
    input.type = "number";
    input.className = "continue-complete-percent-input";
    input.min = "1";
    input.max = "100";
    input.step = "1";
    input.inputMode = "numeric";
    input.value = String(completePercent);
    input.setAttribute("aria-label", "Continue Watching completion percentage");
    input.title = "Completion threshold (1–100%)";

    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
        // Keep the field freely editable while focused. In particular, an
        // empty value must remain possible so the existing number can be
        // replaced without fighting an eager minimum-value clamp.
        if (input.value === "") return;

        const numeric = Number(input.value);
        if (!Number.isFinite(numeric)) return;
        if (numeric > 100) input.value = "100";
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            input.blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            input.value = String(completePercent);
            input.blur();
        }
    });
    input.addEventListener("change", async () => {
        const next = await window.StreamShellContinueWatching.setCompletePercent(
            input.value
        );
        input.value = String(next);
        await showContinueWatching();
    });

    mediaPanelSubtitle.append(
        input,
        document.createTextNode("%")
    );
}


async function showContinueWatching() {
    openPanel("continue");

    const completePercent = await window.StreamShellContinueWatching.getCompletePercent();
    renderContinueWatchingSubtitle(completePercent);
    await refreshContinueWatchingCache();

    if (continueWatchingItems.length === 0) {
        renderPanelMessage(
            "Nothing waiting to resume",
            `Titles appear here automatically while you watch through Stream Shell and disappear at ${completePercent}%.`,
            { icon: "▶" }
        );
        return;
    }

    const list = createElement("div", "media-list");
    for (const item of continueWatchingItems) {
        list.appendChild(createContinueWatchingItem(item));
    }
    mediaPanelBody.replaceChildren(list);
}


async function resumeContinueWatching(id) {
    const item = continueWatchingItems.find(entry => entry.id === id);
    if (!item) return;

    const response = await chrome.runtime.sendMessage({
        type: "landing-resume-provider",
        provider: item.provider,
        url: item.url,
        currentTime: item.currentTime,
        identity: item.id
    });

    if (response?.ok === false) {
        throw new Error(response.error || "Continue Watching resume failed.");
    }
}


async function removeContinueWatching(id) {
    await window.StreamShellContinueWatching.removeById(id);
    await showContinueWatching();
}


/*
 * ============================================================
 * RECENT
 * ============================================================
 */

async function showRecent() {
    openPanel(
        "recent"
    );


    mediaPanelSubtitle.textContent =
        "Last 10 titles opened through Stream Shell";


    await refreshRecentCache();


    if (
        recentItems.length ===
        0
    ) {
        renderPanelMessage(
            "Nothing opened yet",
            "Titles appear here after Stream Shell opens them through one of the providers.",
            {
                icon:
                    "↻"
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
        of recentItems
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "recent",

                    openedAt:
                        media.openedAt,

                    openedProvider:
                        media.provider
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


/*
 * ============================================================
 * DIRECT LINKS
 * ============================================================
 */

function createDirectLinkItem(
    item
) {
    const row =
        createElement(
            "article",
            "media-item direct-link-item"
        );


    const launch =
        createElement(
            "button",
            "direct-link-launch",
            "↗"
        );


    launch.type =
        "button";


    launch.dataset.openDirectLink =
        item.url;


    launch.title =
        "Open in regular Opera";


    const main =
        createElement(
            "div",
            "media-item-main direct-link-main"
        );


    const titleRow =
        createElement(
            "div",
            "media-item-title-row"
        );


    titleRow.append(
        createElement(
            "span",
            "media-item-title",
            item.title
        ),

        createElement(
            "span",
            "media-item-type",
            "Direct"
        )
    );


    const meta =
        createElement(
            "div",
            "media-item-meta"
        );


    meta.appendChild(
        createElement(
            "span",
            "",
            `Saved ${formatDateTime(
                item.savedAt
            )}`
        )
    );


    if (
        item.host
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                item.host
            )
        );
    }


    const link =
        createElement(
            "button",
            "direct-link-url",
            item.url
        );


    link.type =
        "button";


    link.dataset.openDirectLink =
        item.url;


    link.title =
        item.url;


    main.append(
        titleRow,
        meta,
        link
    );


    const actions =
        createElement(
            "div",
            "media-item-actions"
        );


    const remove =
        createElement(
            "button",
            "media-item-action remove",
            "×"
        );


    remove.type =
        "button";


    remove.dataset.removeDirectLink =
        item.url;


    remove.title =
        "Remove direct link";


    actions.appendChild(
        remove
    );


    row.append(
        launch,
        main,
        actions
    );


    return row;
}


async function showDirectLinks() {
    openPanel(
        "direct"
    );


    mediaPanelSubtitle.textContent =
        "Saved from Opera · opens outside Stream Shell";


    await refreshDirectLinkCache();


    if (
        directLinkItems.length ===
        0
    ) {
        renderPanelMessage(
            "No direct links saved",
            "Use the Stream Shell extension button in Opera and choose ‘Save current page’. Direct links are stored locally with the Watchlist.",
            {
                icon:
                    "↗"
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
        const item
        of directLinkItems
    ) {
        list.appendChild(
            createDirectLinkItem(
                item
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


async function removeDirectLink(
    url
) {
    await window
        .StreamShellDirectLinks
        .remove(
            url
        );


    await showDirectLinks();
}


async function openDirectLink(
    url
) {
    const response =
        await chrome.runtime.sendMessage({
            type:
                "open-direct-link",

            url
        });


    if (
        response?.ok ===
        false
    ) {
        throw new Error(
            response.error ||
            "Direct link could not be opened."
        );
    }
}


/*
 * ============================================================
 * WATCHLIST MODIFICATION
 * ============================================================
 */

async function removeWatchlistItem(
    key
) {
    const media =
        findWatchlistMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    await window
        .StreamShellWatchlist
        .remove(
            media
        );


    if (
        selectedMediaKey ===
        key
    ) {
        selectedMediaKey =
            null;


        await window
            .StreamShellAvailability
            .clearSelectedMedia();
    }


    await showWatchlist();
}


async function toggleWatchlistForSearch(
    key
) {
    const media =
        findSearchMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    const savedNow = await window
        .StreamShellWatchlist
        .toggle(
            media
        );
    if (savedNow) void streamShellEnrichTmdbMedia(media);


    await refreshWatchlistCache();


    if (
        activePanel ===
        "search"
    ) {
        renderSearchResults(
            searchResults,
            searchGeneration
        );
    }
}


