/* Mangayomi bridge results arrive asynchronously after a native source scan.
 * This listener is specifically for the WIDE right-side Dashboard bundle. */
function streamShellDashboardMangayomiResults(data) {
    if (document.body?.dataset?.layoutProfile !== "compact") return;
    if (!data || !Array.isArray(data.sources)) return;
    const existing = document.getElementById("ss-mangayomi-source-results");
    existing?.remove();
    const panel = document.createElement("section");
    panel.id = "ss-mangayomi-source-results";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Mangayomi source search results");
    Object.assign(panel.style, {
        position:"fixed", top:"12%", left:"8%", right:"8%", bottom:"10%", zIndex:"2147483647",
        overflow:"auto", color:"#eee", background:"#111116", border:"1px solid #34343c",
        borderRadius:"18px", padding:"22px", boxShadow:"0 15px 70px #000a", fontSize:"14px"
    });
    const heading = document.createElement("h2");
    heading.textContent = `Mangayomi · ${data.query} · ${data.scannedCount}/${data.sourceCount} sources`;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "Close source results";
    close.style.cssText = "float:right;padding:4px 12px;color:inherit;background:transparent;border:1px solid #34343c;border-radius:9px;cursor:pointer";
    close.addEventListener("click", () => panel.remove());
    panel.append(close, heading);
    for (const source of data.sources) {
        const section = document.createElement("section");
        section.style.cssText = "padding:10px 0;border-top:1px solid #272730";
        const name = document.createElement("h3");
        const hits = Array.isArray(source.hits) ? source.hits : [];
        name.textContent = `${source.name || "Unknown source"} (${source.lang || "?"}) · ${source.status || "unknown"} · ${hits.length} hits`;
        section.append(name);
        for (const hit of hits) {
            const item = document.createElement("div");
            item.style.cssText = "padding:5px 10px;color:#d4d0d8";
            item.textContent = hit.title || "Untitled result";
            // Return source link as text only; search results do not verify a stream.
            if (hit.url) item.title = String(hit.url).slice(0, 1024);
            section.append(item);
        }
        panel.append(section);
    }
    if (data.truncatedSources) {
        const note = document.createElement("p");
        note.textContent = "Some sources were skipped by the bridge safety limit.";
        panel.append(note);
    }
    document.body.append(panel);
}


if (typeof chrome !== "undefined" && chrome.runtime?.onMessage?.addListener) {
    chrome.runtime.onMessage.addListener((message, sender) => {
        if (message?.type !== "stream-shell-mangayomi-source-results" ||
            sender?.id !== chrome.runtime.id) return;
        const data = message.data;
        if (!data?.ok || !Array.isArray(data.sources) || data.sources.length > 18 ||
            typeof data.query !== "string" || data.query.length > 200) return;
        streamShellDashboardMangayomiResults(data);
    });
}
