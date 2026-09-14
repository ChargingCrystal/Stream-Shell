    /* Provider API runtime event wiring and lazy resume/self-test startup. */
    function startProviderApi() {
        if (providerApiStarted) return;
        const provider = getCurrentProvider();
        if (!provider) return;

        providerApiStarted = true;
        let lastFlightWatchContext = null;
        let lastFlightVideoPresent = null;

        const syncFlightState = reason => {
            const adapter = getProviderAdapter(provider);
            const watchContext = adapter?.isWatchContext?.() === true;
            const videoPresent = Boolean(getPrimaryVideo());

            if (lastFlightWatchContext !== watchContext) {
                recordProviderFlightEvent(
                    watchContext ? "entered" : "left",
                    {
                        category: "watch-context",
                        provider,
                        detail: { reason }
                    }
                );
                lastFlightWatchContext = watchContext;
            }

            if (lastFlightVideoPresent !== videoPresent) {
                recordProviderFlightEvent(
                    videoPresent ? "appeared" : "disappeared",
                    {
                        category: "video",
                        provider,
                        detail: { reason }
                    }
                );
                lastFlightVideoPresent = videoPresent;
            }
        };

        const emitState = reason => {
            providerApiEmit("statechange", { provider, reason });

            if (/(navigate|navigation|popstate|pageshow)/i.test(String(reason || ""))) {
                recordProviderFlightEvent("navigation", {
                    category: "spa",
                    provider,
                    detail: { reason }
                });
            }

            syncFlightState(reason);
            if (reason !== "timeupdate") scheduleProviderApiSelfTest(reason, 700);
        };

        for (const eventName of ["play", "pause", "ended", "loadedmetadata", "seeked"]) {
            document.addEventListener(eventName, () => emitState(eventName), true);
        }

        document.addEventListener("timeupdate", () => {
            const now = Date.now();
            const cadence = typeof getProviderResourceDelay === "function"
                ? getProviderResourceDelay(5000, "metadata")
                : 5000;
            if (now - providerApiProgressEventAt < cadence) return;
            providerApiProgressEventAt = now;
            emitState("timeupdate");
            providerApiEmit("progress", { provider });
        }, true);

        document.addEventListener("visibilitychange", () => emitState("visibilitychange"));
        window.addEventListener("popstate", () => {
            emitState("popstate");
            setTimeout(() => tryApplyPendingResume(provider), 80);
        });
        window.addEventListener("pageshow", () => emitState("pageshow"));

        const adapter = getProviderAdapter(provider);
        recordProviderFlightEvent("started", {
            category: "provider-api",
            provider,
            detail: { adapterKind: adapter?.adapterKind || "missing" }
        });
        syncFlightState("startup");

        adapter?.bindProviderApiEvents?.({
            emitState,
            applyPendingResume: () => tryApplyPendingResume(provider)
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message?.type !== "stream-shell-provider-resolve-media-link") return;
            if (message?.provider !== provider) {
                sendResponse({
                    ok: false,
                    error: "Provider mismatch."
                });
                return;
            }

            Promise.resolve(
                adapter?.resolveMediaUrl?.(
                    message.identity,
                    message.fallbackUrl
                )
            )
                .then(result => {
                    if (
                        !result?.url ||
                        !isProviderOwnedMediaUrl(provider, result.url)
                    ) {
                        sendResponse({
                            ok: false,
                            error: "No provider-owned media URL could be resolved."
                        });
                        return;
                    }

                    recordProviderFlightEvent("resolved", {
                        category: "stale-link",
                        provider,
                        detail: {
                            strategy: result.strategy || adapter?.linkResolverStrategy || "adapter",
                            reconstructed: result.reconstructed === true
                        }
                    });

                    sendResponse({
                        ok: true,
                        result: {
                            provider,
                            identity: result.identity || getProviderMediaIdentity(provider, result.url),
                            url: normalizeProviderResumeUrl(provider, result.url),
                            strategy: result.strategy || adapter?.linkResolverStrategy || "adapter",
                            reconstructed: result.reconstructed === true
                        }
                    });
                })
                .catch(error => {
                    sendResponse({
                        ok: false,
                        error: String(error?.message || "Media link resolver failed.")
                    });
                });

            return true;
        });

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            const resumeKey = `${PENDING_RESUME_KEY_PREFIX}${provider}`;
            if (changes[resumeKey]?.newValue) {
                setTimeout(() => tryApplyPendingResume(provider), 80);
            }

            if (Object.prototype.hasOwnProperty.call(
                changes,
                CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY
            )) {
                const previous = continueWatchingCompletePercent;
                const next = setContinueWatchingCompletePercent(
                    changes[CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY]?.newValue
                );

                if (next !== previous) {
                    providerApiEmit("continuethresholdchange", {
                        provider,
                        previous,
                        next
                    });
                }
            }

            const launchSelfTest = changes.streamShellLaunchSelfTest?.newValue;
            const launchStartedAt = Number(launchSelfTest?.startedAt) || null;
            if (
                launchStartedAt &&
                launchStartedAt !== providerApiLastLaunchSelfTestStartedAt
            ) {
                providerApiLastLaunchSelfTestStartedAt = launchStartedAt;
                scheduleProviderApiSelfTest("launch", 350);
            }
        });

        scheduleProviderApiSelfTest("startup", 1200);
        setTimeout(() => tryApplyPendingResume(provider), 150);
    }
