/* Compact Shell Home reuses the proven Landing media runtime in
 * an isolated scope. Wide never initializes or styles this block. */
(async function streamShellCompactHomeRuntime() {
    const compactBootState = await chrome.runtime.sendMessage({ type: "get-state" }).catch(() => null);
    if (compactBootState?.layoutProfile !== "compact") return;

    document.body.dataset.layoutProfile = "compact";

    const compactLandingStyles = document.getElementById("compact-home-landing-styles");
    if (compactLandingStyles) compactLandingStyles.disabled = false;

    const loadCompactHomeScript = (path) => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(path);
        script.async = false;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error(`compact-home-script-failed:${path}`)), { once: true });
        document.head.appendChild(script);
    });

    // These media helpers used to belong exclusively to Landing. Load them only
    // for Compact so Wide Dashboard keeps its pre-0.14 runtime/CSS surface.
    await Promise.all([
        "media/watchlist.js",
        "media/external-library.js",
        "media/anilist-api.js",
        "media/direct-links.js",
        "media/continue-watching.js",
        "media/availability.js",
    ].map(loadCompactHomeScript));
const PROVIDERS =
    new Set([
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll"
    ]);


const MEDIA_TYPE_NAMES = {
    movie:
        "Movie",

    tv:
        "Series"
};


const PROVIDER_NAMES = {
    youtube:
        "YouTube",

    netflix:
        "Netflix",

    prime:
        "Prime Video",

    disney:
        "Disney+",

    crunchyroll:
        "Crunchyroll",

    discord:
        "Discord"
};


const SUBSCRIPTION_STORAGE_KEY =
    "streamShellSubscriptions";


const SUBSCRIPTION_STATUS_LABELS = {
    active:
        "ACTIVE",

    ending:
        "ENDING",

    inactive:
        "INACTIVE",

    signin:
        "SIGN IN",

    verify:
        "VERIFY",

    unknown:
        "UNKNOWN"
};


const WATCHLIST_SORT_KEY =
    "streamShellWatchlistSort";


const PENDING_LANDING_PANEL_KEY =
    "streamShellPendingLandingPanel";


const VALID_WATCHLIST_SORTS =
    new Set([
        "added-desc",
        "added-asc",
        "title-asc",
        "title-desc",
        "release-desc",
        "release-asc"
    ]);


const panorama =
    document.getElementById(
        "panorama-background"
    );


const subscriptionSyncButton =
    document.getElementById(
        "subscription-sync"
    );


const subscriptionSyncMeta =
    document.getElementById(
        "subscription-sync-meta"
    );


const subscriptionItems =
    new Map(
        Array.from(
            document.querySelectorAll(
                "[data-subscription-provider]"
            )
        ).map(
            element => [
                element.dataset.subscriptionProvider,
                element
            ]
        )
    );


const watchlistToggle =
    document.getElementById(
        "watchlist-toggle"
    );


const watchlistCount =
    document.getElementById(
        "watchlist-count"
    );


const watchlistTab =
    document.getElementById(
        "watchlist-tab"
    );


const continueTab =
    document.getElementById(
        "continue-tab"
    );


const recentTab =
    document.getElementById(
        "recent-tab"
    );


const directTab =
    document.getElementById(
        "direct-tab"
    );


const libraryHeaderControls =
    document.getElementById(
        "library-header-controls"
    );


const searchHeaderTitle =
    document.getElementById(
        "search-header-title"
    );


const watchlistImportButton =
    document.getElementById(
        "watchlist-import"
    );


const watchlistExportButton =
    document.getElementById(
        "watchlist-export"
    );


const watchlistImportInput =
    document.getElementById(
        "watchlist-import-input"
    );


const watchlistSortWrapper =
    document.getElementById(
        "watchlist-sort-wrapper"
    );


const watchlistSort =
    document.getElementById(
        "watchlist-sort"
    );


const searchControl =
    document.getElementById(
        "search-control"
    );


const mediaSearchInput =
    document.getElementById(
        "media-search-input"
    );


const mediaSearchClear =
    document.getElementById(
        "media-search-clear"
    );


const mediaPanel =
    document.getElementById(
        "media-panel"
    );


const mediaPanelSubtitle =
    document.getElementById(
        "media-panel-subtitle"
    );


const mediaPanelBody =
    document.getElementById(
        "media-panel-body"
    );


const mediaPanelClose =
    document.getElementById(
        "media-panel-close"
    );


const tmdbTokenButton =
    document.getElementById(
        "tmdb-token-button"
    );


const restoreHomeLayoutButton =
    document.getElementById(
        "restore-home-layout"
    );


const discordButton =
    document.getElementById(
        "discord"
    );

const twitchUtility =
    document.getElementById(
        "twitch-utility"
    );

const twitchOpenButton =
    document.getElementById(
        "twitch-open"
    );

let activePanel =
    null;


let lastLibraryPanel =
    "watchlist";


let watchlistItems =
    [];


let continueWatchingItems =
    [];


let recentItems =
    [];


let directLinkItems =
    [];


let watchlistSortMode =
    "added-desc";


let searchResults =
    [];


let searchTimer =
    null;


let searchGeneration =
    0;


let selectedMediaKey =
    null;


/*
 * ============================================================
 * SUBSCRIPTIONS
 * ============================================================
 */

function getSubscriptionStatus(
    value
) {
    return Object.prototype.hasOwnProperty.call(
        SUBSCRIPTION_STATUS_LABELS,
        value
    )
        ? value
        : "unknown";
}


function formatSubscriptionSyncTime(
    timestamp
) {
    if (
        !Number.isFinite(
            timestamp
        )
    ) {
        return "Never synced";
    }


    try {
        return `Updated ${new Intl.DateTimeFormat(
            undefined,
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        ).format(
            new Date(
                timestamp
            )
        )}`;
    } catch {
        return "Updated";
    }
}


function renderSubscriptionState(
    state
) {
    // Compact intentionally has no subscription UI. Wide Landing still does.
    if (!subscriptionSyncMeta) return;
    const items =
        state?.items ||
        {};


    for (
        const [
            provider,
            element
        ] of subscriptionItems
    ) {
        const subscription =
            items[provider] ||
            {};


        const status =
            getSubscriptionStatus(
                subscription.status
            );


        const statusElement =
            element.querySelector(
                ".subscription-status"
            );


        const renewalElement =
            element.querySelector(
                ".subscription-renewal"
            );


        element.dataset.status =
            status;


        statusElement.textContent =
            SUBSCRIPTION_STATUS_LABELS[
                status
            ];


        let renewalText =
            "—";


        const billingSource =
            subscription.billingSource ||
            null;


        if (
            billingSource &&
            subscription.renewal
        ) {
            renewalText =
                `${billingSource} · ${subscription.renewal}`;
        } else if (
            billingSource
        ) {
            renewalText =
                billingSource;
        } else if (
            subscription.renewal
        ) {
            renewalText =
                subscription.renewal;
        } else if (
            status ===
            "verify"
        ) {
            renewalText =
                "Verify";
        } else if (
            status ===
            "signin"
        ) {
            renewalText =
                "Sign in";
        } else if (
            status ===
            "unknown"
        ) {
            renewalText =
                "No data";
        }


        renewalElement.textContent =
            renewalText;


        const dateAction =
            subscription.dateKind ===
                "ends"
                ? "Ends"
                : "Renews";


        const titleParts = [
            PROVIDER_NAMES[provider],
            SUBSCRIPTION_STATUS_LABELS[status]
        ];


        if (
            billingSource
        ) {
            titleParts.push(
                `Billing: ${billingSource}`
            );
        }


        if (
            subscription.renewal
        ) {
            titleParts.push(
                `${dateAction} ${subscription.renewal}`
            );
        }


        element.title =
            titleParts.join(
                " · "
            );
    }


    subscriptionSyncMeta.textContent =
        formatSubscriptionSyncTime(
            state?.updatedAt
        );
}


async function loadSubscriptionState() {
    if (!subscriptionSyncMeta) return;
    const stored =
        await chrome.storage.local.get(
            SUBSCRIPTION_STORAGE_KEY
        );


    renderSubscriptionState(
        stored[
            SUBSCRIPTION_STORAGE_KEY
        ]
    );
}


async function syncSubscriptions() {
    if (!subscriptionSyncButton || !subscriptionSyncMeta) return;
    subscriptionSyncButton.disabled =
        true;


    subscriptionSyncButton.classList.add(
        "syncing"
    );


    subscriptionSyncMeta.textContent =
        "Syncing account pages…";


    try {
        const response =
            await chrome.runtime.sendMessage({
                type:
                    "sync-subscriptions"
            });


        if (
            response?.ok ===
            false
        ) {
            throw new Error(
                response.error ||
                "Subscription sync failed."
            );
        }


        renderSubscriptionState(
            response?.state
        );
    } catch (error) {
        console.error(
            "Subscription sync failed:",
            error
        );


        subscriptionSyncMeta.textContent =
            "Sync failed";
    } finally {
        subscriptionSyncButton.classList.remove(
            "syncing"
        );


        subscriptionSyncButton.disabled =
            false;
    }
}


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


/*
 * ============================================================
 * TOKEN
 * ============================================================
 */

