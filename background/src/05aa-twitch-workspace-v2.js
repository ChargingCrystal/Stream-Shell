/*
 * ============================================================
 * TWITCH WORKSPACE V2 — DIRECT 4-SLOT WINDOW COMPOSITOR
 * ============================================================
 *
 * The 0.18.34-0.18.37 experiments proved that Opera GX reliably renders
 * multiple Twitch documents when every popup is born directly at its final
 * geometry and is never parked/resized as part of normal surface switching.
 *
 * V2 makes that lifecycle the product architecture:
 *   - four fixed content slots (A-D), each backed by at most one real Twitch
 *     popup window;
 *   - empty slots own no browser window at all;
 *   - Dashboard/Discord only cover live Twitch windows;
 *   - normal Twitch pages stay real top-level Twitch pages;
 *   - stream slots get content-side cleanup instead of iframe embedding;
 *   - audio mute is owned per slot and persists across Twitch navigation.
 *
 * Normal surface switching never resizes content windows. Reassigning a slot
 * navigates the existing tab by explicit user action; pane fullscreen is the
 * only deliberate geometry transition and restores the exact 2x2 slot bounds.
 */

const TWITCH_WORKSPACE_V2_VERSION = 7;
const TWITCH_WORKSPACE_V2_LIFECYCLE = "direct-final-geometry-4slot+persistent-controllers+caption-overlap-20+chatless-audio+acknowledged-claims+z-order-repair+surface-wake+pane-fullscreen";
const TWITCH_WORKSPACE_V2_SLOT_IDS = ["a", "b", "c", "d"];
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX = "streamShellTwitchWorkspaceStreamRefresh:";
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES = 60;
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_STAGGER_MINUTES = 3;
const TWITCH_WORKSPACE_V2_STREAM_REFRESH_DEFER_MINUTES = 10;
const TWITCH_WORKSPACE_V2_CAPTION_OVERLAP = 20;
const TWITCH_WORKSPACE_V2_PANE_CAPTION_FALLBACK = 34;
const twitchWorkspaceV2NativeCaptionHeights = new Map();

/* v0.20.34: actual top-frame document navigation audit. A visually reflowing
 * Twitch SPA is NOT necessarily a reload. Track browser commits separately
 * from HUD initialization, and include only bounded counts in Diagnostics.
 * MV3 worker restarts clear this in-memory history by design. */
const twitchWorkspaceV2NavigationAudit = new Map();
const TWITCH_WORKSPACE_V2_NAV_AUDIT_MAX_TABS = 64;
const twitchWorkspaceV2NavAuditStartedAt = Date.now();

function trackTwitchWorkspaceV2TopLevelCommit(details) {
    if (!Number.isInteger(details?.tabId) || details.frameId !== 0 ||
        !isTwitchUrl(details.url)) return false;
    const previous = twitchWorkspaceV2NavigationAudit.get(details.tabId);
    const transition = String(details.transitionType || "unknown");
    const modifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];
    const changedAt = Number.isFinite(details.timeStamp) ? details.timeStamp : Date.now();
    const entry = {
        observedCommits: (previous?.observedCommits || 0) + 1,
        observedReloads: (previous?.observedReloads || 0) + (transition === "reload" ? 1 : 0),
        clientRedirects: (previous?.clientRedirects || 0) + (modifiers.includes("client_redirect") ? 1 : 0),
        lastTransitionType: transition,
        lastCommittedAt: changedAt,
        firstSeenAt: previous?.firstSeenAt || changedAt
    };
    // Move re-used tabs to the end so old tabs are the first to evict.
    twitchWorkspaceV2NavigationAudit.delete(details.tabId);
    twitchWorkspaceV2NavigationAudit.set(details.tabId, entry);
    if (twitchWorkspaceV2NavigationAudit.size > TWITCH_WORKSPACE_V2_NAV_AUDIT_MAX_TABS) {
        twitchWorkspaceV2NavigationAudit.delete(twitchWorkspaceV2NavigationAudit.keys().next().value);
    }
    if (transition === "reload") {
        recordFlightEvent({source:"background", category:"twitch-workspace-v2",
            action:"document-reloaded", provider:"twitch", detail:{tabId:details.tabId}}).catch(() => {});
    }
    return true;
}

function getTwitchWorkspaceV2NavigationAudit(tabId) {
    return {
        trackingSince: twitchWorkspaceV2NavAuditStartedAt,
        tracked: Number.isInteger(tabId) && twitchWorkspaceV2NavigationAudit.has(tabId),
        ...(Number.isInteger(tabId) ? twitchWorkspaceV2NavigationAudit.get(tabId) || {} : {})
    };
}

if (chrome.webNavigation?.onCommitted) {
    chrome.webNavigation.onCommitted.addListener(details => {
        trackTwitchWorkspaceV2TopLevelCommit(details);
    });
}

function rememberTwitchWorkspaceV2NativeCaption(message) {
    const member = String(message?.member || "").trim().toLowerCase();
    const height = Number(message?.titlebarHeight);
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(member) || !Number.isFinite(height)) return false;
    if (height < 8 || height > 96) return false;
    twitchWorkspaceV2NativeCaptionHeights.set(member, Math.round(height));
    return true;
}

function getTwitchWorkspaceV2PaneCaptionOverscan(slotId) {
    const measured = Number(twitchWorkspaceV2NativeCaptionHeights.get(slotId));
    if (Number.isFinite(measured) && measured >= 8 && measured <= 96) return Math.round(measured);
    return TWITCH_WORKSPACE_V2_PANE_CAPTION_FALLBACK;
}

function twitchWorkspaceV2EmptySlot(id) {
    return {
        id,
        kind: "empty",
        kindSource: "auto",
        url: null,
        label: `Slot ${id.toUpperCase()}`,
        audioMuted: true,
        raidProtectionEnabled: false,
        windowId: null,
        tabId: null,
        createdAt: null,
        updatedAt: Date.now()
    };
}

function getTwitchWorkspaceV2Rects() {
    const leftWidth = Math.floor(RIGHT.width / 2);
    const rightWidth = RIGHT.width - leftWidth;
    const topHeight = Math.floor(RIGHT.height / 2);
    const bottomHeight = RIGHT.height - topHeight;
    const overlap = Math.min(TWITCH_WORKSPACE_V2_CAPTION_OVERLAP, Math.max(0, topHeight - 1));
    const upperHeight = topHeight + overlap;
    const lowerTop = RIGHT.top + topHeight - overlap;
    const lowerHeight = bottomHeight + overlap;

    return {
        a: { left: RIGHT.left, top: RIGHT.top, width: leftWidth, height: upperHeight },
        b: { left: RIGHT.left + leftWidth, top: RIGHT.top, width: rightWidth, height: upperHeight },
        c: { left: RIGHT.left, top: lowerTop, width: leftWidth, height: lowerHeight },
        d: { left: RIGHT.left + leftWidth, top: lowerTop, width: rightWidth, height: lowerHeight }
    };
}

function twitchWorkspaceV2ControllerUrl(slotId) {
    const id = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) ? slotId : "a";
    return `${TWITCH_WORKSPACE_SLOT_URL}?slot=${encodeURIComponent(id)}`;
}

function twitchWorkspaceV2StreamRefreshAlarmName(slotId) {
    return `${TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX}${slotId}`;
}

async function scheduleTwitchWorkspaceV2StreamRefresh(slotId, delayMinutes = null) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const index = TWITCH_WORKSPACE_V2_SLOT_IDS.indexOf(slotId);
    const firstDelay = Number.isFinite(delayMinutes)
        ? Math.max(1, Number(delayMinutes))
        : TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES +
            index * TWITCH_WORKSPACE_V2_STREAM_REFRESH_STAGGER_MINUTES;
    chrome.alarms.create(twitchWorkspaceV2StreamRefreshAlarmName(slotId), {
        delayInMinutes: firstDelay,
        periodInMinutes: TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES
    });
    return true;
}

