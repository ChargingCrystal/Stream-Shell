function streamShellWindowBoundsMatch(
    window,
    bounds,
    tolerance = 8
) {
    if (
        !window ||
        !bounds
    ) {
        return false;
    }

    return (
        Math.abs(Number(window.left) - Number(bounds.left)) <= tolerance &&
        Math.abs(Number(window.top) - Number(bounds.top)) <= tolerance &&
        Math.abs(Number(window.width) - Number(bounds.width)) <= tolerance &&
        Math.abs(Number(window.height) - Number(bounds.height)) <= tolerance
    );
}


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
        /*
         * A remembered warm provider can be minimized with a browser-owned
         * restore rectangle. Opera may briefly restore that rectangle before a
         * following bounds update lands. Keep focus away until LEFT/RIGHT is
         * verified so a stale 32:9 restore rectangle can never become the
         * claimed Stream Shell surface.
         */
        await chrome.windows.update(
            windowId,
            {
                state:
                    "normal",

                focused:
                    false
            }
        );

        if (
            shuttingDown
        ) {
            return;
        }

        const delays =
            [0, 40, 100];

        let geometryReady =
            false;

        for (
            let attempt = 0;
            attempt < delays.length;
            attempt++
        ) {
            const delay =
                delays[attempt];

            if (delay > 0) {
                await new Promise(
                    resolve =>
                        setTimeout(resolve, delay)
                );
            }

            if (
                shuttingDown
            ) {
                return;
            }

            try {
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
                            false
                    }
                );

                const observed =
                    await chrome.windows.get(
                        windowId
                    );

                if (
                    streamShellWindowBoundsMatch(
                        observed,
                        bounds
                    )
                ) {
                    geometryReady =
                        true;

                    break;
                }
            } catch {
            }
        }

        if (
            focused &&
            !shuttingDown
        ) {
            await chrome.windows.update(
                windowId,
                {
                    focused:
                        true
                }
            );
        }

        if (!geometryReady) {
            console.warn(
                "Could not verify restored window geometry:",
                windowId,
                bounds
            );
        }
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


