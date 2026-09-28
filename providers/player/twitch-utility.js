(() => {
    const DEFAULTS = {
        streamShellTwitchAutoClaimPoints: true,
        streamShellTwitchAutoClaimDrops: true,
        streamShellTwitchPreventRaids: true
    };

    const RESERVED_CHANNEL_PATHS = new Set([
        "directory", "downloads", "drops", "friends", "inventory", "jobs",
        "login", "messages", "p", "payments", "search", "settings", "signup",
        "subscriptions", "turbo", "videos", "wallet"
    ]);

    const AUTOMATION_RELEVANCE_SELECTOR = [
        'button[aria-label="Claim Bonus"]',
        '[data-test-selector="community-points-summary"]',
        '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]',
        '[data-test-selector*="drop" i]',
        '[data-a-target*="drop" i]',
        '[aria-label*="drop" i]',
        '[data-test-selector*="raid" i]',
        '[data-a-target*="raid" i]',
        '[aria-label*="raid" i]',
        '[role="dialog"]'
    ].join(",");

    let settings = { ...DEFAULTS };
    let observer = null;
    let fallbackTimer = null;
    let scanTimer = null;
    let lastStableChannelUrl = null;
    let raidGuardCooldownUntil = 0;
    const recentClicks = new WeakMap();

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
            workspaceResumeInterval = setInterval(tryResumeCoveredWorkspacePlayback, 1250);
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

    function isEnabled(element) {
        return Boolean(
            element &&
            !element.disabled &&
            element.getAttribute("aria-disabled") !== "true"
        );
    }

    function clickOnce(element, cooldownMs = 4000) {
        if (!isEnabled(element)) return false;
        const last = recentClicks.get(element) || 0;
        if (Date.now() - last < cooldownMs) return false;
        recentClicks.set(element, Date.now());
        element.click();
        return true;
    }

    function currentChannelUrl() {
        const parts = location.pathname.split("/").filter(Boolean);
        const first = (parts[0] || "").toLowerCase();
        if (!first || RESERVED_CHANNEL_PATHS.has(first)) return null;
        return `https://www.twitch.tv/${first}`;
    }

    function claimChannelPoints() {
        if (!settings.streamShellTwitchAutoClaimPoints) return;

        const selectors = [
            'button[aria-label="Claim Bonus"]',
            '[data-test-selector="community-points-summary"] button.tw-button.tw-button--success.tw-interactive',
            '[data-test-selector="community-points-summary"] button.tw-button--success'
        ];

        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (clickOnce(button)) return;
        }

        const summary = document.querySelector('[data-test-selector="community-points-summary"]');
        if (!summary) return;

        for (const button of summary.querySelectorAll('button, [role="button"]')) {
            const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`
                .trim().toLowerCase().replace(/\s+/g, " ");
            if (/claim bonus|bonus abholen|bonus beanspruchen/.test(label) && clickOnce(button)) {
                return;
            }
        }
    }

    function claimDrops() {
        if (!settings.streamShellTwitchAutoClaimDrops) return;

        const direct = document.querySelectorAll(
            '[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]'
        );
        for (const button of direct) clickOnce(button);

        const allowed = new Set([
            "claim", "claim now", "click to claim",
            "abholen", "jetzt abholen", "beanspruchen"
        ]);

        const inventoryPage = location.pathname.toLowerCase().startsWith("/drops/inventory");
        const scopedRoots = inventoryPage
            ? [document]
            : Array.from(document.querySelectorAll(
                '[data-test-selector*="drop" i], [data-a-target*="drop" i], [aria-label*="drop" i]'
            ));

        for (const root of scopedRoots) {
            for (const button of root.querySelectorAll?.('button, [role="button"]') || []) {
                const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`
                    .trim().toLowerCase().replace(/\s+/g, " ");
                if (allowed.has(text)) clickOnce(button);
            }
        }
    }

    function raidContainers() {
        return Array.from(document.querySelectorAll(
            '[data-test-selector*="raid" i], [data-a-target*="raid" i], [aria-label*="raid" i], [role="dialog"]'
        ));
    }

    function preventRaid() {
        if (!settings.streamShellTwitchPreventRaids || Date.now() < raidGuardCooldownUntil) return;

        const source = currentChannelUrl();
        if (source) lastStableChannelUrl = source;
        if (!lastStableChannelUrl) return;

        for (const container of raidContainers()) {
            const text = String(container.textContent || "").toLowerCase().replace(/\s+/g, " ").slice(0, 1800);
            if (!/\braid(?:ing)?\b/.test(text)) continue;

            const markerText = `${container.getAttribute("data-test-selector") || ""} ${container.getAttribute("data-a-target") || ""} ${container.getAttribute("aria-label") || ""}`.toLowerCase();
            const raidSpecificMarker = markerText.includes("raid");
            let raidActionFound = false;

            const buttons = container.querySelectorAll('button, [role="button"]');
            for (const button of buttons) {
                const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
                if (/leave raid|cancel raid|raid verlassen|raid abbrechen/.test(label)) {
                    raidActionFound = true;
                    clickOnce(button, 15000);
                    break;
                }
            }

            if (!raidSpecificMarker && !raidActionFound) continue;

            raidGuardCooldownUntil = Date.now() + 12000;
            chrome.runtime.sendMessage({
                type: "twitch-arm-raid-guard",
                sourceUrl: lastStableChannelUrl
            }).catch(() => {});
            break;
        }
    }

    function automationEnabled() {
        return settings.streamShellTwitchAutoClaimPoints ||
            settings.streamShellTwitchAutoClaimDrops ||
            settings.streamShellTwitchPreventRaids;
    }

    function mutationTouchesAutomation(records) {
        for (const mutation of records || []) {
            const target = mutation.target instanceof Element
                ? mutation.target
                : mutation.target?.parentElement;

            if (target?.closest?.(AUTOMATION_RELEVANCE_SELECTOR)) {
                return true;
            }

            for (const node of mutation.addedNodes || []) {
                if (!(node instanceof Element)) continue;
                if (
                    node.matches(AUTOMATION_RELEVANCE_SELECTOR) ||
                    node.querySelector(AUTOMATION_RELEVANCE_SELECTOR)
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    function scheduleScan() {
        if (scanTimer !== null || !automationEnabled()) return;
        scanTimer = setTimeout(() => {
            scanTimer = null;
            scan();
        }, 120);
    }

    function scan() {
        if (!automationEnabled()) return;
        const stable = currentChannelUrl();
        if (stable && Date.now() >= raidGuardCooldownUntil) {
            lastStableChannelUrl = stable;
        }
        claimChannelPoints();
        claimDrops();
        preventRaid();
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

        try {
            const workspaceContext = await chrome.runtime.sendMessage({
                type: "get-stream-shell-twitch-workspace-context"
            });
            workspacePlaybackGuardEnabled = workspaceContext?.managed === true;
        } catch {
            workspacePlaybackGuardEnabled = false;
        }

        try {
            const stored = await chrome.storage.local.get([
                ...Object.keys(DEFAULTS),
                "rightMode"
            ]);
            settings = { ...DEFAULTS, ...stored };
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

        observer = new MutationObserver(records => {
            if (mutationTouchesAutomation(records)) {
                scheduleScan();
            }
        });

        const syncObserver = () => {
            observer.disconnect();
            if (!automationEnabled() || !document.documentElement) {
                return false;
            }

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            return true;
        };

        const attach = () => {
            if (!document.documentElement) return false;
            syncObserver();
            scan();
            return true;
        };

        if (!attach()) {
            document.addEventListener("DOMContentLoaded", attach, { once: true });
        }

        const syncFallbackTimer = () => {
            if (fallbackTimer) {
                clearInterval(fallbackTimer);
                fallbackTimer = null;
            }

            if (automationEnabled()) {
                fallbackTimer = setInterval(scan, 5000);
            }
        };

        syncFallbackTimer();

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;
            for (const key of Object.keys(DEFAULTS)) {
                if (Object.prototype.hasOwnProperty.call(changes, key)) {
                    settings[key] = changes[key].newValue ?? DEFAULTS[key];
                }
            }

            if (workspacePlaybackGuardEnabled && Object.prototype.hasOwnProperty.call(changes, "rightMode")) {
                const oldMode = changes.rightMode.oldValue || workspaceRightMode;
                const nextMode = changes.rightMode.newValue || "dashboard";
                if (oldMode === "twitch" && nextMode !== "twitch") {
                    captureVisibleWorkspacePlaybackIntent();
                }
                workspaceRightMode = nextMode;
                handleWorkspaceVisibilityTransition();
            }

            syncObserver();
            syncFallbackTimer();
            scan();
        });

        document.addEventListener("pointerdown", event => {
            if (!event.isTrusted) return;
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
            if (!event.isTrusted || !settings.streamShellTwitchPreventRaids) return;
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
            if (fallbackTimer) clearInterval(fallbackTimer);
            if (scanTimer !== null) clearTimeout(scanTimer);
            clearWorkspaceResumeTimers();
            observer?.disconnect();
        }, { once: true });
    }

    start().catch(() => {});
})();
