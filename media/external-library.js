/* Stream Shell's own mixed-media library; not a Mangayomi database bridge.
 * Legacy manually entered records remain valid and keep their local IDs. */
(() => {
    "use strict";
    const KEY = "streamShellExternalLibrary";
    const TYPES = new Set(["anime", "manga", "novel"]);
    const cleanText = (value, max = 240) => typeof value === "string"
        ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
    const safeId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
    const safeCover = value => typeof value === "string" &&
        /^https:\/\/(?:[a-z\d-]+\.)?anilist\.co\//i.test(value) ? value.slice(0, 600) : "";
    const count = n => Number.isSafeInteger(Number(n)) && Number(n) > 0 && Number(n) < 100000 ? Number(n) : null;
    const clean = item => {
        if (!item || !TYPES.has(item.mediaType)) return null;
        const title = cleanText(item.title);
        const id = String(item.id || "").trim();
        if (!title || !/^[a-z0-9-]{8,80}$/i.test(id)) return null;
        const source = item.source === "anilist" && safeId(item.anilistId) ? "anilist" : "mangayomi";
        const data = { id, source, mediaType:item.mediaType, title,
            addedAt:Number(item.addedAt) || Date.now() };
        if (source === "anilist") {
            data.anilistId = Number(item.anilistId);
            data.originalTitle = cleanText(item.originalTitle);
            data.nativeTitle = cleanText(item.nativeTitle);
            data.coverUrl = safeCover(item.coverUrl);
            const year = Number(item.year);
            data.year = Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
            data.format = cleanText(item.format, 32);
            data.episodes = count(item.episodes);
            data.chapters = count(item.chapters);
            const score = Number(item.score);
            data.score = item.score !== null && item.score !== undefined && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
            data.description = cleanText(item.description, 1250);
            data.genres = Array.isArray(item.genres) ? item.genres.map(v => cleanText(v,36)).filter(Boolean).slice(0, 8) : [];
            data.status = cleanText(item.status, 40);
        }
        return data;
    };
    const dedupe = items => {
        const seenIds = new Set(), seenAniList = new Set(), out = [];
        for (const item of items) {
            if (!item || seenIds.has(item.id)) continue;
            const anilistKey = item.source === "anilist" ? `${item.mediaType}:${item.anilistId}` : null;
            if (anilistKey && seenAniList.has(anilistKey)) continue;
            seenIds.add(item.id);
            if (anilistKey) seenAniList.add(anilistKey);
            out.push(item);
        }
        return out.slice(0,5000);
    };
    const sanitize = input => dedupe((Array.isArray(input) ? input : []).map(clean).filter(Boolean));
    async function getAll() {
        const stored = await chrome.storage.local.get(KEY);
        return sanitize(stored[KEY]).sort((a,b) => b.addedAt - a.addedAt);
    }
    async function add(title, mediaType) {
        if (!TYPES.has(mediaType) || !String(title || "").trim()) throw new Error("Title and media type required.");
        const current = await getAll();
        const item = clean({id: crypto.randomUUID(), title, mediaType, addedAt:Date.now()});
        if (!item) throw new Error("Invalid library item.");
        await chrome.storage.local.set({[KEY]:dedupe([item,...current])});
        return item;
    }
    async function upsertAniList(media) {
        if (!media || !safeId(media.anilistId) || !TYPES.has(media.mediaType))
            throw new Error("Invalid AniList title.");
        const current = await getAll();
        const title = cleanText(media.title);
        if (!title) throw new Error("AniList title is missing.");
        // A manually saved entry with the same title should gain its metadata,
        // not become a second separate card. Original addedAt and UUID survive.
        const existing = current.find(item => item.source === "anilist" &&
            item.anilistId === Number(media.anilistId) && item.mediaType === media.mediaType) ||
            current.find(item => item.source !== "anilist" && item.mediaType === media.mediaType &&
                item.title.toLocaleLowerCase() === title.toLocaleLowerCase());
        const item = clean({...media, id: existing?.id || crypto.randomUUID(), source:"anilist",
            addedAt:existing?.addedAt || Date.now()});
        if (!item || item.source !== "anilist") throw new Error("AniList entry could not be stored.");
        await chrome.storage.local.set({[KEY]:dedupe([item,...current.filter(row => row.id !== item.id)])});
        return item;
    }
    async function remove(id) {
        const next = (await getAll()).filter(item => item.id !== id);
        await chrome.storage.local.set({[KEY]:next});
        return next;
    }
    async function merge(imported) {
        const current = await getAll();
        const map = new Map(current.map(item => [item.id,item]));
        for (const item of sanitize(imported)) map.set(item.id,item);
        await chrome.storage.local.set({[KEY]:dedupe([...map.values()])});
    }
    window.StreamShellExternalLibrary = Object.freeze({KEY, getAll, add, upsertAniList, remove, merge});
})();
