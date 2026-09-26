/*
 * ============================================================
 * TWITCH AUXILIARY WINDOW
 * ============================================================
 *
 * Twitch is intentionally not a core provider. It is a Wide-only utility
 * surface used for normal Twitch viewing and Drops. The visible Twitch popup is
 * strictly single-tab and is the only live Twitch browser window Stream Shell
 * intentionally keeps. Drops automation runs in that managed document whenever
 * Twitch exposes claim UI; no companion Inventory browser window is created.
 */

function isTwitchUrl(url) {
    try {
        const parsed = new URL(String(url || ""));
        return parsed.protocol === "https:" && /(^|\.)twitch\.tv$/i.test(parsed.hostname);
    } catch {
        return false;
    }
}

function isTwitchDropsUrl(url) {
    if (!isTwitchUrl(url)) return false;
    try {
        const parsed = new URL(url);
        return parsed.pathname.toLowerCase().startsWith("/drops/inventory");
    } catch {
        return false;
    }
}


const twitchSpawnCandidates = new Map();
let twitchRecentUserInteractionUntil = 0;

function isExtensionMutedTab(tab) {
    return Boolean(
        tab?.mutedInfo?.muted === true &&
        tab.mutedInfo.reason === "extension" &&
        (
            !tab.mutedInfo.extensionId ||
            tab.mutedInfo.extensionId === chrome.runtime.id
        )
    );
}

async function syncTwitchAutoMuteForTab(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    const tabUrl = tab.url || tab.pendingUrl;
    if (!isTwitchUrl(tabUrl)) return false;

    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId) || tab.windowId !== windowId) return false;

    if (tab.autoDiscardable !== false) {
        await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    }

    if (isTwitchDropsUrl(tabUrl)) return false;

    const enabled = await getTwitchSetting("streamShellTwitchAutoMute", true);
    const currentlyMuted = tab.mutedInfo?.muted === true;

    if (enabled) {
        if (!currentlyMuted) {
            await chrome.tabs.update(tab.id, { muted: true }).catch(() => {});
        }
        return true;
    }

    if (isExtensionMutedTab(tab)) {
        await chrome.tabs.update(tab.id, { muted: false }).catch(() => {});
    }

    return false;
}

async function syncTwitchAutoMuteForWindow(windowId = null) {
    const managedWindowId = Number.isInteger(windowId)
        ? windowId
        : await getTwitchWindowId();

    if (!Number.isInteger(managedWindowId)) return;

    const tabs = await getTwitchWindowTabs(managedWindowId);
    await Promise.all(tabs.map(tab => syncTwitchAutoMuteForTab(tab)));
}

async function reconcileTwitchAudioPolicy(windowId = null) {
    await syncTwitchAutoMuteForWindow(windowId);

    if (!(await getTwitchSetting("streamShellTwitchAutoMute", true))) return;

    const session = await getVolumeCaptureSession().catch(() => null);
    if (session?.provider === "twitch") {
        await stopVolumeCapture().catch(() => {});
    }
}

async function markTwitchUserInteraction(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    twitchRecentUserInteractionUntil = Date.now() + 3000;
    return true;
}

async function closeSpawnedTwitchTarget(tabId, windowId = null) {
    let targetWindowId = Number.isInteger(windowId) ? windowId : null;
    if (!targetWindowId) {
        try {
            targetWindowId = (await chrome.tabs.get(tabId)).windowId;
        } catch {}
    }

    await chrome.tabs.remove(tabId).catch(() => {});

    if (!Number.isInteger(targetWindowId)) return;
    const managedWindowId = await getTwitchWindowId();
    if (targetWindowId === managedWindowId) return;

    try {
        const remaining = await chrome.tabs.query({ windowId: targetWindowId });
        const disposable = remaining.length === 0 || remaining.every(tab => {
            const url = String(tab.url || tab.pendingUrl || "");
            return !url || url === "about:blank" || url.startsWith("chrome://newtab");
        });
        if (disposable) {
            await chrome.windows.remove(targetWindowId).catch(() => {});
        }
    } catch {}
}

