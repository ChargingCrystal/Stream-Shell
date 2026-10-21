/* Stream Shell v0.20.33: lazy Twitch DOM automation (Marbles, points,
 * Drops, raid UI). Injected once by background after verified slot admission.
 * Chat-history freshness safeguards from v0.20.32 remain unchanged. */
(() => {
    const core = window.__streamShellTwitchCoreV1;
    if (!core?.isAlive?.() || window.__streamShellTwitchAutomationLoaded === true) return;
    window.__streamShellTwitchAutomationLoaded = true;
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
        burstWindowMs: 30000, cooldownMs: 120000,
        minTriggerCount: 5, maxTriggerCount: 10,
        minDelayMs: 1000, maxDelayMs: 4000,
        initialHydrationGuardMs: 12000,
        historyBurstGuardMs: 8000, historyBurstWindowMs: 45000,
        historyBatchThreshold: 4, maxFreshMessageAgeMs: 30000,
        fallbackScanMs: 30000
    });
    let settings = { ...DEFAULTS };
    let observer = null;
    let fallbackTimer = null;
    let scanTimer = null;
    let lastStableChannelUrl = null;
    let raidGuardCooldownUntil = 0;
    let raidProtectionEnabled = core.getRaidProtectionEnabled();
    const recentClicks = new WeakMap();
    const workspaceSlotId = core.getSlotId();
    let marblesLastAutoPlayAt = 0;
    let marblesPendingTimer = null;
    let marblesTriggerCount = 0;
    let marblesObservedChannel = null;
    let marblesHydrationGuardUntil = Date.now() + MARBLES_CONFIG.initialHydrationGuardMs;
    let marblesUnknownUserCounter = 0;
    let marblesChatEpochStartedAt = Date.now();
    let marblesLastHistoryBurstAt = null;
    const marblesPlayEvents = [];
    const processedMarblesLines = new WeakSet();
    const twitchRuntimeMetrics = {
        lastChatMutationAt: null, lastChannelChangeAt: null,
        lastPlayObservedAt: null, observedPlayCount: 0,
        historyBatchesDiscarded: 0, historicalLinesDiscarded: 0,
        hydrationLinesDiscarded: 0, timestampedLinesChecked: 0,
        lastFreshChatPlayAt: null, lastJoinScheduledAt: null,
        joinScheduledDelayMs: null, lastJoinAttemptAt: null,
        lastJoinTimerDriftMs: null, lastJoinResult: null,
        lastJoinSuccessAt: null, joinAttempts: 0, joinSuccesses: 0,
        lastAutomationScanAt: null
    };
    let automationStarted = false;
    let automationDocumentAlive = true;

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
        twitchRuntimeMetrics.lastChannelChangeAt = Date.now();
        marblesChatEpochStartedAt = Date.now();
        marblesLastHistoryBurstAt = null;
        marblesHydrationGuardUntil = marblesChatEpochStartedAt + MARBLES_CONFIG.initialHydrationGuardMs;
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

    /* Determine whether a Twitch-provided timestamp identifies older chat
     * history. Never derive message time from the DOM insertion time: Twitch
     * can append previously loaded messages well after startup. */
    function marblesChatMessageAgeMs(line, now) {
        const timestamp = line.querySelector(
            'time[datetime], [data-a-target="chat-timestamp"], [data-test-selector="chat-timestamp"], .chat-line__timestamp'
        );
        if (!timestamp) return null;

        const exact = String(timestamp.getAttribute?.("datetime") ||
            timestamp.getAttribute?.("data-timestamp") || "").trim();
        if (exact) {
            let parsed = /^\d{10,13}$/.test(exact)
                ? Number(exact) * (exact.length === 10 ? 1000 : 1)
                : Date.parse(exact);
            if (Number.isFinite(parsed)) return now - parsed;
        }

        // Twitch can display only HH:mm. That represents a full minute;
        // use the minimum possible age (end of that minute), conservatively.
        const text = String(timestamp.textContent || "").trim();
        const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
        if (!match) return null;
        let hour = Number(match[1]);
        const minute = Number(match[2]);
        if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return null;
        if (match[3]) hour = (hour % 12) + (/pm/i.test(match[3]) ? 12 : 0);
        const base = new Date(now);
        base.setHours(hour, minute, 0, 0);
        let stamp = base.getTime();
        if (stamp - now > 60000) stamp -= 86400000;
        return Math.max(0, now - stamp - 59999);
    }

    /* Ignore lines replayed ahead of already mounted chat messages. Twitch
     * appends live messages at the tail; history hydration often prepends. */
    function marblesLineHasFollowingChat(line) {
        let next = line.nextElementSibling || line.parentElement?.nextElementSibling;
        let steps = 0;
        while (next && steps++ < 4) {
            if (next.matches?.(MARBLES_CHAT_LINE_SELECTOR) ||
                next.querySelector?.(MARBLES_CHAT_LINE_SELECTOR)) return true;
            next = next.nextElementSibling;
        }
        return false;
    }

    function discardMarblesHistoryBurst(count, at = Date.now()) {
        // Re-arm only during startup/channel navigation; otherwise normal
        // fast-moving chat could keep the automation disabled indefinitely.
        if (at - marblesChatEpochStartedAt > MARBLES_CONFIG.historyBurstWindowMs) return;
        marblesLastHistoryBurstAt = at;
        marblesHydrationGuardUntil = Math.max(
            marblesHydrationGuardUntil,
            at + MARBLES_CONFIG.historyBurstGuardMs
        );
        twitchRuntimeMetrics.historyBatchesDiscarded += 1;
        twitchRuntimeMetrics.historicalLinesDiscarded += count;
        cancelPendingMarblesJoin();
        resetMarblesBurst({ reroll: false });
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
        twitchRuntimeMetrics.lastJoinScheduledAt = now;
        twitchRuntimeMetrics.joinScheduledDelayMs = delay;
        marblesPendingTimer = setTimeout(async () => {
            marblesPendingTimer = null;
            const firedAt = Date.now();
            twitchRuntimeMetrics.lastJoinTimerDriftMs = Math.max(0, firedAt - now - delay);
            if (!settings.streamShellTwitchMarblesAutoJoin) {
                twitchRuntimeMetrics.lastJoinResult = "cancelled-disabled";
                return;
            }
            if (Date.now() - marblesLastAutoPlayAt < MARBLES_CONFIG.cooldownMs) {
                twitchRuntimeMetrics.lastJoinResult = "cancelled-cooldown";
                return;
            }

            twitchRuntimeMetrics.lastJoinAttemptAt = Date.now();
            twitchRuntimeMetrics.joinAttempts += 1;
            const sent = await sendMarblesPlayCommand().catch(() => false);
            twitchRuntimeMetrics.lastJoinResult = sent ? "submitted" : "not-submitted";
            if (!sent) {
                resetMarblesBurst({ reroll: false });
                return;
            }

            marblesLastAutoPlayAt = Date.now();
            twitchRuntimeMetrics.lastJoinSuccessAt = marblesLastAutoPlayAt;
            twitchRuntimeMetrics.joinSuccesses += 1;
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

        if (Date.now() < marblesHydrationGuardUntil) {
            twitchRuntimeMetrics.hydrationLinesDiscarded += 1;
            return;
        }

        const text = marblesChatMessageText(line);
        if (!isMarblesPlayCommand(text)) return;

        const now = Date.now();
        const ageMs = marblesChatMessageAgeMs(line, now);
        if (ageMs !== null) {
            twitchRuntimeMetrics.timestampedLinesChecked += 1;
            if (ageMs < -5000 || ageMs > MARBLES_CONFIG.maxFreshMessageAgeMs) {
                twitchRuntimeMetrics.historicalLinesDiscarded += 1;
                return;
            }
        }
        if (marblesLineHasFollowingChat(line)) {
            twitchRuntimeMetrics.historicalLinesDiscarded += 1;
            return;
        }
        twitchRuntimeMetrics.lastFreshChatPlayAt = now;
        twitchRuntimeMetrics.lastPlayObservedAt = now;
        twitchRuntimeMetrics.observedPlayCount += 1;
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
        if (records?.length) twitchRuntimeMetrics.lastChatMutationAt = Date.now();
        const inspected = new Set();
        const lines = [];
        for (const mutation of records || []) {
            for (const node of mutation.addedNodes || []) {
                if (!(node instanceof Element) || inspected.has(node)) continue;
                inspected.add(node);
                for (const line of collectMarblesChatLines(node)) {
                    if (!processedMarblesLines.has(line) && !lines.includes(line)) lines.push(line);
                }
            }
        }
        // Historical chat is commonly hydrated in multi-line DOM batches.
        // Never count a batch as an organic burst of unique !play users.
        if (lines.length >= MARBLES_CONFIG.historyBatchThreshold) {
            for (const line of lines) processedMarblesLines.add(line);
            discardMarblesHistoryBurst(lines.length);
            return;
        }
        for (const line of lines) recordMarblesPlay(line);
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

            // UI-only raid cancellation: NEVER arm a URL rollback. A Twitch
            // channel switch can be deliberate even while a stale raid surface
            // is still shown by Twitch's SPA/hydration.
            raidGuardCooldownUntil = Date.now() + 12000;
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
        if (!automationStarted || scanTimer !== null || !automationEnabled()) return;
        scanTimer = setTimeout(() => {
            scanTimer = null;
            scan();
        }, 120);
    }

    function scan() {
        if (!automationStarted || !automationEnabled()) return;
        twitchRuntimeMetrics.lastAutomationScanAt = Date.now();
        const stable = currentChannelUrl();
        if (stable && Date.now() >= raidGuardCooldownUntil) {
            lastStableChannelUrl = stable;
        }
        claimChannelPoints();
        claimDrops();
        preventRaid();
    }


    function getDiagnostics() {
        return {
            marblesAutoJoinEnabled: settings.streamShellTwitchMarblesAutoJoin === true,
            pendingJoin: marblesPendingTimer !== null,
            uniquePlayUsersInBurst: new Set(marblesPlayEvents.map(event => event.userKey)).size,
            triggerCount: marblesTriggerCount, observedChannel: marblesObservedChannel,
            lastSuccessfulJoinAt: marblesLastAutoPlayAt,
            hydrationGuardUntil: marblesHydrationGuardUntil,
            chatEpochStartedAt: marblesChatEpochStartedAt,
            lastHistoryBurstAt: marblesLastHistoryBurstAt,
            ...twitchRuntimeMetrics
        };
    }

    function syncObserver() {
        observer?.disconnect();
        if (!automationStarted || !automationEnabled() || !document.documentElement) return false;
        observer.observe(document.documentElement, {childList: true, subtree: true});
        return true;
    }
    function syncFallbackTimer() {
        if (fallbackTimer) clearInterval(fallbackTimer);
        fallbackTimer = automationStarted && automationEnabled()
            ? setInterval(scan, MARBLES_CONFIG.fallbackScanMs) : null;
    }

    async function start() {
        if (!automationDocumentAlive || !core.isAlive() || automationStarted) return;
        const stored = await chrome.storage.local.get([
            ...Object.keys(DEFAULTS), marblesCooldownStorageKey()
        ]).catch(() => ({}));
        if (!automationDocumentAlive || !core.isAlive()) return;
        settings = {...DEFAULTS, ...stored};
        marblesLastAutoPlayAt = Number(stored[marblesCooldownStorageKey()] || 0);
        resetMarblesBurst();
        marblesObservedChannel = currentChannelUrl();
        marblesChatEpochStartedAt = Date.now();
        marblesLastHistoryBurstAt = null;
        marblesHydrationGuardUntil = marblesChatEpochStartedAt + MARBLES_CONFIG.initialHydrationGuardMs;
        raidProtectionEnabled = core.getRaidProtectionEnabled();
        automationStarted = true;
        observer = new MutationObserver(records => {
            observeMarblesChat(records);
            if (mutationTouchesAutomation(records)) scheduleScan();
        });
        syncObserver();
        scan();
        syncFallbackTimer();
        chrome.storage.onChanged.addListener(onSettingsChanged);
    }
    function onSettingsChanged(changes, areaName) {
        if (!automationDocumentAlive || areaName !== "local") return;
        let relevant = false;
        for (const key of Object.keys(DEFAULTS)) {
            if (Object.prototype.hasOwnProperty.call(changes, key)) {
                settings[key] = changes[key].newValue ?? DEFAULTS[key];
                relevant = true;
            }
        }
        if (Object.prototype.hasOwnProperty.call(changes, marblesCooldownStorageKey())) {
            marblesLastAutoPlayAt = Number(changes[marblesCooldownStorageKey()].newValue || 0);
        }
        if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchMarblesAutoJoin") &&
            !settings.streamShellTwitchMarblesAutoJoin) {
            cancelPendingMarblesJoin();
            resetMarblesBurst();
        }
        if (relevant) {
            syncObserver(); syncFallbackTimer(); scheduleScan();
        }
    }
    function onWorkspaceChanged() {
        const channel = currentChannelUrl();
        if (channel !== marblesObservedChannel) armMarblesHydrationGuard(channel);
    }
    function onRaidProtectionChanged(enabled) {
        if (raidProtectionEnabled === enabled) return;
        raidProtectionEnabled = enabled;
        syncObserver(); syncFallbackTimer(); scheduleScan();
    }
    function dispose() {
        automationDocumentAlive = false;
        automationStarted = false;
        if (fallbackTimer) clearInterval(fallbackTimer);
        if (scanTimer !== null) clearTimeout(scanTimer);
        cancelPendingMarblesJoin();
        observer?.disconnect();
        chrome.storage.onChanged.removeListener?.(onSettingsChanged);
    }

    if (!core.registerAutomation({start, dispose, getDiagnostics, onWorkspaceChanged, onRaidProtectionChanged})) {
        delete window.__streamShellTwitchAutomationLoaded;
    }
})();
