function renderYouTubeSettings(section) {
    if (section === "appearance") {
        return settingsPage(
            "Appearance",
            settingsSubgroup(
                "Dashboard",
                settingSwitch(
                    "streamShellYoutubeThemeEnabled",
                    "Stream Shell background",
                    "Use the custom YouTube wallpaper and transparent shell surfaces."
                )
            )
        );
    }

    if (section === "player") {
        return settingsPage(
            "Player",
            settingsSubgroup(
                "Display-specific player",
                renderDisplayTargetScopeRow(
                    "Windowed fullscreen and its quick actions are stored separately for 32:9, 16:9 and 16:10."
                ) +
                settingSwitch(
                    "streamShellWindowedPlayer_youtube",
                    "Windowed fullscreen",
                    "Fill the Stream Shell provider pane with the YouTube player."
                ) +
                settingSwitch(
                    "streamShellYoutubeExtrasEnabled",
                    "Fullscreen quick actions",
                    "Show YouTube's Like, Dislike, Share and More actions in windowed fullscreen."
                )
            )
        );
    }

    if (section === "playback") {
        return settingsPage(
            "Playback",
            settingsSubgroup(
                "Speed",
                settingSelect(
                    playbackSpeedKey("youtube"),
                    "Default playback speed",
                    "Keep the provider at this speed while a video is playing.",
                    [
                        ["0.5", "0.5x"],
                        ["0.75", "0.75x"],
                        ["1", "1.0x"],
                        ["1.25", "1.25x"],
                        ["1.5", "1.5x"],
                        ["1.75", "1.75x"],
                        ["2", "2.0x"]
                    ]
                )
            ) +
            settingsSubgroup(
                "Windowed fullscreen",
                renderDisplayTargetScopeRow(
                    "The double-click gesture is stored separately for 32:9, 16:9 and 16:10."
                ) +
                settingSwitch(
                    "streamShellDoubleClickWindowed_youtube",
                    "Double-click windowed fullscreen",
                    "Double-click the player to toggle Stream Shell's windowed fullscreen mode."
                )
            ) +
            settingsSubgroup(
                "Loop",
                settingSwitch(
                    "streamShellYoutubeLoopEnabled",
                    "Override loop behavior",
                    "Control looping separately for regular videos and Shorts. Turn this off to use YouTube's normal behavior."
                ) +
                settingDependentSwitch(
                    "streamShellYoutubeLoopVideos",
                    "Regular videos",
                    "Loop regular YouTube videos when the override is enabled.",
                    settingValue("streamShellYoutubeLoopEnabled") === true
                ) +
                settingDependentSwitch(
                    "streamShellYoutubeLoopShorts",
                    "Shorts",
                    "Loop Shorts when the override is enabled.",
                    settingValue("streamShellYoutubeLoopEnabled") === true
                )
            ),
            "Playback speed and loop behavior remain provider-wide; only the Windowed Fullscreen gesture is target-specific.",
            "three"
        );
    }

    if (section === "automation") {
        return settingsPage(
            "Automation",
            settingsSubgroup(
                "Continuous playback",
                settingSwitch(
                    "streamShellYoutubeKeepPlaying",
                    "Keep Playing",
                    "Dismiss YouTube's inactivity confirmation and resume the video."
                )
            ) +
            renderSleepTimerSubgroup("youtube"),
            "Ordinary user pauses are left alone.",
            "two"
        );
    }

    if (section === "subtitles") {
        return renderSubtitleSettings("youtube");
    }

    if (section === "audio") {
        return renderVolumeSettings("youtube");
    }

    if (section === "quality") {
        return settingsPage(
            "Automatic quality",
            settingsSubgroup(
                "Playback quality",
                settingSwitch(
                    "streamShellYoutubeQualityEnabled",
                    "Set video quality automatically",
                    "Apply the preferred quality after navigation and when a video loads."
                ) +
                settingSelect(
                    "streamShellYoutubeQuality",
                    "Preferred quality",
                    "1080p is the current default; lower qualities are used when the video does not offer it.",
                    [
                        ["auto", "Auto"],
                        ["highest", "Highest available"],
                        ["highres", "4320p · 8K"],
                        ["hd2160", "2160p · 4K"],
                        ["hd1440", "1440p"],
                        ["hd1080", "1080p · HD"],
                        ["hd720", "720p · HD"],
                        ["large", "480p"],
                        ["medium", "360p"],
                        ["small", "240p"],
                        ["tiny", "144p"]
                    ]
                ),
                "Used automatically whenever a YouTube video starts."
            )
        );
    }

    if (section === "upload-date") {
        return settingsPage(
            "Upload date",
            settingsSubgroup(
                "Display",
                settingSwitch(
                    "streamShellYoutubeUploadDateEnabled",
                    "Show exact upload date",
                    "Replace YouTube's vague date label when a timestamp is available."
                ) +
                settingSelect(
                    "streamShellYoutubeUploadDateFormat",
                    "Date style",
                    "All styles use a 12-hour clock when a time is available.",
                    [
                        ["friendly", "Aug 28, 2026 · 5:12 PM"],
                        ["numeric", "08/28/2026 · 5:12 PM"],
                        ["iso", "2026-08-28 · 5:12 PM"]
                    ]
                )
            ) +
            settingsSubgroup(
                "Fresh uploads",
                settingSwitch(
                    "streamShellYoutubeUploadDateRelativeEnabled",
                    "Keep relative wording",
                    "Very recent videos can stay as “x hours ago” before switching to the exact date."
                ) +
                settingNumber(
                    "streamShellYoutubeUploadDateRelativeDays",
                    "Relative window",
                    "Number of days before the exact date takes over.",
                    0,
                    30,
                    "days"
                )
            ),
            "",
            "two"
        );
    }

    if (section === "auto-like") {
        const trigger = String(
            settingValue("streamShellYoutubeAutoLikeTrigger")
        );

        const threshold = trigger === "seconds"
            ? settingNumber(
                "streamShellYoutubeAutoLikeSeconds",
                "Elapsed seconds",
                "Like after this many seconds of playback.",
                1,
                7200,
                "sec"
            )
            : settingNumber(
                "streamShellYoutubeAutoLikePercent",
                "Video watched",
                "Like after this percentage of the video has played.",
                1,
                100,
                "%"
            );

        return settingsPage(
            "Auto Like",
            settingsSubgroup(
                "Automatic likes",
                settingSwitch(
                    "streamShellYoutubeAutoLikeEnabled",
                    "Auto Like videos",
                    "Automatically like videos after the selected threshold."
                )
            ) +
            settingsSubgroup(
                "Like after",
                settingSegmented(
                    "streamShellYoutubeAutoLikeTrigger",
                    "Threshold type",
                    "Choose whether the threshold uses watch percentage or elapsed time.",
                    [
                        ["percent", "Percent"],
                        ["seconds", "Seconds"]
                    ]
                ) +
                threshold
            ) +
            settingsSubgroup(
                "Scope & behavior",
                settingSwitch(
                    "streamShellYoutubeAutoLikeShorts",
                    "Apply to Shorts",
                    "Use the same threshold for the active Shorts player."
                ) +
                settingSwitch(
                    "streamShellYoutubeAutoLikeSubscribedOnly",
                    "Subscribed channels only",
                    "Leave disabled to treat every channel the same."
                ) +
                settingSwitch(
                    "streamShellYoutubeAutoLikeWaitForAds",
                    "Wait for ads to finish",
                    "Never fire the Like action while YouTube reports an active ad."
                )
            ),
            "Configure when Auto Like runs and where it applies.",
            "three"
        );
    }

    if (section === "cleanup") {
        const cleanupGroup = (title, note, items) =>
            settingsSubgroup(
                title,
                items.map(
                    ([key, label, description]) =>
                        settingSwitch(key, label, description)
                ).join(""),
                note
            );

        return settingsPage(
            "YouTube cleanup",
            settingsColumn(
                cleanupGroup(
                    "Feeds & recommendations",
                    "Hide feeds, recommendations and end-screen suggestions.",
                    [
                        ["streamShellYoutubeCleanupHideHomeFeed", "Hide Home Feed", "Remove the homepage feed."],
                        ["streamShellYoutubeCleanupHideHomePromotions", "Hide Home Promotions", "Remove YouTube featured, statement and promotional hero banners from Home."],
                        ["streamShellYoutubeCleanupHidePlayables", "Hide Playables", "Remove YouTube Playables / instant-game shelves and navigation entries."],
                        ["streamShellYoutubeCleanupHideVideoSidebar", "Hide Video Sidebar", "Remove the entire watch-page secondary column."],
                        ["streamShellYoutubeCleanupHideRecommended", "Hide Recommended", "Hide recommendation items beside videos."],
                        ["streamShellYoutubeCleanupHideMixes", "Hide Mixes", "Hide YouTube Mix / radio items."],
                        ["streamShellYoutubeCleanupHideEndScreenFeed", "Hide End Screen Feed", "Remove the end-screen feed."],
                        ["streamShellYoutubeCleanupHideEndScreenCards", "Hide End Screen Cards", "Remove individual end-screen cards."]
                    ]
                ) +
                cleanupGroup(
                    "Search",
                    "Hide unrelated shelves mixed into search results.",
                    [
                        ["streamShellYoutubeCleanupHideInaptSearchResults", "Hide Inapt Search Results", "Remove shelf-style detours mixed into search results."]
                    ]
                )
            ) +
            settingsColumn(
                cleanupGroup(
                    "Watch page",
                    "Hide optional panels and extras on watch pages.",
                    [
                        ["streamShellYoutubeCleanupHideLiveChat", "Hide Live Chat", "Hide live chat frames."],
                        ["streamShellYoutubeCleanupHidePlaylist", "Hide Playlist", "Hide the watch-page playlist panel."],
                        ["streamShellYoutubeCleanupHideFundraiser", "Hide Fundraiser", "Hide donation and fundraiser shelves."],
                        ["streamShellYoutubeCleanupHideTranscriptChapters", "Hide Transcript / Chapters", "Hide transcript and chapter engagement panels."],
                        ["streamShellYoutubeCleanupHideComments", "Hide Comments", "Remove the comments section."],
                        ["streamShellYoutubeCleanupHideProfilePhotos", "Hide Profile Photos", "Hide channel/profile avatars in YouTube content."],
                        ["streamShellYoutubeCleanupHideMerch", "Hide Merch, Tickets, Offers", "Remove merch, ticket and product shelves."],
                        ["streamShellYoutubeCleanupHideVideoInfo", "Hide Video Info", "Hide description and lower metadata blocks."]
                    ]
                )
            ) +
            settingsColumn(
                cleanupGroup(
                    "Navigation & header",
                    "Hide items from YouTube’s header and navigation.",
                    [
                        ["streamShellYoutubeCleanupHideTopHeader", "Hide Top Header", "Remove YouTube's masthead."],
                        ["streamShellYoutubeCleanupHideNotifications", "Hide Notifications", "Remove the notification button."],
                        ["streamShellYoutubeCleanupHideExploreTrending", "Hide Explore / Trending", "Hide Explore and Trending navigation entries."],
                        ["streamShellYoutubeCleanupHideMoreFromYouTube", "Hide More from YouTube", "Remove the More from YouTube guide section."],
                        ["streamShellYoutubeCleanupHideShortsTab", "Hide Shorts Tab", "Hide Shorts navigation entries."],
                        ["streamShellYoutubeCleanupHideSubscriptions", "Hide Subscriptions", "Hide the Subscriptions navigation entry."]
                    ]
                ) +
                cleanupGroup(
                    "Playback",
                    "Control autoplay and legacy annotation elements.",
                    [
                        ["streamShellYoutubeCleanupDisableAutoplay", "Disable Autoplay", "Keep YouTube's player autoplay toggle off."],
                        ["streamShellYoutubeCleanupDisableAnnotations", "Disable Annotations", "Hide legacy annotation/card teaser surfaces."]
                    ]
                )
            ),
            "Choose which parts of YouTube to hide or disable.",
            "columns-three"
        );
    }

    return "";
}

