/*
 * ================================================================
 * OPTIONAL NATIVE TITLEBAR TOOLBAR
 * ================================================================
 *
 * This is intentionally a second native host, separate from Discord.
 * If it is not installed (or if it crashes), Stream Shell continues to
 * work normally; Landing/Dashboard controls remain available inside the
 * shell pages. The old in-page floating navbar was retired in 0.9.29.
 */
function getTitlebarGeometryStateKey() {
    return [
        LEFT.left,
        LEFT.top,
        LEFT.width,
        LEFT.height,
        RIGHT.left,
        RIGHT.top,
        RIGHT.width,
        RIGHT.height
    ].join(",");
}


async function syncConnectedTitlebarNative() {
    if (
        shuttingDown ||
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode"
        ]);

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    const visibilityMode =
        await getTitlebarVisibilityMode();

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode
    );
}


async function ensureTitlebarNative() {
    if (
        shuttingDown
    ) {
        return;
    }

    if (
        titlebarPort &&
        titlebarProtocolReady
    ) {
        await syncConnectedTitlebarNative();
        return;
    }

    if (
        titlebarConnectPromise
    ) {
        await titlebarConnectPromise;
        return;
    }

    titlebarConnectPromise =
        connectTitlebarNative();

    try {
        await titlebarConnectPromise;
    } finally {
        titlebarConnectPromise =
            null;
    }
}


