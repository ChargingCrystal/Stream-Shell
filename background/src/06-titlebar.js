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
// Provider buttons have an independent, versioned native message stream.
// Never tie an update to the focus or HWND claim path (Twitch/Discord isolation).
let titlebarProviderGeneration = 0;
let titlebarProviderAckGeneration = 0;
let titlebarProviderSignature = null;
let titlebarProviderPayloadB64 = null;
let titlebarProviderStorageEpoch = 0;
let titlebarProviderConfigSignature = null;
let titlebarProviderRenderSequence = 0;
let titlebarProviderSyncPhase = "idle";
let titlebarProviderLastError = null;
let titlebarProviderLastSentAt = null;
let titlebarProviderLastAckAt = null;
let titlebarProviderLastRejectedIconCount = 0;

const STREAM_SHELL_TITLEBAR_BUILTIN_LABELS = Object.freeze({
    youtube: "YT", netflix: "N", prime: "P", disney: "D+", crunchyroll: "CR"
});

// Load primary PNG bytes directly in the extension worker: the native helper handles
// normalization. Only the SVG fallback requires the offscreen DOM renderer.
// No HWND/focus/audio operations occur on this path.
const streamShellTitlebarRasterCache = new Map();
const streamShellTitlebarArtworkStatus = new Map();

function streamShellTitlebarButtons(registryValue) {
    const registry = normalizeStreamShellProviderRegistry(registryValue);
    const byId = new Map(registry.providers.map(provider => [provider.id, provider]));
    return registry.titlebarOrder.map(id => byId.get(id))
        .filter(provider => provider?.enabled && provider?.showInTitlebar)
        .map(provider => {
            const name = provider.name.replace(/[\r\n\t]/g, " ").slice(0, 48).trim() || provider.id;
            const icon = (STREAM_SHELL_TITLEBAR_BUILTIN_LABELS[provider.id] || provider.icon ||
                name.slice(0, 2).toUpperCase()).replace(/[\r\n\t]/g, " ").slice(0, 8).trim() || "?";
            return { id: provider.id, icon, name, kind: provider.kind,
                artKey: provider.artKey || "",
                color: streamShellValidatedTitlebarColor(provider.titlebarColor) };
        }).slice(0, 128);
}

// A local asset read/offscreen DOM request must never block the entire native
// button list. Chrome may delay an offscreen document during MV3 wake-up.
function streamShellWithTimeout(task, timeoutMs, reason) {
    let timeout;
    const expired = new Promise(resolve => {
        timeout = setTimeout(() => resolve({pngBase64:"",reason}), timeoutMs);
    });
    return Promise.race([Promise.resolve().then(task), expired])
        .finally(() => clearTimeout(timeout));
}

// Fetching a PNG directly avoids an observed offscreen image.decode() stall on
// valid local PNG assets. The source is strictly a key-derived extension URL.
const STREAM_SHELL_NATIVE_PNG_MAX_BYTES = 16384;
async function streamShellReadNativeTitlebarPng(relativePath) {
    if (!relativePath || !/^native\/titlebar-icons\/custom\/custom_[a-z0-9_-]{1,32}\.png$/.test(relativePath))
        return {pngBase64:"",reason:"invalid-primary-path"};
    if (streamShellTitlebarRasterCache.has(relativePath))
        return streamShellTitlebarRasterCache.get(relativePath);
    const pending = streamShellWithTimeout(async () => {
        let response;
        try { response = await fetch(chrome.runtime.getURL(relativePath), {cache:"no-store"}); }
        catch { return {pngBase64:"",reason:"png-fetch-failed"}; }
        if (!response.ok)
            return {pngBase64:"",reason:response.status === 404 ? "file-missing" : "png-fetch-failed"};
        const declaredLength = Number(response.headers?.get?.("content-length") || 0);
        if (declaredLength > STREAM_SHELL_NATIVE_PNG_MAX_BYTES)
            return {pngBase64:"",reason:"png-file-too-large"};
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > STREAM_SHELL_NATIVE_PNG_MAX_BYTES)
            return {pngBase64:"",reason:"png-file-too-large"};
        const header = [137,80,78,71,13,10,26,10];
        if (bytes.length < 24 || !header.every((part,i) => bytes[i] === part))
            return {pngBase64:"",reason:"invalid-png"};
        // Maximum 16KiB, so one binary string conversion is safe.
        return {pngBase64:btoa(String.fromCharCode(...bytes)),reason:"ok"};
    }, 2500, "png-fetch-timeout").catch(() => ({pngBase64:"",reason:"png-fetch-failed"}));
    streamShellTitlebarRasterCache.set(relativePath,pending);
    const result = await pending;
    // Retry temporary file-access failures; missing local artwork is stable
    // until the next extension reload.
    if (!result.pngBase64 && result.reason !== "file-missing")
        streamShellTitlebarRasterCache.delete(relativePath);
    return result;
}

