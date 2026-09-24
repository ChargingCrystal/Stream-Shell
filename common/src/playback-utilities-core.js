    /*
     * ============================================================
     * PLAYBACK UTILITIES
     * ============================================================
     * Shared provider-local playback conveniences: preferred playback
     * speed, optional subtitle overrides, sleep-timer signaling and
     * double-click toggling of Stream Shell's windowed player mode.
     */

    const PLAYBACK_UTILITY_PROVIDERS = [
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll"
    ];

    const SUBTITLE_OVERRIDE_PROVIDERS = new Set([
        "youtube",
        "netflix",
        "disney"
    ]);

    const SUBTITLE_FONT_STACKS = {
        Arial: "Arial, sans-serif",
        Helvetica: "Helvetica, Arial, sans-serif",
        Georgia: "Georgia, serif",
        "Times New Roman": '"Times New Roman", Times, serif',
        "Courier New": '"Courier New", monospace',
        Verdana: "Verdana, sans-serif",
        Roboto: "Roboto, Arial, sans-serif"
    };

    const PLAYBACK_UTILITY_GLOBAL_KEYS = new Set([
        "streamShellPlaybackAnarchy",
        "streamShellSubtitleAnarchy",
        "streamShellDvdAnarchy"
    ]);

    const playbackUtilityDefaults = {
        streamShellPlaybackAnarchy: false,
        streamShellSubtitleAnarchy: false,
        streamShellDvdAnarchy: false
    };

    for (const provider of PLAYBACK_UTILITY_PROVIDERS) {
        playbackUtilityDefaults[`streamShellPlaybackSpeed_${provider}`] = "1";
    }

    playbackUtilityDefaults.streamShellDoubleClickWindowed_youtube = false;
    playbackUtilityDefaults.streamShellDoubleClickWindowed_crunchyroll = false;

    for (const provider of SUBTITLE_OVERRIDE_PROVIDERS) {
        playbackUtilityDefaults[`streamShellSubtitleOverride_${provider}`] = false;
        playbackUtilityDefaults[`streamShellSubtitleScale_${provider}`] = "1";
        playbackUtilityDefaults[`streamShellSubtitleColor_${provider}`] = "#ffffff";
        playbackUtilityDefaults[`streamShellSubtitleFont_${provider}`] = "default";
    }

    let playbackUtilitySettings = {
        ...playbackUtilityDefaults
    };

    function playbackUtilityKeysForProvider(provider) {
        const keys = Object.keys(playbackUtilityDefaults).filter(
            key => PLAYBACK_UTILITY_GLOBAL_KEYS.has(key) ||
                key.endsWith(`_${provider}`)
        );

        if (provider === "youtube" || provider === "crunchyroll") {
            keys.push(
                displayScopedStorageKey(
                    `streamShellDoubleClickWindowed_${provider}`
                )
            );
        }

        return keys;
    }

    function windowedDoubleClickEnabled(provider) {
        const baseKey = `streamShellDoubleClickWindowed_${provider}`;
        const scopedKey = displayScopedStorageKey(baseKey);

        if (Object.prototype.hasOwnProperty.call(playbackUtilitySettings, scopedKey)) {
            return playbackUtilitySettings[scopedKey] === true;
        }

        return playbackUtilitySettings[baseKey] === true;
    }

    let playbackUtilityTimer = null;
    let playbackAnarchyTimer = null;
    let playbackAnarchyState = null;
    let subtitleAnarchyTimer = null;
    let subtitleColorTimer = null;
    let subtitleAnarchyState = null;
    let dvdAnarchyFrame = null;
    let dvdAnarchyHost = null;
    let dvdAnarchyLogo = null;
    let dvdAnarchyState = null;
    let sleepTimerEndArmed = false;

    function normalizePlaybackRate(value) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
            return 1;
        }

        return Math.min(2, Math.max(0.25, numeric));
    }


    function normalizeSubtitleScale(value) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
            return 1;
        }

        return Math.min(2, Math.max(0.5, numeric));
    }

    function normalizeSubtitleColor(value) {
        const text = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(text)
            ? text
            : "#ffffff";
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function smoothStep(value) {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }

