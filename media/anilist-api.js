/* AniList is a public metadata directory, not a streaming availability source.
 * Queries require no user account. Keep search light and bound network work. */
(() => {
    "use strict";
    const ENDPOINT = "https://graphql.anilist.co/";
    const SEARCH_FIELDS = `id type format title { romaji english native }
        coverImage { medium large } episodes chapters averageScore
        seasonYear startDate { year }`;
    const SEARCH_QUERY = `query($search:String,$type:MediaType){
        Page(page:1,perPage:12){media(search:$search,type:$type,sort:[SEARCH_MATCH]){
            ${SEARCH_FIELDS}
        }}
    }`;
    const DETAIL_QUERY = `query($id:Int!,$type:MediaType){
        Media(id:$id,type:$type){
            ${SEARCH_FIELDS}
            description(asHtml:false) genres status
        }
    }`;
    const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
    const validCover = value => typeof value === "string" &&
        /^https:\/\/(?:[a-z\d-]+\.)?anilist\.co\//i.test(value) ? value.slice(0, 600) : "";
    const text = (value, length = 500) => typeof value === "string"
        ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, length) : "";
    function cleanResult(value) {
        if (!value || !validId(value.id) || !["ANIME", "MANGA"].includes(value.type)) return null;
        const mediaType = value.type === "ANIME" ? "anime" : value.format === "NOVEL" ? "novel" : "manga";
        const title = text(value.title?.english || value.title?.romaji || value.title?.native, 240);
        if (!title) return null;
        const year = Number(value.seasonYear || value.startDate?.year) || null;
        const count = n => Number.isSafeInteger(n) && n > 0 && n < 100000 ? n : null;
        const score = Number(value.averageScore);
        return {
            anilistId: Number(value.id), mediaType, title,
            originalTitle: text(value.title?.romaji && value.title.romaji !== title ? value.title.romaji : value.title?.native || "", 240),
            nativeTitle: text(value.title?.native || "", 240),
            coverUrl: validCover(value.coverImage?.large || value.coverImage?.medium),
            year: year && year >= 1900 && year <= 2100 ? year : null,
            format: text(value.format || "", 32),
            episodes: count(value.episodes), chapters: count(value.chapters),
            score: value.averageScore != null && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null,
            description: text(value.description || "", 1250),
            genres: Array.isArray(value.genres) ? value.genres.map(g => text(g, 36)).filter(Boolean).slice(0, 8) : [],
            status: text(value.status || "", 40)
        };
    }
    async function request(query, variables) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(ENDPOINT, {
                method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
                body: JSON.stringify({query, variables}), signal: controller.signal, cache: "no-store"
            });
            if (!response.ok) throw new Error(response.status === 429
                ? "AniList rate limit reached. Please try again later."
                : `AniList HTTP ${response.status}`);
            const body = await response.json();
            if (Array.isArray(body?.errors) && body.errors.length)
                throw new Error(`AniList: ${text(body.errors[0]?.message || "Query failed", 160)}`);
            if (!body || typeof body.data !== "object" || body.data === null)
                throw new Error("AniList returned no data.");
            return body.data;
        } catch (error) {
            if (error?.name === "AbortError") throw new Error("AniList timed out (12 seconds).");
            throw error;
        } finally { clearTimeout(timeout); }
    }
    async function search(query) {
        const name = String(query || "").trim().slice(0, 120);
        if (name.length < 2) return [];
        const searches = await Promise.allSettled(["ANIME", "MANGA"].map(type =>
            request(SEARCH_QUERY, {search: name, type})));
        const found = [];
        const reasons = [];
        for (const result of searches) {
            if (result.status === "rejected") { reasons.push(result.reason?.message || "Request failed"); continue; }
            for (const media of result.value.Page?.media || []) {
                const cleaned = cleanResult(media);
                if (cleaned) found.push(cleaned);
            }
        }
        if (!found.length && reasons.length) throw new Error(reasons[0]);
        // Partial results are preferable to hiding a successful search because
        // one AniList media type was temporarily unavailable.
        return found;
    }
    // Cross-source enrichment must not search MANGA/novels or issue a
    // second request when only an anime title can map to TMDB.
    async function searchAnime(query) {
        const name = String(query || "").trim().slice(0,120);
        if (name.length < 2) return [];
        const response = await request(SEARCH_QUERY, {search:name, type:"ANIME"});
        return (response.Page?.media || []).map(cleanResult)
            .filter(item => item?.mediaType === "anime");
    }
    async function details(item) {
        if (!validId(item?.anilistId) || !["anime", "manga", "novel"].includes(item.mediaType))
            throw new Error("Invalid AniList media reference.");
        const type = item.mediaType === "anime" ? "ANIME" : "MANGA";
        const response = await request(DETAIL_QUERY, {id:Number(item.anilistId), type});
        const result = cleanResult(response.Media);
        if (!result || result.mediaType !== item.mediaType || result.anilistId !== item.anilistId)
            throw new Error("AniList returned an unexpected title.");
        return result;
    }
    window.StreamShellAniList = Object.freeze({search, searchAnime, details, cleanResult, validCover});
})();
