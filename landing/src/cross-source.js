/* v0.21.13: Best-effort TMDB <-> AniList enrichment on explicit save.
 * Save first; search only for an anime/movie counterpart with one unambiguous
 * title + release-year + format match. No eager bulk scans and no deletions.
 * API outages, absent TMDB credentials and uncertain matches are non-fatal.
 */
const streamShellAutoLinkJobs = new Map();

function streamShellAutoLinkFormat(anilist) {
    if (anilist?.mediaType !== "anime") return null;
    const format = String(anilist.format || "").toUpperCase();
    if (format === "MOVIE") return "movie";
    if (format === "TV" || format === "TV_SHORT") return "tv";
    return null; // No automatic OVA/ONA/SPECIAL ↔ TV guesses.
}

function streamShellAutoLinkMatches(tmdb, anilist) {
    if (!tmdb || !anilist || tmdb.mediaType !== streamShellAutoLinkFormat(anilist)) return false;
    const tmdbYear = streamShellLibraryYear(tmdb);
    const anilistYear = streamShellLibraryYear(anilist);
    if (!tmdbYear || !anilistYear || tmdbYear !== anilistYear) return false;
    const names = item => new Set([item.title,item.originalTitle,item.nativeTitle]
        .map(streamShellLibraryTitleKey).filter(Boolean));
    const left = names(tmdb), right = names(anilist);
    return [...left].some(name => right.has(name));
}

function streamShellAutoLinkUnique(candidates, anchor, counterpartType) {
    const byId = new Map();
    for (const candidate of candidates) {
        if (!candidate || !streamShellAutoLinkMatches(
            counterpartType === "anilist" ? anchor : candidate,
            counterpartType === "anilist" ? candidate : anchor)) continue;
        const id = counterpartType === "anilist" ? Number(candidate.anilistId) : `${candidate.mediaType}:${candidate.id}`;
        if (!id || id === "undefined:undefined") continue;
        byId.set(id, candidate);
    }
    return byId.size === 1 ? [...byId.values()][0] : null;
}

function streamShellAutoLinkQueries(media) {
    const out = [];
    for (const name of [media.title,media.originalTitle,media.nativeTitle]) {
        const value = String(name || "").trim().slice(0,120);
        const key = streamShellLibraryTitleKey(value);
        if (value.length >= 2 && key && !out.some(other => streamShellLibraryTitleKey(other) === key))
            out.push(value);
    }
    return out.slice(0,2); // Max two names; do not launch open-ended source scans.
}

async function streamShellAutoLinkFindTmdb(anilist) {
    if (!await window.StreamShellMediaApi.hasToken()) return null;
    const found = [];
    for (const name of streamShellAutoLinkQueries(anilist)) {
        try { found.push(...await window.StreamShellMediaApi.searchMedia(name)); }
        catch (error) { console.debug("TMDB enrichment search unavailable", error); }
    }
    return streamShellAutoLinkUnique(found,anilist,"tmdb");
}

async function streamShellAutoLinkFindAniList(tmdb) {
    const found = [];
    for (const name of streamShellAutoLinkQueries(tmdb)) {
        try { found.push(...await window.StreamShellAniList.searchAnime(name)); }
        catch (error) { console.debug("AniList enrichment search unavailable", error); }
    }
    return streamShellAutoLinkUnique(found,tmdb,"anilist");
}

async function streamShellAutoLinkRefresh() {
    await refreshWatchlistCache();
    if (activePanel === "watchlist" && !mediaPanel.hidden) await showWatchlist();
}

function streamShellAutoLinkRun(key, action) {
    if (streamShellAutoLinkJobs.has(key)) return streamShellAutoLinkJobs.get(key);
    const job = Promise.resolve().then(action).catch(error => {
        // The primary save has already succeeded; this must never undo it.
        console.debug("Optional cross-source metadata lookup skipped", error);
    }).finally(() => streamShellAutoLinkJobs.delete(key));
    streamShellAutoLinkJobs.set(key,job);
    return job;
}

function streamShellEnrichTmdbMedia(tmdb) {
    if (!tmdb || !["tv","movie"].includes(tmdb.mediaType)) return Promise.resolve();
    return streamShellAutoLinkRun(`tmdb:${tmdb.mediaType}:${tmdb.id}`, async () => {
        if (!await window.StreamShellWatchlist.contains(tmdb)) return;
        // Already linked to a saved AniList entry? The combined card has all data.
        const saved = await window.StreamShellExternalLibrary.getAll();
        if (saved.some(item => item.source === "anilist" && streamShellAutoLinkMatches(tmdb,item))) return;
        const match = await streamShellAutoLinkFindAniList(tmdb);
        if (!match || !await window.StreamShellWatchlist.contains(tmdb)) return;
        // If two external entries match the same TMDB title, leave it ambiguous.
        const current = await window.StreamShellExternalLibrary.getAll();
        if (current.filter(item => item.source === "anilist" && streamShellAutoLinkMatches(tmdb,item)).length > 1) return;
        let enriched = match;
        try { enriched = await window.StreamShellAniList.details(match); }
        catch { /* Search result already contains reliable title, year and ID. */ }
        if (!await window.StreamShellWatchlist.contains(tmdb) ||
            !streamShellAutoLinkMatches(tmdb,enriched)) return;
        await window.StreamShellExternalLibrary.upsertAniList(enriched);
        await streamShellAutoLinkRefresh();
    });
}

function streamShellEnrichAniListMedia(anilist) {
    if (!anilist?.anilistId || !streamShellAutoLinkFormat(anilist)) return Promise.resolve();
    return streamShellAutoLinkRun(`anilist:${anilist.anilistId}`, async () => {
        const isStillSaved = async () => (await window.StreamShellExternalLibrary.getAll())
            .some(item => item.source === "anilist" && item.anilistId === anilist.anilistId);
        if (!await isStillSaved()) return;
        const storedTmdb = await window.StreamShellWatchlist.getAll();
        if (storedTmdb.some(item => streamShellAutoLinkMatches(item,anilist))) return;
        const match = await streamShellAutoLinkFindTmdb(anilist);
        if (!match || !await isStillSaved()) return;
        // Do not create an extra TMDB record when a matching one has been saved meanwhile.
        const current = await window.StreamShellWatchlist.getAll();
        if (current.some(item => streamShellAutoLinkMatches(item,anilist))) return;
        await window.StreamShellWatchlist.add(match);
        await streamShellAutoLinkRefresh();
    });
}
