/*
 * ============================================================
 * STREAM SHELL STATE
 * ============================================================
 */

chrome.runtime.sendMessage({
    type:
        "get-state"
})
    .then(
        renderState
    )
    .catch(
        () => {}
    );


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message.type ===
            "state-changed"
        ) {
            renderState(
                message
            );
            return;
        }


        if (
            message.type ===
            "dashboard-toggle-settings"
        ) {
            toggleSettingsCenter(
                message.provider
            ).catch(
                () => {}
            );
        }
    }
);


function renderState(
    state
) {
    if (
        !state
    ) {
        return;
    }


    let provider =
        state.activeProvider ||
        "netflix";


    if (
        !PROVIDERS.has(
            provider
        )
    ) {
        provider =
            "netflix";
    }


    const reportedLayoutProfile =
        state.layoutProfile === "compact"
            ? "compact"
            : (state.layoutProfile === "wide" ? "wide" : null);

    const reportedDisplayTarget =
        state.displayTarget === "16:9" || state.displayTarget === "16:10"
            ? state.displayTarget
            : null;

    /*
     * layoutProfile is session-stable for now (live dock reflow is explicitly
     * deferred). Only the initial get-state / explicit profile-bearing message
     * may touch this high-impact body attribute; ordinary state broadcasts no
     * longer trigger a full dashboard style invalidation.
     */
    if (reportedLayoutProfile) {
        document.body.dataset.layoutProfile = reportedLayoutProfile;

        if (reportedLayoutProfile === "compact" && reportedDisplayTarget) {
            document.body.dataset.compactTarget = reportedDisplayTarget;
        } else {
            delete document.body.dataset.compactTarget;
        }

        ensureCompactHomeRuntimeLoaded(reportedLayoutProfile).catch(() => {});
    }

    const layoutProfile =
        document.body.dataset.layoutProfile === "compact"
            ? "compact"
            : "wide";

    const leftMode =
        state.leftMode ||
        (layoutProfile === "compact" ? "dashboard" : "landing");


    const rightMode =
        state.rightMode ||
        "dashboard";


    currentLeftMode =
        leftMode;


    if (
        reloadLeftButton
    ) {
        setContextualControlVisible(
            reloadLeftSlot,
            reloadLeftButton,
            PROVIDERS.has(
                leftMode
            )
        );
    }


    const landingExposed =
        layoutProfile === "wide" &&
        state.landingExposed === true;


    brandArea.classList.toggle(
        "landing-exposed",
        landingExposed
    );


    document.body.dataset.provider =
        provider;


    const backgroundVariant =
        layoutProfile === "compact"
            ? "compact"
            : "wide";


    panorama.style.backgroundImage =
        `url("${chrome.runtime.getURL(
            `assets/backgrounds/${provider}_${backgroundVariant}.png`
        )}")`;


    const wordmark =
        WORDMARKS[
            provider
        ];


    if (
        wordmark
    ) {
        providerWordmark.src =
            chrome.runtime.getURL(
                wordmark
            );

    } else {

        providerWordmark.removeAttribute(
            "src"
        );
    }


    leftStatus.textContent =
        leftMode ===
            "landing"
            ? "Landing"
            : (
                PROVIDER_NAMES[
                    leftMode
                ] ||
                leftMode
            );


    rightStatus.textContent =
        RIGHT_MODE_NAMES[
            rightMode
        ] ||
        rightMode;


    requestAnimationFrame(
        () => {
            syncNowPlayingWidth();
            renderNowPlaying();
        }
    );


    document
        .querySelectorAll(
            ".provider-card[data-provider]"
        )
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.provider ===
                        provider
                );
            }
        );
}