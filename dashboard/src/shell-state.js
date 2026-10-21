
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

/* Twitch cold-launch placeholder. This listens only to explicit transitions;
 * there is no timer-driven polling and no browser/window/native diagnostics. */
let streamShellTwitchSkeletonId = 0;
let streamShellTwitchSkeletonTimer = null;
function ensureStreamShellTwitchSkeleton() {
    let surface = document.getElementById('stream-shell-twitch-skeleton');
    if (surface) return surface;
    surface = document.createElement('section');
    surface.id = 'stream-shell-twitch-skeleton';
    surface.className = 'stream-shell-twitch-skeleton';
    surface.hidden = true;
    surface.setAttribute('role','status');
    surface.setAttribute('aria-live','polite');
    /* Each placeholder owns its own header. The dashboard lives *behind*
     * four separate native Opera windows, so one shared header/grid gap gets
     * cut in half as A and B appear. Keep all visuals within their respective
     * 50% x 50% viewport cells instead. No window/Storage/native probes. */
    surface.innerHTML = `<span class="ss-ts-accessible-status ss-ts-stage">Preparing browser windows…</span>
    <div class="ss-ts-grid" aria-hidden="true">${['A','B','C','D'].map(letter => `<div class="ss-ts-card ss-ts-card-${letter.toLowerCase()}" data-slot="${letter.toLowerCase()}">
      <div class="ss-ts-head"><span class="ss-ts-dot"></span><div><strong>Twitch ${letter}</strong><p>Preparing workspace window…</p></div></div>
      <div class="ss-ts-shimmer ss-ts-video"></div>
      <div class="ss-ts-footer"><span class="ss-ts-shimmer ss-ts-avatar"></span><div class="ss-ts-lines"><span class="ss-ts-shimmer"></span><span class="ss-ts-shimmer"></span></div><span class="ss-ts-label">${letter}</span></div>
    </div>`).join('')}</div>`;
    document.querySelector('.dashboard')?.appendChild(surface);
    return surface;
}
function renderStreamShellTwitchSkeleton(message) {
    if (message?.surface !== 'twitch') return;
    const stage = message.stage;
    const id = Number(message.id) || 0;
    if (stage === 'done' || stage === 'failed') {
        if (id !== streamShellTwitchSkeletonId) return;
        clearTimeout(streamShellTwitchSkeletonTimer);
        const surface = document.getElementById('stream-shell-twitch-skeleton');
        if (surface) surface.hidden = true;
        return;
    }
    if (id < streamShellTwitchSkeletonId) return;
    streamShellTwitchSkeletonId = id;
    const surface = ensureStreamShellTwitchSkeleton();
    const text = surface.querySelector('.ss-ts-stage');
    if (text) text.textContent = stage === 'creating'
        ? 'Starting Twitch A–D, one window at a time…'
        : 'Waiting for the previous provider to settle…';
    clearTimeout(streamShellTwitchSkeletonTimer);
    // Skip a flash for warm sub-200ms transitions; cold launches always show.
    if (stage === 'waiting') {
        streamShellTwitchSkeletonTimer = setTimeout(() => {
            if (streamShellTwitchSkeletonId === id) surface.hidden = false;
        }, 180);
    } else surface.hidden = false;
}
chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'stream-shell-transition-visual') {
        renderStreamShellTwitchSkeleton(message);
    }
});

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


    const customProvider = getStreamShellProviderRegistry().providers.find(
        entry => entry.id === provider && entry.kind === "custom"
    );
    const customBackgroundPath = customProvider
        ? streamShellCustomArtworkPath(customProvider.artKey, backgroundVariant)
        : null;
    const neutralBackground = "radial-gradient(ellipse at 77% 20%, rgba(70, 79, 104, .21), transparent 62%), linear-gradient(135deg, #0b0e17, #03050a)";
    const backgroundPath = STREAM_SHELL_BUILTIN_IDS.has(provider)
        ? `assets/backgrounds/${provider}_${backgroundVariant}.png`
        : customBackgroundPath;
    panorama.style.backgroundImage = backgroundPath
        ? `url("${chrome.runtime.getURL(backgroundPath)}"), ${neutralBackground}`
        : neutralBackground;

    const wordmark = WORDMARKS[provider] ||
        (customProvider ? streamShellCustomArtworkPath(customProvider.artKey, "wordmark") : null);
    providerWordmark.onload = () => {
        if (document.body.dataset.provider !== provider) return;
        providerWordmark.hidden = false;
        providerCustomWordmark.hidden = true;
    };
    providerWordmark.onerror = () => {
        if (document.body.dataset.provider !== provider) return;
        providerWordmark.hidden = true;
        providerCustomWordmark.hidden = !customProvider;
    };
    providerCustomWordmark.textContent = customProvider?.name || "";
    providerCustomWordmark.hidden = !customProvider || Boolean(wordmark);
    providerWordmark.hidden = !wordmark;
    if (wordmark) {
        const nextSrc = chrome.runtime.getURL(wordmark);
        if (providerWordmark.src !== nextSrc) providerWordmark.src = nextSrc;
        else if (providerWordmark.complete && providerWordmark.naturalWidth > 0) {
            providerWordmark.hidden = false;
            providerCustomWordmark.hidden = true;
        } else if (providerWordmark.complete) {
            providerWordmark.hidden = true;
            providerCustomWordmark.hidden = !customProvider;
        }
    } else {
        providerWordmark.removeAttribute("src");
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