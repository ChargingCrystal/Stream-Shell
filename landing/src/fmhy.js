/* FMHY discovery: curated Markdown links, not TMDB title availability. */
// Category browsing is a first-class search mode: choosing e.g. Gaming
// discovers FMHY-curated resources even with an empty text query. Gaming
// aggregates two independent upstream documents under one area chip.
const STREAM_SHELL_FMHY_AREAS = Object.freeze([
    ["gaming", "Gaming"], ["video", "Video"], ["reading", "Reading"],
    ["audio", "Audio"], ["video-tools", "Video tools"],
    ["non-english", "International"], ["downloading", "Downloads"],
    ["torrenting", "Torrenting"], ["educational", "Learning"],
    ["internet-tools", "Web tools"]
]);
const STREAM_SHELL_FMHY_DOCS = Object.freeze([
    ...STREAM_SHELL_FMHY_AREAS.map(([id]) => `${id}.md`), "gaming-tools.md"
]);
const streamShellFmhyDocumentArea = file => file === "gaming-tools.md" ? "gaming" : file.slice(0, -3);
const STREAM_SHELL_FMHY_KINDS = Object.freeze([
    ["stream", "Streaming"], ["download", "Downloads"],
    ["library", "Libraries"], ["index", "Indexes"], ["tool", "Tools"]
]);
const streamShellFmhySelectedAreas = new Set();
const streamShellFmhySelectedKinds = new Set();
let fmhyLoadedAreas = 0;
let fmhyAllAreas = STREAM_SHELL_FMHY_AREAS.length;
const STREAM_SHELL_FMHY_ROOT = "https://raw.githubusercontent.com/fmhy/edit/main/docs/";
// Small packaged fallback from FMHY's public directory (not a full mirrored index).
// The live Markdown directory remains authoritative when it can be fetched.
const STREAM_SHELL_FMHY_FALLBACK = Object.freeze([
    ["Movy", "https://www.movy.sx/", "video", "Streaming Sites", "Movies / TV / Anime / 4K"],
    ["Cinejoy", "https://cinejoy.pk/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["PopcornMovies", "https://popcornmovies.ac/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Rive", "https://www.rivestream.app/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Flixer", "https://flixer.gd/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Vivarium", "https://vivarium.su/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["MeowTV", "https://meowtv.ru/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Movie Night", "https://movienig.ht/", "video", "Streaming Sites", "Movies / TV / Anime"],
    ["Open Slum", "https://open-slum.org/", "reading", "Ebooks", "Book Site Index"],
    ["Project Gutenberg", "https://www.gutenberg.org/", "reading", "Public Domain", "Historical Fiction / Nonfiction / Books / Ebooks"],
    ["Open Library", "https://openlibrary.org/", "reading", "Ebooks", "Books / Digital Library"],
    ["Internet Archive", "https://archive.org/details/texts", "reading", "Ebooks", "Books / Audiobooks"],
    ["Bookracy", "https://bookracy.com/", "reading", "Ebooks", "Books / Comics / Manga"],
    ["JustFreeBooks", "https://www.justfreebooks.info/", "reading", "Ebooks", "Book Search"],
    ["Manybooks", "https://manybooks.net/", "reading", "Ebooks", "Books"],
    ["Sonora", "https://sonorahq.org/", "audio", "Streaming Apps", "YouTube Music Client"],
    ["WAVE", "https://waveapp.pages.dev/", "audio", "Streaming Apps", "YouTube Music Client"],
    ["SoundCloud", "https://soundcloud.com/", "audio", "Streaming Sites", "Music Streaming"],
    ["Bandcamp", "https://bandcamp.com/discover/free-music", "audio", "Streaming Sites", "Music"],
    ["Digital Video Intro", "https://github.com/leandromoreira/digital_video_introduction", "video-tools", "Video Tools", "Digital Video Guides"],
    ["VidCoder", "https://vidcoder.net/", "video-tools", "Physical Media Tools", "DVD / Blu-ray Video"],
    ["MakeMKV", "https://forum.makemkv.com/forum/viewtopic.php?f=5&t=1053", "video-tools", "Physical Media Tools", "Blu-ray / DVD"],
    ["Catbox", "https://catbox.moe/", "video-tools", "Video File Hosts", "File Hosting"],
    ["PCGamingWiki", "https://www.pcgamingwiki.com/wiki/Home", "gaming", "Gaming Tools", "Game fixes and workarounds"],
    ["HowLongToBeat", "https://howlongtobeat.com/", "gaming", "Gaming Tools", "Average game completion times"],
    ["Backloggd", "https://www.backloggd.com/", "gaming", "Tracking / Databases", "Track and discover video games"]
].map(([title, url, category, section, description]) =>
    ({title, url, category, section, description})));
let fmhyUsingFallback = false;
let fmhyResourceCache = null;
let fmhyCacheAt = 0;
let fmhyDisplayedLimit = 60;
const STREAM_SHELL_FMHY_PAGE_SIZE = 60;
const streamShellFmhyIsBrowsing = rawQuery =>
    !String(rawQuery || "").trim() &&
    (streamShellFmhySelectedAreas.size > 0 || streamShellFmhySelectedKinds.size > 0);
const streamShellFmhyNormalize = value => String(value || "").toLocaleLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g,"ss");
function streamShellFmhyResourceKind(category, section, description) {
    const heading = streamShellFmhyNormalize(section);
    const context = `${heading} ${streamShellFmhyNormalize(description)}`;
    // Classification uses only the FMHY descriptions/headings, not invented
    // "official" content-type metadata. Unknown sites remain general indexes.
    if (/(index|directory|list of|site lists|site index|aggregator|search engines?)/.test(heading)) return "index";
    if (/(tools?|converters?|players?|editors?|extensions?|utilities?|guides?|software|clients?)/.test(heading)
        || category.endsWith("-tools") || category === "internet-tools") return "tool";
    if (/(download|torrent|ddl|direct links|usenet)/.test(heading) || ["downloading", "torrenting"].includes(category)) return "download";
    if (/(books?|manga|comics?|ebooks?|audiobooks?|novels?|libraries|archives?|textbooks?)/.test(heading)
        || category === "reading") return "library";
    if (/(stream|watch|live|radio|podcasts?|music|movies?|tv|anime)/.test(context)
        || ["video", "audio"].includes(category)) return "stream";
    return "index";
}