async function syncTwitchWorkspaceV2StreamRefreshAlarms(record = null) {
    const current = record || await getTwitchWorkspaceV2Record();
    // The four independent per-slot alarms can be checked concurrently.
    // Serial get() calls used to add measurable latency (567ms in v0.20.34)
    // during the already expensive cold four-window Twitch handoff.
    await Promise.all(TWITCH_WORKSPACE_V2_SLOT_IDS.map(async slotId => {
        const name = twitchWorkspaceV2StreamRefreshAlarmName(slotId);
        const slot = current?.slots?.[slotId];
        const shouldRefresh = slot?.kind === "stream" && isTwitchUrl(slot?.url);
        const existing = await chrome.alarms.get(name).catch(() => null);
        if (shouldRefresh) {
            if (!existing) await scheduleTwitchWorkspaceV2StreamRefresh(slotId);
        } else if (existing) {
            await chrome.alarms.clear(name).catch(() => {});
        }
    }));
}

async function handleTwitchWorkspaceV2StreamRefreshAlarm(alarm) {
    const name = String(alarm?.name || "");
    if (!name.startsWith(TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX)) return;

    const slotId = name.slice(TWITCH_WORKSPACE_V2_STREAM_REFRESH_ALARM_PREFIX.length);
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) || shuttingDown) return;

    const record = await getTwitchWorkspaceV2Record();
    const slot = record?.slots?.[slotId];
    if (!slot || slot.kind !== "stream" || !isTwitchUrl(slot.url)) {
        await chrome.alarms.clear(name).catch(() => {});
        return;
    }

    const win = await getTwitchWorkspaceV2Window(slot.windowId);
    const tab = win?.tabs?.find(candidate => candidate.active) || win?.tabs?.[0] || null;
    if (!Number.isInteger(tab?.id)) return;

    /* Maintenance must not yank an actively used Twitch pane out from under the
     * user. If this slot is focused/fullscreen, retry in ten minutes. Covered
     * background streams can refresh immediately. */
    const surface = await chrome.storage.local.get("rightMode").catch(() => ({}));
    if (record.paneFullscreenSlot === slotId || (surface.rightMode === "twitch" && win.focused === true)) {
        await scheduleTwitchWorkspaceV2StreamRefresh(
            slotId,
            TWITCH_WORKSPACE_V2_STREAM_REFRESH_DEFER_MINUTES
        );
        return;
    }

    await chrome.tabs.reload(tab.id).catch(() => {});
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});

    await recordFlightEvent({
        source: "background",
        category: "twitch-workspace-v2",
        action: "maintenance-reload",
        provider: "twitch",
        detail: { slotId, intervalMinutes: TWITCH_WORKSPACE_V2_STREAM_REFRESH_MINUTES }
    }).catch(() => {});
}

function isTwitchWorkspaceV2ControllerUrl(url) {
    try {
        const parsed = new URL(String(url || ""));
        const base = new URL(TWITCH_WORKSPACE_SLOT_URL);
        return parsed.origin === base.origin && parsed.pathname === base.pathname;
    } catch {
        return false;
    }
}

function twitchWorkspaceV2ChannelFromUrl(url) {
    const key = twitchChannelKey(url);
    return key || null;
}

function inferTwitchWorkspaceV2Kind(url) {
    if (!isTwitchUrl(url)) return "page";
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter(Boolean);
        /* Auto-cleanup is intentionally conservative: only a bare channel root
         * is a stream surface. /channel/videos, /about, Drops, directories and
         * every other Twitch route stay ordinary pages unless the user
         * explicitly marks the slot as Stream. */
        return segments.length === 1 && twitchWorkspaceV2ChannelFromUrl(url)
            ? "stream"
            : "page";
    } catch {
        return "page";
    }
}

function normalizeTwitchWorkspaceV2Input(input, preferredKind = null) {
    const raw = String(input || "").trim();
    if (!raw) return null;

    let url = raw;
    if (!/^https?:\/\//i.test(raw)) {
        const compact = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
        if (!compact || /\s/.test(compact)) return null;
        url = `https://www.twitch.tv/${compact}`;
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !/(^|\.)twitch\.tv$/i.test(parsed.hostname)) {
            return null;
        }
        parsed.hash = "";
        const normalized = parsed.toString();
        const explicitKind = preferredKind === "page" || preferredKind === "stream";
        return {
            url: normalized,
            kind: explicitKind ? preferredKind : inferTwitchWorkspaceV2Kind(normalized),
            kindSource: explicitKind ? "explicit" : "auto",
            channel: twitchWorkspaceV2ChannelFromUrl(normalized)
        };
    } catch {
        return null;
    }
}

async function getTwitchWorkspaceV2Record() {
    try {
        const stored = await chrome.storage.local.get(TWITCH_WORKSPACE_V2_STORAGE_KEY);
        const record = stored[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        if (!record || typeof record !== "object") return null;

        if (record.version === TWITCH_WORKSPACE_V2_VERSION) return record;

        /* 0.19.10 adds only transient pane-fullscreen state. Keep every live
         * v6 A-D window exactly where it is; no recreation or navigation is
         * needed for this schema step. */
        if (record.version === 6) {
            const upgraded = {
                ...record,
                version: TWITCH_WORKSPACE_V2_VERSION,
                lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
                paneFullscreenSlot: null,
                updatedAt: Date.now()
            };
            await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: upgraded });
            return upgraded;
        }

        /*
         * 0.19.6 is the last geometry calibration pass for this compositor:
         * every cell is born at 960x560 on the 3840x1080 Wide reference,
         * producing a 40px shared middle seam (20px from each row). The old
         * standalone chat drawer is retired because it competed with B/D for
         * z-order. Slot-level browser mute becomes persistent workspace state.
         *
         * Recreate legacy slot windows once instead of resizing GPU-backed
         * Twitch surfaces in place. Preserve the currently observed browser
         * mute state when available, then close any legacy chat window.
         */
        if (Number.isInteger(record.version) && record.version >= 1 && record.version <= 5) {
            const retiredIds = [];
            const slots = { ...record.slots };

            for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
                const previous = record.slots?.[id] || twitchWorkspaceV2EmptySlot(id);
                const liveWindow = await getTwitchWorkspaceV2Window(previous.windowId);
                const liveTab = liveWindow?.tabs?.find(candidate => candidate.active) || liveWindow?.tabs?.[0] || null;
                const observedMuted = typeof liveTab?.mutedInfo?.muted === "boolean"
                    ? liveTab.mutedInfo.muted
                    : null;
                const audioMuted = typeof previous.audioMuted === "boolean"
                    ? previous.audioMuted
                    : (observedMuted ?? true);

                if (Number.isInteger(previous.windowId)) retiredIds.push(previous.windowId);
                slots[id] = {
                    ...previous,
                    audioMuted,
                    windowId: null,
                    tabId: null,
                    updatedAt: Date.now()
                };
            }

            const legacyChatId = Number.isInteger(record.chat?.windowId)
                ? record.chat.windowId
                : null;
            const upgraded = {
                ...record,
                version: TWITCH_WORKSPACE_V2_VERSION,
                lifecycle: "direct-final-geometry-4slot+persistent-controllers+caption-overlap-20+chatless-audio",
                slots,
                chat: null,
                updatedAt: Date.now()
            };
            await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: upgraded });

            for (const windowId of retiredIds) {
                await safelyRemoveWindow(windowId);
            }
            if (Number.isInteger(legacyChatId)) await safelyRemoveWindow(legacyChatId);
            return upgraded;
        }

        return null;
    } catch {
        return null;
    }
}

async function setTwitchWorkspaceV2Record(record, broadcast = true) {
    const next = {
        ...record,
        version: TWITCH_WORKSPACE_V2_VERSION,
        lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
        updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: next });
    if (broadcast) await broadcastState().catch(() => {});
    return next;
}

