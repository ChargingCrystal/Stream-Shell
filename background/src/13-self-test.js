/*
 * ============================================================
 * STREAM SHELL LAUNCH SELF-TEST
 * ============================================================
 * Cheap core checks run whenever the shell is opened. Provider DOM/player
 * checks are reported lazily by each provider content script when loaded.
 */

const STREAM_SHELL_SELF_TEST_KEY = "streamShellLaunchSelfTest";
const STREAM_SHELL_PROVIDER_API_VERSION = 1;

async function runStreamShellLaunchSelfTest() {
    const manifest = chrome.runtime.getManifest() || {};
    const startedAt = Date.now();
    let storageReadable = false;
    let providerWindows = {};
    let browserWindows = [];

    try {
        const stored = await chrome.storage.local.get(["providerWindows"]);
        storageReadable = true;
        providerWindows = stored.providerWindows || {};
    } catch {
    }

    try {
        browserWindows = await chrome.windows.getAll({ populate: false });
    } catch {
    }

    const aliveWindowIds = new Set(
        browserWindows
            .map(item => item.id)
            .filter(Number.isInteger)
    );

    const providers = {};
    for (const provider of Object.keys(PROVIDERS)) {
        const windowId = Number.isInteger(providerWindows?.[provider])
            ? providerWindows[provider]
            : null;
        providers[provider] = {
            state: windowId === null
                ? "not-opened"
                : aliveWindowIds.has(windowId)
                    ? "waiting"
                    : "window-missing",
            windowKnown: windowId !== null,
            windowAlive: windowId !== null && aliveWindowIds.has(windowId),
            report: null,
            updatedAt: null
        };
    }

    const checks = {
        storage: {
            ok: storageReadable,
            state: storageReadable ? "readable" : "unavailable"
        },
        manifest: {
            ok: Number(manifest.manifest_version) === 3,
            state: `MV${manifest.manifest_version || "?"}`
        },
        providerRegistry: {
            ok: Object.keys(PROVIDERS).length === 5,
            state: `${Object.keys(PROVIDERS).length} providers`
        },
        providerApi: {
            ok: true,
            state: `contract v${STREAM_SHELL_PROVIDER_API_VERSION}`
        },
        titlebarHelper: {
            ok: Boolean(titlebarPort),
            state: titlebarPort ? "connected" : "unavailable"
        }
    };

    const snapshot = {
        format: "stream-shell-self-test",
        version: 1,
        extensionVersion: manifest.version || "unknown",
        providerApiVersion: STREAM_SHELL_PROVIDER_API_VERSION,
        startedAt,
        updatedAt: Date.now(),
        ok: Object.values(checks).every(check => check.ok !== false),
        checks,
        providers
    };

    try {
        await chrome.storage.local.set({
            [STREAM_SHELL_SELF_TEST_KEY]: snapshot
        });
    } catch {
    }

    recordFlightEvent({
        source: "background",
        category: "self-test",
        action: "launch",
        level: snapshot.ok ? "info" : "error",
        detail: { ok: snapshot.ok }
    }).catch(() => {});

    return snapshot;
}

async function updateProviderSelfTestReport(provider, report) {
    if (!PROVIDERS[provider] || !report || typeof report !== "object") return false;

    let snapshot = null;
    try {
        snapshot = (await chrome.storage.local.get(STREAM_SHELL_SELF_TEST_KEY))[STREAM_SHELL_SELF_TEST_KEY] || null;
    } catch {
    }

    if (!snapshot) snapshot = await runStreamShellLaunchSelfTest();

    snapshot.providers = snapshot.providers || {};
    const previousProviderState = snapshot.providers[provider]?.state || "unknown";
    const previousProviderOk = snapshot.providers[provider]?.report?.ok;

    snapshot.providers[provider] = {
        ...(snapshot.providers[provider] || {}),
        state: report.ok === false ? "failed" : "reported",
        windowKnown: true,
        windowAlive: true,
        report: {
            ok: report.ok !== false,
            apiVersion: Number(report.apiVersion) || null,
            managed: report.managed === true,
            watchContext: report.watchContext === true,
            videoPresent: report.videoPresent === true,
            failures: Array.isArray(report.failures) ? report.failures.slice(0, 20) : [],
            capabilities: report.capabilities && typeof report.capabilities === "object"
                ? report.capabilities
                : {},
            checkedAt: Number(report.checkedAt) || Date.now()
        },
        updatedAt: Date.now()
    };

    snapshot.updatedAt = Date.now();
    snapshot.ok = Object.values(snapshot.checks || {}).every(check => check?.ok !== false) &&
        Object.values(snapshot.providers || {}).every(entry => entry?.state !== "failed");

    try {
        await chrome.storage.local.set({
            [STREAM_SHELL_SELF_TEST_KEY]: snapshot
        });
    } catch {
    }

    const nextProviderState = snapshot.providers[provider].state;
    const nextProviderOk = snapshot.providers[provider].report?.ok;
    if (
        previousProviderState !== nextProviderState ||
        previousProviderOk !== nextProviderOk
    ) {
        recordFlightEvent({
            source: "background",
            category: "self-test",
            action: "provider-transition",
            level: nextProviderOk === false ? "error" : "info",
            provider,
            detail: {
                from: previousProviderState,
                to: nextProviderState,
                ok: nextProviderOk !== false
            }
        }).catch(() => {});
    }

    return true;
}
