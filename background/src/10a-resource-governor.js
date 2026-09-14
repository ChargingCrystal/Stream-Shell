/*
 * ============================================================
 * RESOURCE GOVERNOR WINDOW STATE
 * ============================================================
 * Background-owned provider-window facts used by the in-page governor.
 * The content script owns workload policy; the service worker only reports
 * whether a managed provider window is minimized/focused/currently selected.
 */

async function getProviderResourceWindowState(windowId) {
    if (!Number.isInteger(windowId)) {
        return {
            managed: false,
            provider: null,
            windowId: null,
            windowState: null,
            minimized: false,
            focused: false,
            shellActive: false,
            activeProvider: null,
            leftMode: null
        };
    }

    const stored = await chrome.storage.local.get([
        "providerWindows",
        "activeProvider",
        "leftMode"
    ]);

    const providerWindows = stored.providerWindows || {};
    const entry = Object.entries(providerWindows)
        .find(([, providerWindowId]) => providerWindowId === windowId);
    const provider = entry?.[0] || null;

    if (!provider) {
        return {
            managed: false,
            provider: null,
            windowId,
            windowState: null,
            minimized: false,
            focused: false,
            shellActive: false,
            activeProvider: stored.activeProvider || null,
            leftMode: stored.leftMode || "landing"
        };
    }

    let window = null;
    try {
        window = await chrome.windows.get(windowId);
    } catch {
    }

    const leftMode = stored.leftMode || "landing";

    return {
        managed: Boolean(window),
        provider,
        windowId,
        windowState: window?.state || null,
        minimized: window?.state === "minimized",
        focused: window?.focused === true,
        shellActive: leftMode === provider,
        activeProvider: stored.activeProvider || null,
        leftMode
    };
}

async function sendProviderResourceWindowState(windowId) {
    const state = await getProviderResourceWindowState(windowId);
    if (!state.managed || !Number.isInteger(windowId)) return false;

    let tabs = [];
    try {
        tabs = await chrome.tabs.query({ windowId });
    } catch {
        return false;
    }

    await Promise.allSettled(
        tabs
            .filter(tab => Number.isInteger(tab.id))
            .map(tab => chrome.tabs.sendMessage(tab.id, {
                type: "stream-shell-resource-window-state",
                state
            }))
    );

    return true;
}

async function broadcastProviderResourceWindowStates() {
    if (shuttingDown) return;

    const providerWindows = await getProviderWindows();
    await Promise.allSettled(
        Object.values(providerWindows)
            .filter(Number.isInteger)
            .map(windowId => sendProviderResourceWindowState(windowId))
    );
}
