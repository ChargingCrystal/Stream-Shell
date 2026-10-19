async function getProviderWindows() {
    const stored =
        await chrome.storage.local.get(
            "providerWindows"
        );

    return (
        stored.providerWindows ||
        {}
    );
}


async function saveProviderWindows(
    windows
) {
    await chrome.storage.local.set({
        providerWindows:
            windows
    });
}


let compactProviderActivationWindowId = null;
let compactProviderActivationUntil = 0;


function armCompactProviderActivation(windowId, durationMs = 2500) {
    compactProviderActivationWindowId = Number.isInteger(windowId)
        ? windowId
        : null;
    compactProviderActivationUntil = compactProviderActivationWindowId
        ? Date.now() + Math.max(500, Number(durationMs) || 2500)
        : 0;
}


function compactProviderActivationIsArmed(windowId) {
    return (
        Number.isInteger(windowId) &&
        compactProviderActivationWindowId === windowId &&
        compactProviderActivationUntil > Date.now()
    );
}


function clearCompactProviderActivation(windowId = null) {
    if (
        windowId !== null &&
        compactProviderActivationWindowId !== windowId
    ) {
        return;
    }

    compactProviderActivationWindowId = null;
    compactProviderActivationUntil = 0;
}


async function ensureProviderWindow(
    providerName,
    options = null
) {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Stream Shell is shutting down."
        );
    }

    await refreshStreamShellProviderTargets();

    if (
        providerCreationLocks.has(
            providerName
        )
    ) {
        return providerCreationLocks.get(
            providerName
        );
    }

    const promise =
        _ensureProviderWindow(
            providerName,
            options
        )
            .finally(
                () => {
                    providerCreationLocks.delete(
                        providerName
                    );
                }
            );

    providerCreationLocks.set(
        providerName,
        promise
    );

    return promise;
}


