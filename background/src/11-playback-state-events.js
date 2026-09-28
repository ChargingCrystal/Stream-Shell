async function reconcileCompactFocusedSurface(
    focusedWindowId
) {
    if (
        shuttingDown ||
        streamShellDisplayProfileCache?.mode !==
            "compact" ||
        !Number.isInteger(
            focusedWindowId
        ) ||
        focusedWindowId ===
            chrome.windows.WINDOW_ID_NONE
    ) {
        return false;
    }

    const state =
        await chrome.storage.local.get([
            "providerWindows",
            "dashboardWindowId",
            "activeProvider",
            "leftMode"
        ]);

    const providerWindows =
        state.providerWindows ||
        {};

    /*
     * Dashboard is a Compact Home surface. If Windows activates it while
     * a provider is still the intended surface, that is not a user navigation
     * request; restore the intended provider immediately instead of rewriting
     * leftMode to Dashboard.
     */
    if (
        focusedWindowId ===
            state.dashboardWindowId
    ) {
        const intendedProvider =
            PROVIDERS[state.leftMode]
                ? state.leftMode
                : null;

        const intendedWindowId =
            intendedProvider
                ? providerWindows[
                    intendedProvider
                ]
                : null;

        if (
            intendedProvider &&
            Number.isInteger(
                intendedWindowId
            )
        ) {
            try {
                await chrome.windows.get(
                    intendedWindowId
                );
                await restoreWindow(
                    intendedWindowId,
                    LEFT,
                    true
                );

                return true;
            } catch {
            }
        }

        if (
            state.leftMode !==
                "dashboard"
        ) {
            await chrome.storage.local.set({
                leftMode:
                    "dashboard"
            });
        }

        return false;
    }

    const focusedProviderEntry =
        Object.entries(
            providerWindows
        )
            .find(
                ([provider, windowId]) =>
                    PROVIDERS[provider] &&
                    windowId ===
                        focusedWindowId
            );

    if (
        !focusedProviderEntry
    ) {
        /* A normal Opera/browser window is not Stream Shell. Preserve intent. */
        return false;
    }

    const focusedProvider =
        focusedProviderEntry[0];

    if (
        state.leftMode !==
            focusedProvider ||
        state.activeProvider !==
            focusedProvider
    ) {
        await chrome.storage.local.set({
            activeProvider:
                focusedProvider,
            leftMode:
                focusedProvider
        });
    }

    return false;
}


async function reconcileProviderPlaybackWindows() {
    if (
        shuttingDown
    ) {
        return;
    }


    const providerWindows =
        await getProviderWindows();

    const keysToRemove =
        [];


    for (
        const [provider, windowId]
        of Object.entries(
            providerWindows
        )
    ) {
        try {
            const window =
                await chrome.windows.get(
                    windowId
                );


            if (
                window.state ===
                    "minimized"
            ) {
                keysToRemove.push(
                    `streamShellNowPlaying_${provider}`
                );
            }

        } catch {
            keysToRemove.push(
                `streamShellNowPlaying_${provider}`
            );
        }
    }


    if (
        keysToRemove.length
    ) {
        await chrome.storage.local.remove(
            keysToRemove
        );
    }
}


async function broadcastState() {
    if (
        shuttingDown
    ) {
        return;
    }

    const [
        state,
        landingExposed,
        titlebarVisibilityMode
    ] =
        await Promise.all([
            chrome.storage.local.get([
                "activeProvider",
                "leftMode",
                "rightMode",
                "twitchTarget"
            ]),
            isLandingExposed(),
            getTitlebarVisibilityMode()
        ]);

    if (
        shuttingDown
    ) {
        return;
    }

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        titlebarVisibilityMode,
        state.twitchTarget ||
            "resume"
    );

    const twitchWorkspace =
        await getTwitchWorkspaceV2Summary().catch(() => ({ active: false, slots: [] }));

    try {
        await chrome.runtime.sendMessage({
            type:
                "state-changed",

            activeProvider:
                state.activeProvider ||
                "netflix",

            leftMode:
                state.leftMode ||
                "landing",

            rightMode:
                state.rightMode ||
                "dashboard",

            twitchTarget:
                state.twitchTarget ||
                "resume",

            twitchWorkspace,

            landingExposed
        });
    } catch {
    }

    broadcastProviderResourceWindowStates()
        .catch(() => {});
}


chrome.tabs.onUpdated.addListener(
    (tabId, changeInfo, tab) => {
        if (
            shuttingDown ||
            tab?.active !== true ||
            !Number.isInteger(
                tab?.windowId
            ) ||
            !(
                typeof changeInfo?.title === "string" ||
                changeInfo?.status === "complete"
            )
        ) {
            return;
        }

        /* Workspace slots are already explicitly claimed as A-D. Re-running the
         * generic focused-surface claimant on Twitch title/status changes only
         * creates duplicate native work while the user navigates inside a slot. */
        isTwitchWorkspaceV2WindowId(tab.windowId)
            .then(isWorkspaceWindow => {
                if (isWorkspaceWindow) {
                    /* A-D HWND identity is stable across Twitch SPA navigation. Queue
                     * exactly one member claim as soon as the first real title/status
                     * arrives instead of relying on fixed startup timing. */
                    return claimTwitchWorkspaceV2WindowById(tab.windowId);
                }
                return claimFocusedTitlebarSurface(tab.windowId);
            })
            .catch(() => {});
    }
);


