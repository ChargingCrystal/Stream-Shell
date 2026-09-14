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

const twitchDropsButton =
    document.getElementById(
        "twitch-drops"
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


