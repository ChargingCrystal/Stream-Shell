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


async function getStreamShellParkingBounds(
    referenceBounds = LEFT
) {
    let displays = [];

    try {
        displays = await chrome.system.display.getInfo();
    } catch {
    }

    const rects = (Array.isArray(displays) ? displays : [])
        .map(display => display?.bounds)
        .filter(bounds =>
            Number.isFinite(Number(bounds?.left)) &&
            Number.isFinite(Number(bounds?.top)) &&
            Number(bounds?.width) > 0 &&
            Number(bounds?.height) > 0
        );

    const virtualBottom = rects.length
        ? Math.max(...rects.map(bounds => Number(bounds.top) + Number(bounds.height)))
        : Number(referenceBounds?.top || 0) + Number(referenceBounds?.height || 1080);

    const width = Math.max(320, Number(referenceBounds?.width) || 960);
    const height = Math.max(240, Number(referenceBounds?.height) || 540);

    return {
        left: Number(referenceBounds?.left) || 0,
        top: virtualBottom + 240,
        width,
        height
    };
}


async function parkWindowOffscreen(
    windowId,
    referenceBounds = LEFT
) {
    if (
        shuttingDown ||
        !Number.isInteger(windowId)
    ) {
        return;
    }

    try {
        const bounds = await getStreamShellParkingBounds(referenceBounds);

        await chrome.windows.update(windowId, {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            focused: false
        });
    } catch {
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


