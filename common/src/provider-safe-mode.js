    /*
     * ============================================================
     * PER-PROVIDER SAFE MODE
     * ============================================================
     * Isolation switch for provider-specific DOM/UI manipulation.
     * Provider API, Continue/Resume, Now Playing and other shell basics
     * remain alive so Diagnostics can distinguish provider failures from
     * Stream Shell presentation/automation failures.
     */
    const PROVIDER_SAFE_MODE_KEY_PREFIX = "streamShellProviderSafeMode_";
    const PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE = "data-stream-shell-safe-mode";

    let providerSafeModeProvider = null;
    let providerSafeModeEnabled = false;
    let providerSafeModeInitialized = false;
    let providerSafeModeStorageBound = false;
    let providerSafeModeChangedAt = null;

    function getProviderSafeModeStorageKey(provider) {
        return `${PROVIDER_SAFE_MODE_KEY_PREFIX}${provider}`;
    }

    function isProviderSafeModeEnabled(provider = getCurrentProvider()) {
        return Boolean(
            provider &&
            providerSafeModeInitialized &&
            providerSafeModeProvider === provider &&
            providerSafeModeEnabled
        );
    }

    function getProviderSafeModeState(provider = getCurrentProvider()) {
        return {
            supported: Boolean(provider && PROVIDERS[provider]),
            provider: provider || null,
            enabled: isProviderSafeModeEnabled(provider),
            initialized: providerSafeModeInitialized,
            storageKey: provider ? getProviderSafeModeStorageKey(provider) : null,
            changedAt: providerSafeModeChangedAt
        };
    }

    function setProviderSafeModeMarker(provider, enabled) {
        const root = document.documentElement;
        if (!root) return;

        if (enabled) {
            root.setAttribute(PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE, provider);
        } else {
            root.removeAttribute(PROVIDER_SAFE_MODE_ROOT_ATTRIBUTE);
        }
    }

    function clearGenericSubtitleSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        root.removeAttribute("data-stream-shell-subtitle-override");
        root.removeAttribute("data-stream-shell-subtitle-font-override");
        root.removeAttribute("data-stream-shell-subtitle-provider");
        root.style.removeProperty("--stream-shell-subtitle-scale");
        root.style.removeProperty("--stream-shell-subtitle-color");
        root.style.removeProperty("--stream-shell-subtitle-font");
    }

    function clearPrimeSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        for (const attribute of [
            "data-stream-shell-prime-ui-fix",
            "data-stream-shell-prime-hide-xray",
            "data-stream-shell-prime-hide-overlay",
            "data-stream-shell-prime-subtitles"
        ]) {
            root.removeAttribute(attribute);
        }

        root.style.removeProperty("--stream-shell-prime-subtitle-scale");
        root.style.removeProperty("--stream-shell-prime-subtitle-color");
        root.style.removeProperty("--stream-shell-prime-subtitle-font");
    }

    function clearYouTubeSafeModeState() {
        const root = document.documentElement;
        if (!root) return;

        root.removeAttribute("data-stream-shell-youtube-theme");
        root.removeAttribute("data-stream-shell-youtube-extras");
        root.removeAttribute("data-stream-shell-youtube-top-ui");

        if (typeof YOUTUBE_CLEANUP_SETTINGS === "object") {
            for (const attribute of Object.values(YOUTUBE_CLEANUP_SETTINGS)) {
                root.removeAttribute(attribute);
            }
        }

        try { clearYouTubeTopUiTimer(); } catch {}
        try { restoreYouTubeTheaterModeIfNeeded(); } catch {}
        try { clearYouTubeTextCleanupTargets(); } catch {}
        try { restoreYouTubeUploadDate(); } catch {}
        try { clearYouTubeShortsLikeIcons(); } catch {}

        const video = getPrimaryVideo();
        if (video) {
            try {
                video.loop = location.pathname.startsWith("/shorts/");
            } catch {
            }
        }
    }

    function clearProviderInvasiveState(provider) {
        try { syncWindowedPlayerMode(provider, false); } catch {}
        clearGenericSubtitleSafeModeState();
        try { syncPlaybackUtilities(provider); } catch {}

        if (provider === "youtube") {
            clearYouTubeSafeModeState();
            try { disconnectYouTubeRuntimeObservers(); } catch {}
            try { clearYouTubeUtilityDomTimer(); } catch {}
            try { cancelYouTubeUtilitySettlePasses(); } catch {}
            return;
        }

        if (provider === "netflix") {
            document.documentElement?.removeAttribute(
                "data-stream-shell-netflix-wallpaper"
            );
            try { syncNetflixEnhancementObserver(); } catch {}
            return;
        }

        if (provider === "prime") {
            clearPrimeSafeModeState();
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
            return;
        }

        if (provider === "crunchyroll") {
            const root = document.documentElement;
            root?.removeAttribute(
                "data-stream-shell-crunchyroll-blur-thumbnails"
            );
        }
    }

    async function restoreProviderInvasiveState(provider) {
        try {
            if (WINDOWED_PLAYER_PROVIDERS.has(provider)) {
                const storageKey = getWindowedPlayerStorageKey(provider);
                const stored = await chrome.storage.local.get(storageKey);
                syncWindowedPlayerMode(provider, stored[storageKey] === true);
            }
        } catch {
        }

        try { syncPlaybackUtilities(provider); } catch {}

        if (provider === "youtube") {
            try { setYouTubeThemeMarker(); } catch {}
            try { syncYouTubeCleanupMarkers(); } catch {}
            try { syncYouTubeRuntimeObservers(); } catch {}
            try { handleYouTubeUtilityNavigation(); } catch {}
        } else if (provider === "netflix") {
            try { syncNetflixEnhancementObserver(); } catch {}
            try { runNetflixEnhancements(); } catch {}
        } else if (provider === "prime") {
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
        } else if (provider === "crunchyroll") {
            try {
                const adapter = getProviderAdapter("crunchyroll");
                adapter?.extensions?.enhancements?.syncSettings?.();
                await adapter?.extensions?.skipEvents?.load?.(true);
            } catch {
            }
        } else if (provider === "disney") {
            try {
                getProviderAdapter("disney")
                    ?.extensions
                    ?.subtitleStyling
                    ?.sync?.(playbackUtilitySettings);
            } catch {
            }
        }
    }

    async function applyProviderSafeModeState(provider, enabled, reason = "runtime") {
        const next = enabled === true;
        const wasInitialized = providerSafeModeInitialized;
        const changed = providerSafeModeProvider !== provider ||
            providerSafeModeEnabled !== next ||
            !wasInitialized;

        providerSafeModeProvider = provider;
        providerSafeModeEnabled = next;
        providerSafeModeInitialized = true;
        if (changed) providerSafeModeChangedAt = Date.now();

        setProviderSafeModeMarker(provider, next);

        if (next) {
            clearProviderInvasiveState(provider);
        } else if (changed && wasInitialized) {
            await restoreProviderInvasiveState(provider);
        }

        if (changed && (wasInitialized || next)) {
            recordProviderFlightEvent(next ? "enabled" : "disabled", {
                category: "safe-mode",
                provider,
                detail: { reason }
            });

            try {
                providerApiNotifyExtensionChange("safeMode", {
                    enabled: next,
                    reason
                });
            } catch {
            }
        }

        return getProviderSafeModeState(provider);
    }

    async function initializeProviderSafeMode() {
        const provider = getCurrentProvider();
        if (!provider) return getProviderSafeModeState(null);

        const storageKey = getProviderSafeModeStorageKey(provider);
        let enabled = false;

        try {
            const stored = await chrome.storage.local.get(storageKey);
            enabled = stored[storageKey] === true;
        } catch {
        }

        await applyProviderSafeModeState(provider, enabled, "startup");

        if (!providerSafeModeStorageBound) {
            providerSafeModeStorageBound = true;
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (
                    areaName !== "local" ||
                    !Object.prototype.hasOwnProperty.call(changes, storageKey)
                ) {
                    return;
                }

                applyProviderSafeModeState(
                    provider,
                    changes[storageKey]?.newValue === true,
                    "settings"
                ).catch(() => {});
            });
        }

        return getProviderSafeModeState(provider);
    }
