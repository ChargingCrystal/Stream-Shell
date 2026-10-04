/*
 * ============================================================
 * TWITCH AUXILIARY WINDOW
 * ============================================================
 *
 * Twitch is intentionally not a core provider. It is a Wide-only utility
 * surface used for normal Twitch viewing and Drops. Wide mode can keep either
 * the legacy single Twitch popup or the persistent two-member Split View. Each
 * Twitch window remains single-tab; Split View keeps the two browser documents
 * alive while Dashboard/Discord covers them.
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

    if (!(await isStreamShellTwitchAutomationWindow(tab.windowId))) return false;

    if (tab.autoDiscardable !== false) {
        await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    }

    /* Workspace V2 owns mute per slot. A manual HUD unmute must survive
     * Twitch SPA/tab updates instead of being immediately re-muted by the
     * legacy global Auto Mute policy. Non-workspace Twitch keeps the old
     * setting behavior. */
    const workspaceAudio = await getTwitchWorkspaceV2AudioPolicy(tab.windowId).catch(() => null);
    if (workspaceAudio) {
        const desiredMuted = workspaceAudio.muted === true;
        if ((tab.mutedInfo?.muted === true) !== desiredMuted) {
            await chrome.tabs.update(tab.id, { muted: desiredMuted }).catch(() => {});
        }
        return desiredMuted;
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

    /* Pointer activity is still useful for spawned-window adoption, but it is
     * not itself proof that the user wants to cancel an armed raid guard.
     * Explicit Twitch channel-link navigation and Stream Shell slot edits
     * disarm their own tab guard at the point of navigation instead. */
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

    if ((await getTwitchWindowId()) === windowId) {
        return true;
    }

    if (await isTwitchWorkspaceV2ContentWindowId(windowId)) {
        return true;
    }

    return isTwitchSplitLabWindowId(windowId);
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


function getTwitchSplitLabRects() {
    const widthA = Math.floor(RIGHT.width / 2);
    const widthB = RIGHT.width - widthA;

    return {
        a: {
            left: RIGHT.left,
            top: RIGHT.top,
            width: widthA,
            height: RIGHT.height
        },
        b: {
            left: RIGHT.left + widthA,
            top: RIGHT.top,
            width: widthB,
            height: RIGHT.height
        }
    };
}

async function getTwitchSplitLabRecord() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_SPLIT_LAB_STORAGE_KEY);
        const record = stored[TWITCH_SPLIT_LAB_STORAGE_KEY];
        return record && typeof record === "object" ? record : null;
    } catch {
        return null;
    }
}

async function isTwitchSplitLabWindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;

    const record = await getTwitchSplitLabRecord();
    return Array.isArray(record?.windowIds) && record.windowIds.includes(windowId);
}

async function getTwitchSplitLabWindowSnapshot(record = null) {
    const activeRecord = record || await getTwitchSplitLabRecord();
    const ids = Array.isArray(activeRecord?.windowIds)
        ? activeRecord.windowIds.filter(Number.isInteger)
        : [];
    const windows = [];

    for (const id of ids) {
        try {
            windows.push(await chrome.windows.get(id, { populate: true }));
        } catch {
            windows.push(null);
        }
    }

    return windows;
}

async function focusExistingTwitchSplitLab(record, preferredMember = null) {
    const windows = await getTwitchSplitLabWindowSnapshot(record);
    if (windows.length !== 2 || windows.some(window => !Number.isInteger(window?.id))) {
        return false;
    }

    /*
     * Do not resize or navigate the proven Twitch surfaces on resume. The two
     * popups keep their original compositor surfaces while Dashboard/Discord
     * merely cover them. Raise both halves, then focus the requested member.
     * This gives the Landing Twitch/Drops buttons useful focus semantics
     * without replacing either document.
     */
    const preferredIndex = preferredMember === "a"
        ? 0
        : preferredMember === "b"
            ? 1
            : 1;
    const order = preferredIndex === 0 ? [1, 0] : [0, 1];

    for (const index of order) {
        const window = windows[index];
        if (window.state === "minimized") {
            await chrome.windows.update(window.id, { state: "normal" });
        }
        await chrome.windows.update(window.id, { focused: true });
    }

    return true;
}

