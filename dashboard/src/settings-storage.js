/* Settings storage contracts. Dashboard-only: do not use for shell/window state.
 * Keep codec/persistence separate from DOM renderers and provider-registry writes.
 */
function streamShellHydrateSettings(stored) {
    const input = stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored : {};
    const values = { ...SETTINGS_DEFAULTS };
    for (const key of SETTINGS_STORAGE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
            values[key] = input[key];
        }
    }
    return values;
}

function streamShellExportSettings(stored) {
    const values = streamShellHydrateSettings(stored);
    const exported = {};
    for (const key of SETTINGS_STORAGE_KEYS) {
        const baseKey = baseSettingKeyForStorageKey(key);
        // Legacy installations had no display-scoped keys. Preserve that
        // fallback when exporting a portable settings file.
        exported[key] = values[key] === undefined ? values[baseKey] : values[key];
    }
    return exported;
}

// Known Dashboard input contracts. These mirror the actual controls, NOT the
// provider/runtime storage schema. No additional reads or watchers are added.
const STREAM_SHELL_SETTING_BOUNDS = Object.freeze({
    streamShellContinueWatchingCompletePercent: [1, 100, 1],
    streamShellYoutubeUploadDateRelativeDays: [0, 30, 1],
    streamShellYoutubeAutoLikePercent: [1, 100, 1],
    streamShellYoutubeAutoLikeSeconds: [1, 7200, 1]
});
const STREAM_SHELL_SETTING_CHOICES = Object.freeze({
    streamShellDisplayMode: ["auto", "wide", "compact"],
    streamShellSleepTimerAction: ["pause", "dashboard"],
    streamShellYoutubeAutoLikeTrigger: ["percent", "seconds"],
    streamShellYoutubeQuality: ["auto", "highest", "highres", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"],
    streamShellYoutubeUploadDateFormat: ["friendly", "numeric", "iso"],
    streamShellPrimeSubtitleScale: ["0.5", "0.8", "1", "1.25", "1.5", "2"]
});
const STREAM_SHELL_PLAYBACK_SPEED_CHOICES = ["0.5", "0.75", "1", "1.25", "1.5", "1.75", "2"];
const STREAM_SHELL_SUBTITLE_SCALE_CHOICES = ["0.5", "0.8", "1", "1.25", "1.5", "2"];
const STREAM_SHELL_SUBTITLE_COLOR_CHOICES = ["#ffffff", "#e8e8e8", "#fff0b3", "#c7e6ff", "#d2efd8"];
const STREAM_SHELL_SUBTITLE_FONT_CHOICES = ["default", "Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New", "Verdana", "Roboto"];

function streamShellSettingValidationRule(key) {
    const base = baseSettingKeyForStorageKey(key);
    if (/^streamShellVolumeBoost_(twitch|youtube|netflix|prime|disney|crunchyroll)$/.test(base)) {
        return { bounds: [100, 600, 10] };
    }
    if (STREAM_SHELL_SETTING_BOUNDS[base]) return { bounds: STREAM_SHELL_SETTING_BOUNDS[base] };
    if (STREAM_SHELL_SETTING_CHOICES[base]) return { choices: STREAM_SHELL_SETTING_CHOICES[base] };
    if (/^streamShellPlaybackSpeed_(youtube|netflix|prime|disney|crunchyroll)$/.test(base)) {
        return { choices: STREAM_SHELL_PLAYBACK_SPEED_CHOICES };
    }
    if (/^streamShellAudioProfile_(twitch|youtube|netflix|prime|disney|crunchyroll)$/.test(base)) {
        return { choices: ["normal", "dialogue", "night"] };
    }
    if (/^streamShellSubtitleScale_(youtube|netflix|disney)$/.test(base)) {
        return { choices: STREAM_SHELL_SUBTITLE_SCALE_CHOICES };
    }
    if (/^streamShell(PrimeSubtitleColor|SubtitleColor_(youtube|netflix|disney))$/.test(base)) {
        return { choices: STREAM_SHELL_SUBTITLE_COLOR_CHOICES };
    }
    if (/^streamShell(PrimeSubtitleFont|SubtitleFont_(youtube|netflix|disney))$/.test(base)) {
        return { choices: STREAM_SHELL_SUBTITLE_FONT_CHOICES };
    }
    return null;
}

function streamShellNormalizeSettingValue(key, value) {
    if (!SETTINGS_STORAGE_KEY_SET.has(key)) {
        throw new Error(`Unknown Stream Shell setting: ${key}`);
    }
    if (key === STREAM_SHELL_PROVIDER_REGISTRY_KEY) {
        return normalizeStreamShellProviderRegistry(value);
    }
    const base = baseSettingKeyForStorageKey(key);
    const fallback = SETTINGS_DEFAULTS[base];
    const rule = streamShellSettingValidationRule(key);
    if (typeof fallback === "boolean") {
        if (typeof value !== "boolean") throw new Error(`Invalid boolean setting: ${key}`);
        return value;
    }
    if (typeof fallback === "number") {
        // Do not turn null, empty strings, booleans or non-finite values into defaults.
        if ((typeof value !== "number" && typeof value !== "string") ||
            (typeof value === "string" && !value.trim())) {
            throw new Error(`Invalid numeric setting: ${key}`);
        }
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error(`Invalid numeric setting: ${key}`);
        if (!rule?.bounds) return number;
        const [min, max, step] = rule.bounds;
        const clamped = Math.max(min, Math.min(max, number));
        const snapped = min + Math.round((clamped - min) / step) * step;
        return Math.max(min, Math.min(max, snapped));
    }
    if (typeof value !== "string") throw new Error(`Invalid text setting: ${key}`);
    if (rule?.choices && !rule.choices.includes(value)) {
        throw new Error(`Invalid option for ${key}: ${value}`);
    }
    return value;
}

function streamShellNormalizeImportedSetting(key, value) {
    return streamShellNormalizeSettingValue(key, value);
}

function streamShellPrepareSettingsImport(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error("Invalid Stream Shell settings file.");
    }
    const next = {};
    const explicitScopedBases = new Set();
    for (const key of SETTINGS_STORAGE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        next[key] = streamShellNormalizeImportedSetting(key, source[key]);
        const base = baseSettingKeyForStorageKey(key);
        if (base !== key) explicitScopedBases.add(base);
    }
    if (!Object.keys(next).length) {
        throw new Error("No recognized Stream Shell settings in file.");
    }
    // Only clear overrides for a legacy scoped BASE that the backup actually
    // supplies. A partial unrelated import must never erase display profiles.
    const legacyScopedKeys = [];
    for (const base of DISPLAY_SCOPED_SETTING_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(next, base) || explicitScopedBases.has(base)) continue;
        for (const target of DISPLAY_SETTING_TARGETS) {
            legacyScopedKeys.push(displayScopedSettingStorageKey(base, target));
        }
    }
    return { next, legacyScopedKeys };
}

// Serialize only writes to the SAME settings key. Different settings remain
// independent; this introduces no extra polling, reads or browser IPC.
const streamShellSettingWriteQueues = new Map();
function streamShellWriteSetting(key, value) {
    const previous = streamShellSettingWriteQueues.get(key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(
        () => chrome.storage.local.set({ [key]: value })
    );
    streamShellSettingWriteQueues.set(key, pending);
    pending.then(
        () => { if (streamShellSettingWriteQueues.get(key) === pending) streamShellSettingWriteQueues.delete(key); },
        () => { if (streamShellSettingWriteQueues.get(key) === pending) streamShellSettingWriteQueues.delete(key); }
    );
    return pending;
}
