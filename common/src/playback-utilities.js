    function syncGenericSubtitleMarker(provider) {
        if (!SUBTITLE_OVERRIDE_PROVIDERS.has(provider)) {
            return;
        }

        if (isProviderSafeModeEnabled(provider)) {
            clearGenericSubtitleSafeModeState();
            ensureSubtitleAnarchyTimers(provider);
            return;
        }

        const adapterSync = getProviderAdapter(provider)
            ?.extensions
            ?.subtitleStyling
            ?.sync;

        if (typeof adapterSync === "function") {
            adapterSync(playbackUtilitySettings);
            return;
        }

        const root = document.documentElement;
        if (!root) {
            return;
        }

        const anarchy = subtitleAnarchyEnabled(provider);
        const enabled = anarchy || playbackUtilitySettings[
            `streamShellSubtitleOverride_${provider}`
        ] === true;

        root.toggleAttribute(
            "data-stream-shell-subtitle-override",
            enabled
        );

        root.setAttribute(
            "data-stream-shell-subtitle-provider",
            provider
        );

        if (!anarchy) {
            root.style.setProperty(
                "--stream-shell-subtitle-scale",
                String(
                    normalizeSubtitleScale(
                        playbackUtilitySettings[
                            `streamShellSubtitleScale_${provider}`
                        ]
                    )
                )
            );

            root.style.setProperty(
                "--stream-shell-subtitle-color",
                normalizeSubtitleColor(
                    playbackUtilitySettings[
                        `streamShellSubtitleColor_${provider}`
                    ]
                )
            );
        }

        const font = String(
            playbackUtilitySettings[
                `streamShellSubtitleFont_${provider}`
            ] || "default"
        );

        const stack = SUBTITLE_FONT_STACKS[font];

        root.toggleAttribute(
            "data-stream-shell-subtitle-font-override",
            Boolean(stack)
        );

        if (stack) {
            root.style.setProperty(
                "--stream-shell-subtitle-font",
                stack
            );
        } else {
            root.style.removeProperty(
                "--stream-shell-subtitle-font"
            );
        }
    }

    function syncPlaybackRate(provider) {
        ensurePlaybackAnarchyTimer(provider);

        if (
            playbackAnarchyEnabled(provider) &&
            getProviderResourceGovernorState().playing === true
        ) {
            return;
        }

        const adapter = getProviderAdapter(provider);
        const video = getPrimaryVideo();
        if (!adapter || !video) {
            return;
        }

        const rate = normalizePlaybackRate(
            playbackUtilitySettings[
                `streamShellPlaybackSpeed_${provider}`
            ]
        );
        const currentRate = Number(video.playbackRate);

        /*
         * The adaptive playback loop is intentionally persistent so a provider
         * can recreate/reset its player without losing the configured rate.
         * Do not, however, keep issuing the same provider command while the
         * current media element already reports the desired value. Netflix in
         * particular would otherwise bounce a redundant command through its
         * MAIN-world bridge on every utility tick.
         */
        if (
            Number.isFinite(currentRate) &&
            Math.abs(currentRate - rate) < 0.001
        ) {
            return;
        }

        try {
            const result = adapter.setPlaybackRate(rate);
            if (result && typeof result.catch === "function") {
                result.catch(() => {});
            }
        } catch {
        }
    }

    function syncPlaybackUtilities(provider) {
        syncPlaybackRate(provider);
        syncGenericSubtitleMarker(provider);
        ensureSubtitleAnarchyTimers(provider);
        syncDvdAnarchy(provider);
    }


    function doubleClickTargetsPlayer(provider, target) {
        if (!(target instanceof Element)) {
            return false;
        }

        const adapterTargetCheck = getProviderAdapter(provider)
            ?.extensions
            ?.windowedPlayer
            ?.matchesTarget;

        if (typeof adapterTargetCheck === "function") {
            return adapterTargetCheck(target);
        }

        if (provider === "crunchyroll") {
            return Boolean(
                target.closest(
                    "#vilosRoot, #velocity-player-package, [data-testid*='player']"
                )
            );
        }

        return false;
    }

    async function handleWindowedDoubleClick(provider, event) {
        if (
            isProviderSafeModeEnabled(provider) ||
            !WINDOWED_PLAYER_PROVIDERS.has(provider) ||
            !windowedDoubleClickEnabled(provider) ||
            !isWindowedPlayerWatchContext(provider) ||
            !doubleClickTargetsPlayer(provider, event.target)
        ) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const storageKey = getWindowedPlayerStorageKey(provider);
        const scopedStorageKey = displayScopedStorageKey(storageKey);

        try {
            const stored = await chrome.storage.local.get([
                storageKey,
                scopedStorageKey
            ]);
            const current = readDisplayScopedSetting(
                stored,
                storageKey,
                false
            ) === true;

            await chrome.storage.local.set({
                [scopedStorageKey]: !current
            });
        } catch {
        }
    }

    function handleSleepTimerEnded(event) {
        if (!sleepTimerEndArmed) return;

        const media = event.target;
        if (!(media instanceof HTMLMediaElement)) return;

        const primary = getPrimaryVideo();
        if (primary && media !== primary) return;

        sleepTimerEndArmed = false;
        try { media.pause(); } catch {}

        chrome.runtime.sendMessage({
            type: "sleep-timer-ended"
        }).catch(() => {});
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === "stream-shell-playback-pause") {
            const adapter = getProviderAdapter();

            Promise.resolve()
                .then(() => adapter?.pause?.())
                .then(paused => {
                    sendResponse({
                        ok: true,
                        paused: paused !== false
                    });
                })
                .catch(() => {
                    sendResponse({
                        ok: false,
                        paused: false
                    });
                });

            return true;
        }

        if (message?.type === "stream-shell-sleep-arm") {
            sleepTimerEndArmed = message.armed === true;
            return;
        }

        if (message?.type === "stream-shell-sleep-pause") {
            const adapter = getProviderAdapter();
            if (adapter) {
                try { adapter.pause(); } catch {}
            }
        }
    });

    async function startPlaybackUtilities() {
        const provider = getCurrentProvider();

        if (!provider || !PLAYBACK_UTILITY_PROVIDERS.includes(provider)) {
            return;
        }

        const keys = playbackUtilityKeysForProvider(provider);

        try {
            const stored = await chrome.storage.local.get(keys);
            playbackUtilitySettings = {
                ...playbackUtilitySettings,
                ...stored
            };
        } catch {
        }

        syncPlaybackUtilities(provider);

        chrome.storage.onChanged.addListener(
            (changes, areaName) => {
                if (areaName !== "local") {
                    return;
                }

                let relevant = false;

                const scopedDoubleClickKey = displayScopedStorageKey(
                    `streamShellDoubleClickWindowed_${provider}`
                );

                for (const [key, change] of Object.entries(changes)) {
                    if (key === scopedDoubleClickKey) {
                        if (change.newValue === undefined) {
                            delete playbackUtilitySettings[key];
                        } else {
                            playbackUtilitySettings[key] = change.newValue;
                        }
                        relevant = true;
                        continue;
                    }

                    if (!Object.prototype.hasOwnProperty.call(
                        playbackUtilityDefaults,
                        key
                    )) {
                        continue;
                    }

                    playbackUtilitySettings[key] = change.newValue === undefined
                        ? playbackUtilityDefaults[key]
                        : change.newValue;
                    relevant = true;
                }

                if (relevant) {
                    syncPlaybackUtilities(provider);
                }
            }
        );

        if (WINDOWED_PLAYER_PROVIDERS.has(provider)) {
            document.addEventListener(
                "dblclick",
                event => {
                    handleWindowedDoubleClick(provider, event)
                        .catch(() => {});
                },
                true
            );
        }

        document.addEventListener(
            "ended",
            handleSleepTimerEnded,
            true
        );

        chrome.runtime.sendMessage({
            type: "sleep-timer-content-ready"
        }).then(response => {
            sleepTimerEndArmed = response?.armed === true;
        }).catch(() => {});

        document.addEventListener(
            "loadedmetadata",
            () => syncPlaybackUtilities(provider),
            true
        );

        document.addEventListener(
            "play",
            () => syncPlaybackRate(provider),
            true
        );

        playbackUtilityTimer = createProviderResourceLoop(
            `playback-utilities-${provider}`,
            () => syncPlaybackUtilities(provider),
            1200,
            "poll"
        );

        onProviderResourceGovernorChange(() => {
            syncPlaybackUtilities(provider);
        });
    }
