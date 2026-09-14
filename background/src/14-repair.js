/*
 * ============================================================
 * DIAGNOSTICS SELF-HEAL / REPAIR ORCHESTRATION
 * ============================================================
 * Background owns provider tab targeting and the final escalation steps.
 */
const STREAM_SHELL_BACKGROUND_REPAIR_ACTIONS = new Set([
    "restore-managed-marker",
    "clear-pending-resume",
    "resync-adapter",
    "resync-content-state",
    "reinitialize-runtime",
    "netflix-bridge-probe",
    "reload-provider"
]);

async function getProviderRepairTarget(provider) {
    if (!PROVIDERS[provider]) return null;

    const windows = await getProviderWindows();
    const windowId = Number.isInteger(windows?.[provider])
        ? windows[provider]
        : null;
    if (windowId === null) return null;

    try {
        await chrome.windows.get(windowId);
        const tabs = await chrome.tabs.query({ windowId, active: true });
        const tab = tabs[0] || null;
        if (!Number.isInteger(tab?.id)) return null;
        return { windowId, tabId: tab.id };
    } catch {
        return null;
    }
}

async function sendProviderRepairCommand(tabId, action) {
    try {
        return await chrome.tabs.sendMessage(tabId, {
            type: "stream-shell-provider-repair",
            action
        });
    } catch (error) {
        return {
            ok: false,
            action,
            detail: {
                reason: "content-repair-unavailable",
                error: String(error?.message || error || "send-failed")
            }
        };
    }
}

async function runStreamShellProviderRepair(provider, action) {
    const normalizedProvider = String(provider || "");
    const normalizedAction = String(action || "");

    if (
        !PROVIDERS[normalizedProvider] ||
        !STREAM_SHELL_BACKGROUND_REPAIR_ACTIONS.has(normalizedAction)
    ) {
        return { ok: false, error: "Unsupported repair request." };
    }

    const target = await getProviderRepairTarget(normalizedProvider);
    if (!target) {
        return { ok: false, error: "Provider window is unavailable." };
    }

    recordFlightEvent({
        source: "background",
        category: "repair",
        action: "dispatch",
        provider: normalizedProvider,
        detail: { repairAction: normalizedAction }
    }).catch(() => {});

    if (normalizedAction === "reload-provider") {
        try {
            await chrome.tabs.reload(target.tabId);
            recordFlightEvent({
                source: "background",
                category: "repair",
                action: "provider-reloaded",
                provider: normalizedProvider,
                detail: { escalation: "last-resort" }
            }).catch(() => {});
            return {
                ok: true,
                provider: normalizedProvider,
                action: normalizedAction,
                detail: { escalation: "last-resort" }
            };
        } catch (error) {
            return {
                ok: false,
                provider: normalizedProvider,
                action: normalizedAction,
                error: String(error?.message || error || "reload-failed")
            };
        }
    }

    if (normalizedAction === "clear-pending-resume") {
        let contentResult = await sendProviderRepairCommand(
            target.tabId,
            normalizedAction
        );
        try {
            await chrome.storage.local.remove(
                `streamShellPendingResume_${normalizedProvider}`
            );
            if (!contentResult?.ok) {
                contentResult = {
                    ok: true,
                    provider: normalizedProvider,
                    action: normalizedAction,
                    detail: {
                        clearedInBackground: true,
                        contentRuntimeUnavailable: true
                    }
                };
            }
        } catch {
        }
        return contentResult;
    }

    if (normalizedAction === "netflix-bridge-probe") {
        if (normalizedProvider !== "netflix") {
            return { ok: false, error: "Netflix bridge repair is Netflix-only." };
        }

        let result = await sendProviderRepairCommand(
            target.tabId,
            normalizedAction
        );
        if (result?.ok === true) return result;

        try {
            await chrome.scripting.executeScript({
                target: { tabId: target.tabId },
                files: ["providers/player/netflix-bridge.js"],
                world: "MAIN"
            });

            await new Promise(resolve => setTimeout(resolve, 120));
            result = await sendProviderRepairCommand(
                target.tabId,
                normalizedAction
            );

            if (result?.ok === true) {
                result.detail = {
                    ...(result.detail || {}),
                    bridgeReinjected: true
                };
            }
        } catch (error) {
            result = {
                ok: false,
                provider: normalizedProvider,
                action: normalizedAction,
                error: String(error?.message || error || "bridge-reinject-failed")
            };
        }

        return result;
    }

    return sendProviderRepairCommand(target.tabId, normalizedAction);
}
