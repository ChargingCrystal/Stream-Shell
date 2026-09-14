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
        "Crunchyroll"
};


const PROVIDERS =
    new Set(
        Object.keys(
            PROVIDER_NAMES
        )
    );


const WORDMARKS = {
    youtube:
        "assets/providers/wordmarks/youtube.svg",

    netflix:
        "assets/providers/wordmarks/netflix.svg",

    prime:
        "assets/providers/wordmarks/prime.svg",

    disney:
        "assets/providers/wordmarks/disney.svg",

    crunchyroll:
        "assets/providers/wordmarks/crunchyroll.svg"
};


const RIGHT_MODE_NAMES = {
    dashboard:
        "Dashboard",

    discord:
        "Discord"
};


const clock =
    document.getElementById(
        "clock"
    );


const date =
    document.getElementById(
        "date"
    );


const brandArea =
    document.getElementById(
        "brand-area"
    );


const leftStatus =
    document.getElementById(
        "left-status"
    );


const rightStatus =
    document.getElementById(
        "right-status"
    );


const statusGroup =
    document.querySelector(
        ".status-group"
    );


const nowPlayingSlot =
    document.getElementById(
        "now-playing-slot"
    );


const nowPlayingPanel =
    document.getElementById(
        "now-playing"
    );


const nowPlayingSettingsButton =
    document.getElementById(
        "now-playing-settings"
    );


const settingsCenter =
    document.getElementById(
        "settings-center"
    );


const settingsProviderTabs =
    document.getElementById(
        "settings-provider-tabs"
    );


const settingsSidebar =
    document.getElementById(
        "settings-sidebar"
    );


const settingsContent =
    document.getElementById(
        "settings-content"
    );


const settingsImportFile =
    document.getElementById(
        "settings-import-file"
    );

const settingsIoStatus =
    document.getElementById(
        "settings-io-status"
    );


const settingsDiagnosticsOverlay =
    document.getElementById(
        "settings-diagnostics-overlay"
    );

const settingsDiagnosticsContent =
    document.getElementById(
        "settings-diagnostics-content"
    );

const settingsDiagnosticsStatus =
    document.getElementById(
        "settings-diagnostics-status"
    );

const reloadLeftSlot =
    document.getElementById(
        "reload-left-slot"
    );


const reloadLeftButton =
    document.getElementById(
        "reload-left"
    );


const nowPlayingArtwork =
    document.getElementById(
        "now-playing-artwork"
    );


const nowPlayingTitleViewport =
    document.getElementById(
        "now-playing-title-viewport"
    );


const nowPlayingTitle =
    document.getElementById(
        "now-playing-title"
    );


const nowPlayingState =
    document.getElementById(
        "now-playing-state"
    );


const nowPlayingRating =
    document.getElementById(
        "now-playing-rating"
    );


const nowPlayingProgress =
    document.getElementById(
        "now-playing-progress"
    );


const nowPlayingTime =
    document.getElementById(
        "now-playing-time"
    );


const panorama =
    document.getElementById(
        "panorama-background"
    );


const providerWordmark =
    document.getElementById(
        "provider-wordmark"
    );


const SELECTED_MEDIA_KEY =
    "streamShellSelectedMedia";


const SELECTED_AVAILABILITY_KEY =
    "streamShellSelectedAvailability";


const NOW_PLAYING_KEY_PREFIX =
    "streamShellNowPlaying_";


const NOW_PLAYING_KEYS =
    Object.fromEntries(
        Object.keys(
            PROVIDER_NAMES
        ).map(
            provider => [
                provider,
                `${NOW_PLAYING_KEY_PREFIX}${provider}`
            ]
        )
    );


let selectedMedia =
    null;


let selectedAvailability =
    null;


let nowPlayingByProvider =
    {};


let currentLeftMode =
    "landing";


let nowPlayingMarqueeSignature =
    "";


const nowPlayingArtworkFallbacks =
    new Map();


const nowPlayingTmdbMatches =
    new Map();


const failedNowPlayingArtworkSources =
    new Set();


