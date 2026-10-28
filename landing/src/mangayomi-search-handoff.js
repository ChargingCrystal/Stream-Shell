/*
 * Mangayomi native search handoff and inline results.
 * Normal click queries opted-in installed sources in the background and renders
 * real results in the LEFT panel. Shift+click copies the title and switches to Mangayomi.
 * Selecting an opaque hit opens the corresponding Mangayomi detail in the fork.
 */
const STREAM_SHELL_MANGAYOMI_SEARCH_TYPES = new Set(["anime", "manga", "novel"]);

function streamShellMangayomiSearchTitle(title, mediaType) {
    if (!STREAM_SHELL_MANGAYOMI_SEARCH_TYPES.has(mediaType)) return "";
    if (typeof title !== "string") return "";
    return title.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 200);
}

async function streamShellCopyMangayomiTitle(title) {
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(title); return true; }
        catch { /* Try the legacy extension-page fallback. */ }
    }
    const field = document.createElement("textarea");
    field.value = title;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(field);
    try { field.focus(); field.select(); return document.execCommand("copy") === true; }
    catch { return false; }
    finally { field.remove(); }
}

function streamShellRenderMangayomiSourceResults(data) {
    if (!data?.ok || !Array.isArray(data.sources)) return;
    // This is a normal Search-panel view, never a floating window.
    openPanel("search");
    mediaPanelSubtitle.textContent = `${data.scannedCount ?? data.sources.length}/${data.sourceCount ?? data.sources.length} Mangayomi sources · ${data.sources.reduce((n, s) => n + (s.hits?.length || 0), 0)} results`;
    const root = document.createElement("div");
    root.className = "ss-mangayomi-results";
    const heading = document.createElement("div");
    heading.className = "ss-mangayomi-results-header";
    const title = document.createElement("strong");
    title.textContent = `Mangayomi · ${data.query}`;
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "← Back to search";
    back.addEventListener("click", () => {
        if (typeof scheduleSearch === "function") scheduleSearch(true);
        else closePanel();
    });
    heading.append(title, back);
    root.append(heading);
    const normalize = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const needle = normalize(data.query);
    for (const source of data.sources) {
        const hits = Array.isArray(source.hits) ? source.hits.slice(0, 12) : [];
        const group = document.createElement("details");
        group.className = "ss-mangayomi-source";
        group.open = hits.length > 0;
        const summary = document.createElement("summary");
        summary.textContent = `${source.name || "Unknown source"} · ${source.lang || "?"} · ${hits.length} results${source.status !== "ok" ? ` · ${source.status || "unknown"}` : ""}`;
        group.append(summary);
        hits.sort((x, y) => Number(normalize(y.title) === needle) - Number(normalize(x.title) === needle));
        for (const hit of hits) {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "ss-mangayomi-hit";
            const label = document.createElement("span");
            label.className = "ss-mangayomi-hit-text";
            const name = document.createElement("strong");
            name.textContent = hit.title || "Untitled";
            const meta = document.createElement("small");
            meta.textContent = normalize(hit.title) === needle ? "Exact title match" : "View source result";
            label.append(name, meta);
            if (typeof hit.imageUrl === "string" && /^https?:\/\//i.test(hit.imageUrl)) {
                const img = document.createElement("img");
                img.src = hit.imageUrl;
                img.alt = "";
                img.loading = "lazy";
                img.referrerPolicy = "no-referrer";
                row.append(img);
            }
            row.append(label);
            row.addEventListener("click", () => {
                // Explicit selection: only the opaque result ID may navigate.
                // Never pass source URLs to the Win32 helper.
                const selected = document.createElement("div");
                selected.className = "ss-mangayomi-selected";
                const chosen = document.createElement("strong");
                chosen.textContent = hit.title || "Untitled";
                const sourceName = document.createElement("p");
                sourceName.textContent = `Source: ${source.name || "Unknown"} · ${source.lang || "?"}`;
                const notice = document.createElement("p");
                notice.textContent = "Open this exact source result in Mangayomi, or copy its title.";
                const copy = document.createElement("button");
                copy.type = "button";
                copy.textContent = "Copy title";
                copy.addEventListener("click", () => void streamShellCopyMangayomiTitle(hit.title || ""));
                const open = document.createElement("button");
                open.type = "button";
                open.textContent = "Open this result";
                open.disabled = !/^[A-Za-z0-9_-]{22,40}$/.test(hit.resultId || "");
                open.title = open.disabled ? "Rebuild the patched Mangayomi fork to enable exact navigation" : "Open this selected source result";
                open.addEventListener("click", async () => {
                    if (open.disabled) return;
                    open.disabled = true;
                    notice.textContent = "Opening the selected source in Mangayomi…";
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type:"landing-mangayomi-open-result", resultId:hit.resultId
                        });
                        if (!response?.ok) throw new Error(response?.error || "Bridge navigation unavailable");
                        notice.textContent = response.pending
                            ? "Treffer übergeben. Mangayomi initialisiert sein Fenster noch; die Anzeige wird automatisch versucht."
                            : "Opened in Mangayomi.";
                    } catch (error) {
                        notice.textContent = `Could not open this result: ${error.message || error}`;
                    } finally { open.disabled = false; }
                });
                const backButton = document.createElement("button");
                backButton.type = "button";
                backButton.textContent = "← Results";
                backButton.addEventListener("click", () => mediaPanelBody.replaceChildren(root));
                const actions = document.createElement("div");
                actions.className = "ss-mangayomi-selected-actions";
                actions.append(copy, open, backButton);
                selected.append(chosen, sourceName, notice, actions);
                mediaPanelBody.replaceChildren(selected);
                // A chosen source opens immediately. Keep this detail view only
                // as a safe fallback if the old fork cannot handle /v1/open.
                if (!open.disabled) open.click();
            });
            group.append(row);
        }
        root.append(group);
    }
    if (data.truncatedSources) {
        const note = document.createElement("p");
        note.textContent = "Some sources were skipped by the bridge safety limit.";
        root.append(note);
    }
    mediaPanelBody.replaceChildren(root);
}

