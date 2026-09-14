/*
 * ============================================================
 * EVENTS
 * ============================================================
 */

subscriptionSyncButton.addEventListener(
    "click",
    () => {
        syncSubscriptions()
            .catch(
                () => {}
            );
    }
);


watchlistToggle.addEventListener(
    "click",
    () => {
        const libraryOpen =
            !mediaPanel.hidden &&
            (
                activePanel ===
                    "watchlist" ||
                activePanel ===
                    "continue" ||
                activePanel ===
                    "recent" ||
                activePanel ===
                    "direct"
            );


        if (
            libraryOpen
        ) {
            closePanel();

            return;
        }


        const openLastLibraryPanel =
            lastLibraryPanel ===
                "continue"
                ? showContinueWatching
                : lastLibraryPanel ===
                    "recent"
                    ? showRecent
                    : lastLibraryPanel ===
                        "direct"
                        ? showDirectLinks
                        : showWatchlist;


        openLastLibraryPanel()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


watchlistTab.addEventListener(
    "click",
    () => {
        showWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist failed:",
                        error
                    );
                }
            );
    }
);


continueTab.addEventListener(
    "click",
    () => {
        showContinueWatching()
            .catch(
                error => {
                    console.error(
                        "Continue Watching failed:",
                        error
                    );
                }
            );
    }
);


recentTab.addEventListener(
    "click",
    () => {
        showRecent()
            .catch(
                error => {
                    console.error(
                        "Recent list failed:",
                        error
                    );
                }
            );
    }
);



directTab.addEventListener(
    "click",
    () => {
        showDirectLinks()
            .catch(
                error => {
                    console.error(
                        "Direct links failed:",
                        error
                    );
                }
            );
    }
);


watchlistImportButton.addEventListener(
    "click",
    () => {
        watchlistImportInput.value =
            "";


        watchlistImportInput.click();
    }
);


watchlistImportInput.addEventListener(
    "change",
    async () => {
        const file =
            watchlistImportInput
                .files?.[0];


        if (
            !file
        ) {
            return;
        }


        try {
            await importWatchlistFile(
                file
            );

        } catch (error) {

            console.error(
                "Watchlist import failed:",
                error
            );


            openPanel(
                "watchlist"
            );


            renderPanelMessage(
                "Import failed",
                "The selected file is not a valid Stream Shell Watchlist export.",
                {
                    icon:
                        "×",

                    error:
                        true
                }
            );
        }
    }
);


watchlistExportButton.addEventListener(
    "click",
    () => {
        exportWatchlist()
            .catch(
                error => {
                    console.error(
                        "Watchlist export failed:",
                        error
                    );
                }
            );
    }
);


watchlistSort.addEventListener(
    "change",
    async () => {
        await saveWatchlistSortPreference(
            watchlistSort.value
        );


        if (
            activePanel ===
                "watchlist" &&
            !mediaPanel.hidden
        ) {
            await showWatchlist();
        }
    }
);


mediaSearchInput.addEventListener(
    "focus",
    () => {
        if (
            activePanel !==
                "search" ||
            mediaPanel.hidden
        ) {
            scheduleSearch(
                true
            );
        }
    }
);


mediaSearchInput.addEventListener(
    "input",
    () => {
        scheduleSearch();
    }
);


mediaSearchClear.addEventListener(
    "click",
    event => {
        event.preventDefault();

        event.stopPropagation();


        clearSearch()
            .catch(
                () => {}
            );
    }
);


mediaPanelClose.addEventListener(
    "click",
    closePanel
);


async function refreshDiscordButtonFromNative() {
    if (
        !discordButton ||
        !discordButton.classList.contains(
            "active"
        )
    ) {
        return;
    }


    try {
        const status =
            await chrome.runtime.sendMessage({
                type:
                    "get-discord-status"
            });


        if (
            status?.ok
        ) {
            const active =
                status.visible ===
                    true;


            discordButton.classList.toggle(
                "active",
                active
            );


            discordButton.setAttribute(
                "aria-pressed",
                active
                    ? "true"
                    : "false"
            );
        }
    } catch {
    }
}


/*
 * Native Discord can be minimized or closed-to-tray without producing an
 * Opera window event. Poll while Landing is actually visible; focus/
 * visibility events perform an immediate catch-up after a hidden period.
 */
let discordNativeStatusTimer = null;

