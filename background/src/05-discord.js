async function sendDiscordNative(
    action
) {
    const response =
        await chrome.runtime.sendNativeMessage(
            DISCORD_NATIVE_HOST,
            {
                action,

                executablePath:
                    DISCORD_EXECUTABLE_PATH,

                left:
                    RIGHT.left,

                top:
                    RIGHT.top,

                width:
                    RIGHT.width,

                height:
                    RIGHT.height
            }
        );

    if (
        !response?.ok
    ) {
        throw new Error(
            response?.error ||
            "Discord native helper did not respond successfully."
        );
    }

    return response;
}


async function hideDiscordForDashboard() {
    try {
        await sendDiscordNative(
            "hide"
        );
    } catch {
        /*
         * Dashboard/provider navigation must still work if Discord is closed,
         * the native host is unavailable, or the helper has not been installed.
         */
    }
}


async function showDiscord() {
    if (
        shuttingDown
    ) {
        return;
    }

    await deactivateTwitchForRightSurface();

    /*
     * Keep Dashboard alive behind the native Discord window so
     * switching back is instant.
     */
    const dashboardId =
        await ensureDashboardWindow();

    if (
        shuttingDown
    ) {
        return;
    }

    await restoreWindow(
        dashboardId,
        RIGHT,
        false
    );

    if (
        shuttingDown
    ) {
        return;
    }

    await sendDiscordNative(
        "show"
    );

    if (
        shuttingDown
    ) {
        return;
    }

    await chrome.storage.local.set({
        rightMode:
            "discord"
    });

    await broadcastState();
}


async function getDiscordNativeStatus() {
    try {
        const response =
            await sendDiscordNative(
                "status"
            );


        return {
            ok:
                true,

            running:
                response.running ===
                    true,

            visible:
                response.visible ===
                    true
        };

    } catch {

        return {
            ok:
                false,

            running:
                false,

            visible:
                false
        };
    }
}


async function syncDiscordVisibilityState() {
    const status =
        await getDiscordNativeStatus();


    if (
        !status.ok
    ) {
        return status;
    }


    const stored =
        await chrome.storage.local.get(
            "rightMode"
        );


    if (
        stored.rightMode ===
            "discord" &&
        !status.visible
    ) {
        await chrome.storage.local.set({
            rightMode:
                "dashboard"
        });


        await broadcastState();
    }


    return status;
}


