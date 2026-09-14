    /*
     * ============================================================
     * PRIME VIDEO ENHANCEMENTS
     * ============================================================
     * Settings and scheduling layer. Prime-specific DOM operations are
     * delegated to the Prime Provider Adapter.
     */

    const PRIME_SETTINGS_DEFAULTS = {
        streamShellPrimeUiFixEnabled: true,
        streamShellPrimeHideXray: true,
        streamShellPrimeHideOverlay: true,
        streamShellPrimeAutoSkipIntro: false,
        streamShellPrimeAutoSkipRecap: false,
        streamShellPrimeAutoSkipPromos: true,
        streamShellPrimeSubtitleScale: "0.5",
        streamShellPrimeSubtitleColor: "#ffffff",
        streamShellPrimeSubtitleFont: "default",
        streamShellSubtitleAnarchy: false
    };

    const PRIME_SUBTITLE_FONT_STACKS = {
        Arial: 'Arial, sans-serif',
        Helvetica: 'Helvetica, Arial, sans-serif',
        Georgia: 'Georgia, serif',
        "Times New Roman": '"Times New Roman", Times, serif',
        "Courier New": '"Courier New", monospace',
        Verdana: 'Verdana, sans-serif',
        Roboto: 'Roboto, Arial, sans-serif'
    };

    let primeSettings = {
        ...PRIME_SETTINGS_DEFAULTS
    };

    let primeSubtitleAnarchyTimer = null;
    let primeSubtitleColorTimer = null;
    let primeSubtitleAnarchyState = null;

    function getPrimeEnhancementAdapter() {
        const adapter = getProviderAdapter("prime");
        return adapter?.adapterKind === "prime"
            ? adapter
            : null;
    }

    function normalizePrimeSubtitleScale(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0.5;
        return Math.min(2, Math.max(0.5, numeric));
    }

    function normalizePrimeSubtitleColor(value) {
        const text = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(text)
            ? text
            : "#ffffff";
    }

    function primeAnarchyRandomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function primeAnarchySmoothStep(value) {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    }

    const PRIME_ANARCHY_NEON_COLORS = [
        "#ff1744", "#ff2d55", "#ff006e", "#ff1493",
        "#ff00aa", "#ff00d4", "#ff00ff", "#d500f9",
        "#b000ff", "#7c00ff", "#651fff", "#304ffe",
        "#0066ff", "#0091ff", "#00b8ff", "#00e5ff",
        "#00ffff", "#00ffd5", "#00ff9d", "#00ff66",
        "#00ff00", "#64ff00", "#a8ff00", "#d4ff00",
        "#ffff00", "#ffd600", "#ffb300", "#ff8c00",
        "#ff6d00", "#ff3d00", "#ff5252", "#ff4081"
    ];
    let primeAnarchyColorBag = [];

    function refillPrimeAnarchyColorBag() {
        primeAnarchyColorBag = [...PRIME_ANARCHY_NEON_COLORS];
        for (let i = primeAnarchyColorBag.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [primeAnarchyColorBag[i], primeAnarchyColorBag[j]] =
                [primeAnarchyColorBag[j], primeAnarchyColorBag[i]];
        }
    }

    function primeAnarchyColor() {
        if (!primeAnarchyColorBag.length) refillPrimeAnarchyColorBag();
        return primeAnarchyColorBag.pop();
    }

    function primeSubtitleAnarchyEnabled() {
        return !isProviderSafeModeEnabled("prime") &&
            shouldProviderResourceRunVisualWork() &&
            primeSettings.streamShellSubtitleAnarchy === true;
    }

    function choosePrimeSubtitleAnarchyTarget() {
        const adapter = getPrimeEnhancementAdapter();
        const current = Number(
            adapter?.extensions?.subtitles?.getState?.()?.scale
        );

        primeSubtitleAnarchyState = {
            from: Number.isFinite(current) && current > 0
                ? current
                : normalizePrimeSubtitleScale(
                    primeSettings.streamShellPrimeSubtitleScale
                ),
            target: primeAnarchyRandomBetween(0.62, 1.85),
            startedAt: performance.now(),
            duration: primeAnarchyRandomBetween(650, 2600)
        };
    }

    function tickPrimeSubtitleAnarchy() {
        if (!primeSubtitleAnarchyEnabled()) {
            primeSubtitleAnarchyState = null;
            return;
        }

        const adapter = getPrimeEnhancementAdapter();
        const setScale = adapter?.extensions?.subtitles?.setScale;
        if (typeof setScale !== "function") return;

        if (!primeSubtitleAnarchyState) {
            choosePrimeSubtitleAnarchyTarget();
        }

        const state = primeSubtitleAnarchyState;
        const now = performance.now();
        const t = (now - state.startedAt) / state.duration;
        const eased = primeAnarchySmoothStep(t);
        const scale = state.from +
            (state.target - state.from) * eased;

        setScale(scale);

        if (t >= 1) {
            primeSubtitleAnarchyState = {
                from: state.target,
                target: primeAnarchyRandomBetween(0.62, 1.85),
                startedAt: now,
                duration: primeAnarchyRandomBetween(650, 2600)
            };
        }
    }

    function syncPrimeSubtitleAnarchy() {
        const enabled = primeSubtitleAnarchyEnabled();
        const adapter = getPrimeEnhancementAdapter();
        const setColor = adapter?.extensions?.subtitles?.setColor;

        if (enabled && !primeSubtitleAnarchyTimer) {
            primeSubtitleAnarchyTimer = setInterval(
                tickPrimeSubtitleAnarchy,
                50
            );
            primeSubtitleColorTimer = setInterval(
                () => {
                    if (
                        primeSubtitleAnarchyEnabled() &&
                        typeof setColor === "function"
                    ) {
                        setColor(primeAnarchyColor());
                    }
                },
                200
            );
            if (typeof setColor === "function") {
                setColor(primeAnarchyColor());
            }
            tickPrimeSubtitleAnarchy();
            return;
        }

        if (!enabled) {
            if (primeSubtitleAnarchyTimer) {
                clearInterval(primeSubtitleAnarchyTimer);
                primeSubtitleAnarchyTimer = null;
            }
            if (primeSubtitleColorTimer) {
                clearInterval(primeSubtitleColorTimer);
                primeSubtitleColorTimer = null;
            }
            primeSubtitleAnarchyState = null;
        }
    }

    function syncPrimeEnhancementMarkers() {
        const adapter = getPrimeEnhancementAdapter();
        adapter?.extensions?.presentation?.sync?.(primeSettings);
        syncPrimeSubtitleAnarchy();
    }

    function syncPrimeAutoSkipObserver() {
        const adapter = getPrimeEnhancementAdapter();
        adapter?.extensions?.autoSkip?.syncObserver?.(primeSettings);
    }

    async function startPrimeEnhancements() {
        if (getCurrentProvider() !== "prime") return;

        const keys = Object.keys(PRIME_SETTINGS_DEFAULTS);

        try {
            const stored = await chrome.storage.local.get(keys);
            primeSettings = {
                ...PRIME_SETTINGS_DEFAULTS,
                ...stored
            };
        } catch {
            primeSettings = {
                ...PRIME_SETTINGS_DEFAULTS
            };
        }

        syncPrimeEnhancementMarkers();
        syncPrimeAutoSkipObserver();

        onProviderResourceGovernorChange(() => {
            syncPrimeEnhancementMarkers();
            syncPrimeAutoSkipObserver();
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            let changed = false;
            for (const key of keys) {
                if (!Object.prototype.hasOwnProperty.call(changes, key)) {
                    continue;
                }

                primeSettings[key] =
                    changes[key]?.newValue === undefined
                        ? PRIME_SETTINGS_DEFAULTS[key]
                        : changes[key].newValue;
                changed = true;
            }

            if (!changed) return;

            syncPrimeEnhancementMarkers();
            syncPrimeAutoSkipObserver();
        });
    }