async function renderTokenSetup(
    afterSave = null
) {

    mediaPanelSubtitle.textContent =
        "Save your Read Access Token once";


    mediaPanelBody.replaceChildren();


    const wrapper =
        createElement(
            "div",
            "token-setup"
        );


    const card =
        createElement(
            "div",
            "token-setup-card"
        );


    const title =
        createElement(
            "div",
            "token-setup-title",
            "TMDB Read Access Token"
        );


    const text =
        createElement(
            "div",
            "token-setup-text",
            "Stream Shell uses TMDB for titles, metadata and JustWatch streaming availability. The token is stored locally in chrome.storage."
        );


    const row =
        createElement(
            "div",
            "token-input-row"
        );


    const input =
        createElement(
            "input",
            "tmdb-token-input"
        );


    input.type =
        "password";


    input.placeholder =
        "eyJhbGciOiJIUzI1NiJ9...";


    input.autocomplete =
        "off";


    const saveButton =
        createElement(
            "button",
            "tmdb-token-save",
            "Save"
        );


    saveButton.type =
        "button";


    const status =
        createElement(
            "div",
            "token-setup-status"
        );


    row.append(
        input,
        saveButton
    );


    card.append(
        title,
        text,
        row,
        status
    );


    wrapper.appendChild(
        card
    );


    mediaPanelBody.appendChild(
        wrapper
    );


    async function save() {
        const token =
            input.value.trim();


        if (
            !token
        ) {
            status.className =
                "token-setup-status error";


            status.textContent =
                "Paste a token first.";


            return;
        }


        saveButton.disabled =
            true;


        status.className =
            "token-setup-status";


        status.textContent =
            "Validating token...";


        try {
            await window
                .StreamShellMediaApi
                .saveToken(
                    token
                );


            status.className =
                "token-setup-status success";


            status.textContent =
                "Token validated and stored locally.";


            if (
                typeof afterSave ===
                "function"
            ) {
                setTimeout(
                    afterSave,
                    280
                );
            }

        } catch (error) {

            console.error(
                "TMDB token validation failed:",
                error
            );


            status.className =
                "token-setup-status error";


            status.textContent =
                error?.code ===
                    "TMDB_TOKEN_INVALID"
                    ? "TMDB rejected this token."
                    : "The token could not be validated.";

        } finally {

            saveButton.disabled =
                false;
        }
    }


    saveButton.addEventListener(
        "click",
        save
    );


    input.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                save();
            }
        }
    );


    input.focus();
}


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


/*
 * Mangayomi native search handoff and inline results.
 * Normal click queries opted-in installed sources in the background and renders
 * real results in the LEFT panel. Shift+click copies the title and switches to Mangayomi.
 * Selecting an opaque hit opens the corresponding Mangayomi detail in the fork.
 */
const STREAM_SHELL_MANGAYOMI_SEARCH_TYPES = new Set(["anime", "manga", "novel"]);

function streamShellMangayomiSearchTitle(title, mediaType) {
    if (!STREAM_SHELL_MANGAYOMI_SEARCH_TYPES.has(mediaType)) return "";
    if (typeof title !== "string") return "";
    return title.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 200);
}

async function streamShellCopyMangayomiTitle(title) {
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(title); return true; }
        catch { /* Try the legacy extension-page fallback. */ }
    }
    const field = document.createElement("textarea");
    field.value = title;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(field);
    try { field.focus(); field.select(); return document.execCommand("copy") === true; }
    catch { return false; }
    finally { field.remove(); }
}

function streamShellRenderMangayomiSourceResults(data) {
    if (!data?.ok || !Array.isArray(data.sources)) return;
    // This is a normal Search-panel view, never a floating window.
    openPanel("search");
    mediaPanelSubtitle.textContent = `${data.scannedCount ?? data.sources.length}/${data.sourceCount ?? data.sources.length} Mangayomi sources · ${data.sources.reduce((n, s) => n + (s.hits?.length || 0), 0)} results`;
    const root = document.createElement("div");
    root.className = "ss-mangayomi-results";
    const heading = document.createElement("div");
    heading.className = "ss-mangayomi-results-header";
    const title = document.createElement("strong");
    title.textContent = `Mangayomi · ${data.query}`;
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "← Back to search";
    back.addEventListener("click", () => {
        if (typeof scheduleSearch === "function") scheduleSearch(true);
        else closePanel();
    });
    heading.append(title, back);
    root.append(heading);
    const normalize = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const needle = normalize(data.query);
    for (const source of data.sources) {
        const hits = Array.isArray(source.hits) ? source.hits.slice(0, 12) : [];
        const group = document.createElement("details");
        group.className = "ss-mangayomi-source";
        group.open = hits.length > 0;
        const summary = document.createElement("summary");
        summary.textContent = `${source.name || "Unknown source"} · ${source.lang || "?"} · ${hits.length} results${source.status !== "ok" ? ` · ${source.status || "unknown"}` : ""}`;
        group.append(summary);
        hits.sort((x, y) => Number(normalize(y.title) === needle) - Number(normalize(x.title) === needle));
        for (const hit of hits) {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "ss-mangayomi-hit";
            const label = document.createElement("span");
            label.className = "ss-mangayomi-hit-text";
            const name = document.createElement("strong");
            name.textContent = hit.title || "Untitled";
            const meta = document.createElement("small");
            meta.textContent = normalize(hit.title) === needle ? "Exact title match" : "View source result";
            label.append(name, meta);
            if (typeof hit.imageUrl === "string" && /^https?:\/\//i.test(hit.imageUrl)) {
                const img = document.createElement("img");
                img.src = hit.imageUrl;
                img.alt = "";
                img.loading = "lazy";
                img.referrerPolicy = "no-referrer";
                row.append(img);
            }
            row.append(label);
            row.addEventListener("click", () => {
                // Explicit selection: only the opaque result ID may navigate.
                // Never pass source URLs to the Win32 helper.
                const selected = document.createElement("div");
                selected.className = "ss-mangayomi-selected";
                const chosen = document.createElement("strong");
                chosen.textContent = hit.title || "Untitled";
                const sourceName = document.createElement("p");
                sourceName.textContent = `Source: ${source.name || "Unknown"} · ${source.lang || "?"}`;
                const notice = document.createElement("p");
                notice.textContent = "Open this exact source result in Mangayomi, or copy its title.";
                const copy = document.createElement("button");
                copy.type = "button";
                copy.textContent = "Copy title";
                copy.addEventListener("click", () => void streamShellCopyMangayomiTitle(hit.title || ""));
                const open = document.createElement("button");
                open.type = "button";
                open.textContent = "Open this result";
                open.disabled = !/^[A-Za-z0-9_-]{22,40}$/.test(hit.resultId || "");
                open.title = open.disabled ? "Rebuild the patched Mangayomi fork to enable exact navigation" : "Open this selected source result";
                open.addEventListener("click", async () => {
                    if (open.disabled) return;
                    open.disabled = true;
                    notice.textContent = "Opening the selected source in Mangayomi…";
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type:"landing-mangayomi-open-result", resultId:hit.resultId
                        });
                        if (!response?.ok) throw new Error(response?.error || "Bridge navigation unavailable");
                        notice.textContent = response.pending
                            ? "Treffer übergeben. Mangayomi initialisiert sein Fenster noch; die Anzeige wird automatisch versucht."
                            : "Opened in Mangayomi.";
                    } catch (error) {
                        notice.textContent = `Could not open this result: ${error.message || error}`;
                    } finally { open.disabled = false; }
                });
                const backButton = document.createElement("button");
                backButton.type = "button";
                backButton.textContent = "← Results";
                backButton.addEventListener("click", () => mediaPanelBody.replaceChildren(root));
                const actions = document.createElement("div");
                actions.className = "ss-mangayomi-selected-actions";
                actions.append(copy, open, backButton);
                selected.append(chosen, sourceName, notice, actions);
                mediaPanelBody.replaceChildren(selected);
                // A chosen source opens immediately. Keep this detail view only
                // as a safe fallback if the old fork cannot handle /v1/open.
                if (!open.disabled) open.click();
            });
            group.append(row);
        }
        root.append(group);
    }
    if (data.truncatedSources) {
        const note = document.createElement("p");
        note.textContent = "Some sources were skipped by the bridge safety limit.";
        root.append(note);
    }
    mediaPanelBody.replaceChildren(root);
}

async function streamShellHandoffMangayomiSearch(title, mediaType, switchOnly = false) {
    const query = streamShellMangayomiSearchTitle(title, mediaType);
    if (!query) return {ok:false, error:"Only anime, manga or novel titles can be sent to Mangayomi search."};

    // Shift+click copies the title BEFORE any asynchronous native call, so
    // the clipboard still has the title for Mangayomi's own global search.
    // No source lookup on Shift+click; ordinary click keeps Mangayomi behind Landing.
    const copied = switchOnly ? await streamShellCopyMangayomiTitle(query) : false;
    let result;
    try {
        result = await chrome.runtime.sendMessage(switchOnly
            ? {type:"landing-show-mangayomi"}
            : {type:"landing-mangayomi-direct-search", query, itemType:mediaType});
    } catch (error) { result = {ok:false, error:String(error?.message || error)}; }
    if (!result?.ok) {
        window.alert(result?.error || (switchOnly ? "Mangayomi could not be opened." : "Mangayomi source search failed."));
        return {ok:false, switched:false, copied};
    }
    if (!switchOnly && result.searchResults?.ok && Array.isArray(result.searchResults.sources)) {
        streamShellRenderMangayomiSourceResults(result.searchResults);
    } else if (!switchOnly && result.fallback) {
        window.alert("Mangayomi source search unavailable: " +
            (result.reason || "The patched fork did not return a ready search bridge.") +
            "\nNo search was executed.");
    } else if (!switchOnly) {
        window.alert("Mangayomi returned no usable search results.");
        return {ok:false, switched:false};
    }
    return {ok:true, copied, query, mediaType, switched:switchOnly,
        dispatched:!switchOnly && result.dispatched === true, fallback:result.fallback === true};
}

