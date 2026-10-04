(() => {
    const ROOT_ID = "stream-shell-twitch-workspace-v2";
    const STYLE_ID = "stream-shell-twitch-workspace-v2-style";
    const CLEANUP_STYLE_ID = "stream-shell-twitch-workspace-v2-cleanup";
    const HUD_POSITIONS_KEY = "streamShellTwitchHudPositionsV1";

    let context = null;
    let root = null;
    let shadow = null;
    let lastContextSignature = "";
    let hudExpanded = false;
    let hudPosition = { x: 10, y: 10 };
    let loadedPositionKey = null;
    let dragState = null;
    let suppressLauncherClickUntil = 0;
    let hudSettleGeneration = 0;
    let surfaceCheckGeneration = 0;

    const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload });

    function styleText() {
        return `
            :host { all: initial; }
            * { box-sizing: border-box; }
            button, input { font: inherit; }
            .hud {
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                gap: 5px;
                min-height: 36px;
                padding: 4px;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 18px;
                background: rgba(14,14,16,.72);
                box-shadow: 0 8px 26px rgba(0,0,0,.34);
                color: #efeff1;
                font: 12px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                opacity: .34;
                transition: opacity .12s ease, background .12s ease, width .12s ease;
                backdrop-filter: blur(8px);
                user-select: none;
                touch-action: none;
            }
            .hud:hover, .hud:focus-within, .hud.dragging {
                opacity: 1;
                background: rgba(14,14,16,.96);
            }
            .hud.collapsed { width: 36px; height: 36px; padding: 3px; }
            .hud.collapsed .expanded-content { display: none; }
            .launcher {
                width: 28px;
                height: 28px;
                min-width: 28px;
                padding: 0;
                display: grid;
                place-items: center;
                border: 0;
                border-radius: 50%;
                background: rgba(145,70,255,.18);
                cursor: grab;
            }
            .launcher:active { cursor: grabbing; }
            .dot-grid {
                width: 12px;
                height: 12px;
                display: grid;
                grid-template-columns: repeat(2, 4px);
                grid-template-rows: repeat(2, 4px);
                gap: 4px;
                place-content: center;
            }
            .dot-grid i {
                display: block;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: #bf94ff;
                box-shadow: 0 0 7px rgba(145,70,255,.55);
            }
            .expanded-content { display: flex; align-items: center; gap: 4px; padding-right: 1px; }
            .mode-pill {
                height: 26px;
                padding: 0 8px;
                display: inline-flex;
                align-items: center;
                border: 1px solid rgba(169,112,255,.42);
                border-radius: 8px;
                background: rgba(145,70,255,.14);
                color: rgba(255,255,255,.9);
                font-size: 10px;
                font-weight: 800;
                letter-spacing: .08em;
                text-transform: uppercase;
            }
            button.action {
                height: 26px;
                min-width: 30px;
                padding: 0 8px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 8px;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.84);
                cursor: pointer;
            }
            button.action:hover { background: rgba(255,255,255,.13); color: #fff; }
            button.action.primary { border-color: rgba(169,112,255,.55); background: rgba(145,70,255,.22); }
            button.action.fullscreen-active { border-color: rgba(169,112,255,.72); background: rgba(145,70,255,.34); }
            button.action.danger:hover { background: rgba(235,4,0,.25); }
            .editor {
                position: fixed;
                z-index: 2147483647;
                width: min(430px, calc(100vw - 20px));
                padding: 10px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 11px;
                background: rgba(24,24,27,.98);
                box-shadow: 0 12px 34px rgba(0,0,0,.42);
                color: #efeff1;
                font: 12px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .editor[hidden] { display: none; }
            .editor-row { display: flex; gap: 6px; }
            input {
                min-width: 0;
                flex: 1;
                height: 34px;
                padding: 0 9px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 8px;
                outline: none;
                background: #0e0e10;
                color: #fff;
            }
            input:focus { border-color: #9147ff; box-shadow: 0 0 0 1px #9147ff; }
            .editor-actions { display:flex; gap:6px; margin-top:7px; }
            .editor-actions button {
                height: 28px;
                padding: 0 9px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 7px;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.84);
                cursor: pointer;
            }
            .editor-actions button:hover { background: rgba(255,255,255,.13); color: #fff; }
            .editor-actions button.primary { border-color: rgba(169,112,255,.55); background: rgba(145,70,255,.22); }
            .editor-actions button:disabled { opacity: .36; cursor: not-allowed; background: rgba(255,255,255,.035); color: rgba(255,255,255,.5); }
            .editor-actions button:disabled:hover { background: rgba(255,255,255,.035); color: rgba(255,255,255,.5); }
            .error { min-height: 15px; margin-top: 6px; color: #ff8280; }
        `;
    }

    function ensureHost() {
        if (root?.isConnected) return;
        root = document.createElement("div");
        root.id = ROOT_ID;
        shadow = root.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = styleText();
        shadow.appendChild(style);
        (document.documentElement || document.body).appendChild(root);
    }

    function normalizeComparableTwitchRoute(value) {
        const raw = String(value || "").trim();
        if (!raw) return null;

        let candidate = raw;
        if (!/^https?:\/\//i.test(candidate)) {
            const compact = candidate.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
            if (!compact || /\s/.test(compact)) return null;
            candidate = `https://www.twitch.tv/${compact}`;
        }

        try {
            const parsed = new URL(candidate, location.href);
            if (!/(^|\.)twitch\.tv$/i.test(parsed.hostname)) return null;
            const path = parsed.pathname.replace(/\/+$/, "") || "/";
            return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${path.toLowerCase()}`;
        } catch {
            return null;
        }
    }

    function isBareChannelRoute(value = location.href) {
        try {
            const parsed = new URL(String(value || location.href), location.href);
            if (!/(^|\.)twitch\.tv$/i.test(parsed.hostname)) return false;
            const segments = parsed.pathname.split("/").filter(Boolean);
            if (segments.length !== 1) return false;
            const reserved = new Set([
                "directory", "downloads", "drops", "friends", "inventory", "jobs",
                "login", "messages", "p", "payments", "search", "settings", "signup",
                "subscriptions", "turbo", "videos", "wallet"
            ]);
            return !reserved.has(String(segments[0] || "").toLowerCase());
        } catch {
            return false;
        }
    }

    function isCurrentLiveStreamSurface() {
        if (!isBareChannelRoute(location.href)) return false;

        if (document.querySelector(
            '[data-test-selector="live-badge"], [data-test-selector="is-live-indicator"]'
        )) {
            return true;
        }

        const status = document.querySelector('[data-a-target="stream-status-text"]');
        if (status && /\blive\b/i.test(String(status.textContent || ""))) return true;

        /* Viewer count is rendered on the live watch surface, but not on an
         * offline channel profile. Keep this as a fallback for Twitch layouts
         * that temporarily omit the explicit LIVE badge. */
        return Boolean(document.querySelector('[data-a-target="animated-channel-viewers-count"]'));
    }

    function currentVisibleKind() {
        const requested = context?.effectiveKind || context?.kind || "page";
        if (requested !== "stream") return "page";

        /* Auto decides from the actual Twitch surface: a bare channel profile
         * is Page unless Twitch is currently rendering a live watch surface.
         * An explicit Stream choice remains user-authoritative; pane fullscreen
         * still arrives as effectiveKind=page and therefore stays Page there. */
        if ((context?.kindSource || "auto") === "explicit") return "stream";
        return isCurrentLiveStreamSurface() ? "stream" : "page";
    }

    function removeCleanup() {
        document.getElementById(CLEANUP_STYLE_ID)?.remove();
        delete document.documentElement.dataset.streamShellTwitchWorkspaceClean;
    }

    function applyStreamCleanup() {
        const effectiveKind = currentVisibleKind();
        if (context?.role !== "slot" || effectiveKind !== "stream") {
            removeCleanup();
            return;
        }

        document.documentElement.dataset.streamShellTwitchWorkspaceClean = "true";
        let style = document.getElementById(CLEANUP_STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = CLEANUP_STYLE_ID;
            (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = `
            /* Stream mode keeps Twitch's player, chat, channel information and
             * lower page content. Only the global header and left sidebar are
             * hidden. Pane fullscreen temporarily exposes Page mode instead. */
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="top-nav-container"],
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="top-nav"],
            html[data-stream-shell-twitch-workspace-clean="true"] nav.top-nav,
            html[data-stream-shell-twitch-workspace-clean="true"] .top-nav,
            html[data-stream-shell-twitch-workspace-clean="true"] #sideNav,
            html[data-stream-shell-twitch-workspace-clean="true"] .side-nav,
            html[data-stream-shell-twitch-workspace-clean="true"] .side-nav__overlay-wrapper,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="side-nav"],
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="side-nav-bar"] {
                display: none !important;
            }
            html[data-stream-shell-twitch-workspace-clean="true"] .root-scrollable__wrapper {
                top: 0 !important;
            }
        `;
    }

    function clampHudPosition(hud, position = hudPosition) {
        const margin = 4;
        const rect = hud?.getBoundingClientRect?.();
        const width = Math.max(36, rect?.width || 36);
        const height = Math.max(36, rect?.height || 36);
        return {
            x: Math.min(Math.max(margin, Number(position?.x) || margin), Math.max(margin, window.innerWidth - width - margin)),
            y: Math.min(Math.max(margin, Number(position?.y) || margin), Math.max(margin, window.innerHeight - height - margin))
        };
    }

    function positionEditor(hud, editor) {
        if (!hud || !editor || editor.hidden) return;
        const rect = hud.getBoundingClientRect();
        const width = Math.min(430, Math.max(220, window.innerWidth - 20));
        const left = Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - width - 10));
        editor.style.left = `${Math.round(left)}px`;
        editor.style.width = `${Math.round(width)}px`;
        if (rect.bottom + 170 <= window.innerHeight) {
            editor.style.top = `${Math.round(rect.bottom + 8)}px`;
            editor.style.bottom = "auto";
        } else {
            editor.style.top = "auto";
            editor.style.bottom = `${Math.max(10, Math.round(window.innerHeight - rect.top + 8))}px`;
        }
    }

    function hudLayoutKey() {
        return context?.paneFullscreen === true ? "fullscreen" : "grid";
    }

    function finiteHudPosition(value) {
        if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
        return { x: Number(value.x), y: Number(value.y) };
    }

    function applyHudPosition(hud, editor, save = false) {
        if (!hud) return;
        hudPosition = clampHudPosition(hud, hudPosition);
        hud.style.left = `${Math.round(hudPosition.x)}px`;
        hud.style.top = `${Math.round(hudPosition.y)}px`;
        positionEditor(hud, editor);
        if (save && context?.slotId) {
            const layout = hudLayoutKey();
            const value = { x: Math.round(hudPosition.x), y: Math.round(hudPosition.y) };
            chrome.storage.local.get(HUD_POSITIONS_KEY).then(stored => {
                const map = { ...(stored?.[HUD_POSITIONS_KEY] || {}) };
                const previous = map[context.slotId];
                const legacy = finiteHudPosition(previous);
                const perLayout = legacy
                    ? { grid: legacy }
                    : (previous && typeof previous === "object" ? { ...previous } : {});
                perLayout[layout] = value;
                map[context.slotId] = perLayout;
                return chrome.storage.local.set({ [HUD_POSITIONS_KEY]: map });
            }).catch(() => {});
        }
    }

    async function loadHudPosition(slotId) {
        const layout = hudLayoutKey();
        const key = slotId ? `${slotId}:${layout}` : null;
        if (!slotId || loadedPositionKey === key) return;
        loadedPositionKey = key;
        try {
            const stored = await chrome.storage.local.get(HUD_POSITIONS_KEY);
            const raw = stored?.[HUD_POSITIONS_KEY]?.[slotId];
            const legacy = finiteHudPosition(raw);
            const saved = legacy
                ? legacy
                : (finiteHudPosition(raw?.[layout]) || finiteHudPosition(raw?.grid));
            hudPosition = saved || { x: 10, y: 10 };
        } catch {
            hudPosition = { x: 10, y: 10 };
        }
    }

    function settleHudAfterViewportChange(saveFinal = false) {
        const generation = ++hudSettleGeneration;
        for (const delay of [0, 80, 200, 420]) {
            setTimeout(() => {
                if (generation !== hudSettleGeneration) return;
                const hud = shadow?.querySelector?.(".hud");
                const editor = shadow?.querySelector?.(".editor");
                if (!hud) return;
                applyHudPosition(hud, editor, saveFinal && delay === 420);
            }, delay);
        }
    }

    function setHudExpanded(hud, editor, expanded) {
        hudExpanded = Boolean(expanded);
        hud.classList.toggle("collapsed", !hudExpanded);
        hud.classList.toggle("expanded", hudExpanded);
        if (!hudExpanded) editor.hidden = true;
        requestAnimationFrame(() => applyHudPosition(hud, editor, false));
    }

    function installHudDrag(hud, editor, launcher) {
        const move = event => {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            const dx = event.clientX - dragState.startClientX;
            const dy = event.clientY - dragState.startClientY;
            if (!dragState.moved && Math.hypot(dx, dy) >= 4) {
                dragState.moved = true;
                hud.classList.add("dragging");
            }
            if (!dragState.moved) return;
            event.preventDefault();
            hudPosition = {
                x: dragState.startX + dx,
                y: dragState.startY + dy
            };
            applyHudPosition(hud, editor, false);
        };

        const end = event => {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            const moved = dragState.moved;
            dragState = null;
            hud.classList.remove("dragging");
            try { launcher.releasePointerCapture(event.pointerId); } catch {}
            if (moved) {
                suppressLauncherClickUntil = performance.now() + 260;
                applyHudPosition(hud, editor, true);
            }
        };

        launcher.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            dragState = {
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: hudPosition.x,
                startY: hudPosition.y,
                moved: false
            };
            try { launcher.setPointerCapture(event.pointerId); } catch {}
        });
        launcher.addEventListener("pointermove", move);
        launcher.addEventListener("pointerup", end);
        launcher.addEventListener("pointercancel", end);
        launcher.addEventListener("lostpointercapture", event => {
            if (dragState && event.pointerId === dragState.pointerId) {
                dragState = null;
                hud.classList.remove("dragging");
            }
        });
    }

    async function renderSlotHud() {
        ensureHost();
        dragState = null;
        await loadHudPosition(context.slotId);
        shadow.querySelectorAll(".hud,.editor").forEach(node => node.remove());

        const hud = document.createElement("div");
        hud.className = `hud ${hudExpanded ? "expanded" : "collapsed"}`;
        hud.innerHTML = `
            <button type="button" class="launcher" data-action="toggle-hud" title="Click to expand/collapse · drag to move" aria-label="Twitch workspace controls">
                <span class="dot-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            </button>
            <span class="expanded-content">
                <span class="mode-pill"></span>
                <button type="button" data-action="mute" class="action primary" aria-label="Toggle browser mute"></button>
                ${context.raidControlVisible !== false ? '<button type="button" data-action="raid" class="action" aria-label="Toggle anti-raid protection">🛡</button>' : ''}
                <button type="button" data-action="reload" class="action" title="Reload this Twitch slot" aria-label="Reload this Twitch slot">↻</button>
                <button type="button" data-action="fullscreen" class="action" title="Toggle right-pane fullscreen" aria-label="Toggle right-pane fullscreen">⛶</button>
                <button type="button" data-action="edit" class="action">Edit</button>
                <button type="button" data-action="clear" class="action danger" title="Clear this slot">×</button>
            </span>
        `;
        const effectiveKind = currentVisibleKind();
        hud.querySelector(".mode-pill").textContent = String(effectiveKind).toUpperCase();
        const muteButton = hud.querySelector('[data-action="mute"]');
        muteButton.textContent = context.muted ? "🔇" : "🔊";
        muteButton.title = context.muted ? "Unmute this Twitch slot" : "Mute this Twitch slot";
        muteButton.setAttribute("aria-label", muteButton.title);
        const raidButton = hud.querySelector('[data-action="raid"]');
        if (raidButton) {
            const enabled = context.raidProtectionEnabled === true;
            raidButton.classList.toggle("primary", enabled);
            raidButton.title = enabled ? "Anti-raid: on for this Twitch window" : "Anti-raid: off for this Twitch window";
            raidButton.setAttribute("aria-label", raidButton.title);
        }
        const fullscreenButton = hud.querySelector('[data-action="fullscreen"]');
        fullscreenButton.classList.toggle("fullscreen-active", context.paneFullscreen === true);
        fullscreenButton.title = context.paneFullscreen ? "Return this slot to the 2×2 grid" : "Fill the right Stream Shell pane";
        shadow.appendChild(hud);

        const editor = document.createElement("div");
        editor.className = "editor";
        editor.hidden = true;
        editor.innerHTML = `
            <div class="editor-row">
                <input type="text" spellcheck="false" autocomplete="off" aria-label="Twitch channel or URL">
            </div>
            <div class="editor-actions">
                <button type="button" data-action="save-auto">Auto</button>
                <button type="button" data-action="save-stream">Stream</button>
                <button type="button" data-action="save-page">Page</button>
                <button type="button" data-action="cancel">Cancel</button>
            </div>
            <div class="error"></div>
        `;
        const input = editor.querySelector("input");
        input.value = context.url || "";
        shadow.appendChild(editor);

        const syncEditorModeState = () => {
            const visibleKind = currentVisibleKind();
            const autoButton = editor.querySelector('[data-action="save-auto"]');
            const streamButton = editor.querySelector('[data-action="save-stream"]');
            const pageButton = editor.querySelector('[data-action="save-page"]');
            autoButton?.classList.remove("primary");
            streamButton?.classList.toggle("primary", visibleKind === "stream");
            pageButton?.classList.toggle("primary", visibleKind === "page");

            if (streamButton) {
                streamButton.disabled = false;
                streamButton.title = "Use Stream mode explicitly";
            }
        };
        syncEditorModeState();

        installHudDrag(hud, editor, hud.querySelector(".launcher"));
        requestAnimationFrame(() => applyHudPosition(hud, editor, false));

        async function save(kind) {
            const error = editor.querySelector(".error");
            error.textContent = "";
            const response = await send("twitch-workspace-v2-assign-slot", {
                slotId: context.slotId,
                input: input.value,
                kind
            }).catch(err => ({ ok: false, error: err?.message }));
            if (!response?.ok) {
                error.textContent = response?.error || "Could not update slot.";
                return;
            }
            editor.hidden = true;
        }

        const handleActionClick = event => {
            const button = event.target?.closest?.("button[data-action]");
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            const action = button.dataset.action;
            if (action === "toggle-hud") {
                if (performance.now() < suppressLauncherClickUntil) return;
                setHudExpanded(hud, editor, !hudExpanded);
            } else if (action === "edit") {
                editor.hidden = !editor.hidden;
                if (!editor.hidden) {
                    positionEditor(hud, editor);
                    input.focus();
                    input.select();
                }
            } else if (action === "cancel") {
                editor.hidden = true;
            } else if (action === "save-auto") {
                save(null);
            } else if (action === "save-stream") {
                save("stream");
            } else if (action === "save-page") {
                save("page");
            } else if (action === "mute") {
                button.disabled = true;
                send("twitch-workspace-v2-set-muted", {
                    slotId: context.slotId,
                    muted: !context.muted
                }).finally(() => { button.disabled = false; });
            } else if (action === "raid") {
                button.disabled = true;
                send("twitch-workspace-v2-set-raid-protection", {
                    slotId: context.slotId,
                    enabled: context.raidProtectionEnabled !== true
                }).finally(() => { button.disabled = false; });
            } else if (action === "reload") {
                button.disabled = true;
                send("twitch-workspace-v2-reload-slot", { slotId: context.slotId })
                    .finally(() => { button.disabled = false; });
            } else if (action === "fullscreen") {
                button.disabled = true;
                send("twitch-workspace-v2-toggle-pane-fullscreen", { slotId: context.slotId })
                    .finally(() => { button.disabled = false; });
            } else if (action === "clear") {
                send("twitch-workspace-v2-clear-slot", { slotId: context.slotId }).catch(() => {});
            }
        };

        hud.addEventListener("click", handleActionClick);
        editor.addEventListener("click", handleActionClick);
        input.addEventListener("input", () => syncEditorModeState());
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                save(null);
            } else if (event.key === "Escape") {
                editor.hidden = true;
            }
        });
    }

    async function render() {
        if (!context?.managed) {
            root?.remove();
            root = shadow = null;
            removeCleanup();
            return;
        }

        document.documentElement.dataset.streamShellTwitchWorkspaceRole = context.role || "unknown";
        if (context.slotId) document.documentElement.dataset.streamShellTwitchWorkspaceSlot = context.slotId;
        else delete document.documentElement.dataset.streamShellTwitchWorkspaceSlot;

        if (context.role !== "slot") {
            root?.remove();
            root = shadow = null;
            removeCleanup();
            return;
        }

        await renderSlotHud();
        applyStreamCleanup();
    }

    function refreshSurfacePresentation() {
        if (!context?.managed || context?.role !== "slot") return;
        const hud = shadow?.querySelector?.(".hud");
        const editor = shadow?.querySelector?.(".editor");
        if (hud) {
            hud.querySelector(".mode-pill").textContent = currentVisibleKind().toUpperCase();
        }
        if (editor) {
            const streamButton = editor.querySelector('[data-action="save-stream"]');
            const pageButton = editor.querySelector('[data-action="save-page"]');
            const autoButton = editor.querySelector('[data-action="save-auto"]');
            const input = editor.querySelector("input");
            const visibleKind = currentVisibleKind();
            autoButton?.classList.remove("primary");
            streamButton?.classList.toggle("primary", visibleKind === "stream");
            pageButton?.classList.toggle("primary", visibleKind === "page");
            if (streamButton && input) {
                streamButton.disabled = false;
                streamButton.title = "Use Stream mode explicitly";
            }
        }
        applyStreamCleanup();
    }

    function scheduleSurfacePresentationChecks() {
        const generation = ++surfaceCheckGeneration;
        for (const delay of [0, 350, 900, 1800, 3500, 7000]) {
            setTimeout(() => {
                if (generation !== surfaceCheckGeneration) return;
                refreshSurfacePresentation();
            }, delay);
        }
    }

    async function refreshContext() {
        const previousSlot = context?.slotId || null;
        const previousFullscreen = context?.paneFullscreen === true;
        const next = await send("get-stream-shell-twitch-workspace-context").catch(() => ({ managed: false }));
        const normalized = next || { managed: false };
        const signature = JSON.stringify(normalized);
        const nextFullscreen = normalized?.paneFullscreen === true;
        const layoutChanged = previousSlot === normalized?.slotId && previousFullscreen !== nextFullscreen;
        context = normalized;
        if (signature === lastContextSignature) return;
        lastContextSignature = signature;
        if (layoutChanged) loadedPositionKey = null;
        await render();
        scheduleSurfacePresentationChecks();
        if (layoutChanged) settleHudAfterViewportChange(true);
    }

    function refreshAfterLocalNavigation() {
        setTimeout(() => refreshContext().catch(() => {}), 80);
        scheduleSurfacePresentationChecks();
    }

    function pulseCompositorSurface() {
        const host = document.documentElement || document.body;
        if (!host) return;

        const pulse = document.createElement("div");
        pulse.setAttribute("aria-hidden", "true");
        pulse.style.cssText = [
            "position:fixed",
            "left:0",
            "top:0",
            "width:1px",
            "height:1px",
            "opacity:0.001",
            "pointer-events:none",
            "z-index:2147483646",
            "transform:translate3d(0,0,0)",
            "will-change:transform"
        ].join(";");
        host.appendChild(pulse);
        void pulse.getBoundingClientRect();
        requestAnimationFrame(() => {
            pulse.style.transform = "translate3d(1px,0,0)";
            requestAnimationFrame(() => pulse.remove());
        });
    }

    chrome.runtime.onMessage.addListener(message => {
        if (message?.type !== "stream-shell-twitch-workspace-wake") return;
        pulseCompositorSurface();
    });

    async function start() {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            await refreshContext();
            if (context?.managed) break;
            await new Promise(resolve => setTimeout(resolve, 160 + attempt * 45));
        }
        if (!context?.managed) return;

        /* The background tracks Twitch SPA navigation through tabs/webNavigation
         * and updates the workspace record. popstate/hashchange are cheap local
         * fallbacks; the old 500 ms location.href poll is intentionally gone. */
        window.addEventListener("popstate", refreshAfterLocalNavigation);
        window.addEventListener("hashchange", refreshAfterLocalNavigation);

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") return;
            if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchWorkspaceV2") ||
                Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchPreventRaids")) {
                setTimeout(() => refreshContext().catch(() => {}), 80);
            }
        });
        window.addEventListener("focus", () => {
            refreshContext().catch(() => {});
            refreshSurfacePresentation();
        });
        window.addEventListener("load", scheduleSurfacePresentationChecks, { once: true });
        for (const eventName of ["playing", "loadedmetadata", "ended", "emptied"]) {
            document.addEventListener(eventName, () => {
                setTimeout(refreshSurfacePresentation, 120);
            }, true);
        }
        scheduleSurfacePresentationChecks();
        window.addEventListener("resize", () => {
            settleHudAfterViewportChange(true);
        });
        window.addEventListener("blur", () => {
            dragState = null;
            shadow?.querySelector?.(".hud")?.classList?.remove("dragging");
        });
    }

    start().catch(() => {});
})();
