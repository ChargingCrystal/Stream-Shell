/*
 * ============================================================
 * AVAILABILITY INDICATORS
 * ============================================================
 */

function ensureAvailabilityIndicators() {
    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                if (
                    button.querySelector(
                        ".provider-availability"
                    )
                ) {
                    return;
                }


                const indicator =
                    document.createElement(
                        "span"
                    );


                indicator.className =
                    "provider-availability";


                indicator.setAttribute(
                    "aria-hidden",
                    "true"
                );


                button.appendChild(
                    indicator
                );
            }
        );
}


function setAvailabilityIndicator(
    indicator,
    state
) {
    indicator.replaceChildren();


    indicator.className =
        `provider-availability visible ${state}`;


    indicator.appendChild(
        createAvailabilityIcon(
            state
        )
    );
}


function clearAvailabilityIndicators() {
    ensureAvailabilityIndicators();


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                const indicator =
                    button.querySelector(
                        ".provider-availability"
                    );


                indicator.replaceChildren();


                indicator.className =
                    "provider-availability";


                button.title =
                    PROVIDER_NAMES[
                        button.dataset.provider
                    ] ||
                    "";
            }
        );
}


function renderAvailabilityIndicators() {
    ensureAvailabilityIndicators();


    if (
        !selectedMedia
    ) {
        clearAvailabilityIndicators();

        return;
    }


    const dashboard =
        selectedAvailability
            ?.dashboard;


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                const provider =
                    button.dataset.provider;


                const indicator =
                    button.querySelector(
                        ".provider-availability"
                    );


                const status =
                    dashboard?.[
                        provider
                    ];


                if (
                    !status
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "unknown"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · Availability unknown`;


                    return;
                }


                if (
                    status.state ===
                    "available"
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "available"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · ${selectedMedia.title} available`;


                    return;
                }


                if (
                    status.state ===
                    "extra"
                ) {
                    setAvailabilityIndicator(
                        indicator,
                        "extra"
                    );


                    button.title =
                        `${PROVIDER_NAMES[
                            provider
                        ]} · ${selectedMedia.title} requires purchase, rental or add-on`;


                    return;
                }


                setAvailabilityIndicator(
                    indicator,
                    "unavailable"
                );


                button.title =
                    `${PROVIDER_NAMES[
                        provider
                    ]} · ${selectedMedia.title} not listed`;
            }
        );
}


