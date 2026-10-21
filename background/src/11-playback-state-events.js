async function reconcileCompactFocusedSurface(
    focusedWindowId
) {
    if (
        shuttingDown ||
        streamShellDisplayProfileCache?.mode !==
            "compact" ||
        !Number.isInteger(
            focusedWindowId
        ) ||
        focusedWindowId ===
            chrome.windows.WINDOW_ID_NONE
    ) {
        return false;
    }

    const state =
        await chrome.storage.local.get([
            "providerWindows",
            "dashboardWindowId",
            "activeProvider",
            "leftMode"
        ]);

    const providerWindows =
        state.providerWindows ||
        {};

    /*
     * Dashboard is a Compact Home surface. If Windows activates it while
     * a provider is still the intended surface, that is not a user navigation
     * request; restore the intended provider immediately instead of rewriting
     * leftMode to Dashboard.
     */
    if (
        focusedWindowId ===
            state.dashboardWindowId
    ) {
        const intendedProvider =
            PROVIDERS[state.leftMode]
                ? state.leftMode
                : null;

        const intendedWindowId =
            intendedProvider
                ? providerWindows[
                    intendedProvider
                ]
                : null;

        if (
            intendedProvider &&
            Number.isInteger(
                intendedWindowId
            )
        ) {
            try {
                const intendedWindow =
                    await chrome.windows.get(
                        intendedWindowId
                    );

                if (
                    intendedWindow?.state !== "minimized" ||
                    compactProviderActivationIsArmed(intendedWindowId)
                ) {
                    await restoreWindow(
                        intendedWindowId,
                        LEFT,
                        true
                    );

                    return true;
                }
            } catch {
            }
        }

        if (
            state.leftMode !==
                "dashboard"
        ) {
            await chrome.storage.local.set({
                leftMode:
                    "dashboard"
            });
        }

        return false;
    }

    const focusedProviderEntry =
        Object.entries(
            providerWindows
        )
            .find(
                ([provider, windowId]) =>
                    PROVIDERS[provider] &&
                    windowId ===
                        focusedWindowId
            );

    if (
        !focusedProviderEntry
    ) {
        /* A normal Opera/browser window is not Stream Shell. Preserve intent. */
        return false;
    }

    const focusedProvider =
        focusedProviderEntry[0];

    clearCompactProviderActivation(focusedWindowId);

    if (
        state.leftMode !==
            focusedProvider ||
        state.activeProvider !==
            focusedProvider
    ) {
        await chrome.storage.local.set({
            activeProvider:
                focusedProvider,
            leftMode:
                focusedProvider
        });
    }

    return false;
}


async function reconcileProviderPlaybackWindows() {
    if (
        shuttingDown
    ) {
        return;
    }


    const providerWindows =
        await getProviderWindows();

    const keysToRemove =
        [];


    for (
        const [provider, windowId]
        of Object.entries(
            providerWindows
        )
    ) {
        try {
            const window =
                await chrome.windows.get(
                    windowId
                );


            if (
                window.state ===
                    "minimized"
            ) {
                keysToRemove.push(
                    `streamShellNowPlaying_${provider}`
                );
            }

        } catch {
            keysToRemove.push(
                `streamShellNowPlaying_${provider}`
            );
        }
    }


    if (
        keysToRemove.length
    ) {
        await chrome.storage.local.remove(
            keysToRemove
        );
    }
}