function streamShellMangayomiSearchButton(title, mediaType) {
    const query = streamShellMangayomiSearchTitle(title, mediaType);
    if (!query) return null;
    const button = createElement("button", "media-item-action ss-mangayomi-search", "⌕");
    button.type = "button";
    button.title = `Search Mangayomi sources for “${query}” in Stream Shell. Shift+click: copy title and switch to Mangayomi.`;
    button.setAttribute("aria-label", `Search Mangayomi sources for ${query} in Stream Shell; Shift+click copies the title and switches to Mangayomi`);
    button.addEventListener("click", async event => {
        if (button.disabled) return;
        button.disabled = true;
        try { await streamShellHandoffMangayomiSearch(query, mediaType, !!event.shiftKey); }
        finally { button.disabled = false; }
    });
    return button;
}

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


/* v0.21.13: Best-effort TMDB <-> AniList enrichment on explicit save.
 * Save first; search only for an anime/movie counterpart with one unambiguous
 * title + release-year + format match. No eager bulk scans and no deletions.
 * API outages, absent TMDB credentials and uncertain matches are non-fatal.
 */
const streamShellAutoLinkJobs = new Map();

function streamShellAutoLinkFormat(anilist) {
    if (anilist?.mediaType !== "anime") return null;
    const format = String(anilist.format || "").toUpperCase();
    if (format === "MOVIE") return "movie";
    if (format === "TV" || format === "TV_SHORT") return "tv";
    return null; // No automatic OVA/ONA/SPECIAL ↔ TV guesses.
}

function streamShellAutoLinkMatches(tmdb, anilist) {
    if (!tmdb || !anilist || tmdb.mediaType !== streamShellAutoLinkFormat(anilist)) return false;
    const tmdbYear = streamShellLibraryYear(tmdb);
    const anilistYear = streamShellLibraryYear(anilist);
    if (!tmdbYear || !anilistYear || tmdbYear !== anilistYear) return false;
    const names = item => new Set([item.title,item.originalTitle,item.nativeTitle]
        .map(streamShellLibraryTitleKey).filter(Boolean));
    const left = names(tmdb), right = names(anilist);
    return [...left].some(name => right.has(name));
}

function streamShellAutoLinkUnique(candidates, anchor, counterpartType) {
    const byId = new Map();
    for (const candidate of candidates) {
        if (!candidate || !streamShellAutoLinkMatches(
            counterpartType === "anilist" ? anchor : candidate,
            counterpartType === "anilist" ? candidate : anchor)) continue;
        const id = counterpartType === "anilist" ? Number(candidate.anilistId) : `${candidate.mediaType}:${candidate.id}`;
        if (!id || id === "undefined:undefined") continue;
        byId.set(id, candidate);
    }
    return byId.size === 1 ? [...byId.values()][0] : null;
}

function streamShellAutoLinkQueries(media) {
    const out = [];
    for (const name of [media.title,media.originalTitle,media.nativeTitle]) {
        const value = String(name || "").trim().slice(0,120);
        const key = streamShellLibraryTitleKey(value);
        if (value.length >= 2 && key && !out.some(other => streamShellLibraryTitleKey(other) === key))
            out.push(value);
    }
    return out.slice(0,2); // Max two names; do not launch open-ended source scans.
}

async function streamShellAutoLinkFindTmdb(anilist) {
    if (!await window.StreamShellMediaApi.hasToken()) return null;
    const found = [];
    for (const name of streamShellAutoLinkQueries(anilist)) {
        try { found.push(...await window.StreamShellMediaApi.searchMedia(name)); }
        catch (error) { console.debug("TMDB enrichment search unavailable", error); }
    }
    return streamShellAutoLinkUnique(found,anilist,"tmdb");
}

async function streamShellAutoLinkFindAniList(tmdb) {
    const found = [];
    for (const name of streamShellAutoLinkQueries(tmdb)) {
        try { found.push(...await window.StreamShellAniList.searchAnime(name)); }
        catch (error) { console.debug("AniList enrichment search unavailable", error); }
    }
    return streamShellAutoLinkUnique(found,tmdb,"anilist");
}

async function streamShellAutoLinkRefresh() {
    await refreshWatchlistCache();
    if (activePanel === "watchlist" && !mediaPanel.hidden) await showWatchlist();
}

function streamShellAutoLinkRun(key, action) {
    if (streamShellAutoLinkJobs.has(key)) return streamShellAutoLinkJobs.get(key);
    const job = Promise.resolve().then(action).catch(error => {
        // The primary save has already succeeded; this must never undo it.
        console.debug("Optional cross-source metadata lookup skipped", error);
    }).finally(() => streamShellAutoLinkJobs.delete(key));
    streamShellAutoLinkJobs.set(key,job);
    return job;
}

function streamShellEnrichTmdbMedia(tmdb) {
    if (!tmdb || !["tv","movie"].includes(tmdb.mediaType)) return Promise.resolve();
    return streamShellAutoLinkRun(`tmdb:${tmdb.mediaType}:${tmdb.id}`, async () => {
        if (!await window.StreamShellWatchlist.contains(tmdb)) return;
        // Already linked to a saved AniList entry? The combined card has all data.
        const saved = await window.StreamShellExternalLibrary.getAll();
        if (saved.some(item => item.source === "anilist" && streamShellAutoLinkMatches(tmdb,item))) return;
        const match = await streamShellAutoLinkFindAniList(tmdb);
        if (!match || !await window.StreamShellWatchlist.contains(tmdb)) return;
        // If two external entries match the same TMDB title, leave it ambiguous.
        const current = await window.StreamShellExternalLibrary.getAll();
        if (current.filter(item => item.source === "anilist" && streamShellAutoLinkMatches(tmdb,item)).length > 1) return;
        let enriched = match;
        try { enriched = await window.StreamShellAniList.details(match); }
        catch { /* Search result already contains reliable title, year and ID. */ }
        if (!await window.StreamShellWatchlist.contains(tmdb) ||
            !streamShellAutoLinkMatches(tmdb,enriched)) return;
        await window.StreamShellExternalLibrary.upsertAniList(enriched);
        await streamShellAutoLinkRefresh();
    });
}

function streamShellEnrichAniListMedia(anilist) {
    if (!anilist?.anilistId || !streamShellAutoLinkFormat(anilist)) return Promise.resolve();
    return streamShellAutoLinkRun(`anilist:${anilist.anilistId}`, async () => {
        const isStillSaved = async () => (await window.StreamShellExternalLibrary.getAll())
            .some(item => item.source === "anilist" && item.anilistId === anilist.anilistId);
        if (!await isStillSaved()) return;
        const storedTmdb = await window.StreamShellWatchlist.getAll();
        if (storedTmdb.some(item => streamShellAutoLinkMatches(item,anilist))) return;
        const match = await streamShellAutoLinkFindTmdb(anilist);
        if (!match || !await isStillSaved()) return;
        // Do not create an extra TMDB record when a matching one has been saved meanwhile.
        const current = await window.StreamShellWatchlist.getAll();
        if (current.some(item => streamShellAutoLinkMatches(item,anilist))) return;
        await window.StreamShellWatchlist.add(match);
        await streamShellAutoLinkRefresh();
    });
}
/* FMHY discovery: curated Markdown links, not TMDB title availability. */
// Category browsing is a first-class search mode: choosing e.g. Gaming
// discovers FMHY-curated resources even with an empty text query. Gaming
// aggregates two independent upstream documents under one area chip.
const STREAM_SHELL_FMHY_AREAS = Object.freeze([
    ["gaming", "Gaming"], ["video", "Video"], ["reading", "Reading"],
    ["audio", "Audio"], ["video-tools", "Video tools"],
    ["non-english", "International"], ["downloading", "Downloads"],
    ["torrenting", "Torrenting"], ["educational", "Learning"],
    ["internet-tools", "Web tools"]
]);
const STREAM_SHELL_FMHY_DOCS = Object.freeze([
    ...STREAM_SHELL_FMHY_AREAS.map(([id]) => `${id}.md`), "gaming-tools.md"
]);
const streamShellFmhyDocumentArea = file => file === "gaming-tools.md" ? "gaming" : file.slice(0, -3);
const STREAM_SHELL_FMHY_KINDS = Object.freeze([
    ["stream", "Streaming"], ["download", "Downloads"],
    ["library", "Libraries"], ["index", "Indexes"], ["tool", "Tools"]
]);
const streamShellFmhySelectedAreas = new Set();
const streamShellFmhySelectedKinds = new Set();
let fmhyLoadedAreas = 0;
let fmhyAllAreas = STREAM_SHELL_FMHY_AREAS.length;
const STREAM_SHELL_FMHY_ROOT = "https://raw.githubusercontent.com/fmhy/edit/main/docs/";
// Small packaged fallback from FMHY's public directory (not a full mirrored index).
// The live Markdown directory remains authoritative when it can be fetched.
const STREAM_SHELL_FMHY_FALLBACK = Object.freeze([
    ["Movy", "https://www.movy.sx/", "video", "Streaming Sites", "Movies / TV / Anime / 4K"],
    ["Cinejoy", "https://cinejoy.pk/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["PopcornMovies", "https://popcornmovies.ac/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Rive", "https://www.rivestream.app/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Flixer", "https://flixer.gd/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Vivarium", "https://vivarium.su/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["MeowTV", "https://meowtv.ru/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Movie Night", "https://movienig.ht/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Open Slum", "https://open-slum.org/", "reading", "Ebooks", "Book Site Index"],
    ["Project Gutenberg", "https://www.gutenberg.org/", "reading", "Public Domain", "Historical Fiction / Nonfiction / Books / Ebooks"],
    ["Open Library", "https://openlibrary.org/", "reading", "Ebooks", "Books / Digital Library"],
    ["Internet Archive", "https://archive.org/details/texts", "reading", "Ebooks", "Books / Audiobooks"],
    ["Bookracy", "https://bookracy.com/", "reading", "Ebooks", "Books / Comics / Manga"],
    ["JustFreeBooks", "https://www.justfreebooks.info/", "reading", "Ebooks", "Book Search"],
    ["Manybooks", "https://manybooks.net/", "reading", "Ebooks", "Books"],
    ["Sonora", "https://sonorahq.org/", "audio", "Streaming Apps", "YouTube Music Client"],
    ["WAVE", "https://waveapp.pages.dev/", "audio", "Streaming Apps", "YouTube Music Client"],
    ["SoundCloud", "https://soundcloud.com/", "audio", "Streaming Sites", "Music Streaming"],
    ["Bandcamp", "https://bandcamp.com/discover/free-music", "audio", "Streaming Sites", "Music"],
    ["Digital Video Intro", "https://github.com/leandromoreira/digital_video_introduction", "video-tools", "Video Tools", "Digital Video Guides"],
    ["VidCoder", "https://vidcoder.net/", "video-tools", "Physical Media Tools", "DVD / Blu-ray Video"],
    ["MakeMKV", "https://forum.makemkv.com/forum/viewtopic.php?f=5&t=1053", "video-tools", "Physical Media Tools", "Blu-ray / DVD"],
    ["Catbox", "https://catbox.moe/", "video-tools", "Video File Hosts", "File Hosting"],
    ["PCGamingWiki", "https://www.pcgamingwiki.com/wiki/Home", "gaming", "Gaming Tools", "Game fixes and workarounds"],
    ["HowLongToBeat", "https://howlongtobeat.com/", "gaming", "Gaming Tools", "Average game completion times"],
    ["Backloggd", "https://www.backloggd.com/", "gaming", "Tracking / Databases", "Track and discover video games"]
].map(([title, url, category, section, description]) =>
    ({title, url, category, section, description})));
let fmhyUsingFallback = false;
let fmhyResourceCache = null;
let fmhyCacheAt = 0;
let fmhyDisplayedLimit = 60;
const STREAM_SHELL_FMHY_PAGE_SIZE = 60;
const streamShellFmhyIsBrowsing = rawQuery =>
    !String(rawQuery || "").trim() &&
    (streamShellFmhySelectedAreas.size > 0 || streamShellFmhySelectedKinds.size > 0);
const streamShellFmhyNormalize = value => String(value || "").toLocaleLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g,"ss");
function streamShellFmhyResourceKind(category, section, description) {
    const heading = streamShellFmhyNormalize(section);
    const context = `${heading} ${streamShellFmhyNormalize(description)}`;
    // Classification uses only the FMHY descriptions/headings, not invented
    // "official" content-type metadata. Unknown sites remain general indexes.
    if (/(index|directory|list of|site lists|site index|aggregator|search engines?)/.test(heading)) return "index";
    if (/(tools?|converters?|players?|editors?|extensions?|utilities?|guides?|software|clients?)/.test(heading)
        || category.endsWith("-tools") || category === "internet-tools") return "tool";
    if (/(download|torrent|ddl|direct links|usenet)/.test(heading) || ["downloading", "torrenting"].includes(category)) return "download";
    if (/(books?|manga|comics?|ebooks?|audiobooks?|novels?|libraries|archives?|textbooks?)/.test(heading)
        || category === "reading") return "library";
    if (/(stream|watch|live|radio|podcasts?|music|movies?|tv|anime)/.test(context)
        || ["video", "audio"].includes(category)) return "stream";
    return "index";
}