async function redirectSpawnedTwitchTarget(tabId, url, sourceTabId, targetWindowId = null) {
    if (!Number.isInteger(tabId) || !Number.isInteger(sourceTabId) || !isTwitchUrl(url)) return false;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(sourceTabId);
    } catch {
        return false;
    }

    const managedWindowId = await getTwitchWindowId();

    if (sourceTab.windowId === managedWindowId) {
        await chrome.tabs.update(sourceTabId, { url, active: true }).catch(() => {});
        await closeSpawnedTwitchTarget(tabId, targetWindowId);
        await syncTwitchAutoMuteForTab(await chrome.tabs.get(sourceTabId).catch(() => null));
        return true;
    }


    return false;
}

async function adoptTwitchSpawnedTab(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;

    const managedWindowId = await getTwitchWindowId();
    if (!Number.isInteger(managedWindowId)) return false;

    if (tab.windowId === managedWindowId) {
        await syncTwitchAutoMuteForTab(tab);
        return false;
    }


    let sourceTabId = Number.isInteger(tab.openerTabId) ? tab.openerTabId : null;
    if (!sourceTabId && Date.now() <= twitchRecentUserInteractionUntil) {
        const mainTabs = await getTwitchWindowTabs(managedWindowId);
        sourceTabId = mainTabs.find(candidate => candidate.active)?.id || mainTabs[0]?.id || null;
    }
    if (!Number.isInteger(sourceTabId)) return false;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(sourceTabId);
    } catch {
        return false;
    }
    if (sourceTab.windowId !== managedWindowId) return false;

    const url = String(tab.pendingUrl || tab.url || "");
    const unresolved = !url || url === "about:blank" || url.startsWith("chrome://newtab");

    if (unresolved) {
        twitchSpawnCandidates.set(tab.id, {
            sourceTabId,
            sourceWindowId: tab.windowId,
            expiresAt: Date.now() + 7000
        });
        return false;
    }

    return redirectSpawnedTwitchTarget(tab.id, url, sourceTabId, tab.windowId);
}

async function resolveTwitchSpawnCandidate(tabId, url, tab) {
    const pending = twitchSpawnCandidates.get(tabId);
    if (!pending) return false;

    if (pending.expiresAt < Date.now()) {
        twitchSpawnCandidates.delete(tabId);
        return false;
    }

    if (!url || url === "about:blank") return false;

    twitchSpawnCandidates.delete(tabId);
    if (!isTwitchUrl(url)) return false;

    return redirectSpawnedTwitchTarget(
        tabId,
        url,
        pending.sourceTabId,
        tab?.windowId ?? pending.sourceWindowId
    );
}

async function handleTwitchCreatedNavigationTarget(details) {
    if (!details || !Number.isInteger(details.tabId) || !Number.isInteger(details.sourceTabId)) return;

    let sourceTab;
    try {
        sourceTab = await chrome.tabs.get(details.sourceTabId);
    } catch {
        return;
    }

    const managedWindowId = await getTwitchWindowId();
    if (sourceTab.windowId !== managedWindowId) return;

    let targetTab = null;
    try {
        targetTab = await chrome.tabs.get(details.tabId);
    } catch {}

    const targetUrl = String(details.url || targetTab?.pendingUrl || targetTab?.url || "");
    if (isTwitchUrl(targetUrl)) {
        await redirectSpawnedTwitchTarget(
            details.tabId,
            targetUrl,
            details.sourceTabId,
            targetTab?.windowId
        );
        return;
    }

    if (!targetUrl || targetUrl === "about:blank" || targetUrl.startsWith("chrome://newtab")) {
        twitchSpawnCandidates.set(details.tabId, {
            sourceTabId: details.sourceTabId,
            sourceWindowId: targetTab?.windowId,
            expiresAt: Date.now() + 7000
        });
    }
}