async function broadcastState() {
    if (
        shuttingDown
    ) {
        return;
    }

    const [
        state,
        landingExposed,
        titlebarVisibilityMode
    ] =
        await Promise.all([
            chrome.storage.local.get([
                "activeProvider",
                "leftMode",
                "rightMode",
                "twitchTarget"
            ]),
            isLandingExposed(),
            getTitlebarVisibilityMode()
        ]);

    if (
        shuttingDown
    ) {
        return;
    }

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    // Broadcasts can overlap (Twitch claims, provider focus, titlebar).
    // The final native state must use the latest persisted pane selection.
    const nativeIntent = await chrome.storage.local.get(["leftMode", "rightMode", "twitchTarget"]);
    sendTitlebarState(
        nativeIntent.leftMode || "landing",
        nativeIntent.rightMode || "dashboard",
        titlebarVisibilityMode,
        nativeIntent.twitchTarget || "resume"
    );

    const twitchWorkspace =
        await getTwitchWorkspaceV2Summary().catch(() => ({ active: false, slots: [] }));

    try {
        await chrome.runtime.sendMessage({
            type:
                "state-changed",

            activeProvider:
                state.activeProvider ||
                "netflix",

            leftMode:
                state.leftMode ||
                "landing",

            rightMode:
                state.rightMode ||
                "dashboard",

            twitchTarget:
                state.twitchTarget ||
                "resume",

            twitchWorkspace,

            landingExposed
        });
    } catch {
    }

    broadcastProviderResourceWindowStates()
        .catch(() => {});
}


/* v0.20.3: The A-D windows are already launched and native chrome is
 * synchronized before this runs. Use one cheap storage snapshot to update
 * Landing/Dashboard, without repeating browser-wide window enumeration or
 * awaiting UI message delivery under the global window-transition lock.
 * The full broadcastState() remains the authoritative reconciliation path. */
async function broadcastTwitchWorkspaceV2LaunchState(record) {
    if (shuttingDown) return;
    const startedAt = Date.now();
    const state = await chrome.storage.local.get([
        "activeProvider", "leftMode", "rightMode", "twitchTarget"
    ]);
    if (shuttingDown) return;
    try {
        const notification = chrome.runtime.sendMessage({
            type: "state-changed",
            activeProvider: state.activeProvider || "netflix",
            leftMode: state.leftMode || "landing",
            rightMode: state.rightMode || "dashboard",
            twitchTarget: state.twitchTarget || "resume",
            twitchWorkspace: twitchWorkspaceV2SummaryFromRecord(record),
            /* The left landing pane is normally exposed only in landing mode.
             * Accurate window-occlusion checks remain in the normal broadcast. */
            landingExposed: (state.leftMode || "landing") === "landing"
        });
        if (notification && typeof notification.catch === "function") {
            notification.catch(() => {});
        }
    } catch (error) {
        recordFlightEvent({
            category: "twitch-workspace-v2", action: "launch-notify-failed", level: "warn",
            detail: { error: String(error?.message || error).slice(0, 160) }
        }).catch(() => {});
    }
    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
        recordFlightEvent({
            category: "twitch-workspace-v2", action: "slow-launch-notify",
            level: "warn", detail: { durationMs }
        }).catch(() => {});
    }
}

/* Twitch changes tab titles frequently (unread chat counters). Those title
 * updates must NOT trigger storage reads and native HWND reclaims. */
const shellTitlebarClaimedTabs = new Map();
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (shuttingDown || tab?.active !== true ||
        !Number.isInteger(tab?.windowId) || changeInfo?.status !== 'complete') return;
    const windowId = tab.windowId;
    if (shellTitlebarClaimedTabs.get(windowId) === tabId) return;
    shellTitlebarClaimedTabs.set(windowId, tabId);
    // A new window/tab is a real identity change. This branch is intentionally
    // independent of hot focus/bounds listeners.
    isTwitchWorkspaceV2WindowId(windowId)
        .then(isWorkspaceWindow => isWorkspaceWindow
            ? claimTwitchWorkspaceV2WindowById(windowId)
            : claimFocusedTitlebarSurface(windowId))
        .catch(() => { shellTitlebarClaimedTabs.delete(windowId); });
});


/* v0.20.8 EMERGENCY: Focus/Bounds must never await storage/renderer/native
 * probes in Wide mode. Maintain a tiny in-memory mirror from storage events.
 * It may be temporarily stale after a cold worker wake: that's safer than
 * blocking all browser UI for 15-40 seconds on a single focus callback.
 * Explicit navigation and the native helper still perform real reconciliation. */
