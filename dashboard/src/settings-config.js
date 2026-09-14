/*
 * ============================================================
 * PROVIDER SETTINGS CENTER
 * ============================================================
 */

const SETTINGS_DEFAULTS = {
    streamShellDisplayMode: "auto",

    streamShellTwitchKeepActive: true,
    streamShellTwitchAutoClaimPoints: true,
    streamShellTwitchAutoClaimDrops: true,
    streamShellTwitchPreventRaids: true,
    streamShellTwitchAutoMute: true,
    streamShellVolumeBoost_twitch: 100,
    streamShellAudioProfile_twitch: "normal",

    streamShellYoutubeThemeEnabled: true,
    streamShellNetflixThemeEnabled: true,
    streamShellWindowedPlayer_youtube: false,
    streamShellWindowedPlayer_crunchyroll: false,

    streamShellProviderSafeMode_youtube: false,
    streamShellProviderSafeMode_netflix: false,
    streamShellProviderSafeMode_prime: false,
    streamShellProviderSafeMode_disney: false,
    streamShellProviderSafeMode_crunchyroll: false,
    streamShellYoutubeExtrasEnabled: true,
    streamShellPrimeUiFixEnabled: true,
    streamShellPrimeHideXray: true,
    streamShellPrimeHideOverlay: true,
    streamShellPrimeAutoSkipIntro: false,
    streamShellPrimeAutoSkipRecap: false,
    streamShellPrimeAutoSkipPromos: true,
    streamShellPrimeSubtitleScale: "0.5",
    streamShellPrimeSubtitleColor: "#ffffff",
    streamShellPrimeSubtitleFont: "default",

    streamShellNetflixAutoSkipIntro: false,
    streamShellNetflixAutoSkipRecap: false,
    streamShellNetflixAutoNextEpisode: false,
    streamShellNetflixContinueWatching: true,

    streamShellCrunchyrollAutoSkipIntro: false,
    streamShellCrunchyrollAutoSkipRecap: false,
    streamShellCrunchyrollAutoSkipCredits: false,

    streamShellYoutubeKeepPlaying: true,
    streamShellYoutubeLoopEnabled: false,
    streamShellYoutubeLoopVideos: false,
    streamShellYoutubeLoopShorts: true,

    streamShellPlaybackSpeed_youtube: "1",
    streamShellPlaybackSpeed_netflix: "1",
    streamShellPlaybackSpeed_prime: "1",
    streamShellPlaybackSpeed_disney: "1",
    streamShellPlaybackSpeed_crunchyroll: "1",

    streamShellPlaybackAnarchy: false,
    streamShellSubtitleAnarchy: false,
    streamShellDvdAnarchy: false,


    streamShellDoubleClickWindowed_youtube: false,
    streamShellDoubleClickWindowed_crunchyroll: false,

    streamShellSubtitleOverride_youtube: false,
    streamShellSubtitleOverride_netflix: false,
    streamShellSubtitleOverride_disney: false,
    streamShellSubtitleScale_youtube: "1",
    streamShellSubtitleScale_netflix: "1",
    streamShellSubtitleScale_disney: "1",
    streamShellSubtitleColor_youtube: "#ffffff",
    streamShellSubtitleColor_netflix: "#ffffff",
    streamShellSubtitleColor_disney: "#ffffff",
    streamShellSubtitleFont_youtube: "default",
    streamShellSubtitleFont_netflix: "default",
    streamShellSubtitleFont_disney: "default",

    streamShellVolumeBoost_youtube: 100,
    streamShellVolumeBoost_netflix: 100,
    streamShellVolumeBoost_prime: 100,
    streamShellVolumeBoost_disney: 100,
    streamShellVolumeBoost_crunchyroll: 100,

    streamShellAudioProfile_youtube: "normal",
    streamShellAudioProfile_netflix: "normal",
    streamShellAudioProfile_prime: "normal",
    streamShellAudioProfile_disney: "normal",
    streamShellAudioProfile_crunchyroll: "normal",

    streamShellSleepTimerAction: "pause",
    streamShellContinueWatchingCompletePercent: 95,

    streamShellCrunchyrollBlurEpisodeThumbnails: false,

    streamShellYoutubeQualityEnabled: true,
    streamShellYoutubeQuality: "hd1080",

    streamShellYoutubeUploadDateEnabled: true,
    streamShellYoutubeUploadDateFormat: "friendly",
    streamShellYoutubeUploadDateRelativeEnabled: true,
    streamShellYoutubeUploadDateRelativeDays: 1,

    streamShellYoutubeAutoLikeEnabled: true,
    streamShellYoutubeAutoLikeTrigger: "percent",
    streamShellYoutubeAutoLikePercent: 69,
    streamShellYoutubeAutoLikeSeconds: 30,
    streamShellYoutubeAutoLikeSubscribedOnly: false,
    streamShellYoutubeAutoLikeWaitForAds: false,
    streamShellYoutubeAutoLikeShorts: true,

    streamShellYoutubeCleanupHideHomeFeed: false,
    streamShellYoutubeCleanupHideHomePromotions: true,
    streamShellYoutubeCleanupHideVideoSidebar: false,
    streamShellYoutubeCleanupHideRecommended: false,
    streamShellYoutubeCleanupHideLiveChat: false,
    streamShellYoutubeCleanupHidePlaylist: false,
    streamShellYoutubeCleanupHideFundraiser: false,
    streamShellYoutubeCleanupHideTranscriptChapters: false,
    streamShellYoutubeCleanupHideEndScreenFeed: false,
    streamShellYoutubeCleanupHideEndScreenCards: false,
    streamShellYoutubeCleanupHideComments: false,
    streamShellYoutubeCleanupHideProfilePhotos: false,
    streamShellYoutubeCleanupHideMixes: false,
    streamShellYoutubeCleanupHideMerch: true,
    streamShellYoutubeCleanupHideVideoInfo: false,
    streamShellYoutubeCleanupHideTopHeader: false,
    streamShellYoutubeCleanupHideNotifications: false,
    streamShellYoutubeCleanupHideInaptSearchResults: true,
    streamShellYoutubeCleanupHideExploreTrending: false,
    streamShellYoutubeCleanupHideMoreFromYouTube: true,
    streamShellYoutubeCleanupHideShortsTab: false,
    streamShellYoutubeCleanupHideSubscriptions: false,
    streamShellYoutubeCleanupDisableAutoplay: false,
    streamShellYoutubeCleanupDisableAnnotations: false
};