async function adoptRecentTwitchWindow(windowId) {
    if (!Number.isInteger(windowId) || Date.now() > twitchRecentUserInteractionUntil) return false;

    const managedWindowId = await getTwitchWindowId();
    if (!Number.isInteger(managedWindowId) || windowId === managedWindowId) return false;

    for (const delay of [80, 220, 500, 900, 1500]) {
        await new Promise(resolve => setTimeout(resolve, delay));

        let tabs = [];
        try {
            tabs = await chrome.tabs.query({ windowId });
        } catch {
            return false;
        }

        const twitchTab = tabs.find(tab => isTwitchUrl(tab.url || tab.pendingUrl));
        if (!twitchTab) continue;

        const mainTabs = await getTwitchWindowTabs(managedWindowId);
        const sourceTab = mainTabs.find(tab => tab.active) || mainTabs[0];
        if (!sourceTab?.id) return false;

        return redirectSpawnedTwitchTarget(
            twitchTab.id,
            twitchTab.url || twitchTab.pendingUrl,
            sourceTab.id,
            windowId
        );
    }

    return false;
}

function twitchChannelKey(url) {
    if (!isTwitchUrl(url)) return null;

    try {
        const parsed = new URL(url);
        const first = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
        const reserved = new Set([
            "directory", "downloads", "drops", "friends", "inventory", "jobs",
            "login", "messages", "p", "payments", "search", "settings", "signup",
            "subscriptions", "turbo", "videos", "wallet"
        ]);
        return first && !reserved.has(first) ? first : null;
    } catch {
        return null;
    }
}

async function getTwitchWindowId() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_WINDOW_STORAGE_KEY);
        const windowId = stored[TWITCH_WINDOW_STORAGE_KEY];
        if (!Number.isInteger(windowId)) return null;

        const win = await chrome.windows.get(windowId, { populate: true });
        const hasTwitchTab = (win.tabs || []).some(
            tab => isTwitchUrl(tab.url || tab.pendingUrl)
        );

        if (!hasTwitchTab) {
            await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY);
            return null;
        }

        return windowId;
    } catch {
        await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY).catch(() => {});
        return null;
    }
}

async function cleanupLegacyTwitchDropsWorker() {
    /* 0.16.0-0.16.2 used a second Inventory popup. Opera may surface that
     * popup as a full normal browser window, so retire it aggressively on
     * upgrade and clear the old maintenance alarm/storage state. */
    try {
        const stored = await chrome.storage.local.get(TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY);
        const windowId = stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY];
        await chrome.storage.local.remove(TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY).catch(() => {});
        if (Number.isInteger(windowId)) {
            await chrome.windows.remove(windowId).catch(() => {});
        }
    } catch {}

    await chrome.alarms.clear(TWITCH_DROPS_MAINTENANCE_ALARM).catch(() => {});
}

async function isStreamShellTwitchAutomationWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    return (await getTwitchWindowId()) === windowId;
}

async function getTwitchLastContentUrl() {
    try {
        const stored = await chrome.storage.local.get("streamShellTwitchLastContentUrl");
        const url = String(stored.streamShellTwitchLastContentUrl || "");
        return isTwitchUrl(url) && !isTwitchDropsUrl(url) ? url : null;
    } catch {
        return null;
    }
}

async function rememberTwitchContentUrl(url) {
    if (!isTwitchUrl(url) || isTwitchDropsUrl(url)) return;
    await chrome.storage.local.set({ streamShellTwitchLastContentUrl: url }).catch(() => {});
}

async function getTwitchSetting(key, fallback) {
    try {
        const stored = await chrome.storage.local.get(key);
        return Object.prototype.hasOwnProperty.call(stored, key)
            ? stored[key]
            : fallback;
    } catch {
        return fallback;
    }
}

async function ensureTwitchWindow() {
    if (shuttingDown) {
        throw new Error("Twitch creation cancelled.");
    }

    if (twitchCreationLock) {
        return twitchCreationLock;
    }

    twitchCreationLock = _ensureTwitchWindow().finally(() => {
        twitchCreationLock = null;
    });

    return twitchCreationLock;
}

