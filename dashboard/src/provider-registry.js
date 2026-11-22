function getStreamShellProviderRegistry() {
    return normalizeStreamShellProviderRegistry(
        settingsValues[STREAM_SHELL_PROVIDER_REGISTRY_KEY]
    );
}

function streamShellPinnedProviders(registry = getStreamShellProviderRegistry()) {
    const lookup = new Map(registry.providers.map(p => [p.id, p]));
    return registry.dashboardOrder
        .map(id => lookup.get(id))
        .filter(p => p?.enabled && p?.showOnDashboard &&
            (p.id !== "mangayomi" || settingsValues.streamShellSevenSeasAcknowledged === true))
        ;
}

function renderProviderSelector() {
    const root = document.querySelector(".provider-selector");
    if (!root) return;

    const pinned = streamShellDashboardGroups(streamShellPinnedProviders());
    const layout = STREAM_SHELL_PROVIDER_GRID_PATTERNS[pinned.length] || [];
    root.replaceChildren();
    root.dataset.providerCount = String(pinned.length);
    root.style.setProperty("--compact-provider-count", String(Math.max(1, pinned.length)));
    // Keep the Compact rail fluid: fewer pins get more air, seven pins fit
    // comfortably without changing the fixed outer or media-column gutters.
    root.style.setProperty("--compact-provider-gap-factor",
        String(Math.min(1.8, Math.max(0.7, 5 / Math.max(1, pinned.length)))));
    let index = 0;

    for (const size of layout) {
        const row = document.createElement("div");
        row.className = `provider-row provider-row-count-${size}`;
        for (let j = 0; j < size; j++) {
            const group = pinned[index++];
            const holder = group.length === 2 ? document.createElement("div") : row;
            if (group.length === 2) {
                holder.className = "provider-card-split";
                holder.setAttribute("role", "group");
                holder.setAttribute("aria-label", "YouTube and YouTube Music");
                row.appendChild(holder);
            }
            for (const provider of group) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "provider-card";
            card.dataset.provider = provider.id;
            card.title = provider.name;
            card.setAttribute("aria-label", provider.name);
            card.classList.toggle("active", provider.id === currentLeftMode);
            const icon = provider.kind === "custom"
                ? document.createElement("span")
                : document.createElement("img");
            if (provider.kind === "custom") {
                icon.className = "provider-card-custom-icon";
                icon.textContent = provider.icon || provider.name.slice(0, 2).toUpperCase();
                icon.setAttribute("aria-hidden", "true");
                card.classList.add("provider-card-custom");
                const assetPath = streamShellCustomArtworkPath(provider.artKey, "icon");
                if (assetPath) {
                    const artwork = document.createElement("img");
                    artwork.className = "provider-card-custom-image";
                    artwork.alt = "";
                    artwork.addEventListener("load", () => icon.classList.add("has-image"));
                    artwork.addEventListener("error", () => artwork.remove());
                    artwork.src = chrome.runtime.getURL(assetPath);
                    icon.appendChild(artwork);
                }
            } else {
                icon.src = `../assets/providers/icons/${provider.id}.svg`;
                icon.alt = "";
                icon.addEventListener("error", () => { icon.hidden = true; });
            }
            const label = document.createElement("span");
            label.textContent = provider.id === "youtube-music" ? "Music" : provider.name;
            card.append(icon, label);
            holder.appendChild(card);
            }
        }
        root.appendChild(row);
    }

    // Reinstall per-card UI decorations after replacing the old DOM nodes.
    renderProviderPlaybackIndicators();
    renderAvailabilityIndicators();
}

let streamShellProviderRegistryWriteQueue = Promise.resolve();

function updateStreamShellProviderRegistry(mutator) {
    // Serialize rapid show/hide + ordering clicks to prevent lost updates.
    const nextWrite = streamShellProviderRegistryWriteQueue.catch(() => {}).then(async () => {
        const current = getStreamShellProviderRegistry();
        const proposed = mutator(current);
        if (settingsValues.streamShellSevenSeasAcknowledged !== true) {
            const native = proposed.providers.find(p => p.id === "mangayomi");
            if (native) { native.enabled = false; native.showOnDashboard = false; native.showInTitlebar = false; }
        }
        const next = normalizeStreamShellProviderRegistry(proposed);
        await chrome.storage.local.set({ [STREAM_SHELL_PROVIDER_REGISTRY_KEY]: next });
        settingsValues[STREAM_SHELL_PROVIDER_REGISTRY_KEY] = next;
        syncDashboardProviderIdentities(next);
        renderProviderSelector();
        if (settingsCenterIsOpen() && settingsProvider === "general" && settingsSection === "providers") {
            renderSettingsContent();
        }
    });
    streamShellProviderRegistryWriteQueue = nextWrite;
    return nextWrite;
}