async function createInitialTwitchWorkspaceV2Record() {
    const last = (await getTwitchLastContentUrl()) || TWITCH_HOME_URL;
    const slots = {};
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) slots[id] = twitchWorkspaceV2EmptySlot(id);

    slots.a = {
        ...slots.a,
        kind: inferTwitchWorkspaceV2Kind(last),
        kindSource: "auto",
        url: last,
        label: twitchWorkspaceV2ChannelFromUrl(last) || "Twitch"
    };
    slots.b = {
        ...slots.b,
        kind: "page",
        kindSource: "auto",
        url: TWITCH_DROPS_URL,
        label: "Drops"
    };

    return {
        version: TWITCH_WORKSPACE_V2_VERSION,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
        selectedSlot: "a",
        activationCount: 0,
        paneFullscreenSlot: null,
        slots,
        chat: null
    };
}

async function migrateIntoTwitchWorkspaceV2() {
    let record = await getTwitchWorkspaceV2Record();
    if (record) return record;

    /* Retire the 0.18.34-0.18.37 lab pair exactly once. Its direct-window
     * findings survive here, but its mixed/reference state machine does not. */
    await closeTwitchSplitLab().catch(() => {});
    await closeManagedTwitchWindowForSplitLab().catch(() => {});

    record = await createInitialTwitchWorkspaceV2Record();
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
    return record;
}

async function isTwitchWorkspaceV2WindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    return TWITCH_WORKSPACE_V2_SLOT_IDS.some(id => record.slots?.[id]?.windowId === windowId);
}

async function isTwitchWorkspaceV2ContentWindowId(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    return TWITCH_WORKSPACE_V2_SLOT_IDS.some(id => record.slots?.[id]?.windowId === windowId);
}

async function getTwitchWorkspaceV2AudioPolicy(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return null;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return null;
    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return null;
    return {
        slotId,
        muted: record.slots?.[slotId]?.audioMuted !== false
    };
}

function getTwitchWorkspaceV2SlotByWindowId(record, windowId) {
    if (!record || !Number.isInteger(windowId)) return null;
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        if (record.slots?.[id]?.windowId === windowId) return id;
    }
    return null;
}

async function getTwitchWorkspaceV2Window(windowId) {
    if (!Number.isInteger(windowId)) return null;
    try {
        return await chrome.windows.get(windowId, { populate: true });
    } catch {
        return null;
    }
}

async function getTwitchWorkspaceV2SlotTab(slot) {
    if (!Number.isInteger(slot?.windowId)) return null;
    const win = await getTwitchWorkspaceV2Window(slot.windowId);
    return win?.tabs?.find(tab => tab.active) || win?.tabs?.[0] || null;
}

async function createTwitchWorkspaceV2Popup(url, rect, focused = false) {
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
        throw new Error("Opera did not return a Twitch workspace window id.");
    }
    return win;
}

async function ensureTwitchWorkspaceV2Slot(record, slotId, focused = false) {
    const slot = record?.slots?.[slotId];
    if (!slot) return { record, window: null };

    const empty = slot.kind === "empty" || !isTwitchUrl(slot.url);
    const desiredUrl = empty
        ? twitchWorkspaceV2ControllerUrl(slotId)
        : slot.url;

    const existing = await getTwitchWorkspaceV2Window(slot.windowId);
    if (existing?.id) {
        if (existing.state === "minimized") {
            await chrome.windows.update(existing.id, { state: "normal" }).catch(() => {});
        }

        const tab = existing.tabs?.find(candidate => candidate.active) || existing.tabs?.[0] || null;
        if (Number.isInteger(tab?.id)) {
            const currentUrl = String(tab.url || tab.pendingUrl || "");
            if (empty && !isTwitchWorkspaceV2ControllerUrl(currentUrl)) {
                await chrome.tabs.update(tab.id, { url: desiredUrl, active: true }).catch(() => {});
            }
            const tabPatch = { autoDiscardable: false };
            if (!empty) tabPatch.muted = slot.audioMuted !== false;
            await chrome.tabs.update(tab.id, tabPatch).catch(() => {});
        }

        if (focused) {
            await chrome.windows.update(existing.id, { focused: true }).catch(() => {});
        }

        const tabId = Number.isInteger(tab?.id) ? tab.id : slot.tabId;
        if (slot.tabId !== tabId) {
            const next = {
                ...record,
                slots: {
                    ...record.slots,
                    [slotId]: { ...slot, tabId, updatedAt: Date.now() }
                }
            };
            return { record: await setTwitchWorkspaceV2Record(next, false), window: existing };
        }
        return { record, window: existing };
    }

    const rect = getTwitchWorkspaceV2Rects()[slotId];
    const win = await createTwitchWorkspaceV2Popup(desiredUrl, rect, focused);
    const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
    if (Number.isInteger(tab?.id)) {
        const tabPatch = { autoDiscardable: false };
        if (!empty) tabPatch.muted = slot.audioMuted !== false;
        await chrome.tabs.update(tab.id, tabPatch).catch(() => {});
    }

    // The old browser window may have closed while its HWND was still alive
    // in the native mapping. A new chrome.windows ID must NOT receive a blind
    // native claim renewal for that previous HWND.
    resetTwitchWorkspaceV2ClaimCache(slot.windowId);
    twitchWorkspaceV2ForceRebindIds.add(win.id);
    const next = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: {
                ...slot,
                windowId: win.id,
                tabId: Number.isInteger(tab?.id) ? tab.id : null,
                createdAt: slot.createdAt || Date.now(),
                updatedAt: Date.now()
            }
        }
    };
    return { record: await setTwitchWorkspaceV2Record(next, false), window: win };
}

/* A native claim is NOT a completed mapping until the helper acknowledges it.
 * Previously we cached the chrome.windows ID immediately after postMessage;
 * a title/geometry race or native timeout then stranded that Twitch window
 * underneath Opera for the lifetime of the service worker. */
const twitchWorkspaceV2ClaimStates = new Map();
const twitchWorkspaceV2ClaimRequests = new Map();
// Window creation is a change of identity, not an ordinary idempotent renewal.
const twitchWorkspaceV2ForceRebindIds = new Set();
const TWITCH_WORKSPACE_V2_CLAIM_RETRY_MS = 9000;
let twitchWorkspaceV2ClaimGeneration = 0;
let twitchWorkspaceV2ClaimAuditRunning = false;

function resetTwitchWorkspaceV2ClaimCache(windowId = null) {
    if (Number.isInteger(windowId)) {
        twitchWorkspaceV2ClaimStates.delete(windowId);
        return;
    }
    twitchWorkspaceV2ClaimStates.clear();
}

function acknowledgeTwitchWorkspaceV2Claim(message) {
    if (message?.layoutProfile !== "wide" || message?.side !== "right" || message?.mode !== "twitch") return;
    const member = String(message.member || "").toLowerCase();
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(member)) return;
    for (const [windowId, state] of twitchWorkspaceV2ClaimStates) {
        if (state.member !== member || state.phase !== "pending") continue;
        // Old helper versions can acknowledge a live but obsolete HWND as a
        // renewal. Do not mark a new popup claimed until native confirms rebind.
        if (Number.isInteger(message.browserWindowId) && message.browserWindowId !== windowId) continue;
        if (twitchWorkspaceV2ForceRebindIds.has(windowId) &&
            (message.rebound !== true || message.browserWindowId !== windowId)) continue;
        twitchWorkspaceV2ForceRebindIds.delete(windowId);
        twitchWorkspaceV2ClaimStates.set(windowId, { ...state, phase: "confirmed", acknowledgedAt: Date.now() });
        return;
    }
}

function invalidateTwitchWorkspaceV2Claim(message) {
    if (message?.layoutProfile !== "wide" || message?.side !== "right" || message?.mode !== "twitch") return;
    const member = String(message.member || "").toLowerCase();
    for (const [windowId, state] of twitchWorkspaceV2ClaimStates) {
        if (state.member === member) twitchWorkspaceV2ClaimStates.delete(windowId);
    }
}