async function streamShellRasterizeTitlebarIcon(relativePath) {
    if (!relativePath) return {pngBase64:"",reason:"no-artwork-key"};
    if (streamShellTitlebarRasterCache.has(relativePath)) {
        return streamShellTitlebarRasterCache.get(relativePath);
    }
    const pending = (async () => {
        try {
            const result = await streamShellWithTimeout(async () => {
                await ensureVolumeOffscreenDocument();
                const response = await chrome.runtime.sendMessage({
                    target:"stream-shell-titlebar-svg-offscreen",
                    type:"titlebar-render-icon", path:relativePath
                });
                if (response?.ok && typeof response.pngBase64 === "string" &&
                    response.pngBase64.length <= 16000)
                    return {pngBase64:response.pngBase64,reason:"ok"};
                return {pngBase64:"",reason:response?.reason || "no-offscreen-response"};
            }, 2500, "offscreen-timeout");
            return result;
        } catch {
            return {pngBase64:"",reason:"offscreen-unavailable"};
        }
    })();
    streamShellTitlebarRasterCache.set(relativePath,pending);
    const result = await pending;
    // A missing file is stable until extension reload. Transient errors retry.
    if (!result.pngBase64 && result.reason !== "file-missing")
        streamShellTitlebarRasterCache.delete(relativePath);
    return result;
}

async function streamShellTitlebarIconData(button) {
    if (button.kind !== "custom") return "";
    if (!button.artKey) {
        streamShellTitlebarArtworkStatus.set(button.id,{source:"text",reason:"artwork-key-not-set"});
        return "";
    }
    const primaryPath = streamShellNativeCustomIconPath(button.artKey);
    const primary = await streamShellReadNativeTitlebarPng(primaryPath);
    if (primary.pngBase64) {
        streamShellTitlebarArtworkStatus.set(button.id,{source:"native-png",reason:"raw-png-direct",path:primaryPath});
        return primary.pngBase64;
    }
    const fallbackPath = streamShellCustomArtworkPath(button.artKey, "icon");
    const fallback = await streamShellRasterizeTitlebarIcon(fallbackPath);
    if (fallback.pngBase64) {
        streamShellTitlebarArtworkStatus.set(button.id,{source:"provider-svg",reason:"ok",path:fallbackPath,primaryFailure:primary.reason});
        return fallback.pngBase64;
    }
    streamShellTitlebarArtworkStatus.set(button.id,{
        source:"text",reason:"no-renderable-icon",primaryFailure:primary.reason,
        fallbackFailure:fallback.reason,expectedPrimary:primaryPath,expectedFallback:fallbackPath
    });
    return "";
}