const SETTINGS_SECTIONS = {
    general: [
        ["display", "Display"],
        ["anarchy", "Anarchy"],
        ["twitch", "Twitch"]
    ],
    youtube: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["quality", "Quality"],
        ["upload-date", "Upload date"],
        ["auto-like", "Auto Like"],
        ["cleanup", "Cleanup"],
        ["safe-mode", "Safe mode"]
    ],
    netflix: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    prime: [
        ["search", "Search"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    disney: [
        ["search", "Search"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["subtitles", "Subtitles"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ],
    crunchyroll: [
        ["search", "Search"],
        ["appearance", "Appearance"],
        ["player", "Player"],
        ["playback", "Playback"],
        ["automation", "Automation"],
        ["audio", "Audio"],
        ["safe-mode", "Safe mode"]
    ]
};

const SETTINGS_SEARCH_ITEMS = {
    youtube: [
        ["appearance", "Stream Shell background", "background wallpaper transparent shell appearance theme"],
        ["player", "Windowed fullscreen", "windowed fullscreen player layout"],
        ["player", "Fullscreen quick actions", "like dislike share more buttons controls extras"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["playback", "Double-click windowed fullscreen", "double click fullscreen gesture"],
        ["playback", "Override loop behavior", "loop looping replay repeat"],
        ["playback", "Regular videos", "loop regular videos"],
        ["playback", "Shorts", "loop shorts vertical videos"],
        ["automation", "Keep Playing", "continue watching inactivity confirmation automation"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["quality", "Set video quality automatically", "quality resolution 1080p 4k 8k hd"],
        ["quality", "Preferred quality", "quality resolution 1080p 4k 8k hd"],
        ["upload-date", "Show exact upload date", "upload published date timestamp time"],
        ["upload-date", "Date style", "upload date 12 hour clock format"],
        ["upload-date", "Keep relative wording", "upload date hours ago relative"],
        ["auto-like", "Auto Like videos", "automatic like autolike"],
        ["auto-like", "Threshold type", "auto like percent seconds threshold"],
        ["auto-like", "Apply to Shorts", "auto like shorts"],
        ["auto-like", "Subscribed channels only", "auto like subscriptions channels"],
        ["auto-like", "Wait for ads to finish", "auto like ads"],
        ["cleanup", "Hide Home Feed", "cleanup home feed"],
        ["cleanup", "Hide Home Promotions", "cleanup home featured promo promotion banner statement youtube featured"],
        ["cleanup", "Hide Video Sidebar", "cleanup sidebar recommendations"],
        ["cleanup", "Hide Recommended", "cleanup recommendations"],
        ["cleanup", "Hide Live Chat", "cleanup live chat"],
        ["cleanup", "Hide Playlist", "cleanup playlist"],
        ["cleanup", "Hide Transcript / Chapters", "cleanup transcript chapters"],
        ["cleanup", "Hide End Screen Feed", "cleanup endscreen feed"],
        ["cleanup", "Hide End Screen Cards", "cleanup endscreen cards"],
        ["cleanup", "Hide Comments", "cleanup comments"],
        ["cleanup", "Hide Mixes", "cleanup mixes radio"],
        ["cleanup", "Hide Merch, Tickets, Offers", "cleanup merch tickets offers"],
        ["cleanup", "Hide Video Info", "cleanup video info metadata"],
        ["cleanup", "Hide Top Header", "cleanup header masthead"],
        ["cleanup", "Hide Notifications", "cleanup notifications"],
        ["cleanup", "Hide Inapt Search Results", "cleanup search results shelves"],
        ["cleanup", "Hide Explore / Trending", "cleanup explore trending"],
        ["cleanup", "Hide More from YouTube", "cleanup more from youtube guide"],
        ["cleanup", "Hide Shorts Tab", "cleanup shorts navigation"],
        ["cleanup", "Hide Subscriptions", "cleanup subscriptions navigation"],
        ["cleanup", "Disable Autoplay", "cleanup autoplay"],
        ["cleanup", "Disable Annotations", "cleanup annotations cards"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    netflix: [
        ["appearance", "Stream Shell background", "background wallpaper transparent shell appearance theme"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Start next episode", "automation next episode binge credits"],
        ["automation", "Dismiss still-watching prompt", "automation continue watching inactivity"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    prime: [
        ["player", "Ultrawide player UI fix", "player ultrawide ui controls layout"],
        ["player", "Hide X-Ray", "player xray trivia cast"],
        ["player", "Hide dark overlay", "player dim overlay"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Skip promos", "automation skip promos trailer preroll"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    disney: [
        ["playback", "Default playback speed", "speed rate playback"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["subtitles", "Custom subtitle style", "subtitles captions style override"],
        ["subtitles", "Subtitle scale", "subtitles captions size scale"],
        ["subtitles", "Text color", "subtitles captions color"],
        ["subtitles", "Font family", "subtitles captions font"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ],
    crunchyroll: [
        ["appearance", "Blur episode thumbnails", "spoiler protection blur thumbnails artwork"],
        ["player", "Windowed fullscreen", "windowed fullscreen player layout"],
        ["playback", "Default playback speed", "speed rate playback"],
        ["playback", "Double-click windowed fullscreen", "double click fullscreen gesture"],
        ["automation", "Skip intros", "automation skip intro"],
        ["automation", "Skip recaps", "automation skip recap"],
        ["automation", "Skip credits", "automation skip credits outro"],
        ["automation", "Sleep timer", "sleep stop pause 30 60 90 end of video"],
        ["audio", "Processing mode", "audio normal dialogue night speech compressor"],
        ["audio", "Provider volume", "volume booster gain amplification audio"],
        ["safe-mode", "Provider Safe Mode", "safe mode isolation diagnostics dom ui debug provider"]
    ]
};


function defaultSettingsSection(provider) {
    const sections = SETTINGS_SECTIONS[provider] || [];

    return sections.find(([id]) => id !== "search")?.[0] ||
        sections[0]?.[0] ||
        "search";
}

let settingsProvider = "youtube";
let settingsSection = "appearance";
let settingsValues = {
    ...SETTINGS_DEFAULTS
};
let settingsLoaded = false;
let settingsCloseTimer = null;
let sleepTimerState = null;
let settingsIoStatusTimer = null;
let settingsSearchQuery = "";
let settingsDiagnosticsSnapshot = null;
let settingsDiagnosticsCloseTimer = null;

const ANARCHY_NEON_COLORS = [
    "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
    "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
    "#b000ff", "#7c00ff", "#651fff", "#304ffe",
    "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
    "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
    "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
    "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
    "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
];

let anarchySettingsColorTimer = null;
const anarchySettingsColorBags = { playback: [], subtitles: [], dvd: [] };

function refillAnarchyColorBag(kind) {
    const bag = [...ANARCHY_NEON_COLORS];
    for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    anarchySettingsColorBags[kind] = bag;
}

function nextAnarchyColor(kind) {
    if (!anarchySettingsColorBags[kind]?.length) {
        refillAnarchyColorBag(kind);
    }
    return anarchySettingsColorBags[kind].pop();
}

function hexToRgbTriplet(hex) {
    const numeric = Number.parseInt(String(hex || "").replace(/^#/, ""), 16);
    if (!Number.isFinite(numeric)) return "255, 0, 255";
    return `${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}`;
}

function paintAnarchySettings() {
    if (!settingsCenter || settingsSection !== "anarchy") return;
    settingsCenter.style.setProperty(
        "--anarchy-playback-rgb",
        hexToRgbTriplet(nextAnarchyColor("playback"))
    );
    settingsCenter.style.setProperty(
        "--anarchy-subtitle-rgb",
        hexToRgbTriplet(nextAnarchyColor("subtitles"))
    );
    settingsCenter.style.setProperty(
        "--anarchy-dvd-rgb",
        hexToRgbTriplet(nextAnarchyColor("dvd"))
    );
}

function startAnarchySettingsColors() {
    if (anarchySettingsColorTimer) return;
    paintAnarchySettings();
    anarchySettingsColorTimer = setInterval(paintAnarchySettings, 200);
}

function stopAnarchySettingsColors() {
    if (!anarchySettingsColorTimer) return;
    clearInterval(anarchySettingsColorTimer);
    anarchySettingsColorTimer = null;
}

function syncAnarchySettingsVisuals() {
    const active = settingsSection === "anarchy";
    settingsContent?.classList.toggle("settings-content-anarchy", active);
    if (active) startAnarchySettingsColors();
    else stopAnarchySettingsColors();
}

