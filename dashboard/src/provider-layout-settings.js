/* Settings-only layout previews. Both surfaces write the existing registry order. */
function settingsProviderDragHandle(id, surface, label) {
    return `<button type="button" class="ss-provider-drag" draggable="true"
        data-ss-drag="${escapeSettingsHtml(id)}" data-ss-order-surface="${surface}"
        aria-label="Reorder ${escapeSettingsHtml(label)}" title="Drag to reorder · Alt + arrow keys">⠿</button>`;
}
function settingsProviderPreviewContent(provider, surface) {
    const label = provider.id === "youtube-music" ? "Music" : provider.name;
    const path = surface === "titlebar"
        ? (provider.kind === "custom" ? streamShellNativeCustomIconPath(provider.artKey) : `native/titlebar-icons/${provider.id}.png`)
        : provider.kind === "custom"
        ? streamShellCustomArtworkPath(provider.artKey,"icon")
        : `assets/providers/icons/${provider.id}.svg`;
    const icon = path ? `<img src="${escapeSettingsHtml(chrome.runtime.getURL(path))}" alt="" draggable="false">` :
        `<span class="ss-preview-initials">${escapeSettingsHtml(provider.icon || provider.name.slice(0,2))}</span>`;
    return icon + `<span>${escapeSettingsHtml(label)}</span>`;
}
function renderSettingsProviderPreview(registry, surface) {
    const lookup = new Map(registry.providers.map(p=>[p.id,p]));
    const allowed = p => p && p.enabled && (p.id !== "mangayomi" || settingsValues.streamShellSevenSeasAcknowledged === true);
    const groups = surface === "dashboard" ? streamShellDashboardGroups(streamShellPinnedProviders(registry)) :
        registry.titlebarOrder.map(id=>lookup.get(id)).filter(p=>allowed(p) && p.showInTitlebar).map(p=>[p]);
    const tile = group => {
        const first=group[0], id=first.id;
        const color=streamShellValidatedTitlebarColor(first.titlebarColor);
        return `<button type="button" draggable="true" class="ss-layout-tile ${group.length===2?"ss-layout-tile-split":""}"
            data-ss-drag="${id}" data-ss-order-item="${id}" data-ss-order-surface="${surface}"
            ${color && surface==="titlebar" ? `style="--preview-tint:${color}"` : ""}
            aria-label="Reorder ${escapeSettingsHtml(group.map(p=>p.name).join(" and "))}" title="Drag to reorder · Alt + arrow keys">
            ${group.map(p=>`<span class="ss-layout-segment">${settingsProviderPreviewContent(p, surface)}</span>`).join("")}
        </button>`;
    };
    let content;
    if(surface==="dashboard") {
        let index=0;
        content=(STREAM_SHELL_PROVIDER_GRID_PATTERNS[groups.length] || []).map(count=>
            `<div class="ss-layout-preview-row" data-columns="${count}">${Array.from({length:count},()=>tile(groups[index++])).join("")}</div>`).join("");
    } else content=groups.map(tile).join("");
    return `<div class="ss-layout-preview ss-layout-preview-${surface}" aria-label="${surface} layout preview">
        <div class="ss-layout-preview-heading">${surface==="dashboard"?"Dashboard layout":"Titlebar layout"}<span>Drag to arrange</span></div>
        <div class="ss-layout-preview-canvas">${content || '<span class="ss-layout-empty">Select providers above to build this layout.</span>'}</div>
        <span class="ss-reorder-status" role="status" aria-live="polite"></span>
    </div>`;
}
function reorderSettingsProviders(registry, surface, sourceId, targetId, after=false) {
    if(!["dashboard","titlebar"].includes(surface)) return registry;
    const key=surface==="dashboard"?"dashboardOrder":"titlebarOrder";
    let order=registry[key];
    if(!order.includes(sourceId) || !order.includes(targetId) || sourceId===targetId) return registry;
    const paired=surface==="dashboard" && ["youtube","youtube-music"].every(id=>{
        const p=registry.providers.find(p=>p.id===id);
        return p?.enabled && p.showOnDashboard;
    });
    // Canonicalize the shared slot even when old list ordering separated Music.
    if (paired) {
        order=order.filter(id=>id!=="youtube-music");
        order.splice(order.indexOf("youtube")+1,0,"youtube-music");
    }
    const members=id=>paired && ["youtube","youtube-music"].includes(id)?["youtube","youtube-music"]:[id];
    const moving=members(sourceId), target=members(targetId);
    if(target.some(id=>moving.includes(id)))return registry;
    const remaining=order.filter(id=>!moving.includes(id));
    const positions=target.map(id=>remaining.indexOf(id)).filter(index=>index>=0);
    const index=after?Math.max(...positions)+1:Math.min(...positions);
    remaining.splice(index,0,...moving);
    return {...registry,[key]:remaining};
}
let settingsProviderDrag = null;
function clearSettingsProviderDrop() {
    document.querySelectorAll(".ss-drop-before,.ss-drop-after,.ss-dragging").forEach(el=>{
        el.classList.remove("ss-drop-before","ss-drop-after","ss-dragging");
    });
}
function saveSettingsProviderDrop(surface,source,target,after) {
    return updateStreamShellProviderRegistry(registry=>reorderSettingsProviders(registry,surface,source,target,after))
        .then(()=>{
            const status=document.querySelector(`.ss-layout-preview-${surface} .ss-reorder-status`);
            if(status)status.textContent="Order saved";
        }).catch(error=>{
            const status=document.querySelector(`.ss-layout-preview-${surface} .ss-reorder-status`);
            if(status)status.textContent="Unable to save order: "+error.message;
        });
}
document.addEventListener("dragstart",event=>{
    const handle=event.target.closest?.("[data-ss-drag]");
    if(!handle)return;
    settingsProviderDrag={id:handle.dataset.ssDrag,surface:handle.dataset.ssOrderSurface};
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",settingsProviderDrag.id);
    handle.classList.add("ss-dragging");
});
document.addEventListener("dragover",event=>{
    const target=event.target.closest?.("[data-ss-order-item]");
    if(!target || !settingsProviderDrag || target.dataset.ssOrderSurface!==settingsProviderDrag.surface)return;
    event.preventDefault(); event.dataTransfer.dropEffect="move";
    const rect=target.getBoundingClientRect();
    const horizontal=target.classList.contains("ss-layout-tile");
    const after=horizontal?event.clientX>rect.left+rect.width/2:event.clientY>rect.top+rect.height/2;
    document.querySelectorAll(".ss-drop-before,.ss-drop-after").forEach(el=>el.classList.remove("ss-drop-before","ss-drop-after"));
    target.classList.add(after?"ss-drop-after":"ss-drop-before");
});
document.addEventListener("drop",event=>{
    const target=event.target.closest?.("[data-ss-order-item]");
    if(!target || !settingsProviderDrag || target.dataset.ssOrderSurface!==settingsProviderDrag.surface)return;
    event.preventDefault();
    const drag=settingsProviderDrag;
    const after=target.classList.contains("ss-drop-after");
    settingsProviderDrag=null;clearSettingsProviderDrop();
    saveSettingsProviderDrop(drag.surface,drag.id,target.dataset.ssOrderItem,after);
});
document.addEventListener("dragend",()=>{settingsProviderDrag=null;clearSettingsProviderDrop();});
document.addEventListener("keydown",event=>{
    const handle=event.target.closest?.("[data-ss-drag]");
    if(!handle || !event.altKey || !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))return;
    event.preventDefault();
    const surface=handle.dataset.ssOrderSurface,id=handle.dataset.ssDrag;
    const registry=getStreamShellProviderRegistry();
    const order=registry[surface==="dashboard"?"dashboardOrder":"titlebarOrder"];
    const step=["ArrowDown","ArrowRight"].includes(event.key)?1:-1;
    let index=order.indexOf(id)+step;
    while(index>=0 && index<order.length) {
        const next=reorderSettingsProviders(registry,surface,id,order[index],step>0);
        if(next!==registry) {
            saveSettingsProviderDrop(surface,id,order[index],step>0).then(()=>{
                document.querySelector(`[data-ss-drag="${id}"][data-ss-order-surface="${surface}"]`)?.focus();
            });break;
        }
        index+=step;
    }
});
document.addEventListener("error",event=>{
    if(event.target.matches?.(".ss-layout-tile img"))event.target.hidden=true;
},true);