const shellWideFocusCacheKeys = [
    'providerWindows', 'landingWindowId', 'dashboardWindowId',
    TWITCH_WINDOW_STORAGE_KEY, TWITCH_WORKSPACE_V2_STORAGE_KEY,
    'leftMode', 'rightMode', 'activeProvider', 'twitchTarget',
    'streamShellLaunchSelfTest'
];
const shellWideFocusCache = Object.create(null);
let shellWideFocusCacheReady = false;
let shellWideFocusVisibility = null;
let shellWideFocusEventCount = 0;
let shellWideFocusLastId = null;
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of shellWideFocusCacheKeys) {
        if (Object.prototype.hasOwnProperty.call(changes, key)) {
            shellWideFocusCache[key] = changes[key].newValue;
        }
    }
});
void chrome.storage.local.get(shellWideFocusCacheKeys).then(initial => {
    // Do not overwrite more recent onChanged updates with an old read response.
    for (const key of shellWideFocusCacheKeys) {
        if (!Object.prototype.hasOwnProperty.call(shellWideFocusCache, key)) {
            shellWideFocusCache[key] = initial[key];
        }
    }
    shellWideFocusCacheReady = true;
}).catch(() => { /* Initial cache is best-effort; explicit navigation still works. */ });

/* In Wide mode, restore the tiny but important functional side effects that
 * v0.20.8 removed from focus reconciliation: selected Twitch slot and provider
 * focus flags. Both are driven by browser event IDs already in memory. */
let shellWideLastSelectedSlot = null;
let shellWideSlotPersisting = false;
let shellWideSlotPending = null;
function rememberShellWideSelectedSlot(record, slotId) {
    if (!record || record.selectedSlot === slotId) return;
    shellWideFocusCache[TWITCH_WORKSPACE_V2_STORAGE_KEY] = {
        ...record, selectedSlot: slotId, updatedAt: Date.now()
    };
    shellWideSlotPending = slotId;
    if (shellWideSlotPersisting) return;
    shellWideSlotPersisting = true;
    void (async () => {
        while (shellWideSlotPending && !shuttingDown) {
            const selected = shellWideSlotPending;
            shellWideSlotPending = null;
            const current = shellWideFocusCache[TWITCH_WORKSPACE_V2_STORAGE_KEY];
            if (!current) break;
            try {
                await chrome.storage.local.set({
                    [TWITCH_WORKSPACE_V2_STORAGE_KEY]: {
                        ...current, selectedSlot:selected, updatedAt:Date.now()
                    }
                });
            } catch { /* Explicit slot navigation still provides recovery. */ }
        }
        shellWideSlotPersisting = false;
    })();
}

const shellWideObservedTabs = new Map(); // windowId -> last observed active tabId
let shellWideResourceNotifyPending = null;
let shellWideResourceNotifyInFlight = false;
let shellWideResourceLastFocused = null;
chrome.tabs.onUpdated.addListener((tabId, _change, tab) => {
    if (tab?.active === true && Number.isInteger(tab.windowId)) {
        shellWideObservedTabs.set(tab.windowId, tabId);
    }
});
chrome.tabs.onActivated.addListener(({tabId,windowId}) => {
    if (Number.isInteger(windowId) && Number.isInteger(tabId)) {
        shellWideObservedTabs.set(windowId,tabId);
    }
});
chrome.windows.onRemoved.addListener(windowId => shellWideObservedTabs.delete(windowId));