async function getTwitchSplitMemberTab(record, member) {
    const index = member === "b" ? 1 : 0;
    const windowId = Array.isArray(record?.windowIds) ? record.windowIds[index] : null;
    if (!Number.isInteger(windowId)) return null;

    try {
        const tabs = await chrome.tabs.query({ windowId });
        return tabs.find(tab => tab.active) || tabs[0] || null;
    } catch {
        return null;
    }
}

async function ensureTwitchSplitTarget(record, target) {
    if (!record || record.mode !== "mixed") return false;

    if (target === "drops") {
        const tab = await getTwitchSplitMemberTab(record, "b");
        const currentUrl = String(tab?.url || tab?.pendingUrl || "");
        if (!Number.isInteger(tab?.id)) return false;
        if (!isTwitchDropsUrl(currentUrl)) {
            await chrome.tabs.update(tab.id, { url: TWITCH_DROPS_URL });
        }
        return true;
    }

    const tab = await getTwitchSplitMemberTab(record, "a");
    const currentUrl = String(tab?.url || tab?.pendingUrl || "");
    if (!Number.isInteger(tab?.id)) return false;

    if (!isTwitchUrl(currentUrl) || isTwitchDropsUrl(currentUrl)) {
        const fallback = (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
        await chrome.tabs.update(tab.id, { url: fallback });
    }
    return true;
}

async function markTwitchSplitReuse(record, preferredMember, reason) {
    const next = {
        ...record,
        reuseCount: Number(record?.reuseCount || 0) + 1,
        lastActivatedAt: Date.now(),
        lastFocusedMember: preferredMember === "a" ? "a" : "b",
        lastActivationReason: String(reason || "resume")
    };
    await chrome.storage.local.set({ [TWITCH_SPLIT_LAB_STORAGE_KEY]: next });
    return next;
}

async function claimTwitchSplitLabNativeWindow(windowId, member, rect) {
    if (shuttingDown || !Number.isInteger(windowId) || !rect) return false;

    if (!titlebarPort) {
        await ensureTitlebarNative();
    }
    if (!titlebarPort || !titlebarProtocolReady) return false;

    try {
        const win = await chrome.windows.get(windowId, { populate: true });
        if (!Number.isInteger(win?.id) || win.state === "minimized") return false;

        const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
        const titleHint = typeof tab?.title === "string"
            ? tab.title.trim().slice(0, 180)
            : "";
        if (!titleHint) return false;

        titlebarPort.postMessage({
            type: "claim",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            layoutProfile: "wide",
            side: "right",
            mode: "twitch",
            member,
            titleHint,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        return true;
    } catch {
        return false;
    }
}

function scheduleTwitchSplitLabNativeClaims(record) {
    const ids = Array.isArray(record?.windowIds) ? record.windowIds : [];
    const rects = record?.layout || {};
    const members = [
        { id: ids[0], member: "a", rect: rects.a },
        { id: ids[1], member: "b", rect: rects.b }
    ];
    const delays = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6500];

    for (const delay of delays) {
        setTimeout(() => {
            if (shuttingDown) return;
            for (const entry of members) {
                claimTwitchSplitLabNativeWindow(entry.id, entry.member, entry.rect).catch(() => {});
            }
        }, delay);
    }
}

async function closeTwitchSplitLab() {
    const record = await getTwitchSplitLabRecord();
    const windowIds = Array.isArray(record?.windowIds)
        ? record.windowIds.filter(Number.isInteger)
        : [];

    /*
     * Clear ownership before removing windows so the generic onRemoved path
     * cannot mistake deliberate lab teardown for a user-closing transition.
     */
    await chrome.storage.local.remove(TWITCH_SPLIT_LAB_STORAGE_KEY).catch(() => {});

    for (const windowId of windowIds) {
        await safelyRemoveWindow(windowId);
    }
}

async function createDirectTwitchSplitPopup(url, rect, focused) {
    const win = await chrome.windows.create({
        type: "popup",
        url,
        state: "normal",
        focused,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    });

    if (!Number.isInteger(win?.id)) {
        throw new Error("Opera did not return a Twitch split-lab window id.");
    }

    return win;
}

async function closeManagedTwitchWindowForSplitLab() {
    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    const tabs = await getTwitchWindowTabs(windowId);
    const activeTab = tabs.find(tab => tab.active) || tabs[0] || null;
    const currentUrl = String(activeTab?.url || activeTab?.pendingUrl || "");

    if (isTwitchUrl(currentUrl) && !isTwitchDropsUrl(currentUrl)) {
        await rememberTwitchContentUrl(currentUrl);
    }

    /*
     * Remove logical ownership before the physical popup. The ordinary
     * Twitch-window onRemoved handler would otherwise restore Dashboard while
     * the two replacement lab windows are being created.
     */
    await chrome.storage.local.remove(TWITCH_WINDOW_STORAGE_KEY).catch(() => {});
    await safelyRemoveWindow(windowId);
}

async function getTwitchSplitLabDiagnostics() {
    const record = await getTwitchSplitLabRecord();
    if (!record) {
        return {
            active: false,
            windowCount: 0,
            windows: []
        };
    }

    const ids = Array.isArray(record.windowIds)
        ? record.windowIds.filter(Number.isInteger)
        : [];
    const windows = [];

    for (const id of ids) {
        try {
            const win = await chrome.windows.get(id, { populate: true });
            const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
            const automationManaged = await isTwitchSplitLabWindowId(id);
            let automationMarker = false;
            let documentIdentity = null;

            if (Number.isInteger(tab?.id)) {
                const markerResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement?.dataset?.streamShellTwitch === "true"
                }).catch(() => []);
                automationMarker = markerResults.some(result => result?.result === true);

                const identityResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => ({
                        href: location.href,
                        timeOrigin: Number.isFinite(performance.timeOrigin)
                            ? Math.round(performance.timeOrigin)
                            : null,
                        navigationType: performance.getEntriesByType("navigation")?.[0]?.type || null
                    })
                }).catch(() => []);
                documentIdentity = identityResults.find(result => result?.result)?.result || null;
            }

            windows.push({
                id: win.id,
                state: win.state,
                focused: win.focused === true,
                left: win.left,
                top: win.top,
                width: win.width,
                height: win.height,
                automationManaged,
                automationMarker,
                documentIdentity,
                tab: tab
                    ? {
                        id: tab.id,
                        status: tab.status,
                        url: tab.url || tab.pendingUrl || null,
                        title: tab.title || null,
                        audible: tab.audible === true,
                        muted: tab.mutedInfo?.muted === true,
                        discarded: tab.discarded === true
                    }
                    : null
            });
        } catch {
            windows.push({
                id,
                missing: true
            });
        }
    }

    const surfaceState = await chrome.storage.local.get("rightMode").catch(() => ({}));

    return {
        active: true,
        visible: surfaceState.rightMode === "twitch",
        covered: surfaceState.rightMode !== "twitch",
        createdAt: record.createdAt || null,
        urls: record.urls || null,
        layout: record.layout || null,
        mode: record.mode || "mixed",
        lifecycle: record.lifecycle || null,
        nativeTitlebarClaimed: record.nativeTitlebarClaimed || null,
        nativeClusterMembers: Number.isInteger(titlebarLastNativeStatus?.twitchClusterMembers)
            ? titlebarLastNativeStatus.twitchClusterMembers
            : null,
        nativeClusterMap: titlebarLastNativeStatus?.twitchClusterMap || null,
        reuseCount: Number(record.reuseCount || 0),
        lastActivatedAt: record.lastActivatedAt || record.createdAt || null,
        lastFocusedMember: record.lastFocusedMember || null,
        lastActivationReason: record.lastActivationReason || null,
        windowCount: windows.filter(window => window?.missing !== true).length,
        windows
    };
}