function syncDashboardProviderIdentities(registry = getStreamShellProviderRegistry()) {
    for (const provider of registry.providers) {
        PROVIDERS.add(provider.id);
        PROVIDER_NAMES[provider.id] = provider.name;
    }
    for (const id of Array.from(PROVIDERS)) {
        if (!registry.providers.some(p => p.id === id)) {
            PROVIDERS.delete(id);
            delete PROVIDER_NAMES[id];
        }
    }
}

let editingStreamShellProviderId = null;
function streamShellCustomProviderId() {
    return `custom-${crypto.randomUUID().replaceAll("-", "")}`;
}
function streamShellProviderFormError(text) {
    const label = document.querySelector("#settings-custom-provider-error");
    if (label) label.textContent = text || "";
}
function saveStreamShellCustomProvider() {
    const name = document.querySelector("#settings-custom-provider-name")?.value.trim().slice(0, 48) || "";
    const url = streamShellValidatedCustomUrl(document.querySelector("#settings-custom-provider-url")?.value);
    const icon = document.querySelector("#settings-custom-provider-icon")?.value.trim().slice(0, 8) || "";
    const rawArtKey = document.querySelector("#settings-custom-provider-art-key")?.value.trim() || "";
    const artKey = streamShellValidatedArtworkKey(rawArtKey);
    if (rawArtKey && !artKey) {
        streamShellProviderFormError("Artwork key: a-z, 0-9, _ or -, maximum 32 characters.");
        return;
    }
    if (!name || !url) {
        streamShellProviderFormError("Name and valid HTTPS URL required (e.g. https://www.paramountplus.com/).");
        return;
    }
    const editId = editingStreamShellProviderId;
    editingStreamShellProviderId = null;
    updateStreamShellProviderRegistry(registry => {
        if (editId) {
            const item = registry.providers.find(p => p.id === editId && p.kind === "custom");
            if (!item) throw new Error("Provider no longer exists.");
            Object.assign(item, { name, url, icon, artKey });
        } else {
            const id = streamShellCustomProviderId();
            const hasSpace = streamShellPinnedProviders(registry).length < 7;
            registry.providers.push({ id, kind: "custom", name, url, icon, artKey,
                enabled: true, showOnDashboard: hasSpace, showInTitlebar: true });
            registry.dashboardOrder.push(id);
            registry.titlebarOrder.push(id);
        }
        return registry;
    }).catch(error => {
        editingStreamShellProviderId = editId;
        renderSettingsContent();
        streamShellProviderFormError(error.message);
    });
}

// Local filename convention only; image files are user-maintained, never bundled.
function streamShellLocalArtworkFiles(rawKey) {
    const key = streamShellValidatedArtworkKey(rawKey) || "key";
    return {
        icon: `assets/providers/custom/custom_${key}_icon.svg`,
        wordmark: `assets/providers/custom/custom_${key}_wordmark.svg`,
        native: `native/titlebar-icons/custom/custom_${key}.png`,
        wide: `assets/backgrounds/custom_${key}_wide.png`,
        compact: `assets/backgrounds/custom_${key}_compact.png`
    };
}

function updateStreamShellLocalArtworkHints(rawKey) {
    const paths = streamShellLocalArtworkFiles(rawKey);
    for (const [type, path] of Object.entries(paths)) {
        const element = document.querySelector(`[data-artwork-path="${type}"]`);
        if (element) element.textContent = path;
    }
}

