chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {
        // Unexpected or malformed extension messages must not throw from the
        // background listener. Unknown message types are left to other listeners.
        if (!message || typeof message !== "object" || typeof message.type !== "string") {
            return false;
        }

        if (
            message.type ===
                "kill-stream-shell" ||

            message.type ===
                "dashboard-kill-stream-shell"
        ) {
            if (
                message.type ===
                    "dashboard-kill-stream-shell" &&

                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            killStreamShell()
                .catch(
                    error => {
                        console.error(
                            "Kill switch failed:",
                            error
                        );
                    }
                );

            return;
        }


        if (
            message.type ===
                "popup-open-shell" ||
            message.type ===
                "popup-open-direct" ||
            message.type ===
                "popup-save-direct-link"
        ) {
            if (
                !isPopupSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid popup sender."
                });

                return;
            }


            if (
                message.type ===
                "popup-save-direct-link"
            ) {
                saveDirectLinkFromBrowser(
                    message.url,
                    message.title
                )
                    .then(
                        saved => {
                            sendResponse({
                                ok:
                                    Boolean(
                                        saved
                                    )
                            });
                        }
                    )
                    .catch(
                        error => {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    error.message
                            });
                        }
                    );

                return true;
            }


            shuttingDown =
                false;


            const opening =
                message.type ===
                    "popup-open-direct"
                    ? chrome.storage.local
                        .set({
                            streamShellPendingLandingPanel:
                                "direct"
                        })
                        .then(
                            () =>
                                openShellHome()
                        )
                    : openShellWarmLastProvider();


            opening
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (message.type === "dashboard-settings-visibility") {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }
            return streamShellRespondAsync(
                sendResponse,
                () => setTitlebarSettingsOpen(message.open === true),
                { success: () => ({ ok: true }), failure: () => ({ ok: false }) }
            );
        }


        if (
            message.type ===
                "provider-fullscreen-state"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.windowId)
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) {
                        sendResponse({ ok: false });
                        return;
                    }

                    const active = message.active === true;

                    if (active) {
                        titlebarFullscreenWindowId = sender.tab.windowId;
                        titlebarFullscreenActive = true;
                    } else if (
                        titlebarFullscreenWindowId === sender.tab.windowId
                    ) {
                        titlebarFullscreenWindowId = null;
                        titlebarFullscreenActive = false;
                    }

                    await syncConnectedTitlebarNative().catch(() => {});
                    sendResponse({ ok: true });
                })
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
                "provider-volume-fullscreen-bridge"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.id) ||
                !Number.isInteger(sender.tab.windowId) ||
                (
                    message.action !== "suspend" &&
                    message.action !== "resume"
                )
            ) {
                sendResponse({
                    ok: false,
                    suspended: false,
                    resumed: false
                });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(managed => {
                    if (!managed) {
                        sendResponse({
                            ok: false,
                            suspended: false,
                            resumed: false
                        });
                        return;
                    }

                    const operation =
                        message.action === "suspend"
                            ? suspendVolumeCaptureForFullscreen(sender.tab.id)
                            : resumeVolumeCaptureAfterFullscreen(sender.tab.id);

                    return operation.then(sendResponse);
                })
                .catch(error => {
                    sendResponse({
                        ok: false,
                        suspended: false,
                        resumed: false,
                        error: String(error?.message || error || "Fullscreen audio bridge failed.")
                    });
                });

            return true;
        }


        if (
            message.type ===
                "stream-shell-flight-event"
        ) {
            const event = message.event || {};
            if (
                !sender.tab ||
                !Number.isInteger(sender.tab.windowId) ||
                !PROVIDERS[event.provider]
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(sender.tab.windowId)
                .then(managed => {
                    if (!managed) {
                        sendResponse({ ok: false });
                        return;
                    }

                    return recordFlightEvent({
                        source: "provider",
                        category: event.category,
                        action: event.action,
                        level: event.level,
                        provider: event.provider,
                        detail: event.detail
                    }).then(() => sendResponse({ ok: true }));
                })
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (message.type === "dashboard-flight-event") {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }
            const event = message.event || {};
            return streamShellRespondAsync(
                sendResponse,
                () => recordFlightEvent({
                    source: "dashboard",
                    category: event.category,
                    action: event.action,
                    level: event.level,
                    provider: event.provider,
                    detail: event.detail
                }),
                { success: () => ({ ok: true }), failure: () => ({ ok: false }) }
            );
        }


        if (message.type === "dashboard-diagnostics-repair") {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }
            return streamShellRespondAsync(
                sendResponse,
                () => runStreamShellProviderRepair(message.provider, message.action),
                { fallback: "Repair failed." }
            );
        }


        // v0.20.10: rich, synchronous panel diagnostics. This intentionally
        // observes *existing* caches only. It does not enumerate windows,
        // query storage, invoke the native helper or probe provider renderers.
        if (message.type === "dashboard-diagnostics-lite") {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }
            const cached = shellWideFocusCache;
            const workspace = cached[TWITCH_WORKSPACE_V2_STORAGE_KEY];
            const selfTest = cached[STREAM_SHELL_SELF_TEST_KEY] || null;
            const registeredProviderWindows = cached.providerWindows || {};
            const providerDiagnostics = Object.fromEntries(
                Object.keys(PROVIDERS).map(provider => {
                    const windowId = registeredProviderWindows[provider];
                    const known = Number.isInteger(windowId);
                    const reportEntry = selfTest?.providers?.[provider];
                    // Window liveness must not be inferred from an ID: only a
                    // cached test is available, not a current live probe.
                    return [provider, {
                        known,
                        alive: known && reportEntry?.windowAlive === true ? true : null,
                        windowId: known ? windowId : null,
                        cached: true,
                        page: null
                    }];
                })
            );
            const workspaceWindows = TWITCH_WORKSPACE_V2_SLOT_IDS.map(id => {
                const slot = workspace?.slots?.[id];
                const windowId = slot?.windowId;
                const claim = Number.isInteger(windowId)
                    ? twitchWorkspaceV2ClaimStates.get(windowId)
                    : null;
                return {
                    slot: id,
                    id: Number.isInteger(windowId) ? windowId : null,
                    kind: slot?.kind || 'empty',
                    configuredUrl: slot?.url || null,
                    configuredMuted: slot?.audioMuted !== false,
                    state: Number.isInteger(windowId) ? 'registered' : null,
                    twitchRuntimeStatus: Number.isInteger(windowId) ? 'not-probed' : 'not-opened',
                    cached: true,
                    nativeClaim: claim ? {
                        phase: claim.phase,
                        member: claim.member,
                        attempts: claim.attempts,
                        sentAgoMs: Math.max(0, Date.now() - claim.sentAt),
                        acknowledgedAgoMs: claim.acknowledgedAt
                            ? Math.max(0, Date.now() - claim.acknowledgedAt) : null,
                        forceRebindPending: twitchWorkspaceV2ForceRebindIds.has(windowId)
                    } : null
                };
            });
            const providerIds = Object.values(registeredProviderWindows).filter(Number.isInteger);
            const knownShellWindows = [cached.landingWindowId, cached.dashboardWindowId, ...providerIds,
                ...workspaceWindows.map(item => item.id)].filter(Number.isInteger);
            sendResponse({
                ok: true,
                diagnosticsMode: 'runtime-cached',
                cacheReady: shellWideFocusCacheReady,
                activeProvider: cached.activeProvider || null,
                leftMode: cached.leftMode || 'landing',
                rightMode: cached.rightMode || 'dashboard',
                // This is managed-window count, not Opera's browser-wide total.
                managedWindowsRegistered: new Set(knownShellWindows).size,
                browserWindowsTotal: null,
                providerWindowsKnown: providerIds.length,
                providerWindowsAlive: null,
                providerWindows: providerDiagnostics,
                landingWindowRegistered: Number.isInteger(cached.landingWindowId),
                dashboardWindowRegistered: Number.isInteger(cached.dashboardWindowId),
                launchSelfTest: selfTest,
                displayProfile: streamShellDisplayProfileCache || null,
                twitchWorkspaceV2: {
                    active: !!workspace,
                    version: workspace?.version || TWITCH_WORKSPACE_V2_VERSION,
                    visible: cached.rightMode === 'twitch',
                    covered: cached.rightMode !== 'twitch',
                    selectedSlot: workspace?.selectedSlot || null,
                    activationCount: workspace?.activationCount || 0,
                    nativeClusterMembers: titlebarLastNativeStatus?.twitchClusterMembers ?? null,
                    nativeClusterMap: titlebarLastNativeStatus?.twitchClusterMap || null,
                    updatedAt: workspace?.updatedAt || null,
                    windows: workspaceWindows
                },
                titlebarConnected: Boolean(titlebarPort),
                titlebarProtocolReady: titlebarProtocolReady === true,
                titlebarProtocolVersion: TITLEBAR_PROTOCOL_VERSION,
                titlebarReconcileIntervalMs: TITLEBAR_RECONCILE_INTERVAL_MS,
                titlebarNativeStatus: titlebarLastNativeStatus,
                titlebarVisibilityMode: shellWideFocusVisibility || 'unknown',
                titlebarSettingsOpen: titlebarSettingsOpen === true,
                titlebarVolumeActive: titlebarVolumeActive === true,
                titlebarArtwork: Object.fromEntries(streamShellTitlebarArtworkStatus),
                titlebarProviderSync: {
                    phase: titlebarProviderSyncPhase,
                    generation: titlebarProviderGeneration,
                    acknowledgedGeneration: titlebarProviderAckGeneration,
                    lastSentAt: titlebarProviderLastSentAt,
                    lastAcknowledgedAt: titlebarProviderLastAckAt,
                    skippedIcons: titlebarProviderLastRejectedIconCount,
                    lastError: titlebarProviderLastError
                },
                // Absence of an IPC probe does NOT mean Discord has failed.
                discord: null,
                offscreenDocumentAlive: null,
                audio: null,
                flightRecorder: {
                    format: 'stream-shell-flight-recorder', version: 1,
                    count: flightRecorderEvents.length,
                    maxEvents: STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS,
                    updatedAt: flightRecorderEvents.at(-1)?.at || null,
                    events: flightRecorderEvents.slice(-60)
                },
                runtimeCounters: {
                    focusEvents: shellWideFocusEventCount,
                    lastFocusId: shellWideFocusLastId,
                    focusCacheReady: shellWideFocusCacheReady,
                    eventQueuePending: shellWindowEventPendingCount,
                    eventQueueRunning: shellWindowEventRunning,
                    transitionActive: streamShellTransitionActive,
                    transitionWaiters: streamShellTransitionWaiters,
                    rendererLaunchKind: streamShellLastRendererLaunchKind,
                    rendererLastLaunchAt: streamShellLastRendererLaunchFinishedAt,
                    nativeSlowAuditSkippedUnmanaged: titlebarSlowReconcileSkippedUnmanaged,
                    nativeSlowAuditLastRunAt: titlebarSlowReconcileLastRanAt,
                    nativeSlowAuditDeferred: shouldDeferTitlebarSlowReconcile()
                }
            });
            return;
        }

        if (
            message.type ===
                "dashboard-diagnostics"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            Promise.all([
                chrome.storage.local.get([
                    "activeProvider",
                    "leftMode",
                    "rightMode",
                    "providerWindows",
                    "landingWindowId",
                    "dashboardWindowId",
                    "streamShellLaunchSelfTest"
                ]),
                chrome.windows.getAll({
                    populate:
                        false
                }),
                getDiscordNativeStatus(),
                getVolumeCaptureSession(),
                getTitlebarVisibilityMode(),
                getFlightRecorderSnapshot(message.full === true ? null : 60),
                getStreamShellDisplayProfile()
            ])
                .then(
                    async ([
                        state,
                        browserWindows,
                        discord,
                        volumeSession,
                        titlebarVisibilityMode,
                        flightRecorder,
                        displayProfile
                    ]) => {
                        const aliveIds =
                            new Set(
                                browserWindows
                                    .map(window => window.id)
                                    .filter(Number.isInteger)
                            );

                        const providerWindowIds =
                            Object.values(
                                state.providerWindows ||
                                {}
                            )
                                .filter(Number.isInteger);

                        const fullDiagnostics = message.full === true;
                        const diagnosticsActiveProvider = PROVIDERS[state.activeProvider]
                            ? state.activeProvider
                            : (PROVIDERS[state.leftMode] ? state.leftMode : null);
                        const providerDiagnostics =
                            await collectProviderDiagnosticsForDashboard(
                                state.providerWindows || {},
                                browserWindows,
                                {
                                    activeProvider: diagnosticsActiveProvider,
                                    full: fullDiagnostics
                                }
                            );

                        const launchSelfTest =
                            state.streamShellLaunchSelfTest ||
                            null;

                        const twitchSplitLab =
                            await getTwitchSplitLabDiagnostics();

                        const twitchWorkspaceV2 =
                            await getTwitchWorkspaceV2Diagnostics();

                        let offscreenDocumentAlive = false;
                        try {
                            const contexts = await chrome.runtime.getContexts({
                                contextTypes: ["OFFSCREEN_DOCUMENT"]
                            });
                            offscreenDocumentAlive = contexts.length > 0;
                        } catch {
                        }

                        sendResponse({
                            ok: true,
                            diagnosticsMode: fullDiagnostics ? "full" : "panel",
                            activeProvider: state.activeProvider || null,
                            leftMode: state.leftMode || "landing",
                            rightMode: state.rightMode || "dashboard",
                            browserWindowsTotal: browserWindows.length,
                            providerWindowsKnown: providerWindowIds.length,
                            providerWindowsAlive: providerWindowIds.filter(id => aliveIds.has(id)).length,
                            providerWindows: providerDiagnostics,
                            launchSelfTest,
                            landingWindowAlive:
                                Number.isInteger(state.landingWindowId) &&
                                aliveIds.has(state.landingWindowId),
                            dashboardWindowAlive:
                                Number.isInteger(state.dashboardWindowId) &&
                                aliveIds.has(state.dashboardWindowId),
                            titlebarConnected: Boolean(titlebarPort),
                            titlebarProtocolReady: titlebarProtocolReady === true,
                            titlebarProtocolVersion: TITLEBAR_PROTOCOL_VERSION,
                            titlebarReconcileIntervalMs: TITLEBAR_RECONCILE_INTERVAL_MS,
                            titlebarNativeStatus: titlebarLastNativeStatus,
                            titlebarArtwork: Object.fromEntries(streamShellTitlebarArtworkStatus),
                            titlebarProviderSync: {
                                phase: titlebarProviderSyncPhase,
                                generation: titlebarProviderGeneration,
                                acknowledgedGeneration: titlebarProviderAckGeneration,
                                lastSentAt: titlebarProviderLastSentAt,
                                lastAcknowledgedAt: titlebarProviderLastAckAt,
                                skippedIcons: titlebarProviderLastRejectedIconCount,
                                lastError: titlebarProviderLastError
                            },
                            titlebarVisibilityMode: titlebarVisibilityMode || "unknown",
                            titlebarSettingsOpen: titlebarSettingsOpen === true,
                            titlebarVolumeActive: titlebarVolumeActive === true,
                            discord,
                            offscreenDocumentAlive,
                            flightRecorder,
                            displayProfile,
                            twitchSplitLab,
                            twitchWorkspaceV2,
                            cacheReady: shellWideFocusCacheReady,
                            runtimeCounters: {
                                focusEvents: shellWideFocusEventCount,
                                lastFocusId: shellWideFocusLastId,
                                focusCacheReady: shellWideFocusCacheReady,
                                eventQueuePending: shellWindowEventPendingCount,
                                eventQueueRunning: shellWindowEventRunning,
                                transitionActive: streamShellTransitionActive,
                                transitionWaiters: streamShellTransitionWaiters,
                                rendererLaunchKind: streamShellLastRendererLaunchKind,
                                rendererLastLaunchAt: streamShellLastRendererLaunchFinishedAt,
                                nativeSlowAuditSkippedUnmanaged: titlebarSlowReconcileSkippedUnmanaged,
                                nativeSlowAuditLastRunAt: titlebarSlowReconcileLastRanAt,
                                nativeSlowAuditDeferred: shouldDeferTitlebarSlowReconcile()
                            },
                            audio:
                                volumeSession
                                    ? {
                                        active: true,
                                        provider: volumeSession.provider || null,
                                        percent: volumeSession.percent ?? null,
                                        profile: volumeSession.profile || null,
                                        tabId: Number.isInteger(volumeSession.tabId) ? volumeSession.tabId : null
                                    }
                                    : {
                                        active: false,
                                        provider: null,
                                        percent: null,
                                        profile: null,
                                        tabId: null
                                    }
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok: false,
                            error: error?.message || "Diagnostics failed."
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "provider-api-self-test-report"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !PROVIDERS[
                    message.provider
                ]
            ) {
                sendResponse({ ok: false });
                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (!managed) {
                            sendResponse({ ok: false });
                            return;
                        }

                        return updateProviderSelfTestReport(
                            message.provider,
                            message.report
                        )
                            .then(
                                ok => {
                                    sendResponse({ ok: ok === true });
                                }
                            );
                    }
                )
                .catch(
                    () => {
                        sendResponse({ ok: false });
                    }
                );

            return true;
        }


        if (
            shuttingDown
        ) {
            sendResponse({
                ok:
                    false,

                error:
                    "Stream Shell is shut down."
            });

            return;
        }


        if (
            message.type ===
            "provider-resource-state"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                )
            ) {
                sendResponse({
                    managed: false
                });

                return;
            }

            getProviderResourceWindowState(
                sender.tab.windowId
            )
                .then(sendResponse)
                .catch(
                    () => {
                        sendResponse({
                            managed: false
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "provider-now-playing-eligible"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                )
            ) {
                sendResponse({
                    eligible:
                        false
                });

                return;
            }


            Promise.all([
                isManagedProviderWindow(
                    sender.tab.windowId
                ),
                chrome.windows.get(
                    sender.tab.windowId
                )
            ])
                .then(
                    ([managed, window]) => {
                        sendResponse({
                            eligible:
                                Boolean(
                                    managed &&
                                    window?.state !==
                                        "minimized"
                                )
                        });
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            eligible:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "is-stream-shell-twitch-window"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ managed: false });
                return;
            }

            isStreamShellTwitchAutomationWindow(sender.tab.windowId)
                .then(managed => sendResponse({ managed }))
                .catch(() => sendResponse({ managed: false }));

            return true;
        }


        if (
            message.type ===
            "is-stream-shell-window"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    managed:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        sendResponse({
                            managed
                        });
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            managed:
                                false
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
                "crunchyroll-skip-events"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !/\.crunchyroll\.com\//i.test(
                    String(
                        sender.tab.url ||
                        ""
                    )
                )
            ) {
                sendResponse({
                    ok: false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    async managed => {
                        if (!managed) {
                            return {
                                ok: false
                            };
                        }

                        const events =
                            await fetchCrunchyrollSkipEvents(
                                message.episodeId
                            );

                        return {
                            ok: Boolean(events),
                            events: events || {}
                        };
                    }
                )
                .then(sendResponse)
                .catch(
                    () => sendResponse({
                        ok: false,
                        events: {}
                    })
                );

            return true;
        }


        if (
            message.type ===
                "youtube-set-quality"
        ) {
            if (
                !sender.tab ||
                !Number.isInteger(
                    sender.tab.id
                ) ||
                !Number.isInteger(
                    sender.tab.windowId
                ) ||
                !/\.youtube\.com\//i.test(
                    String(
                        sender.tab.url ||
                        ""
                    )
                )
            ) {
                sendResponse({
                    ok:
                        false
                });


                return;
            }


            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            return {
                                ok:
                                    false
                            };
                        }


                        return chrome.scripting.executeScript({
                            target: {
                                tabId:
                                    sender.tab.id
                            },

                            world:
                                "MAIN",

                            func:
                                applyYouTubeQualityInMainWorld,

                            args: [
                                String(
                                    message.preferred ||
                                    "hd1080"
                                )
                            ]
                        })
                            .then(
                                results =>
                                    results?.[0]?.result ||
                                    {
                                        ok:
                                            false
                                    }
                            );
                    }
                )
                .then(
                    result => {
                        sendResponse(
                            result ||
                            {
                                ok:
                                    false
                            }
                        );
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            ok:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "dashboard-switch-provider"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid dashboard sender."
                });

                return;
            }

            Promise.resolve()
                .then(
                    async () => {
                        const compact = streamShellDisplayProfileCache?.mode === "compact";
                        // A provider button (including Now Playing) changes the
                        // LEFT pane only. Do not touch the Discord native host
                        // on the right in Wide mode; even a no-op hide call can
                        // perturb the sibling Opera window z-order.
                        if (compact) {
                            const rightState = await chrome.storage.local.get("rightMode");
                            if (rightState.rightMode === "discord") {
                                await hideDiscordForDashboard();
                            }
                        }

                        await switchProvider(
                            message.provider
                        );
                    }
                )
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Dashboard provider switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "switch-provider"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    "Provider switch rejected."
                            });

                            return;
                        }

                        return switchProvider(
                            message.provider
                        )
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Provider switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "landing-show-twitch-workspace"
        ) {
            if (!isShellHomeUiSender(sender)) {
                sendResponse({ ok: false, error: "Invalid landing sender." });
                return;
            }

            showTwitchWorkspaceV2("workspace")
                .then(status => sendResponse({ ok: true, status }))
                .catch(error => {
                    console.error("Twitch workspace failed:", error);
                    sendResponse({ ok: false, error: error.message });
                });

            return true;
        }


        if (
            message.type ===
            "landing-show-twitch"
        ) {
            if (!isShellHomeUiSender(sender)) {
                sendResponse({ ok: false, error: "Invalid landing sender." });
                return;
            }

            const target = message.target === "drops" ? "drops" : "resume";
            showTwitch(target)
                .then(() => sendResponse({ ok: true }))
                .catch(error => {
                    console.error("Twitch utility failed:", error);
                    sendResponse({ ok: false, error: error.message });
                });

            return true;
        }


        // The heavy Twitch automation is optional; the early utility requests
        // it only after slot-staggering. The injection is document- and frame-
        // scoped, like the lazy HUD, to avoid stale work after navigation.
        if (message.type === "twitch-workspace-v2-load-automation") {
            const tab = sender.tab;
            if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId) ||
                sender.frameId !== 0 || !sender.documentId || !isTwitchUrl(tab.url)) {
                sendResponse({ ok: false, error: "Invalid Twitch automation sender." });
                return;
            }
            getTwitchWorkspaceV2Context(tab.windowId).then(async context => {
                if (!context?.managed || context?.role !== "slot" ||
                    !["a", "b", "c", "d"].includes(context.slotId)) {
                    sendResponse({ ok: false, error: "Not a managed Twitch V2 slot." });
                    return;
                }
                // Fail closed if the Chromium document identifier is absent:
                // never inject an old slot's deferred script into a new page.
                const target = { tabId: tab.id, documentIds: [sender.documentId] };
                try {
                    await chrome.scripting.executeScript({
                        target,
                        files: ["providers/player/twitch-automation.js"]
                    });
                    sendResponse({ ok: true });
                } catch (error) {
                    sendResponse({ ok: false, error: String(error?.message || error) });
                }
            }).catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
            return true;
        }

        // The large Twitch HUD is optional; inject only after a small
        // document_idle admission script verifies its managed V2 slot.
        if (message.type === "twitch-workspace-v2-load-hud") {
            const tab = sender.tab;
            if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId) ||
                sender.frameId !== 0 || !isTwitchUrl(tab.url)) {
                sendResponse({ ok: false, error: "Invalid Twitch HUD sender." });
                return;
            }

            getTwitchWorkspaceV2Context(tab.windowId).then(async context => {
                if (!context?.managed || context?.role !== "slot" ||
                    !["a", "b", "c", "d"].includes(context.slotId)) {
                    sendResponse({ ok: false, error: "Not a managed Twitch V2 slot." });
                    return;
                }
                // documentIds pins injection to the requesting document,
                // preventing a quick navigation from receiving stale HUD work.
                // Chromium/Opera GX MV3 exposes sender.documentId.
                const target = sender.documentId
                    ? { tabId: tab.id, documentIds: [sender.documentId] }
                    : { tabId: tab.id, frameIds: [0] };
                try {
                    await chrome.scripting.executeScript({
                        target,
                        files: ["providers/player/twitch-workspace-v2.js"]
                    });
                    sendResponse({ ok: true });
                } catch (error) {
                    sendResponse({ ok: false, error: String(error?.message || error) });
                }
            }).catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
            return true;
        }


        if (
            message.type ===
            "get-stream-shell-twitch-workspace-context"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ managed: false });
                return;
            }

            getTwitchWorkspaceV2Context(sender.tab.windowId)
                .then(context => sendResponse(context))
                .catch(() => sendResponse({ managed: false }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-assign-slot"
        ) {
            const requestedSlotId = String(message.slotId || "").toLowerCase();
            if (
                isShellHomeUiSender(sender) ||
                isTwitchWorkspaceSlotUiSender(sender, requestedSlotId)
            ) {
                assignTwitchWorkspaceV2Slot(
                    requestedSlotId,
                    message.input,
                    message.kind,
                    true
                )
                    .then(() => sendResponse({ ok: true }))
                    .catch(error => sendResponse({ ok: false, error: error.message }));
                return true;
            }

            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return assignTwitchWorkspaceV2Slot(
                        String(message.slotId || "").toLowerCase(),
                        message.input,
                        message.kind,
                        true
                    );
                })
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-clear-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return clearTwitchWorkspaceV2Slot(String(message.slotId || "").toLowerCase());
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-set-muted"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return setTwitchWorkspaceV2SlotMuted(slotId, message.muted === true);
                })
                .then(muted => sendResponse({ ok: true, muted }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-set-raid-protection"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return setTwitchWorkspaceV2SlotRaidProtection(
                        slotId,
                        message.enabled === true
                    );
                })
                .then(enabled => sendResponse({ ok: true, enabled }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-reload-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return reloadTwitchWorkspaceV2Slot(slotId);
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-toggle-pane-fullscreen"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    const record = await getTwitchWorkspaceV2Record();
                    if (getTwitchWorkspaceV2SlotByWindowId(record, sender.tab.windowId) !== slotId) {
                        throw new Error("Twitch workspace slot mismatch.");
                    }
                    return toggleTwitchWorkspaceV2PaneFullscreen(slotId);
                })
                .then(result => sendResponse({ ok: true, ...result }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-focus-slot"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            const slotId = String(message.slotId || "").toLowerCase();
            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(async managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    if (!TWITCH_WORKSPACE_V2_SLOT_IDS.includes(slotId)) throw new Error("Invalid Twitch workspace slot.");
                    let record = await getTwitchWorkspaceV2Record();
                    const targetId = record?.slots?.[slotId]?.windowId;
                    if (!Number.isInteger(targetId)) return false;
                    if (record.selectedSlot !== slotId) {
                        record = { ...record, selectedSlot: slotId, updatedAt: Date.now() };
                        await chrome.storage.local.set({ [TWITCH_WORKSPACE_V2_STORAGE_KEY]: record });
                    }
                    await chrome.windows.update(targetId, { focused: true }).catch(() => {});
                    raiseTwitchWorkspaceV2NativeCluster(slotId);
                    return true;
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-raise"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return raiseExistingTwitchWorkspaceV2(String(message.slotId || "").toLowerCase());
                })
                .then(ok => sendResponse({ ok }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-workspace-v2-show"
        ) {
            if (!sender.tab) {
                sendResponse({ ok: false, error: "Unmanaged Twitch workspace sender." });
                return;
            }

            isTwitchWorkspaceV2WindowId(sender.tab.windowId)
                .then(managed => {
                    if (!managed) throw new Error("Unmanaged Twitch workspace sender.");
                    return showTwitchWorkspaceV2("workspace");
                })
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({ ok: false, error: error.message }));
            return true;
        }


        if (
            message.type ===
            "twitch-user-interaction"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            markTwitchUserInteraction(sender.tab)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "twitch-arm-raid-guard"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            armTwitchRaidGuard(sender.tab, message.sourceUrl || sender.tab.url)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "twitch-disarm-raid-guard"
        ) {
            if (!sender.tab || !isTwitchUrl(sender.tab.url)) {
                sendResponse({ ok: false });
                return;
            }

            disarmTwitchRaidGuard(sender.tab)
                .then(ok => sendResponse({ ok }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
            "landing-show-discord"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }

            showDiscord()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Discord desktop failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "get-discord-status"
        ) {
            if (
                !isLandingSender(
                    sender
                ) &&
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    visible:
                        false
                });

                return;
            }


            syncDiscordVisibilityState()
                .then(
                    status => {
                        sendResponse(
                            status
                        );
                    }
                )
                .catch(
                    () => {
                        sendResponse({
                            ok:
                                false,

                            visible:
                                false
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "show-discord"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false
                            });

                            return;
                        }

                        return showDiscord()
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "show-landing"
        ) {
            if (
                !sender.tab
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            isManagedProviderWindow(
                sender.tab.windowId
            )
                .then(
                    managed => {
                        if (
                            !managed
                        ) {
                            sendResponse({
                                ok:
                                    false,

                                error:
                                    "Landing switch rejected."
                            });

                            return;
                        }

                        return showLanding(
                            true
                        )
                            .then(
                                () => {
                                    sendResponse({
                                        ok:
                                            true
                                    });
                                }
                            );
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Landing switch failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "sync-subscriptions"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }


            syncSubscriptions()
                .then(
                    state => {
                        sendResponse({
                            ok:
                                true,

                            state
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Subscription sync failed:",
                            error
                        );


                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (
            message.type ===
            "restore-home-layout"
        ) {
            if (
                !isLandingSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });

                return;
            }

            openShellHome()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        console.error(
                            "Home layout restore failed:",
                            error
                        );

                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "show-dashboard"
        ) {
            showDashboard()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "dashboard-reload-left"
        ) {
            if (
                !isDashboardSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false
                });

                return;
            }

            reloadLeft()
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "landing-resume-provider"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok: false,
                    error: "Invalid landing sender."
                });
                return;
            }

            resumeProviderFromContinue(
                message.provider,
                message.url,
                message.currentTime,
                message.identity
            )
                .then(
                    () => {
                        sendResponse({ ok: true });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok: false,
                            error: error.message
                        });
                    }
                );

            return true;
        }


        if (
            message.type ===
            "open-direct-link"
        ) {
            if (
                !isShellHomeUiSender(
                    sender
                )
            ) {
                sendResponse({
                    ok:
                        false,

                    error:
                        "Invalid landing sender."
                });


                return;
            }


            openDirectLinkInBrowser(
                message.url
            )
                .then(
                    () => {
                        sendResponse({
                            ok:
                                true
                        });
                    }
                )
                .catch(
                    error => {
                        sendResponse({
                            ok:
                                false,

                            error:
                                error.message
                        });
                    }
                );


            return true;
        }


        if (message.type === "get-state") {
            return streamShellRespondAsync(
                sendResponse,
                () => Promise.all([
                    chrome.storage.local.get(["activeProvider", "leftMode", "rightMode"]),
                    isLandingExposed(),
                    getStreamShellDisplayProfile(),
                    getTwitchWorkspaceV2Summary()
                ]),
                {
                    success: ([state, landingExposed, displayProfile, twitchWorkspace]) => ({
                        activeProvider: state.activeProvider || "netflix",
                        leftMode: state.leftMode || "landing",
                        rightMode: state.rightMode || "dashboard",
                        layoutProfile: displayProfile?.mode || "wide",
                        displayProfileOverride: displayProfile?.override || "auto",
                        displayTarget: displayProfile?.targetDisplay?.referenceTarget || null,
                        twitchWorkspace,
                        landingExposed
                    }),
                    fallback: "Unable to read shell state."
                }
            );
        }

    }
);


