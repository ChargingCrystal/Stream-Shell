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
            await chrome.windows.get(
                windowId
            );

            return windowId;
        } catch {
            delete windows[
                providerName
            ];

            await saveProviderWindows(
                windows
            );
        }
    }

    if (
        shuttingDown
    ) {
        throw new Error(
            "Provider creation cancelled."
        );
    }

    const parkedCreation =
        options?.parked === true;

    const createData = {
        type: "popup",
        state: parkedCreation ? "minimized" : "normal",
        focused: false,
        url: provider.url
    };

    if (!parkedCreation) {
        Object.assign(createData, {
            left: LEFT.left,
            top: LEFT.top,
            width: LEFT.width,
            height: LEFT.height
        });
    }

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

    await setWindowMuted(
        windowId,
        true
    );

    if (parkedCreation) {
        await safelyMinimizeWindow(windowId);
        await parkWindowOffscreen(windowId, LEFT);
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

    if (
        !PROVIDERS[
            providerName
        ]
    ) {
        throw new Error(
            `Unknown provider: ${providerName}`
        );
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

    for (
        const [name, windowId]
        of Object.entries(
            windows
        )
    ) {
        if (
            name ===
            providerName
        ) {
            continue;
        }

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
