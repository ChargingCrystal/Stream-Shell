    /* Continue Watching persistence and provider resume orchestration. */
    function normalizeContinueWatchingItem(item) {
        const provider = String(item?.provider || "");
        const url = String(item?.url || "");
        const currentTime = Number(item?.currentTime);
        const duration = Number(item?.duration);
        const progressPercent = duration > 0 && Number.isFinite(currentTime)
            ? Math.max(0, Math.min(100, currentTime / duration * 100))
            : Number(item?.progressPercent);
        return {
            id: String(item?.id || getProviderMediaIdentity(provider, url)),
            provider,
            title: String(item?.title || "").trim(),
            image: String(item?.image || "").trim(),
            url,
            currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
            duration: Number.isFinite(duration) && duration > 0 ? duration : null,
            progressPercent: Number.isFinite(progressPercent) ? Math.max(0, Math.min(100, progressPercent)) : null,
            updatedAt: Number(item?.updatedAt) || Date.now()
        };
    }

    async function updateContinueWatching(media) {
        if (!media?.provider || !media?.title || !media?.url) return;
        const currentTime = Number(media.currentTime);
        const duration = Number(media.duration);
        if (!Number.isFinite(currentTime) || currentTime < 1 || !Number.isFinite(duration) || duration <= 0) return;

        const id = media.identity || getProviderMediaIdentity(media.provider, media.url);
        const progressPercent = Math.max(0, Math.min(100, currentTime / duration * 100));
        const stored = await chrome.storage.local.get(CONTINUE_WATCHING_STORAGE_KEY);
        const items = Array.isArray(stored[CONTINUE_WATCHING_STORAGE_KEY])
            ? stored[CONTINUE_WATCHING_STORAGE_KEY].map(normalizeContinueWatchingItem)
            : [];
        const remaining = items.filter(item => {
            if (item.id === id) return false;
            return getProviderMediaIdentity(item.provider, item.url) !== id;
        });

        if (progressPercent < continueWatchingCompletePercent) {
            remaining.unshift(normalizeContinueWatchingItem({
                id,
                provider: media.provider,
                title: media.title,
                image: media.image,
                url: media.url,
                currentTime,
                duration,
                progressPercent,
                updatedAt: Date.now()
            }));
        }

        await chrome.storage.local.set({
            [CONTINUE_WATCHING_STORAGE_KEY]: remaining.slice(0, CONTINUE_WATCHING_MAX_ITEMS)
        });
    }

    async function cancelPendingProviderResume(
        provider = getCurrentProvider(),
        reason = "manual-repair"
    ) {
        if (!provider) return false;

        providerApiResumeGeneration += 1;
        providerApiLastResumeFlightKey = "";

        try {
            await chrome.storage.local.remove(
                `${PENDING_RESUME_KEY_PREFIX}${provider}`
            );
        } catch {
            return false;
        }

        recordProviderFlightEvent("cleared", {
            category: "resume",
            provider,
            detail: { reason }
        });

        providerApiEmit("resume-cleared", { provider, reason });
        return true;
    }

    async function tryApplyPendingResume(provider = getCurrentProvider()) {
        if (!provider || providerApiResumeRunning) return false;
        providerApiResumeRunning = true;
        const key = `${PENDING_RESUME_KEY_PREFIX}${provider}`;
        const resumeGeneration = providerApiResumeGeneration;

        try {
            const stored = await chrome.storage.local.get(key);
            const pending = stored[key];
            if (!pending) return false;
            if (resumeGeneration !== providerApiResumeGeneration) return false;

            const requestedAt = Number(pending.requestedAt) || 0;
            const resumeFlightKey = `${provider}:${requestedAt}:${Number(pending.currentTime) || 0}`;
            if (resumeFlightKey !== providerApiLastResumeFlightKey) {
                providerApiLastResumeFlightKey = resumeFlightKey;
                recordProviderFlightEvent("bootstrap", {
                    category: "resume",
                    provider,
                    detail: {
                        targetTime: Number(pending.currentTime) || null,
                        ageMs: requestedAt ? Math.max(0, Date.now() - requestedAt) : null
                    }
                });
            }

            if (requestedAt && Date.now() - requestedAt > 10 * 60 * 1000) {
                recordProviderFlightEvent("failed", {
                    category: "resume",
                    level: "warn",
                    provider,
                    detail: { reason: "expired" }
                });
                await chrome.storage.local.remove(key);
                return false;
            }

            const adapter = getProviderAdapter(provider);
            const currentIdentity = adapter?.getIdentity?.() ||
                getProviderMediaIdentity(provider, window.location.href);
            if (pending.identity && pending.identity !== currentIdentity) return false;

            const target = Number(pending.currentTime);
            if (!Number.isFinite(target) || target < 1) {
                recordProviderFlightEvent("failed", {
                    category: "resume",
                    level: "warn",
                    provider,
                    detail: { reason: "invalid-target" }
                });
                await chrome.storage.local.remove(key);
                return false;
            }

            const confirmation = adapter?.resumeConfirmation || {};
            const confirmationDelayMs = Math.max(
                120,
                Number(confirmation.delayMs) || 250
            );
            const confirmationChecks = Math.max(
                1,
                Math.min(5, Number(confirmation.checks) || 1)
            );
            const toleranceSeconds = Math.max(
                1,
                Number(confirmation.toleranceSeconds) || 5
            );

            const deadline = Date.now() + 30000;
            let attempt = 0;

            while (Date.now() < deadline) {
                if (resumeGeneration !== providerApiResumeGeneration) {
                    recordProviderFlightEvent("cancelled", {
                        category: "resume",
                        provider,
                        detail: { reason: "repair-cancelled" }
                    });
                    return false;
                }

                attempt += 1;

                try {
                    await adapter?.prepareResume?.({
                        pending,
                        target,
                        deadline,
                        attempt
                    });
                } catch {
                }

                const video = getPrimaryVideo();
                const mediaReady = video && video.readyState >= 1 && (
                    typeof adapter?.isResumeMediaReady !== "function" ||
                    adapter.isResumeMediaReady(video) === true
                );

                if (mediaReady) {
                    const duration = Number.isFinite(video.duration) && video.duration > 0
                        ? video.duration
                        : null;
                    const safeTarget = duration
                        ? Math.min(target, Math.max(0, duration - 1))
                        : target;

                    try {
                        recordProviderFlightEvent("seek-attempt", {
                            category: "resume",
                            provider,
                            detail: {
                                attempt,
                                targetTime: safeTarget,
                                strategy: adapter?.resumeStrategy || "pending-seek"
                            }
                        });

                        const seekResult = typeof adapter?.seekTo === "function"
                            ? await Promise.resolve(adapter.seekTo(Math.max(0, safeTarget)))
                            : false;

                        if (seekResult !== false) {
                            let stable = true;

                            for (let check = 0; check < confirmationChecks; check += 1) {
                                await delay(confirmationDelayMs);
                                if (resumeGeneration !== providerApiResumeGeneration) {
                                    return false;
                                }

                                const playback = adapter?.getPlayback?.() || getPlaybackSnapshot();
                                const observed = Number(playback?.currentTime);

                                if (
                                    !Number.isFinite(observed) ||
                                    observed < safeTarget - toleranceSeconds
                                ) {
                                    stable = false;
                                    break;
                                }
                            }

                            if (stable) {
                                await chrome.storage.local.remove(key);
                                providerApiEmit("resume-applied", {
                                    provider,
                                    currentTime: safeTarget,
                                    strategy: adapter?.resumeStrategy || "pending-seek"
                                });
                                recordProviderFlightEvent("confirmed", {
                                    category: "resume",
                                    provider,
                                    detail: {
                                        targetTime: safeTarget,
                                        attempts: attempt,
                                        strategy: adapter?.resumeStrategy || "pending-seek"
                                    }
                                });
                                return true;
                            }
                        }
                    } catch {
                    }
                }

                await delay(250);
            }

            recordProviderFlightEvent("failed", {
                category: "resume",
                level: "error",
                provider,
                detail: { reason: "timeout", attempts: attempt }
            });
            return false;
        } catch (error) {
            recordProviderFlightEvent("failed", {
                category: "resume",
                level: "error",
                provider,
                detail: {
                    reason: "exception",
                    message: String(error?.message || error || "unknown")
                }
            });
            return false;
        } finally {
            providerApiResumeRunning = false;
        }
    }
