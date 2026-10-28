/* Mangayomi is a native left-pane app, not an Opera web provider. */
async function mangayomiNativeCommand(action, search = null) {
    // A disabled setting is a runtime denial, not merely a hidden UI control.
    // `hide` remains available so an existing window can be cleaned up on revoke.
    if (action !== "hide" && action !== "kill") {
        const gate = await chrome.storage.local.get("streamShellSevenSeasAcknowledged");
        if (gate.streamShellSevenSeasAcknowledged !== true)
            throw new Error("Mangayomi is disabled. Acknowledge the Seven Seas in General settings first.");
    }
    const stored = await chrome.storage.local.get(MANGAYOMI_PATH_KEY);
    const path = String(stored[MANGAYOMI_PATH_KEY] || "").trim();
    // Align Flutter's content below Stream Shell's Wide chrome (two live screenshot adjustments).
    // Preserve LEFT bottom edge: inset and height reduction always match.
    const profile = (action === "show" || action === "search" || action === "lookup" || action === "open-result")
        ? await getStreamShellDisplayProfile().catch(() => null) : null;
    const isWide = profile?.mode !== "compact";
    const wideTopInset = 6;
    const geometry = (action === "show" || action === "search" || action === "lookup" || action === "open-result") && isWide
        ? {...LEFT, top: LEFT.top + wideTopInset, height: LEFT.height - wideTopInset} : LEFT;
    const response = await chrome.runtime.sendNativeMessage(MANGAYOMI_NATIVE_HOST, {
        action, executablePath: path, ...geometry,
        ...((action === "open-result" && search ? {resultId:search.resultId} :
            (action === "search" || action === "lookup") && search ? {query:search.query, itemType:search.itemType} : {}))
    });
    if (response?.ok !== true) {
        throw new Error(response?.error || "Mangayomi native helper unavailable. Install integrations/mangayomi/install-mangayomi-helper.ps1.");
    }
    return response;
}

async function killMangayomiByUserRequest() {
    // Invalidate any pending reveal before killing the process.
    ++mangayomiPendingRevealGeneration;
    const result = await mangayomiNativeCommand("kill");
    const stored = await chrome.storage.local.get("leftMode");
    if (stored.leftMode === "mangayomi" && !shuttingDown) {
        // The now-absent process cannot be accidentally foregrounded by the
        // regular provider-switch path; it only handles normal Opera windows.
        await switchProvider("youtube");
    }
    await recordFlightEvent({source:"background", category:"native-app",
        action:"mangayomi-hard-kill", provider:"mangayomi"}).catch(() => {});
    return result;
}

async function hideMangayomiIfActive() {
    const { leftMode } = await chrome.storage.local.get("leftMode");
    if (leftMode !== "mangayomi") return;
    try {
        await mangayomiNativeCommand("hide");
        recordFlightEvent({source: "background", category: "native-app", action: "mangayomi-hidden", provider: "mangayomi"}).catch(() => {});
    } catch (error) {
        recordFlightEvent({source: "background", category: "native-app", action: "mangayomi-hide-failed", provider: "mangayomi",
            detail: {error: String(error?.message || error).slice(0, 180)}}).catch(() => {});
        console.warn("Mangayomi hide unavailable:", error?.message || error);
    }
}

