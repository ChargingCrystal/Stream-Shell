    /*
     * ============================================================
     * PROVIDER SELF-HEAL / REPAIR
     * ============================================================
     * Targeted, provider-local recovery primitives used by Diagnostics.
     * No broad reinjection: repair escalates from marker/state resync to
     * adapter/runtime rebuild and only the background may reload a tab.
     */
    let providerRepairLastResult = null;

    const PROVIDER_REPAIR_ACTIONS = new Set([
        "restore-managed-marker",
        "clear-pending-resume",
        "resync-adapter",
        "resync-content-state",
        "reinitialize-runtime",
        "netflix-bridge-probe"
    ]);

    function setProviderRepairResult(provider, action, ok, detail = {}) {
        providerRepairLastResult = {
            provider,
            action,
            ok: ok === true,
            detail: detail && typeof detail === "object" ? detail : {},
            at: Date.now()
        };

        recordProviderFlightEvent(ok === true ? "completed" : "failed", {
            category: "repair",
            level: ok === true ? "info" : "error",
            provider,
            detail: {
                action,
                ...providerRepairLastResult.detail
            }
        });

        return providerRepairLastResult;
    }

    async function hydratePlaybackRepairSettings(provider) {
        const keys = playbackUtilityKeysForProvider(provider);
        if (!keys.length) return;

        try {
            const stored = await chrome.storage.local.get(keys);
            for (const key of keys) {
                playbackUtilitySettings[key] = stored[key] === undefined
                    ? playbackUtilityDefaults[key]
                    : stored[key];
            }
        } catch {
        }
    }

    async function hydrateProviderFeatureRepairSettings(provider) {
        try {
            if (provider === "youtube") {
                const stored = await chrome.storage.local.get(
                    Object.keys(YOUTUBE_UTILITY_DEFAULTS)
                );
                youtubeUtilitySettings = {
                    ...YOUTUBE_UTILITY_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "netflix") {
                const stored = await chrome.storage.local.get(
                    Object.keys(NETFLIX_ENHANCEMENT_DEFAULTS)
                );
                netflixEnhancementSettings = {
                    ...NETFLIX_ENHANCEMENT_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "prime") {
                const stored = await chrome.storage.local.get(
                    Object.keys(PRIME_SETTINGS_DEFAULTS)
                );
                primeSettings = {
                    ...PRIME_SETTINGS_DEFAULTS,
                    ...stored
                };
                return;
            }

            if (provider === "crunchyroll") {
                const stored = await chrome.storage.local.get(
                    Object.keys(CRUNCHYROLL_ENHANCEMENT_DEFAULTS)
                );
                crunchyrollEnhancementSettings = {
                    ...CRUNCHYROLL_ENHANCEMENT_DEFAULTS,
                    ...stored
                };
            }
        } catch {
        }
    }

    async function resyncWindowedPlayerRepairState(provider, adapter) {
        if (!WINDOWED_PLAYER_PROVIDERS.has(provider)) return false;

        const storageKey = getWindowedPlayerStorageKey(provider);
        const extension = adapter?.extensions?.windowedPlayer || null;
        const storageKeys = [
            storageKey,
            ...(Array.isArray(extension?.storageKeys)
                ? extension.storageKeys
                : [])
        ];

        let stored = {};
        try {
            stored = await chrome.storage.local.get(storageKeys);
        } catch {
        }

        try {
            extension?.hydrate?.(stored);
        } catch {
        }

        syncWindowedPlayerMode(
            provider,
            stored[storageKey] === true
        );
        return true;
    }

    async function applyProviderRepairState(provider, adapter) {
        startManagedMarkerGuard();
        await resyncWindowedPlayerRepairState(provider, adapter);

        try {
            syncPlaybackUtilities(provider);
        } catch {
        }

        if (provider === "youtube") {
            try { setYouTubeThemeMarker(); } catch {}
            try { syncYouTubeCleanupMarkers(); } catch {}
            try { handleYouTubeUtilityNavigation(); } catch {}
        } else if (provider === "netflix") {
            try { runNetflixEnhancements(); } catch {}
        } else if (provider === "prime") {
            try { syncPrimeEnhancementMarkers(); } catch {}
            try { syncPrimeAutoSkipObserver(); } catch {}
        } else if (provider === "crunchyroll") {
            try {
                adapter?.extensions?.enhancements?.syncSettings?.();
                await adapter?.extensions?.skipEvents?.load?.(true);
            } catch {
            }
        } else if (provider === "disney") {
            try {
                adapter?.extensions?.subtitleStyling?.sync?.(
                    playbackUtilitySettings
                );
            } catch {
            }
        }

        providerApiNotifyExtensionChange("diagnosticsRepair", {
            repair: "content-state"
        });
        return true;
    }

    function rebuildProviderAdapterForRepair(provider) {
        providerAdapterInstances.delete(provider);
        const adapter = getProviderAdapter(provider);
        return adapter?.adapterKind === provider
            ? adapter
            : null;
    }

    async function executeProviderRepair(action) {
        const provider = getCurrentProvider();
        const normalizedAction = String(action || "");

        if (!provider || !PROVIDER_REPAIR_ACTIONS.has(normalizedAction)) {
            return setProviderRepairResult(
                provider || null,
                normalizedAction || "unknown",
                false,
                { reason: "unsupported-action" }
            );
        }

        recordProviderFlightEvent("requested", {
            category: "repair",
            provider,
            detail: { action: normalizedAction }
        });

        try {
            let detail = {};

            if (normalizedAction === "restore-managed-marker") {
                startManagedMarkerGuard();
                const restored = document.documentElement
                    ?.getAttribute("data-stream-shell") === "true";
                detail = { markerPresent: restored };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    restored,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "clear-pending-resume") {
                const cleared = await cancelPendingProviderResume(
                    provider,
                    "diagnostics-repair"
                );
                detail = { cleared };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    cleared,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "netflix-bridge-probe") {
                if (provider !== "netflix") {
                    return setProviderRepairResult(
                        provider,
                        normalizedAction,
                        false,
                        { reason: "not-netflix" }
                    );
                }

                const bridgeReady = await probeNetflixPlayerBridge();
                detail = {
                    bridgeReady,
                    lastError: netflixPlayerBridgeLastError || null
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    bridgeReady,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "resync-adapter") {
                const adapter = rebuildProviderAdapterForRepair(provider);
                const ok = Boolean(adapter);
                detail = {
                    adapterKind: adapter?.adapterKind || null,
                    apiVersion: adapter?.apiVersion || null
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "resync-content-state") {
                const adapter = getProviderAdapter(provider);
                const ok = await applyProviderRepairState(provider, adapter);
                detail = { adapterKind: adapter?.adapterKind || null };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }

            if (normalizedAction === "reinitialize-runtime") {
                await initializeContinueWatchingCompletePercent();
                await hydratePlaybackRepairSettings(provider);
                await hydrateProviderFeatureRepairSettings(provider);
                const adapter = rebuildProviderAdapterForRepair(provider);
                const ok = Boolean(adapter) &&
                    await applyProviderRepairState(provider, adapter);
                detail = {
                    adapterKind: adapter?.adapterKind || null,
                    settingsRehydrated: true
                };
                const result = setProviderRepairResult(
                    provider,
                    normalizedAction,
                    ok,
                    detail
                );
                await publishProviderApiSelfTest(`repair:${normalizedAction}`);
                return result;
            }
        } catch (error) {
            return setProviderRepairResult(
                provider,
                normalizedAction,
                false,
                { reason: String(error?.message || error || "repair-failed") }
            );
        }

        return setProviderRepairResult(
            provider,
            normalizedAction,
            false,
            { reason: "unhandled-action" }
        );
    }

    function getProviderRepairDiagnosticState(provider, context = {}) {
        const recommendations = [];
        const seen = new Set();
        const addRecommendation = (action, reason, severity = "warn") => {
            if (seen.has(action)) return;
            seen.add(action);
            recommendations.push({ action, reason, severity });
        };

        const managed = context.managed === true;
        const pendingResume = context.pendingResume || null;
        const currentIdentity = context.currentIdentity || null;
        const selfTest = context.selfTest || null;
        const extensionState = context.extensionState || {};
        const watchContext = selfTest?.watchContext === true;
        const pendingAgeMs = pendingResume?.requestedAt
            ? Math.max(0, Date.now() - Number(pendingResume.requestedAt))
            : null;
        const identityMismatch = Boolean(
            pendingResume?.identity &&
            currentIdentity &&
            pendingResume.identity !== currentIdentity
        );

        if (!managed) {
            addRecommendation(
                "restore-managed-marker",
                "Stream Shell managed marker is missing.",
                "error"
            );
        }

        if (pendingResume && (identityMismatch || pendingAgeMs > 60000)) {
            addRecommendation(
                "clear-pending-resume",
                identityMismatch
                    ? "Pending resume belongs to a different media identity."
                    : "Pending resume has remained unresolved for over 60 seconds.",
                "warn"
            );
        }

        const failures = Array.isArray(selfTest?.failures)
            ? selfTest.failures
            : [];
        if (failures.some(failure =>
            failure === "adapter-missing" ||
            failure === "api-version-mismatch" ||
            /adapter-not-registered$/.test(String(failure)) ||
            String(failure).startsWith("contract-missing:")
        )) {
            addRecommendation(
                "resync-adapter",
                "Provider API adapter contract is not healthy.",
                "error"
            );
        }

        let markerStateMismatch = false;
        const safeMode = isProviderSafeModeEnabled(provider);
        if (!safeMode && provider === "youtube") {
            markerStateMismatch = Boolean(
                extensionState?.theme?.enabled &&
                !extensionState?.theme?.marker
            );
        } else if (!safeMode && provider === "prime") {
            markerStateMismatch = [
                extensionState?.uiFix,
                extensionState?.hideXray,
                extensionState?.hideOverlay
            ].some(state => state?.enabled === true && state?.marker !== true);
        } else if (!safeMode && provider === "crunchyroll") {
            markerStateMismatch = Boolean(
                extensionState?.spoilerProtection?.enabled &&
                !extensionState?.spoilerProtection?.marker
            );
        }

        if (markerStateMismatch) {
            addRecommendation(
                "resync-content-state",
                "Enabled provider feature state and DOM markers are out of sync.",
                "warn"
            );
        }

        if (provider === "netflix") {
            const bridge = extensionState?.playerBridge || {};
            if (
                bridge.lastError ||
                (watchContext && bridge.ready !== true)
            ) {
                addRecommendation(
                    "netflix-bridge-probe",
                    bridge.lastError
                        ? `Netflix player bridge reported ${bridge.lastError}.`
                        : "Netflix player bridge is not ready in watch context.",
                    "error"
                );
            }
        }

        if (selfTest?.ok === false && recommendations.length === 0) {
            addRecommendation(
                "reinitialize-runtime",
                "Provider self-test reports a fault without a narrower repair target.",
                "warn"
            );
        }

        const availableActions = [
            "resync-content-state",
            "reinitialize-runtime"
        ];
        if (!managed) availableActions.unshift("restore-managed-marker");
        if (pendingResume) availableActions.push("clear-pending-resume");
        if (provider === "netflix") availableActions.push("netflix-bridge-probe");
        if (failures.length) availableActions.push("resync-adapter");

        return {
            healthy: recommendations.length === 0,
            recommendations,
            availableActions: [...new Set(availableActions)],
            lastResult: providerRepairLastResult?.provider === provider
                ? providerRepairLastResult
                : null
        };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type !== "stream-shell-provider-repair") return;

        executeProviderRepair(message.action)
            .then(sendResponse)
            .catch(error => sendResponse({
                ok: false,
                provider: getCurrentProvider(),
                action: String(message.action || ""),
                detail: {
                    reason: String(error?.message || error || "repair-failed")
                },
                at: Date.now()
            }));

        return true;
    });
