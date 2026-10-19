/* Stream Shell provider registry v2: shared validation for Dashboard and background.
 * Custom providers are HTTPS-only basic windows, never injected adapters. */
const STREAM_SHELL_PROVIDER_REGISTRY_KEY = "streamShellProviderRegistry";
const STREAM_SHELL_PROVIDER_BUILTINS = Object.freeze([
    { id: "youtube", name: "YouTube", url: "https://www.youtube.com/" },
    { id: "netflix", name: "Netflix", url: "https://www.netflix.com/browse" },
    { id: "prime", name: "Prime Video", url: "https://www.primevideo.com/" },
    { id: "disney", name: "Disney+", url: "https://www.disneyplus.com/" },
    { id: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com/" }
]);
const STREAM_SHELL_PROVIDER_GRID_PATTERNS = Object.freeze({
    1: [1], 2: [2], 3: [3], 4: [1, 2, 1],
    5: [1, 3, 1], 6: [2, 2, 2], 7: [2, 3, 2]
});
const STREAM_SHELL_BUILTIN_IDS = new Set(STREAM_SHELL_PROVIDER_BUILTINS.map(p => p.id));

function streamShellValidatedCustomUrl(input) {
    const raw = typeof input === "string" ? input.trim() : "";
    if (!raw || raw.length > 2048 || /[\x00-\x20\x7f]/.test(raw)) return null;
    try {
        const url = new URL(raw);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
        return url.href;
    } catch {
        return null;
    }
}

// Local artwork paths are strictly keyed by a user-chosen slug; no arbitrary
// file paths or remote image URLs enter the extension's DOM.
function streamShellValidatedArtworkKey(input) {
    const key = typeof input === "string" ? input.trim().toLowerCase() : "";
    return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(key) ? key : "";
}

// Empty means: retain the integrated icon palette. Custom fallback defaults
// to a soft neutral accent. A user override is always canonical #RRGGBB.
function streamShellValidatedTitlebarColor(input) {
    const raw = typeof input === "string" ? input.trim() : "";
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : "";
}

function streamShellNativeCustomIconPath(key) {
    const slug = streamShellValidatedArtworkKey(key);
    return slug ? `native/titlebar-icons/custom/custom_${slug}.png` : null;
}

function streamShellCustomArtworkPath(key, kind) {
    const slug = streamShellValidatedArtworkKey(key);
    if (!slug) return null;
    if (kind === "wide" || kind === "compact") return `assets/backgrounds/custom_${slug}_${kind}.png`;
    if (kind === "icon" || kind === "wordmark") return `assets/providers/custom/custom_${slug}_${kind}.svg`;
    return null;
}

function defaultStreamShellProviderRegistry() {
    const ids = STREAM_SHELL_PROVIDER_BUILTINS.map(p => p.id);
    return {
        version: 2,
        providers: STREAM_SHELL_PROVIDER_BUILTINS.map(p => ({
            ...p, kind: "builtin", enabled: true, showOnDashboard: true,
            showInTitlebar: true
        })),
        dashboardOrder: [...ids],
        titlebarOrder: [...ids]
    };
}

function normalizeStreamShellProviderRegistry(value) {
    const defaults = defaultStreamShellProviderRegistry();
    if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
    const supplied = Array.isArray(value.providers) ? value.providers : [];
    const providers = STREAM_SHELL_PROVIDER_BUILTINS.map((base, index) => {
        const incoming = supplied.find(p => p && p.id === base.id);
        return {
            ...defaults.providers[index],
            enabled: incoming?.enabled !== false,
            showOnDashboard: incoming?.showOnDashboard !== false,
            showInTitlebar: incoming?.showInTitlebar !== false,
            titlebarColor: streamShellValidatedTitlebarColor(incoming?.titlebarColor)
        };
    });
    const seen = new Set(STREAM_SHELL_BUILTIN_IDS);
    for (const item of supplied) {
        if (!item || typeof item !== "object" || item.kind !== "custom") continue;
        const id = String(item.id || "");
        if (!/^custom-[a-z0-9]{8,40}$/.test(id) || seen.has(id)) continue;
        const url = streamShellValidatedCustomUrl(item.url);
        const name = typeof item.name === "string" ? item.name.trim().slice(0, 48) : "";
        if (!url || !name) continue;
        seen.add(id);
        providers.push({
            id, kind: "custom", name, url,
            icon: typeof item.icon === "string" ? item.icon.trim().slice(0, 8) : "",
            artKey: streamShellValidatedArtworkKey(item.artKey),
            titlebarColor: streamShellValidatedTitlebarColor(item.titlebarColor),
            enabled: item.enabled !== false,
            showOnDashboard: item.showOnDashboard === true,
            showInTitlebar: item.showInTitlebar !== false
        });
    }
    const ids = providers.map(p => p.id);
    const allowed = new Set(ids);
    const order = input => {
        const ordered = [], used = new Set();
        for (const id of Array.isArray(input) ? input : []) {
            if (typeof id === "string" && allowed.has(id) && !used.has(id)) {
                used.add(id); ordered.push(id);
            }
        }
        for (const id of ids) if (!used.has(id)) ordered.push(id);
        return ordered;
    };
    const dashboardOrder = order(value.dashboardOrder);
    const titlebarOrder = order(value.titlebarOrder);
    const pinned = providers.filter(p => p.enabled && p.showOnDashboard);
    if (!pinned.length) {
        const first = providers.find(p => p.enabled) || providers[0];
        first.enabled = true;
        first.showOnDashboard = true;
    } else if (pinned.length > 7) {
        const kept = new Set(dashboardOrder.filter(id => pinned.some(p => p.id === id)).slice(0, 7));
        for (const provider of pinned) if (!kept.has(provider.id)) provider.showOnDashboard = false;
    }
    return { version: 2, providers, dashboardOrder, titlebarOrder };
}