async function _ensureProviderWindow(
    providerName,
    options = null
) {
    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    const provider =
        PROVIDERS[
            providerName
        ];

    if (
        !provider
    ) {
        throw new Error(
            `Unknown provider: ${providerName}`
        );
    }

    const parkedCreation =
        options?.parked === true;

    const displayProfile =
        parkedCreation
            ? await getStreamShellDisplayProfile().catch(() => null)
            : null;
    const compactParkedCreation =
        parkedCreation &&
        displayProfile?.mode === "compact";

    const windows =
        await getProviderWindows();

    let windowId =
        windows[
            providerName
        ];

    if (
        windowId
    ) {
        try {
            const existingWindow =
                await chrome.windows.get(
                    windowId
                );

            /*
             * The remembered warm provider is the only provider created while
             * hidden. Older builds created it minimized without a target
             * restore rectangle, allowing Opera to remember the full 32:9
             * display. Repair that stale window once instead of letting it
             * restore fullscreen and fail the native LEFT-pane claim.
             */
            if (compactParkedCreation) {
                /*
                 * Compact warm-up is the only path that needs a genuinely
                 * off-screen provider. Do not apply this geometry to normal
                 * provider activation/switching.
                 */
                await parkWindowOffscreen(
                    windowId,
                    LEFT
                );
                await safelyMinimizeWindow(
                    windowId
                );
            } else if (
                parkedCreation &&
                !streamShellWindowBoundsMatch(
                    existingWindow,
                    LEFT
                )
            ) {
                await restoreWindow(
                    windowId,
                    LEFT,
                    false
                );

                await safelyMinimizeWindow(
                    windowId
                );
            }

            // Editing a custom URL must not reload an active page merely
            // because Settings are saved or provider buttons are reordered.
            // Apply the new address only when the user next activates it.
            if (!parkedCreation && provider.kind === "custom") {
                const key = `streamShellCustomWindowUrl_${providerName}`;
                const persisted = await chrome.storage.local.get(key);
                if (persisted[key] && persisted[key] !== provider.url) {
                    const activeTab = (await chrome.tabs.query({ windowId, active: true }))[0];
                    if (Number.isInteger(activeTab?.id)) {
                        await chrome.tabs.update(activeTab.id, { url: provider.url });
                    }
                }
                await chrome.storage.local.set({ [key]: provider.url });
            }
            return windowId;
        } catch {
            delete windows[
                providerName
            ];

            await saveProviderWindows(
                windows
            );

            windowId =
                null;
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    /*
     * Normal provider activation keeps the established LEFT geometry. Only the
     * remembered Compact warm-up window is born at the parking rectangle so it
     * cannot flash full-screen before the user actually selects that provider.
     */
    const initialBounds = compactParkedCreation
        ? await getStreamShellParkingBounds(LEFT)
        : LEFT;

    const createData = {
        type: "popup",
        state: "normal",
        focused: false,
        url: provider.url,
        left: initialBounds.left,
        top: initialBounds.top,
        width: initialBounds.width,
        height: initialBounds.height
    };

    const win =
        await chrome.windows.create(
            createData
        );

    if (
        shuttingDown
    ) {
        if (
            win?.id
        ) {
            await safelyRemoveWindow(
                win.id
            );
        }

        throw new Error(
            "Provider creation cancelled during shutdown."
        );
    }

    if (
        !win?.id
    ) {
        throw new Error(
            `${providerName} window could not be created.`
        );
    }

    windowId =
        win.id;

    windows[
        providerName
    ] =
        windowId;

    await saveProviderWindows(
        windows
    );
    if (provider.kind === "custom") {
        await chrome.storage.local.set({
            [`streamShellCustomWindowUrl_${providerName}`]: provider.url
        });
    }

    await setWindowMuted(
        windowId,
        true
    );

    if (parkedCreation) {
        if (compactParkedCreation) {
            await parkWindowOffscreen(
                windowId,
                LEFT
            );
        }
        await safelyMinimizeWindow(
            windowId
        );
    }

    recordFlightEvent({
        source: "background",
        category: "provider-window",
        action: "opened",
        provider: providerName,
        detail: { windowId }
    }).catch(() => {});

    return windowId;
}


async function switchProvider(
    providerName
) {
    if (
        shuttingDown
    ) {
        return;
    }

    await refreshStreamShellProviderTargets();
    if (!PROVIDERS[providerName]) {
        throw new Error(`Unknown or disabled provider: ${providerName}`);
    }

    titlebarFullscreenActive = false;
    titlebarFullscreenWindowId = null;

    await stopVolumeCaptureForProviderChange(
        providerName
    );

    const targetWindowId =
        await ensureProviderWindow(
            providerName
        );

    if (
        shuttingDown
    ) {
        return;
    }

    const windows =
        await getProviderWindows();

    const inactiveProviders =
        Object.entries(
            windows
        )
            .filter(
                ([name, windowId]) =>
                    name !== providerName &&
                    Number.isInteger(windowId)
            );

    /*
     * Pause outgoing/parked provider playback through the provider adapter
     * before muting and minimizing. Keep the pause requests parallel so an
     * async provider bridge (notably Netflix) cannot serially delay switching.
     */
    await Promise.all(
        inactiveProviders.map(
            ([name, windowId]) =>
                pauseProviderWindowPlayback(
                    windowId,
                    name,
                    "provider-switch"
                )
        )
    );

    for (
        const [name, windowId]
        of inactiveProviders
    ) {
        await setWindowMuted(
            windowId,
            true
        );

        await safelyMinimizeWindow(
            windowId
        );


        /*
         * A minimized provider must not keep advertising an old playback
         * session on the Dashboard while another provider is on top.
         */
        await chrome.storage.local.remove(
            `streamShellNowPlaying_${name}`
        );
    }

    if (
        shuttingDown
    ) {
        return;
    }

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    const compact = displayProfile?.mode === "compact";

    if (compact) {
        /*
         * A very short lease distinguishes our own Dashboard -> provider focus
         * handoff from a later user-initiated minimize. It is not persistent
         * state and expires automatically.
         */
        armCompactProviderActivation(targetWindowId);
    }

    /*
     * Publish provider intent before the native focus transition in both layout
     * profiles. This keeps the extension as the source of truth for ownership.
     */
    await chrome.storage.local.set({
        activeProvider: providerName,
        leftMode: providerName
    });

    if (compact) {
        /* Compact is a true single-surface host. */
        const dashboardWindowId = await getDashboardWindowId();
        if (Number.isInteger(dashboardWindowId)) {
            await safelyMinimizeWindow(
                dashboardWindowId
            );
        }
    }

    await restoreWindow(
        targetWindowId,
        LEFT,
        true
    );

    await claimFocusedTitlebarSurface(
        targetWindowId
    );
    scheduleTitlebarClaimRetries(
        targetWindowId
    );

    if (!compact) {
        // Opera can promote sibling Twitch HWNDs while focusing a LEFT provider.
        // Restore only whichever right-hand surface the titlebar already shows.
        const selectedRight = await chrome.storage.local.get("rightMode");
        if (selectedRight.rightMode === "dashboard" || selectedRight.rightMode === "twitch") {
            scheduleWideRightPaneReassert(selectedRight.rightMode);
        }
    }

    if (
        shuttingDown
    ) {
        return;
    }

    await setWindowMuted(
        targetWindowId,
        false
    );

    await chrome.storage.local.set({
        activeProvider:
            providerName,

        leftMode:
            providerName
    });

    recordFlightEvent({
        source: "background",
        category: "provider-window",
        action: "activated",
        provider: providerName,
        detail: { windowId: targetWindowId }
    }).catch(() => {});

    await broadcastState();
}


async function pauseProviderWindowPlayback(
    windowId,
    providerName = null,
    reason = "provider-switch"
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return false;
    }

    let tabs;

    try {
        tabs =
            await chrome.tabs.query({
                windowId
            });
    } catch {
        return false;
    }

    let delivered = false;

    for (
        const tab
        of tabs
    ) {
        if (
            !Number.isInteger(
                tab.id
            )
        ) {
            continue;
        }

        try {
            await chrome.tabs.sendMessage(
                tab.id,
                {
                    type: "stream-shell-playback-pause",
                    reason,
                    provider:
                        providerName ||
                        null
                }
            );

            delivered = true;
        } catch {
            /*
             * A provider tab can be between documents or not yet have the
             * shared content runtime. Parking/muting must still continue.
             */
        }
    }

    return delivered;
}


async function setWindowMuted(
    windowId,
    muted
) {
    if (
        !Number.isInteger(
            windowId
        )
    ) {
        return;
    }

    let tabs;

    try {
        tabs =
            await chrome.tabs.query({
                windowId
            });
    } catch {
        return;
    }

    for (
        const tab
        of tabs
    ) {
        if (
            !tab.id
        ) {
            continue;
        }

        try {
            await chrome.tabs.update(
                tab.id,
                {
                    muted
                }
            );
        } catch {
        }
    }
}




/*
 * ============================================================
 * CONTINUE WATCHING RESUME
 * ============================================================
 */
function providerOwnsResumeUrl(providerName, rawUrl) {
    return isProviderOwnedMediaUrl(providerName, rawUrl);
}

async function resumeProviderFromContinue(providerName, rawUrl, currentTime, identity = "") {
    const raw = String(rawUrl || "").trim();
    const targetTime = Number(currentTime);

    if (!PROVIDERS[providerName]) throw new Error("Unknown provider.");
    if (!Number.isFinite(targetTime) || targetTime < 1) {
        throw new Error("Resume timestamp is invalid.");
    }

    /*
     * Resolve persisted media identity before navigation. The dedicated
     * provider adapter gets first shot; shared deterministic reconstruction
     * is only the fallback for a newly-created/not-yet-ready content script.
     */
    const windowId = await ensureProviderWindow(providerName);
    const tabs = await chrome.tabs.query({ windowId });
    const tab = tabs.find(item => Number.isInteger(item.id));
    if (!tab?.id) throw new Error("Provider tab is unavailable.");

    const resolved = await resolveSavedProviderMediaLink(
        providerName,
        identity,
        raw,
        tab
    );

    const url = resolved.url;
    const resumeIdentity = resolved.identity;
    if (!providerOwnsResumeUrl(providerName, url)) {
        throw new Error("Resolved media URL does not belong to the selected provider.");
    }

    const pendingKey = `streamShellPendingResume_${providerName}`;
    const requestedAt = Date.now();

    await chrome.storage.local.set({
        [pendingKey]: {
            provider: providerName,
            url,
            identity: resumeIdentity,
            currentTime: targetTime,
            requestedAt
        }
    });

    recordFlightEvent({
        source: "background",
        category: "resume",
        action: "requested",
        provider: providerName,
        detail: {
            targetTime,
            requestedAt,
            linkStrategy: resolved.strategy,
            linkSource: resolved.source
        }
    }).catch(() => {});

    const currentIdentity = providerOwnsResumeUrl(providerName, tab.url)
        ? getProviderMediaIdentity(providerName, tab.url)
        : "";

    /*
     * Do not reload an already-open matching title. The live content script
     * receives the pending-resume storage event and can seek in place. This
     * also avoids a race where it applies the seek immediately and a forced
     * reload would then throw that seek away again.
     */
    if (currentIdentity !== resumeIdentity) {
        await chrome.tabs.update(tab.id, { url });
    }

    await switchProvider(providerName);
    return true;
}
