/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function getMediaKey(
    media
) {
    return `${media.mediaType}:${media.id}`;
}


function createElement(
    tagName,
    className = "",
    text = ""
) {
    const element =
        document.createElement(
            tagName
        );


    if (
        className
    ) {
        element.className =
            className;
    }


    if (
        text
    ) {
        element.textContent =
            text;
    }


    return element;
}


function createSvgElement(
    name,
    attributes = {}
) {
    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );


    for (
        const [key, value]
        of Object.entries(
            attributes
        )
    ) {
        element.setAttribute(
            key,
            String(
                value
            )
        );
    }


    return element;
}


function createBookmarkIcon() {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M6 3.75C6 2.78 6.78 2 7.75 2H16.25C17.22 2 18 2.78 18 3.75V21L12 17.25L6 21Z",

                fill:
                    "none",

                stroke:
                    "currentColor",

                "stroke-width":
                    "1.7",

                "stroke-linejoin":
                    "round"
            }
        )
    );


    return svg;
}


function createRefreshIcon() {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M19 8.5A7.5 7.5 0 1 0 19.2 15"
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M19 4.5V8.5H15"
            }
        )
    );


    return svg;
}


function formatReleaseDate(
    media
) {
    const raw =
        String(
            media.releaseDate ||
            ""
        );


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            raw
        )
    ) {
        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric"
            }
        ).format(
            new Date(
                `${raw}T00:00:00`
            )
        );
    }


    return media.year ||
        "Unknown";
}


function formatDateTime(
    timestamp
) {
    const value =
        Number(
            timestamp
        );


    if (
        !value
    ) {
        return "Unknown";
    }


    return new Intl.DateTimeFormat(
        "en-GB",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(
        new Date(
            value
        )
    );
}


function getReleaseSortValue(
    media
) {
    const raw =
        String(
            media.releaseDate ||
            ""
        );


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            raw
        )
    ) {
        return Date.parse(
            `${raw}T00:00:00`
        ) ||
        0;
    }


    return Number(
        media.year
    ) ||
    0;
}


function getSortedWatchlistItems() {
    const items = [
        ...watchlistItems
    ];


    switch (
        watchlistSortMode
    ) {
        case "added-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        a.addedAt
                    ) -
                    Number(
                        b.addedAt
                    )
            );


        case "title-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a.title ||
                        ""
                    ).localeCompare(
                        String(
                            b.title ||
                            ""
                        ),
                        "en",
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );


        case "title-desc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    String(
                        b.title ||
                        ""
                    ).localeCompare(
                        String(
                            a.title ||
                            ""
                        ),
                        "en",
                        {
                            sensitivity:
                                "base"
                        }
                    )
            );


        case "release-desc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    getReleaseSortValue(
                        b
                    ) -
                    getReleaseSortValue(
                        a
                    )
            );


        case "release-asc":

            return items.sort(
                (
                    a,
                    b
                ) =>
                    getReleaseSortValue(
                        a
                    ) -
                    getReleaseSortValue(
                        b
                    )
            );


        case "added-desc":
        default:

            return items.sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.addedAt
                    ) -
                    Number(
                        a.addedAt
                    )
            );
    }
}


/*
 * ============================================================
 * PANEL
 * ============================================================
 */

function renderPanelMessage(
    title,
    text,
    {
        icon = "—",
        error = false
    } = {}
) {
    mediaPanelBody.replaceChildren();


    const wrapper =
        createElement(
            "div",
            `panel-message${
                error
                    ? " error"
                    : ""
            }`
        );


    const inner =
        createElement(
            "div",
            "panel-message-inner"
        );


    inner.append(
        createElement(
            "div",
            "panel-message-icon",
            icon
        ),

        createElement(
            "div",
            "panel-message-title",
            title
        ),

        createElement(
            "div",
            "panel-message-text",
            text
        )
    );


    wrapper.appendChild(
        inner
    );


    mediaPanelBody.appendChild(
        wrapper
    );
}


function updatePanelControls() {
    const libraryOpen =
        !mediaPanel.hidden &&
        (
            activePanel ===
                "watchlist" ||
            activePanel ===
                "continue" ||
            activePanel ===
                "recent" ||
            activePanel ===
                "direct"
        );


    const searchOpen =
        !mediaPanel.hidden &&
        activePanel ===
            "search";


    watchlistToggle.classList.toggle(
        "active",
        libraryOpen
    );


    searchControl.classList.toggle(
        "active",
        searchOpen
    );


    watchlistToggle.setAttribute(
        "aria-expanded",
        String(
            libraryOpen
        )
    );


    libraryHeaderControls.hidden =
        !libraryOpen;


    searchHeaderTitle.hidden =
        !searchOpen;


    watchlistSortWrapper.hidden =
        activePanel !==
            "watchlist" ||
        mediaPanel.hidden;


    watchlistTab.classList.toggle(
        "active",
        activePanel ===
            "watchlist"
    );


    continueTab.classList.toggle(
        "active",
        activePanel ===
            "continue"
    );


    recentTab.classList.toggle(
        "active",
        activePanel ===
            "recent"
    );


    directTab.classList.toggle(
        "active",
        activePanel ===
            "direct"
    );
}


function openPanel(
    mode
) {
    activePanel =
        mode;


    if (
        mode ===
            "watchlist" ||
        mode ===
            "continue" ||
        mode ===
            "recent" ||
        mode ===
            "direct"
    ) {
        lastLibraryPanel =
            mode;
    }


    mediaPanel.hidden =
        false;


    updatePanelControls();
}


function closePanel() {
    mediaPanel.hidden =
        true;


    activePanel =
        null;


    updatePanelControls();
}


/*
 * ============================================================
 * SORTING
 * ============================================================
 */

async function loadWatchlistSortPreference() {
    const stored =
        await chrome.storage.local.get(
            WATCHLIST_SORT_KEY
        );


    const value =
        stored[
            WATCHLIST_SORT_KEY
        ];


    if (
        VALID_WATCHLIST_SORTS.has(
            value
        )
    ) {
        watchlistSortMode =
            value;
    }


    watchlistSort.value =
        watchlistSortMode;
}


async function saveWatchlistSortPreference(
    value
) {
    if (
        !VALID_WATCHLIST_SORTS.has(
            value
        )
    ) {
        return;
    }


    watchlistSortMode =
        value;


    watchlistSort.value =
        value;


    await chrome.storage.local.set({
        [WATCHLIST_SORT_KEY]:
            value
    });
}