function providerSafeModeSettingKey(provider) {
    return `streamShellProviderSafeMode_${provider}`;
}

function renderProviderSafeModeSettings(provider) {
    const label = PROVIDER_NAMES[provider] || provider;

    return settingsPage(
        "Safe mode",
        settingsSubgroup(
            "Provider isolation",
            settingSwitch(
                providerSafeModeSettingKey(provider),
                `${label} Safe Mode`,
                "Temporarily suppress Stream Shell's provider-specific DOM/UI features while keeping Provider API, Continue/Resume, Now Playing and Diagnostics active."
            )
        ),
        "Your normal provider feature settings are preserved and restored when Safe Mode is disabled."
    );
}

function settingsSectionLabel(provider, section) {
    return (SETTINGS_SECTIONS[provider] || [])
        .find(([id]) => id === section)?.[1] ||
        section;
}

function renderSettingsSearchResults(provider, query) {
    const normalized = String(query || "").trim().toLowerCase();

    if (!normalized) {
        return `
            <div class="settings-search-empty">
                <strong>Search ${PROVIDER_NAMES[provider] || provider}</strong>
                <span>Type a setting, behavior or feature name to jump straight to it.</span>
            </div>
        `;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    const matches = [
        ...(SETTINGS_SEARCH_ITEMS[provider] || [])
    ]
        .filter(([section, title, keywords]) => {
            const haystack = `${settingsSectionLabel(provider, section)} ${title} ${keywords}`.toLowerCase();
            return words.every(word => haystack.includes(word));
        })
        .slice(0, 30);

    if (!matches.length) {
        return `
            <div class="settings-search-empty">
                <strong>No matching settings</strong>
                <span>Try a broader term such as “volume”, “subtitle”, “skip”, “loop” or “quality”.</span>
            </div>
        `;
    }

    return matches.map(([section, title, keywords]) => {
        const label = settingsSectionLabel(provider, section);
        const hint = String(keywords || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7)
            .join(" ");

        return `
            <button
                type="button"
                class="settings-search-result"
                data-settings-search-section="${section}"
            >
                <span class="settings-search-result-copy">
                    <strong>${title}</strong>
                    <span>${label}${hint ? ` · ${hint}` : ""}</span>
                </span>
                <span class="settings-search-result-arrow" aria-hidden="true">›</span>
            </button>
        `;
    }).join("");
}

function renderSettingsSearch(provider) {
    return `
        <section class="settings-group settings-group-page settings-search-page">
            <div class="settings-group-heading">
                <h2>Search</h2>
                <p>Find settings for ${PROVIDER_NAMES[provider] || provider} without hunting through every section.</p>
            </div>

            <div class="settings-search-box">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5"></circle>
                    <path d="M16 16L21 21"></path>
                </svg>
                <input
                    id="settings-search-input"
                    class="settings-search-input"
                    type="search"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="Search ${PROVIDER_NAMES[provider] || provider} settings…"
                    aria-label="Search ${PROVIDER_NAMES[provider] || provider} settings"
                >
            </div>

            <div
                id="settings-search-results"
                class="settings-search-results"
            >${renderSettingsSearchResults(provider, settingsSearchQuery)}</div>
        </section>
    `;
}

function updateSettingsSearchResults() {
    const results = document.getElementById("settings-search-results");
    if (!results) return;
    results.innerHTML = renderSettingsSearchResults(settingsProvider, settingsSearchQuery);
}

