(() => {
    const POSITION_KEY = "streamShellTwitchFloatingBarPosition";
    const WORKSPACE_STATE_KEY = "streamShellTwitchWorkspace";

    let context = null;
    let snapshot = null;
    let host = null;
    let shadow = null;
    let bar = null;
    let chips = null;
    let addPanel = null;
    let addInput = null;
    let addError = null;
    let workspace = null;
    let grid = null;
    let emptyState = null;
    let refreshTimer = null;
    let drag = null;
    let barPosition = null;

    const tiles = new Map();

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function request(type, payload = {}) {
        return chrome.runtime.sendMessage({ type, ...payload });
    }

    async function loadBarPosition() {
        try {
            const stored = await chrome.storage.local.get(POSITION_KEY);
            const raw = stored[POSITION_KEY];
            if (raw && Number.isFinite(raw.xRatio) && Number.isFinite(raw.y)) {
                barPosition = {
                    xRatio: clamp(raw.xRatio, 0.08, 0.92),
                    y: Math.max(8, raw.y)
                };
            }
        } catch {}

        if (!barPosition) {
            barPosition = { xRatio: 0.5, y: 68 };
        }
        applyBarPosition();
    }

    function applyBarPosition() {
        if (!bar || !barPosition) return;
        const width = bar.getBoundingClientRect().width || 600;
        const half = Math.min(width / 2, window.innerWidth / 2 - 8);
        const x = clamp(window.innerWidth * barPosition.xRatio, half + 8, window.innerWidth - half - 8);
        const maxY = Math.max(8, window.innerHeight - (bar.getBoundingClientRect().height || 48) - 8);
        const y = clamp(barPosition.y, 8, maxY);
        bar.style.left = `${x}px`;
        bar.style.top = `${y}px`;
    }

    async function saveBarPosition() {
        if (!barPosition) return;
        await chrome.storage.local.set({ [POSITION_KEY]: barPosition }).catch(() => {});
    }

    function styleText() {
        return `
            :host { all: initial; }
            * { box-sizing: border-box; }
            button, input { font: inherit; }
            .layer {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                pointer-events: none;
                font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                color: #f7f7f8;
            }
            .bar {
                position: fixed;
                transform: translateX(-50%);
                height: 48px;
                max-width: calc(100vw - 24px);
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 6px 8px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 15px;
                background: rgba(24,24,27,.96);
                box-shadow: 0 12px 34px rgba(0,0,0,.38);
                pointer-events: auto;
                user-select: none;
            }
            .drag {
                width: 28px;
                height: 34px;
                border: 0;
                border-radius: 9px;
                color: rgba(255,255,255,.58);
                background: transparent;
                cursor: grab;
                letter-spacing: -2px;
                font-size: 15px;
            }
            .drag:hover { background: rgba(255,255,255,.08); color: #fff; }
            .drag:active { cursor: grabbing; }
            .chips {
                display: flex;
                align-items: center;
                gap: 5px;
                min-width: 0;
                max-width: min(920px, calc(100vw - 430px));
                overflow-x: auto;
                scrollbar-width: none;
            }
            .chips::-webkit-scrollbar { display: none; }
            .chip {
                height: 34px;
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 10px;
                overflow: hidden;
                background: rgba(255,255,255,.045);
            }
            .chip.active {
                border-color: rgba(169,112,255,.62);
                background: rgba(145,70,255,.20);
            }
            .chip.main:not(.active) { border-color: rgba(169,112,255,.30); }
            .chip-open, .chip-close, .chip-tool {
                height: 100%;
                border: 0;
                color: rgba(255,255,255,.82);
                background: transparent;
                cursor: pointer;
            }
            .chip-open {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 0 11px;
                white-space: nowrap;
                max-width: 180px;
            }
            .chip-open:hover, .chip-close:hover { background: rgba(255,255,255,.09); color: #fff; }
            .chip-label { overflow: hidden; text-overflow: ellipsis; }
            .kind { font-size: 10px; opacity: .72; }
            .kind.stream { color: #bf94ff; }
            .chip-close, .chip-tool {
                width: 28px;
                padding: 0;
                border-left: 1px solid rgba(255,255,255,.08);
                font-size: 13px;
            }
            .chip-tool.active {
                color: #fff;
                background: rgba(145,70,255,.22);
            }
            .bar[hidden] { display: none; }
            .add, .layout-button {
                height: 34px;
                min-width: 34px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 10px;
                background: rgba(255,255,255,.045);
                color: rgba(255,255,255,.82);
                cursor: pointer;
            }
            .add:hover, .layout-button:hover { background: rgba(255,255,255,.10); color: #fff; }
            .add { font-size: 21px; line-height: 1; }
            .layout-group {
                display: flex;
                gap: 3px;
                padding-left: 3px;
                border-left: 1px solid rgba(255,255,255,.10);
            }
            .layout-button {
                min-width: 30px;
                padding: 0 8px;
                font-size: 12px;
            }
            .layout-button.active {
                color: #fff;
                border-color: rgba(169,112,255,.58);
                background: rgba(145,70,255,.22);
            }
            .add-panel {
                position: fixed;
                width: 360px;
                padding: 12px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 13px;
                background: #18181b;
                box-shadow: 0 16px 42px rgba(0,0,0,.44);
                pointer-events: auto;
            }
            .add-panel[hidden] { display: none; }
            .add-row { display: flex; gap: 7px; }
            .add-panel input {
                width: 100%;
                height: 38px;
                padding: 0 11px;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 9px;
                outline: none;
                background: #0e0e10;
                color: #fff;
            }
            .add-panel input:focus { border-color: #9147ff; box-shadow: 0 0 0 1px #9147ff; }
            .add-actions { display: flex; gap: 7px; margin-top: 9px; }
            .add-actions button {
                height: 34px;
                flex: 1;
                border: 1px solid rgba(255,255,255,.11);
                border-radius: 9px;
                background: rgba(255,255,255,.06);
                color: #fff;
                cursor: pointer;
            }
            .add-actions button.primary { background: #772ce8; border-color: #9147ff; }
            .add-actions button:hover { filter: brightness(1.12); }
            .add-hint { margin-top: 8px; color: rgba(255,255,255,.52); font-size: 11px; line-height: 1.35; }
            .add-error { min-height: 16px; margin-top: 7px; color: #ff8280; font-size: 11px; }
            .workspace {
                position: fixed;
                inset: 0;
                background: #0e0e10;
                pointer-events: auto;
            }
            .workspace[hidden] { display: none; }
            .grid {
                position: absolute;
                inset: 0;
                display: grid;
                gap: 3px;
                padding: 3px;
                background: #050506;
            }
            .tile {
                position: relative;
                min-width: 0;
                min-height: 0;
                overflow: hidden;
                background: #000;
                border: 1px solid rgba(255,255,255,.08);
            }
            .tile.main { border-color: rgba(145,70,255,.75); }
            .tile iframe { width: 100%; height: 100%; border: 0; display: block; background: #000; }
            .tile-tools {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 5;
                max-width: calc(100% - 20px);
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 4px 5px 4px 10px;
                border-radius: 9px;
                background: rgba(14,14,16,.86);
                opacity: .18;
                transition: opacity .12s ease;
            }
            .tile:hover .tile-tools { opacity: 1; }
            .tile-name { max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 650; }
            .tile-tools button {
                width: 27px;
                height: 27px;
                border: 0;
                border-radius: 7px;
                background: transparent;
                color: #fff;
                cursor: pointer;
            }
            .tile-tools button:hover { background: rgba(255,255,255,.12); }
            .empty {
                position: absolute;
                inset: 0;
                display: grid;
                place-items: center;
                text-align: center;
                color: rgba(255,255,255,.58);
            }
            .empty[hidden] { display: none; }
            .empty strong { display: block; margin-bottom: 8px; color: #fff; font-size: 20px; }
            .empty button {
                margin-top: 14px;
                height: 36px;
                padding: 0 14px;
                border: 1px solid #9147ff;
                border-radius: 9px;
                background: #772ce8;
                color: #fff;
                cursor: pointer;
            }
            .layout-single .tile:not(.main) { display: none; }
            .layout-single { grid-template-columns: 1fr; grid-template-rows: 1fr; }
            .layout-split { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); }
            .layout-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); }
            .layout-grid.many { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .layout-focus { grid-template-columns: minmax(0, 3fr) minmax(300px, 1fr); }
            .layout-focus .tile.main { grid-column: 1; grid-row: 1 / -1; }
            @media (max-width: 1100px) {
                .chips { max-width: calc(100vw - 360px); }
                .layout-focus { grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); }
            }
        `;
    }

    function ensureUi() {
        if (host?.isConnected) return;
        const mount = document.documentElement || document.body;
        if (!mount) return;

        host = document.createElement("div");
        host.id = "stream-shell-twitch-workspace-ui";
        shadow = host.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = styleText();
        shadow.appendChild(style);

        const layer = document.createElement("div");
        layer.className = "layer";
        layer.innerHTML = `
            <div class="workspace" hidden>
                <div class="grid"></div>
                <div class="empty" hidden>
                    <div>
                        <strong>No Twitch tiles yet</strong>
                        Add a stream or Twitch page, then use Native Tile to arrange up to four real windows.
                        <br><button type="button" data-action="open-add">+ Add stream</button>
                    </div>
                </div>
            </div>
            <div class="bar" aria-label="Stream Shell Twitch workspace">
                <button class="drag" type="button" title="Move workspace bar" aria-label="Move workspace bar">⋮⋮</button>
                <div class="chips"></div>
                <button class="add" type="button" data-action="open-add" title="Add Twitch instance" aria-label="Add Twitch instance">+</button>
                <div class="layout-group" aria-label="Multi-view layout">
                    <button class="layout-button" type="button" data-action="layout" data-layout="1" title="1 visible tile">1</button>
                    <button class="layout-button" type="button" data-action="layout" data-layout="2" title="2 visible tiles">2</button>
                    <button class="layout-button" type="button" data-action="layout" data-layout="3" title="3 visible tiles">3</button>
                    <button class="layout-button" type="button" data-action="layout" data-layout="4" title="4 visible tiles">4</button>
                </div>
            </div>
            <div class="add-panel" hidden>
                <div class="add-row"><input type="text" autocomplete="off" spellcheck="false" placeholder="Channel or twitch.tv URL"></div>
                <div class="add-actions">
                    <button type="button" class="primary" data-action="add-stream">Add stream</button>
                    <button type="button" data-action="add-page">Add page</button>
                </div>
                <div class="add-hint">Stream = managed Twitch player window · Page = real logged-in Twitch page window · Native Tile supports up to 4 visible windows.</div>
                <div class="add-error"></div>
            </div>
        `;
        shadow.appendChild(layer);
        mount.appendChild(host);

        bar = shadow.querySelector(".bar");
        chips = shadow.querySelector(".chips");
        addPanel = shadow.querySelector(".add-panel");
        addInput = shadow.querySelector(".add-panel input");
        addError = shadow.querySelector(".add-error");
        workspace = shadow.querySelector(".workspace");
        grid = shadow.querySelector(".grid");
        emptyState = shadow.querySelector(".empty");

        shadow.addEventListener("click", handleClick);
        addInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addFromInput("stream");
            } else if (event.key === "Escape") {
                closeAddPanel();
            }
        });
        shadow.addEventListener("pointerdown", startDrag);
        window.addEventListener("resize", applyBarPosition, { passive: true });
        loadBarPosition();
    }

    function makeChip(instance) {
        const shell = document.createElement("div");
        shell.className = "chip";
        const isActive = snapshot?.selectedInstanceId === instance.id;
        const isMain = snapshot?.mainInstanceId === instance.id;
        if (isActive) shell.classList.add("active");
        if (isMain) shell.classList.add("main");

        const open = document.createElement("button");
        open.type = "button";
        open.className = "chip-open";
        open.dataset.action = instance.type === "embed" ? "open-stream" : "open-page";
        open.dataset.instanceId = instance.id;
        open.title = instance.type === "embed"
            ? (snapshot?.clusterActive ? `Select ${instance.channel} inside Native Tile` : `Show ${instance.channel}`)
            : (snapshot?.clusterActive ? `Select ${instance.label || "Twitch page"} inside Native Tile` : String(instance.url || instance.label || "Twitch page"));

        const kind = document.createElement("span");
        kind.className = `kind ${instance.type === "embed" ? "stream" : "page"}`;
        kind.textContent = instance.type === "embed" ? "●" : "▤";
        const label = document.createElement("span");
        label.className = "chip-label";
        label.textContent = instance.label || instance.channel || "Twitch";
        open.append(kind, label);
        shell.appendChild(open);

        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "chip-tool";
        if (instance.tiled === true) tile.classList.add("active");
        tile.dataset.action = "toggle-tile";
        tile.dataset.instanceId = instance.id;
        tile.dataset.tiled = instance.tiled === true ? "true" : "false";
        tile.title = instance.tiled === true ? "Remove from Native Tile" : "Include in Native Tile";
        tile.textContent = "▦";
        shell.appendChild(tile);

        const mute = document.createElement("button");
        mute.type = "button";
        mute.className = "chip-tool";
        mute.dataset.action = "toggle-mute";
        mute.dataset.instanceId = instance.id;
        mute.dataset.muted = instance.muted === true ? "true" : "false";
        mute.title = instance.muted === true
            ? "Unmute at browser level"
            : "Mute at browser level";
        mute.textContent = instance.muted === true ? "🔇" : "🔊";
        shell.appendChild(mute);

        if (instance.pinned !== true) {
            const close = document.createElement("button");
            close.type = "button";
            close.className = "chip-close";
            close.dataset.action = "close-instance";
            close.dataset.instanceId = instance.id;
            close.title = "Close instance";
            close.textContent = "×";
            shell.appendChild(close);
        }

        return shell;
    }

    function renderBar() {
        if (!chips || !snapshot) return;

        if (bar) {
            /*
             * Browser focus is the local source of truth for floating-bar
             * ownership. Runtime activeWindowId propagation can lag behind a
             * native focus change by a storage/event turn, which previously
             * allowed two overlapping Twitch windows to render the bar at once.
             */
            bar.hidden = !document.hasFocus();
        }

        chips.replaceChildren();

        const multi = document.createElement("div");
        multi.className = "chip";
        if (snapshot.clusterActive) multi.classList.add("active");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip-open";
        button.dataset.action = "toggle-workspace";
        button.title = snapshot.clusterActive ? "Leave Native Tile mode" : "Open selected Twitch instances in Native Tile mode";
        button.innerHTML = `<span class="kind stream">▦</span><span class="chip-label">Multi</span>`;
        multi.appendChild(button);
        chips.appendChild(multi);

        const ordered = Array.isArray(snapshot.order) ? snapshot.order : [];
        for (const id of ordered) {
            const instance = snapshot.instances?.find(item => item.id === id);
            if (instance) chips.appendChild(makeChip(instance));
        }

        const visibleCount = snapshot.clusterActive
            ? Math.max(1, Math.min(4, Number(snapshot.visibleTileCount) || (snapshot.tiledInstanceIds || []).length || 1))
            : 0;
        for (const button of shadow.querySelectorAll(".layout-button")) {
            button.classList.toggle("active", snapshot.clusterActive && Number(button.dataset.layout) === visibleCount);
        }
        requestAnimationFrame(applyBarPosition);
    }

    function playerUrl(instance) {
        const params = new URLSearchParams();
        params.set("channel", instance.channel);
        params.append("parent", location.hostname || "www.twitch.tv");
        params.set("autoplay", "true");
        // Stream Shell mutes the containing Chromium tab, not Twitch's player UI.
        params.set("muted", "false");
        return `https://player.twitch.tv/?${params.toString()}`;
    }

    function createTile(instance) {
        const tile = document.createElement("section");
        tile.className = "tile";
        tile.dataset.instanceId = instance.id;
        tile.dataset.channel = instance.channel;

        const iframe = document.createElement("iframe");
        iframe.src = playerUrl(instance);
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.title = `Twitch stream ${instance.channel}`;

        const tools = document.createElement("div");
        tools.className = "tile-tools";
        const name = document.createElement("span");
        name.className = "tile-name";
        name.textContent = instance.label || instance.channel;
        tools.appendChild(name);

        for (const [action, title, text] of [
            ["mute-stream", instance.muted === true ? "Unmute at browser level" : "Mute at browser level", instance.muted === true ? "🔇" : "🔊"],
            ["reload-stream", "Reload stream", "↻"],
            ["close-instance", "Close stream", "×"]
        ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.action = action;
            button.dataset.instanceId = instance.id;
            button.title = title;
            button.textContent = text;
            tools.appendChild(button);
        }

        tile.append(iframe, tools);
        tiles.set(instance.id, tile);
        return tile;
    }

    function renderWorkspace() {
        if (!workspace || !snapshot || !context) return;
        const isHost = context.type === "embed" && context.role === "stream" && context.instanceId;
        workspace.hidden = !isHost;
        if (!isHost) return;

        const instance = (snapshot.instances || []).find(item =>
            item.id === context.instanceId && item.type === "embed"
        ) || null;
        if (instance) {
            const desiredTitle = `${instance.label || instance.channel} · Stream Shell Twitch`;
            if (document.title !== desiredTitle) document.title = desiredTitle;
        }
        const embeds = instance ? [instance] : [];
        const ids = new Set(embeds.map(item => item.id));

        for (const [id, tile] of tiles) {
            if (!ids.has(id)) {
                tile.remove();
                tiles.delete(id);
            }
        }

        for (const current of embeds) {
            let tile = tiles.get(current.id);
            if (!tile) {
                tile = createTile(current);
                grid.appendChild(tile);
            }

            if (tile.dataset.channel !== current.channel) {
                tile.dataset.channel = current.channel;
                const iframe = tile.querySelector("iframe");
                if (iframe) iframe.src = playerUrl(current);
            }
            const name = tile.querySelector(".tile-name");
            if (name) name.textContent = current.label || current.channel;
            tile.classList.toggle("main", snapshot.mainInstanceId === current.id);

            const mute = tile.querySelector('button[data-action="mute-stream"]');
            if (mute) {
                mute.textContent = current.muted === true ? "🔇" : "🔊";
                mute.title = current.muted === true ? "Unmute at browser level" : "Mute at browser level";
                mute.dataset.muted = current.muted === true ? "true" : "false";
            }
        }

        grid.className = "grid layout-single";
        grid.style.gridTemplateRows = "";
        emptyState.hidden = embeds.length !== 0;
    }

    function placeAddPanel() {
        if (!addPanel || !bar) return;
        const rect = bar.getBoundingClientRect();
        const width = 360;
        const left = clamp(rect.right - width, 8, window.innerWidth - width - 8);
        const below = rect.bottom + 8;
        const height = addPanel.getBoundingClientRect().height || 150;
        const top = below + height <= window.innerHeight - 8
            ? below
            : Math.max(8, rect.top - height - 8);
        addPanel.style.left = `${left}px`;
        addPanel.style.top = `${top}px`;
    }

    function openAddPanel() {
        if (!addPanel) return;
        addPanel.hidden = false;
        addError.textContent = "";
        requestAnimationFrame(() => {
            placeAddPanel();
            addInput.focus();
            addInput.select();
        });
    }

    function closeAddPanel() {
        if (!addPanel) return;
        addPanel.hidden = true;
        addError.textContent = "";
    }

    async function addFromInput(kind) {
        const input = String(addInput?.value || "").trim();
        if (!input) {
            addError.textContent = "Enter a channel name or Twitch URL.";
            return;
        }

        addError.textContent = "";
        const type = kind === "page" ? "twitch-workspace-add-page" : "twitch-workspace-add-stream";
        try {
            const response = await request(type, { input, active: true });
            if (!response?.ok) throw new Error(response?.error || "Could not add Twitch instance.");
            addInput.value = "";
            closeAddPanel();
            scheduleRefresh(true);
        } catch (error) {
            addError.textContent = String(error?.message || error || "Could not add Twitch instance.");
        }
    }

    async function handleClick(event) {
        const button = event.target?.closest?.("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const instanceId = button.dataset.instanceId || "";

        if (action === "open-add") {
            if (addPanel.hidden) openAddPanel(); else closeAddPanel();
            return;
        }
        if (action === "add-stream") return addFromInput("stream");
        if (action === "add-page") return addFromInput("page");

        try {
            if (action === "toggle-workspace") {
                await request("twitch-workspace-toggle");
            } else if (action === "open-page" || action === "open-stream") {
                await request("twitch-workspace-select-instance", { instanceId });
            } else if (action === "toggle-tile") {
                await request("twitch-workspace-set-tiled", {
                    instanceId,
                    tiled: button.dataset.tiled !== "true"
                });
            } else if (action === "toggle-mute" || action === "mute-stream") {
                await request("twitch-workspace-set-muted", {
                    instanceId,
                    muted: button.dataset.muted !== "true"
                });
            } else if (action === "close-instance") {
                await request("twitch-workspace-close-instance", { instanceId });
            } else if (action === "layout") {
                await request("twitch-workspace-set-layout", { layout: button.dataset.layout });
            } else if (action === "main-stream") {
                await request("twitch-workspace-set-main", { instanceId });
            } else if (action === "reload-stream") {
                await request("twitch-workspace-reload-instance", { instanceId });
            }
            scheduleRefresh(true);
        } catch {}
    }

    function startDrag(event) {
        const handle = event.target?.closest?.(".drag");
        if (!handle || event.button !== 0 || !bar) return;
        event.preventDefault();
        const rect = bar.getBoundingClientRect();
        drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: rect.left + rect.width / 2,
            y: rect.top
        };
        handle.setPointerCapture?.(event.pointerId);
        shadow.addEventListener("pointermove", moveDrag);
        shadow.addEventListener("pointerup", endDrag);
        shadow.addEventListener("pointercancel", endDrag);
    }

    function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId || !bar) return;
        const width = bar.getBoundingClientRect().width || 600;
        const half = Math.min(width / 2, window.innerWidth / 2 - 8);
        const x = clamp(drag.x + event.clientX - drag.startX, half + 8, window.innerWidth - half - 8);
        const y = clamp(drag.y + event.clientY - drag.startY, 8, window.innerHeight - (bar.getBoundingClientRect().height || 48) - 8);
        barPosition = { xRatio: x / Math.max(1, window.innerWidth), y };
        applyBarPosition();
        if (!addPanel.hidden) placeAddPanel();
    }

    function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag = null;
        shadow.removeEventListener("pointermove", moveDrag);
        shadow.removeEventListener("pointerup", endDrag);
        shadow.removeEventListener("pointercancel", endDrag);
        saveBarPosition();
    }

    async function refresh(forceContext = false) {
        if (forceContext || !context?.managed) {
            context = await request("get-stream-shell-twitch-instance-context").catch(() => ({ managed: false }));
        }
        if (!context?.managed) {
            host?.remove();
            host = shadow = bar = chips = addPanel = addInput = addError = workspace = grid = emptyState = null;
            return false;
        }

        ensureUi();
        if (!host) return false;

        const response = await request("twitch-workspace-get-state").catch(() => null);
        if (!response?.ok || !response.state) return false;
        snapshot = response.state;
        renderBar();
        renderWorkspace();
        return true;
    }

    function scheduleRefresh(forceContext = false) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refresh(forceContext).catch(() => {});
        }, 100);
    }

    async function start() {
        for (let attempt = 0; attempt < 16; attempt += 1) {
            context = await request("get-stream-shell-twitch-instance-context").catch(() => ({ managed: false }));
            if (context?.managed) break;
            await new Promise(resolve => setTimeout(resolve, 180 + attempt * 60));
        }
        if (!context?.managed) return;

        if (!document.documentElement) {
            await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
        }
        await refresh(false);

        chrome.storage.onChanged.addListener((changes, areaName) => {
            /*
             * Runtime window/tab identity changes are intentionally ignored by
             * the UI. Every Twitch document used to react to each session write
             * by asking the background to reconcile every other Twitch window,
             * creating a refresh storm as the cluster grew. Logical workspace
             * changes are enough to redraw chips/layout controls; focus performs
             * an explicit lightweight catch-up for the active document.
             */
            if (
                areaName === "local" &&
                Object.prototype.hasOwnProperty.call(changes, WORKSPACE_STATE_KEY)
            ) {
                scheduleRefresh(false);
            }
            if (areaName === "local" && Object.prototype.hasOwnProperty.call(changes, POSITION_KEY)) {
                const next = changes[POSITION_KEY]?.newValue;
                if (next && Number.isFinite(next.xRatio) && Number.isFinite(next.y) && !drag) {
                    barPosition = next;
                    applyBarPosition();
                }
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                scheduleRefresh(true);
            } else if (bar) {
                bar.hidden = true;
            }
        });
        window.addEventListener("focus", () => {
            scheduleRefresh(true);
            /* Active-window storage catches up just after native focus. */
            setTimeout(() => scheduleRefresh(false), 180);
        });
        window.addEventListener("blur", () => {
            if (bar) bar.hidden = true;
            closeAddPanel();
        });
    }

    start().catch(() => {});
})();
