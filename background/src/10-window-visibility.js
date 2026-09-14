function windowBounds(window) {
    if (
        !window ||
        !Number.isFinite(window.left) ||
        !Number.isFinite(window.top) ||
        !Number.isFinite(window.width) ||
        !Number.isFinite(window.height)
    ) {
        return null;
    }

    return {
        left:
            window.left,

        top:
            window.top,

        width:
            window.width,

        height:
            window.height
    };
}


function windowsOverlap(
    first,
    second
) {
    if (
        !first ||
        !second
    ) {
        return false;
    }

    return (
        first.left <
            second.left + second.width &&
        first.left + first.width >
            second.left &&
        first.top <
            second.top + second.height &&
        first.top + first.height >
            second.top
    );
}


async function getNativeForegroundBounds() {
    try {
        const response =
            await chrome.runtime.sendNativeMessage(
                DISCORD_NATIVE_HOST,
                {
                    action:
                        "foreground"
                }
            );

        if (
            !response?.ok ||
            !response?.hasWindow
        ) {
            return null;
        }

        return windowBounds(
            response
        );
    } catch {
        /*
         * Older helper builds do not know the foreground action yet.
         * In that case the caller safely treats external focus as
         * potentially covering Landing.
         */
        return null;
    }
}


async function isLandingExposed() {
    if (
        shuttingDown
    ) {
        return false;
    }

    const stored =
        await chrome.storage.local.get([
            "leftMode",
            "landingWindowId",
            "providerWindows"
        ]);

    if (
        !Number.isInteger(
            stored.landingWindowId
        )
    ) {
        return false;
    }

    let landingWindow;

    try {
        landingWindow =
            await chrome.windows.get(
                stored.landingWindowId
            );
    } catch {
        return false;
    }

    if (
        landingWindow.state ===
        "minimized"
    ) {
        return false;
    }

    const landingBounds =
        windowBounds(
            landingWindow
        );

    if (
        !landingBounds
    ) {
        return false;
    }

    let browserWindows =
        [];

    try {
        browserWindows =
            await chrome.windows.getAll();
    } catch {
    }

    const focusedBrowserWindow =
        browserWindows.find(
            window =>
                window.focused
        );

    /*
     * Landing itself is foreground: by definition it is exposed.
     */
    if (
        focusedBrowserWindow?.id ===
            landingWindow.id
    ) {
        return true;
    }

    /*
     * Any focused Opera window physically covering the left half wins. A
     * focused Dashboard on the right does not count.
     */
    if (
        focusedBrowserWindow &&
        windowsOverlap(
            landingBounds,
            windowBounds(
                focusedBrowserWindow
            )
        )
    ) {
        return false;
    }

    /*
     * leftMode is useful as a hint, but never trust it blindly: a provider
     * can be minimized/closed manually through Windows. Only suppress the
     * adaptive clock when the stored provider window really still exists in
     * normal state and overlaps Landing.
     */
    const leftMode =
        stored.leftMode ||
        "landing";

    const providerWindows =
        stored.providerWindows ||
        {};

    const activeProviderWindowId =
        providerWindows[
            leftMode
        ];

    if (
        Number.isInteger(
            activeProviderWindowId
        )
    ) {
        try {
            const providerWindow =
                await chrome.windows.get(
                    activeProviderWindowId
                );

            if (
                providerWindow.state !==
                    "minimized" &&
                windowsOverlap(
                    landingBounds,
                    windowBounds(
                        providerWindow
                    )
                )
            ) {
                return false;
            }
        } catch {
            /* Closed provider: Landing underneath is exposed again. */
        }
    }

    if (
        !focusedBrowserWindow
    ) {
        /*
         * Opera has lost focus, so the foreground belongs to another native
         * application. Discord on the right is fine; anything overlapping
         * Landing restores the normal Stream Shell brand.
         */
        const foregroundBounds =
            await getNativeForegroundBounds();

        if (
            foregroundBounds &&
            windowsOverlap(
                landingBounds,
                foregroundBounds
            )
        ) {
            return false;
        }

        /*
         * If the helper is unavailable we cannot prove Landing is exposed.
         */
        if (
            !foregroundBounds
        ) {
            return false;
        }
    }

    return true;
}