async function showTwitchSplitLab(mode = "mixed", preferredMember = null) {
    if (shuttingDown) return;

    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch split lab is available from the Wide Landing layout.");
    }

    const dashboardId = await ensureDashboardWindow();
    await hideDiscordForDashboard();
    await restoreWindow(dashboardId, RIGHT, false);
    await closeManagedTwitchWindowForSplitLab();

    const referenceMode = mode === "reference";
    const requestedMode = referenceMode ? "reference" : "mixed";
    const existing = await getTwitchSplitLabRecord();

    if (existing?.mode === requestedMode) {
        const member = preferredMember === "a" || preferredMember === "b"
            ? preferredMember
            : (existing.lastFocusedMember === "a" ? "a" : "b");

        await chrome.storage.local.set({
            rightMode: "twitch",
            twitchTarget: member === "b" ? "drops" : "resume"
        });

        if (await focusExistingTwitchSplitLab(existing, member)) {
            const reused = await markTwitchSplitReuse(existing, member, "split-button");
            scheduleTwitchSplitLabNativeClaims(reused);
            await recordFlightEvent({
                source: "background",
                category: "twitch-split-lab",
                action: "resumed",
                provider: "twitch",
                detail: {
                    windowIds: reused.windowIds,
                    mode: reused.mode,
                    preferredMember: member,
                    reuseCount: reused.reuseCount,
                    lifecycle: "persistent-cover-resume"
                }
            }).catch(() => {});
            await broadcastState();
            return getTwitchSplitLabDiagnostics();
        }
    }

    /* A deliberate mode change or a partially missing pair gets one clean
     * rebuild. Ordinary Dashboard/Discord switches no longer come through here
     * as teardown, so Drops/stream documents survive those transitions. */
    await closeTwitchSplitLab();

    const rects = getTwitchSplitLabRects();
    const urlA = referenceMode
        ? "https://www.twitch.tv/gronkhtv"
        : (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
    const urlB = referenceMode
        ? "https://www.twitch.tv/rainbow6"
        : TWITCH_DROPS_URL;

    let winA = null;
    let winB = null;

    try {
        winA = await createDirectTwitchSplitPopup(urlA, rects.a, false);
        winB = await createDirectTwitchSplitPopup(urlB, rects.b, true);
    } catch (error) {
        if (Number.isInteger(winA?.id)) await safelyRemoveWindow(winA.id);
        if (Number.isInteger(winB?.id)) await safelyRemoveWindow(winB.id);
        throw error;
    }

    const record = {
        createdAt: Date.now(),
        urls: { a: urlA, b: urlB },
        windowIds: [winA.id, winB.id],
        layout: {
            rightPane: { ...RIGHT },
            a: rects.a,
            b: rects.b
        },
        nativeTitlebarClaimed: "requested",
        lifecycle: "direct-final-geometry+persistent-cover",
        management: "twitch-content-automation+native-cluster",
        mode: requestedMode,
        reuseCount: 0,
        lastActivatedAt: Date.now(),
        lastFocusedMember: preferredMember === "a" ? "a" : "b",
        lastActivationReason: "created"
    };

    await chrome.storage.local.set({
        [TWITCH_SPLIT_LAB_STORAGE_KEY]: record,
        rightMode: "twitch",
        twitchTarget: record.lastFocusedMember === "b" ? "drops" : "resume"
    });

    scheduleTwitchSplitLabNativeClaims(record);

    await recordFlightEvent({
        source: "background",
        category: "twitch-split-lab",
        action: "created",
        provider: "twitch",
        detail: {
            windowIds: record.windowIds,
            urls: record.urls,
            layout: record.layout,
            nativeTitlebarClaimed: "requested",
            mode: record.mode
        }
    }).catch(() => {});

    await broadcastState();
    return getTwitchSplitLabDiagnostics();
}


