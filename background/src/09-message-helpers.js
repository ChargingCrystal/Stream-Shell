async function isManagedProviderWindow(
    windowId
) {
    if (
        shuttingDown
    ) {
        return false;
    }

    const windows =
        await getProviderWindows();

    return Object.values(
        windows
    ).includes(
        windowId
    );
}


function isLandingSender(
    sender
) {
    return (
        sender?.url ===
            LANDING_URL ||

        sender?.tab?.url ===
            LANDING_URL
    );
}


function isDashboardSender(
    sender
) {
    return (
        sender?.url ===
            DASHBOARD_URL ||

        sender?.tab?.url ===
            DASHBOARD_URL
    );
}


function isShellHomeUiSender(
    sender
) {
    return isLandingSender(sender) || isDashboardSender(sender);
}


function isPopupSender(
    sender
) {
    return (
        sender?.url ===
            POPUP_URL
    );
}


function applyYouTubeQualityInMainWorld(
    preferred
) {
    const player =
        document.getElementById(
            "movie_player"
        );


    if (
        !player
    ) {
        return {
            ok:
                false
        };
    }


    const order = [
        "highres",
        "hd2880",
        "hd2160",
        "hd1440",
        "hd1080",
        "hd720",
        "large",
        "medium",
        "small",
        "tiny"
    ];


    let available =
        [];


    try {
        available =
            player.getAvailableQualityLevels?.() ||
            [];
    } catch {
    }


    if (
        !available.length
    ) {
        return {
            ok:
                false
        };
    }


    let chosen =
        String(
            preferred ||
            "hd1080"
        );


    if (
        chosen ===
            "highest"
    ) {
        chosen =
            order.find(
                quality =>
                    available.includes(
                        quality
                    )
            ) ||
            available[0];

    } else if (
        chosen !==
            "auto"
    ) {
        const targetIndex =
            order.indexOf(
                chosen
            );


        if (
            targetIndex >= 0
        ) {
            chosen =
                order
                    .slice(
                        targetIndex
                    )
                    .find(
                        quality =>
                            available.includes(
                                quality
                            )
                    ) ||
                order.find(
                    quality =>
                        available.includes(
                            quality
                        )
                ) ||
                available[0];
        }
    }


    try {
        if (
            typeof player.setPlaybackQualityRange ===
                "function"
        ) {
            player.setPlaybackQualityRange(
                chosen,
                chosen
            );
        }


        if (
            chosen !==
                "auto" &&
            typeof player.setPlaybackQuality ===
                "function"
        ) {
            player.setPlaybackQuality(
                chosen
            );
        }


        return {
            ok:
                true,

            chosen
        };

    } catch {
        return {
            ok:
                false
        };
    }
}



async function collectProviderDiagnosticsForDashboard(
    providerWindows,
    browserWindows,
    options = {}
) {
    const activeProvider = PROVIDERS[options.activeProvider]
        ? options.activeProvider
        : null;
    const full = options.full === true;
    const byWindowId = new Map(
        browserWindows
            .filter(window => Number.isInteger(window.id))
            .map(window => [window.id, window])
    );
    const result = {};

    for (const provider of Object.keys(PROVIDERS)) {
        const windowId = Number.isInteger(providerWindows?.[provider])
            ? providerWindows[provider]
            : null;
        const browserWindow = windowId !== null ? byWindowId.get(windowId) || null : null;
        const entry = {
            known: windowId !== null,
            alive: Boolean(browserWindow),
            windowState: browserWindow?.state || null,
            focused: browserWindow?.focused === true,
            bounds: browserWindow ? {
                left: browserWindow.left ?? null,
                top: browserWindow.top ?? null,
                width: browserWindow.width ?? null,
                height: browserWindow.height ?? null
            } : null,
            tab: null,
            page: null,
            liveProbe: false
        };

        if (browserWindow && windowId !== null) {
            try {
                const tabs = await chrome.tabs.query({ windowId, active: true });
                const tab = tabs[0] || null;
                if (tab) {
                    entry.tab = {
                        id: Number.isInteger(tab.id) ? tab.id : null,
                        status: tab.status || null,
                        audible: tab.audible === true,
                        muted: tab.mutedInfo?.muted === true,
                        discarded: tab.discarded === true
                    };

                    const shouldProbePage =
                        Number.isInteger(tab.id) &&
                        (full || provider === activeProvider);

                    if (shouldProbePage) {
                        entry.liveProbe = true;
                        try {
                            entry.page = await chrome.tabs.sendMessage(tab.id, {
                                type: "stream-shell-provider-diagnostics"
                            });
                        } catch {
                            entry.page = {
                                ok: false,
                                error: "Content diagnostics unavailable"
                            };
                        }
                    }
                }
            } catch {
            }
        }

        result[provider] = entry;
    }

    return result;
}
