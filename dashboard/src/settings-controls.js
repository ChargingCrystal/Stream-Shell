function notifySettingsVisibility(open) {
    chrome.runtime.sendMessage({
        type: "dashboard-settings-visibility",
        open: open === true
    }).catch(() => {});
}

function settingStorageKey(key) {
    return DISPLAY_SCOPED_SETTING_KEYS.has(key)
        ? displayScopedSettingStorageKey(key, settingsDisplayTarget)
        : key;
}

function settingDefaultValue(key) {
    const baseKey = baseSettingKeyForStorageKey(key);
    return SETTINGS_DEFAULTS[baseKey];
}

function settingValue(key) {
    const storageKey = settingStorageKey(key);

    if (Object.prototype.hasOwnProperty.call(settingsValues, storageKey)) {
        return settingsValues[storageKey];
    }

    if (
        storageKey !== key &&
        Object.prototype.hasOwnProperty.call(settingsValues, key)
    ) {
        return settingsValues[key];
    }

    return SETTINGS_DEFAULTS[key];
}

function settingChecked(key) {
    return settingValue(key) === true
        ? "checked"
        : "";
}

function settingSwitch(key, title, description) {
    const anarchyKind = key === "streamShellPlaybackAnarchy"
        ? "playback"
        : key === "streamShellSubtitleAnarchy"
            ? "subtitles"
            : key === "streamShellDvdAnarchy"
                ? "dvd"
                : "";
    const anarchyClass = anarchyKind
        ? ` settings-switch-anarchy settings-switch-anarchy-${anarchyKind}`
        : "";

    return `
        <label class="setting-row setting-row-switch${anarchyKind ? " setting-row-anarchy" : ""}">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-switch${anarchyClass}">
                <input type="checkbox" data-setting-key="${settingStorageKey(key)}" ${settingChecked(key)}>
                <span aria-hidden="true"></span>
            </span>
        </label>
    `;
}

function settingDependentSwitch(key, title, description, enabled) {
    return `
        <label class="setting-row setting-row-switch setting-row-dependent${enabled ? "" : " is-disabled"}">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-switch">
                <input type="checkbox" data-setting-key="${key}" ${settingChecked(key)} ${enabled ? "" : "disabled"}>
                <span aria-hidden="true"></span>
            </span>
        </label>
    `;
}

function settingSelect(key, title, description, options) {
    const value = String(settingValue(key));
    const optionHtml = options.map(
        ([optionValue, label]) =>
            `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${label}</option>`
    ).join("");

    return `
        <label class="setting-row setting-row-field">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <select class="settings-select" data-setting-key="${key}">${optionHtml}</select>
        </label>
    `;
}

function settingNumber(key, title, description, min, max, suffix = "") {
    const value = Number(settingValue(key));
    return `
        <label class="setting-row setting-row-field">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-number-wrap">
                <input
                    class="settings-number"
                    type="number"
                    min="${min}"
                    max="${max}"
                    step="1"
                    value="${Number.isFinite(value) ? value : min}"
                    data-setting-key="${key}"
                    data-setting-number="true"
                >
                ${suffix ? `<span>${suffix}</span>` : ""}
            </span>
        </label>
    `;
}

function settingRange(key, title, description, min, max, step = 10, suffix = "%") {
    const rawValue = Number(settingValue(key));
    const value = Number.isFinite(rawValue)
        ? Math.min(max, Math.max(min, rawValue))
        : min;

    return `
        <label class="setting-row setting-row-range">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-range-wrap">
                <input
                    class="settings-range"
                    type="range"
                    min="${min}"
                    max="${max}"
                    step="${step}"
                    value="${value}"
                    data-setting-key="${key}"
                    data-setting-number="true"
                >
                <output data-setting-output="${key}">${value}${suffix}</output>
            </span>
        </label>
    `;
}

function renderDisplaySettings() {
    return settingsPage(
        "Display",
        settingsSubgroup(
            "Layout profile",
            settingSegmented(
                "streamShellDisplayMode",
                "Display mode",
                "Auto priority: 32:9, then 16:9, then 16:10. Both 16:9 and 16:10 use the same Compact single-surface layout.",
                [
                    ["auto", "Auto"],
                    ["wide", "Wide"],
                    ["compact", "Compact"]
                ]
            ),
            "Known aspect targets: 32:9, 16:9 and 16:10. The override is global, not provider-specific."
        ),
        "Wide is anchored to the detected 32:9 display. Compact uses either 16:9 or 16:10 as one full-screen Shell Home/provider surface with the same titlebar and layout; profile changes use the next clean shell open/reopen boundary."
    );
}


