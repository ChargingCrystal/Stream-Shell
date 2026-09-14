    /* Provider API contract/self-test reporting. */
    function flattenCapabilities(capabilities) {
        const flattened = {};
        for (const [groupName, group] of Object.entries(capabilities || {})) {
            for (const [name, value] of Object.entries(group || {})) {
                flattened[`${groupName}.${name}`] = value;
            }
        }
        return flattened;
    }

    function getProviderApiSelfTest(provider = getCurrentProvider()) {
        const adapter = getProviderAdapter(provider);
        const capabilities = adapter?.getCapabilities?.() || { common: {}, extensions: {} };
        const common = capabilities.common || {};
        const managed = document.documentElement?.getAttribute("data-stream-shell") === "true";
        const failures = [];

        if (!adapter) failures.push("adapter-missing");
        if (!managed) failures.push("managed-marker-missing");
        if (adapter && adapter.apiVersion !== STREAM_SHELL_PROVIDER_API_VERSION) failures.push("api-version-mismatch");

        const requiredMethods = [
            "getIdentity",
            "getResumeUrl",
            "resolveMediaUrl",
            "isWatchContext",
            "getMediaSnapshot",
            "getCapabilities",
            "play",
            "pause",
            "seekTo",
            "seekBy",
            "setVolume",
            "toggleMute",
            "setPlaybackRate"
        ];

        for (const method of requiredMethods) {
            if (adapter && typeof adapter[method] !== "function") {
                failures.push(`contract-missing:${method}`);
            }
        }

        const dedicatedAdapterProviders = new Set([
            "youtube",
            "netflix",
            "prime",
            "disney",
            "crunchyroll"
        ]);

        if (
            dedicatedAdapterProviders.has(provider) &&
            adapter?.adapterKind !== provider
        ) {
            failures.push(`${provider}-adapter-not-registered`);
        }

        return {
            ok: failures.length === 0,
            apiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
            provider,
            adapterKind: adapter?.adapterKind || null,
            managed,
            watchContext: adapter?.isWatchContext?.() === true,
            videoPresent: Boolean(getPrimaryVideo()),
            failures,
            capabilities: flattenCapabilities(capabilities),
            extensionState: adapter?.getExtensionState?.() || null,
            checkedAt: Date.now()
        };
    }

    async function publishProviderApiSelfTest(reason = "runtime") {
        const provider = getCurrentProvider();
        if (!provider) return;
        try {
            await chrome.runtime.sendMessage({
                type: "provider-api-self-test-report",
                provider,
                reason,
                report: getProviderApiSelfTest(provider)
            });
        } catch {
        }
    }

    function scheduleProviderApiSelfTest(reason = "runtime", delayMs = 900) {
        if (providerApiSelfTestTimer) clearTimeout(providerApiSelfTestTimer);
        providerApiSelfTestTimer = setTimeout(() => {
            providerApiSelfTestTimer = null;
            publishProviderApiSelfTest(reason);
        }, delayMs);
    }
