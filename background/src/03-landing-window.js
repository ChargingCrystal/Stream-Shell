async function ensureLandingWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
        );
    }

    if (
        landingCreationLock
    ) {
        return landingCreationLock;
    }

    landingCreationLock =
        _ensureLandingWindow()
            .finally(
                () => {
                    landingCreationLock =
                        null;
                }
            );

    return landingCreationLock;
}


async function _ensureLandingWindow() {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
        );
    }

    const stored =
        await chrome.storage.local.get(
            "landingWindowId"
        );

    let windowId =
        stored.landingWindowId;

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
                "landingWindowId"
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Landing creation cancelled."
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
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            url:
                LANDING_URL
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
            "Landing creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            "Landing window could not be created."
        );
    }

    windowId =
        win.id;

    await chrome.storage.local.set({
        landingWindowId:
            windowId
    });

    return windowId;
}


async function showLanding(
    focused = true
) {
    if (
        shuttingDown
    ) {
        return;
    }

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    if (displayProfile?.mode === "compact") {
        await showDashboard();
        return;
    }

    await stopVolumeCaptureForProviderChange(
        "landing"
    );

    const landingId =
        await ensureLandingWindow();

    if (
        shuttingDown
    ) {
        return;
    }

    const providerWindows =
        await getProviderWindows();

    for (
        const windowId
        of Object.values(
            providerWindows
        )
    ) {
        await setWindowMuted(
            windowId,
            true
        );

        await safelyMinimizeWindow(
            windowId
        );
    }

    await chrome.storage.local.set({
        leftMode:
            "landing"
    });

    await restoreWindow(
        landingId,
        LEFT,
        focused
    );

    if (
        shuttingDown
    ) {
        return;
    }

    if (focused) {
        await claimFocusedTitlebarSurface(landingId);
        scheduleTitlebarClaimRetries(landingId);
    }

    await broadcastState();
}


async function reloadLeft() {
    if (
        shuttingDown
    ) {
        return;
    }

    const stored =
        await chrome.storage.local.get([
            "leftMode",
            "landingWindowId",
            "providerWindows"
        ]);

    const leftMode =
        stored.leftMode ||
        "landing";

    let windowId =
        null;

    if (
        leftMode ===
        "landing"
    ) {
        windowId =
            stored.landingWindowId;
    } else {
        windowId =
            stored.providerWindows?.[
                leftMode
            ];
    }

    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        const tabs =
            await chrome.tabs.query({
                windowId
            });

        const tab =
            tabs.find(
                current =>
                    current.active
            ) ||
            tabs[0];

        if (
            tab?.id
        ) {
            await chrome.tabs.reload(
                tab.id
            );
        }
    } catch (error) {
        console.error(
            "Left-side reload failed:",
            error
        );
    }
}