function renderTwitchUtilitySettings() {
    return settingsPage(
        "Twitch",
        settingsSubgroup(
            "Window behavior",
            settingSwitch(
                "streamShellTwitchKeepActive",
                "Keep Twitch active while covered",
                "Leave the Twitch popup on its real right-pane coordinates underneath Dashboard or Discord instead of minimizing or parking it."
            ),
            "Designed for watch-time progress, Channel Points and Drops while another right-side surface is in front."
        ) +
        settingsSubgroup(
            "Automation",
            settingSwitch(
                "streamShellTwitchAutoClaimPoints",
                "Auto-claim Channel Points",
                "Claim the periodic Channel Points bonus when Twitch exposes its claim button."
            ) +
            settingSwitch(
                "streamShellTwitchAutoClaimDrops",
                "Auto-claim Twitch Drops",
                "Claim completed Twitch rewards whenever claim UI is exposed in the managed Twitch surface. No separate Inventory browser window is kept open."
            ) +
            settingSwitch(
                "streamShellTwitchPreventRaids",
                "Prevent raids",
                "Leave/cancel detected raids and block the immediate raid redirect without interfering with normal manual channel navigation."
            ),
            "All Twitch automation is local DOM automation; Stream Shell does not use Twitch OAuth or a Twitch API token."
        ) +
        settingsSubgroup(
            "Audio",
            settingSwitch(
                "streamShellTwitchAutoMute",
                "Auto-mute Twitch streams",
                "Mute managed Twitch stream tabs at the Opera/Chromium tab level without touching Twitch's own player volume or mute control."
            ) +
            settingSelect(
                "streamShellAudioProfile_twitch",
                "Processing mode",
                "Applied while the Twitch titlebar speaker is enabled and browser-level auto-mute is disabled.",
                [
                    ["normal", "Normal"],
                    ["dialogue", "Dialogue"],
                    ["night", "Night"]
                ]
            ) +
            settingRange(
                "streamShellVolumeBoost_twitch",
                "Twitch volume",
                "Volume used while the Twitch titlebar speaker is enabled and browser-level auto-mute is disabled.",
                100,
                600,
                10,
                "%"
            ),
            "Auto-mute is applied by the browser tab, not by Twitch's player UI. Playback speed is intentionally omitted for the live-first Twitch utility."
        ),
        "Twitch is an auxiliary Wide utility, not a sixth Stream Shell provider.",
        "three"
    );
}


function volumeBoostKey(provider) {
    return `streamShellVolumeBoost_${provider}`;
}

function audioProfileKey(provider) {
    return `streamShellAudioProfile_${provider}`;
}

function renderVolumeSettings(provider) {
    return settingsPage(
        "Audio",
        settingsSubgroup(
            "Sound profile",
            settingSelect(
                audioProfileKey(provider),
                "Processing mode",
                "Applied while the titlebar speaker is enabled for this provider.",
                [
                    ["normal", "Normal"],
                    ["dialogue", "Dialogue"],
                    ["night", "Night"]
                ]
            ),
            "Dialogue reduces low-end rumble and lifts speech. Night compresses loud and quiet swings for more even listening."
        ) +
        settingsSubgroup(
            "Amplification",
            settingRange(
                volumeBoostKey(provider),
                "Provider volume",
                "Volume used while the titlebar speaker is enabled.",
                100,
                600,
                10,
                "%"
            ),
            "Saved separately for each provider. 100% is normal volume; higher values boost it."
        ),
        "The titlebar speaker toggles this audio chain for the current provider.",
        "two"
    );
}


function settingsPage(title, content, note = "", layout = "stack") {
    const layoutClass = layout === "two"
        ? " settings-layout-two"
        : layout === "three"
            ? " settings-layout-three"
            : layout === "columns-three"
                ? " settings-layout-columns-three"
                : "";

    return `
        <section class="settings-group settings-group-page">
            <div class="settings-group-heading">
                <h2>${title}</h2>
                ${note ? `<p>${note}</p>` : ""}
            </div>
            <div class="settings-subgroups${layoutClass}">${content}</div>
        </section>
    `;
}

function settingsColumn(content) {
    return `<div class="settings-column">${content}</div>`;
}

function settingsSubgroup(title, content, note = "") {
    return `
        <section class="settings-subgroup">
            <div class="settings-subgroup-heading">
                <h3>${title}</h3>
                ${note ? `<p>${note}</p>` : ""}
            </div>
            <div class="settings-group-rows">${content}</div>
        </section>
    `;
}

function settingSegmented(key, title, description, options) {
    const value = String(settingValue(key));

    return `
        <div class="setting-row setting-row-segmented">
            <span class="setting-copy">
                <strong>${title}</strong>
                <span>${description}</span>
            </span>
            <span class="settings-segmented" role="radiogroup" aria-label="${title}">
                ${options.map(
                    ([optionValue, label]) => `
                        <label class="settings-segmented-option">
                            <input
                                type="radio"
                                name="${key}"
                                value="${optionValue}"
                                data-setting-key="${key}"
                                ${value === optionValue ? "checked" : ""}
                            >
                            <span>${label}</span>
                        </label>
                    `
                ).join("")}
            </span>
        </div>
    `;
}

