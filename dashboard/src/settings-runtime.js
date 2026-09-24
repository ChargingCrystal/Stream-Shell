function renderSettingsContent() {
    if (!settingsContent) {
        return;
    }

    if (settingsCenter) {
        settingsCenter.dataset.settingsSection = settingsSection;
    }

    let html = "";

    if (settingsSection === "search") {
        html = renderSettingsSearch(settingsProvider);
    }

    if (settingsSection === "display") {
        html = renderDisplaySettings();
    }

    if (settingsProvider === "general" && settingsSection === "twitch") {
        html = renderTwitchUtilitySettings();
    }

    if (settingsSection === "audio") {
        html = renderVolumeSettings(settingsProvider);
    }

    if (settingsProvider === "general" && settingsSection === "anarchy") {
        html = renderAnarchySettings();
    }

    if (settingsSection === "safe-mode") {
        html = renderProviderSafeModeSettings(settingsProvider);
    }

    if (settingsProvider === "youtube" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        html = renderYouTubeSettings(settingsSection);
    }

    if (settingsProvider === "netflix" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "appearance") {
            html = settingsPage(
                "Appearance",
                settingsSubgroup(
                    "Dashboard",
                    settingSwitch(
                        "streamShellNetflixThemeEnabled",
                        "Stream Shell background",
                        "Use the custom Netflix wallpaper outside playback routes."
                    )
                )
            );
        }

        if (settingsSection === "playback") {
            html = renderPlaybackSettings("netflix");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellNetflixAutoSkipIntro",
                        "Skip intros",
                        "Press Netflix's Skip Intro action when it appears."
                    ) +
                    settingSwitch(
                        "streamShellNetflixAutoSkipRecap",
                        "Skip recaps",
                        "Press Netflix's Skip Recap action when it appears."
                    )
                ) +
                settingsSubgroup(
                    "Binge watching",
                    settingSwitch(
                        "streamShellNetflixAutoNextEpisode",
                        "Start next episode",
                        "Start the next episode as soon as Netflix exposes the action."
                    ) +
                    settingSwitch(
                        "streamShellNetflixContinueWatching",
                        "Dismiss still-watching prompt",
                        "Confirm Netflix's inactivity prompt automatically."
                    )
                ) +
                renderSleepTimerSubgroup("netflix"),
                "Each action only runs when Netflix exposes its matching player control.",
                "three"
            );
        }

        if (settingsSection === "subtitles") {
            html = renderSubtitleSettings("netflix");
        }
    }

    if (settingsProvider === "prime" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "player") {
            html = settingsPage(
                "Player",
                settingsSubgroup(
                    "Layout",
                    settingSwitch(
                        "streamShellPrimeUiFixEnabled",
                        "Ultrawide player UI fix",
                        "Keep Prime Video's controls aligned correctly in the Stream Shell pane."
                    )
                ) +
                settingsSubgroup(
                    "Clean player",
                    settingSwitch(
                        "streamShellPrimeHideXray",
                        "Hide X-Ray",
                        "Keep cast, trivia and scene information out of the player overlay."
                    ) +
                    settingSwitch(
                        "streamShellPrimeHideOverlay",
                        "Hide dark overlay",
                        "Keep the picture clear when Prime Video shows its player controls."
                    )
                ),
                "Player cleanup without removing the controls you still use.",
                "two"
            );
        }

        if (settingsSection === "playback") {
            html = renderPlaybackSettings("prime");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellPrimeAutoSkipIntro",
                        "Skip intros",
                        "Press Prime Video's Skip Intro action as soon as it appears."
                    ) +
                    settingSwitch(
                        "streamShellPrimeAutoSkipRecap",
                        "Skip recaps",
                        "Skip previously-on and recap segments automatically."
                    ) +
                    settingSwitch(
                        "streamShellPrimeAutoSkipPromos",
                        "Skip promos",
                        "Skip pre-roll trailers and promotional clips when Prime offers a skip button."
                    )
                ) +
                renderSleepTimerSubgroup("prime"),
                "Skip actions only run when Prime Video exposes a matching control.",
                "two"
            );
        }

        if (settingsSection === "subtitles") {
            html = settingsPage(
                "Subtitles",
                settingsSubgroup(
                    "Size",
                    settingSelect(
                        "streamShellPrimeSubtitleScale",
                        "Subtitle scale",
                        "Scale Prime Video subtitles relative to their normal size.",
                        [
                            ["0.5", "0.5x"],
                            ["0.8", "0.8x"],
                            ["1", "1.0x"],
                            ["1.25", "1.25x"],
                            ["1.5", "1.5x"],
                            ["2", "2.0x"]
                        ]
                    )
                ) +
                settingsSubgroup(
                    "Color",
                    settingSelect(
                        "streamShellPrimeSubtitleColor",
                        "Text color",
                        "Choose a readable subtitle color.",
                        [
                            ["#ffffff", "White"],
                            ["#e8e8e8", "Soft white"],
                            ["#fff0b3", "Warm"],
                            ["#c7e6ff", "Light blue"],
                            ["#d2efd8", "Light green"]
                        ]
                    )
                ) +
                settingsSubgroup(
                    "Font",
                    settingSelect(
                        "streamShellPrimeSubtitleFont",
                        "Font family",
                        "Use Prime Video's font or override it locally.",
                        [
                            ["default", "Default"],
                            ["Arial", "Arial"],
                            ["Helvetica", "Helvetica"],
                            ["Georgia", "Georgia"],
                            ["Times New Roman", "Times New Roman"],
                            ["Courier New", "Courier New"],
                            ["Verdana", "Verdana"],
                            ["Roboto", "Roboto"]
                        ]
                    )
                ),
                "Subtitle styling is applied locally and updates without reloading the stream.",
                "three"
            );
        }
    }

    if (settingsProvider === "disney" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "playback") {
            html = renderPlaybackSettings("disney");
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                renderSleepTimerSubgroup("disney")
            );
        }

        if (settingsSection === "subtitles") {
            html = renderSubtitleSettings("disney");
        }
    }

    if (settingsProvider === "crunchyroll" && !["search", "display", "audio", "anarchy", "safe-mode"].includes(settingsSection)) {
        if (settingsSection === "appearance") {
            html = settingsPage(
                "Appearance",
                settingsSubgroup(
                    "Spoiler protection",
                    settingSwitch(
                        "streamShellCrunchyrollBlurEpisodeThumbnails",
                        "Blur episode thumbnails",
                        "Blur artwork on links that open Crunchyroll episodes."
                    )
                )
            );
        }

        if (settingsSection === "player") {
            html = settingsPage(
                "Player",
                settingsSubgroup(
                    "Display-specific player",
                    renderDisplayTargetScopeRow(
                        "Windowed fullscreen is stored separately for 32:9, 16:9 and 16:10."
                    ) +
                    settingSwitch(
                        "streamShellWindowedPlayer_crunchyroll",
                        "Windowed fullscreen",
                        "Fill the Stream Shell provider pane with the Crunchyroll player."
                    )
                ),
                "Keep the player focused on the video while retaining normal controls."
            );
        }

        if (settingsSection === "playback") {
            html = settingsPage(
                "Playback",
                settingsSubgroup(
                    "Speed",
                    settingSelect(
                        playbackSpeedKey("crunchyroll"),
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
                        "streamShellDoubleClickWindowed_crunchyroll",
                        "Double-click windowed fullscreen",
                        "Double-click the player to toggle Stream Shell's windowed fullscreen mode."
                    )
                ),
                "Playback speed remains provider-wide; only the Windowed Fullscreen gesture is target-specific.",
                "two"
            );
        }

        if (settingsSection === "automation") {
            html = settingsPage(
                "Automation",
                settingsSubgroup(
                    "Skip segments",
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipIntro",
                        "Skip intros",
                        "Seek past Crunchyroll's published intro segment automatically."
                    ) +
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipRecap",
                        "Skip recaps",
                        "Seek past Crunchyroll's published recap segment automatically."
                    ) +
                    settingSwitch(
                        "streamShellCrunchyrollAutoSkipCredits",
                        "Skip credits",
                        "Seek past Crunchyroll's published credits segment automatically."
                    )
                ) +
                renderSleepTimerSubgroup("crunchyroll"),
                "Uses Crunchyroll's own per-episode skip timings when they are available.",
                "two"
            );
        }

    }

    settingsContent.innerHTML = html;

    if (settingsSection === "search") {
        const searchInput = document.getElementById("settings-search-input");
        if (searchInput) {
            searchInput.value = settingsSearchQuery;
        }
    }

    syncAnarchySettingsVisuals();
}