async function reconcileClosedTwitchSplitLabWindow(windowId) {
    if (!Number.isInteger(windowId)) return;

    const record = await getTwitchSplitLabRecord();
    if (!Array.isArray(record?.windowIds) || !record.windowIds.includes(windowId)) {
        return;
    }

    const remaining = record.windowIds.filter(id => id !== windowId && Number.isInteger(id));

    await recordFlightEvent({
        source: "background",
        category: "twitch-split-lab",
        action: "window-closed",
        provider: "twitch",
        detail: {
            windowId,
            remainingWindowIds: remaining
        }
    }).catch(() => {});

    if (remaining.length) {
        await chrome.storage.local.set({
            [TWITCH_SPLIT_LAB_STORAGE_KEY]: {
                ...record,
                windowIds: remaining
            }
        });
        return;
    }

    await chrome.storage.local.remove(TWITCH_SPLIT_LAB_STORAGE_KEY).catch(() => {});

    const state = await chrome.storage.local.get(["rightMode", TWITCH_WINDOW_STORAGE_KEY]);
    if (
        state.rightMode === "twitch" &&
        !Number.isInteger(state[TWITCH_WINDOW_STORAGE_KEY])
    ) {
        await showDashboard().catch(async () => {
            await chrome.storage.local.set({ rightMode: "dashboard" });
            await broadcastState();
        });
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
    await deactivateTwitchWorkspaceV2(options).catch(() => {});

    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);

    const splitRecord = await getTwitchSplitLabRecord();
    const splitIds = Array.isArray(splitRecord?.windowIds)
        ? splitRecord.windowIds.filter(Number.isInteger)
        : [];

    if (splitIds.length) {
        if (forceMinimize || !keepActive) {
            for (const windowId of splitIds) {
                await safelyMinimizeWindow(windowId);
            }
        }
        /* Wide keep-active mirrors the established single Twitch behavior: do
         * not destroy, park, navigate or resize the Twitch surfaces. Dashboard
         * or Discord simply covers the two warm half-windows. */
    }

    const windowId = await getTwitchWindowId();
    if (!Number.isInteger(windowId)) return;

    if (forceMinimize || !keepActive) {
        await safelyMinimizeWindow(windowId);
    }
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
    await showTwitchWorkspaceV2(twitchTarget);
}

