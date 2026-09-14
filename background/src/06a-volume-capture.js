/*
 * ============================================================
 * TAB-LEVEL VOLUME BOOSTER
 * ============================================================
 *
 * DRM providers cannot safely be routed through
 * createMediaElementSource(). Stream Shell therefore captures the current
 * provider tab and replays its audio through an offscreen AudioContext.
 * The native titlebar button is bridged through a Chromium command so the
 * tabCapture API receives the activeTab grant it explicitly requires.
 */

const VOLUME_CAPTURE_SESSION_KEY =
    "streamShellVolumeCaptureSession";

const VOLUME_CAPTURE_COMMAND =
    "toggle-volume-booster";

const VOLUME_CAPTURE_OFFSCREEN_URL =
    "offscreen/volume-audio.html";

const VOLUME_CAPTURE_STORAGE_PREFIX =
    "streamShellVolumeBoost_";

const VOLUME_CAPTURE_PROFILE_PREFIX =
    "streamShellAudioProfile_";

const VOLUME_CAPTURE_MIN =
    100;

const VOLUME_CAPTURE_MAX =
    600;

let volumeOffscreenCreation =
    null;


function normalizeVolumeCapturePercent(value) {
    const numeric =
        Number(value);

    if (!Number.isFinite(numeric)) {
        return VOLUME_CAPTURE_MIN;
    }

    return Math.min(
        VOLUME_CAPTURE_MAX,
        Math.max(
            VOLUME_CAPTURE_MIN,
            numeric
        )
    );
}


function volumeCaptureStorageKey(provider) {
    return `${VOLUME_CAPTURE_STORAGE_PREFIX}${provider}`;
}


function volumeCaptureProfileKey(provider) {
    return `${VOLUME_CAPTURE_PROFILE_PREFIX}${provider}`;
}


function normalizeVolumeCaptureProfile(value) {
    const profile = String(value || "normal").toLowerCase();
    return ["normal", "dialogue", "night"].includes(profile)
        ? profile
        : "normal";
}


function isVolumeCaptureProvider(provider) {
    return Boolean(PROVIDERS[provider] || provider === "twitch");
}

function volumeCaptureProviders() {
    return [...Object.keys(PROVIDERS), "twitch"];
}

function providerFromVolumeTabUrl(url) {
    const value =
        String(url || "").toLowerCase();

    if (value.includes("youtube.com")) return "youtube";
    if (value.includes("netflix.com")) return "netflix";
    if (value.includes("primevideo.com") || value.includes("amazon.de/gp/video")) return "prime";
    if (value.includes("disneyplus.com")) return "disney";
    if (value.includes("crunchyroll.com")) return "crunchyroll";
    if (value.includes("twitch.tv")) return "twitch";

    return null;
}


async function getVolumeCaptureSession() {
    try {
        const stored =
            await chrome.storage.session.get(
                VOLUME_CAPTURE_SESSION_KEY
            );

        const session =
            stored[VOLUME_CAPTURE_SESSION_KEY];

        return (
            session &&
            Number.isInteger(session.tabId) &&
            isVolumeCaptureProvider(session.provider)
        )
            ? session
            : null;
    } catch {
        return null;
    }
}


async function setVolumeCaptureSession(session) {
    try {
        if (!session) {
            await chrome.storage.session.remove(
                VOLUME_CAPTURE_SESSION_KEY
            );
            return;
        }

        await chrome.storage.session.set({
            [VOLUME_CAPTURE_SESSION_KEY]: session
        });
    } catch {
    }
}


async function getStoredVolumeCapturePercent(provider) {
    const key =
        volumeCaptureStorageKey(provider);

    try {
        const stored =
            await chrome.storage.local.get(key);

        return normalizeVolumeCapturePercent(
            stored[key]
        );
    } catch {
        return VOLUME_CAPTURE_MIN;
    }
}


async function getStoredVolumeCaptureProfile(provider) {
    const key = volumeCaptureProfileKey(provider);

    try {
        const stored = await chrome.storage.local.get(key);
        return normalizeVolumeCaptureProfile(stored[key]);
    } catch {
        return "normal";
    }
}