function renderSettingsSidebar() {
    if (!settingsSidebar) {
        return;
    }

    const sections = SETTINGS_SECTIONS[settingsProvider] || [];

    if (!sections.some(([id]) => id === settingsSection)) {
        settingsSection = defaultSettingsSection(settingsProvider);
    }

    settingsSidebar.innerHTML = sections.map(
        ([id, label]) => `
            <button
                type="button"
                class="settings-section-button ${id === "search" ? "settings-section-search " : ""}${id === settingsSection ? "active" : ""}"
                data-settings-section="${id}"
            >
                ${label}
            </button>
        `
    ).join("");
}

function renderSettingsTabs() {
    settingsProviderTabs
        ?.querySelectorAll("[data-settings-provider]")
        .forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.settingsProvider === settingsProvider
                );
            }
        );

    if (settingsCenter) {
        settingsCenter.dataset.settingsProvider = settingsProvider;
        settingsCenter.dataset.settingsSection = settingsSection;
    }
}

function renderSettingsCenter() {
    renderSettingsTabs();
    renderSettingsSidebar();
    renderSettingsContent();
}

async function loadSettingsValues() {
    try {
        const stored = await chrome.storage.local.get(
            SETTINGS_STORAGE_KEYS
        );

        settingsValues = {
            ...SETTINGS_DEFAULTS,
            ...stored
        };
    } catch {
        settingsValues = {
            ...SETTINGS_DEFAULTS
        };
    }

    settingsLoaded = true;
}