async function streamShellTitlebarPayload(registryValue, options = {}) {
    const buttons = streamShellTitlebarButtons(registryValue);
    const withArtwork = options.includeArtwork !== false;
    const rows = await Promise.all(buttons.map(async button => {
        const image = withArtwork ? await streamShellTitlebarIconData(button) : "";
        return `${button.id}\t${button.icon}\t${button.name}\t${button.color}\t${image}`;
    }));
    const bytes = new TextEncoder().encode(rows.join("\n"));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function sendTitlebarProviderPayload() {
    if (!titlebarPort || !titlebarProtocolReady || titlebarProviderPayloadB64 === null) return;
    try {
        titlebarPort.postMessage({
            type: "provider-buttons", protocolVersion: TITLEBAR_PROTOCOL_VERSION,
            generation: titlebarProviderGeneration, payloadB64: titlebarProviderPayloadB64
        });
        titlebarProviderLastSentAt = Date.now();
    } catch (error) {
        titlebarProviderLastError = "native-send-failed";
    }
}

function streamShellApplyTitlebarPayload(payload, phase) {
    const changed = titlebarProviderSignature !== payload;
    if (changed) {
        titlebarProviderSignature = payload;
        titlebarProviderPayloadB64 = payload;
        titlebarProviderGeneration += 1;
        titlebarProviderAckGeneration = 0;
    }
    titlebarProviderSyncPhase = phase;
    // The heartbeat retries unacknowledged messages; an identical optional
    // artwork result should not immediately duplicate the text-only message.
    if (changed) sendTitlebarProviderPayload();
}

async function syncTitlebarProviderRegistry(registryValue = undefined) {
    if (shuttingDown) return;
    if (registryValue === undefined) {
        const expectedEpoch = titlebarProviderStorageEpoch;
        const stored = await chrome.storage.local.get(STREAM_SHELL_PROVIDER_REGISTRY_KEY);
        if (expectedEpoch !== titlebarProviderStorageEpoch) return;
        registryValue = stored[STREAM_SHELL_PROVIDER_REGISTRY_KEY];
    }
    const configSignature = JSON.stringify(streamShellTitlebarButtons(registryValue));
    // A heartbeat or repeated init must not replace loaded icons with placeholders.
    if (configSignature === titlebarProviderConfigSignature && titlebarProviderPayloadB64 !== null) {
        if (titlebarProviderAckGeneration !== titlebarProviderGeneration) sendTitlebarProviderPayload();
        return;
    }
    const renderEpoch = titlebarProviderStorageEpoch;
    const sequence = ++titlebarProviderRenderSequence;
    titlebarProviderConfigSignature = configSignature;
    titlebarProviderLastError = null;
    streamShellTitlebarArtworkStatus.clear();
    for (const button of streamShellTitlebarButtons(registryValue)) {
        if (button.kind === "custom")
            streamShellTitlebarArtworkStatus.set(button.id, {source:"pending",reason:"artwork-loading"});
    }

    // Phase 1: send ALL buttons immediately, with text/initials. This has no
    // dependency on PNG/SVG decoding or on the offscreen audio document.
    const textPayload = await streamShellTitlebarPayload(registryValue, {includeArtwork:false});
    if (shuttingDown || renderEpoch !== titlebarProviderStorageEpoch ||
        sequence !== titlebarProviderRenderSequence) return;
    streamShellApplyTitlebarPayload(textPayload,"buttons-ready");

    // Phase 2: enhance the same buttons with icons. If rasterization fails,
    // the native helper keeps the valid text-only list instead of losing a provider.
    void streamShellTitlebarPayload(registryValue).then(payload => {
        if (shuttingDown || renderEpoch !== titlebarProviderStorageEpoch ||
            sequence !== titlebarProviderRenderSequence) return;
        streamShellApplyTitlebarPayload(payload,"artwork-ready");
    }).catch(error => {
        if (sequence !== titlebarProviderRenderSequence) return;
        titlebarProviderSyncPhase = "artwork-failed";
        titlebarProviderLastError = String(error?.message || error).slice(0,120);
    });
}

// Provider changes affect only the LEFT titlebar buttons. No focus, restore,
// native claims, pane reassert or rightMode updates occur on this path.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY]) return;
    titlebarProviderStorageEpoch++;
    void syncTitlebarProviderRegistry(changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY].newValue)
        .catch(error => console.warn("Native provider sync failed:", error));
});

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
            "rightMode",
            "twitchTarget"
        ]);

    await refreshTitlebarVolumeActive(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard"
    );

    const visibilityMode =
        await getTitlebarVisibilityMode();

    // Resolve intent again at send time: an earlier call might have been
    // awaiting visibility while the user changed a pane in the meantime.
    const latest = await chrome.storage.local.get(["leftMode", "rightMode", "twitchTarget"]);
    sendTitlebarState(
        latest.leftMode || "landing",
        latest.rightMode || "dashboard",
        visibilityMode,
        latest.twitchTarget || "resume"
    );
}


/* Explicit owner-graph repair after a user navigation changes Opera focus.
 * The right pane is not switched by a left provider action: these are only
 * bounded HWND stacking corrections, never additional window activations.
 * Never run as a permanent timer (0.19.25 Dashboard/Twitch flicker). */
