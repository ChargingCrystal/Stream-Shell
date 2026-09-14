async function getDashboardWindowId() {
    const stored =
        await chrome.storage.local.get(
            "dashboardWindowId"
        );

    return (
        stored.dashboardWindowId ||
        null
    );
}


async function ensureDashboardWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    if (
        dashboardCreationLock
    ) {
        return dashboardCreationLock;
    }

    dashboardCreationLock =
        _ensureDashboardWindow()
            .finally(
                () => {
                    dashboardCreationLock =
                        null;
                }
            );

    return dashboardCreationLock;
}


async function _ensureDashboardWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    let windowId =
        await getDashboardWindowId();

    if (
        windowId
    ) {
        try {
            await chrome.windows.get(
                windowId
            );

            return windowId;
        } catch {
            await chrome.storage.local.remove(
                "dashboardWindowId"
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Dashboard creation cancelled."
        );
    }

    const win =
        await chrome.windows.create({
            type:
                "popup",

            state:
                "normal",

            focused:
                false,

            left:
                RIGHT.left,

            top:
                RIGHT.top,

            width:
                RIGHT.width,

            height:
                RIGHT.height,

            url:
                DASHBOARD_URL
        });

    if (
        shuttingDown
    ) {
        if (
            win?.id
        ) {
            await safelyRemoveWindow(
                win.id
            );
        }

        throw new Error(
            "Dashboard creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            "Dashboard window could not be created."
        );
    }

    windowId =
        win.id;

    await chrome.storage.local.set({
        dashboardWindowId:
            windowId
    });

    return windowId;
}


async function showDashboard() {
    if (shuttingDown) return;

    const dashboardId = await ensureDashboardWindow();
    if (shuttingDown) return;

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    const compact = displayProfile?.mode === "compact";

    await deactivateTwitchForRightSurface({
        forceMinimize: compact
    });

    if (compact) {
        /* Avoid a native Discord round-trip on every Compact Home/Settings
         * click when Discord is not the active surface (or not installed). */
        const rightState = await chrome.storage.local.get("rightMode");
        if (rightState.rightMode === "discord") {
            await hideDiscordForDashboard();
        }
    } else {
        /* Preserve the established Wide behavior byte-for-byte in spirit. */
        await hideDiscordForDashboard();
    }

    if (shuttingDown) return;

    /* Publish Dashboard intent before its native focus transition. */
    await chrome.storage.local.set({
        ...(compact ? { leftMode: "dashboard" } : {}),
        rightMode: "dashboard"
    });

    if (compact) {
        /*
         * Compact uses mutually exclusive full-surface windows. Minimize every
         * provider before restoring Dashboard.
         */
        const providerWindows = await getProviderWindows();
        for (const windowId of Object.values(providerWindows)) {
            if (Number.isInteger(windowId)) {
                await safelyMinimizeWindow(windowId);
            }
        }
    }

    if (shuttingDown) return;

    await restoreWindow(
        dashboardId,
        compact ? LEFT : RIGHT,
        true
    );

    await claimFocusedTitlebarSurface(
        dashboardId
    );
    scheduleTitlebarClaimRetries(
        dashboardId
    );

    if (shuttingDown) return;

    await broadcastState();
}