function scheduleDiscordNativeStatusPoll(
    immediate = false
) {
    if (discordNativeStatusTimer) {
        clearTimeout(discordNativeStatusTimer);
        discordNativeStatusTimer = null;
    }

    if (
        document.visibilityState ===
            "hidden"
    ) {
        return;
    }

    discordNativeStatusTimer = setTimeout(
        async () => {
            discordNativeStatusTimer = null;
            await refreshDiscordButtonFromNative();
            scheduleDiscordNativeStatusPoll();
        },
        immediate ? 0 : 2000
    );
}

scheduleDiscordNativeStatusPoll();

document.addEventListener(
    "visibilitychange",
    () => {
        scheduleDiscordNativeStatusPoll(
            document.visibilityState !==
                "hidden"
        );
    }
);

window.addEventListener(
    "focus",
    () => {
        scheduleDiscordNativeStatusPoll(
            true
        );
    }
);


discordButton.addEventListener(
    "click",
    async () => {
        discordButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "landing-show-discord"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Discord desktop bridge failed."
                );
            }
        } catch (error) {
            console.error(
                "Discord desktop failed:",
                error
            );
        } finally {
            discordButton.classList.remove(
                "busy"
            );
        }
    }
);


if (twitchUtility && twitchOpenButton && twitchDropsButton) {
    const openTwitchTarget = async target => {
        twitchUtility.classList.add("busy");
        try {
            const response = await chrome.runtime.sendMessage({
                type: "landing-show-twitch",
                target
            });
            if (response?.ok === false) {
                throw new Error(response.error || "Twitch utility failed.");
            }
        } catch (error) {
            console.error("Twitch utility failed:", error);
        } finally {
            twitchUtility.classList.remove("busy");
        }
    };

    twitchOpenButton.addEventListener("click", () => {
        openTwitchTarget("resume");
    });

    twitchDropsButton.addEventListener("click", () => {
        openTwitchTarget("drops");
    });
}


restoreHomeLayoutButton.addEventListener(
    "click",
    async () => {
        restoreHomeLayoutButton.classList.add(
            "busy"
        );

        try {
            const response =
                await chrome.runtime.sendMessage({
                    type:
                        "restore-home-layout"
                });

            if (
                response?.ok ===
                    false
            ) {
                throw new Error(
                    response.error ||
                    "Home layout restore failed."
                );
            }
        } catch (error) {
            console.error(
                "Home layout restore failed:",
                error
            );
        } finally {
            restoreHomeLayoutButton.classList.remove(
                "busy"
            );
        }
    }
);


tmdbTokenButton.addEventListener(
    "click",
    () => {
        openPanel(
            "search"
        );


        renderTokenSetup(
            () => {
                scheduleSearch(
                    true
                );
            }
        );
    }
);