function activeShellDisplayTarget() {
    if (
        document.body.dataset.layoutProfile === "compact" &&
        DISPLAY_SETTING_TARGETS.includes(document.body.dataset.compactTarget)
    ) {
        return document.body.dataset.compactTarget;
    }

    return "32:9";
}

function renderDisplayTargetScopeRow(description = "These controls are stored separately for each supported display target.") {
    const labels = {
        "32:9": "32:9",
        "16:9": "16:9",
        "16:10": "16:10"
    };

    return `
        <div class="setting-row setting-row-segmented setting-row-display-target">
            <span class="setting-copy">
                <strong>Applies to</strong>
                <span>${description}</span>
            </span>
            <span class="settings-segmented" role="radiogroup" aria-label="Display target">
                ${DISPLAY_SETTING_TARGETS.map(target => `
                    <label class="settings-segmented-option">
                        <input
                            type="radio"
                            name="settings-display-target"
                            value="${target}"
                            data-settings-display-target="${target}"
                            ${settingsDisplayTarget === target ? "checked" : ""}
                        >
                        <span>${labels[target]}</span>
                    </label>
                `).join("")}
            </span>
        </div>
    `;
}

function playbackSpeedKey(provider) {
    return `streamShellPlaybackSpeed_${provider}`;
}

function renderPlaybackSettings(provider, extraContent = "") {
    const speed = settingsSubgroup(
        "Speed",
        settingSelect(
            playbackSpeedKey(provider),
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
    );

    const content = speed + extraContent;

    return settingsPage(
        "Playback",
        content,
        "Set the normal playback speed for this provider.",
        extraContent ? "two" : "stack"
    );
}

function renderWindowedGestureSetting(provider) {
    return settingsSubgroup(
        "Gestures",
        settingSwitch(
            `streamShellDoubleClickWindowed_${provider}`,
            "Double-click windowed fullscreen",
            "Double-click the player to toggle Stream Shell's windowed fullscreen mode."
        )
    );
}

function renderSubtitleSettings(provider) {
    return settingsPage(
        "Subtitles",
        settingsSubgroup(
            "Override",
            settingSwitch(
                `streamShellSubtitleOverride_${provider}`,
                "Custom subtitle style",
                "Override the provider's subtitle size, color and font."
            )
        ) +
        settingsSubgroup(
            "Size & color",
            settingSelect(
                `streamShellSubtitleScale_${provider}`,
                "Subtitle scale",
                "Scale subtitles relative to their normal size.",
                [
                    ["0.5", "0.5x"],
                    ["0.8", "0.8x"],
                    ["1", "1.0x"],
                    ["1.25", "1.25x"],
                    ["1.5", "1.5x"],
                    ["2", "2.0x"]
                ]
            ) +
            settingSelect(
                `streamShellSubtitleColor_${provider}`,
                "Text color",
                "Choose a subtitle text color.",
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
                `streamShellSubtitleFont_${provider}`,
                "Font family",
                "Keep the provider font or use a local font family.",
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
        "Changes apply locally to subtitle text rendered by the provider.",
        "three"
    );
}

function renderAnarchySettings() {
    return settingsPage(
        "Anarchy",
        settingsSubgroup(
            "Playback",
            settingSwitch(
                "streamShellPlaybackAnarchy",
                "Playback Anarchy",
                "Continuously drift between random playback speeds with smooth, randomly timed transitions on every supported provider."
            )
        ) +
        settingsSubgroup(
            "Subtitles",
            settingSwitch(
                "streamShellSubtitleAnarchy",
                "Subtitle Anarchy",
                "Flash through neon colors every 0.2 seconds while subtitle size smoothly changes at random speeds. Applies to YouTube, Netflix, Prime Video and Disney+; Crunchyroll is excluded."
            )
        ) +
        settingsSubgroup(
            "Visual",
            settingSwitch(
                "streamShellDvdAnarchy",
                "DVD Anarchy",
                "Bounce a DVD logo around whichever supported provider occupies the active left surface, randomly changing speed and color on collisions."
            )
        ),
        "Global chaos controls. Provider Safe Mode still suppresses Anarchy locally without changing these saved global settings.",
        "three"
    );
}

function sleepTimerModeForProvider(provider) {
    return sleepTimerState?.provider === provider
        ? String(sleepTimerState.mode || "off")
        : "off";
}

function renderSleepTimerSubgroup(provider) {
    const mode = sleepTimerModeForProvider(provider);
    const foreign = sleepTimerState && sleepTimerState.provider !== provider;
    const foreignLabel = foreign
        ? PROVIDER_NAMES[sleepTimerState.provider] || sleepTimerState.provider
        : "";

    const buttons = [
        ["off", "Off"],
        ["30", "30 min"],
        ["60", "60 min"],
        ["90", "90 min"],
        ["end", "End of video"]
    ].map(([value, label]) => `
        <button
            type="button"
            class="settings-segmented-button ${mode === value ? "active" : ""}"
            data-sleep-mode="${value}"
            data-sleep-provider="${provider}"
        >${label}</button>
    `).join("");

    return settingsSubgroup(
        "Sleep timer",
        `
            <div class="setting-row setting-row-segmented setting-row-sleep">
                <span class="setting-copy">
                    <strong>Stop playback</strong>
                    <span>${foreign ? `A timer is currently running for ${foreignLabel}. Choosing a value here replaces it.` : "Choose a fixed timer or stop after the current video ends."}</span>
                </span>
                <span class="settings-segmented settings-segmented-buttons">${buttons}</span>
            </div>
        ` +
        settingSelect(
            "streamShellSleepTimerAction",
            "When it ends",
            "Choose whether Stream Shell only pauses or also brings Dashboard forward.",
            [
                ["pause", "Pause"],
                ["dashboard", "Pause + show Dashboard"]
            ]
        )
    );
}

async function refreshSleepTimerState() {
    try {
        const response = await chrome.runtime.sendMessage({ type: "sleep-timer-get" });
        sleepTimerState = response?.session || null;
    } catch {
        sleepTimerState = null;
    }
}

async function setSleepTimerFromSettings(provider, mode) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: "sleep-timer-set",
            provider,
            mode,
            action: settingValue("streamShellSleepTimerAction")
        });
        sleepTimerState = response?.session || null;
    } catch {
        sleepTimerState = null;
    }
    renderSettingsContent();
}