function streamShellParseFmhyMarkdown(markdown, category) {
    const rows = [];
    let heading = category;
    for (const line of String(markdown || "").split(/\r?\n/)) {
        const section = line.match(/^#{1,5}\s+(.+)$/);
        if (section) heading = section[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim().slice(0, 100);
        // FMHY uses both '* ⭐ **[Name](url)** - Description' and '- [Name](url)'.
        if (!/^\s*[-*]\s/.test(line)) continue;
        // Only the first canonical resource on each list item. Secondary links are
        // often mirrors, Discord channels or miscellaneous documentation.
        const hit = line.match(/\[([^\]\n]{2,100})\]\((https:\/\/[^\s)]+)\)/);
        if (!hit) continue;
        // Section jump-links inside FMHY are navigation, not resource websites.
        if (/^[▷►◄↪]/.test(hit[1].trim())) continue;
        let url;
        try { url = new URL(hit[2]); } catch { continue; }
        if (url.protocol !== "https:" || url.username || url.password || url.hostname.length > 253) continue;
        // FMHY's media categories and keywords mostly appear AFTER the link
        // (e.g. 'Movies / TV / Anime') rather than in its resource title.
        const description = line.slice(hit.index + hit[0].length)
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[\*_`#~]/g, "")
            .replace(/\s+/g, " ").trim().slice(0, 400);
        rows.push({title: hit[1].trim(), url: url.href, category,
            section: heading, description,
            kind: streamShellFmhyResourceKind(category, heading, description),
            recommended: /⭐|🌟/.test(line.slice(0, hit.index))});
    }
    return rows;
}

async function streamShellFetchFmhyResources() {
    if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
        const gate = await chrome.storage.local.get("streamShellSevenSeasAcknowledged");
        if (gate.streamShellSevenSeasAcknowledged !== true)
            throw new Error("FMHY is disabled until the Seven Seas acknowledgement is enabled.");
    }
    if (fmhyResourceCache && Date.now() - fmhyCacheAt <
        (fmhyUsingFallback ? 5 * 60 * 1000 : 6 * 60 * 60 * 1000))
        return fmhyResourceCache;
    // Isolate every document: temporary rate limit / offline errors shouldn't break TMDB.
    const results = await Promise.allSettled(STREAM_SHELL_FMHY_DOCS.map(async file => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7500);
        try {
            const response = await fetch(STREAM_SHELL_FMHY_ROOT + file, {signal: controller.signal, cache: "default"});
            if (!response.ok) throw new Error(`FMHY ${file}: HTTP ${response.status}`);
            const content = await response.text();
            if (content.length > 2_000_000) throw new Error(`FMHY document too large: ${file}`);
            return streamShellParseFmhyMarkdown(content, streamShellFmhyDocumentArea(file));
        } finally { clearTimeout(timeout); }
    }));
    const available = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    if (!available.length) {
        // A blocked/raw GitHub request must not make FMHY search appear broken.
        // Never mislabel the packaged excerpt as the complete current directory.
        fmhyUsingFallback = true;
        fmhyLoadedAreas = 0;
        fmhyResourceCache = STREAM_SHELL_FMHY_FALLBACK.map(item => ({...item,
            kind: streamShellFmhyResourceKind(item.category, item.section, item.description),
            recommended: false}));
        fmhyCacheAt = Date.now();
        return fmhyResourceCache;
    }
    if (available.length) {
        fmhyUsingFallback = false;
        fmhyLoadedAreas = new Set(results.flatMap((result, index) => result.status === "fulfilled"
            ? [streamShellFmhyDocumentArea(STREAM_SHELL_FMHY_DOCS[index])] : [])).size;
        const seen = new Set();
        fmhyResourceCache = available.filter(row => {
            if (seen.has(row.url)) return false;
            seen.add(row.url);
            return true;
        });
        fmhyCacheAt = Date.now();
    }
    return fmhyResourceCache;
}

function streamShellSearchFmhyIndex(resources, rawQuery, options = {}) {
    const aliases = {films: "movies", film: "movie", serie: "series",
        serien: "tv", comics: "comic", bucher: "books", buch: "book",
        filme: "movies", musik: "music", horbuch: "audiobook", lesen: "reading"};
    const parts = streamShellFmhyNormalize(rawQuery).trim().split(/\s+/)
        .filter(Boolean).map(word => aliases[word] || word);
    const areas = options.areas || streamShellFmhySelectedAreas;
    const kinds = options.kinds || streamShellFmhySelectedKinds;
    // No global unfiltered catalogue dump on opening the FMHY tab.
    // A selected Area or Kind explicitly requests category discovery.
    if (!parts.length && !areas.size && !kinds.size) return [];
    const browsing = !parts.length;
    return resources.map(row => {
        const kind = row.kind || streamShellFmhyResourceKind(row.category, row.section, row.description);
        if (areas.size && !areas.has(row.category)) return null;
        if (kinds.size && !kinds.has(kind)) return null;
        const title = streamShellFmhyNormalize(row.title);
        const section = streamShellFmhyNormalize(`${row.section} ${row.category}`);
        const context = streamShellFmhyNormalize(`${row.description || ""} ${new URL(row.url).hostname}`);
        if (!parts.every(word => title.includes(word) || section.includes(word) || context.includes(word))) return null;
        const phrase = parts.join(" ");
        // For browsing, ⭐ means FMHY community-curated, not a verified rating.
        // For text search, title matches remain more important than that marker.
        const score = browsing ? (row.recommended ? 100 : 0)
            : (title === phrase ? 90 : title.startsWith(phrase) ? 35 : title.includes(phrase) ? 15 : 0)
                + parts.reduce((sum, word) => sum +
                    (title.includes(word) ? 15 : section.includes(word) ? 7 : 2), 0)
                + (row.recommended ? 4 : 0);
        return {...row, kind, score};
    }).filter(Boolean).sort((a,b) => b.score - a.score ||
        a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
}

function streamShellFmhyFacets(summary = "") {
    const host = createElement("div", "ss-search-filter-bar ss-fmhy-facets");
    const summaryText = createElement("div", "ss-search-filter-summary", summary);
    host.appendChild(summaryText);
    for (const [name, values, selected] of [
        ["Area", STREAM_SHELL_FMHY_AREAS, streamShellFmhySelectedAreas],
        ["Kind", STREAM_SHELL_FMHY_KINDS, streamShellFmhySelectedKinds]
    ]) {
        const line = createElement("div", "ss-search-filter-line");
        line.appendChild(createElement("span", "ss-search-filter-label", name));
        const filters = createElement("div", "ss-search-filter-chips");
        filters.setAttribute("role", "group");
        filters.setAttribute("aria-label", `FMHY ${name.toLowerCase()} filters (multiple allowed)`);
        for (const [type, label] of values) {
            const chip = createElement("button", "ss-library-filter", label);
            chip.type = "button";
            if (name === "Area") chip.title = `Browse ${label} resources (clears search term)`;
            chip.classList.toggle("selected", selected.has(type));
            chip.setAttribute("aria-pressed", String(selected.has(type)));
            chip.addEventListener("click", () => {
                if (selected.has(type)) selected.delete(type); else selected.add(type);
                if (mediaSearchSource?.value !== "fmhy") return;
                // Areas double as discovery searches: selecting Gaming should
                // browse Gaming picks, not silently retain a previous TMDB query.
                // Typing *afterwards* still refines the selected categories.
                if (name === "Area" && mediaSearchInput.value.trim()) {
                    mediaSearchInput.value = "";
                    if (typeof mediaSearchClear !== "undefined" && mediaSearchClear) {
                        mediaSearchClear.hidden = true;
                        mediaSearchClear.setAttribute("aria-hidden", "true");
                    }
                }
                const q = mediaSearchInput.value.trim();
                fmhyDisplayedLimit = STREAM_SHELL_FMHY_PAGE_SIZE;
                if ((q.length >= 2 || streamShellFmhyIsBrowsing(q)) && fmhyResourceCache)
                    renderFmhyResults(streamShellSearchFmhyIndex(fmhyResourceCache, q), searchGeneration);
                else if (q.length >= 2 || streamShellFmhyIsBrowsing(q))
                    scheduleSearch(true); // first browse fetch; thereafter filters use cache
                else showSearchHint();
            });
            filters.appendChild(chip);
        }
        line.appendChild(filters);
        host.appendChild(line);
    }
    return host;
}
function streamShellFmhySubtitle(summary) {
    if (mediaSearchSource?.value !== "fmhy") return;
    mediaPanelSubtitle.replaceChildren(streamShellFmhyFacets(summary));
}

function renderFmhyResults(results, generation) {
    if (generation !== searchGeneration) return;
    const browsing = streamShellFmhyIsBrowsing(mediaSearchInput.value.trim());
    const labels = [...streamShellFmhySelectedAreas].map(id =>
        STREAM_SHELL_FMHY_AREAS.find(([area]) => area === id)?.[1] || id);
    const selectionLabel = browsing ? `${labels.length ? labels.join(" + ") : "Selected resource types"} · ` : "";
    streamShellFmhySubtitle(`${selectionLabel}${results.length} ${browsing ? "discoverable" : "matching"} websites · ${fmhyUsingFallback
        ? "Limited offline excerpt (live FMHY unavailable)"
        : `Live FMHY directory (${fmhyLoadedAreas}/${fmhyAllAreas} areas loaded)`}`);
    if (!results.length) {
        renderPanelMessage("No matching resources", browsing
            ? "No entries in these categories. Try another Area or Kind. FMHY community picks appear first where available."
            : "FMHY indexes resource websites, not individual media titles. Try another term or select an Area to browse without text.", {icon: "⌕"});
        return;
    }
    const list = createElement("div", "media-list fmhy-results");
    for (const item of results.slice(0, fmhyDisplayedLimit)) {
        // Match the existing three-column Direct Link row: launch | details | actions.
        // Without the launch column, the title falls into the 34px icon slot.
        const row = createElement("article", "media-item direct-link-item fmhy-result");
        const open = createElement("button", "direct-link-launch", "↗");
        open.type = "button";
        open.title = `Open ${item.title} in Opera`;
        open.setAttribute("aria-label", open.title);
        const openResource = async () => {
            try {
                const reply = await chrome.runtime.sendMessage({type: "open-direct-link", url: item.url});
                if (reply?.ok === false) throw new Error(reply.error || "Failed to open resource");
            } catch (error) {
                console.error("FMHY launch failed", error);
            }
        };
        open.addEventListener("click", openResource);

        const main = createElement("div", "media-item-main direct-link-main");
        const heading = createElement("div", "media-item-title-row");
        heading.append(
            createElement("span", "media-item-title", item.title),
            createElement("span", "media-item-type", STREAM_SHELL_FMHY_KINDS.find(([kind]) => kind === item.kind)?.[1] || item.category)
        );
        main.append(heading);
        const meta = createElement("div", "media-item-meta");
        meta.append(
            createElement("span", "", `${STREAM_SHELL_FMHY_AREAS.find(([id]) => id === item.category)?.[1] || item.category} · ${item.section}${item.recommended ? " · ★ FMHY pick" : ""}`),
            createElement("span", "", new URL(item.url).hostname)
        );
        main.append(meta);
        if (item.description) {
            main.append(createElement("div", "fmhy-result-description", item.description));
        }
        const actions = createElement("div", "media-item-actions");
        const save = createElement("button", "media-item-action", "♡");
        save.type = "button";
        save.title = "Save to Direct links";
        save.setAttribute("aria-label", save.title);
        save.addEventListener("click", async () => {
            try {
                await window.StreamShellDirectLinks.merge([{title: item.title, url: item.url}]);
                save.textContent = "✓";
                save.classList.add("saved");
                save.disabled = true;
            } catch (error) { console.error("FMHY save failed", error); }
        });
        actions.append(save);
        row.append(open, main, actions);
        list.appendChild(row);
    }
    if (results.length > fmhyDisplayedLimit) {
        const more = createElement("button", "ss-fmhy-load-more", `Show more · ${results.length - fmhyDisplayedLimit} remaining`);
        more.type = "button";
        more.addEventListener("click", () => {
            fmhyDisplayedLimit += STREAM_SHELL_FMHY_PAGE_SIZE;
            renderFmhyResults(results, generation);
        });
        list.appendChild(more);
    }
    mediaPanelBody.replaceChildren(list);
}