function streamShellParseFmhyMarkdown(markdown, category) {
    const rows = [];
    let heading = category;
    for (const line of String(markdown || "").split(/\r?\n/)) {
        const section = line.match(/^#{1,5}\s+(.+)$/);
        if (section) heading = section[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim().slice(0, 100);
        // FMHY uses both '* ⭐ **[Name](url)** - Description' and '- [Name](url)'.
        if (!/^\s*[-*]\s/.test(line)) continue;
        // Only the first canonical resource on each list item. Secondary links are
        // often mirrors, Discord channels or miscellaneous documentation.
        const hit = line.match(/\[([^\]\n]{2,100})\]\((https:\/\/[^\s)]+)\)/);
        if (!hit) continue;
        // Section jump-links inside FMHY are navigation, not resource websites.
        if (/^[▷►◄↪]/.test(hit[1].trim())) continue;
        let url;
        try { url = new URL(hit[2]); } catch { continue; }
        if (url.protocol !== "https:" || url.username || url.password || url.hostname.length > 253) continue;
        // FMHY's media categories and keywords mostly appear AFTER the link
        // (e.g. 'Movies / TV / Anime') rather than in its resource title.
        const description = line.slice(hit.index + hit[0].length)
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[\*_`#~]/g, "")
            .replace(/\s+/g, " ").trim().slice(0, 400);
        rows.push({title: hit[1].trim(), url: url.href, category,
            section: heading, description,
            kind: streamShellFmhyResourceKind(category, heading, description),
            recommended: /⭐|🌟/.test(line.slice(0, hit.index))});
    }
    return rows;
}

async function streamShellFetchFmhyResources() {
    if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
        const gate = await chrome.storage.local.get("streamShellSevenSeasAcknowledged");
        if (gate.streamShellSevenSeasAcknowledged !== true)
            throw new Error("FMHY is disabled until the Seven Seas acknowledgement is enabled.");
    }
    if (fmhyResourceCache && Date.now() - fmhyCacheAt <
        (fmhyUsingFallback ? 5 * 60 * 1000 : 6 * 60 * 60 * 1000))
        return fmhyResourceCache;
    // Isolate every document: temporary rate limit / offline errors shouldn't break TMDB.
    const results = await Promise.allSettled(STREAM_SHELL_FMHY_DOCS.map(async file => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7500);
        try {
            const response = await fetch(STREAM_SHELL_FMHY_ROOT + file, {signal: controller.signal, cache: "default"});
            if (!response.ok) throw new Error(`FMHY ${file}: HTTP ${response.status}`);
            const content = await response.text();
            if (content.length > 2_000_000) throw new Error(`FMHY document too large: ${file}`);
            return streamShellParseFmhyMarkdown(content, streamShellFmhyDocumentArea(file));
        } finally { clearTimeout(timeout); }
    }));
    const available = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (!available.length) {
        // A blocked/raw GitHub request must not make FMHY search appear broken.
        // Never mislabel the packaged excerpt as the complete current directory.
        fmhyUsingFallback = true;
        fmhyLoadedAreas = 0;
        fmhyResourceCache = STREAM_SHELL_FMHY_FALLBACK.map(item => ({...item,
            kind: streamShellFmhyResourceKind(item.category, item.section, item.description),
            recommended: false}));
        fmhyCacheAt = Date.now();
        return fmhyResourceCache;
    }
    if (available.length) {
        fmhyUsingFallback = false;
        fmhyLoadedAreas = new Set(results.flatMap((result, index) => result.status === "fulfilled"
            ? [streamShellFmhyDocumentArea(STREAM_SHELL_FMHY_DOCS[index])] : [])).size;
        const seen = new Set();
        fmhyResourceCache = available.filter(row => {
            if (seen.has(row.url)) return false;
            seen.add(row.url);
            return true;
        });
        fmhyCacheAt = Date.now();
    }
    return fmhyResourceCache;
}

function streamShellSearchFmhyIndex(resources, rawQuery, options = {}) {
    const aliases = {films: "movies", film: "movie", serie: "series",
        serien: "tv", comics: "comic", bucher: "books", buch: "book",
        filme: "movies", musik: "music", horbuch: "audiobook", lesen: "reading"};
    const parts = streamShellFmhyNormalize(rawQuery).trim().split(/\s+/)
        .filter(Boolean).map(word => aliases[word] || word);
    const areas = options.areas || streamShellFmhySelectedAreas;
    const kinds = options.kinds || streamShellFmhySelectedKinds;
    // No global unfiltered catalogue dump on opening the FMHY tab.
    // A selected Area or Kind explicitly requests category discovery.
    if (!parts.length && !areas.size && !kinds.size) return [];
    const browsing = !parts.length;
    return resources.map(row => {
        const kind = row.kind || streamShellFmhyResourceKind(row.category, row.section, row.description);
        if (areas.size && !areas.has(row.category)) return null;
        if (kinds.size && !kinds.has(kind)) return null;
        const title = streamShellFmhyNormalize(row.title);
        const section = streamShellFmhyNormalize(`${row.section} ${row.category}`);
        const context = streamShellFmhyNormalize(`${row.description || ""} ${new URL(row.url).hostname}`);
        if (!parts.every(word => title.includes(word) || section.includes(word) || context.includes(word))) return null;
        const phrase = parts.join(" ");
        // For browsing, ⭐ means FMHY community-curated, not a verified rating.
        // For text search, title matches remain more important than that marker.
        const score = browsing ? (row.recommended ? 100 : 0)
            : (title === phrase ? 90 : title.startsWith(phrase) ? 35 : title.includes(phrase) ? 15 : 0)
                + parts.reduce((sum, word) => sum +
                    (title.includes(word) ? 15 : section.includes(word) ? 7 : 2), 0)
                + (row.recommended ? 4 : 0);
        return {...row, kind, score};
    }).filter(Boolean).sort((a,b) => b.score - a.score ||
        a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
}

function streamShellFmhyFacets(summary = "") {
    const host = createElement("div", "ss-search-filter-bar ss-fmhy-facets");
    const summaryText = createElement("div", "ss-search-filter-summary", summary);
    host.appendChild(summaryText);
    for (const [name, values, selected] of [
        ["Area", STREAM_SHELL_FMHY_AREAS, streamShellFmhySelectedAreas],
        ["Kind", STREAM_SHELL_FMHY_KINDS, streamShellFmhySelectedKinds]
    ]) {
        const line = createElement("div", "ss-search-filter-line");
        line.appendChild(createElement("span", "ss-search-filter-label", name));
        const filters = createElement("div", "ss-search-filter-chips");
        filters.setAttribute("role", "group");
        filters.setAttribute("aria-label", `FMHY ${name.toLowerCase()} filters (multiple allowed)`);
        for (const [type, label] of values) {
            const chip = createElement("button", "ss-library-filter", label);
            chip.type = "button";
            if (name === "Area") chip.title = `Browse ${label} resources (clears search term)`;
            chip.classList.toggle("selected", selected.has(type));
            chip.setAttribute("aria-pressed", String(selected.has(type)));
            chip.addEventListener("click", () => {
                if (selected.has(type)) selected.delete(type); else selected.add(type);
                if (mediaSearchSource?.value !== "fmhy") return;
                // Areas double as discovery searches: selecting Gaming should
                // browse Gaming picks, not silently retain a previous TMDB query.
                // Typing *afterwards* still refines the selected categories.
                if (name === "Area" && mediaSearchInput.value.trim()) {
                    mediaSearchInput.value = "";
                    if (typeof mediaSearchClear !== "undefined" && mediaSearchClear) {
                        mediaSearchClear.hidden = true;
                        mediaSearchClear.setAttribute("aria-hidden", "true");
                    }
                }
                const q = mediaSearchInput.value.trim();
                fmhyDisplayedLimit = STREAM_SHELL_FMHY_PAGE_SIZE;
                if ((q.length >= 2 || streamShellFmhyIsBrowsing(q)) && fmhyResourceCache)
                    renderFmhyResults(streamShellSearchFmhyIndex(fmhyResourceCache, q), searchGeneration);
                else if (q.length >= 2 || streamShellFmhyIsBrowsing(q))
                    scheduleSearch(true); // first browse fetch; thereafter filters use cache
                else showSearchHint();
            });
            filters.appendChild(chip);
        }
        line.appendChild(filters);
        host.appendChild(line);
    }
    return host;
}
function streamShellFmhySubtitle(summary) {
    if (mediaSearchSource?.value !== "fmhy") return;
    mediaPanelSubtitle.replaceChildren(streamShellFmhyFacets(summary));
}

function renderFmhyResults(results, generation) {
    if (generation !== searchGeneration) return;
    const browsing = streamShellFmhyIsBrowsing(mediaSearchInput.value.trim());
    const labels = [...streamShellFmhySelectedAreas].map(id =>
        STREAM_SHELL_FMHY_AREAS.find(([area]) => area === id)?.[1] || id);
    const selectionLabel = browsing ? `${labels.length ? labels.join(" + ") : "Selected resource types"} · ` : "";
    streamShellFmhySubtitle(`${selectionLabel}${results.length} ${browsing ? "discoverable" : "matching"} websites · ${fmhyUsingFallback
        ? "Limited offline excerpt (live FMHY unavailable)"
        : `Live FMHY directory (${fmhyLoadedAreas}/${fmhyAllAreas} areas loaded)`}`);
    if (!results.length) {
        renderPanelMessage("No matching resources", browsing
            ? "No entries in these categories. Try another Area or Kind. FMHY community picks appear first where available."
            : "FMHY indexes resource websites, not individual media titles. Try another term or select an Area to browse without text.", {icon: "⌕"});
        return;
    }
    const list = createElement("div", "media-list fmhy-results");
    for (const item of results.slice(0, fmhyDisplayedLimit)) {
        // Match the existing three-column Direct Link row: launch | details | actions.
        // Without the launch column, the title falls into the 34px icon slot.
        const row = createElement("article", "media-item direct-link-item fmhy-result");
        const open = createElement("button", "direct-link-launch", "↗");
        open.type = "button";
        open.title = `Open ${item.title} in Opera`;
        open.setAttribute("aria-label", open.title);
        const openResource = async () => {
            try {
                const reply = await chrome.runtime.sendMessage({type: "open-direct-link", url: item.url});
                if (reply?.ok === false) throw new Error(reply.error || "Failed to open resource");
            } catch (error) {
                console.error("FMHY launch failed", error);
            }
        };
        open.addEventListener("click", openResource);

        const main = createElement("div", "media-item-main direct-link-main");
        const heading = createElement("div", "media-item-title-row");
        heading.append(
            createElement("span", "media-item-title", item.title),
            createElement("span", "media-item-type", STREAM_SHELL_FMHY_KINDS.find(([kind]) => kind === item.kind)?.[1] || item.category)
        );
        main.append(heading);
        const meta = createElement("div", "media-item-meta");
        meta.append(
            createElement("span", "", `${STREAM_SHELL_FMHY_AREAS.find(([id]) => id === item.category)?.[1] || item.category} · ${item.section}${item.recommended ? " · ★ FMHY pick" : ""}`),
            createElement("span", "", new URL(item.url).hostname)
        );
        main.append(meta);
        if (item.description) {
            main.append(createElement("div", "fmhy-result-description", item.description));
        }
        const actions = createElement("div", "media-item-actions");
        const save = createElement("button", "media-item-action", "♡");
        save.type = "button";
        save.title = "Save to Direct links";
        save.setAttribute("aria-label", save.title);
        save.addEventListener("click", async () => {
            try {
                await window.StreamShellDirectLinks.merge([{title: item.title, url: item.url}]);
                save.textContent = "✓";
                save.classList.add("saved");
                save.disabled = true;
            } catch (error) { console.error("FMHY save failed", error); }
        });
        actions.append(save);
        row.append(open, main, actions);
        list.appendChild(row);
    }
    if (results.length > fmhyDisplayedLimit) {
        const more = createElement("button", "ss-fmhy-load-more", `Show more · ${results.length - fmhyDisplayedLimit} remaining`);
        more.type = "button";
        more.addEventListener("click", () => {
            fmhyDisplayedLimit += STREAM_SHELL_FMHY_PAGE_SIZE;
            renderFmhyResults(results, generation);
        });
        list.appendChild(more);
    }
    mediaPanelBody.replaceChildren(list);
}
/* AniList search results use the same neutral Stream Shell card vocabulary.
 * Covers and metadata are public; saving stores them in the independent local
 * external library, not the TMDB watchlist or the Mangayomi app database. */
function streamShellAniListCover(media, className) {
    if (!window.StreamShellAniList.validCover(media.coverUrl)) return null;
    const image = document.createElement("img");
    image.className = className;
    image.src = media.coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    return image;
}

function streamShellAniListMeta(media, addedAt = null) {
    const parts = [
        media.mediaType === "anime" ? "Anime" : media.mediaType === "novel" ? "Novel" : "Manga",
        media.year || null,
        media.episodes ? `${media.episodes} episodes` : media.chapters ? `${media.chapters} chapters` : null,
        media.score != null ? `AniList ${media.score}%` : null,
        addedAt ? `Added ${formatDateTime(addedAt)}` : null
    ].filter(Boolean);
    return parts.join(" · ");
}

function streamShellAniListDetails(media) {
    const container = createElement("div", "ss-anilist-details");
    if (media.description) container.appendChild(createElement("p", "ss-anilist-description", media.description));
    if (media.genres?.length) container.appendChild(createElement("p", "ss-anilist-genres", media.genres.join(" · ")));
    if (media.originalTitle || media.nativeTitle)
        container.appendChild(createElement("p", "ss-anilist-alt", [media.originalTitle,media.nativeTitle].filter(Boolean).join(" · ")));
    return container;
}

function streamShellAniListResultCard(media, saved, generation) {
    const row = createElement("article", "media-item ss-anilist-row");
    const cover = streamShellAniListCover(media, "ss-anilist-cover") || createElement("div", "ss-anilist-cover ss-anilist-cover-empty", "◈");
    const main = createElement("div", "media-item-main");
    const heading = createElement("div", "media-item-title-row");
    heading.append(createElement("span", "media-item-title", media.title),
        createElement("span", "media-item-type", media.mediaType));
    main.append(heading, createElement("div", "media-item-meta", streamShellAniListMeta(media)));
    const actions = createElement("div", "media-item-actions");
    const save = createElement("button", "media-item-action ss-anilist-save", saved ? "✓" : "+");
    save.type = "button";
    save.disabled = saved;
    save.title = saved ? "Already in Library" : "Save to Stream Shell Library";
    save.setAttribute("aria-label", save.title);
    const details = createElement("button", "media-item-action", "ⓘ");
    details.type = "button"; details.title = "Show title details";
    details.setAttribute("aria-expanded", "false");
    const detailPanel = streamShellAniListDetails(media);
    detailPanel.hidden = true;
    details.addEventListener("click", () => {
        detailPanel.hidden = !detailPanel.hidden;
        details.setAttribute("aria-expanded", String(!detailPanel.hidden));
    });
    save.addEventListener("click", async () => {
        if (save.disabled) return;
        save.disabled = true;
        save.textContent = "…";
        try {
            // A details lookup enriches search's intentionally lightweight
            // response. Failed lookups must not prevent local saving.
            let enriched = media;
            try { enriched = await window.StreamShellAniList.details(media); }
            catch (error) { console.warn("AniList detail lookup unavailable, saving search data",error); }
            await window.StreamShellExternalLibrary.upsertAniList(enriched);
            void streamShellEnrichAniListMedia(enriched);
            save.textContent = "✓";
            save.title = "Saved in Library";
            await refreshWatchlistCache();
        } catch (error) {
            save.disabled = false;
            save.textContent = "+";
            save.title = String(error?.message || "Save failed");
            console.error("AniList save failed", error);
        }
    });
    const mangayomi = streamShellMangayomiSearchButton(media.title, media.mediaType);
    if (mangayomi) actions.appendChild(mangayomi);
    actions.append(details, save);
    row.append(cover, main, actions, detailPanel);
    return row;
}

async function renderAniListResults(entries, generation) {
    if (generation !== searchGeneration) return;
    const current = await window.StreamShellExternalLibrary.getAll();
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const ids = new Set(current.filter(i => i.source === "anilist").map(i => `${i.mediaType}:${i.anilistId}`));
    const visible = entries.filter(item => streamShellSearchMatchesType(item, "anilist"));
    streamShellSearchTypeSubtitle("anilist", `${visible.length} of ${entries.length} AniList results · metadata only`);
    if (!visible.length) {
        renderPanelMessage("No AniList results for the selected types", "Select another type or try the English, Romaji or original title.",{icon:"⌕"});
        return;
    }
    const list = createElement("div", "media-list");
    for (const item of visible)
        list.appendChild(streamShellAniListResultCard(item,ids.has(`${item.mediaType}:${item.anilistId}`),generation));
    mediaPanelBody.replaceChildren(list);
}
/*
 * ============================================================
 * SEARCH
 * ============================================================
 */

const mediaSearchSource = document.getElementById("media-search-source");
const mediaSourceTabs = {
    tmdb: document.getElementById("media-search-tmdb-tab"),
    fmhy: document.getElementById("media-search-fmhy-tab")
};
// One media search: TMDB and AniList queried together, with one multi-select.
const streamShellSearchFilterTypes = Object.freeze({
    tmdb: [["movie", "Movies"], ["tv", "Series"], ["anime", "Anime"],
           ["manga", "Manga"], ["novel", "Novels"]]
});
const streamShellSearchSelectedTypes = { tmdb: new Set() };
const streamShellSearchResultCache = {tmdb: null, anilist: null};
let streamShellSevenSeasAcknowledged = false;
function streamShellSearchMatchesType(item, source) {
    const selected = streamShellSearchSelectedTypes.tmdb;
    return !selected.size || selected.has(item.mediaType);
}
function streamShellSearchTypeSubtitle(source, summary) {
    if (mediaSearchSource?.value !== "tmdb") return;
    const host = createElement("div", "ss-search-filter-bar");
    host.appendChild(createElement("div", "ss-search-filter-summary", summary));
    const filters = createElement("div", "ss-search-filter-chips");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Search media types (multiple allowed)");
    for (const [type, label] of streamShellSearchFilterTypes.tmdb) {
        const chip = createElement("button", "ss-library-filter", label);
        chip.type = "button";
        const active = streamShellSearchSelectedTypes.tmdb.has(type);
        chip.classList.toggle("selected", active);
        chip.setAttribute("aria-pressed", String(active));
        chip.addEventListener("click", () => {
            const selected = streamShellSearchSelectedTypes.tmdb;
            if (selected.has(type)) selected.delete(type); else selected.add(type);
            if (mediaSearchSource?.value !== "tmdb") return;
            const query = mediaSearchInput.value.trim();
            if (streamShellSearchResultCache.tmdb?.query === query ||
                streamShellSearchResultCache.anilist?.query === query) {
                void streamShellRenderUnifiedResults(query, searchGeneration).catch(console.error);
            } else showSearchHint();
        });
        filters.appendChild(chip);
    }
    host.appendChild(filters);
    mediaPanelSubtitle.replaceChildren(host);
}
function streamShellSetSevenSeasSearchAccess(enabled) {
    streamShellSevenSeasAcknowledged = enabled === true;
    const tab = mediaSourceTabs.fmhy;
    if (tab) {
        tab.disabled = !streamShellSevenSeasAcknowledged;
        tab.title = streamShellSevenSeasAcknowledged ? "Browse FMHY resources" :
            "Disabled until Seven Seas is acknowledged in General settings";
        tab.setAttribute("aria-disabled", String(!streamShellSevenSeasAcknowledged));
    }
    if (!streamShellSevenSeasAcknowledged && mediaSearchSource?.value === "fmhy") {
        setMediaSearchSource("tmdb");
    }
}
if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
    chrome.storage.local.get("streamShellSevenSeasAcknowledged")
        .then(stored => streamShellSetSevenSeasSearchAccess(stored.streamShellSevenSeasAcknowledged === true))
        .catch(() => streamShellSetSevenSeasSearchAccess(false));
    chrome.storage.onChanged?.addListener((changes, area) => {
        if (area === "local" && changes.streamShellSevenSeasAcknowledged)
            streamShellSetSevenSeasSearchAccess(changes.streamShellSevenSeasAcknowledged.newValue === true);
    });
}
function setMediaSearchSource(source) {
    if (!mediaSearchSource || !mediaSourceTabs[source]) return;
    if (source === "fmhy" && !streamShellSevenSeasAcknowledged) return;
    mediaSearchSource.value = source;
    mediaSearchInput.placeholder = source === "fmhy" ? "Search resources..." :
        "Search movies, series, anime, manga and novels...";
    mediaSearchInput.setAttribute("aria-label", mediaSearchInput.placeholder);
    for (const [kind, tab] of Object.entries(mediaSourceTabs)) {
        if (!tab) continue;
        const selected = kind === source;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
    }
    scheduleSearch(true);
}
for (const [kind, tab] of Object.entries(mediaSourceTabs)) {
    tab?.addEventListener("click", () => setMediaSearchSource(kind));
}
function showSearchHint() {
    if (mediaSearchSource?.value === "fmhy") {
        streamShellFmhySubtitle("Select an Area to discover resources, or enter a keyword.");
        renderPanelMessage("Discover FMHY resources",
            "Choose a category like Gaming or enter a search term. Community picks are listed first.", {icon:"⌕"});
    } else {
        streamShellSearchTypeSubtitle("tmdb", "TMDB · movies and series · AniList · anime, manga and novels");
        renderPanelMessage("What do you want to watch?",
            "Search all five media types together, or select the types you want above.", {icon:"⌕"});
    }
}

function renderSearchResults(
    results,
    generation
) {

    const visible = results.filter(item => streamShellSearchMatchesType(item, "tmdb"));
    streamShellSearchTypeSubtitle("tmdb", `${visible.length} of ${results.length} results · Germany`);


    if (
        visible.length ===
        0
    ) {
        renderPanelMessage(
            "No results",
            "No matching movies or series for the selected types.",
            {
                icon:
                    "×"
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
        of visible
    ) {
        list.appendChild(
            createMediaItem(
                media,
                {
                    mode:
                        "search",

                    saved:
                        isSaved(
                            media
                        ),

                    generation
                }
            )
        );
    }


    mediaPanelBody.replaceChildren(
        list
    );
}


let streamShellUnifiedRenderEpoch = 0;
async function streamShellRenderUnifiedResults(query, generation, warning = "") {
    const renderEpoch = ++streamShellUnifiedRenderEpoch;
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const tmdb = streamShellSearchResultCache.tmdb?.query === query
        ? streamShellSearchResultCache.tmdb.items : [];
    const anilist = streamShellSearchResultCache.anilist?.query === query
        ? streamShellSearchResultCache.anilist.items : [];
    const movies = tmdb.filter(item => streamShellSearchMatchesType(item, "tmdb"));
    const anime = anilist.filter(item => streamShellSearchMatchesType(item, "anilist"));
    streamShellSearchTypeSubtitle("tmdb", `${movies.length} TMDB · ${anime.length} AniList${warning ? " · " + warning : ""}`);
    if (!movies.length && !anime.length) {
        renderPanelMessage("No results", warning || "Try other media types or another title.", {icon:"⌕"});
        return;
    }
    const list = createElement("div", "media-list ss-unified-results");
    if (movies.length) {
        list.appendChild(createElement("div", "ss-search-result-section", `TMDB · Movies & Series (${movies.length})`));
        for (const item of movies) list.appendChild(createMediaItem(item, {
            mode:"search", saved:isSaved(item), generation
        }));
    }
    if (anime.length) {
        // Library identities stay independent; no cross-service ID guessing.
        const current = await window.StreamShellExternalLibrary.getAll();
        if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb" ||
            renderEpoch !== streamShellUnifiedRenderEpoch) return;
        const ids = new Set(current.filter(item => item.source === "anilist")
            .map(item => `${item.mediaType}:${item.anilistId}`));
        list.appendChild(createElement("div", "ss-search-result-section", `AniList · Anime, Manga & Novels (${anime.length})`));
        for (const item of anime) list.appendChild(streamShellAniListResultCard(item,
            ids.has(`${item.mediaType}:${item.anilistId}`), generation));
    }
    if (renderEpoch !== streamShellUnifiedRenderEpoch) return;
    mediaPanelBody.replaceChildren(list);
}
async function runSearch(query, generation) {
    if (mediaSearchSource?.value === "fmhy") {
        try {
            // Recheck persistent acknowledgement rather than trusting a rendered tab.
            if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
                const ack = await chrome.storage.local.get("streamShellSevenSeasAcknowledged");
                if (ack.streamShellSevenSeasAcknowledged !== true) {
                    streamShellSetSevenSeasSearchAccess(false);
                    return;
                }
            }
            streamShellFmhySubtitle("Loading FMHY areas…");
            renderPanelMessage("Loading FMHY…", "Fetching directory resources for discovery.", {icon:"⌕"});
            const entries = await streamShellFetchFmhyResources();
            if (generation !== searchGeneration || mediaSearchSource?.value !== "fmhy") return;
            fmhyDisplayedLimit = STREAM_SHELL_FMHY_PAGE_SIZE;
            renderFmhyResults(streamShellSearchFmhyIndex(entries, query), generation);
        } catch (error) {
            if (generation === searchGeneration && mediaSearchSource?.value === "fmhy") {
                console.error("FMHY search failed", error);
                renderPanelMessage("FMHY unavailable", String(error?.message || error).slice(0,180), {icon:"×",error:true});
            }
        }
        return;
    }
    streamShellSearchTypeSubtitle("tmdb", "Searching TMDB + AniList…");
    renderPanelMessage("Searching…", `Finding “${query}” across both media catalogues.`, {icon:"⌕"});
    // Each index is independent. A missing TMDB token must not block AniList.
    const tasks = [
        (async () => {
            if (!await window.StreamShellMediaApi.hasToken())
                throw new Error("TMDB token not configured");
            return window.StreamShellMediaApi.searchMedia(query);
        })(),
        window.StreamShellAniList.search(query)
    ];
    const settled = await Promise.allSettled(tasks);
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const tmdb = settled[0].status === "fulfilled" ? settled[0].value : [];
    const anilist = settled[1].status === "fulfilled" ? settled[1].value : [];
    streamShellSearchResultCache.tmdb = {query, items:tmdb};
    streamShellSearchResultCache.anilist = {query, items:anilist};
    searchResults = tmdb;
    try { await refreshWatchlistCache(); } catch (error) { console.warn("Watchlist refresh failed", error); }
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const failed = settled.map((r,i) => r.status === "rejected" ? (i ? "AniList unavailable" :
        /token/i.test(String(r.reason?.message || r.reason)) ? "TMDB token needed" : "TMDB unavailable") : null).filter(Boolean);
    await streamShellRenderUnifiedResults(query, generation, failed.join(" · "));
}

function scheduleSearch(
    immediate =
        false
) {
    openPanel(
        "search"
    );


    const query =
        mediaSearchInput
            .value
            .trim();


    mediaSearchClear.hidden =
        query.length ===
        0;
    mediaSearchClear.setAttribute("aria-hidden", String(query.length === 0));


    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    const generation =
        searchGeneration;


    searchResults =
        [];


    if (
        query.length <
        2 && !(mediaSearchSource?.value === "fmhy" && streamShellFmhyIsBrowsing(query))
    ) {
        showSearchHint();

        return;
    }


    searchTimer =
        setTimeout(
            () => {
                runSearch(
                    query,
                    generation
                );
            },

            immediate
                ? 0
                : 300
        );
}


async function clearSearch() {
    clearTimeout(
        searchTimer
    );


    searchGeneration +=
        1;


    searchResults =
        [];


    selectedMediaKey =
        null;


    mediaSearchInput.value =
        "";


    mediaSearchClear.hidden =
        true;
    mediaSearchClear.setAttribute("aria-hidden", "true");


    await window
        .StreamShellAvailability
        .clearSelectedMedia();


    openPanel(
        "search"
    );


    showSearchHint();


    mediaSearchInput.focus();
}


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


/*
 * ============================================================
 * WATCHLIST EXPORT / IMPORT
 * ============================================================
 */

function getExportFileName() {
    const date =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    return `stream-shell-watchlist-${date}.json`;
}


async function exportWatchlist() {
    const [
        items,
        directLinks,
        continueWatching,
        externalMedia
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll(),
            window.StreamShellExternalLibrary.getAll()
        ]);


    const payload = {
        format:
            "stream-shell-watchlist",

        version:
            4,

        exportedAt:
            new Date()
                .toISOString(),

        items,

        directLinks,

        externalMedia,

        continueWatching
    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    payload,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        url;


    anchor.download =
        getExportFileName();


    anchor.style.display =
        "none";


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();


    setTimeout(
        () => {
            URL.revokeObjectURL(
                url
            );
        },
        1000
    );
}


async function importWatchlistFile(
    file
) {
    const text =
        await file.text();


    const parsed =
        JSON.parse(
            text
        );


    const items =
        Array.isArray(
            parsed
        )
            ? parsed
            : parsed?.items;


    const directLinks =
        Array.isArray(
            parsed?.directLinks
        )
            ? parsed.directLinks
            : [];


    const externalMedia = Array.isArray(parsed?.externalMedia) ? parsed.externalMedia : [];

    const continueWatching =
        Array.isArray(
            parsed?.continueWatching
        )
            ? parsed.continueWatching
            : [];


    if (
        !Array.isArray(
            items
        ) &&
        directLinks.length ===
            0 &&
        continueWatching.length ===
            0 && externalMedia.length === 0
    ) {
        throw new Error(
            "The selected file does not contain a Stream Shell Watchlist."
        );
    }


    const [
        beforeTitles,
        beforeLinks,
        beforeContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    await Promise.all([
        window
            .StreamShellWatchlist
            .merge(
                Array.isArray(
                    items
                )
                    ? items
                    : []
            ),
        window
            .StreamShellDirectLinks
            .merge(
                directLinks
            ),
        window
            .StreamShellContinueWatching
            .merge(
                continueWatching
            ),
        window.StreamShellExternalLibrary.merge(externalMedia)
    ]);


    const [
        afterTitles,
        afterLinks,
        afterContinue
    ] =
        await Promise.all([
            window
                .StreamShellWatchlist
                .getAll(),
            window
                .StreamShellDirectLinks
                .getAll(),
            window
                .StreamShellContinueWatching
                .getAll()
        ]);


    const addedTitles =
        Math.max(
            0,
            afterTitles.length -
            beforeTitles.length
        );


    const addedLinks =
        Math.max(
            0,
            afterLinks.length -
            beforeLinks.length
        );


    const addedContinue =
        Math.max(
            0,
            afterContinue.length -
            beforeContinue.length
        );


    await Promise.all([
        refreshDirectLinkCache(),
        refreshContinueWatchingCache()
    ]);


    await showWatchlist(
        `Imported ${addedTitles} ${
            addedTitles ===
                1
                ? "title"
                : "titles"
        } · ${addedLinks} ${
            addedLinks ===
                1
                ? "direct link"
                : "direct links"
        } · ${addedContinue} continue`
    );
}


/*
 * ============================================================
 * EVENTS
 * ============================================================
 */

subscriptionSyncButton?.addEventListener(
    "click",
    () => {
        syncSubscriptions()
            .catch(
                () => {}
            );
    }
);


watchlistToggle.addEventListener(
    "click",
    () => {
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


        if (
            libraryOpen
        ) {
            closePanel();

            return;
        }


        const openLastLibraryPanel =
            lastLibraryPanel ===
                "continue"
                ? showContinueWatching
                : lastLibraryPanel ===
                    "recent"
                    ? showRecent
                    : lastLibraryPanel ===
                        "direct"
                        ? showDirectLinks
                        : showWatchlist;


        openLastLibraryPanel()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


watchlistTab.addEventListener(
    "click",
    () => {
        showWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


continueTab.addEventListener(
    "click",
    () => {
        showContinueWatching()
            .catch(
                error => {
                    console.error(
                        "Continue Watching failed:",
                        error
                    );
                }
            );
    }
);


recentTab.addEventListener(
    "click",
    () => {
        showRecent()
            .catch(
                error => {
                    console.error(
                        "Recent list failed:",
                        error
                    );
                }
            );
    }
);



directTab.addEventListener(
    "click",
    () => {
        showDirectLinks()
            .catch(
                error => {
                    console.error(
                        "Direct links failed:",
                        error
                    );
                }
            );
    }
);


watchlistImportButton.addEventListener(
    "click",
    () => {
        watchlistImportInput.value =
            "";


        watchlistImportInput.click();
    }
);


watchlistImportInput.addEventListener(
    "change",
    async () => {
        const file =
            watchlistImportInput
                .files?.[0];


        if (
            !file
        ) {
            return;
        }


        try {
            await importWatchlistFile(
                file
            );

        } catch (error) {

            console.error(
                "Watchlist import failed:",
                error
            );


            openPanel(
                "watchlist"
            );


            renderPanelMessage(
                "Import failed",
                "The selected file is not a valid Stream Shell Watchlist export.",
                {
                    icon:
                        "×",

                    error:
                        true
                }
            );
        }
    }
);


watchlistExportButton.addEventListener(
    "click",
    () => {
        exportWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist export failed:",
                        error
                    );
                }
            );
    }
);


watchlistSort.addEventListener(
    "change",
    async () => {
        await saveWatchlistSortPreference(
            watchlistSort.value
        );


        if (
            activePanel ===
                "watchlist" &&
            !mediaPanel.hidden
        ) {
            await showWatchlist();
        }
    }
);


mediaSearchInput.addEventListener(
    "focus",
    () => {
        if (
            activePanel !==
                "search" ||
            mediaPanel.hidden
        ) {
            scheduleSearch(
                true
            );
        }
    }
);


mediaSearchInput.addEventListener(
    "input",
    () => {
        scheduleSearch();
    }
);


mediaSearchClear.addEventListener(
    "click",
    event => {
        event.preventDefault();

        event.stopPropagation();


        clearSearch()
            .catch(
                () => {}
            );
    }
);


mediaPanelClose.addEventListener(
    "click",
    closePanel
);


async function refreshDiscordButtonFromNative() {
    if (
        !discordButton ||
        !discordButton.classList.contains(
            "active"
        )
    ) {
        return;
    }


    try {
        const status =
            await chrome.runtime.sendMessage({
                type:
                    "get-discord-status"
            });


        if (
            status?.ok
        ) {
            const active =
                status.visible ===
                    true;


            discordButton.classList.toggle(
                "active",
                active
            );


            discordButton.setAttribute(
                "aria-pressed",
                active
                    ? "true"
                    : "false"
            );
        }
    } catch {
    }
}


/*
 * Native Discord can be minimized or closed-to-tray without producing an
 * Opera window event. Poll while Landing is actually visible; focus/
 * visibility events perform an immediate catch-up after a hidden period.
 */
let discordNativeStatusTimer = null;

function scheduleDiscordNativeStatusPoll(
    immediate = false
) {
    if (discordNativeStatusTimer) {
        clearTimeout(discordNativeStatusTimer);
        discordNativeStatusTimer = null;
    }

    if (
        document.visibilityState ===
            "hidden"
    ) {
        return;
    }

    discordNativeStatusTimer = setTimeout(
        async () => {
            discordNativeStatusTimer = null;
            await refreshDiscordButtonFromNative();
            scheduleDiscordNativeStatusPoll();
        },
        immediate ? 0 : 2000
    );
}

scheduleDiscordNativeStatusPoll();

document.addEventListener(
    "visibilitychange",
    () => {
        scheduleDiscordNativeStatusPoll(
            document.visibilityState !==
                "hidden"
        );
    }
);

window.addEventListener(
    "focus",
    () => {
        scheduleDiscordNativeStatusPoll(
            true
        );
    }
);


discordButton.addEventListener(
    "click",
    async () => {
        discordButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "landing-show-discord"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Discord desktop bridge failed."
                );
            }
        } catch (error) {
            console.error(
                "Discord desktop failed:",
                error
            );
        } finally {
            discordButton.classList.remove(
                "busy"
            );
        }
    }
);


if (twitchUtility && twitchOpenButton) {
    twitchOpenButton.addEventListener("click", async () => {
        twitchUtility.classList.add("busy");
        try {
            const response = await chrome.runtime.sendMessage({
                type: "landing-show-twitch-workspace"
            });
            if (response?.ok === false) {
                throw new Error(response.error || "Twitch workspace failed.");
            }
        } catch (error) {
            console.error("Twitch workspace failed:", error);
        } finally {
            twitchUtility.classList.remove("busy");
        }
    });
}


restoreHomeLayoutButton.addEventListener(
    "click",
    async () => {
        restoreHomeLayoutButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "restore-home-layout"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Home layout restore failed."
                );
            }
        } catch (error) {
            console.error(
                "Home layout restore failed:",
                error
            );
        } finally {
            restoreHomeLayoutButton.classList.remove(
                "busy"
            );
        }
    }
);


tmdbTokenButton.addEventListener(
    "click",
    () => {
        openPanel(
            "search"
        );


        renderTokenSetup(
            () => {
                scheduleSearch(
                    true
                );
            }
        );
    }
);


mediaPanelBody.addEventListener(
    "click",
    event => {
        const button =
            event.target.closest(
                "button"
            );


        if (
            !button
        ) {
            return;
        }


        if (
            button.dataset
                .refreshAvailability
        ) {
            refreshMediaAvailability(
                button.dataset
                    .refreshAvailability,
                button
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .selectMedia
        ) {
            selectMediaByKey(
                button.dataset
                    .selectMedia
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .toggleWatchlist
        ) {
            toggleWatchlistForSearch(
                button.dataset
                    .toggleWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .removeWatchlist
        ) {
            removeWatchlistItem(
                button.dataset
                    .removeWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .resumeContinue
        ) {
            resumeContinueWatching(
                button.dataset
                    .resumeContinue
            )
                .catch(
                    error => {
                        console.error(
                            "Continue Watching resume failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeContinue
        ) {
            removeContinueWatching(
                button.dataset
                    .removeContinue
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .openDirectLink
        ) {
            openDirectLink(
                button.dataset
                    .openDirectLink
            )
                .catch(
                    error => {
                        console.error(
                            "Direct link open failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeDirectLink
        ) {
            removeDirectLink(
                button.dataset
                    .removeDirectLink
            )
                .catch(
                    () => {}
                );
        }
    }
);


document.addEventListener(
    "keydown",
    event => {
        if (
            event.key ===
                "Escape" &&
            !mediaPanel.hidden
        ) {
            closePanel();
        }
    }
);


/*
 * ============================================================
 * STORAGE UPDATES
 * ============================================================
 */

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {
        if (
            areaName !==
            "local"
        ) {
            return;
        }


        if (
            changes[
                PENDING_LANDING_PANEL_KEY
            ]?.newValue ===
                "direct"
        ) {
            chrome.storage.local.remove(
                PENDING_LANDING_PANEL_KEY
            );

            showDirectLinks()
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                SUBSCRIPTION_STORAGE_KEY
            ]
        ) {
            renderSubscriptionState(
                changes[
                    SUBSCRIPTION_STORAGE_KEY
                ].newValue
            );
        }


        if (
            changes[
                window
                    .StreamShellWatchlist
                    .STORAGE_KEY
            ]
        ) {
            refreshWatchlistCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "watchlist" &&
                            !mediaPanel.hidden
                        ) {
                            showWatchlist();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellDirectLinks
                    .STORAGE_KEY
            ]
        ) {
            refreshDirectLinkCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "direct" &&
                            !mediaPanel.hidden
                        ) {
                            showDirectLinks();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellContinueWatching
                    .STORAGE_KEY
            ]
        ) {
            refreshContinueWatchingCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "continue" &&
                            !mediaPanel.hidden
                        ) {
                            showContinueWatching();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellHistory
                    .STORAGE_KEY
            ]
        ) {
            if (
                activePanel ===
                    "recent" &&
                !mediaPanel.hidden
            ) {
                showRecent()
                    .catch(
                        () => {}
                    );
            }
        }


        if (
            changes[
                window
                    .StreamShellAvailability
                    .SELECTED_MEDIA_KEY
            ]
        ) {
            const media =
                changes[
                    window
                        .StreamShellAvailability
                        .SELECTED_MEDIA_KEY
                ].newValue;


            selectedMediaKey =
                media
                    ? getMediaKey(
                        media
                    )
                    : null;
        }
    }
);


/*
 * ============================================================
 * INITIAL STATE
 * ============================================================
 */

Promise.all([
    loadSubscriptionState(),
    refreshWatchlistCache(),
    refreshDirectLinkCache(),
    refreshContinueWatchingCache(),
    refreshRecentCache(),
    loadSelectedMediaState(),
    loadWatchlistSortPreference()
])
    .then(
        async () => {
            const pending =
                await chrome.storage.local.get(
                    PENDING_LANDING_PANEL_KEY
                );


            if (
                pending[
                    PENDING_LANDING_PANEL_KEY
                ] ===
                    "direct"
            ) {
                await chrome.storage.local.remove(
                    PENDING_LANDING_PANEL_KEY
                );

                await showDirectLinks();
            }
        }
    )
    .catch(
        () => {}
    );


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
        }
    }
);


/*
 * ============================================================
 * SHARED CUSTOM PROVIDER ARTWORK
 * ============================================================
 * Landing and Dashboard show opposite halves of the SAME wide panorama.
 * Landing used to reject custom IDs and silently display Netflix instead.
 * Registry updates may arrive while Landing is already open; repaint in place.
 */
let landingProviderRegistry = defaultStreamShellProviderRegistry();
let lastLandingShellState = null;
let landingProviderRegistryUpdated = false;

chrome.storage.local.get(STREAM_SHELL_PROVIDER_REGISTRY_KEY).then(stored => {
    if (landingProviderRegistryUpdated) return; // A newer onChanged event won the race.
    landingProviderRegistry = normalizeStreamShellProviderRegistry(
        stored[STREAM_SHELL_PROVIDER_REGISTRY_KEY]
    );
    if (lastLandingShellState) renderState(lastLandingShellState);
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY]) return;
    landingProviderRegistryUpdated = true;
    landingProviderRegistry = normalizeStreamShellProviderRegistry(
        changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY].newValue
    );
    if (lastLandingShellState) renderState(lastLandingShellState);
});

function landingProviderBackground(provider, variant) {
    const builtin = STREAM_SHELL_BUILTIN_IDS.has(provider);
    const custom = landingProviderRegistry.providers.find(p => p.id === provider && p.kind === "custom");
    const recognized = builtin || Boolean(custom);
    const displayProvider = recognized ? provider : "netflix";
    const file = builtin
        ? `assets/backgrounds/${provider}_${variant}.png`
        : (custom ? streamShellCustomArtworkPath(custom.artKey, variant) : null);
    const neutral = "radial-gradient(ellipse at 77% 20%, rgba(70, 79, 104, .21), transparent 62%), linear-gradient(135deg, #0b0e17, #03050a)";
    return {
        provider: displayProvider,
        image: file ? `url("${chrome.runtime.getURL(file)}"), ${neutral}` : neutral
    };
}

/*
 * ============================================================
 * BACKGROUND STATE
 * ============================================================
 */

function renderState(
    state
) {
    lastLandingShellState = state;
    const backgroundVariant = document.body.dataset.layoutProfile === "compact"
        ? "compact" : "wide";
    const background = landingProviderBackground(state?.activeProvider || "netflix", backgroundVariant);
    document.body.dataset.provider = background.provider;


    const rightMode =
        state?.rightMode ||
        "dashboard";


    if (
        discordButton
    ) {
        discordButton.classList.toggle(
            "active",
            rightMode ===
                "discord"
        );

        discordButton.setAttribute(
            "aria-pressed",
            rightMode ===
                "discord"
                ? "true"
                : "false"
        );
    }


    if (twitchUtility) {
        twitchUtility.classList.toggle(
            "active",
            rightMode === "twitch"
        );
    }


    panorama.style.backgroundImage = background.image;
}
    // Compact Home owns a persistent media region; Watchlist is the default view.
    try { await showWatchlist(); } catch {}
})();