async function ensureVolumeOffscreenDocument() {
    const offscreenUrl =
        chrome.runtime.getURL(
            VOLUME_CAPTURE_OFFSCREEN_URL
        );

    try {
        const existing =
            await chrome.runtime.getContexts({
                contextTypes: [
                    "OFFSCREEN_DOCUMENT"
                ],
                documentUrls: [
                    offscreenUrl
                ]
            });

        if (existing.length) {
            return;
        }
    } catch {
        /* Continue with creation; older Chromium builds simply reject getContexts. */
    }

    if (volumeOffscreenCreation) {
        await volumeOffscreenCreation;
        return;
    }

    volumeOffscreenCreation =
        chrome.offscreen.createDocument({
            url:
                VOLUME_CAPTURE_OFFSCREEN_URL,
            reasons: [
                "USER_MEDIA"
            ],
            justification:
                "Replay the active provider tab through the user-controlled Stream Shell audio processing chain."
        });

    try {
        await volumeOffscreenCreation;
    } finally {
        volumeOffscreenCreation =
            null;
    }
}


async function closeVolumeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
    } catch {
    }
}


async function sendVolumeOffscreenMessage(message) {
    try {
        return await chrome.runtime.sendMessage({
            ...message,
            target:
                "stream-shell-volume-offscreen"
        });
    } catch {
        return null;
    }
}



async function waitForVolumeCaptureRelease(tabId, timeoutMs = 1200) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const captures = await chrome.tabCapture.getCapturedTabs();
            const active = captures.some(info =>
                info.tabId === tabId &&
                (info.status === "pending" || info.status === "active")
            );

            if (!active) return true;
        } catch {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 35));
    }

    return false;
}


async function suspendVolumeCaptureForFullscreen(tabId) {
    const session = await getVolumeCaptureSession();

    if (!session || session.tabId !== tabId) {
        return {
            ok: true,
            suspended: false
        };
    }

    if (session.fullscreenSuspended === true) {
        return {
            ok: true,
            suspended: true
        };
    }

    // Persist the logical booster session before stopping tabCapture. The
    // tabCapture "stopped" event is therefore distinguishable from a real
    // user/track shutdown and must not clear the titlebar state.
    await setVolumeCaptureSession({
        ...session,
        fullscreenSuspended: true
    });

    titlebarVolumeActive = true;

    await sendVolumeOffscreenMessage({
        type: "volume-capture-stop",
        tabId
    });

    let released = await waitForVolumeCaptureRelease(tabId, 450);

    if (!released) {
        // Force-close the offscreen owner as a deterministic fallback. It is
        // recreated on resume; this still stays well inside Chromium's
        // transient user-activation window for requestFullscreen().
        await closeVolumeOffscreenDocument();
        released = await waitForVolumeCaptureRelease(tabId, 750);
    }

    return {
        ok: released,
        suspended: released
    };
}


async function resumeVolumeCaptureAfterFullscreen(tabId) {
    const session = await getVolumeCaptureSession();

    if (
        !session ||
        session.tabId !== tabId ||
        session.fullscreenSuspended !== true
    ) {
        return {
            ok: true,
            resumed: false
        };
    }

    let tab;
    try {
        tab = await chrome.tabs.get(tabId);
    } catch {
        tab = null;
    }

    const provider = providerFromVolumeTabUrl(tab?.url) || session.provider;

    if (!tab?.id || provider !== session.provider) {
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: "Provider tab is no longer available."
        };
    }

    await ensureVolumeOffscreenDocument();

    let streamId = null;
    let lastError = null;

    // A just-stopped capture can remain pending in Chromium for a handful of
    // milliseconds. Retry that race locally; permission failures are not
    // hidden and will fall through to the normal inactive state.
    for (const delay of [0, 60, 140]) {
        if (delay) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            streamId = await chrome.tabCapture.getMediaStreamId({
                targetTabId: tabId
            });
            if (streamId) break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!streamId) {
        await closeVolumeOffscreenDocument();
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: lastError?.message || "Volume capture could not resume."
        };
    }

    const response = await sendVolumeOffscreenMessage({
        type: "volume-capture-start",
        tabId,
        provider: session.provider,
        percent: normalizeVolumeCapturePercent(session.percent),
        profile: normalizeVolumeCaptureProfile(session.profile),
        streamId
    });

    if (!response?.ok) {
        await closeVolumeOffscreenDocument();
        await setVolumeCaptureSession(null);
        titlebarVolumeActive = false;
        if (!shuttingDown) await broadcastState();
        return {
            ok: false,
            resumed: false,
            error: response?.error || "Offscreen audio routing could not resume."
        };
    }

    await setVolumeCaptureSession({
        ...session,
        fullscreenSuspended: false
    });

    titlebarVolumeActive = true;

    if (!shuttingDown) {
        await broadcastState();
    }

    return {
        ok: true,
        resumed: true
    };
}


