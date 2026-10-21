function escapeSettingsHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function diagnosticsStatusClass(ok, neutral = false) {
    if (neutral) return "neutral";
    return ok ? "good" : "bad";
}

function diagnosticsRow(label, value, status = "neutral") {
    const safeValue = escapeSettingsHtml(value);
    return `
        <div class="settings-diagnostics-row">
            <span>${escapeSettingsHtml(label)}</span>
            <strong class="settings-diagnostics-value ${status}" title="${safeValue}">
                ${safeValue}
            </strong>
        </div>
    `;
}

function diagnosticsCard(title, rows, note = "", className = "") {
    const classes = ["settings-diagnostics-card", className]
        .filter(Boolean)
        .join(" ");
    return `
        <section class="${escapeSettingsHtml(classes)}">
            <div class="settings-diagnostics-card-heading">
                <h3>${escapeSettingsHtml(title)}</h3>
                ${note ? `<p>${escapeSettingsHtml(note)}</p>` : ""}
            </div>
            <div class="settings-diagnostics-rows">${rows}</div>
        </section>
    `;
}

function diagnosticsSection(id, title, description, content, layout = "") {
    const layoutClass = layout ? ` settings-diagnostics-layout-${escapeSettingsHtml(layout)}` : "";
    return `
        <section class="settings-diagnostics-section${layoutClass}" data-diagnostics-section="${escapeSettingsHtml(id)}">
            <div class="settings-diagnostics-section-heading">
                <span>${escapeSettingsHtml(id)}</span>
                <div>
                    <h2>${escapeSettingsHtml(title)}</h2>
                    ${description ? `<p>${escapeSettingsHtml(description)}</p>` : ""}
                </div>
            </div>
            <div class="settings-diagnostics-section-grid">${content}</div>
        </section>
    `;
}

function diagnosticsCapabilityCell(capability) {
    if (!capability || capability.supported !== true) {
        return `<span class="settings-diagnostics-cap neutral">—</span>`;
    }

    const status = capability.available === true ? "good" : "bad";
    const label = capability.available === true ? "OK" : "WAIT";
    const detail = capability.state || capability.detail || "";
    return `<span class="settings-diagnostics-cap ${status}" title="${escapeSettingsHtml(detail)}">${label}</span>`;
}

