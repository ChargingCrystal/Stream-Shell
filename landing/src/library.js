/*
 * ============================================================
 * CACHES
 * ============================================================
 */

function updateWatchlistCount() {
    watchlistCount.textContent =
        String(
            watchlistItems.length +
            continueWatchingItems.length +
            directLinkItems.length
        );
}


async function refreshWatchlistCache() {
    watchlistItems =
        await window
            .StreamShellWatchlist
            .getAll();


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
 * WATCHLIST
 * ============================================================
 */

async function showWatchlist(
    customSubtitle =
        null
) {
    openPanel(
        "watchlist"
    );


    mediaPanelSubtitle.textContent =
        customSubtitle ||
        "Stored locally · availability checked live";


    await refreshWatchlistCache();


    if (
        watchlistItems.length ===
        0
    ) {
        renderPanelMessage(
            "Your Watchlist is empty",
            "Add movies and series from Search. The Watchlist is stored locally in Stream Shell.",
            {
                icon:
                    "♡"
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
        of getSortedWatchlistItems()
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "watchlist",

                    saved:
                        true,

                    addedAt:
                        media.addedAt
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


    await window
        .StreamShellWatchlist
        .toggle(
            media
        );


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