async function openSettingsCenter(provider) {
    if (
        provider &&
        SETTINGS_SECTIONS[provider]
    ) {
        settingsProvider = provider;
    } else if (PROVIDERS.has(currentLeftMode)) {
        settingsProvider = currentLeftMode;
    }

    settingsSection = defaultSettingsSection(settingsProvider);
    settingsDisplayTarget = activeShellDisplayTarget();

    if (!settingsLoaded) {
        await loadSettingsValues();
    }

    await refreshSleepTimerState();

    if (settingsCloseTimer) {
        clearTimeout(settingsCloseTimer);
        settingsCloseTimer = null;
    }

    settingsCenter.hidden = false;
    renderSettingsCenter();

    requestAnimationFrame(
        () => {
            document.body.classList.add("settings-open");
            settingsCenter.classList.add("visible");
            notifySettingsVisibility(true);
        }
    );
}

function closeSettingsCenter() {
    closeSettingsDiagnostics();
    stopAnarchySettingsColors();
    settingsCenter.classList.remove("visible");
    document.body.classList.remove("settings-open");
    notifySettingsVisibility(false);

    if (settingsCloseTimer) {
        clearTimeout(settingsCloseTimer);
    }

    settingsCloseTimer = setTimeout(
        () => {
            if (!settingsCenter.classList.contains("visible")) {
                settingsCenter.hidden = true;
            }

            settingsCloseTimer = null;
        },
        260
    );
}