function diagnosticsCapabilityMatrix(providerStates, selfTest = {}) {
    const rows = Object.entries(PROVIDER_NAMES).map(([provider, label]) => {
        const state = providerStates[provider] || {};
        const page = state.page || {};
        const cachedReport = selfTest?.providers?.[provider]?.report || null;
        const flattened = cachedReport?.capabilities || {};
        const cachedCommon = Object.fromEntries(
            Object.entries(flattened)
                .filter(([key]) => key.startsWith("common."))
                .map(([key, value]) => [key.slice("common.".length), value])
        );
        const cachedExtensions = Object.fromEntries(
            Object.entries(flattened)
                .filter(([key]) => key.startsWith("extensions."))
                .map(([key, value]) => [key.slice("extensions.".length), value])
        );
        const common = page.api?.capabilities?.common || cachedCommon;
        const extensions = page.api?.capabilities?.extensions || cachedExtensions;
        const extensionEntries = Object.entries(extensions);
        const extensionAvailable = extensionEntries.filter(([, capability]) => capability?.supported === true && capability?.available === true).length;
        const extensionSupported = extensionEntries.filter(([, capability]) => capability?.supported === true).length;
        const adapterState = !state.known
            ? `<span class="settings-diagnostics-cap neutral">COLD</span>`
            : state.alive === false
                ? `<span class="settings-diagnostics-cap bad">DOWN</span>`
                : page.ok && page.api?.adapterLoaded
                    ? `<span class="settings-diagnostics-cap good">v${escapeSettingsHtml(page.api.version || "?")}</span>`
                    : cachedReport?.apiVersion
                        ? `<span class="settings-diagnostics-cap ${cachedReport.ok === false ? "bad" : "good"}" title="Last cached Provider API self-test">v${escapeSettingsHtml(cachedReport.apiVersion || "?")}*</span>`
                        : `<span class="settings-diagnostics-cap neutral">IDLE</span>`;

        return `
            <tr>
                <th>${escapeSettingsHtml(label)}</th>
                <td>${adapterState}</td>
                <td>${diagnosticsCapabilityCell(common.watchContext)}</td>
                <td>${diagnosticsCapabilityCell(common.playback)}</td>
                <td>${diagnosticsCapabilityCell(common.seek)}</td>
                <td>${diagnosticsCapabilityCell(common.progress)}</td>
                <td>${diagnosticsCapabilityCell(common.resume)}</td>
                <td><span class="settings-diagnostics-cap ${extensionSupported && extensionAvailable === extensionSupported ? "good" : "neutral"}">${extensionSupported ? `${extensionAvailable}/${extensionSupported}` : "—"}</span></td>
            </tr>
        `;
    }).join("");

    return `
        <section class="settings-diagnostics-card settings-diagnostics-card-wide settings-diagnostics-capability-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Provider capability matrix</h3>
                <p>Last recorded Provider API health; * indicates a cached self-test, not a current DOM probe. Deep export refreshes live details.</p>
            </div>
            <div class="settings-diagnostics-matrix-wrap">
                <table class="settings-diagnostics-matrix">
                    <thead>
                        <tr>
                            <th>Provider</th>
                            <th>Adapter</th>
                            <th>Watch</th>
                            <th>Playback</th>
                            <th>Seek</th>
                            <th>Progress</th>
                            <th>Resume</th>
                            <th>Extensions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function collectSettingsDiagnostics(options = {}) {
    const full = options.full === true;
    let runtime = {};
    try {
        runtime = await chrome.runtime.sendMessage({
            type: full ? "dashboard-diagnostics" : "dashboard-diagnostics-lite",
            full
        }) || {};
    } catch {
        runtime = { ok: false };
    }

    const modifiedKeys = Object.keys(SETTINGS_DEFAULTS)
        .filter(key => {
            const current = settingValue(key);
            const baseline = SETTINGS_DEFAULTS[key];
            return JSON.stringify(current) !== JSON.stringify(baseline);
        });

    const liveProvider = PROVIDERS.has(currentLeftMode)
        ? currentLeftMode
        : null;
    const liveMedia = liveProvider
        ? nowPlayingByProvider[liveProvider] || null
        : null;
    const liveCurrentTime = liveMedia
        ? getLiveNowPlayingCurrentTime(liveMedia)
        : null;
    const liveDuration = Number(liveMedia?.duration);

    const sleep = sleepTimerState
        ? {
            active: true,
            provider: sleepTimerState.provider || null,
            mode: sleepTimerState.mode || null,
            action: sleepTimerState.action || settingValue("streamShellSleepTimerAction")
        }
        : {
            active: false,
            provider: null,
            mode: null,
            action: settingValue("streamShellSleepTimerAction")
        };

    const manifest = chrome.runtime.getManifest() || {};
    const providerStates = runtime.providerWindows || {};

    return {
        format: "stream-shell-diagnostics",
        version: 13,
        mode: full ? "full" : "panel",
        generatedAt: new Date().toISOString(),
        extensionVersion: manifest.version || "unknown",
        environment: {
            userAgent: navigator.userAgent,
            platform: navigator.platform || null,
            language: navigator.language || null,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            },
            screen: {
                width: window.screen?.width || null,
                height: window.screen?.height || null,
                availWidth: window.screen?.availWidth || null,
                availHeight: window.screen?.availHeight || null
            }
        },
        manifest: {
            manifestVersion: manifest.manifest_version || null,
            permissions: [...(manifest.permissions || [])],
            hostPermissions: [...(manifest.host_permissions || [])]
        },
        displayProfile: runtime.displayProfile || null,
        settingsUi: {
            provider: settingsProvider,
            section: settingsSection,
            searchQueryLength: settingsSearchQuery.length,
            diagnosticsOpen: diagnosticsIsOpen()
        },
        shell: {
            leftMode: runtime.leftMode || currentLeftMode || "unknown",
            rightMode: runtime.rightMode || "unknown",
            activeProvider: runtime.activeProvider || null,
            browserWindowsTotal: Number.isInteger(runtime.browserWindowsTotal) ? runtime.browserWindowsTotal : null,
            managedWindowsRegistered: Number.isInteger(runtime.managedWindowsRegistered) ? runtime.managedWindowsRegistered : null,
            providerWindowsAlive: Number.isInteger(runtime.providerWindowsAlive) ? runtime.providerWindowsAlive : null,
            providerWindowsKnown: Number(runtime.providerWindowsKnown) || 0,
            providerWindows: providerStates,
            landingWindowAlive: runtime.landingWindowAlive === true,
            dashboardWindowAlive: runtime.dashboardWindowAlive === true,
            landingWindowRegistered: runtime.landingWindowRegistered === true,
            dashboardWindowRegistered: runtime.dashboardWindowRegistered === true,
            twitchSplitLab: runtime.twitchSplitLab || {
                active: false,
                windowCount: 0,
                windows: []
            },
            twitchWorkspaceV2: runtime.twitchWorkspaceV2 || {
                active: false,
                version: 1,
                windows: []
            }
        },
        native: {
            titlebarConnected: runtime.titlebarConnected === true,
            titlebarVisibilityMode: runtime.titlebarVisibilityMode || "unknown",
            titlebarSettingsOpen: runtime.titlebarSettingsOpen === true,
            titlebarVolumeActive: runtime.titlebarVolumeActive === true,
            titlebarArtwork: runtime.titlebarArtwork || {},
            titlebarProtocolReady: runtime.titlebarProtocolReady === true,
            titlebarProtocolVersion: runtime.titlebarProtocolVersion || null,
            titlebarNativeStatus: runtime.titlebarNativeStatus || null,
            titlebarProviderSync: runtime.titlebarProviderSync || null,
            discordHelperConnected: runtime.discord ? runtime.discord.ok === true : null,
            discordRunning: runtime.discord ? runtime.discord.running === true : null,
            discordVisible: runtime.discord ? runtime.discord.visible === true : null
        },
        audio: {
            active: runtime.audio?.active === true,
            provider: runtime.audio?.provider || null,
            percent: runtime.audio?.percent != null && Number.isFinite(Number(runtime.audio.percent))
                ? Number(runtime.audio.percent)
                : null,
            profile: runtime.audio?.profile || null,
            offscreenDocumentAlive: typeof runtime.offscreenDocumentAlive === 'boolean' ? runtime.offscreenDocumentAlive : null
        },
        playback: {
            provider: liveProvider,
            state: liveMedia?.playbackState || null,
            currentTime: Number.isFinite(Number(liveCurrentTime)) ? Number(liveCurrentTime) : null,
            duration: Number.isFinite(liveDuration) && liveDuration > 0 ? liveDuration : null,
            progressPercent: Number.isFinite(Number(liveCurrentTime)) && Number.isFinite(liveDuration) && liveDuration > 0
                ? Math.max(0, Math.min(100, Number(liveCurrentTime) / liveDuration * 100))
                : null,
            hasRating: nowPlayingRating?.hidden === false && Boolean(nowPlayingRating?.textContent?.trim()),
            ratingKind: nowPlayingRating?.dataset?.ratingKind || null
        },
        sleepTimer: sleep,
        selfTest: runtime.launchSelfTest || null,
        runtimeCounters: runtime.runtimeCounters || null,
        cacheReady: runtime.cacheReady === true,
        flightRecorder: runtime.flightRecorder || {
            format: "stream-shell-flight-recorder",
            version: 1,
            maxEvents: 200,
            count: 0,
            updatedAt: null,
            events: []
        },
        settings: {
            loaded: settingsLoaded === true,
            keys: Object.keys(SETTINGS_DEFAULTS).length,
            modifiedFromDefaults: modifiedKeys.length,
            modifiedKeys,
            values: full
                ? Object.fromEntries(
                    Object.keys(SETTINGS_DEFAULTS).map(key => [key, settingValue(key)])
                )
                : null
        }
    };
}

function diagnosticsTimelineDetail(detail) {
    if (!detail || typeof detail !== "object") return "";
    const entries = Object.entries(detail)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .slice(0, 6);
    if (!entries.length) return "";

    return entries
        .map(([key, value]) => {
            const rendered = typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
            return `${key}=${rendered}`;
        })
        .join(" · ")
        .slice(0, 260);
}

function diagnosticsTimelineCard(flightRecorder) {
    const events = Array.isArray(flightRecorder?.events)
        ? flightRecorder.events
        : [];
    const visibleEvents = events.slice(-60).reverse();
    const rows = visibleEvents.length
        ? visibleEvents.map(event => {
            const timestamp = Number(event?.at);
            const time = Number.isFinite(timestamp)
                ? new Date(timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    fractionalSecondDigits: 3
                })
                : "—";
            const provider = event?.provider
                ? (PROVIDER_NAMES[event.provider] || event.provider)
                : "Shell";
            const detail = diagnosticsTimelineDetail(event?.detail);
            const level = ["info", "warn", "error"].includes(event?.level)
                ? event.level
                : "info";

            return `
                <div class="settings-diagnostics-event ${level}">
                    <time>${escapeSettingsHtml(time)}</time>
                    <span class="settings-diagnostics-event-provider">${escapeSettingsHtml(provider)}</span>
                    <div class="settings-diagnostics-event-copy">
                        <strong>${escapeSettingsHtml(`${event?.category || "runtime"} · ${event?.action || "event"}`)}</strong>
                        ${detail ? `<span>${escapeSettingsHtml(detail)}</span>` : ""}
                    </div>
                </div>
            `;
        }).join("")
        : `
            <div class="settings-diagnostics-event-empty">
                No flight-recorder events yet. Provider and shell transitions will appear here as they happen.
            </div>
        `;

    const total = Number(flightRecorder?.count) || events.length;
    const maxEvents = Number(flightRecorder?.maxEvents) || 200;
    const shown = Math.min(visibleEvents.length, 60);

    return `
        <section class="settings-diagnostics-card settings-diagnostics-card-wide settings-diagnostics-timeline-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Event timeline</h3>
                <p>Session flight recorder · ${escapeSettingsHtml(`${total}/${maxEvents} events`)}${total > shown ? ` · showing latest ${shown}` : ""}. Full buffer is included in JSON export.</p>
            </div>
            <div class="settings-diagnostics-timeline">${rows}</div>
        </section>
    `;
}


function diagnosticsSafeModeCard(provider, page) {
    if (!provider) {
        return diagnosticsCard(
            "Provider safe mode",
            diagnosticsRow("Safe mode", "No active provider", "neutral")
        );
    }

    const key = providerSafeModeSettingKey(provider);
    const storedEnabled = settingValue(key) === true;
    const runtimeState = page?.api?.safeMode || null;
    const runtimeEnabled = runtimeState?.initialized === true
        ? runtimeState.enabled === true
        : null;
    const runtimeMatches = runtimeEnabled === null || runtimeEnabled === storedEnabled;
    const label = PROVIDER_NAMES[provider] || provider;

    return `
        <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-safe-mode-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Provider safe mode</h3>
                <p>Isolate ${escapeSettingsHtml(label)} by suppressing Stream Shell's provider DOM/UI features without disabling Provider API, Continue/Resume, Now Playing or Diagnostics.</p>
            </div>
            <div class="settings-diagnostics-rows">
                ${diagnosticsRow("Stored state", storedEnabled ? "Enabled" : "Disabled", storedEnabled ? "neutral" : "good")}
                ${diagnosticsRow(
                    "Runtime state",
                    runtimeEnabled === null ? "Not live-probed · see stored state" : (runtimeEnabled ? "Enabled · UI/DOM suppressed" : "Disabled · normal features active"),
                    runtimeEnabled === null ? "neutral" : (runtimeMatches ? "good" : "bad")
                )}
            </div>
            <div class="settings-diagnostics-repair-list">
                <div class="settings-diagnostics-repair-row ${storedEnabled ? "recommended" : ""}">
                    <div class="settings-diagnostics-repair-copy">
                        <strong>${storedEnabled ? "Leave isolation" : "Enter isolation"}</strong>
                        <span>${storedEnabled
                            ? "Restore the provider-specific features using their existing saved settings."
                            : "Disable invasive provider-specific presentation and automation until Safe Mode is turned off."}</span>
                    </div>
                    <button
                        type="button"
                        class="settings-diagnostics-repair-button"
                        data-diagnostics-safe-mode="${storedEnabled ? "false" : "true"}"
                        data-diagnostics-provider="${escapeSettingsHtml(provider)}"
                    >${storedEnabled ? "Disable" : "Enable"}</button>
                </div>
            </div>
        </section>
    `;
}

async function runSettingsDiagnosticsSafeMode(provider, enabled, button = null) {
    if (!provider || !PROVIDERS.has(provider)) return;

    if (button) button.disabled = true;
    const next = enabled === true;
    setDiagnosticsStatus(`${next ? "Enabling" : "Disabling"} ${PROVIDER_NAMES[provider] || provider} Safe Mode…`);

    try {
        const key = providerSafeModeSettingKey(provider);
        settingsValues[key] = next;
        await chrome.storage.local.set({ [key]: next });
        await new Promise(resolve => setTimeout(resolve, 180));
        setDiagnosticsStatus(next ? "Safe Mode enabled" : "Safe Mode disabled");
        await refreshSettingsDiagnostics();
    } catch {
        setDiagnosticsStatus("Safe Mode update failed");
        if (button) button.disabled = false;
    }
}

const DIAGNOSTICS_REPAIR_META = {
    "restore-managed-marker": {
        label: "Restore managed marker",
        description: "Restore Stream Shell's provider scope marker without reloading the page."
    },
    "clear-pending-resume": {
        label: "Clear pending resume",
        description: "Cancel and remove the current provider resume request."
    },
    "resync-adapter": {
        label: "Resync adapter",
        description: "Rebuild the Provider API adapter instance and re-run its contract check."
    },
    "resync-content-state": {
        label: "Resync content state",
        description: "Reapply current Stream Shell markers, playback utilities and provider feature state."
    },
    "reinitialize-runtime": {
        label: "Reinitialize provider runtime",
        description: "Reload provider settings from storage, rebuild the adapter and resync runtime state."
    },
    "netflix-bridge-probe": {
        label: "Repair Netflix bridge",
        description: "Probe the MAIN-world player bridge and reinject it only if the probe fails."
    },
    "reload-provider": {
        label: "Reload provider",
        description: "Last escalation step. Reload only this provider tab, not the whole shell.",
        danger: true
    }
};

function diagnosticsRepairCard(provider, page) {
    if (!provider) {
        return diagnosticsCard(
            "Targeted repair",
            diagnosticsRow("Repair state", "No active provider", "neutral")
        );
    }

    if (!page?.ok && page?.cached !== true) {
        const meta = DIAGNOSTICS_REPAIR_META["reload-provider"];
        return `
            <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-targeted-repair-card">
                <div class="settings-diagnostics-card-heading">
                    <h3>Targeted repair</h3>
                    <p>Content diagnostics are unavailable, so in-page repair cannot currently run.</p>
                </div>
                <div class="settings-diagnostics-repair-list">
                    ${diagnosticsRepairAction(
                        provider,
                        "reload-provider",
                        meta,
                        "Provider window is alive but its content runtime cannot answer diagnostics.",
                        true
                    )}
                </div>
            </section>
        `;
    }

    const repair = page.api?.repair || {};
    const recommendations = Array.isArray(repair.recommendations)
        ? repair.recommendations
        : [];
    const recommendedByAction = new Map(
        recommendations.map(item => [item.action, item])
    );
    const available = Array.isArray(repair.availableActions)
        ? repair.availableActions
        : [];

    const actions = [];
    const addAction = action => {
        if (!DIAGNOSTICS_REPAIR_META[action] || actions.includes(action)) return;
        actions.push(action);
    };

    for (const recommendation of recommendations) addAction(recommendation.action);
    for (const action of available) addAction(action);
    addAction("resync-content-state");
    addAction("reinitialize-runtime");
    addAction("reload-provider");

    const lastResult = repair.lastResult || null;
    const lastResultText = lastResult?.at
        ? `${lastResult.ok ? "Succeeded" : "Failed"} · ${new Date(lastResult.at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
        })}`
        : null;

    const rows = actions.map(action => {
        const meta = DIAGNOSTICS_REPAIR_META[action];
        const recommendation = recommendedByAction.get(action);
        return diagnosticsRepairAction(
            provider,
            action,
            meta,
            recommendation?.reason || meta.description,
            Boolean(recommendation)
        );
    }).join("");

    return `
        <section class="settings-diagnostics-card settings-diagnostics-repair-card settings-diagnostics-action-card settings-diagnostics-targeted-repair-card">
            <div class="settings-diagnostics-card-heading">
                <h3>Targeted repair</h3>
                <p>${repair.healthy !== false
                    ? "No targeted repair is currently recommended. Manual low-risk repair actions remain available below."
                    : `${recommendations.length} repair action${recommendations.length === 1 ? " is" : "s are"} recommended from the current snapshot.`}</p>
            </div>
            ${lastResultText ? `
                <div class="settings-diagnostics-repair-last ${lastResult.ok ? "good" : "bad"}">
                    Last repair: ${escapeSettingsHtml(lastResultText)} · ${escapeSettingsHtml(DIAGNOSTICS_REPAIR_META[lastResult.action]?.label || lastResult.action)}
                </div>
            ` : ""}
            <div class="settings-diagnostics-repair-list">${rows}</div>
        </section>
    `;
}

function diagnosticsRepairAction(provider, action, meta, reason, recommended) {
    const danger = meta?.danger === true;
    return `
        <div class="settings-diagnostics-repair-row ${recommended ? "recommended" : ""} ${danger ? "danger" : ""}">
            <div class="settings-diagnostics-repair-copy">
                <strong>
                    ${escapeSettingsHtml(meta?.label || action)}
                    ${recommended ? '<span class="settings-diagnostics-repair-badge">Recommended</span>' : ""}
                    ${danger ? '<span class="settings-diagnostics-repair-badge last-resort">Last resort</span>' : ""}
                </strong>
                <span>${escapeSettingsHtml(reason || meta?.description || "")}</span>
            </div>
            <button
                type="button"
                class="settings-diagnostics-repair-button"
                data-diagnostics-repair="${escapeSettingsHtml(action)}"
                data-diagnostics-provider="${escapeSettingsHtml(provider)}"
            >Run</button>
        </div>
    `;
}

async function runSettingsDiagnosticsRepair(provider, action, button = null) {
    if (!provider || !action) return;

    if (button) button.disabled = true;
    setDiagnosticsStatus(`Repairing ${PROVIDER_NAMES[provider] || provider}…`);

    try {
        const result = await chrome.runtime.sendMessage({
            type: "dashboard-diagnostics-repair",
            provider,
            action
        });

        if (result?.ok === true) {
            setDiagnosticsStatus(
                action === "reload-provider"
                    ? "Provider reload requested"
                    : "Repair completed"
            );
            await new Promise(resolve => setTimeout(
                resolve,
                action === "reload-provider" ? 900 : 160
            ));
            await refreshSettingsDiagnostics();
            return;
        }

        setDiagnosticsStatus(result?.error || result?.detail?.reason || "Repair failed");
        await refreshSettingsDiagnostics();
    } catch {
        setDiagnosticsStatus("Repair failed");
        if (button) button.disabled = false;
    }
}

function renderSettingsDiagnostics(snapshot) {
    if (!settingsDiagnosticsContent) return;

    if (!snapshot) {
        settingsDiagnosticsContent.innerHTML = `
            <div class="settings-diagnostics-loading">
                <span class="settings-diagnostics-spinner" aria-hidden="true"></span>
                <strong>Collecting diagnostics…</strong>
            </div>
        `;
        return;
    }

    const shell = snapshot.shell || {};
    const native = snapshot.native || {};
    const audio = snapshot.audio || {};
    const playback = snapshot.playback || {};
    const sleep = snapshot.sleepTimer || {};
    const selfTest = snapshot.selfTest || {};
    const settings = snapshot.settings || {};
    const environment = snapshot.environment || {};
    const manifest = snapshot.manifest || {};
    const displayProfile = snapshot.displayProfile || {};
    const displayTarget = displayProfile.targetDisplay || {};
    const providerStates = shell.providerWindows || {};
    const flightRecorder = snapshot.flightRecorder || {};

    const displayModeLabel = displayProfile.mode
        ? `${String(displayProfile.mode).toUpperCase()} · ${displayProfile.override === "auto" ? "Auto" : `forced ${displayProfile.override}`}`
        : "Unknown";
    const displayTargetLabel = displayTarget.referenceTarget || (
        displayTarget.bounds?.width && displayTarget.bounds?.height
            ? `${displayTarget.bounds.width}×${displayTarget.bounds.height} logical`
            : "Unavailable"
    );
    const appliedLayoutLabel = displayProfile.mode === "compact"
        ? (displayProfile.compactHostReady === true
            ? "Compact · single-surface Shell Home"
            : "Compact staging · fitted dual-pane · host pending")
        : displayProfile.mode === "wide"
            ? "Wide · target-display dual-pane"
            : (displayProfile.appliedLayout || "Legacy wide");

    const runtimeRows =
        diagnosticsRow("Extension", `v${snapshot.extensionVersion}`, "good") +
        diagnosticsRow("Display profile", displayModeLabel, displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Target display", displayTargetLabel, displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Applied layout", appliedLayoutLabel, displayProfile.mode === "compact" && displayProfile.compactHostReady !== true ? "neutral" : "good") +
        diagnosticsRow("Settings provider", snapshot.settingsUi?.provider === "general" ? "General" : (PROVIDER_NAMES[snapshot.settingsUi?.provider] || snapshot.settingsUi?.provider), "neutral") +
        diagnosticsRow("Settings section", settingsSectionLabel(snapshot.settingsUi?.provider, snapshot.settingsUi?.section), "neutral") +
        diagnosticsRow("Left pane", shell.leftMode === "dashboard" ? "Dashboard" : (PROVIDER_NAMES[shell.leftMode] || shell.leftMode), "neutral") +
        diagnosticsRow("Right pane", shell.rightMode === "discord" ? "Discord" : "Dashboard", "neutral");

    const windowRows =
        diagnosticsRow("Managed windows", shell.managedWindowsRegistered ?? "Not sampled", "neutral") +
        diagnosticsRow("Opera windows (total)", shell.browserWindowsTotal ?? "Deep only", "neutral") +
        diagnosticsRow("Provider registrations", `${shell.providerWindowsKnown ?? 0} known`, "good") +
        diagnosticsRow("Provider live probes", shell.providerWindowsAlive === null ? "Deep only" : `${shell.providerWindowsAlive} alive`, "neutral") +
        diagnosticsRow("Landing", shell.landingWindowRegistered ? "Registered · cached" : (shell.landingWindowAlive ? "Alive" : "Not registered"), shell.landingWindowRegistered || shell.landingWindowAlive ? "good" : "neutral") +
        diagnosticsRow("Dashboard", shell.dashboardWindowRegistered ? "Registered · cached" : (shell.dashboardWindowAlive ? "Alive" : "Not registered"), shell.dashboardWindowRegistered || shell.dashboardWindowAlive ? "good" : "neutral");

    const twitchWorkspace = shell.twitchWorkspaceV2 || {};
    const twitchRows = (twitchWorkspace.windows || []).map(slot => {
        const m = slot.twitchRuntime?.automation;
        const claim = slot.nativeClaim;
        const drift = Number.isFinite(m?.heartbeatMaxDriftMs) ? `${Math.round(m.heartbeatMaxDriftMs)}ms peak` : "not live-probed";
        const identity = Number.isInteger(slot.id) ? `window ${slot.id}` : "no window";
        const claimLabel = claim?.phase === 'confirmed' ? 'native claimed' :
            claim?.phase === 'pending' ? 'native pending' : claim ? `native ${claim.phase}` : 'claim not observed';
        const value = `${slot.kind || 'empty'} · ${identity} · ${claimLabel} · ${drift}`;
        return diagnosticsRow(`Twitch ${String(slot.slot || "?").toUpperCase()}`, value,
            claim?.phase === 'confirmed' ? 'good' : 'neutral');
    }).join("") || diagnosticsRow("Twitch Workspace", "Not running", "neutral");
    const nativeClusterRow = diagnosticsRow("Native Twitch cluster",
        Number.isInteger(twitchWorkspace.nativeClusterMembers) ?
            `${twitchWorkspace.nativeClusterMembers} HWNDs · helper cache` : 'Not reported',
        Number.isInteger(twitchWorkspace.nativeClusterMembers) ? 'good' : 'neutral');

    const providerRows = Object.entries(PROVIDER_NAMES).map(([provider, label]) => {
        const state = providerStates[provider] || {};
        const page = state.page || {};
        const cachedEntry = selfTest?.providers?.[provider] || null;
        const cachedReport = cachedEntry?.report || null;
        if (!state.known) return diagnosticsRow(label, "Not opened", "neutral");
        if (state.alive === false) return diagnosticsRow(label, "Window missing · last check", "bad");
        if (page.ok) return diagnosticsRow(label, "Live content OK", "good");
        if (cachedReport) return diagnosticsRow(label,
            `Window ${state.windowId ?? '?'} · API ${cachedReport.ok === false ? 'attention' : 'passed'} (cached)`,
            cachedReport.ok === false ? 'bad' : 'good');
        return diagnosticsRow(label, `Window ${state.windowId ?? '?'} registered · not live-probed`, "neutral");
    }).join("");

    const selfTestChecks = Object.values(selfTest.checks || {});
    const selfTestProviders = Object.values(selfTest.providers || {});
    const selfTestOpenProviders = selfTestProviders.filter(entry => entry?.windowKnown === true && entry?.windowAlive === true);
    const selfTestReported = selfTestOpenProviders.filter(entry => entry?.state === "reported").length;
    const selfTestFailed = selfTestOpenProviders.filter(entry => entry?.state === "failed").length;
    const selfTestRows =
        diagnosticsRow("Launch self-test", selfTest.startedAt ? (selfTest.ok ? "Passed" : "Attention") : "Not run", selfTest.startedAt ? diagnosticsStatusClass(selfTest.ok) : "neutral") +
        diagnosticsRow("Provider API", selfTest.providerApiVersion ? `Contract v${selfTest.providerApiVersion}` : "—", selfTest.providerApiVersion ? "good" : "neutral") +
        diagnosticsRow("Core checks", selfTestChecks.length ? `${selfTestChecks.filter(check => check?.ok !== false).length}/${selfTestChecks.length} passed` : "—", selfTestChecks.some(check => check?.ok === false) ? "bad" : (selfTestChecks.length ? "good" : "neutral")) +
        diagnosticsRow("Provider reports", selfTestOpenProviders.length ? `${selfTestReported}/${selfTestOpenProviders.length} open reported${selfTestFailed ? ` · ${selfTestFailed} failed` : ""}` : "No provider open", selfTestFailed ? "bad" : (selfTestOpenProviders.length && selfTestReported === selfTestOpenProviders.length ? "good" : "neutral")) +
        diagnosticsRow("Last check", selfTest.updatedAt ? new Date(selfTest.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—", "neutral");

    const activeProviderName = shell.activeProvider || null;
    const activeProviderPage = activeProviderName
        ? (providerStates[activeProviderName]?.page || (providerStates[activeProviderName]?.cached ? { cached: true } : null))
        : null;
    let activeRows = "";
    let resumeRows = "";
    let featureRows = "";

    if (activeProviderPage?.ok) {
        const video = activeProviderPage.video || {};
        const resourceGovernor = activeProviderPage.api?.resourceGovernor || {};
        const resourceModeLabels = {
            "foreground-playing": "Foreground · playing",
            "foreground-paused": "Foreground · paused",
            "idle-visible": "Visible · outside player",
            "background-playing": "Background · playing",
            "sleeping": "Sleeping / heavily throttled"
        };
        const resourceModeLabel = resourceModeLabels[resourceGovernor.mode] ||
            resourceGovernor.mode ||
            "Unknown";
        const governedWorkloads = Array.isArray(resourceGovernor.workloads)
            ? resourceGovernor.workloads
            : [];
        activeRows =
            diagnosticsRow("Provider", PROVIDER_NAMES[activeProviderName] || activeProviderName, "good") +
            diagnosticsRow("Document", `${activeProviderPage.readyState || "?"} · ${activeProviderPage.visibility || "?"}`, "neutral") +
            diagnosticsRow("Managed marker", activeProviderPage.managed ? "Present" : "Missing", diagnosticsStatusClass(activeProviderPage.managed)) +
            diagnosticsRow(
                "Safe mode",
                activeProviderPage.api?.safeMode?.enabled ? "Enabled · provider UI/DOM suppressed" : "Disabled",
                activeProviderPage.api?.safeMode?.enabled ? "neutral" : "good"
            ) +
            diagnosticsRow(
                "Resource governor",
                resourceModeLabel,
                resourceGovernor.mode === "foreground-playing" ? "good" : "neutral"
            ) +
            diagnosticsRow(
                "Governor signals",
                `${resourceGovernor.visible ? "visible" : "hidden"} · ${resourceGovernor.shellActive ? "active" : "inactive"} · ${resourceGovernor.minimized ? "minimized" : "restored"} · ${resourceGovernor.watchContext ? "watch" : "browse"} · DOM ${resourceGovernor.domObserversAllowed ? "live" : "parked"}`,
                "neutral"
            ) +
            diagnosticsRow(
                "Governed loops",
                governedWorkloads.length
                    ? `${governedWorkloads.length} · ${governedWorkloads.map(workload => `${workload.name} ${workload.delayMs ?? "?"}ms`).join(" · ")}`
                    : "No adaptive loop registered",
                governedWorkloads.length ? "good" : "neutral"
            ) +
            diagnosticsRow("Media elements", `${activeProviderPage.counts?.video || 0} video · ${activeProviderPage.counts?.iframe || 0} iframe · ${activeProviderPage.counts?.canvas || 0} canvas`, "neutral") +
            diagnosticsRow("Video ready state", video.readyState ?? "—", video.readyState >= 2 ? "good" : "neutral") +
            diagnosticsRow("Playback rate", Number.isFinite(video.playbackRate) ? `${video.playbackRate.toFixed(2)}x` : "—", "neutral") +
            diagnosticsRow("Resolution", video.width && video.height ? `${video.width}×${video.height}` : "—", "neutral") +
            diagnosticsRow("Provider API", activeProviderPage.api?.adapterLoaded ? `v${activeProviderPage.api?.version || "?"} · ${activeProviderPage.api?.adapterKind || "generic"}` : "Adapter missing", activeProviderPage.api?.adapterLoaded ? "good" : "bad") +
            diagnosticsRow("Adapter self-test", activeProviderPage.api?.selfTest?.ok ? "Passed" : "Attention", activeProviderPage.api?.selfTest?.ok ? "good" : "bad");

        resumeRows =
            diagnosticsRow("Provider", PROVIDER_NAMES[activeProviderName] || activeProviderName, "neutral") +
            diagnosticsRow("Resume strategy", activeProviderPage.api?.resume?.strategy || "pending-seek", "neutral") +
            diagnosticsRow(
                "Stale-link resolver",
                activeProviderPage.api?.capabilities?.common?.linkResolver?.available
                    ? (activeProviderPage.api.capabilities.common.linkResolver.detail || "Ready")
                    : "Unavailable",
                activeProviderPage.api?.capabilities?.common?.linkResolver?.available ? "good" : "neutral"
            ) +
            diagnosticsRow(
                "Pending resume",
                activeProviderPage.api?.resume?.pending
                    ? `${formatPlaybackTime(activeProviderPage.api.resume.targetTime)} · ${activeProviderPage.api.resume.identityMatches === false ? "identity mismatch" : "waiting/applying"}`
                    : "None",
                activeProviderPage.api?.resume?.identityMatches === false ? "bad" : (activeProviderPage.api?.resume?.pending ? "neutral" : "good")
            );

        const extensionCapabilities = activeProviderPage.api?.capabilities?.extensions || {};
        for (const [name, capability] of Object.entries(extensionCapabilities)) {
            const label = name.replace(/([A-Z])/g, " $1").replace(/^./, value => value.toUpperCase());
            const value = capability?.supported !== true
                ? "Unsupported"
                : capability?.available === true
                    ? (capability.state || "Available")
                    : (capability.state || "Waiting");
            featureRows += diagnosticsRow(label, value, capability?.available === true ? "good" : "neutral");
        }

        if (activeProviderName === "netflix") {
            const netflixState = activeProviderPage.api?.extensionState || {};
            const metadata = netflixState.metadata || {};
            const wallpaper = netflixState.wallpaper || {};
            const continueWatching = netflixState.continueWatching || {};
            const skipRecap = netflixState.skipRecap || {};
            const skipIntro = netflixState.skipIntro || {};
            const nextEpisode = netflixState.nextEpisode || {};
            const automationLabel = state => state.enabled
                ? (state.buttonPresent ? "Enabled · control present" : "Enabled · armed")
                : "Disabled";

            featureRows +=
                diagnosticsRow("Netflix metadata", metadata.titleAvailable ? `Ready · ${metadata.source || "DOM"}` : "Waiting for player title", metadata.titleAvailable ? "good" : "neutral") +
                diagnosticsRow("Wallpaper runtime", wallpaper.state || "—", wallpaper.marker ? "good" : "neutral") +
                diagnosticsRow("Continue prompt", automationLabel(continueWatching), continueWatching.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Skip recap", automationLabel(skipRecap), skipRecap.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Skip intro", automationLabel(skipIntro), skipIntro.buttonPresent ? "good" : "neutral") +
                diagnosticsRow("Next episode", automationLabel(nextEpisode), nextEpisode.buttonPresent ? "good" : "neutral");
        }

        if (activeProviderName === "youtube") {
            const youtubeState = activeProviderPage.api?.extensionState || {};
            const cleanup = youtubeState.cleanup || {};
            const quality = youtubeState.quality || {};
            const uploadDate = youtubeState.uploadDate || {};
            const autoLike = youtubeState.autoLike || {};
            const loop = youtubeState.loop || {};

            featureRows +=
                diagnosticsRow("RYD tooltip", youtubeState.ryd?.tooltipPresent ? "Present" : "Missing", youtubeState.ryd?.tooltipPresent ? "good" : "neutral") +
                diagnosticsRow("Windowed runtime", youtubeState.windowedPlayer?.active ? "Active" : "Off", youtubeState.windowedPlayer?.active ? "good" : "neutral") +
                diagnosticsRow("Theme runtime", youtubeState.theme?.enabled ? (youtubeState.theme?.marker ? "Enabled · marker OK" : "Enabled · marker missing") : "Disabled", youtubeState.theme?.enabled && !youtubeState.theme?.marker ? "bad" : "neutral") +
                diagnosticsRow("Preferred quality", quality.enabled ? `${quality.preferred || "?"} · ${quality.playerPresent ? "player ready" : "player absent"}` : "Disabled", quality.playerPresent ? "good" : "neutral") +
                diagnosticsRow("Upload date", uploadDate.enabled ? `${uploadDate.format || "friendly"} · ${uploadDate.present ? "present" : "waiting"}` : "Disabled", uploadDate.present ? "good" : "neutral") +
                diagnosticsRow("Auto-like", autoLike.enabled ? `${autoLike.trigger || "percent"} · armed` : "Disabled", autoLike.enabled ? "good" : "neutral") +
                diagnosticsRow("Keep playing", youtubeState.keepPlaying?.enabled ? "Armed" : "Disabled", youtubeState.keepPlaying?.enabled ? "good" : "neutral") +
                diagnosticsRow("Loop", loop.overrideEnabled ? "Stream Shell override" : "YouTube native", "neutral") +
                diagnosticsRow("Cleanup", Number.isFinite(cleanup.enabledCount) ? `${cleanup.enabledCount}/${cleanup.configuredCount || 0} rules active` : "—", "neutral");
        }

        if (!featureRows) {
            featureRows = diagnosticsRow("Provider features", "No extension state reported", "neutral");
        }
    } else {
        const cachedReport = selfTest?.providers?.[activeProviderName]?.report || null;
        const providerWindowId = providerStates[activeProviderName]?.windowId;
        if (activeProviderName && cachedReport) {
            activeRows =
                diagnosticsRow("Provider", PROVIDER_NAMES[activeProviderName] || activeProviderName, 'good') +
                diagnosticsRow("Window", Number.isInteger(providerWindowId) ? `Registered · ${providerWindowId}` : 'Not registered', 'neutral') +
                diagnosticsRow("Provider API", `v${cachedReport.apiVersion || '?'} · cached self-test`, cachedReport.ok !== false ? 'good' : 'bad') +
                diagnosticsRow("Managed marker", cachedReport.managed ? 'Confirmed at last test' : 'Absent at last test', cachedReport.managed ? 'good' : 'bad') +
                diagnosticsRow("Watch context", cachedReport.watchContext ? 'Active at last test' : 'Inactive at last test', 'neutral') +
                diagnosticsRow("Video", cachedReport.videoPresent ? 'Present at last test' : 'No video at last test', 'neutral') +
                diagnosticsRow("Last API check", cachedReport.checkedAt ? new Date(cachedReport.checkedAt).toLocaleTimeString() : 'Not recorded', 'neutral') +
                diagnosticsRow("Live DOM probe", 'Deep export only', 'neutral');
            const resumeCapability = cachedReport.capabilities?.['common.resume'];
            const resolverCapability = cachedReport.capabilities?.['common.linkResolver'];
            resumeRows = diagnosticsRow('Resume support', resumeCapability?.available ? (resumeCapability.detail || 'Available · cached') : 'Not reported', resumeCapability?.available ? 'good' : 'neutral') +
                diagnosticsRow('Stale-link resolver', resolverCapability?.available ? (resolverCapability.detail || 'Ready · cached') : 'Not reported', resolverCapability?.available ? 'good' : 'neutral') +
                diagnosticsRow('Live pending seek', 'Deep export only', 'neutral');
            const capabilities = Object.entries(cachedReport.capabilities || {}).filter(([key]) => key.startsWith('extensions.'));
            featureRows = capabilities.map(([key, cap]) => diagnosticsRow(
                key.slice('extensions.'.length).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
                `${cap?.state || (cap?.available ? 'Available' : 'Waiting')} · cached`,
                cap?.available ? 'good' : 'neutral'
            )).join('') || diagnosticsRow('Features', 'Not reported in last self-test', 'neutral');
        } else if (activeProviderName) {
            activeRows = diagnosticsRow('Provider', PROVIDER_NAMES[activeProviderName] || activeProviderName, 'good') +
                diagnosticsRow('Window', Number.isInteger(providerWindowId) ? `Registered · ${providerWindowId}` : 'Not registered', 'neutral') +
                diagnosticsRow('Provider API', 'Waiting for cached self-test', 'neutral');
            resumeRows = diagnosticsRow('Resume', 'Not yet reported', 'neutral');
            featureRows = diagnosticsRow('Features', 'Not yet reported', 'neutral');
        } else {
            activeRows = diagnosticsRow('Provider', 'No active provider', 'neutral');
            resumeRows = diagnosticsRow('Resume', 'No active provider', 'neutral');
            featureRows = diagnosticsRow('Features', 'No active provider', 'neutral');
        }
    }

    const mediaRows =
        diagnosticsRow("Now Playing provider", playback.provider ? (PROVIDER_NAMES[playback.provider] || playback.provider) : "None", playback.provider ? "good" : "neutral") +
        diagnosticsRow("Playback state", playback.state || "Idle", playback.state ? "good" : "neutral") +
        diagnosticsRow("Progress", Number.isFinite(playback.progressPercent) ? `${playback.progressPercent.toFixed(1)}%` : "—", "neutral") +
        diagnosticsRow(playback.provider === "youtube" ? "RYD ratio" : "TMDB rating", playback.hasRating ? "Available" : "Not available", playback.hasRating ? "good" : "neutral");

    const audioRows =
        diagnosticsRow("Audio capture", audio.active ? "Active" : "Idle / not sampled", audio.active ? "good" : "neutral") +
        diagnosticsRow("Offscreen audio", audio.offscreenDocumentAlive === null ? 'Not polled (Deep only)' : (audio.offscreenDocumentAlive ? "Alive" : "Not present"), audio.offscreenDocumentAlive === true ? 'good' : 'neutral') +
        diagnosticsRow("Capture provider", audio.provider ? (PROVIDER_NAMES[audio.provider] || audio.provider) : "—", "neutral") +
        diagnosticsRow("Processing", audio.active ? `${audio.profile || "normal"} · ${audio.percent || 100}%` : "—", "neutral");

    const targetBounds = displayTarget.bounds;
    const targetWorkArea = displayTarget.workArea;
    const plannedLayout = displayProfile.plannedLayout || {};
    const appliedGeometry = displayProfile.appliedGeometry || {};
    const plannedLayoutText = displayProfile.mode === "wide" && plannedLayout.left && plannedLayout.right
        ? `${plannedLayout.left.width}×${plannedLayout.left.height} + ${plannedLayout.right.width}×${plannedLayout.right.height}`
        : plannedLayout.full
            ? `${plannedLayout.full.width}×${plannedLayout.full.height} single surface`
            : "Unavailable";
    const appliedGeometryText = appliedGeometry.left && appliedGeometry.right
        ? `L ${appliedGeometry.left.left},${appliedGeometry.left.top} ${appliedGeometry.left.width}×${appliedGeometry.left.height} · R ${appliedGeometry.right.left},${appliedGeometry.right.top} ${appliedGeometry.right.width}×${appliedGeometry.right.height}`
        : "Unavailable";
    const environmentRows =
        diagnosticsRow("Platform", environment.platform || "Unknown", "neutral") +
        diagnosticsRow("Language", environment.language || "Unknown", "neutral") +
        diagnosticsRow("Viewport", environment.viewport ? `${environment.viewport.width}×${environment.viewport.height} @ ${environment.viewport.devicePixelRatio || 1}x` : "Unknown", "neutral") +
        diagnosticsRow("Screen", environment.screen?.width ? `${environment.screen.width}×${environment.screen.height}` : "Unknown", "neutral") +
        diagnosticsRow("Display API", displayProfile.apiAvailable ? "Available" : "Unavailable · legacy fallback", displayProfile.apiAvailable ? "good" : "neutral") +
        diagnosticsRow("Connected displays", displayProfile.displayCount ?? 0, "neutral") +
        diagnosticsRow("Profile reason", displayProfile.reason || "Unknown", "neutral") +
        diagnosticsRow("Target class", displayTarget.targetClass || "Unknown", displayProfile.supportedTarget ? "good" : "neutral") +
        diagnosticsRow("Target bounds", targetBounds ? `${targetBounds.left},${targetBounds.top} · ${targetBounds.width}×${targetBounds.height}` : "Unavailable", "neutral") +
        diagnosticsRow("Target work area", targetWorkArea ? `${targetWorkArea.left},${targetWorkArea.top} · ${targetWorkArea.width}×${targetWorkArea.height}` : "Unavailable", "neutral") +
        diagnosticsRow("Display zoom", displayTarget.displayZoomFactor ? `${displayTarget.displayZoomFactor}x` : "—", "neutral") +
        diagnosticsRow("Display DPI", displayTarget.dpiX && displayTarget.dpiY ? `${displayTarget.dpiX}×${displayTarget.dpiY}` : "—", "neutral") +
        diagnosticsRow("Applied geometry", appliedGeometryText, "neutral") +
        diagnosticsRow("Planned layout", plannedLayoutText, "neutral");

    const helperRows =
        diagnosticsRow("Titlebar helper", native.titlebarConnected ? "Connected" : "Unavailable", diagnosticsStatusClass(native.titlebarConnected)) +
        diagnosticsRow("Titlebar mode", native.titlebarVisibilityMode || "Unknown", "neutral") +
        diagnosticsRow("Settings state", native.titlebarSettingsOpen ? "Open" : "Closed", "neutral") +
        diagnosticsRow("Volume state", native.titlebarVolumeActive ? "Active" : "Idle", "neutral") +
        diagnosticsRow('Native protocol', native.titlebarProtocolReady ? `v${native.titlebarProtocolVersion || '?'} ready` : 'Not confirmed', native.titlebarProtocolReady ? 'good' : 'neutral') +
        diagnosticsRow('Titlebar sync', native.titlebarProviderSync?.phase || 'Not reported', native.titlebarProviderSync?.acknowledgedGeneration >= native.titlebarProviderSync?.generation ? 'good' : 'neutral') +
        diagnosticsRow("Discord helper", native.discordHelperConnected === null ? "Not polled (Deep only)" : (native.discordHelperConnected ? "Connected" : "Unavailable"), native.discordHelperConnected === true ? "good" : "neutral") +
        diagnosticsRow("Discord process", native.discordRunning === null ? "Not polled (Deep only)" : native.discordRunning ? (native.discordVisible ? "Running · visible" : "Running · parked") : "Not running", native.discordRunning ? "good" : "neutral");

    const settingsRows =
        diagnosticsRow("Settings loaded", settings.loaded ? "Yes" : "No", diagnosticsStatusClass(settings.loaded)) +
        diagnosticsRow("Settings keys", settings.keys ?? 0, "neutral") +
        diagnosticsRow("Changed from defaults", settings.modifiedFromDefaults ?? 0, "neutral") +
        diagnosticsRow("Sleep timer", sleep.active ? `${PROVIDER_NAMES[sleep.provider] || sleep.provider} · ${sleep.mode}` : "Off", sleep.active ? "good" : "neutral");

    const manifestRows =
        diagnosticsRow("Manifest", manifest.manifestVersion ? `MV${manifest.manifestVersion}` : "Unknown", manifest.manifestVersion ? "good" : "neutral") +
        diagnosticsRow("Permissions", Array.isArray(manifest.permissions) ? manifest.permissions.length : 0, "neutral") +
        diagnosticsRow("Host permissions", Array.isArray(manifest.hostPermissions) ? manifest.hostPermissions.length : 0, "neutral");

    const generatedAt = snapshot.generatedAt
        ? new Date(snapshot.generatedAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";
    const rawRows =
        diagnosticsRow("Format", snapshot.format || "stream-shell-diagnostics", "neutral") +
        diagnosticsRow("Schema", `v${snapshot.version || "?"}`, "neutral") +
        diagnosticsRow("Snapshot mode", snapshot.mode === "full" ? "Deep · live probes" : "Panel · cached health", "neutral") +
        diagnosticsRow("Generated", generatedAt, "neutral") +
        diagnosticsRow("Flight events", `${Number(flightRecorder.count) || 0}/${Number(flightRecorder.maxEvents) || 200}`, "neutral") +
        diagnosticsRow("Export", "Runtime (fast) / Deep (optional)", "good");

    settingsDiagnosticsContent.innerHTML =
        diagnosticsSection(
            "01",
            "Overview",
            "Cached runtime health and native claims: no expensive browser-wide probes when opening this panel.",
            diagnosticsCard("Runtime", runtimeRows) +
            diagnosticsCard("Windows", windowRows) +
            diagnosticsCard("Twitch A–D runtime", twitchRows + nativeClusterRow, "Native claims are real cached acknowledgements. Renderer heartbeat and join metrics require a Deep export.") +
            diagnosticsCard("Provider health", providerRows) +
            diagnosticsCard("Self-test", selfTestRows) +
            diagnosticsCard("IPC / Startup", snapshot.runtimeCounters ?
                diagnosticsRow('Focus events', snapshot.runtimeCounters.focusEvents ?? 0, 'good') +
                diagnosticsRow('Focus state cache', snapshot.runtimeCounters.focusCacheReady ? 'Ready' : 'Warming', snapshot.runtimeCounters.focusCacheReady ? 'good' : 'neutral') +
                diagnosticsRow('Window event queue', `${snapshot.runtimeCounters.eventQueuePending ?? 0} pending · ${snapshot.runtimeCounters.eventQueueRunning ? 'running' : 'idle'}`, 'neutral') +
                diagnosticsRow('Transitions', `${snapshot.runtimeCounters.transitionWaiters ?? 0} waiting · ${snapshot.runtimeCounters.transitionActive || 'idle'}`, 'neutral') +
                diagnosticsRow('Renderer handoff', snapshot.runtimeCounters.rendererLaunchKind || 'none', 'neutral') +
                diagnosticsRow('Native recovery audit', snapshot.runtimeCounters.nativeSlowAuditDeferred ? 'Idle · paused' : 'Enabled', snapshot.runtimeCounters.nativeSlowAuditDeferred ? 'neutral' : 'good') +
                diagnosticsRow('Skipped idle audits', snapshot.runtimeCounters.nativeSlowAuditSkippedUnmanaged ?? 0, 'neutral') :
                diagnosticsRow('IPC counters', 'Not sampled', 'neutral')),
            "overview"
        ) +
        diagnosticsSection(
            "02",
            "Active provider",
            activeProviderName ? `${PROVIDER_NAMES[activeProviderName] || activeProviderName} content/runtime state and targeted recovery.` : "No provider is currently active.",
            diagnosticsCard("Provider state", activeRows, "", "settings-diagnostics-provider-state-card") +
            diagnosticsSafeModeCard(activeProviderName, activeProviderPage) +
            diagnosticsRepairCard(activeProviderName, activeProviderPage),
            "active"
        ) +
        diagnosticsSection(
            "03",
            "Playback / Resume",
            "Current media state, provider resume path and audio processing are kept together.",
            diagnosticsCard("Playback", mediaRows) +
            diagnosticsCard("Resume", resumeRows) +
            diagnosticsCard("Audio chain", audioRows),
            "playback"
        ) +
        diagnosticsSection(
            "04",
            "Provider features",
            "Provider-specific feature state plus the shared Provider API capability contract.",
            diagnosticsCard("Active provider features", featureRows, "", "settings-diagnostics-feature-card") +
            diagnosticsCapabilityMatrix(providerStates, selfTest),
            "features"
        ) +
        diagnosticsSection(
            "05",
            "Event timeline",
            "The session flight recorder shows the event chain that led to the current state.",
            diagnosticsTimelineCard(flightRecorder),
            "timeline"
        ) +
        diagnosticsSection(
            "06",
            "Environment / Helpers",
            "Browser environment, native helpers, manifest surface and settings state.",
            diagnosticsCard("Environment", environmentRows) +
            diagnosticsCard("Native integrations", helperRows) +
            diagnosticsCard("Manifest", manifestRows) +
            diagnosticsCard("Settings", settingsRows),
            "system"
        ) +
        diagnosticsSection(
            "07",
            "Raw / Export",
            "Snapshot metadata only. The complete structured payload remains in the JSON export.",
            diagnosticsCard("Raw snapshot", rawRows, "Use the download action in the Diagnostics header for the complete JSON payload.", "settings-diagnostics-raw-card"),
            "raw"
        );
}

function setDiagnosticsStatus(text) {
    if (!settingsDiagnosticsStatus) return;
    settingsDiagnosticsStatus.textContent = text || "";
}

// Diagnostics panel hydration is an EXPLICIT user action. Cache is painted
// first; only the selected provider gets one direct content-script request.
// No window enumeration, script injection or native IPC. Never poll.
let settingsDiagnosticsPanelEpoch = 0;
let settingsDiagnosticsPanelProbePending = false;
function settingsDiagnosticsBounded(promise, ms) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);
}
async function hydrateActiveProviderDiagnostics(snapshot, epoch) {
    if (settingsDiagnosticsPanelProbePending || !diagnosticsIsOpen()) return;
    const provider = snapshot?.shell?.activeProvider;
    const windowId = snapshot?.shell?.providerWindows?.[provider]?.windowId;
    if (!provider || !Number.isInteger(windowId)) return;
    // Never add renderer diagnostics pressure during a startup handoff.
    if (snapshot.runtimeCounters?.transitionActive ||
        (snapshot.runtimeCounters?.transitionWaiters || 0) > 0) return;
    settingsDiagnosticsPanelProbePending = true;
    try {
        const tabs = await settingsDiagnosticsBounded(
            chrome.tabs.query({ windowId, active: true }), 1100);
        const tabId = tabs?.find(tab => Number.isInteger(tab?.id))?.id;
        if (!Number.isInteger(tabId)) return;
        const page = await settingsDiagnosticsBounded(
            chrome.tabs.sendMessage(tabId, { type: 'stream-shell-provider-diagnostics' }),
            1600);
        if (page?.ok !== true || epoch !== settingsDiagnosticsPanelEpoch ||
            !diagnosticsIsOpen()) return;
        const entry = snapshot.shell.providerWindows[provider];
        if (!entry || entry.windowId !== windowId) return;
        entry.page = page;
        entry.alive = true;
        entry.liveProbe = true;
        entry.tab = { id: tabId };
        settingsDiagnosticsSnapshot = snapshot;
        renderSettingsDiagnostics(snapshot);
        setDiagnosticsStatus('Cached health + live ' +
            (PROVIDER_NAMES[provider] || provider) + ' probe · ' +
            new Date().toLocaleTimeString());
    } catch {
        // A timeout or inaccessible content script is "not probed", not a
        // failed provider. The previously rendered cache stays on screen.
    } finally {
        settingsDiagnosticsPanelProbePending = false;
        if (epoch === settingsDiagnosticsPanelEpoch && diagnosticsIsOpen() &&
            !snapshot.shell.providerWindows[provider]?.liveProbe) {
            setDiagnosticsStatus('Cached health · provider live probe not available');
        }
    }
}

async function refreshSettingsDiagnostics() {
    const epoch = ++settingsDiagnosticsPanelEpoch;
    setDiagnosticsStatus("Refreshing cached health…");
    renderSettingsDiagnostics(null);
    const startedAt = performance.now();

    try {
        settingsDiagnosticsSnapshot = await collectSettingsDiagnostics({ full: false });
        renderSettingsDiagnostics(settingsDiagnosticsSnapshot);
        const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
        setDiagnosticsStatus(`Cached health · ${elapsedMs}ms · active provider probe pending`);
        // Render first. Probe the active provider once, separately, *after*
        // the panel is already usable. Do not block the open/refresh action.
        void hydrateActiveProviderDiagnostics(settingsDiagnosticsSnapshot, epoch);
    } catch {
        settingsDiagnosticsSnapshot = null;
        settingsDiagnosticsContent.innerHTML = `
            <div class="settings-diagnostics-loading settings-diagnostics-error">
                <strong>Diagnostics could not be collected.</strong>
            </div>
        `;
        setDiagnosticsStatus("Failed");
    }
}

function diagnosticsIsOpen() {
    return Boolean(
        settingsDiagnosticsOverlay &&
        !settingsDiagnosticsOverlay.hidden &&
        settingsDiagnosticsOverlay.classList.contains("visible")
    );
}

function openSettingsDiagnostics() {
    if (!settingsDiagnosticsOverlay) return;

    if (settingsDiagnosticsCloseTimer) {
        clearTimeout(settingsDiagnosticsCloseTimer);
        settingsDiagnosticsCloseTimer = null;
    }

    settingsDiagnosticsOverlay.hidden = false;
    settingsCenter?.classList.add("diagnostics-open");
    requestAnimationFrame(() => {
        settingsDiagnosticsOverlay.classList.add("visible");
    });

    refreshSettingsDiagnostics();
}

function closeSettingsDiagnostics() {
    ++settingsDiagnosticsPanelEpoch;
    if (!settingsDiagnosticsOverlay) return;

    settingsDiagnosticsOverlay.classList.remove("visible");

    if (settingsDiagnosticsCloseTimer) {
        clearTimeout(settingsDiagnosticsCloseTimer);
    }

    settingsDiagnosticsCloseTimer = setTimeout(() => {
        if (!settingsDiagnosticsOverlay.classList.contains("visible")) {
            settingsDiagnosticsOverlay.hidden = true;
            settingsCenter?.classList.remove("diagnostics-open");
        }
        settingsDiagnosticsCloseTimer = null;
    }, 220);
}

async function exportSettingsDiagnostics(deep = false) {
    setDiagnosticsStatus(deep ? "Collecting deep export…" : "Exporting lightweight runtime log…");
    const snapshot = await collectSettingsDiagnostics({ full: deep });
    const payload = {
        ...snapshot
    };

    const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `StreamShell-${deep ? 'deep' : 'runtime'}-${snapshot.extensionVersion}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setDiagnosticsStatus(deep ? "Deep export completed" : "Runtime log exported");
}