mediaPanelBody.addEventListener(
    "click",
    event => {
        const button =
            event.target.closest(
                "button"
            );


        if (
            !button
        ) {
            return;
        }


        if (
            button.dataset
                .refreshAvailability
        ) {
            refreshMediaAvailability(
                button.dataset
                    .refreshAvailability,
                button
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .selectMedia
        ) {
            selectMediaByKey(
                button.dataset
                    .selectMedia
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .toggleWatchlist
        ) {
            toggleWatchlistForSearch(
                button.dataset
                    .toggleWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .removeWatchlist
        ) {
            removeWatchlistItem(
                button.dataset
                    .removeWatchlist
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .resumeContinue
        ) {
            resumeContinueWatching(
                button.dataset
                    .resumeContinue
            )
                .catch(
                    error => {
                        console.error(
                            "Continue Watching resume failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeContinue
        ) {
            removeContinueWatching(
                button.dataset
                    .removeContinue
            )
                .catch(
                    () => {}
                );


            return;
        }


        if (
            button.dataset
                .openDirectLink
        ) {
            openDirectLink(
                button.dataset
                    .openDirectLink
            )
                .catch(
                    error => {
                        console.error(
                            "Direct link open failed:",
                            error
                        );
                    }
                );


            return;
        }


        if (
            button.dataset
                .removeDirectLink
        ) {
            removeDirectLink(
                button.dataset
                    .removeDirectLink
            )
                .catch(
                    () => {}
                );
        }
    }
);


document.addEventListener(
    "keydown",
    event => {
        if (
            event.key ===
                "Escape" &&
            !mediaPanel.hidden
        ) {
            closePanel();
        }
    }
);


/*
 * ============================================================
 * STORAGE UPDATES
 * ============================================================
 */

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {
        if (
            areaName !==
            "local"
        ) {
            return;
        }


        if (
            changes[
                PENDING_LANDING_PANEL_KEY
            ]?.newValue ===
                "direct"
        ) {
            chrome.storage.local.remove(
                PENDING_LANDING_PANEL_KEY
            );

            showDirectLinks()
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                SUBSCRIPTION_STORAGE_KEY
            ]
        ) {
            renderSubscriptionState(
                changes[
                    SUBSCRIPTION_STORAGE_KEY
                ].newValue
            );
        }


        if (
            changes[
                window
                    .StreamShellWatchlist
                    .STORAGE_KEY
            ]
        ) {
            refreshWatchlistCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "watchlist" &&
                            !mediaPanel.hidden
                        ) {
                            showWatchlist();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellDirectLinks
                    .STORAGE_KEY
            ]
        ) {
            refreshDirectLinkCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "direct" &&
                            !mediaPanel.hidden
                        ) {
                            showDirectLinks();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellContinueWatching
                    .STORAGE_KEY
            ]
        ) {
            refreshContinueWatchingCache()
                .then(
                    () => {
                        if (
                            activePanel ===
                                "continue" &&
                            !mediaPanel.hidden
                        ) {
                            showContinueWatching();
                        }
                    }
                )
                .catch(
                    () => {}
                );
        }


        if (
            changes[
                window
                    .StreamShellHistory
                    .STORAGE_KEY
            ]
        ) {
            if (
                activePanel ===
                    "recent" &&
                !mediaPanel.hidden
            ) {
                showRecent()
                    .catch(
                        () => {}
                    );
            }
        }


        if (
            changes[
                window
                    .StreamShellAvailability
                    .SELECTED_MEDIA_KEY
            ]
        ) {
            const media =
                changes[
                    window
                        .StreamShellAvailability
                        .SELECTED_MEDIA_KEY
                ].newValue;


            selectedMediaKey =
                media
                    ? getMediaKey(
                        media
                    )
                    : null;
        }
    }
);


/*
 * ============================================================
 * INITIAL STATE
 * ============================================================
 */

Promise.all([
    loadSubscriptionState(),
    refreshWatchlistCache(),
    refreshDirectLinkCache(),
    refreshContinueWatchingCache(),
    refreshRecentCache(),
    loadSelectedMediaState(),
    loadWatchlistSortPreference()
])
    .then(
        async () => {
            const pending =
                await chrome.storage.local.get(
                    PENDING_LANDING_PANEL_KEY
                );


            if (
                pending[
                    PENDING_LANDING_PANEL_KEY
                ] ===
                    "direct"
            ) {
                await chrome.storage.local.remove(
                    PENDING_LANDING_PANEL_KEY
                );

                await showDirectLinks();
            }
        }
    )
    .catch(
        () => {}
    );


chrome.runtime.sendMessage({
    type:
        "get-state"
})
    .then(
        renderState
    )
    .catch(
        () => {}
    );


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message.type ===
            "state-changed"
        ) {
            renderState(
                message
            );
        }
    }
);


/*
 * ============================================================
 * BACKGROUND STATE
 * ============================================================
 */

function renderState(
    state
) {
    let provider =
        state?.activeProvider ||
        "netflix";


    if (
        !PROVIDERS.has(
            provider
        )
    ) {
        provider =
            "netflix";
    }


    document.body.dataset.provider =
        provider;


    const rightMode =
        state?.rightMode ||
        "dashboard";


    if (
        discordButton
    ) {
        discordButton.classList.toggle(
            "active",
            rightMode ===
                "discord"
        );

        discordButton.setAttribute(
            "aria-pressed",
            rightMode ===
                "discord"
                ? "true"
                : "false"
        );
    }


    if (twitchUtility) {
        twitchUtility.classList.toggle(
            "active",
            rightMode === "twitch"
        );
    }


    const backgroundVariant =
        document.body.dataset.layoutProfile === "compact"
            ? "compact"
            : "wide";


    const backgroundUrl =
        chrome.runtime.getURL(
            `assets/backgrounds/${provider}_${backgroundVariant}.png`
        );


    panorama.style.backgroundImage =
        `url("${backgroundUrl}")`;
}