async function claimTwitchWorkspaceV2WindowById(windowId) {
    if (shuttingDown || !Number.isInteger(windowId)) return false;
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    const member = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!member) return false;
    const rect = getTwitchWorkspaceV2Rects()[member];
    return claimTwitchWorkspaceV2Window(windowId, member, rect);
}

async function claimTwitchWorkspaceV2Window(windowId, member, rect) {
    if (shuttingDown || !Number.isInteger(windowId) || !rect) return false;
    const pending = twitchWorkspaceV2ClaimRequests.get(windowId);
    if (pending) return pending;
    const task = postTwitchWorkspaceV2WindowClaim(windowId, member, rect);
    twitchWorkspaceV2ClaimRequests.set(windowId, task);
    try {
        return await task;
    } finally {
        if (twitchWorkspaceV2ClaimRequests.get(windowId) === task) {
            twitchWorkspaceV2ClaimRequests.delete(windowId);
        }
    }
}

async function postTwitchWorkspaceV2WindowClaim(windowId, member, rect) {
    const prior = twitchWorkspaceV2ClaimStates.get(windowId);
    const forceRebind = twitchWorkspaceV2ForceRebindIds.has(windowId);
    if (!forceRebind && prior?.member === member && prior.phase === "confirmed") return true;
    if (!titlebarPort) await ensureTitlebarNative();
    if (!titlebarPort || !titlebarProtocolReady) return false;

    try {
        const win = await chrome.windows.get(windowId, { populate: true });
        if (!Number.isInteger(win?.id) || win.state === "minimized") return false;
        const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
        const titleHint = typeof tab?.title === "string" ? tab.title.trim().slice(0, 180) : "";
        if (!titleHint) return false;

        /* A newly available real page title may replace the provisional
         * Twitch/slot title while native is still resolving the HWND. */
        const now = Date.now();
        if (prior?.member === member && prior.phase === "pending" &&
            prior.titleHint === titleHint && now - prior.sentAt < TWITCH_WORKSPACE_V2_CLAIM_RETRY_MS) {
            return false;
        }

        const port = titlebarPort;
        port.postMessage({
            type: "claim",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            layoutProfile: "wide",
            side: "right",
            mode: "twitch",
            member,
            titleHint,
            forceRebind,
            browserWindowId: windowId,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
        twitchWorkspaceV2ClaimStates.set(windowId, {
            member, phase: "pending", sentAt: now, titleHint,
            attempts: (prior?.attempts || 0) + 1
        });
        return true;
    } catch {
        return false;
    }
}

function scheduleTwitchWorkspaceV2Claims(record) {
    const generation = ++twitchWorkspaceV2ClaimGeneration;
    const rects = getTwitchWorkspaceV2Rects();
    const members = TWITCH_WORKSPACE_V2_SLOT_IDS
        .map(member => ({ member, windowId: record?.slots?.[member]?.windowId, rect: rects[member] }))
        .filter(entry => Number.isInteger(entry.windowId));

    /* Fast first pass plus one late-title pass. Unacknowledged members are
     * subsequently recovered by the slow titlebar heartbeat audit. */
    for (const delay of [0, 700, 1800]) {
        setTimeout(() => {
            if (shuttingDown || generation !== twitchWorkspaceV2ClaimGeneration) return;
            Promise.all(members.map(entry =>
                claimTwitchWorkspaceV2Window(entry.windowId, entry.member, entry.rect)
                    .catch(() => false)
            )).catch(() => {});
        }, delay);
    }
}

/* The native host may forget one HWND independently of the extension after a
 * helper restart or a failed claim. Audit only when Twitch is the visible right
 * surface, at the existing 10-second reconciliation cadence. */
async function reconcileTwitchWorkspaceV2Claims() {
    if (shuttingDown || !titlebarPort || !titlebarProtocolReady || twitchWorkspaceV2ClaimAuditRunning) return;
    twitchWorkspaceV2ClaimAuditRunning = true;
    try {
        const stored = await chrome.storage.local.get(["rightMode", TWITCH_WORKSPACE_V2_STORAGE_KEY]);
        if (stored.rightMode !== "twitch") return;
        const record = stored[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        if (!record || record.version !== TWITCH_WORKSPACE_V2_VERSION) return;

        /* Native status is authoritative about *presence* of a member, not
         * about the identity of a particular chrome.windows ID. Never treat
         * a status entry as a positive acknowledgement for a new window. */
        const status = titlebarLastNativeStatus;
        const nativeMembers = status?.event === "status" && status.heartbeatFresh === true
            ? new Set(String(status.twitchClusterMap || "")
                .split(";").map(entry => entry.split("=")[0].toLowerCase()).filter(Boolean))
            : null;
        const rects = getTwitchWorkspaceV2Rects();
        const jobs = [];
        for (const member of TWITCH_WORKSPACE_V2_SLOT_IDS) {
            const windowId = record.slots?.[member]?.windowId;
            if (!Number.isInteger(windowId)) continue;
            const claim = twitchWorkspaceV2ClaimStates.get(windowId);
            if (claim?.phase === "confirmed" && nativeMembers && !nativeMembers.has(member)) {
                twitchWorkspaceV2ClaimStates.delete(windowId);
            }
            jobs.push(claimTwitchWorkspaceV2Window(windowId, member, rects[member]).catch(() => false));
        }
        await Promise.all(jobs);
    } finally {
        twitchWorkspaceV2ClaimAuditRunning = false;
    }
}

function raiseTwitchWorkspaceV2NativeCluster(preferredSlot = null) {
    if (shuttingDown || !titlebarPort || !titlebarProtocolReady) return;
    try {
        titlebarPort.postMessage({
            type: "raise-twitch-cluster",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            selectedMember: TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
                ? preferredSlot
                : "a"
        });
    } catch {
        /* Native z-order is a best-effort enhancement. */
    }
}

async function setTwitchWorkspaceV2NativePaneFullscreen(slotId, enabled, rect) {
    if (shuttingDown || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId) || !rect) return false;
    if (!titlebarPort) await ensureTitlebarNative();
    if (!titlebarPort || !titlebarProtocolReady) return false;
    try {
        titlebarPort.postMessage({
            type: "set-twitch-pane-fullscreen",
            protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            member: slotId,
            enabled: enabled === true,
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

async function applyTwitchWorkspaceV2PaneFullscreenGeometry(record, slotId) {
    if (!record || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const windowId = record.slots?.[slotId]?.windowId;
    if (!Number.isInteger(windowId)) return false;

    /* IMPORTANT: browser geometry must remain browser-owned. 0.19.10/0.19.11
     * moved the Opera HWND a second time through SetWindowPos after
     * chrome.windows.update(). Opera then kept Chromium's input/compositor
     * coordinates for the browser-owned rect while Windows painted the HWND at
     * the native rect. The visible page could therefore sit roughly one caption
     * height below its hit targets, and Page slots could lose their compositor
     * surface entirely after returning to the grid.
     *
     * Keep the same borderless trick, but ask Chromium itself to overscan the
     * caption above the pane. The native helper now only tracks cluster/fullscreen
     * ownership and never mutates this HWND's geometry. */
    const caption = getTwitchWorkspaceV2PaneCaptionOverscan(slotId);
    const paneRect = {
        left: RIGHT.left,
        top: RIGHT.top - caption,
        width: RIGHT.width,
        height: RIGHT.height + caption
    };

    await setTwitchWorkspaceV2NativePaneFullscreen(slotId, true, RIGHT).catch(() => false);
    const patch = {
        state: "normal",
        left: paneRect.left,
        top: paneRect.top,
        width: paneRect.width,
        height: paneRect.height,
        focused: true
    };
    await chrome.windows.update(windowId, patch).catch(() => {});

    /* One bounded verification only. If Opera rejects the negative top on this
     * machine, leave the browser-owned pane geometry intact rather than falling
     * back to native SetWindowPos and reintroducing input/compositor desync. */
    await new Promise(resolve => setTimeout(resolve, 90));
    const observed = await chrome.windows.get(windowId).catch(() => null);
    if (!twitchWorkspaceV2WindowMatchesRect(observed, paneRect, 3)) {
        await chrome.windows.update(windowId, patch).catch(() => {});
    }
    return true;
}

function twitchWorkspaceV2WindowMatchesRect(win, rect, tolerance = 2) {
    if (!win || !rect) return false;
    const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
    return near(win.left, rect.left) && near(win.top, rect.top) &&
        near(win.width, rect.width) && near(win.height, rect.height);
}

async function restoreTwitchWorkspaceV2GridGeometry(record, slotId, focused = true) {
    if (!record || !TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    const slot = record.slots?.[slotId];
    const windowId = slot?.windowId;
    const rect = getTwitchWorkspaceV2Rects()[slotId];
    if (!Number.isInteger(windowId) || !rect) return false;

    /* Browser API owns both halves of the transition. Do not ask the native
     * helper to move the HWND before/after this resize: that was the source of
     * the one-caption hit-test offset and the persistent black Page surface. */
    const patch = {
        state: "normal",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        focused: focused === true
    };
    await chrome.windows.update(windowId, patch).catch(() => {});

    await new Promise(resolve => setTimeout(resolve, 90));
    const observed = await chrome.windows.get(windowId).catch(() => null);
    if (!twitchWorkspaceV2WindowMatchesRect(observed, rect)) {
        await chrome.windows.update(windowId, patch).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 70));
    }

    /* Drop native fullscreen ownership only after Chromium has committed the
     * grid rect. This keeps the helper chrome from racing a still-overscanned
     * browser window and exposing a second Opera titlebar underneath it. */
    await setTwitchWorkspaceV2NativePaneFullscreen(slotId, false, rect).catch(() => false);
    resetTwitchWorkspaceV2ClaimCache(windowId);
    await claimTwitchWorkspaceV2Window(windowId, slotId, rect).catch(() => false);
    raiseTwitchWorkspaceV2NativeCluster(slotId);

    if (Number.isInteger(slot.tabId)) {
        for (const delay of [0, 120, 320]) {
            setTimeout(() => {
                chrome.tabs.sendMessage(slot.tabId, { type: "stream-shell-twitch-workspace-wake" }).catch(() => {});
            }, delay);
        }
    }
    return true;
}

const TWITCH_WORKSPACE_V2_COLD_SLOT_SPACING_MS = 1250;

async function raiseTwitchWorkspaceV2(record, preferredSlot = null) {
    let next = record;
    const live = [];
    let newPopups = 0;

    /* Ensure each cell exists, but do not focus A -> B -> C -> D. The old
     * focus carousel was visible to Windows/Opera and was the main source of
     * compositor/titlebar thrash in 0.19.1. */
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        if (shuttingDown) break;
        const previousWindowId = next.slots?.[id]?.windowId;
        const ensured = await ensureTwitchWorkspaceV2Slot(next, id, false);
        next = ensured.record;
        if (Number.isInteger(ensured.window?.id)) live.push({ id, windowId: ensured.window.id });
        if (Number.isInteger(ensured.window?.id) &&
            ensured.window.id !== previousWindowId) {
            newPopups += 1;
            // Chromium is still constructing the Twitch renderer after the
            // window API has resolved. A-D must not all begin decoding,
            // injecting scripts, and loading chat in the same instant.
            if (id !== TWITCH_WORKSPACE_V2_SLOT_IDS.at(-1)) {
                await new Promise(resolve => setTimeout(resolve, TWITCH_WORKSPACE_V2_COLD_SLOT_SPACING_MS));
            }
        }
    }
    if (newPopups > 0) {
        streamShellRendererColdUntil = Date.now() + STREAM_SHELL_RENDERER_WARM_AFTER_MS;
        recordFlightEvent({
            category: 'twitch-workspace-v2', action: 'staggered-popup-startup',
            detail: { newPopups, spacingMs: TWITCH_WORKSPACE_V2_COLD_SLOT_SPACING_MS }
        }).catch(() => {});
    }

    const fullscreenId = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(next.paneFullscreenSlot)
        ? next.paneFullscreenSlot
        : null;
    const focusId = fullscreenId || (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
        ? preferredSlot
        : (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(next.selectedSlot) ? next.selectedSlot : live[0]?.id));
    const selected = live.find(entry => entry.id === focusId) || live[0] || null;

    /* One browser focus transition only. Pane fullscreen intentionally keeps
     * the other three cells underneath the selected member. */
    if (selected) {
        await chrome.windows.update(selected.windowId, { focused: true }).catch(() => {});
    }
    if (fullscreenId && selected?.id === fullscreenId) {
        await setTwitchWorkspaceV2NativePaneFullscreen(fullscreenId, true, RIGHT).catch(() => false);
    }
    raiseTwitchWorkspaceV2NativeCluster(selected?.id || focusId || "a");

    return next;
}

async function raiseExistingTwitchWorkspaceV2(preferredSlot = null) {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    const selected = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
        ? preferredSlot
        : (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.selectedSlot) ? record.selectedSlot : "a");

    /* Lightweight z-order repair only; never restart the full workspace. */
    raiseTwitchWorkspaceV2NativeCluster(selected);
    return true;
}

function pulseTwitchWorkspaceV2Tabs(record) {
    if (shuttingDown || !record) return;
    const tabIds = new Set();
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const tabId = record.slots?.[id]?.tabId;
        if (Number.isInteger(tabId)) tabIds.add(tabId);
    }
    for (const tabId of tabIds) {
        chrome.tabs.sendMessage(tabId, { type: "stream-shell-twitch-workspace-wake" })
            .catch(() => {});
    }
}

let twitchWorkspaceV2WakeGeneration = 0;

function scheduleTwitchWorkspaceV2SurfaceWake(record, preferredSlot, coldStart = false) {
    const generation = ++twitchWorkspaceV2WakeGeneration;
    const selected = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot) ? preferredSlot : "a";
    const delays = coldStart ? [90, 420, 1350] : [70, 240];

    for (const delay of delays) {
        setTimeout(() => {
            if (shuttingDown || (!coldStart && generation !== twitchWorkspaceV2WakeGeneration)) return;
            chrome.storage.local.get(["rightMode", TWITCH_WORKSPACE_V2_STORAGE_KEY])
                .then(state => {
                    if (state.rightMode !== "twitch") return;
                    const current = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
                    if (!current || current.version !== TWITCH_WORKSPACE_V2_VERSION) return;
                    /* On a cold launch claims can finish after the selected A window
                     * has already taken foreground. One final no-activate cluster raise
                     * after onboarding keeps B-D above Dashboard without focus churn. */
                    if (coldStart && delay === delays[delays.length - 1]) {
                        raiseTwitchWorkspaceV2NativeCluster(selected);
                    }
                    pulseTwitchWorkspaceV2Tabs(current);
                })
                .catch(() => {});
        }, delay);
    }
}

async function isTwitchWorkspaceV2ColdStart(record) {
    // Persisted IDs alone do not distinguish an existing workspace from A-D
    // windows that Opera closed since the last session.
    const slotWindows = await Promise.all(TWITCH_WORKSPACE_V2_SLOT_IDS.map(
        id => getTwitchWorkspaceV2Window(record.slots?.[id]?.windowId)
    ));
    return !slotWindows.every(win => Number.isInteger(win?.id));
}

function showTwitchWorkspaceV2(target = "workspace") {
    return runStreamShellWindowTransition(
        `twitch:${target}`,
        () => _showTwitchWorkspaceV2(target)
    );
}

async function _showTwitchWorkspaceV2(target = "workspace") {
    if (shuttingDown) return null;
    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch Workspace is available from the Wide Landing layout.");
    }

    await measureShellWindowStep("twitch:ensure-dashboard", () => ensureDashboardWindow());
    const surfaceBeforeShow = await chrome.storage.local.get("rightMode").catch(() => ({}));
    if (surfaceBeforeShow.rightMode === "discord") {
        await hideDiscordForDashboard();
    }

    let record = await measureShellWindowStep("twitch:load-workspace", () => migrateIntoTwitchWorkspaceV2());
    let preferredSlot = record.selectedSlot || "a";

    if (target === "drops") {
        preferredSlot = TWITCH_WORKSPACE_V2_SLOT_IDS.find(id => isTwitchDropsUrl(record.slots?.[id]?.url)) || "b";
        const current = record.slots?.[preferredSlot];
        if (!current || current.kind === "empty") {
            record = await assignTwitchWorkspaceV2Slot(preferredSlot, TWITCH_DROPS_URL, "page", false);
        }
    } else if (target === "resume") {
        preferredSlot = record.slots?.a?.kind !== "empty" ? "a" : (record.selectedSlot || "a");
    }

    if (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.paneFullscreenSlot)) {
        preferredSlot = record.paneFullscreenSlot;
    }

    // Stored slot IDs can outlive their Opera popup. Treat missing actual
    // windows as a cold A-D start so the final surface-wake/cluster repair is
    // scheduled even after a previous session left stale slot IDs behind.
    const coldStart = await isTwitchWorkspaceV2ColdStart(record);

    record = {
        ...record,
        selectedSlot: preferredSlot,
        activationCount: Number(record.activationCount || 0) + 1,
        lastActivatedAt: Date.now()
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    await chrome.storage.local.set({
        rightMode: "twitch",
        twitchTarget: target === "drops" ? "drops" : "resume"
    });

    // Maintenance alarms depend on the persisted slot kinds/URLs, not popup
    // HWND claims or UI paint. Overlap their browser-API reads with native sync
    // and A-D window creation; still await completion before announcing success.
    // Do not move CSS, compositor wake, or the already stable 1.25s stagger.
    const refreshAlarmsTask = measureShellWindowStep("twitch:refresh-alarms", () =>
        syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {}));

    // The helper now refuses Twitch cluster raises while Dashboard is active.
    // Synchronize intent before trying to raise A-D on a deliberate transition.
    await measureShellWindowStep("twitch:sync-titlebar", () => syncConnectedTitlebarNative().catch(() => {}));

    record = await measureShellWindowStep("twitch:raise-workspace", () => raiseTwitchWorkspaceV2(record, preferredSlot));
    scheduleTwitchWorkspaceV2Claims(record);
    scheduleTwitchWorkspaceV2SurfaceWake(record, preferredSlot, coldStart);
    await refreshAlarmsTask;

    await recordFlightEvent({
        source: "background",
        category: "twitch-workspace-v2",
        action: "shown",
        provider: "twitch",
        detail: {
            preferredSlot,
            activationCount: record.activationCount,
            coldStart,
            liveSlots: TWITCH_WORKSPACE_V2_SLOT_IDS.filter(id => Number.isInteger(record.slots?.[id]?.windowId)),
            lifecycle: record.lifecycle
        }
    }).catch(() => {});

    /* v0.20.3: Cold-start telemetry measured a 3.4s full broadcast. That
     * enumerates all browser windows and awaits renderer-facing messages while
     * the global transition queue is locked. State was ALREADY persisted and
     * the native titlebar synchronized above. Send a lightweight UI event only;
     * leave full broadcastState() for regular state reconciliation and explicit
     * updates, never for the critical Twitch launch path. */
    await measureShellWindowStep("twitch:notify-ui", () => broadcastTwitchWorkspaceV2LaunchState(record));
    return twitchWorkspaceV2SummaryFromRecord(record);
}