function notifyShellWideProviderFocus(state, focusedWindowId) {
    const previous = shellWideResourceLastFocused;
    shellWideResourceLastFocused = focusedWindowId;
    shellWideResourceNotifyPending = {state, focusedWindowId, previous};
    if (shellWideResourceNotifyInFlight) return;
    shellWideResourceNotifyInFlight = true;
    void (async () => {
        try {
            while (shellWideResourceNotifyPending && !shuttingDown) {
                const next = shellWideResourceNotifyPending;
                shellWideResourceNotifyPending = null;
                const windows = next.state.providerWindows || {};
                const messages = [];
                for (const [provider,windowId] of Object.entries(windows)) {
                    if (windowId !== next.focusedWindowId && windowId !== next.previous) continue;
                    const tabId = shellWideObservedTabs.get(windowId);
                    if (!Number.isInteger(tabId)) continue;
                    messages.push(chrome.tabs.sendMessage(tabId, {
                        type:'stream-shell-resource-window-state',
                        state:{managed:true,provider,windowId,
                            focused:windowId === next.focusedWindowId,
                            shellActive:next.state.leftMode === provider,
                            activeProvider:next.state.activeProvider || null,
                            leftMode:next.state.leftMode || 'landing'}
                    }).catch(() => {}));
                }
                // Bounded: at most one provider-focus batch outstanding.
                if (messages.length) await Promise.allSettled(messages);
            }
        } finally { shellWideResourceNotifyInFlight = false; }
    })();
}

function reconcileShellWideFocusFast(focusedWindowId) {
    shellWideFocusEventCount += 1;
    shellWideFocusLastId = focusedWindowId;
    if (shuttingDown || !shellWideFocusCacheReady) return;
    const state = shellWideFocusCache;
    const record = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
    const managed = new Set([
        state.landingWindowId, state.dashboardWindowId, state[TWITCH_WINDOW_STORAGE_KEY],
        ...Object.values(state.providerWindows || {}),
        ...['a','b','c','d'].map(slot => record?.slots?.[slot]?.windowId),
        record?.chat?.windowId
    ].filter(Number.isInteger));
    const visibility = managed.has(focusedWindowId) ? 'shell' :
        (focusedWindowId === chrome.windows.WINDOW_ID_NONE && state.rightMode === 'discord' ? 'discord' : 'none');
    const slot = ['a','b','c','d'].find(id => record?.slots?.[id]?.windowId === focusedWindowId);
    if (slot) {
        if (record?.selectedSlot !== slot) rememberShellWideSelectedSlot(record, slot);
        if (shellWideLastSelectedSlot !== slot) {
            shellWideLastSelectedSlot = slot;
            raiseTwitchWorkspaceV2NativeCluster(slot);
        }
    } else {
        shellWideLastSelectedSlot = null;
    }
    notifyShellWideProviderFocus(state, focusedWindowId);
    // Only notify native when the visibility actually changes. The full
    // state sender also deduplicates identical payloads.
    if (visibility !== shellWideFocusVisibility) {
        shellWideFocusVisibility = visibility;
        sendTitlebarState(state.leftMode || 'landing', state.rightMode || 'dashboard',
            visibility, state.twitchTarget || 'resume');
    }
}

/* v0.20.5: Chromium may emit a cluster of focus + geometry events for a
 * single Stream Shell transition. Before this change EVERY event launched a
 * separate, unbounded async chain (provider enumeration, Discord native status,
 * titlebar claim, and a full broadcast with browser-wide window enumeration).
 * During Twitch cold start / heavy rendering these overlapped and amplified
 * browser-process contention. Keep only latest focus and distinct changed HWNDs;
 * run at most ONE reconciliation batch at a time. All purposeful navigation
 * and Twitch chat/automation remain on their original independent paths. */
const STREAM_SHELL_WINDOW_EVENT_SETTLE_MS = 110;
let shellWindowEventFocusId = null;
const shellWindowEventBounds = new Set();
let shellWindowEventTimer = null;
let shellWindowEventRunning = false;
let shellWindowEventPendingCount = 0;
let shellUnmanagedResourceSyncPromise = null;

function scheduleShellUnmanagedResourceSync() {
    /* Focus storms must not create unbounded fire-and-forget provider messages. */
    if (shuttingDown || shellUnmanagedResourceSyncPromise) return;
    shellUnmanagedResourceSyncPromise = Promise.resolve()
        .then(() => broadcastProviderResourceWindowStates())
        .catch(error => {
            recordFlightEvent({ category:'window-events',action:'resource-sync-failed',
                level:'warn',detail:{message:String(error?.message || error).slice(0,180)}
            }).catch(() => {});
        })
        .finally(() => { shellUnmanagedResourceSyncPromise = null; });
}