async function showMangayomi() {
    if (shuttingDown) return;
    const stored = await chrome.storage.local.get(STREAM_SHELL_PROVIDER_REGISTRY_KEY);
    const registry = normalizeStreamShellProviderRegistry(stored[STREAM_SHELL_PROVIDER_REGISTRY_KEY]);
    if (!registry.providers.some(item => item.id === "mangayomi" && item.enabled))
        throw new Error("Mangayomi integration is disabled in provider settings.");

    const displayProfile = await getStreamShellDisplayProfile().catch(() => null);
    const wide = displayProfile?.mode !== "compact";

    // Do not replace activeProvider with a nonexistent browser provider.
    // No Opera window mutations until the optional native app starts successfully.
    await stopVolumeCaptureForProviderChange("mangayomi");
    await mangayomiNativeCommand("show");
    if (shuttingDown) return;

    if (wide) {
        /*
         * The Wide Landing HWND is Stream Shell's Win32 Alt+Tab OWNER / anchor.
         * Minimizing it also minimizes its owned right-hand Dashboard (and can
         * collapse the entire shell). Keep Landing NORMAL behind Mangayomi,
         * just as Discord leaves Dashboard alive behind its native window.
         * Restore it here as well to repair an anchor left minimized by 0.21.0.
         */
        const landingId = await ensureLandingWindow();
        if (shuttingDown) return;
        await restoreWindow(landingId, LEFT, false);
    }

    const windows = await getProviderWindows();
    await Promise.all(Object.entries(windows).filter(([, id]) => Number.isInteger(id))
        .map(async ([name, id]) => {
            await pauseProviderWindowPlayback(id, name, "mangayomi").catch(() => {});
            await setWindowMuted(id, true).catch(() => {});
            await safelyMinimizeWindow(id).catch(() => {});
        }));

    if (wide) {
        // Repair a Dashboard already minimized by the old Landing-owner bug,
        // but never change the selected right mode (Discord/Twitch stay put).
        const { rightMode } = await chrome.storage.local.get("rightMode");
        if (rightMode === "dashboard") {
            const dashboardId = await ensureDashboardWindow();
            if (shuttingDown) return;
            await restoreWindow(dashboardId, RIGHT, false);
        }
    }

    if (shuttingDown) return;
    // Opera's old LEFT provider transitions can change Windows foreground.
    // Reassert Mangayomi only after the owned Opera HWNDs have settled.
    await mangayomiNativeCommand("show");
    if (shuttingDown) return;
    await chrome.storage.local.set({ leftMode: "mangayomi" });
    await broadcastState();
}

/*
 * Dashboard can raise its Win32 Landing owner above the external Mangayomi
 * window whenever focus returns to Opera. Unlike `show`, `raise` is passive:
 * the native host reorders an already-visible HWND WITHOUT taking keyboard focus,
 * restoring/minimizing any window, or touching Discord/right Twitch.
 * Only schedule on a RIGHT Dashboard focus event while LEFT is Mangayomi.
 */
let mangayomiWideRaiseTimer = null;
let mangayomiWideRaiseInFlight = false;
let mangayomiWideRaiseLastAt = 0;
function scheduleMangayomiWideReassert() {
    if (shuttingDown || streamShellDisplayProfileCache?.mode === "compact") return;
    if (mangayomiWideRaiseTimer !== null) clearTimeout(mangayomiWideRaiseTimer);
    mangayomiWideRaiseTimer = setTimeout(async () => {
        mangayomiWideRaiseTimer = null;
        if (shuttingDown || mangayomiWideRaiseInFlight) return;
        // Verify the CURRENT state, not the stale onFocusChanged cache.
        const state = await chrome.storage.local.get(["leftMode", "rightMode"]);
        if (state.leftMode !== "mangayomi" || state.rightMode !== "dashboard" ||
            streamShellDisplayProfileCache?.mode === "compact") return;
        if (Date.now() - mangayomiWideRaiseLastAt < 150) return;
        mangayomiWideRaiseInFlight = true;
        try {
            await mangayomiNativeCommand("raise");
            mangayomiWideRaiseLastAt = Date.now();
        } catch (error) {
            console.warn("Mangayomi passive Wide reassert unavailable:", error?.message || error);
        } finally {
            mangayomiWideRaiseInFlight = false;
        }
    }, 80);
}

// Explicit, user-triggered experimental direct search: requires a Mangayomi
// build with the matching global-search URI handler. NOT a results API.
async function streamShellMangayomiDirectSearch(query, itemType) {
    if (!["anime", "manga", "novel"].includes(itemType) ||
        typeof query !== "string" || !query.trim() || query.length > 200 ||
        /[\u0000-\u001f\u007f]/.test(query))
        throw new Error("Invalid Mangayomi direct-search request.");
    if (shuttingDown) throw new Error("Stream Shell shutting down.");
    try {
        const response = await mangayomiNativeCommand("lookup", {query, itemType});
        const parsed = JSON.parse(response.searchResultsJson || "null");
        if (!parsed?.ok || !Array.isArray(parsed.sources))
            throw new Error("Mangayomi bridge returned an invalid source-result payload.");
        return {dispatched:true, fallback:false, searchResults:parsed};
    } catch (error) {
        // Preserve the precise startup/bridge error instead of incorrectly
        // telling users to start Mangayomi manually. Lookup auto-starts the
        // configured fork and checks that the bridge belongs to its PID.
        if (String(error?.message || error).includes("MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE"))
            return {dispatched:false, fallback:true,
                reason:String(error?.message || error).replace(/^.*MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE:\s*/, "").slice(0, 400)};
        throw error;
    }
}

