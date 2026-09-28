async function killStreamShell() {
    if (shuttingDown) return;

    await stopVolumeCapture(false);
    shuttingDown = true;

    providerCreationLocks.clear();
    landingCreationLock = null;
    dashboardCreationLock = null;
    stopTitlebarNative();

    /* Keep the logical A-D definition but close all four physical Twitch
     * windows concurrently. */
    await closeTwitchWorkspaceV2Windows(true).catch(() => {});

    const stored = await chrome.storage.local.get([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        TWITCH_SPLIT_LAB_STORAGE_KEY
    ]);

    const providerWindows = stored.providerWindows || {};

    await chrome.storage.local.remove([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        TWITCH_SPLIT_LAB_STORAGE_KEY,
        "leftMode",
        "rightMode"
    ]);

    const splitLabWindowIds = Array.isArray(stored[TWITCH_SPLIT_LAB_STORAGE_KEY]?.windowIds)
        ? stored[TWITCH_SPLIT_LAB_STORAGE_KEY].windowIds
        : [];

    const windowIds = new Set([
        ...Object.values(providerWindows),
        stored.landingWindowId,
        stored.dashboardWindowId,
        stored[TWITCH_WINDOW_STORAGE_KEY],
        stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY],
        ...splitLabWindowIds
    ].filter(Number.isInteger));

    /* Once shuttingDown is true all window removal listeners are inert, so there
     * is no reason to serialize independent Opera close round-trips. */
    await Promise.allSettled(
        [...windowIds].map(windowId => safelyRemoveWindow(windowId))
    );

    /* Stream Shell does not own Discord's lifetime. */
    await chrome.storage.session.remove(TWITCH_RAID_GUARD_SESSION_KEY).catch(() => {});
}

