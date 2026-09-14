/*
 * ============================================================
 * SELECT MEDIA
 * ============================================================
 */

async function selectMediaByKey(
    key
) {
    /*
     * ============================================================
     * DESELECT CURRENT MEDIA
     * ============================================================
     *
     * Clicking the currently selected title again clears the
     * selection completely.
     */

    if (
        selectedMediaKey ===
        key
    ) {
        selectedMediaKey =
            null;


        await window
            .StreamShellAvailability
            .clearSelectedMedia();


        mediaPanelBody
            .querySelectorAll(
                ".media-item.selected"
            )
            .forEach(
                item => {
                    item.classList.remove(
                        "selected"
                    );
                }
            );


        return;
    }


    const media =
        findVisibleMedia(
            key
        );


    if (
        !media
    ) {
        return;
    }


    const row =
        mediaPanelBody.querySelector(
            `.media-item[data-media-key="${CSS.escape(
                key
            )}"]`
        );


    let availability =
        row
            ?.__streamShellAvailability ||
        null;


    if (
        !availability ||
        availability.error
    ) {
        try {
            availability =
                await window
                    .StreamShellAvailability
                    .getAvailability(
                        media
                    );

        } catch (error) {

            console.error(
                "Selected media availability failed:",
                error
            );


            availability = {
                error:
                    (
                        error?.code ===
                            "TMDB_TOKEN_MISSING" ||
                        error?.code ===
                            "TMDB_TOKEN_INVALID"
                    )
                        ? "token"
                        : "generic"
            };
        }
    }


    selectedMediaKey =
        key;


    await window
        .StreamShellAvailability
        .selectMedia(
            media,
            availability
        );


    mediaPanelBody
        .querySelectorAll(
            ".media-item"
        )
        .forEach(
            item => {
                item.classList.toggle(
                    "selected",

                    item.dataset.mediaKey ===
                        key
                );
            }
        );
}


/*
 * ============================================================
 * MANUAL REFRESH
 * ============================================================
 */

async function refreshMediaAvailability(
    key,
    button
) {
    const media =
        findVisibleMedia(
            key
        );


    const row =
        button.closest(
            ".media-item"
        );


    if (
        !media ||
        !row
    ) {
        return;
    }


    await loadAvailabilityIntoRow(
        row,
        media,
        null,
        true
    );
}


/*
 * ============================================================
 * SELECTED STATE
 * ============================================================
 */

async function loadSelectedMediaState() {
    const key =
        window
            .StreamShellAvailability
            .SELECTED_MEDIA_KEY;


    const stored =
        await chrome.storage.local.get(
            key
        );


    const media =
        stored[
            key
        ];


    selectedMediaKey =
        media
            ? getMediaKey(
                media
            )
            : null;
}


