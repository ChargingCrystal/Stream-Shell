(() => {
    const ROOT_ID = "stream-shell-twitch-workspace-v2";
    const STYLE_ID = "stream-shell-twitch-workspace-v2-style";
    const CLEANUP_STYLE_ID = "stream-shell-twitch-workspace-v2-cleanup";

    let context = null;
    let root = null;
    let shadow = null;
    let locationTimer = null;
    let lastHref = location.href;
    let cleanupTimer = null;
    let lastContextSignature = "";

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
                gap: 6px;
                min-height: 34px;
                padding: 5px 6px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 11px;
                background: rgba(14,14,16,.82);
                box-shadow: 0 8px 26px rgba(0,0,0,.34);
                color: #efeff1;
                font: 12px/1.2 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                opacity: .24;
                transition: opacity .12s ease, background .12s ease;
                backdrop-filter: blur(8px);
            }
            .hud:hover, .hud:focus-within { opacity: 1; background: rgba(14,14,16,.96); }
            .slot {
                display: grid;
                place-items: center;
                width: 25px;
                height: 24px;
                border-radius: 7px;
                background: #772ce8;
                color: #fff;
                font-weight: 800;
                letter-spacing: .02em;
            }
            .label {
                max-width: 155px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 650;
            }
            .kind { color: rgba(239,239,241,.56); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
            .slot-switcher { display:flex; gap:3px; margin-right:2px; }
            .slot-switcher button { width:24px; padding:0; font-weight:750; }
            .slot-switcher button.active { border-color:#9147ff; background:rgba(145,70,255,.28); color:#fff; }
            .actions { display: flex; gap: 4px; margin-left: 2px; }
            button {
                height: 25px;
                padding: 0 8px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 7px;
                background: rgba(255,255,255,.06);
                color: rgba(255,255,255,.84);
                cursor: pointer;
            }
            button:hover { background: rgba(255,255,255,.13); color: #fff; }
            button.primary { border-color: rgba(169,112,255,.55); background: rgba(145,70,255,.22); }
            button.danger:hover { background: rgba(235,4,0,.25); }
            .editor {
                position: fixed;
                top: 52px;
                left: 10px;
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

    function removeCleanup() {
        document.getElementById(CLEANUP_STYLE_ID)?.remove();
        delete document.documentElement.dataset.streamShellTwitchWorkspaceClean;
    }

    function applyStreamCleanup() {
        if (context?.role !== "slot" || context?.kind !== "stream") {
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
            html[data-stream-shell-twitch-workspace-clean="true"],
            html[data-stream-shell-twitch-workspace-clean="true"] body {
                overflow: hidden !important;
                background: #000 !important;
            }
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="top-nav-container"],
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="top-nav"],
            html[data-stream-shell-twitch-workspace-clean="true"] .top-nav,
            html[data-stream-shell-twitch-workspace-clean="true"] .side-nav,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="side-nav"],
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="side-nav-bar"],
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root__right-column,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="right-column"],
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="right-column"],
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root__info,
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root__lower-watch,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-test-selector="channel-info-content"] {
                display: none !important;
            }
            html[data-stream-shell-twitch-workspace-clean="true"] main,
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root,
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root__player,
            html[data-stream-shell-twitch-workspace-clean="true"] .persistent-player,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="video-player"] {
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                max-width: none !important;
            }
            html[data-stream-shell-twitch-workspace-clean="true"] .channel-root__player,
            html[data-stream-shell-twitch-workspace-clean="true"] .persistent-player,
            html[data-stream-shell-twitch-workspace-clean="true"] [data-a-target="video-player"] {
                height: 100vh !important;
                max-height: none !important;
            }
        `;

        clearTimeout(cleanupTimer);
        cleanupTimer = setTimeout(() => {
            const theatre = document.querySelector('[data-a-target="player-theatre-mode-button"]');
            if (theatre instanceof HTMLElement && theatre.getAttribute("aria-pressed") !== "true") {
                theatre.click();
            }
        }, 900);
    }

    function renderSlotHud() {
        ensureHost();
        shadow.querySelectorAll(".hud,.editor").forEach(node => node.remove());

        const hud = document.createElement("div");
        hud.className = "hud";
        hud.innerHTML = `
            <span class="slot-switcher"></span>
            <span class="label"></span>
            <span class="kind"></span>
            <span class="actions">
                <button type="button" data-action="edit">Edit</button>
                <button type="button" data-action="mute" class="primary" aria-label="Toggle browser mute"></button>
                <button type="button" data-action="clear" class="danger">×</button>
            </span>
        `;
        const switcher = hud.querySelector(".slot-switcher");
        for (const slot of context.slots || []) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.slotTarget = slot.id;
            button.className = slot.id === context.slotId ? "active" : "";
            button.title = `${slot.id.toUpperCase()} · ${slot.label || slot.kind || "empty"}`;
            button.textContent = slot.id.toUpperCase();
            switcher.appendChild(button);
        }
        hud.querySelector(".label").textContent = context.label || context.channel || "Twitch";
        hud.querySelector(".kind").textContent = context.kind || "page";
        const muteButton = hud.querySelector('[data-action="mute"]');
        muteButton.textContent = context.muted ? "🔇" : "🔊";
        muteButton.title = context.muted ? "Unmute this Twitch slot" : "Mute this Twitch slot";
        muteButton.setAttribute("aria-label", muteButton.title);
        shadow.appendChild(hud);

        const editor = document.createElement("div");
        editor.className = "editor";
        editor.hidden = true;
        editor.innerHTML = `
            <div class="editor-row">
                <input type="text" spellcheck="false" autocomplete="off" aria-label="Twitch channel or URL">
            </div>
            <div class="editor-actions">
                <button type="button" data-action="save-auto" class="primary">Auto</button>
                <button type="button" data-action="save-stream">Stream</button>
                <button type="button" data-action="save-page">Page</button>
                <button type="button" data-action="cancel">Cancel</button>
            </div>
            <div class="error"></div>
        `;
        const input = editor.querySelector("input");
        input.value = context.url || "";
        shadow.appendChild(editor);

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
            const slotButton = event.target?.closest?.("button[data-slot-target]");
            if (slotButton) {
                event.preventDefault();
                event.stopPropagation();
                send("twitch-workspace-v2-focus-slot", { slotId: slotButton.dataset.slotTarget }).catch(() => {});
                return;
            }
            const button = event.target?.closest?.("button[data-action]");
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            const action = button.dataset.action;
            if (action === "edit") {
                editor.hidden = !editor.hidden;
                if (!editor.hidden) { input.focus(); input.select(); }
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
            } else if (action === "clear") {
                send("twitch-workspace-v2-clear-slot", { slotId: context.slotId }).catch(() => {});
            }
        };

        /* ShadowRoot is an EventTarget, not an HTMLElement. Assigning an
         * expando named `onclick` does not install the delegated click handler
         * Chromium uses for normal elements. Bind to the actual rendered nodes. */
        hud.addEventListener("click", handleActionClick);
        editor.addEventListener("click", handleActionClick);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                save(null);
            } else if (event.key === "Escape") {
                editor.hidden = true;
            }
        });
    }


    function render() {
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

        if (context.selected) {
            renderSlotHud();
        } else if (shadow) {
            shadow.querySelectorAll(".hud,.editor").forEach(node => node.remove());
        }
        applyStreamCleanup();
    }

    async function refreshContext() {
        const next = await send("get-stream-shell-twitch-workspace-context").catch(() => ({ managed: false }));
        const normalized = next || { managed: false };
        const signature = JSON.stringify(normalized);
        context = normalized;
        if (signature === lastContextSignature) return;
        lastContextSignature = signature;
        render();
    }

    function watchLocation() {
        clearInterval(locationTimer);
        locationTimer = setInterval(() => {
            if (location.href === lastHref) return;
            lastHref = location.href;
            setTimeout(() => refreshContext().catch(() => {}), 120);
        }, 500);
    }

    function pulseCompositorSurface() {
        const host = document.documentElement || document.body;
        if (!host) return;

        /* Chromium can leave an occluded popup with a stale/black compositor
         * surface after Dashboard/Discord covered it. A tiny transparent GPU-backed
         * DOM pulse requests fresh frames without focus, reload or player changes. */
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
        watchLocation();

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") return;
            if (Object.prototype.hasOwnProperty.call(changes, "streamShellTwitchWorkspaceV2")) {
                setTimeout(() => refreshContext().catch(() => {}), 80);
            }
        });
        window.addEventListener("focus", () => refreshContext().catch(() => {}));
    }

    start().catch(() => {});
})();