async function assignTwitchWorkspaceV2Slot(slotId, input, preferredKind = null, makeVisible = true) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    const normalized = normalizeTwitchWorkspaceV2Input(input, preferredKind);
    if (!normalized) throw new Error("Enter a Twitch channel name or twitch.tv URL.");

    let record = await migrateIntoTwitchWorkspaceV2();
    const current = record.slots?.[slotId] || twitchWorkspaceV2EmptySlot(slotId);
    let windowId = current.windowId;
    let tabId = current.tabId;

    const liveWindow = await getTwitchWorkspaceV2Window(windowId);
    if (liveWindow?.id) {
        const tab = liveWindow.tabs?.find(candidate => candidate.active) || liveWindow.tabs?.[0] || null;
        tabId = Number.isInteger(tab?.id) ? tab.id : tabId;
        if (Number.isInteger(tabId)) {
            const currentUrl = String(tab?.url || tab?.pendingUrl || "");
            if (currentUrl !== normalized.url) {
                /* Editing a workspace slot is always deliberate navigation.
                 * Clear any short-lived anti-raid guard before moving away so
                 * it cannot restore the previous channel. */
                await disarmTwitchRaidGuard({ id: tabId, windowId: liveWindow.id }).catch(() => {});
                await chrome.tabs.update(tabId, { url: normalized.url, active: true });
            }
            await chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
        }
    } else {
        windowId = null;
        tabId = null;
    }

    const label = normalized.channel || (isTwitchDropsUrl(normalized.url) ? "Drops" : new URL(normalized.url).pathname || "Twitch");
    record = {
        ...record,
        selectedSlot: slotId,
        slots: {
            ...record.slots,
            [slotId]: {
                ...current,
                id: slotId,
                kind: normalized.kind,
                kindSource: normalized.kindSource,
                url: normalized.url,
                label,
                windowId,
                tabId,
                updatedAt: Date.now()
            }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    const ensured = await ensureTwitchWorkspaceV2Slot(record, slotId, false);
    record = ensured.record;
    if (makeVisible) {
        await chrome.storage.local.set({ rightMode: "twitch", twitchTarget: "resume" });
        if (Number.isInteger(ensured.window?.id)) {
            await chrome.windows.update(ensured.window.id, { focused: true }).catch(() => {});
        }
        raiseTwitchWorkspaceV2NativeCluster(slotId);
    }
    scheduleTwitchWorkspaceV2Claims(record);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    await broadcastState().catch(() => {});
    return record;
}

async function clearTwitchWorkspaceV2Slot(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    const slot = record.slots?.[slotId] || twitchWorkspaceV2EmptySlot(slotId);
    if (record.paneFullscreenSlot === slotId) {
        record = { ...record, paneFullscreenSlot: null, updatedAt: Date.now() };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
        await restoreTwitchWorkspaceV2GridGeometry(record, slotId, true).catch(() => false);
    }
    const liveWindow = await getTwitchWorkspaceV2Window(slot.windowId);
    const tab = liveWindow?.tabs?.find(candidate => candidate.active) || liveWindow?.tabs?.[0] || null;

    const empty = {
        ...twitchWorkspaceV2EmptySlot(slotId),
        audioMuted: slot.audioMuted !== false,
        raidProtectionEnabled: slot.raidProtectionEnabled === true,
        windowId: Number.isInteger(liveWindow?.id) ? liveWindow.id : null,
        tabId: Number.isInteger(tab?.id) ? tab.id : null,
        createdAt: slot.createdAt || Date.now()
    };

    record = {
        ...record,
        selectedSlot: record.selectedSlot === slotId ? "a" : record.selectedSlot,
        slots: { ...record.slots, [slotId]: empty }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, {
            url: twitchWorkspaceV2ControllerUrl(slotId),
            active: true,
            autoDiscardable: false
        }).catch(() => {});
    } else {
        const ensured = await ensureTwitchWorkspaceV2Slot(record, slotId, true);
        record = ensured.record;
    }

    scheduleTwitchWorkspaceV2Claims(record);
    if (Number.isInteger(record.slots?.[slotId]?.windowId)) {
        await chrome.windows.update(record.slots[slotId].windowId, { focused: true }).catch(() => {});
    }
    raiseTwitchWorkspaceV2NativeCluster(slotId);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    await broadcastState().catch(() => {});
    return true;
}

