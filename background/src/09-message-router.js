chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {
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


        if (
            message.type ===
                "dashboard-settings-visibility"
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

            setTitlebarSettingsOpen(
                message.open === true
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


        if (
            message.type ===
                "dashboard-flight-event"
        ) {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }

            const event = message.event || {};
            recordFlightEvent({
                source: "dashboard",
                category: event.category,
                action: event.action,
                level: event.level,
                provider: event.provider,
                detail: event.detail
            })
                .then(() => sendResponse({ ok: true }))
                .catch(() => sendResponse({ ok: false }));

            return true;
        }


        if (
            message.type ===
                "dashboard-diagnostics-repair"
        ) {
            if (!isDashboardSender(sender)) {
                sendResponse({ ok: false });
                return;
            }

            runStreamShellProviderRepair(
                message.provider,
                message.action
            )
                .then(sendResponse)
                .catch(error => sendResponse({
                    ok: false,
                    error: String(error?.message || error || "Repair failed.")
                }));

            return true;
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
                            titlebarVisibilityMode: titlebarVisibilityMode || "unknown",
                            titlebarSettingsOpen: titlebarSettingsOpen === true,
                            titlebarVolumeActive: titlebarVolumeActive === true,
                            discord,
                            offscreenDocumentAlive,
                            flightRecorder,
                            displayProfile,
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
                        if (compact) {
                            const rightState = await chrome.storage.local.get("rightMode");
                            if (rightState.rightMode === "discord") {
                                await hideDiscordForDashboard();
                            }
                        } else {
                            await hideDiscordForDashboard();
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


        if (
            message.type ===
            "get-state"
        ) {
            Promise.all([
                chrome.storage.local.get([
                    "activeProvider",
                    "leftMode",
                    "rightMode"
                ]),
                isLandingExposed(),
                getStreamShellDisplayProfile()
            ])
                .then(
                    ([
                        state,
                        landingExposed,
                        displayProfile
                    ]) => {
                        sendResponse({
                            activeProvider:
                                state.activeProvider ||
                                "netflix",

                            leftMode:
                                state.leftMode ||
                                "landing",

                            rightMode:
                                state.rightMode ||
                                "dashboard",

                            layoutProfile:
                                displayProfile?.mode || "wide",

                            displayProfileOverride:
                                displayProfile?.override || "auto",

                            landingExposed
                        });
                    }
                );

            return true;
        }
    }
);