async function streamShellHandoffMangayomiSearch(title, mediaType, switchOnly = false) {
    const query = streamShellMangayomiSearchTitle(title, mediaType);
    if (!query) return {ok:false, error:"Only anime, manga or novel titles can be sent to Mangayomi search."};

    // Shift+click copies the title BEFORE any asynchronous native call, so
    // the clipboard still has the title for Mangayomi's own global search.
    // No source lookup on Shift+click; ordinary click keeps Mangayomi behind Landing.
    const copied = switchOnly ? await streamShellCopyMangayomiTitle(query) : false;
    let result;
    try {
        result = await chrome.runtime.sendMessage(switchOnly
            ? {type:"landing-show-mangayomi"}
            : {type:"landing-mangayomi-direct-search", query, itemType:mediaType});
    } catch (error) { result = {ok:false, error:String(error?.message || error)}; }
    if (!result?.ok) {
        window.alert(result?.error || (switchOnly ? "Mangayomi could not be opened." : "Mangayomi source search failed."));
        return {ok:false, switched:false, copied};
    }
    if (!switchOnly && result.searchResults?.ok && Array.isArray(result.searchResults.sources)) {
        streamShellRenderMangayomiSourceResults(result.searchResults);
    } else if (!switchOnly && result.fallback) {
        window.alert("Mangayomi source search unavailable: " +
            (result.reason || "The patched fork did not return a ready search bridge.") +
            "\nNo search was executed.");
    } else if (!switchOnly) {
        window.alert("Mangayomi returned no usable search results.");
        return {ok:false, switched:false};
    }
    return {ok:true, copied, query, mediaType, switched:switchOnly,
        dispatched:!switchOnly && result.dispatched === true, fallback:result.fallback === true};
}

function streamShellMangayomiSearchButton(title, mediaType) {
    const query = streamShellMangayomiSearchTitle(title, mediaType);
    if (!query) return null;
    const button = createElement("button", "media-item-action ss-mangayomi-search", "⌕");
    button.type = "button";
    button.title = `Search Mangayomi sources for “${query}” in Stream Shell. Shift+click: copy title and switch to Mangayomi.`;
    button.setAttribute("aria-label", `Search Mangayomi sources for ${query} in Stream Shell; Shift+click copies the title and switches to Mangayomi`);
    button.addEventListener("click", async event => {
        if (button.disabled) return;
        button.disabled = true;
        try { await streamShellHandoffMangayomiSearch(query, mediaType, !!event.shiftKey); }
        finally { button.disabled = false; }
    });
    return button;
}

