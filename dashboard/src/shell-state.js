
let twitchWorkspaceBackdrop = null;

function ensureTwitchWorkspaceBackdrop() {
    if (twitchWorkspaceBackdrop?.isConnected) return twitchWorkspaceBackdrop;

    twitchWorkspaceBackdrop = document.createElement("section");
    twitchWorkspaceBackdrop.id = "twitch-workspace-backdrop";
    twitchWorkspaceBackdrop.className = "twitch-workspace-backdrop";
    twitchWorkspaceBackdrop.hidden = true;
    twitchWorkspaceBackdrop.setAttribute("aria-label", "Twitch Workspace");

    twitchWorkspaceBackdrop.addEventListener("click", async event => {
        const button = event.target?.closest?.("button[data-workspace-action]");
        if (!button) return;
        const cell = button.closest(".twitch-workspace-cell");
        const slotId = cell?.dataset?.slotId;
        const input = cell?.querySelector("input[data-workspace-input]");
        const error = cell?.querySelector(".twitch-workspace-empty-error");
        if (!slotId || !input) return;

        const value = String(input.value || "").trim();
        if (!value) {
            if (error) error.textContent = "Channel or Twitch URL required.";
            input.focus();
            return;
        }

        if (error) error.textContent = "";
        button.disabled = true;
        try {
            const response = await chrome.runtime.sendMessage({
                type: "twitch-workspace-v2-assign-slot",
                slotId,
                input: value,
                kind: button.dataset.workspaceAction === "page" ? "page" : "stream"
            });
            if (!response?.ok) throw new Error(response?.error || "Could not create Twitch slot.");
        } catch (e) {
            if (error) error.textContent = String(e?.message || e || "Could not create Twitch slot.");
        } finally {
            button.disabled = false;
        }
    });

    document.querySelector(".dashboard")?.appendChild(twitchWorkspaceBackdrop);
    return twitchWorkspaceBackdrop;
}

function renderTwitchWorkspaceBackdrop(state, rightMode) {
    const host = ensureTwitchWorkspaceBackdrop();

    /*
     * 0.19.1 moved empty-cell controls into their own top-level slot windows.
     * Dashboard is now only a cover surface and must never become a second,
     * competing Twitch workspace UI underneath/above the real compositor.
     */
    host.hidden = true;
    host.replaceChildren();
}



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


    renderTwitchWorkspaceBackdrop(state, rightMode);


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