async function setTwitchWorkspaceV2SlotMuted(slotId, muted) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) {
        throw new Error("Invalid Twitch workspace slot.");
    }
    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const desired = muted === true;
    const slot = record.slots?.[slotId];
    if (!slot) throw new Error("Twitch workspace slot is missing.");

    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: { ...slot, audioMuted: desired, updatedAt: Date.now() }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    const tab = await getTwitchWorkspaceV2SlotTab(record.slots[slotId]);
    if (Number.isInteger(tab?.id)) {
        await chrome.tabs.update(tab.id, { muted: desired, autoDiscardable: false }).catch(() => {});
    }
    return desired;
}

async function setTwitchWorkspaceV2SlotRaidProtection(slotId, enabled) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) {
        throw new Error("Invalid Twitch workspace slot.");
    }

    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const slot = record.slots?.[slotId];
    if (!slot) throw new Error("Twitch workspace slot is missing.");

    const desired = enabled === true;
    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: { ...slot, raidProtectionEnabled: desired, updatedAt: Date.now() }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);

    if (!desired) {
        const tab = await getTwitchWorkspaceV2SlotTab(record.slots[slotId]);
        if (Number.isInteger(tab?.id)) {
            await disarmTwitchRaidGuard(tab).catch(() => {});
        }
    }

    return desired;
}

