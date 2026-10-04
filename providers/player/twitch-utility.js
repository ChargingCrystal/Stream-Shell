(() => {
    const DEFAULTS = {
        streamShellTwitchAutoClaimPoints: true,
        streamShellTwitchAutoClaimDrops: true,
        streamShellTwitchMarblesAutoJoin: true
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

    const MARBLES_CHAT_LINE_SELECTOR = [
        '[data-a-target="chat-line-message"]',
        '[data-test-selector="chat-line-message"]',
        '.chat-line__message'
    ].join(",");

    const MARBLES_CONFIG = Object.freeze({
        burstWindowMs: 30000,
        cooldownMs: 120000,
        minTriggerCount: 5,
        maxTriggerCount: 10,
        minDelayMs: 1000,
        maxDelayMs: 4000,
        initialHydrationGuardMs: 5000,
        fallbackScanMs: 30000,
        coveredPlaybackWatchdogMs: 15000
    });

    let settings = { ...DEFAULTS };
    let observer = null;
    let fallbackTimer = null;
    let scanTimer = null;
    let lastStableChannelUrl = null;
    let raidGuardCooldownUntil = 0;
    let raidProtectionEnabled = false;
    const recentClicks = new WeakMap();

    let workspaceSlotId = null;
    let marblesLastAutoPlayAt = 0;
    let marblesPendingTimer = null;
    let marblesTriggerCount = 0;
    let marblesObservedChannel = null;
    let marblesHydrationGuardUntil = Date.now() + MARBLES_CONFIG.initialHydrationGuardMs;
    let marblesUnknownUserCounter = 0;
    const marblesPlayEvents = [];
    const processedMarblesLines = new WeakSet();

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
                MARBLES_CONFIG.coveredPlaybackWatchdogMs
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

    function randomIntInclusive(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function resetMarblesBurst({ reroll = true } = {}) {
        marblesPlayEvents.length = 0;
        if (reroll || !marblesTriggerCount) {
            marblesTriggerCount = randomIntInclusive(
                MARBLES_CONFIG.minTriggerCount,
                MARBLES_CONFIG.maxTriggerCount
            );
        }
    }

    function cancelPendingMarblesJoin() {
        if (marblesPendingTimer !== null) {
            clearTimeout(marblesPendingTimer);
            marblesPendingTimer = null;
        }
    }

    function armMarblesHydrationGuard(channel = currentChannelUrl()) {
        marblesObservedChannel = channel || null;
        marblesHydrationGuardUntil = Date.now() + MARBLES_CONFIG.initialHydrationGuardMs;
        cancelPendingMarblesJoin();
        resetMarblesBurst();
    }

    function marblesCooldownStorageKey() {
        return `streamShellTwitchMarblesLastPlayAt_${workspaceSlotId || "legacy"}`;
    }

    function marblesChatMessageText(line) {
        const fragments = Array.from(line.querySelectorAll(
            '[data-a-target="chat-message-text"], [data-test-selector="chat-message-text"], .text-fragment'
        ));
        const text = fragments.length
            ? fragments.map(node => node.textContent || "").join(" ")
            : (line.textContent || "");
        return text.trim().replace(/\s+/g, " ");
    }

    function marblesChatUserKey(line) {
        const username = line.querySelector(
            '[data-a-target="chat-message-username"], [data-test-selector="chat-message-username"], .chat-author__display-name'
        );
        const value = String(username?.textContent || username?.getAttribute?.("data-a-user") || "")
            .trim().toLowerCase();
        if (value) return value;
        marblesUnknownUserCounter += 1;
        return `unknown-${marblesUnknownUserCounter}`;
    }

    function isMarblesPlayCommand(text) {
        return /(?:^|\s)!play(?:\s|$)/i.test(String(text || ""));
    }

    function collectMarblesChatLines(node) {
        if (!(node instanceof Element)) return [];
        const lines = [];
        if (node.matches(MARBLES_CHAT_LINE_SELECTOR)) lines.push(node);
        for (const match of node.querySelectorAll(MARBLES_CHAT_LINE_SELECTOR)) lines.push(match);
        return lines;
    }

    function findTwitchChatEditor() {
        const root = document.querySelector('[data-a-target="chat-input"]');
        const candidates = [
            root?.matches?.('textarea, input, [contenteditable="true"]') ? root : null,
            root?.querySelector?.('[contenteditable="true"][role="textbox"]'),
            root?.querySelector?.('[contenteditable="true"]'),
            root?.querySelector?.('textarea, input'),
            document.querySelector('[data-a-target="chat-input"] [contenteditable="true"]'),
            document.querySelector('.chat-wysiwyg-input__editor [contenteditable="true"]'),
            document.querySelector('[role="textbox"][contenteditable="true"]'),
            document.querySelector('textarea[data-a-target="chat-input"]')
        ];

        return candidates.find(element =>
            element instanceof HTMLElement &&
            element.isConnected &&
            !element.hasAttribute("disabled") &&
            element.getAttribute("aria-disabled") !== "true"
        ) || null;
    }

    function selectEditableContents(element) {
        const selection = window.getSelection();
        if (!selection) return false;
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }

    function editableText(element) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            return String(element.value || "");
        }
        return String(element.innerText || element.textContent || "");
    }

    function normalizedChatText(element) {
        return editableText(element)
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    async function waitForChatText(element, predicate, timeoutMs = 500) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            if (!element?.isConnected) return false;
            if (predicate(normalizedChatText(element))) return true;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        return Boolean(element?.isConnected && predicate(normalizedChatText(element)));
    }

    async function setTwitchChatText(element, value) {
        const wanted = String(value || "").trim();
        if (!wanted) return false;

        const before = normalizedChatText(element);

        /* Reuse a previous unsent !play instead of appending another copy. */
        if (before === wanted) return true;

        /* Do not overwrite something the user is typing. The only stale text
         * we replace is residue made entirely from our own !play attempts. */
        if (before && !/^(?:!play\s*)+$/i.test(before)) return false;

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            const proto = element instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(element, wanted);
            else element.value = wanted;
            element.dispatchEvent(new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: wanted
            }));
            return waitForChatText(element, text => text === wanted, 500);
        }

        if (!element?.isContentEditable) return false;

        /* Keep the exact 0.19.14 Slate/paste path that actually inserts into
         * Twitch. Do it once and wait for Twitch to acknowledge it. No second
         * insertText fallback -> no delayed !play!play race. */
        element.focus();
        selectEditableContents(element);

        try {
            const transfer = new DataTransfer();
            transfer.setData("text/plain", wanted);
            element.dispatchEvent(new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: transfer
            }));
        } catch {
            return false;
        }

        return waitForChatText(element, text => text === wanted, 500);
    }

    async function waitForTwitchSendButton(timeoutMs = 1500) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const button = document.querySelector(
                'button[data-a-target="chat-send-button"], button[data-test-selector="chat-send-button"]'
            );
            if (isEnabled(button)) return button;
            await new Promise(resolve => setTimeout(resolve, 40));
        }
        return null;
    }

    async function submitTwitchChat(input) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const liveInput = findTwitchChatEditor();
            if (!liveInput || normalizedChatText(liveInput) !== "!play") return false;

            const button = await waitForTwitchSendButton(attempt === 0 ? 1500 : 500);
            if (button?.isConnected && isEnabled(button)) {
                try { button.click(); } catch {}
                if (await waitForChatText(liveInput, text => text === "", 500)) return true;
            }

            /* If Twitch replaced the button during a React render, submit the
             * SAME already-populated draft through the live form. We never
             * insert !play again here. */
            const refreshedInput = findTwitchChatEditor();
            if (!refreshedInput || normalizedChatText(refreshedInput) !== "!play") return false;

            const liveButton = document.querySelector(
                'button[data-a-target="chat-send-button"], button[data-test-selector="chat-send-button"]'
            );
            const form = liveButton?.closest?.("form") || refreshedInput.closest?.("form");
            if (form?.requestSubmit) {
                try {
                    if (liveButton?.isConnected && isEnabled(liveButton)) form.requestSubmit(liveButton);
                    else form.requestSubmit();
                } catch {}
                if (await waitForChatText(refreshedInput, text => text === "", 500)) return true;
            }

            await new Promise(resolve => setTimeout(resolve, 80));
        }

        return false;
    }

    async function sendMarblesPlayCommand() {
        const channel = currentChannelUrl();
        if (!channel) return false;

        const input = findTwitchChatEditor();
        if (!input) return false;

        if (!await setTwitchChatText(input, "!play")) return false;

        /* Only report success after Twitch actually consumed the chat draft.
         * If submission misses, the existing !play is left in place so the
         * next retry submits it rather than appending another one. */
        return submitTwitchChat(input);
    }

    function scheduleMarblesAutoJoin() {
        if (!settings.streamShellTwitchMarblesAutoJoin || marblesPendingTimer !== null) return;
        const now = Date.now();
        if (now - marblesLastAutoPlayAt < MARBLES_CONFIG.cooldownMs) return;

        const delay = randomIntInclusive(MARBLES_CONFIG.minDelayMs, MARBLES_CONFIG.maxDelayMs);
        marblesPendingTimer = setTimeout(async () => {
            marblesPendingTimer = null;
            if (!settings.streamShellTwitchMarblesAutoJoin) return;
            if (Date.now() - marblesLastAutoPlayAt < MARBLES_CONFIG.cooldownMs) return;

            const sent = await sendMarblesPlayCommand().catch(() => false);
            if (!sent) {
                resetMarblesBurst({ reroll: false });
                return;
            }

            marblesLastAutoPlayAt = Date.now();
            chrome.storage.local.set({
                [marblesCooldownStorageKey()]: marblesLastAutoPlayAt
            }).catch(() => {});
            resetMarblesBurst();
        }, delay);
    }

    function recordMarblesPlay(line) {
        if (!settings.streamShellTwitchMarblesAutoJoin) return;
        if (processedMarblesLines.has(line)) return;
        processedMarblesLines.add(line);

        const channel = currentChannelUrl();
        if (!channel) return;

        /* Twitch can hydrate old chat lines after a channel/stream navigation.
         * Treat every channel transition like a fresh content-script start:
         * arm a new 5 s grace period and discard the first arriving line. This
         * prevents an old !play burst from joining a round already in progress. */
        if (channel !== marblesObservedChannel) {
            armMarblesHydrationGuard(channel);
            return;
        }

        if (Date.now() < marblesHydrationGuardUntil) return;

        const text = marblesChatMessageText(line);
        if (!isMarblesPlayCommand(text)) return;

        const now = Date.now();
        const cutoff = now - MARBLES_CONFIG.burstWindowMs;
        while (marblesPlayEvents.length && marblesPlayEvents[0].time < cutoff) {
            marblesPlayEvents.shift();
        }

        const userKey = marblesChatUserKey(line);
        marblesPlayEvents.push({ time: now, userKey });
        const uniqueUsers = new Set(marblesPlayEvents.map(event => event.userKey));
        if (uniqueUsers.size >= marblesTriggerCount) scheduleMarblesAutoJoin();
    }

    function observeMarblesChat(records) {
        if (!settings.streamShellTwitchMarblesAutoJoin) return;
        for (const mutation of records || []) {
            for (const node of mutation.addedNodes || []) {
                for (const line of collectMarblesChatLines(node)) recordMarblesPlay(line);
            }
        }
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

    function isVisiblyRendered(element) {
        if (!(element instanceof Element)) return false;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        return element.getClientRects().length > 0;
    }

    function preventRaid() {
        if (!raidProtectionEnabled || Date.now() < raidGuardCooldownUntil) return;

        const source = currentChannelUrl();
        if (source) lastStableChannelUrl = source;
        if (!lastStableChannelUrl) return;

        for (const container of raidContainers()) {
            /* Twitch keeps stale raid-labelled nodes around. Only a currently
             * rendered raid surface is allowed to arm this slot's redirect
             * guard; this restores anti-raid without reviving the 0.19.17
             * "old stream snaps back forever" failure mode. */
            if (!isVisiblyRendered(container)) continue;

            const text = String(container.textContent || "").toLowerCase().replace(/\s+/g, " ").slice(0, 1800);
            if (!/\braid(?:ing)?\b/.test(text)) continue;

            const buttons = container.querySelectorAll('button, [role="button"]');
            for (const button of buttons) {
                const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
                if (/leave raid|cancel raid|raid verlassen|raid abbrechen/.test(label)) {
                    clickOnce(button, 15000);
                    break;
                }
            }

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
            raidProtectionEnabled ||
            settings.streamShellTwitchMarblesAutoJoin;
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
            workspaceSlotId = workspaceContext?.slotId || null;
            raidProtectionEnabled = workspaceContext?.raidProtectionEnabled === true;
        } catch {
            workspacePlaybackGuardEnabled = false;
        }

        try {
            const stored = await chrome.storage.local.get([
                ...Object.keys(DEFAULTS),
                "rightMode",
                marblesCooldownStorageKey()
            ]);
            settings = { ...DEFAULTS, ...stored };
            workspaceRightMode = stored.rightMode || "twitch";
            marblesLastAutoPlayAt = Number(stored[marblesCooldownStorageKey()] || 0);
            resetMarblesBurst();
            marblesObservedChannel = currentChannelUrl();
            marblesHydrationGuardUntil = Date.now() + MARBLES_CONFIG.initialHydrationGuardMs;
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
            observeMarblesChat(records);
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
                fallbackTimer = setInterval(scan, MARBLES_CONFIG.fallbackScanMs);
            }
        };

        syncFallbackTimer();

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== "local") return;

            let automationSettingsChanged = false;
            for (const key of Object.keys(DEFAULTS)) {
                if (Object.prototype.hasOwnProperty.call(changes, key)) {
                    settings[key] = changes[key].newValue ?? DEFAULTS[key];
                    automationSettingsChanged = true;
                }
            }

            const marblesCooldownKey = marblesCooldownStorageKey();
            if (Object.prototype.hasOwnProperty.call(changes, marblesCooldownKey)) {
                marblesLastAutoPlayAt = Number(changes[marblesCooldownKey].newValue || 0);
            }

            /* Workspace navigation is persisted by the background. Use that
             * event to arm the Marbles hydration guard immediately on a channel
             * transition; recordMarblesPlay still has its own fallback check in
             * case Twitch emits chat before the storage event arrives. */
            if (workspaceSlotId &&
                Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchWorkspaceV2")) {
                const channel = currentChannelUrl();
                if (channel !== marblesObservedChannel) {
                    armMarblesHydrationGuard(channel);
                }

                const workspace = changes.streamShellTwitchWorkspaceV2.newValue;
                const nextRaidProtectionEnabled = workspace?.slots?.[workspaceSlotId]?.raidProtectionEnabled === true;
                if (nextRaidProtectionEnabled !== raidProtectionEnabled) {
                    raidProtectionEnabled = nextRaidProtectionEnabled;
                    automationSettingsChanged = true;
                    if (!raidProtectionEnabled) {
                        chrome.runtime.sendMessage({ type: "twitch-disarm-raid-guard" }).catch(() => {});
                    }
                }
            }
            if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchMarblesAutoJoin") &&
                !settings.streamShellTwitchMarblesAutoJoin) {
                cancelPendingMarblesJoin();
                resetMarblesBurst();
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

            /* Workspace/HUD/cooldown writes happen frequently enough that
             * rebuilding the observer, restarting the fallback interval and
             * rescanning the Twitch DOM for every unrelated storage change is
             * pure churn. Only automation-setting changes need that work. */
            if (automationSettingsChanged) {
                syncObserver();
                syncFallbackTimer();
                scheduleScan();
            }
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
            if (fallbackTimer) clearInterval(fallbackTimer);
            if (scanTimer !== null) clearTimeout(scanTimer);
            clearWorkspaceResumeTimers();
            cancelPendingMarblesJoin();
            observer?.disconnect();
        }, { once: true });
    }

    start().catch(() => {});
})();