// Observe only the preview width; keep the existing draggable button nodes.
let settingsTitlebarPreviewObserver = null;
function settingsTitlebarRowCapacity(width) {
    return Math.max(1, Math.floor((width - 60) / 110));
}
function syncSettingsTitlebarPreview() {
    settingsTitlebarPreviewObserver?.disconnect();
    settingsTitlebarPreviewObserver = null;
    const canvas = document.querySelector(".ss-layout-preview-titlebar .ss-layout-preview-canvas");
    if (!canvas) return;
    const tiles = Array.from(canvas.querySelectorAll(".ss-layout-tile"));
    if (!tiles.length) return;
    let previousCapacity = 0;
    const arrange = () => {
        const width = canvas.clientWidth;
        if (!width) return;
        const capacity = settingsTitlebarRowCapacity(width);
        if (capacity === previousCapacity) return;
        previousCapacity = capacity;
        const focused = document.activeElement;
        const fragment = document.createDocumentFragment();
        const marker = () => {
            const span = document.createElement("span");
            span.className = "ss-titlebar-continuation";
            span.textContent = "…";
            span.setAttribute("aria-hidden", "true");
            return span;
        };
        for (let start = 0; start < tiles.length; start += capacity) {
            const row = document.createElement("div");
            row.className = "ss-titlebar-preview-line";
            if (start) row.append(marker());
            tiles.slice(start, start + capacity).forEach(tile => row.append(tile));
            if (start + capacity < tiles.length) row.append(marker());
            fragment.append(row);
        }
        canvas.replaceChildren(fragment);
        if (tiles.includes(focused)) focused.focus({preventScroll:true});
    };
    arrange();
    if (typeof ResizeObserver !== "undefined") {
        settingsTitlebarPreviewObserver = new ResizeObserver(arrange);
        settingsTitlebarPreviewObserver.observe(canvas);
    }
}