function settingsCenterIsOpen() {
    return Boolean(
        settingsCenter &&
        !settingsCenter.hidden &&
        settingsCenter.classList.contains("visible")
    );
}

async function toggleSettingsCenter(provider) {
    if (settingsCenterIsOpen()) {
        closeSettingsCenter();
        return;
    }

    await openSettingsCenter(provider);
}

function selectSettingsProvider(provider) {
    if (!SETTINGS_SECTIONS[provider]) {
        return;
    }

    settingsProvider = provider;
    settingsSection = defaultSettingsSection(provider);
    renderSettingsCenter();
}

function selectSettingsSection(section) {
    const sections = SETTINGS_SECTIONS[settingsProvider] || [];

    if (!sections.some(([id]) => id === section)) {
        return;
    }

    settingsSection = section;
    renderSettingsSidebar();
    renderSettingsContent();
}

function handleSettingsClick(event) {
    const button = event.target.closest("button");

    if (!button) {
        return false;
    }

    if (button.id === "now-playing-settings") {
        event.preventDefault();
        event.stopPropagation();

        toggleSettingsCenter(
            nowPlayingPanel.dataset.provider || currentLeftMode
        );
        return true;
    }

    if (button.id === "settings-diagnostics") {
        event.preventDefault();
        if (diagnosticsIsOpen()) {
            closeSettingsDiagnostics();
        } else {
            openSettingsDiagnostics();
        }
        return true;
    }

    if (button.id === "settings-diagnostics-close") {
        event.preventDefault();
        closeSettingsDiagnostics();
        return true;
    }

    if (button.id === "settings-diagnostics-refresh") {
        event.preventDefault();
        refreshSettingsDiagnostics();
        return true;
    }

    if (button.id === "settings-diagnostics-export") {
        event.preventDefault();
        exportSettingsDiagnostics()
            .catch(() => setDiagnosticsStatus("Export failed"));
        return true;
    }

    if (button.dataset.diagnosticsSafeMode) {
        event.preventDefault();
        runSettingsDiagnosticsSafeMode(
            button.dataset.diagnosticsProvider,
            button.dataset.diagnosticsSafeMode === "true",
            button
        );
        return true;
    }

    if (button.dataset.diagnosticsRepair) {
        event.preventDefault();
        runSettingsDiagnosticsRepair(
            button.dataset.diagnosticsProvider,
            button.dataset.diagnosticsRepair,
            button
        );
        return true;
    }

    if (button.id === "settings-close") {
        event.preventDefault();
        closeSettingsCenter();
        return true;
    }

    if (button.id === "settings-export") {
        event.preventDefault();
        exportStreamShellSettings().catch(() => showSettingsIoStatus("Export failed"));
        return true;
    }

    if (button.id === "settings-import") {
        event.preventDefault();
        settingsImportFile?.click();
        return true;
    }

    const searchSection = button.dataset.settingsSearchSection;
    if (searchSection) {
        event.preventDefault();
        selectSettingsSection(searchSection);
        return true;
    }

    const sleepMode = button.dataset.sleepMode;
    const sleepProvider = button.dataset.sleepProvider;
    if (sleepMode && sleepProvider) {
        event.preventDefault();
        setSleepTimerFromSettings(sleepProvider, sleepMode).catch(() => {});
        return true;
    }

    const provider = button.dataset.settingsProvider;
    if (provider) {
        event.preventDefault();
        if (diagnosticsIsOpen()) {
            closeSettingsDiagnostics();
        }
        selectSettingsProvider(provider);
        return true;
    }

    const section = button.dataset.settingsSection;
    if (section) {
        event.preventDefault();
        selectSettingsSection(section);
        return true;
    }

    return false;
}

