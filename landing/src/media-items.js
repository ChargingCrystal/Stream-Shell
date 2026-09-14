/*
 * ============================================================
 * MEDIA ITEMS
 * ============================================================
 */

function createMediaItem(
    media,
    {
        mode,
        saved = false,
        addedAt = null,
        openedAt = null,
        openedProvider = "",
        generation = null
    }
) {
    const key =
        getMediaKey(
            media
        );


    const row =
        createElement(
            "article",
            "media-item"
        );


    row.dataset.mediaKey =
        key;


    row.classList.toggle(
        "selected",
        key ===
            selectedMediaKey
    );


    /*
     * Refresh button left of title.
     */

    const refresh =
        createElement(
            "button",
            "media-item-refresh"
        );


    refresh.type =
        "button";


    refresh.dataset.refreshAvailability =
        key;


    refresh.title =
        "Refresh availability";


    refresh.setAttribute(
        "aria-label",
        `Refresh availability for ${media.title}`
    );


    refresh.appendChild(
        createRefreshIcon()
    );


    /*
     * Main title area.
     */

    const main =
        createElement(
            "button",
            "media-item-main"
        );


    main.type =
        "button";


    main.dataset.selectMedia =
        key;


    const titleRow =
        createElement(
            "div",
            "media-item-title-row"
        );


    titleRow.append(
        createElement(
            "span",
            "media-item-title",
            media.title
        ),

        createElement(
            "span",
            "media-item-type",
            MEDIA_TYPE_NAMES[
                media.mediaType
            ] ||
            media.mediaType
        )
    );


    const meta =
        createElement(
            "div",
            "media-item-meta"
        );


    if (
        mode ===
        "watchlist"
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                `Added ${formatDateTime(
                    addedAt
                )}`
            )
        );


        if (
            media.releaseDate ||
            media.year
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `Released ${formatReleaseDate(
                        media
                    )}`
                )
            );
        }

    } else if (
        mode ===
        "recent"
    ) {
        meta.appendChild(
            createElement(
                "span",
                "",
                `Opened ${formatDateTime(
                    openedAt
                )}`
            )
        );


        if (
            openedProvider
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `via ${
                        PROVIDER_NAMES[
                            openedProvider
                        ] ||
                        openedProvider
                    }`
                )
            );
        }


        if (
            media.releaseDate ||
            media.year
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `Released ${formatReleaseDate(
                        media
                    )}`
                )
            );
        }

    } else {

        meta.appendChild(
            createElement(
                "span",
                "",
                `Released ${formatReleaseDate(
                    media
                )}`
            )
        );


        if (
            Number.isFinite(
                media.rating
            ) &&
            media.rating >
                0
        ) {
            meta.appendChild(
                createElement(
                    "span",
                    "",
                    `TMDB ${media.rating.toFixed(
                        1
                    )}`
                )
            );
        }
    }


    main.append(
        titleRow,
        meta
    );


    if (
        media.originalTitle &&
        media.originalTitle !==
            media.title
    ) {
        main.appendChild(
            createElement(
                "div",
                "media-item-original",
                media.originalTitle
            )
        );
    }


    const providers =
        createElement(
            "div",
            "media-item-providers"
        );


    main.appendChild(
        providers
    );


    /*
     * Right actions.
     */

    const actions =
        createElement(
            "div",
            "media-item-actions"
        );


    if (
        mode ===
        "search"
    ) {
        const bookmark =
            createElement(
                "button",
                `media-item-action${
                    saved
                        ? " saved"
                        : ""
                }`
            );


        bookmark.type =
            "button";


        bookmark.dataset.toggleWatchlist =
            key;


        bookmark.title =
            saved
                ? "Remove from Watchlist"
                : "Add to Watchlist";


        bookmark.appendChild(
            createBookmarkIcon()
        );


        actions.appendChild(
            bookmark
        );

    } else if (
        mode ===
        "watchlist"
    ) {
        const remove =
            createElement(
                "button",
                "media-item-action remove",
                "×"
            );


        remove.type =
            "button";


        remove.dataset.removeWatchlist =
            key;


        remove.title =
            "Remove from Watchlist";


        actions.appendChild(
            remove
        );
    }


    row.append(
        refresh,
        main,
        actions
    );


    loadAvailabilityIntoRow(
        row,
        media,
        generation
    );


    return row;
}