async function isManagedTwitchWindow(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;

    if ((await getTwitchWindowId()) === windowId) {
        return true;
    }

    if (await isTwitchWorkspaceV2ContentWindowId(windowId)) {
        return true;
    }

    return isTwitchSplitLabWindowId(windowId);
}

function normalizeTwitchRaidGuardMap(value) {
    if (!value || typeof value !== "object") return {};

    /* Migrate the short-lived legacy single-guard shape in place. */
    if (Number.isInteger(value.tabId)) {
        return { [String(value.tabId)]: value };
    }

    const guards = {};
    for (const [key, guard] of Object.entries(value)) {
        if (!guard || typeof guard !== "object" || !Number.isInteger(guard.tabId)) continue;
        guards[String(guard.tabId)] = guard;
    }
    return guards;
}

async function getTwitchRaidGuardMap() {
    const stored = await chrome.storage.session.get(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => ({}));
    return normalizeTwitchRaidGuardMap(stored[TWITCH_RAID_GUARD_SESSION_KEY]);
}

async function setTwitchRaidGuardMap(guards) {
    const entries = Object.entries(guards || {});
    if (!entries.length) {
        await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
        return;
    }
    await chrome.storage.session.set({ [TWITCH_RAID_GUARD_SESSION_KEY]: Object.fromEntries(entries) });
}

