    /*
     * ============================================================
     * YOUTUBE UTILITIES
     * ============================================================
     *
     * Stream Shell owns only the small behaviors the user actually uses:
     * theme gating, preferred quality, exact upload dates, auto-like and
     * a configurable cleanup layer. Everything remains scoped to managed
     * Stream Shell windows.
     */

    const YOUTUBE_THEME_STORAGE_KEY =
        "streamShellYoutubeThemeEnabled";

    const YOUTUBE_QUALITY_ENABLED_KEY =
        "streamShellYoutubeQualityEnabled";

    const YOUTUBE_QUALITY_KEY =
        "streamShellYoutubeQuality";

    const YOUTUBE_UPLOAD_DATE_ENABLED_KEY =
        "streamShellYoutubeUploadDateEnabled";

    const YOUTUBE_UPLOAD_DATE_FORMAT_KEY =
        "streamShellYoutubeUploadDateFormat";

    const YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY =
        "streamShellYoutubeUploadDateRelativeEnabled";

    const YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY =
        "streamShellYoutubeUploadDateRelativeDays";

    const YOUTUBE_AUTO_LIKE_ENABLED_KEY =
        "streamShellYoutubeAutoLikeEnabled";

    const YOUTUBE_AUTO_LIKE_TRIGGER_KEY =
        "streamShellYoutubeAutoLikeTrigger";

    const YOUTUBE_AUTO_LIKE_PERCENT_KEY =
        "streamShellYoutubeAutoLikePercent";

    const YOUTUBE_AUTO_LIKE_SECONDS_KEY =
        "streamShellYoutubeAutoLikeSeconds";

    const YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY =
        "streamShellYoutubeAutoLikeSubscribedOnly";

    const YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY =
        "streamShellYoutubeAutoLikeWaitForAds";

    const YOUTUBE_AUTO_LIKE_SHORTS_KEY =
        "streamShellYoutubeAutoLikeShorts";

    const YOUTUBE_KEEP_PLAYING_KEY =
        "streamShellYoutubeKeepPlaying";

    const YOUTUBE_LOOP_KEY =
        "streamShellYoutubeLoopEnabled";

    const YOUTUBE_LOOP_VIDEOS_KEY =
        "streamShellYoutubeLoopVideos";

    const YOUTUBE_LOOP_SHORTS_KEY =
        "streamShellYoutubeLoopShorts";

    const YOUTUBE_CLEANUP_SETTINGS = {
        streamShellYoutubeCleanupHideHomeFeed:
            "data-stream-shell-yt-hide-home-feed",

        streamShellYoutubeCleanupHideHomePromotions:
            "data-stream-shell-yt-hide-home-promotions",

        streamShellYoutubeCleanupHideVideoSidebar:
            "data-stream-shell-yt-hide-video-sidebar",

        streamShellYoutubeCleanupHideRecommended:
            "data-stream-shell-yt-hide-recommended",

        streamShellYoutubeCleanupHideLiveChat:
            "data-stream-shell-yt-hide-live-chat",

        streamShellYoutubeCleanupHidePlaylist:
            "data-stream-shell-yt-hide-playlist",

        streamShellYoutubeCleanupHideFundraiser:
            "data-stream-shell-yt-hide-fundraiser",

        streamShellYoutubeCleanupHideTranscriptChapters:
            "data-stream-shell-yt-hide-transcript-chapters",

        streamShellYoutubeCleanupHideEndScreenFeed:
            "data-stream-shell-yt-hide-end-screen-feed",

        streamShellYoutubeCleanupHideEndScreenCards:
            "data-stream-shell-yt-hide-end-screen-cards",

        streamShellYoutubeCleanupHideComments:
            "data-stream-shell-yt-hide-comments",

        streamShellYoutubeCleanupHideProfilePhotos:
            "data-stream-shell-yt-hide-profile-photos",

        streamShellYoutubeCleanupHideMixes:
            "data-stream-shell-yt-hide-mixes",

        streamShellYoutubeCleanupHideMerch:
            "data-stream-shell-yt-hide-merch",

        streamShellYoutubeCleanupHideVideoInfo:
            "data-stream-shell-yt-hide-video-info",

        streamShellYoutubeCleanupHideTopHeader:
            "data-stream-shell-yt-hide-top-header",

        streamShellYoutubeCleanupHideNotifications:
            "data-stream-shell-yt-hide-notifications",

        streamShellYoutubeCleanupHideInaptSearchResults:
            "data-stream-shell-yt-hide-inapt-search",

        streamShellYoutubeCleanupHideExploreTrending:
            "data-stream-shell-yt-hide-explore-trending",

        streamShellYoutubeCleanupHideMoreFromYouTube:
            "data-stream-shell-yt-hide-more-youtube",

        streamShellYoutubeCleanupHideShortsTab:
            "data-stream-shell-yt-hide-shorts-tab",

        streamShellYoutubeCleanupHideSubscriptions:
            "data-stream-shell-yt-hide-subscriptions",

        streamShellYoutubeCleanupDisableAutoplay:
            "data-stream-shell-yt-disable-autoplay",

        streamShellYoutubeCleanupDisableAnnotations:
            "data-stream-shell-yt-disable-annotations"
    };

    const YOUTUBE_UTILITY_DEFAULTS = {
        [YOUTUBE_THEME_STORAGE_KEY]:
            true,

        [YOUTUBE_QUALITY_ENABLED_KEY]:
            true,

        [YOUTUBE_QUALITY_KEY]:
            "hd1080",

        [YOUTUBE_UPLOAD_DATE_ENABLED_KEY]:
            true,

        [YOUTUBE_UPLOAD_DATE_FORMAT_KEY]:
            "friendly",

        [YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY]:
            true,

        [YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY]:
            1,

        [YOUTUBE_AUTO_LIKE_ENABLED_KEY]:
            true,

        [YOUTUBE_AUTO_LIKE_TRIGGER_KEY]:
            "percent",

        [YOUTUBE_AUTO_LIKE_PERCENT_KEY]:
            69,

        [YOUTUBE_AUTO_LIKE_SECONDS_KEY]:
            30,

        [YOUTUBE_AUTO_LIKE_SUBSCRIBED_ONLY_KEY]:
            false,

        [YOUTUBE_AUTO_LIKE_WAIT_FOR_ADS_KEY]:
            false,

        [YOUTUBE_AUTO_LIKE_SHORTS_KEY]:
            true,

        [YOUTUBE_KEEP_PLAYING_KEY]:
            true,

        [YOUTUBE_LOOP_KEY]:
            false,

        [YOUTUBE_LOOP_VIDEOS_KEY]:
            false,

        [YOUTUBE_LOOP_SHORTS_KEY]:
            true,

        streamShellYoutubeCleanupHideHomeFeed:
            false,

        streamShellYoutubeCleanupHideHomePromotions:
            true,

        streamShellYoutubeCleanupHideVideoSidebar:
            false,

        streamShellYoutubeCleanupHideRecommended:
            false,

        streamShellYoutubeCleanupHideLiveChat:
            false,

        streamShellYoutubeCleanupHidePlaylist:
            false,

        streamShellYoutubeCleanupHideFundraiser:
            false,

        streamShellYoutubeCleanupHideTranscriptChapters:
            false,

        streamShellYoutubeCleanupHideEndScreenFeed:
            false,

        streamShellYoutubeCleanupHideEndScreenCards:
            false,

        streamShellYoutubeCleanupHideComments:
            false,

        streamShellYoutubeCleanupHideProfilePhotos:
            false,

        streamShellYoutubeCleanupHideMixes:
            false,

        streamShellYoutubeCleanupHideMerch:
            true,

        streamShellYoutubeCleanupHideVideoInfo:
            false,

        streamShellYoutubeCleanupHideTopHeader:
            false,

        streamShellYoutubeCleanupHideNotifications:
            false,

        streamShellYoutubeCleanupHideInaptSearchResults:
            true,

        streamShellYoutubeCleanupHideExploreTrending:
            false,

        streamShellYoutubeCleanupHideMoreFromYouTube:
            true,

        streamShellYoutubeCleanupHideShortsTab:
            false,

        streamShellYoutubeCleanupHideSubscriptions:
            false,

        streamShellYoutubeCleanupDisableAutoplay:
            false,

        streamShellYoutubeCleanupDisableAnnotations:
            false
    };

    let youtubeUtilitySettings = {
        ...YOUTUBE_UTILITY_DEFAULTS
    };

    /*
     * 0.17 runtime: no observer is ever attached to documentElement.
     * Individual YouTube surfaces are observed only while the resource
     * governor allows DOM work.
     */
    const youtubeRuntimeObservers = {
        popup: null,
        player: null,
        guide: null
    };

    const youtubeRuntimeObserverRoots = {
        popup: null,
        player: null,
        guide: null
    };

    let youtubeRuntimeObserversActive =
        false;

    let youtubeUtilityDomTimer =
        null;

    let youtubeUtilitySettleGeneration =
        0;

    const youtubeUtilitySettleTimers =
        new Set();

    const youtubeUtilityPendingWork =
        new Set();

    let youtubeAutoLikeTimer =
        null;

    let youtubeLastQualityVideoId =
        "";

    let youtubeAutoLikedVideoIds =
        new Set();


    let youtubeLastAdSeenAt =
        0;


    const youtubeUploadDateCache =
        new Map();

    const youtubeUploadDateScriptScanAttempts =
        new Map();

    let youtubeUploadDateElement =
        null;

    let youtubeUploadDateOriginalText =
        null;

    const youtubeTextCleanupTargets =
        new Set();


    function getYouTubeVideoId() {
        try {
            const url =
                new URL(
                    location.href
                );


            if (
                url.pathname ===
                    "/watch"
            ) {
                return String(
                    url.searchParams.get(
                        "v"
                    ) ||
                    ""
                );
            }


            if (
                url.pathname.startsWith(
                    "/shorts/"
                )
            ) {
                return url.pathname
                    .split("/")
                    .filter(Boolean)[1] ||
                    "";
            }

        } catch {
        }


        return "";
    }


    function setYouTubeThemeMarker() {
        if (isProviderSafeModeEnabled("youtube")) {
            document.documentElement?.removeAttribute(
                "data-stream-shell-youtube-theme"
            );
            return;
        }

        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_THEME_STORAGE_KEY
            ] !== false
        ) {
            root.setAttribute(
                "data-stream-shell-youtube-theme",
                "true"
            );

        } else {
            root.removeAttribute(
                "data-stream-shell-youtube-theme"
            );
        }
    }


    function syncYouTubeCleanupMarkers() {
        if (isProviderSafeModeEnabled("youtube")) {
            const safeRoot = document.documentElement;
            if (safeRoot) {
                for (const attribute of Object.values(YOUTUBE_CLEANUP_SETTINGS)) {
                    safeRoot.removeAttribute(attribute);
                }
            }
            clearYouTubeTextCleanupTargets();
            return;
        }

        const root =
            document.documentElement;


        if (
            !root
        ) {
            return;
        }


        for (
            const [key, attribute]
            of Object.entries(
                YOUTUBE_CLEANUP_SETTINGS
            )
        ) {
            root.toggleAttribute(
                attribute,
                youtubeUtilitySettings[key] ===
                    true
            );
        }


        syncYouTubeTextCleanupTargets();
        syncYouTubeAutoplaySetting();
    }


    function clearYouTubeTextCleanupTargets() {
        for (
            const element
            of youtubeTextCleanupTargets
        ) {
            try {
                element?.removeAttribute?.(
                    "data-stream-shell-cleanup-hidden"
                );
            } catch {
            }
        }


        youtubeTextCleanupTargets.clear();
    }


    function syncYouTubeTextCleanupTargets(
        root =
            document
    ) {
        if (isProviderSafeModeEnabled("youtube")) {
            clearYouTubeTextCleanupTargets();
            return;
        }


        if (
            !youtubeUtilitySettings
                .streamShellYoutubeCleanupHideMoreFromYouTube
        ) {
            clearYouTubeTextCleanupTargets();
            return;
        }


        for (
            const element
            of [...youtubeTextCleanupTargets]
        ) {
            if (
                !element?.isConnected
            ) {
                youtubeTextCleanupTargets.delete(
                    element
                );
            }
        }


        const sections =
            root instanceof Element &&
            root.matches(
                "ytd-guide-section-renderer"
            )
                ? [root]
                : Array.from(
                    root?.querySelectorAll?.(
                        "ytd-guide-section-renderer"
                    ) ||
                    []
                );


        for (
            const section
            of sections
        ) {
            if (
                youtubeTextCleanupTargets.has(
                    section
                )
            ) {
                continue;
            }


            const text =
                String(
                    section.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim()
                    .toLowerCase();


            if (
                text.includes(
                    "more from youtube"
                ) ||
                text.includes(
                    "mehr von youtube"
                )
            ) {
                section.setAttribute(
                    "data-stream-shell-cleanup-hidden",
                    "true"
                );


                youtubeTextCleanupTargets.add(
                    section
                );
            }
        }
    }


    function syncYouTubeAutoplaySetting() {
        if (isProviderSafeModeEnabled("youtube")) {
            return;
        }

        if (
            !youtubeUtilitySettings
                .streamShellYoutubeCleanupDisableAutoplay
        ) {
            return;
        }


        const toggle =
            document.querySelector(
                ".ytp-autonav-toggle-button"
            );


        if (
            toggle?.getAttribute(
                "aria-checked"
            ) ===
                "true"
        ) {
            toggle.click();
        }
    }


    function getYouTubePlayer() {
        return document.getElementById(
            "movie_player"
        );
    }