async function connectTitlebarNative() {
    let port;

    try {
        port =
            chrome.runtime.connectNative(
                TITLEBAR_NATIVE_HOST
            );
    } catch {
        return;
    }

    titlebarLastStateKey =
        null;
    titlebarProtocolReady =
        false;

    port.onMessage.addListener(
        message => {
            handleTitlebarNativeMessage(
                message
            );
        }
    );

    port.onDisconnect.addListener(
        () => {
            if (
                titlebarPort ===
                port
            ) {
                titlebarPort =
                    null;

                titlebarLastStateKey =
                    null;

                titlebarProtocolReady =
                    false;

                stopTitlebarReconcileLoop();
            }

            try {
                void chrome.runtime.lastError;
            } catch {
            }
        }
    );

    /*
     * Negotiate before sending init. An old helper therefore never receives
     * geometry/state messages it might interpret with an incompatible trust
     * model; it simply times out and is disconnected fail-closed.
     */
    const protocolAccepted =
        await new Promise(
            resolve => {
                let settled = false;

                const finish =
                    accepted => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        clearTimeout(timeoutId);
                        try {
                            port.onMessage.removeListener(
                                handshakeListener
                            );
                        } catch {
                        }
                        resolve(accepted);
                    };

                const handshakeListener =
                    message => {
                        if (
                            message?.event ===
                                "hello-ack"
                        ) {
                            finish(
                                message.protocolVersion ===
                                    TITLEBAR_PROTOCOL_VERSION
                            );
                        }
                    };

                port.onMessage.addListener(
                    handshakeListener
                );

                const timeoutId =
                    setTimeout(
                        () => finish(false),
                        1200
                    );

                try {
                    port.postMessage({
                        type:
                            "hello",

                        protocolVersion:
                            TITLEBAR_PROTOCOL_VERSION
                    });
                } catch {
                    finish(false);
                }
            }
        );

    if (
        !protocolAccepted ||
        shuttingDown
    ) {
        titlebarLastNativeStatus = {
            event:
                "protocol-unavailable",
            expected:
                TITLEBAR_PROTOCOL_VERSION
        };

        try {
            port.disconnect();
        } catch {
        }
        return;
    }

    titlebarPort =
        port;
    titlebarProtocolReady =
        true;

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode"
        ]);

    let volumeShortcut =
        "";

    try {
        const commands =
            await chrome.commands.getAll();

        volumeShortcut =
            commands.find(
                command =>
                    command.name === "toggle-volume-booster"
            )?.shortcut ||
            "";
    } catch {
    }

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    const visibilityMode =
        await getTitlebarVisibilityMode();

    if (
        titlebarPort !==
            port ||
        !titlebarProtocolReady ||
        shuttingDown
    ) {
        return;
    }

    try {
        port.postMessage({
            type:
                "init",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            left:
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            rightLeft:
                RIGHT.left,

            rightTop:
                RIGHT.top,

            rightWidth:
                RIGHT.width,

            rightHeight:
                RIGHT.height,

            layoutProfile:
                streamShellDisplayProfileCache?.mode || "wide",

            leftMode:
                state.leftMode ||
                "landing",

            rightMode:
                state.rightMode ||
                "dashboard",

            visibilityMode,

            settingsOpen:
                titlebarSettingsOpen,

            volumeActive:
                titlebarVolumeActive,

            fullscreenActive:
                titlebarFullscreenActive,

            volumeShortcut
        });

        titlebarLastStateKey =
            `${state.leftMode || "landing"}|${state.rightMode || "dashboard"}|${visibilityMode}|${streamShellDisplayProfileCache?.mode || "wide"}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

        startTitlebarReconcileLoop();
    } catch {
        try {
            port.disconnect();
        } catch {
        }
    }
}


function stopTitlebarNative() {
    const port =
        titlebarPort;

    titlebarPort =
        null;

    titlebarProtocolReady =
        false;

    titlebarLastStateKey =
        null;

    titlebarSettingsOpen =
        false;

    titlebarVolumeActive =
        false;

    titlebarFullscreenActive =
        false;

    titlebarFullscreenWindowId =
        null;

    stopTitlebarReconcileLoop();

    if (
        !port
    ) {
        return;
    }

    try {
        port.postMessage({
            type:
                "shutdown"
        });
    } catch {
    }

    try {
        port.disconnect();
    } catch {
    }
}


async function getTitlebarVisibilityMode() {
    if (
        shuttingDown
    ) {
        return "none";
    }

    try {
        const [
            state,
            browserWindows
        ] =
            await Promise.all([
                chrome.storage.local.get([
                    "providerWindows",
                    "landingWindowId",
                    "dashboardWindowId",
                    TWITCH_WINDOW_STORAGE_KEY,
                    "rightMode"
                ]),
                chrome.windows.getAll({
                    populate:
                        false
                })
            ]);

        const shellWindowIds =
            new Set();

        if (
            Number.isInteger(
                state.landingWindowId
            )
        ) {
            shellWindowIds.add(
                state.landingWindowId
            );
        }

        if (
            Number.isInteger(
                state.dashboardWindowId
            )
        ) {
            shellWindowIds.add(
                state.dashboardWindowId
            );
        }

        if (
            Number.isInteger(
                state[TWITCH_WINDOW_STORAGE_KEY]
            )
        ) {
            shellWindowIds.add(
                state[TWITCH_WINDOW_STORAGE_KEY]
            );
        }

        for (
            const windowId
            of Object.values(
                state.providerWindows || {}
            )
        ) {
            if (
                Number.isInteger(
                    windowId
                )
            ) {
                shellWindowIds.add(
                    windowId
                );
            }
        }

        const focusedBrowserWindow =
            browserWindows.find(
                window =>
                    window.focused
            );

        if (
            focusedBrowserWindow
        ) {
            return shellWindowIds.has(
                focusedBrowserWindow.id
            )
                ? "shell"
                : "none";
        }

        return state.rightMode ===
            "discord"
                ? "discord"
                : "none";
    } catch {
        return "none";
    }
}


async function claimFocusedTitlebarSurface(
    expectedWindowId = null
) {
    if (
        shuttingDown
    ) {
        return false;
    }

    if (!titlebarPort) {
        await ensureTitlebarNative();
    }

    if (
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return false;
    }

    try {
        const layoutProfile =
            streamShellDisplayProfileCache?.mode || "wide";

        const state =
            await chrome.storage.local.get([
                "providerWindows",
                "landingWindowId",
                "dashboardWindowId",
                TWITCH_WINDOW_STORAGE_KEY,
                "leftMode",
                "rightMode"
            ]);

        let focusedWindow = null;

        if (
            Number.isInteger(
                expectedWindowId
            )
        ) {
            focusedWindow =
                await chrome.windows.get(
                    expectedWindowId,
                    {
                        populate:
                            true
                    }
                );

            if (
                layoutProfile === "compact" &&
                focusedWindow?.focused !==
                    true
            ) {
                return false;
            }
        } else {
            focusedWindow =
                await chrome.windows.getLastFocused({
                    populate:
                        true
                });

            if (focusedWindow?.focused !== true) {
                return false;
            }
        }

        if (
            !Number.isInteger(
                focusedWindow?.id
            ) ||
            focusedWindow.state ===
                "minimized"
        ) {
            return false;
        }

        let surfaceMode = null;
        let surfaceSide = null;

        if (
            focusedWindow.id ===
                state.landingWindowId &&
            layoutProfile ===
                "wide"
        ) {
            surfaceMode = "landing";
            surfaceSide = "left";
        } else if (
            focusedWindow.id ===
                state.dashboardWindowId
        ) {
            surfaceMode = "dashboard";
            surfaceSide =
                layoutProfile === "compact"
                    ? "left"
                    : "right";
        } else if (
            layoutProfile === "wide" &&
            focusedWindow.id === state[TWITCH_WINDOW_STORAGE_KEY]
        ) {
            surfaceMode = "twitch";
            surfaceSide = "right";
        } else {
            const providerEntry =
                Object.entries(
                    state.providerWindows || {}
                )
                    .find(
                        ([provider, windowId]) =>
                            PROVIDERS[provider] &&
                            windowId ===
                                focusedWindow.id
                    );

            surfaceMode =
                providerEntry?.[0] ||
                null;
            surfaceSide =
                surfaceMode
                    ? "left"
                    : null;
        }

        if (
            !surfaceMode ||
            !surfaceSide
        ) {
            return false;
        }

        const intendedSurface =
            surfaceSide === "left"
                ? state.leftMode
                : state.rightMode;

        if (
            intendedSurface !==
                surfaceMode
        ) {
            return false;
        }

        const activeTab =
            focusedWindow.tabs?.find(
                tab =>
                    tab.active
            ) ||
            focusedWindow.tabs?.[0] ||
            null;

        const titleHint =
            typeof activeTab?.title === "string"
                ? activeTab.title.trim().slice(0, 180)
                : "";

        /*
         * HWND identity is fail-closed. A managed chrome.windows ID alone is
         * not enough because Chromium and Win32 focus can race. Compact requires
         * the matching native foreground HWND; Wide validates the explicit claim
         * against its pane plus this non-empty title fingerprint so left/right
         * surfaces can be onboarded concurrently.
         */
        if (!titleHint) {
            return false;
        }

        titlebarPort.postMessage({
            type:
                "claim",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            layoutProfile,

            side:
                surfaceSide,

            mode:
                surfaceMode,

            titleHint
        });

        return true;
    } catch {
        return false;
    }
}


function cancelTitlebarClaimRetries(
    notifyNative = false
) {
    titlebarClaimRetryGeneration +=
        1;

    if (
        !notifyNative ||
        !titlebarPort
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "claim-cancel",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION
        });
    } catch {
    }
}


function scheduleTitlebarClaimRetries(
    expectedWindowId
) {
    if (
        shuttingDown ||
        !Number.isInteger(
            expectedWindowId
        )
    ) {
        return;
    }

    const generation =
        titlebarClaimRetryGeneration;

    /*
     * First probes are deliberately tight so a brand-new provider gets native
     * chrome/taskbar identity as soon as Chromium exposes its first title. The
     * later probes cover slower DRM/login startups without polling forever.
     */
    const delays =
        [80, 180, 350, 700, 1200, 2000, 3200, 5000, 7500];

    for (const delay of delays) {
        setTimeout(
            () => {
                if (
                    shuttingDown ||
                    generation !==
                        titlebarClaimRetryGeneration
                ) {
                    return;
                }

                claimFocusedTitlebarSurface(
                    expectedWindowId
                )
                    .catch(
                        () => {}
                    );
            },
            delay
        );
    }
}


function stopTitlebarReconcileLoop() {
    if (
        titlebarReconcileTimer !==
            null
    ) {
        clearInterval(
            titlebarReconcileTimer
        );
        titlebarReconcileTimer =
            null;
    }
}


function startTitlebarReconcileLoop() {
    stopTitlebarReconcileLoop();

    if (
        shuttingDown ||
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    titlebarReconcileTimer =
        setInterval(
            () => {
                if (
                    shuttingDown ||
                    !titlebarPort ||
                    !titlebarProtocolReady
                ) {
                    stopTitlebarReconcileLoop();
                    return;
                }

                try {
                    titlebarPort.postMessage({
                        type:
                            "heartbeat",

                        protocolVersion:
                            TITLEBAR_PROTOCOL_VERSION
                    });
                } catch {
                    return;
                }

                /*
                 * Re-announce the focused managed surface. Claims are
                 * idempotent, so a missed focus/title event heals itself while
                 * an unrelated Opera/native app simply fails the managed-window
                 * checks above and reaches no native trust path.
                 */
                claimFocusedTitlebarSurface()
                    .catch(
                        () => {}
                    );
            },
            TITLEBAR_RECONCILE_INTERVAL_MS
        );
}


function requestTitlebarFocus(
    side
) {
    if (
        !titlebarPort ||
        !titlebarProtocolReady ||
        (
            side !== "left" &&
            side !== "right"
        )
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "focus",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            side
        });
    } catch {
    }
}


function sendTitlebarState(
    leftMode,
    rightMode,
    visibilityMode = "none"
) {
    if (
        !titlebarPort ||
        !titlebarProtocolReady
    ) {
        return;
    }

    const nextLeft =
        leftMode ||
        "landing";

    const nextRight =
        rightMode ||
        "dashboard";

    const nextVisibility =
        visibilityMode ||
        "none";

    const layoutProfile =
        streamShellDisplayProfileCache?.mode || "wide";

    const key =
        `${nextLeft}|${nextRight}|${nextVisibility}|${layoutProfile}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

    if (
        key ===
        titlebarLastStateKey
    ) {
        return;
    }

    try {
        titlebarPort.postMessage({
            type:
                "state",

            protocolVersion:
                TITLEBAR_PROTOCOL_VERSION,

            layoutProfile,

            leftMode:
                nextLeft,

            rightMode:
                nextRight,

            visibilityMode:
                nextVisibility,

            settingsOpen:
                titlebarSettingsOpen,

            volumeActive:
                titlebarVolumeActive,

            fullscreenActive:
                titlebarFullscreenActive,

            left:
                LEFT.left,

            top:
                LEFT.top,

            width:
                LEFT.width,

            height:
                LEFT.height,

            rightLeft:
                RIGHT.left,

            rightTop:
                RIGHT.top,

            rightWidth:
                RIGHT.width,

            rightHeight:
                RIGHT.height
        });

        titlebarLastStateKey =
            key;
    } catch {
    }
}