async function reloadTwitchWorkspaceV2Slot(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    const record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");
    const tab = await getTwitchWorkspaceV2SlotTab(record.slots?.[slotId]);
    if (!Number.isInteger(tab?.id)) throw new Error("Twitch workspace slot has no live tab.");
    await chrome.tabs.reload(tab.id);
    await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
    return true;
}

async function toggleTwitchWorkspaceV2PaneFullscreen(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
    let record = await getTwitchWorkspaceV2Record();
    if (!record) throw new Error("Twitch Workspace is not initialized.");

    const currentFullscreen = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(record.paneFullscreenSlot)
        ? record.paneFullscreenSlot
        : null;

    /* Exit the currently expanded member first. This also handles switching
     * directly from one full-pane slot to another without recreating either. */
    if (currentFullscreen) {
        const previous = record.slots?.[currentFullscreen];
        const previousWindowId = previous?.windowId;
        record = { ...record, paneFullscreenSlot: null, updatedAt: Date.now() };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
        if (Number.isInteger(previousWindowId)) {
            await restoreTwitchWorkspaceV2GridGeometry(
                record,
                currentFullscreen,
                currentFullscreen === slotId
            );
        }

        if (currentFullscreen === slotId) {
            raiseTwitchWorkspaceV2NativeCluster(slotId);
            await broadcastState().catch(() => {});
            return { fullscreen: false, slotId };
        }
    }

    const slot = record.slots?.[slotId];
    if (!slot || !Number.isInteger(slot.windowId)) throw new Error("Twitch workspace slot has no live window.");

    record = {
        ...record,
        selectedSlot: slotId,
        paneFullscreenSlot: slotId,
        updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });

    /* Storage changes make Stream slots expose their normal Page chrome before
     * the window grows. The persisted kind itself is untouched, so leaving
     * fullscreen automatically restores Stream cleanup when that was the prior mode. */
    await new Promise(resolve => setTimeout(resolve, 70));
    await applyTwitchWorkspaceV2PaneFullscreenGeometry(record, slotId);
    raiseTwitchWorkspaceV2NativeCluster(slotId);
    await broadcastState().catch(() => {});
    return { fullscreen: true, slotId };
}

async function getTwitchWorkspaceV2Context(windowId) {
    const record = await getTwitchWorkspaceV2Record();
    if (!record || !Number.isInteger(windowId)) return { managed: false };

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return { managed: false };
    const slot = record.slots[slotId];
    const muted = slot.audioMuted !== false;
    const paneFullscreen = record.paneFullscreenSlot === slotId;
    const effectiveKind = paneFullscreen && slot.kind === "stream" ? "page" : slot.kind;

    return {
        managed: true,
        role: "slot",
        slotId,
        selectedSlot: record.selectedSlot || "a",
        kind: slot.kind,
        effectiveKind,
        paneFullscreen,
        kindSource: slot.kindSource || "auto",
        label: slot.label,
        url: slot.url,
        channel: twitchWorkspaceV2ChannelFromUrl(slot.url),
        muted,
        raidControlVisible: await getTwitchSetting("streamShellTwitchPreventRaids", true),
        raidProtectionEnabled: slot.raidProtectionEnabled === true,
        selected: record.selectedSlot === slotId,
        slots: TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => ({
            id,
            kind: record.slots?.[id]?.kind || "empty",
            label: record.slots?.[id]?.label || `Slot ${id.toUpperCase()}`,
            channel: twitchWorkspaceV2ChannelFromUrl(record.slots?.[id]?.url),
            muted: record.slots?.[id]?.audioMuted !== false,
            raidProtectionEnabled: record.slots?.[id]?.raidProtectionEnabled === true
        }))
    };
}

async function syncTwitchWorkspaceV2Location(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) return false;
    const url = String(tab.url || tab.pendingUrl || "");
    if (!isTwitchUrl(url)) return false;

    let record = await getTwitchWorkspaceV2Record();
    if (!record) return false;
    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, tab.windowId);
    if (!slotId) return false;
    const slot = record.slots[slotId];
    if (!slot) return false;

    const kind = slot.kindSource === "explicit" && (slot.kind === "stream" || slot.kind === "page")
        ? slot.kind
        : inferTwitchWorkspaceV2Kind(url);
    const label = twitchWorkspaceV2ChannelFromUrl(url) || (isTwitchDropsUrl(url) ? "Drops" : "Twitch Page");
    if (slot.url === url && slot.kind === kind && slot.tabId === tab.id && slot.label === label) return true;

    record = {
        ...record,
        slots: {
            ...record.slots,
            [slotId]: {
                ...slot,
                url,
                kind,
                label,
                tabId: tab.id,
                updatedAt: Date.now()
            }
        }
    };
    record = await setTwitchWorkspaceV2Record(record, false);
    await syncTwitchWorkspaceV2StreamRefreshAlarms(record).catch(() => {});
    if (!isTwitchDropsUrl(url)) await rememberTwitchContentUrl(url);
    return true;
}

async function reconcileClosedTwitchWorkspaceV2Window(windowId) {
    if (!Number.isInteger(windowId)) return;
    resetTwitchWorkspaceV2ClaimCache(windowId);
    twitchWorkspaceV2ForceRebindIds.delete(windowId);
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return;

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return;
    // Distinguish native claim loss from Opera actually closing a popup.
    // A closed slot is rebuilt on the next deliberate Twitch activation;
    // never launch a new browser window as a side effect of onRemoved.
    void recordFlightEvent({
        source: 'background', category: 'twitch-workspace-v2',
        action: 'slot-window-removed', level: 'warn',
        detail: { slotId, windowId, previousTabId: record.slots?.[slotId]?.tabId ?? null }
    }).catch(() => {});
    record = {
        ...record,
        paneFullscreenSlot: record.paneFullscreenSlot === slotId ? null : record.paneFullscreenSlot,
        slots: {
            ...record.slots,
            [slotId]: { ...record.slots[slotId], windowId: null, tabId: null, updatedAt: Date.now() }
        }
    };
    await setTwitchWorkspaceV2Record(record);
}