// User-selected opaque hit from the last completed source scan. Mangayomi's
// bridge resolves the ID against in-memory MManga objects and navigates to its
// native detail page; no source URL is accepted from the extension.
// When /v1/open accepts a result before Flutter creates its Win32 window,
// the old helper reports "Result opened but Mangayomi window is not ready".
// That is NOT a failed navigation. Never send /v1/open twice for the same hit.
// Poll the non-launching `status` action until an HWND exists, then show it.
let mangayomiPendingRevealGeneration = 0;
function scheduleMangayomiPendingResultReveal(initialLeftMode) {
    const generation = ++mangayomiPendingRevealGeneration;
    let attempts = 0;
    const check = async () => {
        if (shuttingDown || generation !== mangayomiPendingRevealGeneration) return;
        try {
            const state = await chrome.storage.local.get("leftMode");
            // A user-initiated provider change cancels the delayed reveal.
            if (state.leftMode !== initialLeftMode) return;
            const status = await mangayomiNativeCommand("status");
            // `status` never starts a second Mangayomi process. `running:true`
            // means the helper found an actual window for the configured fork.
            if (status.running === true) {
                await showMangayomi();
                return;
            }
        } catch (error) {
            console.warn("Mangayomi result reveal not ready:", error?.message || error);
        }
        if (++attempts < 16 && generation === mangayomiPendingRevealGeneration)
            setTimeout(check, 5000);
    };
    setTimeout(check, 1200);
}

async function streamShellMangayomiOpenSourceResult(resultId) {
    if (typeof resultId !== "string" || !/^[A-Za-z0-9_-]{22,40}$/.test(resultId))
        throw new Error("Invalid Mangayomi result ID.");
    let windowPending = false;
    try {
        const response = await mangayomiNativeCommand("open-result", {resultId});
        windowPending = response.visible === false;
    } catch (error) {
        // Native v0.21.25 returns failure only because the Flutter window is
        // not ready; its /v1/open request has already succeeded at this point.
        if (!/Result opened but Mangayomi window is not ready\.|Could not position selected result\./.test(String(error?.message || error)))
            throw error;
        windowPending = true;
    }
    if (!windowPending) {
        try {
            // Existing fast path: completed navigation and Win32 window ready.
            await showMangayomi();
            return {opened:true, pending:false};
        } catch (error) {
            // Window can disappear during the Flutter route transition.
            if (!/window (?:could not be identified|unavailable)|main window unavailable/i.test(String(error?.message || error)))
                throw error;
            windowPending = true;
        }
    }
    // The result was accepted by Mangayomi. Report that accurately, rather
    // than falsely asking for another fork build. Do not call `show` while
    // the HWND is absent: the legacy helper could start a second instance.
    if (windowPending) {
        const state = await chrome.storage.local.get("leftMode");
        scheduleMangayomiPendingResultReveal(state.leftMode);
        return {opened:true, pending:true};
    }
}

// Revoking acknowledgement must also prevent a currently active native pane
// from continuing to be exposed as an enabled Stream Shell provider.
chrome.storage.onChanged?.addListener?.((changes, area) => {
    if (area !== "local" || !changes.streamShellSevenSeasAcknowledged ||
        changes.streamShellSevenSeasAcknowledged.newValue === true) return;
    void (async () => {
        const stored = await chrome.storage.local.get("leftMode");
        if (stored.leftMode !== "mangayomi" || shuttingDown) return;
        await mangayomiNativeCommand("hide").catch(() => {});
        await switchProvider("youtube");
    })().catch(error => console.warn("Seven Seas revoke transition failed", error));
});