/* v0.20.7: Focus is NOT a reason to run the expensive authoritative
 * broadcastState(): it performs multiple storage reads, browser-wide window
 * enumeration, optional native foreground checks and waits for UI responses.
 * Under Opera load even a single focus notification blocked for 22.8 seconds.
 * Use the record already read for focus to notify the UI; keep one outstanding
 * response and replace pending notifications with the newest snapshot. */
let shellWindowUiNotifyRunning = false;
let shellWindowUiNotifyLatest = null;
function notifyShellWindowEventFromSnapshot(state, focusedWindowId) {
    if (shuttingDown || !state) return;
    const leftMode = state.leftMode || 'landing';
    const rightMode = state.rightMode || 'dashboard';
    const landingExposed = leftMode === 'landing' && (
        focusedWindowId === state.landingWindowId ||
        focusedWindowId === state.dashboardWindowId ||
        (rightMode === 'twitch' && getTwitchWorkspaceV2SlotByWindowId(
            state[TWITCH_WORKSPACE_V2_STORAGE_KEY], focusedWindowId))
    );
    shellWindowUiNotifyLatest = {
        message: {
        type: 'state-changed',
        activeProvider: state.activeProvider || 'netflix',
        leftMode, rightMode,
        twitchTarget: state.twitchTarget || 'resume',
        twitchWorkspace: twitchWorkspaceV2SummaryFromRecord(state[TWITCH_WORKSPACE_V2_STORAGE_KEY]),
        landingExposed: !!landingExposed
        }, queuedAt: Date.now()
    };
    if (shellWindowUiNotifyRunning) return;
    shellWindowUiNotifyRunning = true;
    void (async () => {
        while (shellWindowUiNotifyLatest && !shuttingDown) {
            const queued = shellWindowUiNotifyLatest;
            shellWindowUiNotifyLatest = null;
            // A delayed old focus reply must not overwrite an explicit provider
            // transition that happened while Opera's UI responder was stalled.
            if (Date.now() - queued.queuedAt > 1800) continue;
            try { await chrome.runtime.sendMessage(queued.message); }
            catch { /* Other pages may not yet have registered a listener. */ }
        }
    })().finally(() => { shellWindowUiNotifyRunning = false; });
}

let shellProviderPlaybackReconcileRunning = false;
function scheduleShellProviderPlaybackReconcile() {
    if (shuttingDown || shellProviderPlaybackReconcileRunning) return;
    shellProviderPlaybackReconcileRunning = true;
    void reconcileProviderPlaybackWindows()
        .catch(error => recordFlightEvent({category:'window-events',action:'playback-scan-failed',
            level:'warn',detail:{message:String(error?.message || error).slice(0,160)}}).catch(()=>{}))
        .finally(() => { shellProviderPlaybackReconcileRunning = false; });
}

function scheduleShellWindowEventReconcile(focusedWindowId = null, boundsWindowId = null) {
    if (shuttingDown) return;
    if (Number.isInteger(focusedWindowId)) shellWindowEventFocusId = focusedWindowId;
    if (Number.isInteger(boundsWindowId)) shellWindowEventBounds.add(boundsWindowId);
    shellWindowEventPendingCount += 1;
    if (shellWindowEventRunning || shellWindowEventTimer !== null) return;
    shellWindowEventTimer = setTimeout(() => {
        shellWindowEventTimer = null;
        drainShellWindowEventReconcile().catch(error => {
            recordFlightEvent({
                category: 'window-events', action: 'drain-failed', level: 'error',
                detail: { message: String(error?.message || error).slice(0, 180) }
            }).catch(() => {});
        });
    }, STREAM_SHELL_WINDOW_EVENT_SETTLE_MS);
}