async function refreshTitlebarVolumeActive(leftMode = null, rightMode = null) {
    const session =
        await getVolumeCaptureSession();

    if (!session) {
        titlebarVolumeActive =
            false;
        return false;
    }

    if (session.fullscreenSuspended === true) {
        titlebarVolumeActive =
            session.provider === "twitch"
                ? (rightMode ? rightMode === "twitch" : true)
                : (leftMode ? session.provider === leftMode : true);
        return titlebarVolumeActive;
    }

    let captured =
        false;

    try {
        const captures =
            await chrome.tabCapture.getCapturedTabs();

        captured =
            captures.some(
                info =>
                    info.tabId === session.tabId &&
                    (
                        info.status === "pending" ||
                        info.status === "active"
                    )
            );
    } catch {
        /* Keep the persisted session as the fallback if the status API is unavailable. */
        captured =
            true;
    }

    if (!captured) {
        await setVolumeCaptureSession(null);
        titlebarVolumeActive =
            false;
        return false;
    }

    titlebarVolumeActive =
        session.provider === "twitch"
            ? (rightMode ? rightMode === "twitch" : true)
            : (leftMode ? session.provider === leftMode : true);

    return titlebarVolumeActive;
}


async function updateActiveVolumeCaptureGain(provider, percent) {
    const session =
        await getVolumeCaptureSession();

    if (
        !session ||
        session.provider !== provider
    ) {
        return false;
    }

    const normalized =
        normalizeVolumeCapturePercent(percent);

    if (session.fullscreenSuspended === true) {
        await setVolumeCaptureSession({
            ...session,
            percent: normalized
        });
        return true;
    }

    const response =
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-set-gain",
            tabId:
                session.tabId,
            percent:
                normalized
        });

    if (response?.ok) {
        await setVolumeCaptureSession({
            ...session,
            percent:
                normalized
        });
        return true;
    }

    return false;
}


async function updateActiveVolumeCaptureProfile(provider, profile) {
    const session = await getVolumeCaptureSession();

    if (!session || session.provider !== provider) {
        return false;
    }

    const normalized = normalizeVolumeCaptureProfile(profile);

    if (session.fullscreenSuspended === true) {
        await setVolumeCaptureSession({
            ...session,
            profile: normalized
        });
        return true;
    }

    const response = await sendVolumeOffscreenMessage({
        type: "volume-capture-set-profile",
        tabId: session.tabId,
        profile: normalized
    });

    if (response?.ok) {
        await setVolumeCaptureSession({
            ...session,
            profile: normalized
        });
        return true;
    }

    return false;
}


async function stopVolumeCapture(shouldBroadcast = true) {
    const session =
        await getVolumeCaptureSession();

    await setVolumeCaptureSession(null);
    titlebarVolumeActive =
        false;

    if (session) {
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-stop",
            tabId:
                session.tabId
        });
    }

    await closeVolumeOffscreenDocument();

    if (
        shouldBroadcast &&
        !shuttingDown
    ) {
        await broadcastState();
    }
}


async function stopVolumeCaptureForProviderChange(nextProvider) {
    const session =
        await getVolumeCaptureSession();

    if (
        session &&
        session.provider !== nextProvider
    ) {
        await stopVolumeCapture(false);
    }
}


async function startVolumeCapture(tab, provider) {
    if (
        shuttingDown ||
        !tab?.id ||
        !isVolumeCaptureProvider(provider)
    ) {
        return false;
    }

    const existing =
        await getVolumeCaptureSession();

    if (
        existing &&
        existing.tabId === tab.id
    ) {
        await stopVolumeCapture();
        return false;
    }

    if (existing) {
        await stopVolumeCapture(false);
    }

    const [percent, profile] =
        await Promise.all([
            getStoredVolumeCapturePercent(provider),
            getStoredVolumeCaptureProfile(provider)
        ]);

    await ensureVolumeOffscreenDocument();

    let streamId;

    try {
        streamId =
            await chrome.tabCapture.getMediaStreamId({
                targetTabId:
                    tab.id
            });
    } catch (error) {
        await closeVolumeOffscreenDocument();
        console.warn(
            "Stream Shell volume capture could not start:",
            error
        );
        return false;
    }

    const response =
        await sendVolumeOffscreenMessage({
            type:
                "volume-capture-start",
            tabId:
                tab.id,
            provider,
            percent,
            profile,
            streamId
        });

    if (!response?.ok) {
        await closeVolumeOffscreenDocument();
        console.warn(
            "Stream Shell offscreen volume routing failed:",
            response?.error || "unknown error"
        );
        return false;
    }

    await setVolumeCaptureSession({
        tabId:
            tab.id,
        provider,
        percent,
        profile
    });

    titlebarVolumeActive =
        true;

    await broadcastState();
    return true;
}