async function armTwitchRaidGuard(tab, sourceUrl) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const sourceChannel = twitchChannelKey(sourceUrl);
    if (!sourceChannel) return false;

    const normalizedSource = `https://www.twitch.tv/${sourceChannel}`;
    const guards = await getTwitchRaidGuardMap();
    guards[String(tab.id)] = {
        tabId: tab.id,
        windowId: tab.windowId,
        sourceUrl: normalizedSource,
        sourceChannel,
        expiresAt: Date.now() + 45000
    };
    await setTwitchRaidGuardMap(guards);
    return true;
}

async function disarmTwitchRaidGuard(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    if (!(await isManagedTwitchWindow(tab.windowId))) return false;

    const guards = await getTwitchRaidGuardMap();
    const key = String(tab.id);
    if (!guards[key]) return false;
    delete guards[key];
    await setTwitchRaidGuardMap(guards);
    return true;
}

async function enforceTwitchRaidGuard(tabId, url) {
    if (!isTwitchUrl(url)) return;

    const guards = await getTwitchRaidGuardMap();
    const key = String(tabId);
    const guard = guards[key];
    if (!guard) return;

    if (!Number.isFinite(guard.expiresAt) || guard.expiresAt < Date.now()) {
        delete guards[key];
        await setTwitchRaidGuardMap(guards);
        return;
    }

    const nextChannel = twitchChannelKey(url);
    if (!nextChannel || nextChannel === guard.sourceChannel) return;

    delete guards[key];
    await setTwitchRaidGuardMap(guards);
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

chrome.windows.onRemoved.addListener(windowId => {
    reconcileClosedTwitchSplitLabWindow(windowId).catch(() => {});
    reconcileClosedTwitchWorkspaceV2Window(windowId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const urlChanged = typeof changeInfo.url === "string";
    const loadCompleted = changeInfo.status === "complete";
    const muteChanged = Object.prototype.hasOwnProperty.call(changeInfo, "mutedInfo");
    const url = changeInfo.url || tab?.url || tab?.pendingUrl;

    /* Most tab updates are title/favicon/audible noise. Do the expensive
     * workspace/storage lookups only for actual navigation, completed loads or
     * mute-policy changes. */
    if (urlChanged && url) {
        enforceTwitchRaidGuard(tabId, url).catch(() => {});
        resolveTwitchSpawnCandidate(tabId, url, tab).catch(() => {});
    }

    if (tab?.windowId && urlChanged) {
        getTwitchWindowId()
            .then(windowId => {
                if (windowId === tab.windowId && isTwitchUrl(url) && !isTwitchDropsUrl(url)) {
                    return rememberTwitchContentUrl(url);
                }
            })
            .catch(() => {});
        syncManagedTwitchTargetFromUrl(tab.windowId, url).catch(() => {});
        syncTwitchWorkspaceV2Location(tab).catch(() => {});
    }

    if (tab?.windowId && (urlChanged || loadCompleted || muteChanged)) {
        syncTwitchAutoMuteForTab(tab).catch(() => {});
    }
});

if (chrome.webNavigation?.onHistoryStateUpdated) {
    chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
        if (details.frameId !== 0 || !isTwitchUrl(details.url)) return;
        chrome.tabs.get(details.tabId)
            .then(tab => {
                if (!tab?.windowId) return;
                return Promise.allSettled([
                    syncManagedTwitchTargetFromUrl(tab.windowId, details.url),
                    syncTwitchWorkspaceV2Location({ ...tab, url: details.url })
                ]);
            })
            .catch(() => {});
    });
}

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

});

/* Remove the obsolete 0.16.0-0.16.2 Inventory worker immediately after
 * an extension upgrade/reload. No Twitch browser window exists solely for
 * auto-claim anymore. */
cleanupLegacyTwitchDropsWorker().catch(() => {});

/* Reconcile an already-open managed Twitch window after extension reload. */
reconcileTwitchAudioPolicy().catch(() => {});