async function reconcileShellFocusedWindow(focusedWindowId) {
    const startedAt = Date.now();
    const state = await chrome.storage.local.get([
        'providerWindows', 'landingWindowId', 'dashboardWindowId',
        TWITCH_WINDOW_STORAGE_KEY, TWITCH_WORKSPACE_V2_STORAGE_KEY,
        'leftMode', 'rightMode', 'activeProvider', 'twitchTarget'
    ]);
    const storageMs = Date.now() - startedAt;
    const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
    const workspaceWindowIds = [
        workspaceRecord?.slots?.a?.windowId,
        workspaceRecord?.slots?.b?.windowId,
        workspaceRecord?.slots?.c?.windowId,
        workspaceRecord?.slots?.d?.windowId,
        workspaceRecord?.chat?.windowId
    ];
    const workspaceSlotId = getTwitchWorkspaceV2SlotByWindowId(workspaceRecord, focusedWindowId);
    const workspaceChatFocused = workspaceRecord?.chat?.windowId === focusedWindowId;
    if (workspaceSlotId || workspaceChatFocused) {
        if (workspaceSlotId && workspaceRecord?.selectedSlot !== workspaceSlotId) {
            await chrome.storage.local.set({
                [TWITCH_WORKSPACE_V2_STORAGE_KEY]: {
                    ...workspaceRecord, selectedSlot: workspaceSlotId, updatedAt: Date.now()
                }
            }).catch(() => {});
        }
        /* A normal Opera window may have set native visibility to 'none'.
         * Re-entering directly through a Twitch pane must restore it. */
        sendTitlebarState(state.leftMode || 'landing', state.rightMode || 'dashboard',
            'shell', state.twitchTarget || 'resume');
        raiseTwitchWorkspaceV2NativeCluster(workspaceSlotId || workspaceRecord?.selectedSlot || 'a');
        notifyShellWindowEventFromSnapshot(state, focusedWindowId);
        scheduleShellUnmanagedResourceSync();
        return false; // A-D focus is not a global provider state transition
    }

    const managedWindowIds = new Set([
        state.landingWindowId, state.dashboardWindowId, state[TWITCH_WINDOW_STORAGE_KEY],
        ...workspaceWindowIds, ...Object.values(state.providerWindows || {})
    ].filter(Number.isInteger));
    const isManaged = managedWindowIds.has(focusedWindowId);
    if (!isManaged) {
        /* Ordinary Opera windows and WINDOW_ID_NONE (when WuWa or another
         * desktop app has focus) are NOT Shell navigation. They previously
         * triggered full provider scans, native tab-title claims and two
         * browser-wide enumeration passes through broadcastState(). Avoid
         * that work, but still hide managed titlebar chrome and update the
         * provider governor's focused-state asynchronously. */
        // Cancel only generic provider claim retries. Native claim-cancel is global
        // and would also discard pending Twitch A-D HWND claims while Opera/WuWa
        // receives focus. The helper's own state message hides the chrome.
        cancelTitlebarClaimRetries(false);
        const nativeVisibility = focusedWindowId === chrome.windows.WINDOW_ID_NONE &&
            state.rightMode === 'discord' ? 'discord' : 'none';
        sendTitlebarState(
            state.leftMode || 'landing', state.rightMode || 'dashboard',
            nativeVisibility, state.twitchTarget || 'resume'
        );
        scheduleShellUnmanagedResourceSync();
        notifyShellWindowEventFromSnapshot(state, focusedWindowId);
        if (storageMs >= 500) recordFlightEvent({
            category:'window-events',action:'focus-phase',level:'warn',
            detail:{kind:'unmanaged',storageMs,fullReconcileSkipped:true}
        }).catch(()=>{});
        return false;
    }

    const compactStarted = Date.now();
    await reconcileCompactFocusedSurface(focusedWindowId);
    const compactMs = Date.now() - compactStarted;
    /* Some managed windows may have been closed while an event was queued;
     * original browser-backed operations must continue to validate identity. */
    const operationsStarted = Date.now();
    // The provider playback scan is a window-lifecycle concern. Scanning all
    // provider windows on every focus click amplifies Opera's API backlog.
    const operations = [claimFocusedTitlebarSurface(focusedWindowId)];
    if (state.rightMode === 'discord') operations.push(syncDiscordVisibilityState());
    const results = await Promise.allSettled(operations);
    const operationsMs = Date.now() - operationsStarted;
    for (const result of results) {
        if (result.status === 'rejected') {
            recordFlightEvent({
                category: 'window-events', action: 'focus-reconcile-failed', level: 'warn',
                detail: { message: String(result.reason?.message || result.reason).slice(0, 180) }
            }).catch(() => {});
        }
    }
    if (streamShellDisplayProfileCache?.mode !== 'compact') {
        // Switching back from ordinary Opera/WuWa must restore native visibility.
        sendTitlebarState(state.leftMode || 'landing', state.rightMode || 'dashboard',
            'shell', state.twitchTarget || 'resume');
        notifyShellWindowEventFromSnapshot(state, focusedWindowId);
        scheduleShellUnmanagedResourceSync();
    }
    if (Date.now() - startedAt >= 400) recordFlightEvent({
        category:'window-events',action:'focus-phase',
        level: Date.now()-startedAt > 2000 ? 'warn' : 'info',
        detail:{kind:'managed',storageMs,compactMs,operationsMs,
            totalMs:Date.now()-startedAt,discordQueried:state.rightMode==='discord'}
    }).catch(()=>{});
    // Compact can change its active provider on focus and still requires an
    // authoritative pane update; Wide focus has already sent a cheap snapshot.
    return streamShellDisplayProfileCache?.mode === 'compact';
}

