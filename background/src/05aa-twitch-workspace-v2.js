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
 * No content window is resized after creation. Reassigning a slot navigates the
 * existing tab by explicit user action; showing the workspace is z-order only.
 */

const TWITCH_WORKSPACE_V2_VERSION = 6;
const TWITCH_WORKSPACE_V2_LIFECYCLE = "direct-final-geometry-4slot+persistent-controllers+caption-overlap-20+chatless-audio+event-claims+surface-wake";
const TWITCH_WORKSPACE_V2_SLOT_IDS = ["a", "b", "c", "d"];
const TWITCH_WORKSPACE_V2_CAPTION_OVERLAP = 20;

function twitchWorkspaceV2EmptySlot(id) {
    return {
        id,
        kind: "empty",
        kindSource: "auto",
        url: null,
        label: `Slot ${id.toUpperCase()}`,
        audioMuted: true,
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

const twitchWorkspaceV2ClaimedWindowIds = new Set();

function resetTwitchWorkspaceV2ClaimCache(windowId = null) {
    if (Number.isInteger(windowId)) {
        twitchWorkspaceV2ClaimedWindowIds.delete(windowId);
        return;
    }
    twitchWorkspaceV2ClaimedWindowIds.clear();
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
    if (twitchWorkspaceV2ClaimedWindowIds.has(windowId)) return true;
    if (!titlebarPort) await ensureTitlebarNative();
    if (!titlebarPort || !titlebarProtocolReady) return false;

    try {
        const win = await chrome.windows.get(windowId, { populate: true });
        if (!Number.isInteger(win?.id) || win.state === "minimized") return false;
        const tab = win.tabs?.find(candidate => candidate.active) || win.tabs?.[0] || null;
        const titleHint = typeof tab?.title === "string" ? tab.title.trim().slice(0, 180) : "";
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
        /* The native claim keeps retrying its HWND match after this post. Avoid
         * re-queuing the same A-D claim on every Twitch title/SPA update. */
        twitchWorkspaceV2ClaimedWindowIds.add(windowId);
        return true;
    } catch {
        return false;
    }
}

let twitchWorkspaceV2ClaimGeneration = 0;

function scheduleTwitchWorkspaceV2Claims(record) {
    const generation = ++twitchWorkspaceV2ClaimGeneration;
    const rects = getTwitchWorkspaceV2Rects();
    const members = [];
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const windowId = record?.slots?.[id]?.windowId;
        if (Number.isInteger(windowId)) members.push({ member: id, windowId, rect: rects[id] });
    }
    /*
     * Claim at most twice. 0.19.1 could manufacture 9 claim waves and every
     * delayed z-order retry scheduled another 9-wave batch, which turned one
     * click into a native-message storm. The first pass catches controller and
     * already-loaded Twitch windows; the second catches slow Twitch titles.
     */
    for (const delay of [0, 700]) {
        setTimeout(() => {
            if (shuttingDown || generation !== twitchWorkspaceV2ClaimGeneration) return;
            Promise.all(
                members.map(entry =>
                    claimTwitchWorkspaceV2Window(entry.windowId, entry.member, entry.rect)
                        .catch(() => false)
                )
            ).catch(() => {});
        }, delay);
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

async function raiseTwitchWorkspaceV2(record, preferredSlot = null) {
    let next = record;
    const live = [];

    /* Ensure each cell exists, but do not focus A -> B -> C -> D. The old
     * focus carousel was visible to Windows/Opera and was the main source of
     * compositor/titlebar thrash in 0.19.1. */
    for (const id of TWITCH_WORKSPACE_V2_SLOT_IDS) {
        const ensured = await ensureTwitchWorkspaceV2Slot(next, id, false);
        next = ensured.record;
        if (Number.isInteger(ensured.window?.id)) live.push({ id, windowId: ensured.window.id });
    }

    const focusId = TWITCH_WORKSPACE_V2_SLOT_IDS.includes(preferredSlot)
        ? preferredSlot
        : (TWITCH_WORKSPACE_V2_SLOT_IDS.includes(next.selectedSlot) ? next.selectedSlot : live[0]?.id);
    const selected = live.find(entry => entry.id === focusId) || live[0] || null;

    /* One browser focus transition only. The native helper raises the other
     * already-claimed members once, without activation or geometry changes. */
    if (selected) {
        await chrome.windows.update(selected.windowId, { focused: true }).catch(() => {});
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

async function showTwitchWorkspaceV2(target = "workspace") {
    if (shuttingDown) return null;
    const profile = await getStreamShellDisplayProfile().catch(() => null);
    if (profile?.mode === "compact") {
        throw new Error("Twitch Workspace is available from the Wide Landing layout.");
    }

    await ensureDashboardWindow();
    const surfaceBeforeShow = await chrome.storage.local.get("rightMode").catch(() => ({}));
    if (surfaceBeforeShow.rightMode === "discord") {
        await hideDiscordForDashboard();
    }

    let record = await migrateIntoTwitchWorkspaceV2();
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

    const coldStart = !TWITCH_WORKSPACE_V2_SLOT_IDS.every(
        id => Number.isInteger(record.slots?.[id]?.windowId)
    );

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

    record = await raiseTwitchWorkspaceV2(record, preferredSlot);
    scheduleTwitchWorkspaceV2Claims(record);
    scheduleTwitchWorkspaceV2SurfaceWake(record, preferredSlot, coldStart);

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

    await broadcastState();
    return getTwitchWorkspaceV2Diagnostics();
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
    await broadcastState().catch(() => {});
    return record;
}

async function clearTwitchWorkspaceV2Slot(slotId) {
    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) return false;
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return false;

    const slot = record.slots?.[slotId] || twitchWorkspaceV2EmptySlot(slotId);
    const liveWindow = await getTwitchWorkspaceV2Window(slot.windowId);
    const tab = liveWindow?.tabs?.find(candidate => candidate.active) || liveWindow?.tabs?.[0] || null;

    const empty = {
        ...twitchWorkspaceV2EmptySlot(slotId),
        audioMuted: slot.audioMuted !== false,
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

async function getTwitchWorkspaceV2Context(windowId) {
    const record = await getTwitchWorkspaceV2Record();
    if (!record || !Number.isInteger(windowId)) return { managed: false };

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return { managed: false };
    const slot = record.slots[slotId];
    const muted = slot.audioMuted !== false;

    return {
        managed: true,
        role: "slot",
        slotId,
        selectedSlot: record.selectedSlot || "a",
        kind: slot.kind,
        kindSource: slot.kindSource || "auto",
        label: slot.label,
        url: slot.url,
        channel: twitchWorkspaceV2ChannelFromUrl(slot.url),
        muted,
        selected: record.selectedSlot === slotId,
        slots: TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => ({
            id,
            kind: record.slots?.[id]?.kind || "empty",
            label: record.slots?.[id]?.label || `Slot ${id.toUpperCase()}`,
            channel: twitchWorkspaceV2ChannelFromUrl(record.slots?.[id]?.url),
            muted: record.slots?.[id]?.audioMuted !== false
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
    await setTwitchWorkspaceV2Record(record, false);
    if (!isTwitchDropsUrl(url)) await rememberTwitchContentUrl(url);
    return true;
}

async function reconcileClosedTwitchWorkspaceV2Window(windowId) {
    if (!Number.isInteger(windowId)) return;
    resetTwitchWorkspaceV2ClaimCache(windowId);
    let record = await getTwitchWorkspaceV2Record();
    if (!record) return;

    const slotId = getTwitchWorkspaceV2SlotByWindowId(record, windowId);
    if (!slotId) return;
    record = {
        ...record,
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
            slots,
            chat: null,
            updatedAt: Date.now()
        };
        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
    }

    for (const windowId of windowIds) resetTwitchWorkspaceV2ClaimCache(windowId);
    await Promise.allSettled(windowIds.map(windowId => safelyRemoveWindow(windowId)));
}

async function getTwitchWorkspaceV2Summary() {
    const record = await getTwitchWorkspaceV2Record();
    if (!record) return { active: false, version: TWITCH_WORKSPACE_V2_VERSION, slots: [] };
    return {
        active: true,
        version: record.version,
        selectedSlot: record.selectedSlot,
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
            muted: record.slots?.[id]?.audioMuted !== false
        }))
    };
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
        windows.push({
            slot: id,
            kind: slot?.kind || "empty",
            kindSource: slot?.kindSource || "auto",
            configuredUrl: slot?.url || null,
            configuredMuted: slot?.audioMuted !== false,
            configuredRect: rects[id],
            id: win?.id || null,
            state: win?.state || null,
            focused: win?.focused === true,
            bounds: win ? { left: win.left, top: win.top, width: win.width, height: win.height } : null,
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