async function _ensureTwitchWindow() {
    let windowId = await getTwitchWindowId();

    if (Number.isInteger(windowId)) {
        try {
            await chrome.windows.get(windowId);
            /* Migrate any legacy multi-tab Twitch popup left behind by 0.16.0/
             * 0.16.1 back to the single-visible-tab invariant immediately. */
            await consolidateVisibleTwitchWindow(windowId).catch(() => {});
            return windowId;
        } catch {
            await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY);
        }
    }

    const win = await chrome.windows.create({
        type: "popup",
        state: "normal",
        focused: false,
        left: RIGHT.left,
        top: RIGHT.top,
        width: RIGHT.width,
        height: RIGHT.height,
        url: TWITCH_HOME_URL
    });

    if (!Number.isInteger(win?.id)) {
        throw new Error("Twitch utility window could not be created.");
    }

    windowId = win.id;
    await chrome.storage.local.set({
        [TWITCH_WINDOW_STORAGE_KEY]: windowId
    });

    return windowId;
}

async function getTwitchWindowTabs(windowId) {
    try {
        return await chrome.tabs.query({ windowId });
    } catch {
        return [];
    }
}

async function consolidateVisibleTwitchWindow(windowId) {
    const tabs = await getTwitchWindowTabs(windowId);
    if (!tabs.length) return null;

    const keep =
        tabs.find(tab => tab.active && isTwitchUrl(tab.url || tab.pendingUrl)) ||
        tabs.find(tab => isTwitchUrl(tab.url || tab.pendingUrl)) ||
        tabs[0];

    const extraIds = tabs
        .filter(tab => tab.id !== keep.id)
        .map(tab => tab.id)
        .filter(Number.isInteger);

    if (extraIds.length) {
        await chrome.tabs.remove(extraIds).catch(() => {});
    }

    return keep;
}

async function activateTwitchTargetInMainWindow(windowId, target = "resume") {
    let tab = await consolidateVisibleTwitchWindow(windowId);
    if (!tab?.id) return null;

    const currentUrl = String(tab.url || tab.pendingUrl || "");

    if (target === "drops") {
        if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
            await rememberTwitchContentUrl(currentUrl);
        }

        if (!isTwitchDropsUrl(currentUrl)) {
            tab = await chrome.tabs.update(tab.id, { url: TWITCH_DROPS_URL, active: true });
        } else if (!tab.active) {
            tab = await chrome.tabs.update(tab.id, { active: true });
        }
        return tab;
    }

    /* Main Twitch actions are resume/show semantics, not navigation. If the
     * utility is already on a channel, keep that channel exactly where it is.
     * Returning from the Inventory restores the last non-Inventory Twitch URL. */
    if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
        await rememberTwitchContentUrl(currentUrl);
        if (!tab.active) tab = await chrome.tabs.update(tab.id, { active: true });
        return tab;
    }

    const resumeUrl = await getTwitchLastContentUrl();
    const destination = resumeUrl || TWITCH_HOME_URL;
    if (currentUrl !== destination) {
        tab = await chrome.tabs.update(tab.id, { url: destination, active: true });
    } else if (!tab.active) {
        tab = await chrome.tabs.update(tab.id, { active: true });
    }

    return tab;
}

async function deactivateTwitchForRightSurface(options = {}) {
    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);

    if (forceMinimize || !keepActive) {
        await safelyMinimizeWindow(windowId);
    }
    /* Keep-active deliberately means do nothing: the real on-screen Twitch
     * window remains at RIGHT and the next restored surface simply covers it. */
}

async function syncManagedTwitchTargetFromUrl(windowId, url) {
    if (!Number.isInteger(windowId) || !isTwitchUrl(url)) return;

    const managedWindowId = await getTwitchWindowId();
    if (managedWindowId !== windowId) return;

    const nextTarget = isTwitchDropsUrl(url) ? "drops" : "resume";
    const state = await chrome.storage.local.get(["rightMode", "twitchTarget"]);

    if (state.rightMode !== "twitch" || state.twitchTarget === nextTarget) return;

    await chrome.storage.local.set({ twitchTarget: nextTarget });
    await broadcastState();
}