async function drainShellWindowEventReconcile() {
    if (shellWindowEventRunning || shuttingDown) return;
    shellWindowEventRunning = true;
    const focusedWindowId = shellWindowEventFocusId;
    const boundsIds = [...shellWindowEventBounds];
    const eventCount = shellWindowEventPendingCount;
    shellWindowEventFocusId = null;
    shellWindowEventBounds.clear();
    shellWindowEventPendingCount = 0;
    const startedAt = Date.now();
    let focusMs = 0;
    let boundsMs = 0;
    let broadcastMs = 0;
    try {
        let shouldBroadcast = false;
        if (Number.isInteger(focusedWindowId)) {
            const focusStarted = Date.now();
            try {
                shouldBroadcast = await reconcileShellFocusedWindow(focusedWindowId);
            } catch (error) {
                shouldBroadcast = streamShellDisplayProfileCache?.mode === 'compact';
                recordFlightEvent({
                    category: 'window-events', action: 'focus-failed', level: 'warn',
                    detail: { message: String(error?.message || error).slice(0, 180) }
                }).catch(() => {});
            } finally {
                focusMs = Date.now() - focusStarted;
            }
        }
        if (boundsIds.length) {
            const boundsStarted = Date.now();
            // A single snapshot replaces N storage reads for N changed windows.
            // Ignore unrelated Opera windows; moving or resizing them is not a
            // Stream Shell navigation event. Native geometry has its own loop.
            const stored = await chrome.storage.local.get([
                'providerWindows', 'landingWindowId', 'dashboardWindowId',
                TWITCH_WINDOW_STORAGE_KEY, TWITCH_WORKSPACE_V2_STORAGE_KEY,
                'leftMode', 'rightMode', 'activeProvider', 'twitchTarget'
            ]);
            const managedNonTwitch = new Set([
                stored.landingWindowId, stored.dashboardWindowId,
                stored[TWITCH_WINDOW_STORAGE_KEY],
                ...Object.values(stored.providerWindows || {})
            ].filter(Number.isInteger));
            const relevantBounds = boundsIds.some(id => managedNonTwitch.has(id));
            if (relevantBounds) {
                scheduleShellProviderPlaybackReconcile();
                if (streamShellDisplayProfileCache?.mode === 'compact') {
                    shouldBroadcast = true;
                } else if (!Number.isInteger(focusedWindowId)) {
                    // Only the newest event snapshot is delivered; no expensive
                    // landing occlusion scan or awaited runtime delivery.
                    notifyShellWindowEventFromSnapshot(stored, null);
                }
                scheduleShellUnmanagedResourceSync();
            }
            boundsMs = Date.now() - boundsStarted;
        }
        if (shouldBroadcast && !shuttingDown) {
            const broadcastStarted = Date.now();
            await broadcastState();
            broadcastMs = Date.now() - broadcastStarted;
        }
    } finally {
        const durationMs = Date.now() - startedAt;
        if (eventCount >= 5 || durationMs >= 1400) {
            recordFlightEvent({
                category: 'window-events', action: 'reconciled',
                level: durationMs > 2500 ? 'warn' : 'info',
                detail: { received: eventCount, boundsWindows: boundsIds.length,
                    hadFocus: Number.isInteger(focusedWindowId), durationMs,
                    focusMs, boundsMs, broadcastMs }
            }).catch(() => {});
        }
        shellWindowEventRunning = false;
        if (!shuttingDown && shellWindowEventPendingCount) {
            /* Changes that arrived while the previous batch was in flight
             * are settled once more. Never accumulate one Promise per event. */
            if (shellWindowEventTimer === null) {
                shellWindowEventTimer = setTimeout(() => {
                    shellWindowEventTimer = null;
                    drainShellWindowEventReconcile().catch(error => {
                        recordFlightEvent({
                            category: 'window-events', action: 'drain-failed', level: 'error',
                            detail: { message: String(error?.message || error).slice(0, 180) }
                        }).catch(() => {});
                    });
                }, STREAM_SHELL_WINDOW_EVENT_SETTLE_MS);
            }
        }
    }
}

