/* Stream Shell v0.20.33: document_start essential Twitch kernel.
 * Full DOM/Marbles/claim automation is now a separate, document-bound,
 * slot-admitted script. Native surface wake and playback guard stay hot. */
(() => {
    const RESERVED_CHANNEL_PATHS = new Set([
        "directory", "downloads", "drops", "friends", "inventory", "jobs",
        "login", "messages", "p", "payments", "search", "settings", "signup",
        "subscriptions", "turbo", "videos", "wallet"
    ]);
    const TWITCH_AUTOMATION_WAKE_MS = Object.freeze({ a: 650, b: 1000, c: 1350, d: 1700 });
    let workspaceSlotId = null;
    let raidProtectionEnabled = false;
    let automationDocumentAlive = true;
    let automationStartTimer = null;
    let automationClient = null;
    let automationLoadAttempts = 0;
    const twitchStartupMetrics = {
        phase: "bootstrap", scheduledDelayMs: null, scheduledAt: null,
        activatedAt: null, activatedAfterMs: null, loadAttempts: 0,
        lastLoadError: null
    };
    const twitchRuntimeMetrics = {
        startedAt: Date.now(), visibilityChanges: 0, lastVisibilityChangeAt: null,
        heartbeatAt: null, heartbeatCount: 0, heartbeatLastDriftMs: null,
        heartbeatMaxDriftMs: 0, heartbeatDelayedCount: 0
    };
    let twitchHeartbeatTimer = null;

    function currentChannelUrl() {
        const first = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
        if (!first || RESERVED_CHANNEL_PATHS.has(first)) return null;
        return `https://www.twitch.tv/${first}`;
    }

    function getTwitchRuntimeDiagnostics() {
        const late = automationClient?.getDiagnostics?.() || {
            marblesAutoJoinEnabled: false, pendingJoin: false,
            uniquePlayUsersInBurst: 0, observedPlayCount: 0,
            historyBatchesDiscarded: 0, historicalLinesDiscarded: 0,
            hydrationLinesDiscarded: 0, timestampedLinesChecked: 0,
            lastJoinAttemptAt: null, lastJoinTimerDriftMs: null
        };
        return {
            version: 1, capturedAt: Date.now(),
            documentVisibility: document.visibilityState,
            documentFocused: document.hasFocus(),
            workspaceCovered: workspaceIsCovered(), workspaceRightMode,
            workspacePlaybackGuardEnabled, workspaceWantedPlaying,
            slotId: workspaceSlotId, channel: currentChannelUrl(),
            automation: {
                ...late, ...twitchRuntimeMetrics,
                startup: { ...twitchStartupMetrics }
            }
        };
    }

    function startTwitchRuntimeHeartbeat() {
        const intervalMs = 10000;
        let expectedAt = Date.now() + intervalMs;
        twitchHeartbeatTimer = setInterval(() => {
            const now = Date.now();
            const drift = Math.max(0, now - expectedAt);
            twitchRuntimeMetrics.heartbeatAt = now;
            twitchRuntimeMetrics.heartbeatCount += 1;
            twitchRuntimeMetrics.heartbeatLastDriftMs = drift;
            twitchRuntimeMetrics.heartbeatMaxDriftMs = Math.max(twitchRuntimeMetrics.heartbeatMaxDriftMs, drift);
            if (drift > 1500) twitchRuntimeMetrics.heartbeatDelayedCount += 1;
            expectedAt = now + intervalMs;
        }, intervalMs);
    }

    /*
     * Workspace playback is intentionally different from core-provider
     * playback. Covering the right pane with Dashboard/Discord (or covering
     * Stream Shell with another desktop window) must not pause a Twitch stream
     * that was already playing. Track the user's last visible playback intent
     * and only fight pause events while the Workspace is covered/occluded.
     */
    let workspacePlaybackGuardEnabled = false;
    let workspaceRightMode = "twitch";
    let workspaceWantedPlaying = false;
    let workspaceResumeInterval = null;
    let workspaceResumeTimeout = null;

    function getPrimaryTwitchVideo() {
        const videos = Array.from(document.querySelectorAll("video"));
        if (!videos.length) return null;
        let best = null;
        let bestArea = -1;
        for (const video of videos) {
            const rect = video.getBoundingClientRect();
            const area = Math.max(0, rect.width) * Math.max(0, rect.height);
            if (area > bestArea) {
                best = video;
                bestArea = area;
            }
        }
        return best;
    }

    function workspaceIsCovered() {
        return workspaceRightMode !== "twitch" ||
            document.visibilityState !== "visible" ||
            !document.hasFocus();
    }

    function clearWorkspaceResumeTimers() {
        if (workspaceResumeInterval !== null) {
            clearInterval(workspaceResumeInterval);
            workspaceResumeInterval = null;
        }
        if (workspaceResumeTimeout !== null) {
            clearTimeout(workspaceResumeTimeout);
            workspaceResumeTimeout = null;
        }
    }

    function tryResumeCoveredWorkspacePlayback() {
        if (!workspacePlaybackGuardEnabled || !workspaceWantedPlaying || !workspaceIsCovered()) return;
        const video = getPrimaryTwitchVideo();
        if (!video || !video.paused || video.ended) return;
        try {
            const result = video.play();
            if (result && typeof result.catch === "function") result.catch(() => {});
        } catch {}
    }

    function syncWorkspaceResumeWatchdog() {
        if (!workspacePlaybackGuardEnabled || !workspaceWantedPlaying || !workspaceIsCovered()) {
            clearWorkspaceResumeTimers();
            return;
        }

        if (workspaceResumeTimeout === null) {
            workspaceResumeTimeout = setTimeout(() => {
                workspaceResumeTimeout = null;
                tryResumeCoveredWorkspacePlayback();
            }, 120);
        }

        if (workspaceResumeInterval === null) {
            workspaceResumeInterval = setInterval(
                tryResumeCoveredWorkspacePlayback,
                15000
            );
        }
    }

    function captureVisibleWorkspacePlaybackIntent() {
        if (!workspacePlaybackGuardEnabled || workspaceIsCovered()) return;
        const video = getPrimaryTwitchVideo();
        workspaceWantedPlaying = Boolean(video && !video.paused && !video.ended);
    }

    function handleWorkspaceVisibilityTransition() {
        if (!workspacePlaybackGuardEnabled) return;
        if (workspaceIsCovered()) {
            syncWorkspaceResumeWatchdog();
            return;
        }

        /* If Twitch/browser paused while covered, give it one final resume on
         * reveal before returning control fully to normal visible playback. */
        if (workspaceWantedPlaying) {
            const video = getPrimaryTwitchVideo();
            if (video?.paused && !video.ended) {
                try {
                    const result = video.play();
                    if (result && typeof result.catch === "function") result.catch(() => {});
                } catch {}
            }
        }
        clearWorkspaceResumeTimers();
    }

    function pulseCompositorSurface() {
        const host = document.documentElement || document.body;
        if (!host) return;

        const pulse = document.createElement("div");
        pulse.setAttribute("aria-hidden", "true");
        pulse.style.cssText = [
            "position:fixed",
            "left:0",
            "top:0",
            "width:1px",
            "height:1px",
            "opacity:0.001",
            "pointer-events:none",
            "z-index:2147483646",
            "transform:translate3d(0,0,0)",
            "will-change:transform"
        ].join(";");
        host.appendChild(pulse);
        void pulse.getBoundingClientRect();
        requestAnimationFrame(() => {
            pulse.style.transform = "translate3d(1px,0,0)";
            requestAnimationFrame(() => pulse.remove());
        });
    }

    chrome.runtime.onMessage.addListener(message => {
        if (message?.type !== "stream-shell-twitch-workspace-wake") return;
        pulseCompositorSurface();
    });



    // One narrow shared interface: the later script sees slot/raid state but
    // never takes over the early playback/wake/IPC ownership.
    const coreBridge = Object.freeze({
        isAlive: () => automationDocumentAlive,
        getSlotId: () => workspaceSlotId,
        getRaidProtectionEnabled: () => raidProtectionEnabled,
        registerAutomation(client) {
            if (!automationDocumentAlive || !client || automationClient) return false;
            automationClient = client;
            Promise.resolve().then(() => client.start()).then(() => {
                if (!automationDocumentAlive) return;
                twitchStartupMetrics.phase = "active";
                twitchStartupMetrics.activatedAt = Date.now();
                twitchStartupMetrics.activatedAfterMs = Date.now() - twitchRuntimeMetrics.startedAt;
            }).catch(error => {
                twitchStartupMetrics.phase = "failed";
                twitchStartupMetrics.lastLoadError = String(error?.message || error);
                if (automationDocumentAlive) client.dispose?.();
            });
            return true;
        }
    });

    function scheduleAutomationLoad(delayMs) {
        if (!automationDocumentAlive || automationClient || automationStartTimer !== null) return;
        twitchStartupMetrics.phase = "scheduled";
        automationStartTimer = setTimeout(async () => {
            automationStartTimer = null;
            if (!automationDocumentAlive || automationClient) return;
            automationLoadAttempts += 1;
            twitchStartupMetrics.loadAttempts = automationLoadAttempts;
            twitchStartupMetrics.phase = "loading";
            try {
                const response = await chrome.runtime.sendMessage({type: "twitch-workspace-v2-load-automation"});
                if (!automationDocumentAlive || automationClient) return;
                if (!response?.ok) throw new Error(response?.error || "Automation injection rejected");
                // The injected IIFE must synchronously register the automation;
                // a response without registration is treated as a recoverable miss.
                throw new Error("Automation module did not register");
            } catch (error) {
                if (!automationDocumentAlive || automationClient) return;
                twitchStartupMetrics.lastLoadError = String(error?.message || error);
                if (automationLoadAttempts < 4) scheduleAutomationLoad(600 * automationLoadAttempts);
                else twitchStartupMetrics.phase = "failed";
            }
        }, delayMs);
    }

    async function start() {
        let managed = false;
        for (let attempt = 0; attempt < 12 && !managed; attempt += 1) {
            try {
                const response = await chrome.runtime.sendMessage({ type: "is-stream-shell-twitch-window" });
                managed = response?.managed === true;
            } catch {
                managed = false;
            }

            if (!managed) {
                await new Promise(resolve => setTimeout(resolve, 250 + attempt * 75));
            }
        }
        if (!managed) return;

        document.documentElement.dataset.streamShellTwitch = "true";
        startTwitchRuntimeHeartbeat();
        document.addEventListener("visibilitychange", () => {
            twitchRuntimeMetrics.visibilityChanges += 1;
            twitchRuntimeMetrics.lastVisibilityChangeAt = Date.now();
        });
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message?.type !== "stream-shell-twitch-runtime-diagnostics") return;
            sendResponse({ ok: true, runtime: getTwitchRuntimeDiagnostics() });
        });

        try {
            const workspaceContext = await chrome.runtime.sendMessage({
                type: "get-stream-shell-twitch-workspace-context"
            });
            workspacePlaybackGuardEnabled = workspaceContext?.managed === true;
            workspaceSlotId = workspaceContext?.slotId || null;
            raidProtectionEnabled = workspaceContext?.raidProtectionEnabled === true;
            // Cheap, admission-gated Stream layout is known before the lazy HUD
            // runs. Prevent header/sidebar appearing and disappearing seconds
            // after the first Twitch paint. HUD later refines auto/offline mode.
            if (workspaceContext?.role === "slot" &&
                workspaceContext?.effectiveKind === "stream") {
                document.documentElement.dataset.streamShellTwitchWorkspaceClean = "true";
            }
        } catch {
            workspacePlaybackGuardEnabled = false;
        }

        try {
            const stored = await chrome.storage.local.get(["rightMode"]);
            workspaceRightMode = stored.rightMode || "twitch";
        } catch {}

        if (workspacePlaybackGuardEnabled) {
            const video = getPrimaryTwitchVideo();
            workspaceWantedPlaying = Boolean(video && !video.paused && !video.ended);

            document.addEventListener("play", event => {
                if (event.target?.tagName !== "VIDEO") return;
                const primary = getPrimaryTwitchVideo();
                if (primary && event.target !== primary) return;
                workspaceWantedPlaying = true;
                syncWorkspaceResumeWatchdog();
            }, true);

            document.addEventListener("pause", event => {
                if (event.target?.tagName !== "VIDEO") return;
                const primary = getPrimaryTwitchVideo();
                if (primary && event.target !== primary) return;
                if (workspaceIsCovered()) {
                    syncWorkspaceResumeWatchdog();
                } else {
                    workspaceWantedPlaying = false;
                    clearWorkspaceResumeTimers();
                }
            }, true);

            document.addEventListener("visibilitychange", () => {
                handleWorkspaceVisibilityTransition();
            });
            window.addEventListener("focus", handleWorkspaceVisibilityTransition);
            window.addEventListener("blur", handleWorkspaceVisibilityTransition);
            handleWorkspaceVisibilityTransition();
        }


        // The expensive script is NOT injected during document_start. The
        // background validates tab, frame, managed slot and document identity.
        window.__streamShellTwitchCoreV1 = coreBridge;
        const staggerMs = TWITCH_AUTOMATION_WAKE_MS[workspaceSlotId] ?? 650;
        twitchStartupMetrics.phase = "scheduled";
        twitchStartupMetrics.scheduledDelayMs = staggerMs;
        twitchStartupMetrics.scheduledAt = Date.now();
        if (["a", "b", "c", "d"].includes(workspaceSlotId)) {
            scheduleAutomationLoad(staggerMs);
        } else {
            // Legacy/non-slot pages should not ask for a heavyweight module.
            twitchStartupMetrics.phase = "not-a-slot";
        }

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;
            if (workspaceSlotId && Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchWorkspaceV2")) {
                const workspace = changes.streamShellTwitchWorkspaceV2.newValue;
                const next = workspace?.slots?.[workspaceSlotId]?.raidProtectionEnabled === true;
                if (next !== raidProtectionEnabled) {
                    raidProtectionEnabled = next;
                    if (!next) chrome.runtime.sendMessage({ type: "twitch-disarm-raid-guard" }).catch(() => {});
                    automationClient?.onRaidProtectionChanged?.(next);
                }
                automationClient?.onWorkspaceChanged?.();
            }
            if (workspacePlaybackGuardEnabled && Object.prototype.hasOwnProperty.call(changes, "rightMode")) {
                const oldMode = changes.rightMode.oldValue || workspaceRightMode;
                const nextMode = changes.rightMode.newValue || "dashboard";
                if (oldMode === "twitch" && nextMode !== "twitch") captureVisibleWorkspacePlaybackIntent();
                workspaceRightMode = nextMode;
                handleWorkspaceVisibilityTransition();
            }
        });

        // A single interaction keeps the background's 3s adoption window alive.
        // Pointer-heavy Twitch controls used to send one browser IPC per click/tap.
        // Keep reporting fresh user activity, but no more than once per second.
        let lastInteractionNoticeAt = 0;
        document.addEventListener("pointerdown", event => {
            if (!event.isTrusted) return;
            const now = Date.now();
            if (now - lastInteractionNoticeAt < 1000) return;
            lastInteractionNoticeAt = now;
            chrome.runtime.sendMessage({ type: "twitch-user-interaction" }).catch(() => {});
        }, true);

        document.addEventListener("click", event => {
            if (!event.isTrusted || event.defaultPrevented) return;
            const anchor = event.target?.closest?.('a[href]');
            if (!anchor || String(anchor.target || "").toLowerCase() !== "_blank") return;

            let targetUrl;
            try {
                targetUrl = new URL(anchor.href, location.href);
            } catch {
                return;
            }

            if (!/(^|\.)twitch\.tv$/i.test(targetUrl.hostname)) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            location.assign(targetUrl.href);
        }, true);

        document.addEventListener("click", event => {
            if (!event.isTrusted || !raidProtectionEnabled) return;
            const anchor = event.target?.closest?.('a[href]');
            if (!anchor) return;

            let targetUrl;
            try {
                targetUrl = new URL(anchor.href, location.href);
            } catch {
                return;
            }

            if (!/(^|\.)twitch\.tv$/i.test(targetUrl.hostname)) return;
            const first = targetUrl.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
            if (!first || RESERVED_CHANNEL_PATHS.has(first)) return;

            chrome.runtime.sendMessage({ type: "twitch-disarm-raid-guard" }).catch(() => {});
        }, true);

        window.addEventListener("pagehide", () => {
            automationDocumentAlive = false;
            twitchStartupMetrics.phase = "stopped";
            delete document.documentElement.dataset.streamShellTwitchWorkspaceClean;
            if (automationStartTimer !== null) clearTimeout(automationStartTimer);
            automationStartTimer = null;
            if (twitchHeartbeatTimer) clearInterval(twitchHeartbeatTimer);
            clearWorkspaceResumeTimers();
            automationClient?.dispose?.();
            if (window.__streamShellTwitchCoreV1 === coreBridge) {
                delete window.__streamShellTwitchCoreV1;
            }
        }, { once: true });
    }



    start().catch(() => {});
})();