function renderProviderRegistrySettings() {
    if (typeof chrome !== "undefined" && chrome.storage?.local?.get) chrome.storage.local.get("streamShellMangayomiExecutable").then(stored => {
        const input = document.getElementById("settings-mangayomi-path");
        if (input && document.activeElement !== input) {
            input.value = stored.streamShellMangayomiExecutable || "";
        }
        settingsValues.streamShellMangayomiExecutable = stored.streamShellMangayomiExecutable || "";
    }).catch(() => {});
    const registry = getStreamShellProviderRegistry();
    const sevenSeas = settingsValues.streamShellSevenSeasAcknowledged === true;
    const byId = new Map(registry.providers.map(p => [p.id, p]));
    const visible = streamShellDashboardGroups(streamShellPinnedProviders(registry)).length;
    const rows = registry.dashboardOrder.map((id, index) => {
        const p = byId.get(id);
        const locked = p.id === "mangayomi" && !sevenSeas;
        const pinned = !locked && p.enabled && p.showOnDashboard;
        const label = escapeSettingsHtml(p.name);
        return `<div class="setting-row settings-provider-registry-row" data-ss-order-item="${id}" data-ss-order-surface="dashboard">
            ${settingsProviderDragHandle(id, "dashboard", p.name)}
            <span class="setting-copy"><strong>${label}</strong>
            <span>${p.kind === "native" ? "Native Windows app · optional helper" : p.kind === "builtin" ? "Integrated" : "Basic HTTPS window"}${p.kind === "custom" ? " · " + escapeSettingsHtml(p.url) : ""}</span></span>
            <label class="settings-provider-registry-toggle">
                <span class="settings-switch" style="--settings-accent-rgb:${streamShellProviderAccentRgb(id, registry)}"><input type="checkbox" data-registry-enabled="${id}" ${p.enabled && !locked ? "checked" : ""} ${locked ? "disabled" : ""}><span aria-hidden="true"></span></span>
                <span>Enabled</span>
            </label>
            <label class="settings-provider-registry-toggle">
                <span class="settings-switch" style="--settings-accent-rgb:${streamShellProviderAccentRgb(id, registry)}"><input type="checkbox" data-registry-visibility="${id}" ${pinned ? "checked" : ""} ${p.enabled && !locked ? "" : "disabled"}><span aria-hidden="true"></span></span>
                <span>Dashboard</span>
            </label>
            ${p.kind === "custom" ? `<button type="button" class="settings-provider-registry-move" data-registry-edit="${id}" aria-label="Edit ${label}">✎</button>
            <button type="button" class="settings-provider-registry-move" data-registry-remove="${id}" aria-label="Remove ${label}">×</button>` : ""}
        </div>`;
    }).join("");
    const titlebarRows = registry.titlebarOrder.map((id, index) => {
        const p = byId.get(id);
        if (!p) return "";
        const locked = p.id === "mangayomi" && !sevenSeas;
        return `<div class="setting-row settings-provider-registry-row" data-ss-order-item="${id}" data-ss-order-surface="titlebar">
            ${settingsProviderDragHandle(id, "titlebar", p.name)}
            <span class="setting-copy"><strong>${escapeSettingsHtml(p.name)}</strong>
                <span>${p.kind === "native" ? "Native Windows app" : p.kind === "builtin" ? "Integrated" : "Basic HTTPS window"}</span></span>
            <label class="settings-provider-registry-toggle">
                <span class="settings-switch" style="--settings-accent-rgb:${streamShellProviderAccentRgb(id, registry)}"><input type="checkbox" data-registry-titlebar-visible="${id}" ${p.showInTitlebar && p.enabled && !locked ? "checked" : ""} ${p.enabled && !locked ? "" : "disabled"}><span aria-hidden="true"></span></span>
                <span>Titlebar</span>
            </label>
            <label class="settings-provider-titlebar-color" title="Titlebar theme / active-state background color; icons always stay neutral monochrome">
                <input type="color" data-registry-titlebar-color-picker="${id}" value="${p.titlebarColor || '#D5D0DD'}" aria-label="${escapeSettingsHtml(p.name)} titlebar theme color">
                <input type="text" data-registry-titlebar-color-hex="${id}" maxlength="7" spellcheck="false" placeholder="Auto" value="${escapeSettingsHtml(p.titlebarColor || '')}" aria-label="${escapeSettingsHtml(p.name)} theme color hex">
            </label>
        </div>`;
    }).join("");

    const editing = registry.providers.find(p => p.id === editingStreamShellProviderId && p.kind === "custom");
    if (editingStreamShellProviderId && !editing) editingStreamShellProviderId = null;
    const paths = streamShellLocalArtworkFiles(editing?.artKey);
    const artworkHints = [
        ["Provider icon (SVG)", "icon"],
        ["Wordmark (SVG)", "wordmark"],
        ["Native titlebar (PNG)", "native"],
        ["Wide background (PNG)", "wide"],
        ["Compact background (PNG)", "compact"]
    ].map(([label, type]) => `<div class="settings-custom-provider-artwork-item">
        <span>${label}</span><code data-artwork-path="${type}">${escapeSettingsHtml(paths[type])}</code>
    </div>`).join("");
    const form = `<div class="settings-custom-provider-form">
        <div class="settings-custom-provider-fields">
            <label>Name<input id="settings-custom-provider-name" maxlength="48" placeholder="Provider name" value="${escapeSettingsHtml(editing?.name || "")}"></label>
            <label>Icon / initials<input id="settings-custom-provider-icon" maxlength="8" placeholder="AB" value="${escapeSettingsHtml(editing?.icon || "")}"></label>
            <label>HTTPS URL<input id="settings-custom-provider-url" type="url" placeholder="https://example.com/" value="${escapeSettingsHtml(editing?.url || "")}"></label>
        </div>
        <div class="settings-custom-provider-bottom">
            <label>Local artwork key (optional)<input id="settings-custom-provider-art-key" maxlength="32" placeholder="my_provider" value="${escapeSettingsHtml(editing?.artKey || "")}"></label>
            <div class="settings-custom-provider-actions">
                <button type="button" class="settings-provider-registry-move" id="settings-custom-provider-save">${editing ? "Save changes" : "Add provider"}</button>
                ${editing ? `<button type="button" class="settings-provider-registry-move" id="settings-custom-provider-cancel">Cancel</button>` : ""}
            </div>
        </div>
        <span id="settings-custom-provider-error" role="status"></span>
        <div class="settings-custom-provider-artwork" aria-label="Local artwork paths">${artworkHints}</div>
    </div>`;
    const nativeSetup = `<div class="settings-custom-provider-form">
        <div class="settings-custom-provider-fields"><label>Mangayomi.exe path (optional)
        <input id="settings-mangayomi-path" placeholder="C:\\Apps\\Mangayomi\\Mangayomi.exe" spellcheck="false" value="${escapeSettingsHtml(settingsValues.streamShellMangayomiExecutable || '')}">
        </label></div><div class="settings-custom-provider-actions">
        <button type="button" id="settings-mangayomi-save" class="settings-provider-registry-move">Save path</button>
        <button type="button" id="settings-mangayomi-kill" class="settings-provider-registry-move" title="Force-close the configured Mangayomi process and its child processes">Kill Mangayomi (process)</button></div>
        <span id="settings-mangayomi-status" role="status">Install integrations/mangayomi/install-mangayomi-helper.ps1 once. Enable the button above when ready.</span>
    </div>`;
    return settingsPage("Providers",
        `<p class="ss-seven-seas-status">${sevenSeas ? "Third-party integrations unlocked." : "Mangayomi is locked. Enable General → Seven Seas to unlock it."}</p>` +
        `<div class="settings-provider-registry-columns">` +
            settingsSubgroup("Dashboard", `<div class="ss-provider-list">${rows}</div>` +
                `<p class="ss-provider-selection-count">${streamShellPinnedProviders(registry).length} providers selected · ${visible}/7 dashboard slots</p>` +
                renderSettingsProviderPreview(registry, "dashboard"),
                "Drag the handles or preview buttons to reorder. YouTube and Music share one slot.") +
            settingsSubgroup("Native titlebar (unlimited)", `<div class="ss-provider-list">${titlebarRows}</div>` +
                `<p class="ss-provider-selection-count">${registry.providers.filter(p => p.enabled && p.showInTitlebar).length} titlebar providers selected</p>` + renderSettingsProviderPreview(registry, "titlebar"),
                "Drag to reorder the horizontal preview or list. Extra buttons appear under … in the native titlebar.") +
        `</div>` +
        settingsSubgroup("Mangayomi · native integration", nativeSetup) +
        settingsSubgroup(editing ? "Edit custom provider" : "Add custom provider", form)
    );
}