async function toggleVolumeCaptureFromCommand(tab) {
    if (shuttingDown) {
        return;
    }

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode",
            "providerWindows",
            TWITCH_WINDOW_STORAGE_KEY
        ]);

    const tabProvider = providerFromVolumeTabUrl(tab?.url);
    let provider = null;
    let expectedWindowId = null;

    if (
        tabProvider === "twitch" &&
        state.rightMode === "twitch" &&
        tab?.windowId === state[TWITCH_WINDOW_STORAGE_KEY]
    ) {
        provider = "twitch";
        expectedWindowId = state[TWITCH_WINDOW_STORAGE_KEY];
    } else if (PROVIDERS[state.leftMode]) {
        provider = state.leftMode;
        expectedWindowId = state.providerWindows?.[provider];
    } else if (tabProvider && tabProvider !== "twitch") {
        provider = tabProvider;
        expectedWindowId = state.providerWindows?.[provider];
    }

    if (!provider || !Number.isInteger(expectedWindowId)) {
        return;
    }

    if (
        provider === "twitch" &&
        await getTwitchSetting("streamShellTwitchAutoMute", true)
    ) {
        const session = await getVolumeCaptureSession();
        if (session?.provider === "twitch") {
            await stopVolumeCapture();
        }
        return;
    }

    let targetTab =
        tab;

    if (
        !targetTab?.id ||
        (
            Number.isInteger(expectedWindowId) &&
            targetTab.windowId !== expectedWindowId
        )
    ) {
        try {
            const tabs =
                await chrome.tabs.query({
                    active:
                        true,
                    windowId:
                        expectedWindowId
                });

            targetTab =
                tabs[0] || null;
        } catch {
            targetTab =
                null;
        }
    }

    if (!targetTab?.id) {
        return;
    }

    const activeProvider =
        providerFromVolumeTabUrl(
            targetTab.url
        );

    if (
        activeProvider &&
        activeProvider !== provider
    ) {
        return;
    }

    await startVolumeCapture(
        targetTab,
        provider
    );
}


chrome.commands.onCommand.addListener(
    (command, tab) => {
        if (
            command !== VOLUME_CAPTURE_COMMAND
        ) {
            return;
        }

        toggleVolumeCaptureFromCommand(tab)
            .catch(
                error => {
                    console.error(
                        "Stream Shell volume command failed:",
                        error
                    );
                }
            );
    }
);


chrome.storage.onChanged.addListener(
    (changes, areaName) => {
        if (
            areaName !== "local"
        ) {
            return;
        }

        for (
            const provider
            of volumeCaptureProviders()
        ) {
            const gainKey = volumeCaptureStorageKey(provider);
            const profileKey = volumeCaptureProfileKey(provider);

            if (Object.prototype.hasOwnProperty.call(changes, gainKey)) {
                updateActiveVolumeCaptureGain(
                    provider,
                    changes[gainKey].newValue
                ).catch(() => {});
            }

            if (Object.prototype.hasOwnProperty.call(changes, profileKey)) {
                updateActiveVolumeCaptureProfile(
                    provider,
                    changes[profileKey].newValue
                ).catch(() => {});
            }
        }
    }
);


chrome.tabs.onRemoved.addListener(
    tabId => {
        getVolumeCaptureSession()
            .then(
                session => {
                    if (
                        session?.tabId === tabId
                    ) {
                        return stopVolumeCapture();
                    }
                }
            )
            .catch(() => {});
    }
);


chrome.tabCapture.onStatusChanged.addListener(
    info => {
        if (
            info.status !== "stopped" &&
            info.status !== "error"
        ) {
            return;
        }

        getVolumeCaptureSession()
            .then(
                async session => {
                    if (
                        session?.tabId !== info.tabId
                    ) {
                        return;
                    }

                    if (session.fullscreenSuspended === true) {
                        return;
                    }

                    await setVolumeCaptureSession(null);
                    titlebarVolumeActive =
                        false;

                    if (!shuttingDown) {
                        await broadcastState();
                    }
                }
            )
            .catch(() => {});
    }
);


chrome.runtime.onMessage.addListener(
    message => {
        if (
            message?.type !== "volume-capture-ended" ||
            message?.source !== "stream-shell-volume-offscreen"
        ) {
            return;
        }

        getVolumeCaptureSession()
            .then(
                async session => {
                    if (
                        !session ||
                        session.tabId !== message.tabId
                    ) {
                        return;
                    }

                    if (session.fullscreenSuspended === true) {
                        return;
                    }

                    await setVolumeCaptureSession(null);
                    titlebarVolumeActive =
                        false;

                    if (!shuttingDown) {
                        await broadcastState();
                    }
                }
            )
            .catch(() => {});
    }
);