chrome.windows.onFocusChanged.addListener(focusedWindowId => {
    if (streamShellDisplayProfileCache?.mode !== 'compact') {
        reconcileShellWideFocusFast(focusedWindowId);
        return;
    }
    scheduleShellWindowEventReconcile(focusedWindowId, null);
});

chrome.windows.onBoundsChanged.addListener(changedWindow => {
    // Native HWND synchronization and explicit provider transitions already
    // handle Wide geometry. Don't turn Opera's resize event storm into API IPC.
    if (streamShellDisplayProfileCache?.mode !== 'compact') return;
    scheduleShellWindowEventReconcile(null, changedWindow?.id);
});


chrome.windows.onRemoved.addListener(
    async removedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

        if (removedWindowId === titlebarFullscreenWindowId) {
            titlebarFullscreenActive = false;
            titlebarFullscreenWindowId = null;
        }

        const stored =
            await chrome.storage.local.get([
                "providerWindows",
                "landingWindowId",
                "dashboardWindowId",
                TWITCH_WINDOW_STORAGE_KEY,
                TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY
            ]);

        const providerWindows =
            stored.providerWindows ||
            {};

        let providersChanged =
            false;


        const removedProviders =
            [];


        for (
            const [name, windowId]
            of Object.entries(
                providerWindows
            )
        ) {
            if (
                windowId ===
                removedWindowId
            ) {
                delete providerWindows[
                    name
                ];


                removedProviders.push(
                    name
                );


                providersChanged =
                    true;
            }
        }

        if (
            providersChanged
        ) {
            await saveProviderWindows(
                providerWindows
            );


            await chrome.storage.local.remove(
                removedProviders.map(
                    name =>
                        `streamShellNowPlaying_${name}`
                )
            );

            for (const provider of removedProviders) {
                recordFlightEvent({
                    source: "background",
                    category: "provider-window",
                    action: "closed",
                    provider,
                    detail: { windowId: removedWindowId }
                }).catch(() => {});
            }
        }

        if (
            stored.landingWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "landingWindowId"
            );
        }

        if (
            stored.dashboardWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "dashboardWindowId"
            );
        }

        if (
            stored[TWITCH_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_WINDOW_STORAGE_KEY
            );
            await chrome.storage.session.remove(
                TWITCH_RAID_GUARD_SESSION_KEY
            ).catch(() => {});


            const rightState = await chrome.storage.local.get("rightMode");
            if (rightState.rightMode === "twitch") {
                await showDashboard().catch(async () => {
                    await chrome.storage.local.set({ rightMode: "dashboard" });
                    await broadcastState();
                });
            }
        }

        if (
            stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY
            ).catch(() => {});
        }

    }
);