function normalizeSettingInput(input) {
    const key = input.dataset.settingKey;
    if (!key) {
        return null;
    }

    let value;

    if (input.type === "checkbox") {
        value = input.checked;
    } else if (input.dataset.settingNumber === "true") {
        const min = Number(input.min);
        const max = Number(input.max);
        let numeric = Number(input.value);

        if (!Number.isFinite(numeric)) {
            numeric = Number(settingDefaultValue(key)) || 0;
        }

        if (Number.isFinite(min)) {
            numeric = Math.max(min, numeric);
        }

        if (Number.isFinite(max)) {
            numeric = Math.min(max, numeric);
        }

        input.value = String(numeric);
        value = numeric;
    } else {
        value = input.value;
    }

    return { key, value };
}

async function persistSettingInput(input) {
    const normalized = normalizeSettingInput(input);
    if (!normalized) {
        return;
    }

    settingsValues[normalized.key] = normalized.value;

    try {
        await chrome.storage.local.set({
            [normalized.key]: normalized.value
        });

        try {
            await chrome.runtime.sendMessage({
                type: "dashboard-flight-event",
                event: {
                    category: "settings",
                    action: "changed",
                    detail: { key: normalized.key }
                }
            });
        } catch {
        }

        if (
            normalized.key === "streamShellSleepTimerAction" &&
            sleepTimerState
        ) {
            const response = await chrome.runtime.sendMessage({
                type: "sleep-timer-action",
                action: normalized.value
            });
            sleepTimerState = response?.session || sleepTimerState;
        }
    } catch {
    }
}

document.addEventListener(
    "input",
    event => {
        const searchInput = event.target.closest?.("#settings-search-input");
        if (searchInput) {
            settingsSearchQuery = searchInput.value || "";
            updateSettingsSearchResults();
            return;
        }

        const input = event.target.closest?.(".settings-range[data-setting-key]");
        if (!input) {
            return;
        }

        const key = input.dataset.settingKey;
        const output = settingsContent?.querySelector(
            `[data-setting-output="${key}"]`
        );

        if (output) {
            output.textContent = `${input.value}%`;
        }
    },
    true
);

document.addEventListener(
    "change",
    event => {
        const targetInput = event.target.closest?.("[data-settings-display-target]");
        if (targetInput) {
            const target = targetInput.dataset.settingsDisplayTarget;
            if (DISPLAY_SETTING_TARGETS.includes(target)) {
                settingsDisplayTarget = target;
                renderSettingsContent();
            }
            return;
        }

        const input = event.target.closest?.("[data-setting-key]");
        if (!input) {
            return;
        }

        persistSettingInput(input);
    },
    true
);

settingsImportFile?.addEventListener(
    "change",
    () => {
        const file = settingsImportFile.files?.[0];
        settingsImportFile.value = "";
        if (!file) return;
        importStreamShellSettings(file)
            .catch(() => showSettingsIoStatus("Import failed"));
    }
);

chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "sleep-timer-state") return;
    sleepTimerState = message.session || null;
    if (!settingsCenter.hidden && settingsSection === "automation") {
        renderSettingsContent();
    }
});

document.addEventListener(
    "keydown",
    event => {
        if (event.key !== "Escape") {
            return;
        }

        if (diagnosticsIsOpen()) {
            event.preventDefault();
            closeSettingsDiagnostics();
            return;
        }

        if (!settingsCenter.hidden) {
            event.preventDefault();
            closeSettingsCenter();
        }
    },
    true
);

chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (areaName !== "local") {
            return;
        }

        let relevant = false;
        for (const [key, change] of Object.entries(changes)) {
            if (!SETTINGS_STORAGE_KEY_SET.has(key)) {
                continue;
            }

            if (change.newValue === undefined) {
                if (baseSettingKeyForStorageKey(key) !== key) {
                    delete settingsValues[key];
                } else {
                    settingsValues[key] = SETTINGS_DEFAULTS[key];
                }
            } else {
                settingsValues[key] = change.newValue;
            }
            relevant = true;
        }

        if (relevant && !settingsCenter.hidden) {
            renderSettingsContent();
        }
    }
);

notifySettingsVisibility(false);
loadSettingsValues().catch(() => {});