async function setTitlebarSettingsOpen(
    open
) {
    const nextOpen =
        open === true;

    if (
        titlebarSettingsOpen ===
        nextOpen
    ) {
        return;
    }

    titlebarSettingsOpen =
        nextOpen;

    const [
        state,
        visibilityMode
    ] =
        await Promise.all([
            chrome.storage.local.get([
                "leftMode",
                "rightMode"
            ]),
            getTitlebarVisibilityMode()
        ]);

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode
    );
}


function handleTitlebarNativeMessage(
    message
) {
    if (
        shuttingDown
    ) {
        return;
    }

    if (
        message?.event ===
            "status"
    ) {
        titlebarLastNativeStatus =
            message;
        return;
    }

    if (
        message?.event ===
            "protocol-mismatch"
    ) {
        titlebarLastNativeStatus =
            message;
        titlebarProtocolReady =
            false;
        stopTitlebarReconcileLoop();
        try {
            titlebarPort?.disconnect();
        } catch {
        }
        return;
    }

    if (
        message?.event ===
            "claim-accepted"
    ) {
        /*
         * Claims are idempotent. Leave any already scheduled onboarding probes
         * alive so concurrent Wide surfaces cannot cancel each other. A real
         * unmanaged-window transition cancels the whole generation instead.
         */
        return;
    }

    if (
        message?.event !==
            "action"
    ) {
        return;
    }

    const action =
        message.action;

    Promise.resolve()
        .then(
            async () => {
                if (
                    action ===
                    "landing"
                ) {
                    if (streamShellDisplayProfileCache?.mode === "compact") {
                        await showDashboard();
                    } else {
                        await showLanding(true);
                    }
                    return;
                }

                if (action === "reload") {
                    await reloadLeft();
                    return;
                }

                if (
                    PROVIDERS[
                        action
                    ]
                ) {
                    await switchProvider(
                        action
                    );
                    return;
                }

                if (
                    action ===
                    "dashboard"
                ) {
                    await showDashboard();
                    requestTitlebarFocus(
                        streamShellDisplayProfileCache?.mode === "compact" ? "left" : "right"
                    );
                    return;
                }

                if (
                    action ===
                    "settings"
                ) {
                    await showDashboard();
                    requestTitlebarFocus(
                        streamShellDisplayProfileCache?.mode === "compact" ? "left" : "right"
                    );

                    const state =
                        await chrome.storage.local.get([
                            "leftMode",
                            "activeProvider"
                        ]);

                    const provider =
                        PROVIDERS[state.leftMode]
                            ? state.leftMode
                            : (
                                PROVIDERS[state.activeProvider]
                                    ? state.activeProvider
                                    : "youtube"
                            );

                    try {
                        await chrome.runtime.sendMessage({
                            type:
                                "dashboard-toggle-settings",

                            provider
                        });
                    } catch {
                    }

                    return;
                }

                if (
                    action ===
                    "discord"
                ) {
                    await showDiscord();
                    return;
                }

                if (
                    action ===
                    "twitch"
                ) {
                    await showTwitch("resume");
                    return;
                }

                if (
                    action ===
                    "kill"
                ) {
                    await killStreamShell();
                }
            }
        )
        .catch(
            error => {
                console.error(
                    "Native titlebar action failed:",
                    error
                );
            }
        );
}