chrome.windows.onFocusChanged.addListener(
    focusedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

        let twitchWorkspaceFastPath = false;

        /*
         * Focus loss is not a fullscreen-exit signal. Chromium can keep a
         * managed provider in true fullscreen while another application owns
         * the foreground. The provider fullscreen event, provider/window
         * teardown and explicit surface changes remain authoritative.
         */

        Promise.resolve()
            .then(
                async () => {
                    const state =
                        await chrome.storage.local.get([
                            "providerWindows",
                            "landingWindowId",
                            "dashboardWindowId",
                            TWITCH_WINDOW_STORAGE_KEY,
                            TWITCH_WORKSPACE_V2_STORAGE_KEY
                        ]);

                    const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
                    const workspaceWindowIds = [
                        workspaceRecord?.slots?.a?.windowId,
                        workspaceRecord?.slots?.b?.windowId,
                        workspaceRecord?.slots?.c?.windowId,
                        workspaceRecord?.slots?.d?.windowId,
                        workspaceRecord?.chat?.windowId
                    ];

                    const managedWindowIds =
                        new Set([
                            state.landingWindowId,
                            state.dashboardWindowId,
                            state[TWITCH_WINDOW_STORAGE_KEY],
                            ...workspaceWindowIds,
                            ...Object.values(
                                state.providerWindows || {}
                            )
                        ].filter(Number.isInteger));

                    const workspaceSlotId =
                        getTwitchWorkspaceV2SlotByWindowId(workspaceRecord, focusedWindowId);
                    const workspaceChatFocused =
                        workspaceRecord?.chat?.windowId === focusedWindowId;

                    if (workspaceSlotId || workspaceChatFocused) {
                        /* A -> C -> B focus changes are ordinary interaction inside
                         * one Twitch surface, not provider transitions. Keep them off
                         * the global reconcile/broadcast path. Record the focused slot
                         * with one lightweight storage write so only that slot renders
                         * the shared floating workspace bar. */
                        twitchWorkspaceFastPath = true;
                        if (workspaceSlotId && workspaceRecord?.selectedSlot !== workspaceSlotId) {
                            await chrome.storage.local.set({
                                [TWITCH_WORKSPACE_V2_STORAGE_KEY]: {
                                    ...workspaceRecord,
                                    selectedSlot: workspaceSlotId,
                                    updatedAt: Date.now()
                                }
                            }).catch(() => {});
                        }
                        raiseTwitchWorkspaceV2NativeCluster(
                            workspaceSlotId || workspaceRecord?.selectedSlot || "a"
                        );
                        return null;
                    }

                    if (
                        !managedWindowIds.has(
                            focusedWindowId
                        )
                    ) {
                        cancelTitlebarClaimRetries(
                            true
                        );
                    }

                    return reconcileCompactFocusedSurface(
                        focusedWindowId
                    );
                }
            )
            .then(
                () => {
                    if (twitchWorkspaceFastPath) return null;
                    return Promise.allSettled([
                        syncDiscordVisibilityState(),
                        reconcileProviderPlaybackWindows(),
                        claimFocusedTitlebarSurface(
                            focusedWindowId
                        )
                    ]);
                }
            )
            .finally(
                () => {
                    if (twitchWorkspaceFastPath) return;
                    broadcastState()
                        .catch(
                            () => {}
                        );
                }
            );
    }
);


chrome.windows.onBoundsChanged.addListener(
    changedWindow => {
        if (
            shuttingDown
        ) {
            return;
        }

        isTwitchWorkspaceV2WindowId(changedWindow?.id)
            .then(isWorkspaceWindow => {
                if (isWorkspaceWindow) return null;
                return reconcileProviderPlaybackWindows()
                    .catch(() => {})
                    .finally(() => {
                        broadcastState().catch(() => {});
                    });
            })
            .catch(() => {});
    }
);


chrome.windows.onRemoved.addListener(
    async removedWindowId => {
        if (
            shuttingDown
        ) {
            return;
        }

        if (removedWindowId === titlebarFullscreenWindowId) {
            titlebarFullscreenActive = false;
            titlebarFullscreenWindowId = null;
        }

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

        let providersChanged =
            false;


        const removedProviders =
            [];


        for (
            const [name, windowId]
            of Object.entries(
                providerWindows
            )
        ) {
            if (
                windowId ===
                removedWindowId
            ) {
                delete providerWindows[
                    name
                ];


                removedProviders.push(
                    name
                );


                providersChanged =
                    true;
            }
        }

        if (
            providersChanged
        ) {
            await saveProviderWindows(
                providerWindows
            );


            await chrome.storage.local.remove(
                removedProviders.map(
                    name =>
                        `streamShellNowPlaying_${name}`
                )
            );

            for (const provider of removedProviders) {
                recordFlightEvent({
                    source: "background",
                    category: "provider-window",
                    action: "closed",
                    provider,
                    detail: { windowId: removedWindowId }
                }).catch(() => {});
            }
        }

        if (
            stored.landingWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "landingWindowId"
            );
        }

        if (
            stored.dashboardWindowId ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                "dashboardWindowId"
            );
        }

        if (
            stored[TWITCH_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_WINDOW_STORAGE_KEY
            );
            await chrome.storage.session.remove(
                TWITCH_RAID_GUARD_SESSION_KEY
            ).catch(() => {});


            const rightState = await chrome.storage.local.get("rightMode");
            if (rightState.rightMode === "twitch") {
                await showDashboard().catch(async () => {
                    await chrome.storage.local.set({ rightMode: "dashboard" });
                    await broadcastState();
                });
            }
        }

        if (
            stored[TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY] ===
            removedWindowId
        ) {
            await chrome.storage.local.remove(
                TWITCH_DROPS_WORKER_WINDOW_STORAGE_KEY
            ).catch(() => {});
        }

    }
);