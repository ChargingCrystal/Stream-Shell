async function restoreWindow(
    windowId,
    bounds,
    focused
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        await chrome.windows.update(
            windowId,
            {
                state:
                    "normal"
            }
        );

        if (
            shuttingDown
        ) {
            return;
        }

        await chrome.windows.update(
            windowId,
            {
                left:
                    bounds.left,

                top:
                    bounds.top,

                width:
                    bounds.width,

                height:
                    bounds.height,

                focused:
                    focused
            }
        );
    } catch (error) {
        console.warn(
            "Could not restore window:",
            windowId,
            error
        );
    }
}


async function safelyMinimizeWindow(
    windowId
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        await chrome.windows.update(
            windowId,
            {
                state:
                    "minimized"
            }
        );
    } catch {
    }
}


async function safelyRemoveWindow(
    windowId
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    try {
        await chrome.windows.remove(
            windowId
        );
    } catch {
    }
}


