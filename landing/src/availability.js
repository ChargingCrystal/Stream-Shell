/*
 * ============================================================
 * AVAILABILITY
 * ============================================================
 */

function renderProviderState(
    container,
    availability
) {
    container.replaceChildren();


    if (
        !availability
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-loading",
                "Checking streaming providers..."
            )
        );

        return;
    }


    if (
        availability.error ===
        "token"
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-error",
                "TMDB access required"
            )
        );

        return;
    }


    if (
        availability.error
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-error",
                "Availability could not be loaded"
            )
        );

        return;
    }


    if (
        !availability.regionAvailable ||
        availability.providers.length ===
            0
    ) {
        container.appendChild(
            createElement(
                "span",
                "provider-none",
                "No current provider found"
            )
        );

        return;
    }


    for (
        const provider
        of availability.providers
    ) {
        const chip =
            createElement(
                "span",
                "provider-chip"
            );


        chip.appendChild(
            createElement(
                "span",
                "provider-chip-name",
                provider.name
            )
        );


        if (
            provider.modeLabels.length >
            0
        ) {
            chip.appendChild(
                createElement(
                    "span",
                    "provider-chip-mode",
                    provider
                        .modeLabels
                        .join("/")
                )
            );
        }


        container.appendChild(
            chip
        );
    }
}


async function loadAvailabilityIntoRow(
    row,
    media,
    generation = null,
    force = false
) {
    const providerContainer =
        row.querySelector(
            ".media-item-providers"
        );


    const refreshButton =
        row.querySelector(
            ".media-item-refresh"
        );


    if (
        !providerContainer
    ) {
        return null;
    }


    renderProviderState(
        providerContainer,
        null
    );


    refreshButton
        ?.classList
        .add(
            "loading"
        );


    try {
        const availability =
            force
                ? await window
                    .StreamShellAvailability
                    .refreshAvailability(
                        media
                    )
                : await window
                    .StreamShellAvailability
                    .getAvailability(
                        media
                    );


        if (
            generation !==
                null &&
            generation !==
                searchGeneration
        ) {
            return null;
        }


        if (
            !row.isConnected
        ) {
            return null;
        }


        renderProviderState(
            providerContainer,
            availability
        );


        row.__streamShellAvailability =
            availability;


        if (
            force &&
            selectedMediaKey ===
                getMediaKey(
                    media
                )
        ) {
            await window
                .StreamShellAvailability
                .selectMedia(
                    media,
                    availability
                );
        }


        return availability;

    } catch (error) {

        console.error(
            "Availability lookup failed:",
            error
        );


        if (
            generation !==
                null &&
            generation !==
                searchGeneration
        ) {
            return null;
        }


        const errorState = {
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


        if (
            row.isConnected
        ) {
            renderProviderState(
                providerContainer,
                errorState
            );


            row.__streamShellAvailability =
                errorState;
        }


        return errorState;

    } finally {

        refreshButton
            ?.classList
            .remove(
                "loading"
            );
    }
}


