async function killStreamShell() {
    if (
        shuttingDown
    ) {
        return;
    }

    await stopVolumeCapture(false);

    shuttingDown =
        true;

    providerCreationLocks.clear();

    landingCreationLock =
        null;

    dashboardCreationLock =
        null;

    stopTitlebarNative();

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

    await chrome.storage.local.remove([
        "providerWindows",
        "landingWindowId",
        "dashboardWindowId",
        TWITCH_WINDOW_STORAGE_KEY,
        TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY,
        "leftMode",
        "rightMode"
    ]);

    for (
        const windowId
        of Object.values(
            providerWindows
        )
    ) {
        await safelyRemoveWindow(
            windowId
        );
    }

    /*
     * Stream Shell does not own Discord's lifetime. Leave the native app
     * untouched when killing the shell instead of forcing another Electron
     * minimize/restore cycle.
     */

    await safelyRemoveWindow(
        stored.landingWindowId
    );

    await safelyRemoveWindow(
        stored.dashboardWindowId
    );

    await safelyRemoveWindow(
        stored[TWITCH_WINDOW_STORAGE_KEY]
    );

    await safelyRemoveWindow(
        stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY]
    );

    await chrome.storage.session.remove(
        TWITCH_RAID_GUARD_SESSION_KEY
    ).catch(() => {});
}