function showSettingsIoStatus(text) {
    if (!settingsIoStatus) return;
    settingsIoStatus.textContent = text || "";
    if (settingsIoStatusTimer) clearTimeout(settingsIoStatusTimer);
    if (text) {
        settingsIoStatusTimer = setTimeout(() => {
            settingsIoStatus.textContent = "";
            settingsIoStatusTimer = null;
        }, 2400);
    }
}

async function exportStreamShellSettings() {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);
    const settings = {};

    for (const key of SETTINGS_STORAGE_KEYS) {
        if (stored[key] !== undefined) {
            settings[key] = stored[key];
            continue;
        }

        const baseKey = baseSettingKeyForStorageKey(key);
        settings[key] = stored[baseKey] === undefined
            ? SETTINGS_DEFAULTS[baseKey]
            : stored[baseKey];
    }

    const extensionVersion = chrome.runtime.getManifest?.().version || "unknown";
    const payload = {
        format: "stream-shell-settings",
        version: 1,
        streamShellVersion: extensionVersion,
        exportedAt: new Date().toISOString(),
        settings
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `StreamShell-settings-${extensionVersion}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showSettingsIoStatus("Exported");
}

function normalizeImportedSetting(key, value) {
    const fallback = settingDefaultValue(key);
    if (typeof fallback === "boolean") return value === true;
    if (typeof fallback === "number") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        if (key === "streamShellContinueWatchingCompletePercent") {
            return Math.max(1, Math.min(100, Math.round(numeric)));
        }
        return numeric;
    }
    return typeof value === "string" ? value : fallback;
}

async function importStreamShellSettings(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const source = parsed?.format === "stream-shell-settings"
        ? parsed.settings
        : parsed;

    if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error("Invalid Stream Shell settings file.");
    }

    const next = {};
    for (const key of SETTINGS_STORAGE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            next[key] = normalizeImportedSetting(key, source[key]);
        }
    }

    const importedScopedKeys = SETTINGS_STORAGE_KEYS.some(
        key => baseSettingKeyForStorageKey(key) !== key &&
            Object.prototype.hasOwnProperty.call(source, key)
    );

    if (!importedScopedKeys) {
        const legacyScopedKeys = SETTINGS_STORAGE_KEYS.filter(
            key => baseSettingKeyForStorageKey(key) !== key
        );
        await chrome.storage.local.remove(legacyScopedKeys);
    }

    await chrome.storage.local.set(next);
    try {
        await chrome.runtime.sendMessage({
            type: "dashboard-flight-event",
            event: {
                category: "settings",
                action: "imported",
                detail: { keys: Object.keys(next).length }
            }
        });
    } catch {
    }
    await loadSettingsValues();
    renderSettingsCenter();
    showSettingsIoStatus("Imported");
}