function scheduleWideRightPaneReassert(expectedRightMode) {
    if (expectedRightMode !== "dashboard" && expectedRightMode !== "twitch") return;

    for (const delay of [0, 180, 480]) {
        setTimeout(async () => {
            if (shuttingDown || !titlebarPort || !titlebarProtocolReady) return;
            try {
                const current = await chrome.storage.local.get("rightMode");
                if (current.rightMode !== expectedRightMode) return;
                await syncConnectedTitlebarNative();
                // Re-check after async visibility/state lookup, because the
                // user can select a different right pane in the meantime.
                const latest = await chrome.storage.local.get("rightMode");
                if (latest.rightMode !== expectedRightMode || !titlebarPort || !titlebarProtocolReady) return;
                titlebarPort.postMessage({
                    type: "reassert-right-pane",
                    protocolVersion: TITLEBAR_PROTOCOL_VERSION,
                    rightMode: expectedRightMode
                });
            } catch {
                // The native helper is optional; normal provider focus stays working.
            }
        }, delay);
    }
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
    titlebarProviderGeneration = 0;
    titlebarProviderAckGeneration = 0;
    titlebarProviderSignature = null;
    titlebarProviderPayloadB64 = null;
    titlebarProviderConfigSignature = null;
    ++titlebarProviderRenderSequence; // invalidate old asynchronous artwork jobs
    titlebarProviderSyncPhase = "connecting";

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

                resetTwitchWorkspaceV2ClaimCache();
                titlebarLastNativeStatus = null;
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
    resetTwitchWorkspaceV2ClaimCache();

    const state =
        await chrome.storage.local.get([
            "leftMode",
            "rightMode",
            "twitchTarget"
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

            twitchTarget:
                state.twitchTarget ||
                "resume",

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
            `${state.leftMode || "landing"}|${state.rightMode || "dashboard"}|${state.twitchTarget || "resume"}|${visibilityMode}|${streamShellDisplayProfileCache?.mode || "wide"}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

        // Rehydrate native buttons after every successful helper handshake.
        void syncTitlebarProviderRegistry();

        startTitlebarReconcileLoop();

        /* A native-host restart loses the HWND member map while the browser
         * windows themselves survive. Re-announce A-D once after reconnect. */
        getTwitchWorkspaceV2Record()
            .then(record => {
                if (record) scheduleTwitchWorkspaceV2Claims(record);
            })
            .catch(() => {});
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

    resetTwitchWorkspaceV2ClaimCache();
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
                    TWITCH_SPLIT_LAB_STORAGE_KEY,
                    TWITCH_WORKSPACE_V2_STORAGE_KEY,
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

        const splitWindowIds =
            Array.isArray(state[TWITCH_SPLIT_LAB_STORAGE_KEY]?.windowIds)
                ? state[TWITCH_SPLIT_LAB_STORAGE_KEY].windowIds
                : [];

        for (const windowId of splitWindowIds) {
            if (Number.isInteger(windowId)) {
                shellWindowIds.add(windowId);
            }
        }

        const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
        for (const slotId of ["a", "b", "c", "d"]) {
            const windowId = workspaceRecord?.slots?.[slotId]?.windowId;
            if (Number.isInteger(windowId)) shellWindowIds.add(windowId);
        }
        if (Number.isInteger(workspaceRecord?.chat?.windowId)) {
            shellWindowIds.add(workspaceRecord.chat.windowId);
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
                TWITCH_WORKSPACE_V2_STORAGE_KEY,
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
        let surfaceMember = null;

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
            if (layoutProfile === "wide") {
                const workspaceRecord = state[TWITCH_WORKSPACE_V2_STORAGE_KEY];
                for (const slotId of ["a", "b", "c", "d"]) {
                    if (workspaceRecord?.slots?.[slotId]?.windowId === focusedWindow.id) {
                        surfaceMode = "twitch";
                        surfaceSide = "right";
                        surfaceMember = slotId;
                        break;
                    }
                }
                if (!surfaceMember && workspaceRecord?.chat?.windowId === focusedWindow.id) {
                    surfaceMode = "twitch";
                    surfaceSide = "right";
                    surfaceMember = "chat";
                }
            }

            if (!surfaceMode) {
                const providerEntry =
                    Object.entries(
                        state.providerWindows || {}
                    )
                        .find(
                            ([provider, windowId]) =>
                                PROVIDERS[provider] &&
                                windowId === focusedWindow.id
                        );

                surfaceMode =
                    providerEntry?.[0] ||
                    null;
                surfaceSide =
                    surfaceMode
                        ? "left"
                        : null;
            }
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

        const claim = {
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
        };

        if (surfaceMember) {
            const rect = getTwitchWorkspaceV2Rects()[surfaceMember];
            if (rect) {
                claim.member = surfaceMember;
                claim.left = rect.left;
                claim.top = rect.top;
                claim.width = rect.width;
                claim.height = rect.height;
            }
        }

        titlebarPort.postMessage(claim);

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


let titlebarSlowReconcileInFlight = false;
// A normal native heartbeat is cheap and mandatory. Browser-wide recovery
// queries are not: do not poke Opera's parked renderer windows every 10s
// while an unrelated application (e.g. a fullscreen game) owns focus.
// The focus fast-path updates this memory-only visibility hint without IPC.
let titlebarSlowReconcileSkippedUnmanaged = 0;
let titlebarSlowReconcileLastRanAt = null;
function shouldDeferTitlebarSlowReconcile() {
    return streamShellDisplayProfileCache?.mode === 'wide' &&
        shellWideFocusCacheReady === true && shellWideFocusVisibility === 'none';
}

async function titlebarReconcileSlowPass() {
    if (titlebarSlowReconcileInFlight || shuttingDown || !titlebarProtocolReady) return;
    if (shouldDeferTitlebarSlowReconcile()) {
        titlebarSlowReconcileSkippedUnmanaged++;
        return;
    }
    titlebarSlowReconcileInFlight = true;
    titlebarSlowReconcileLastRanAt = Date.now();
    try {
        await claimFocusedTitlebarSurface();
        await reconcileTwitchWorkspaceV2Claims();
    } catch (error) {
        console.warn("Stream Shell native surface reconciliation failed:", error);
    } finally {
        titlebarSlowReconcileInFlight = false;
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

    let titlebarReconcileTick = 0;

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
                 * Heartbeats need to remain comfortably inside the native
                 * 6.5-second freshness window. Surface claims are already
                 * event-driven, so use the periodic path only as a 10-second
                 * self-heal instead of re-querying browser/native state on
                 * every heartbeat.
                 */
                // A lost update/ack is retried without any HWND or z-order action.
                if (titlebarProviderGeneration > titlebarProviderAckGeneration &&
                    titlebarReconcileTick % 4 === 0) sendTitlebarProviderPayload();

                titlebarReconcileTick += 1;
                if (titlebarReconcileTick % 4 === 0) {
                    // Never pile up overlapping browser/window queries when Opera
                    // is under GPU or UI-thread pressure.
                    void titlebarReconcileSlowPass();
                }
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
    visibilityMode = "none",
    twitchTarget = "resume"
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

    const nextTwitchTarget =
        twitchTarget === "drops"
            ? "drops"
            : "resume";

    const layoutProfile =
        streamShellDisplayProfileCache?.mode || "wide";

    const key =
        `${nextLeft}|${nextRight}|${nextTwitchTarget}|${nextVisibility}|${layoutProfile}|${titlebarSettingsOpen ? "1" : "0"}|${titlebarVolumeActive ? "1" : "0"}|${titlebarFullscreenActive ? "1" : "0"}|${getTitlebarGeometryStateKey()}`;

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

            twitchTarget:
                nextTwitchTarget,

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
                "rightMode",
                "twitchTarget"
            ]),
            getTitlebarVisibilityMode()
        ]);

    sendTitlebarState(
        state.leftMode ||
            "landing",
        state.rightMode ||
            "dashboard",
        visibilityMode,
        state.twitchTarget ||
            "resume"
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

    if (message?.event === "provider-buttons-ack") {
        if (message.accepted === true && message.protocolVersion === TITLEBAR_PROTOCOL_VERSION &&
            message.generation === titlebarProviderGeneration) {
            titlebarProviderAckGeneration = message.generation;
            titlebarProviderLastAckAt = Date.now();
            titlebarProviderLastRejectedIconCount = Number(message.skippedIcons) || 0;
            if (titlebarProviderLastRejectedIconCount > 0)
                titlebarProviderLastError = `native-skipped-${titlebarProviderLastRejectedIconCount}-icons`;
        } else if (message.accepted === false && message.generation === titlebarProviderGeneration) {
            titlebarProviderLastError = "native-rejected-provider-payload";
        }
        return;
    }

    if (
        message?.event ===
            "claim-accepted"
    ) {
        try {
            rememberTwitchWorkspaceV2NativeCaption(message);
            acknowledgeTwitchWorkspaceV2Claim(message);
        } catch {
        }
        /*
         * Claims are idempotent. Leave any already scheduled onboarding probes
         * alive so concurrent Wide surfaces cannot cancel each other. A real
         * unmanaged-window transition cancels the whole generation instead.
         */
        return;
    }

    if (message?.event === "claim-expired") {
        invalidateTwitchWorkspaceV2Claim(message);
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

                if (typeof action === "string" && action.startsWith("custom-") && !PROVIDERS[action]) {
                    await refreshStreamShellProviderTargets();
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
                    "twitch-drops"
                ) {
                    await showTwitch("drops");
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