async function showTwitch(target = "resume") {
    if (shuttingDown) return;

    const twitchTarget = target === "drops" ? "drops" : "resume";

    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch utility is available from the Wide Landing layout.");
    }

    const dashboardId = await ensureDashboardWindow();
    const twitchWindowId = await ensureTwitchWindow();

    await hideDiscordForDashboard();
    await restoreWindow(dashboardId, RIGHT, false);

    await activateTwitchTargetInMainWindow(twitchWindowId, twitchTarget);

    await syncTwitchAutoMuteForWindow(twitchWindowId);

    await chrome.storage.local.set({
        rightMode: "twitch",
        twitchTarget
    });

    await restoreWindow(twitchWindowId, RIGHT, true);
    await claimFocusedTitlebarSurface(twitchWindowId);
    scheduleTitlebarClaimRetries(twitchWindowId);

    await broadcastState();
}

async function isManagedTwitchWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    return (await getTwitchWindowId()) === windowId;
}

async function armTwitchRaidGuard(tab, sourceUrl) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const sourceChannel = twitchChannelKey(sourceUrl);
    if (!sourceChannel) return false;

    const normalizedSource = `https://www.twitch.tv/${sourceChannel}`;
    await chrome.storage.session.set({
        [TWITCH_RAID_GUARD_SESSION_KEY]: {
            tabId: tab.id,
            windowId: tab.windowId,
            sourceUrl: normalizedSource,
            sourceChannel,
            expiresAt: Date.now() + 45000
        }
    });

    return true;
}

async function disarmTwitchRaidGuard(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    const guard = stored[TWITCH_RAID_GUARD_SESSION_KEY];
    if (!guard || guard.tabId !== tab.id) return false;

    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
    return true;
}


async function enforceTwitchRaidGuard(tabId, url) {
    if (!isTwitchUrl(url)) return;

    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    const guard = stored[TWITCH_RAID_GUARD_SESSION_KEY];
    if (!guard || guard.tabId !== tabId) return;

    if (!Number.isFinite(guard.expiresAt) || guard.expiresAt < Date.now()) {
        await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
        return;
    }

    const nextChannel = twitchChannelKey(url);
    if (!nextChannel || nextChannel === guard.sourceChannel) return;

    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
    await chrome.tabs.update(tabId, { url: guard.sourceUrl }).catch(() => {});
}

chrome.tabs.onCreated.addListener(tab => {
    adoptTwitchSpawnedTab(tab).catch(() => {});
});

chrome.windows.onCreated.addListener(window => {
    adoptRecentTwitchWindow(window?.id).catch(() => {});
});

if (chrome.webNavigation?.onCreatedNavigationTarget) {
    chrome.webNavigation.onCreatedNavigationTarget.addListener(details => {
        handleTwitchCreatedNavigationTarget(details).catch(() => {});
    });
}

chrome.tabs.onRemoved.addListener(tabId => {
    twitchSpawnCandidates.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab?.url || tab?.pendingUrl;

    if (url) {
        enforceTwitchRaidGuard(tabId, url).catch(() => {});
        resolveTwitchSpawnCandidate(tabId, url, tab).catch(() => {});
    }

    if (tab?.windowId) {
        getTwitchWindowId()
            .then(windowId => {
                if (windowId === tab.windowId && isTwitchUrl(url) && !isTwitchDropsUrl(url)) {
                    return rememberTwitchContentUrl(url);
                }
            })
            .catch(() => {});
        syncManagedTwitchTargetFromUrl(tab.windowId, url).catch(() => {});
        syncTwitchAutoMuteForTab(tab).catch(() => {});
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchAutoMute")) {
        reconcileTwitchAudioPolicy().catch(() => {});
    }

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchKeepActive") && changes.streamShellTwitchKeepActive.newValue === false) {
        chrome.storage.local.get("rightMode")
            .then(state => {
                if (state.rightMode !== "twitch") {
                    return deactivateTwitchForRightSurface({ forceMinimize: true });
                }
            })
            .catch(() => {});
    }

    if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchPreventRaids") && changes.streamShellTwitchPreventRaids.newValue === false) {
        chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
    }
});

/* Remove the obsolete 0.16.0-0.16.2 Inventory worker immediately after
 * an extension upgrade/reload. No Twitch browser window exists solely for
 * auto-claim anymore. */
cleanupLegacyTwitchDropsWorker().catch(() => {});

/* Reconcile an already-open managed Twitch window after extension reload. */
reconcileTwitchAudioPolicy().catch(() => {});