async function deactivateTwitchWorkspaceV2(options = {}) {
    const forceMinimize = options.forceMinimize === true;
    const keepActive = await getTwitchSetting("streamShellTwitchKeepActive", true);
    if (!forceMinimize && keepActive) return;

    const record = await getTwitchWorkspaceV2Record();
    if (!record) return;
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        if (Number.isInteger(record.slots?.[id]?.windowId)) {
            await safelyMinimizeWindow(record.slots[id].windowId);
        }
    }
}

async function closeTwitchWorkspaceV2Windows(preserveDefinition = true) {
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return;

    const windowIds = TWITCH_WORKSPACE_V2_SLOT_IDS
        .map(id => record.slots?.[id]?.windowId)
        .filter(Number.isInteger);
    if (Number.isInteger(record.chat?.windowId)) windowIds.push(record.chat.windowId);

    /* Detach runtime ids first. During shutdown onRemoved is suppressed, and this
     * lets all physical windows close concurrently instead of serially waiting
     * for four independent Opera teardown round-trips. */
    if (!preserveDefinition) {
        await chrome.storage.local.remove(TWITCH_WORKSPACE_V2_STORAGE_KEY);
    } else {
        const slots = {};
        for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
            slots[id] = { ...record.slots[id], windowId: null, tabId: null, updatedAt: Date.now() };
        }
        record = {
            ...record,
            lifecycle: TWITCH_WORKSPACE_V2_LIFECYCLE,
            paneFullscreenSlot: null,
            slots,
            chat: null,
            updatedAt: Date.now()
        };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
    }

    for (const windowId of windowIds) {
        resetTwitchWorkspaceV2ClaimCache(windowId);
        twitchWorkspaceV2ForceRebindIds.delete(windowId);
    }
    await Promise.allSettled(windowIds.map(windowId => safelyRemoveWindow(windowId)));
}

function twitchWorkspaceV2SummaryFromRecord(record) {
    if (!record) return { active: false, version: TWITCH_WORKSPACE_V2_VERSION, slots: [] };
    return {
        active: true,
        version: record.version,
        selectedSlot: record.selectedSlot,
        paneFullscreenSlot: record.paneFullscreenSlot || null,
        activationCount: Number(record.activationCount || 0),
        slots: TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => ({
            id,
            kind: record.slots?.[id]?.kind || "empty",
            kindSource: record.slots?.[id]?.kindSource || "auto",
            url: record.slots?.[id]?.url || null,
            label: record.slots?.[id]?.label || `Slot ${id.toUpperCase()}`,
            alive: Number.isInteger(record.slots?.[id]?.windowId),
            controller: (record.slots?.[id]?.kind || "empty") === "empty",
            channel: twitchWorkspaceV2ChannelFromUrl(record.slots?.[id]?.url),
            muted: record.slots?.[id]?.audioMuted !== false,
            raidProtectionEnabled: record.slots?.[id]?.raidProtectionEnabled === true
        }))
    };
}

async function getTwitchWorkspaceV2Summary() {
    return twitchWorkspaceV2SummaryFromRecord(await getTwitchWorkspaceV2Record());
}

async function getTwitchWorkspaceV2Diagnostics() {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return { active: false, version: TWITCH_WORKSPACE_V2_VERSION, windows: [] };
    const rects = getTwitchWorkspaceV2Rects();
    const windows = [];

    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const slot = record.slots?.[id];
        const win = await getTwitchWorkspaceV2Window(slot?.windowId);
        const tab = win?.tabs?.find(candidate => candidate.active) || win?.tabs?.[0] || null;
        let identity = null;
        if (Number.isInteger(tab?.id)) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    href: location.href,
                    timeOrigin: Number.isFinite(performance.timeOrigin) ? Math.round(performance.timeOrigin) : null,
                    navigationType: performance.getEntriesByType("navigation")?.[0]?.type || null,
                    workspaceRole: document.documentElement?.dataset?.streamShellTwitchWorkspaceRole || null,
                    workspaceSlot: document.documentElement?.dataset?.streamShellTwitchWorkspaceSlot || null
                })
            }).catch(() => []);
            identity = results.find(result => result?.result)?.result || null;
        }
        // A short bounded request prevents a throttled Twitch page from
        // blocking the entire diagnostics export indefinitely.
        let twitchRuntime = null;
        let twitchRuntimeStatus = "not-opened";
        if (Number.isInteger(tab?.id) && /^https:\/\/([^/]+\.)?twitch\.tv\//i.test(tab.url || "")) {
            twitchRuntimeStatus = "unresponsive";
            let timeoutId;
            try {
                const response = await Promise.race([
                    chrome.tabs.sendMessage(tab.id, { type: "stream-shell-twitch-runtime-diagnostics" }),
                    new Promise(resolve => { timeoutId = setTimeout(() => resolve(null), 1300); })
                ]);
                if (response?.ok === true && response.runtime) {
                    twitchRuntime = response.runtime;
                    twitchRuntimeStatus = "ok";
                }
            } catch {
                twitchRuntimeStatus = "unavailable";
            } finally {
                clearTimeout(timeoutId);
            }
        }
        windows.push({
            slot: id,
            twitchRuntimeStatus,
            twitchRuntime,
            navigationAudit: getTwitchWorkspaceV2NavigationAudit(tab?.id),
            kind: slot?.kind || "empty",
            kindSource: slot?.kindSource || "auto",
            configuredUrl: slot?.url || null,
            configuredMuted: slot?.audioMuted !== false,
            raidProtectionEnabled: slot?.raidProtectionEnabled === true,
            configuredRect: rects[id],
            id: win?.id || null,
            state: win?.state || null,
            focused: win?.focused === true,
            bounds: win ? { left: win.left, top: win.top, width: win.width, height: win.height } : null,
            nativeClaim: Number.isInteger(slot?.windowId) && twitchWorkspaceV2ClaimStates.has(slot.windowId)
                ? (() => {
                    const claim = twitchWorkspaceV2ClaimStates.get(slot.windowId);
                    return {
                        phase: claim.phase,
                        member: claim.member,
                        sentAgoMs: Math.max(0, Date.now() - claim.sentAt),
                        attempts: claim.attempts,
                        forceRebindPending: twitchWorkspaceV2ForceRebindIds.has(slot.windowId),
                        acknowledgedAgoMs: claim.acknowledgedAt
                            ? Math.max(0, Date.now() - claim.acknowledgedAt)
                            : null
                    };
                })()
                : null,
            documentIdentity: identity,
            tab: tab ? {
                id: tab.id,
                status: tab.status,
                url: tab.url || tab.pendingUrl || null,
                title: tab.title || null,
                audible: tab.audible === true,
                muted: tab.mutedInfo?.muted === true,
                discarded: tab.discarded === true,
                autoDiscardable: tab.autoDiscardable !== false
            } : null
        });
    }

    const surfaceState = await chrome.storage.local.get("rightMode").catch(() => ({}));

    return {
        active: true,
        version: record.version,
        lifecycle: record.lifecycle,
        paneFullscreenSlot: record.paneFullscreenSlot || null,
        visible: surfaceState.rightMode === "twitch",
        covered: surfaceState.rightMode !== "twitch",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        selectedSlot: record.selectedSlot,
        activationCount: Number(record.activationCount || 0),
        nativeClusterMembers: Number.isInteger(titlebarLastNativeStatus?.twitchClusterMembers)
            ? titlebarLastNativeStatus.twitchClusterMembers
            : null,
        nativeClusterMap: titlebarLastNativeStatus?.twitchClusterMap || null,
        layout: { rightPane: { ...RIGHT }, ...rects },
        windows
    };
}

chrome.alarms.onAlarm.addListener(alarm => {
    handleTwitchWorkspaceV2StreamRefreshAlarm(alarm).catch(() => {});
});

/* Alarms normally persist, but Chromium does not guarantee that across every
 * browser restart/update. Reconcile them whenever the service worker starts. */
getTwitchWorkspaceV2Record()
    .then(record => syncTwitchWorkspaceV2StreamRefreshAlarms(record))
    .catch(() => {});

