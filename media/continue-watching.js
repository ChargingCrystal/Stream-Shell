(() => {
    "use strict";

    const STORAGE_KEY = "streamShellContinueWatching";
    const COMPLETE_PERCENT_STORAGE_KEY = "streamShellContinueWatchingCompletePercent";
    const DEFAULT_COMPLETE_PERCENT = 95;
    const MAX_ITEMS = 50;
    let completePercent = DEFAULT_COMPLETE_PERCENT;
    let completePercentLoaded = false;
    let completePercentLoadPromise = null;
    const PROVIDERS = new Set(["youtube", "netflix", "prime", "disney", "crunchyroll"]);


    function normalizeCompletePercent(value, fallback = DEFAULT_COMPLETE_PERCENT) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(1, Math.min(100, Math.round(numeric)));
    }

    async function loadCompletePercent() {
        if (completePercentLoaded) return completePercent;
        if (completePercentLoadPromise) return completePercentLoadPromise;

        completePercentLoadPromise = chrome.storage.local
            .get(COMPLETE_PERCENT_STORAGE_KEY)
            .then(stored => {
                completePercent = normalizeCompletePercent(
                    stored[COMPLETE_PERCENT_STORAGE_KEY],
                    DEFAULT_COMPLETE_PERCENT
                );
                completePercentLoaded = true;
                return completePercent;
            })
            .catch(() => {
                completePercent = DEFAULT_COMPLETE_PERCENT;
                completePercentLoaded = true;
                return completePercent;
            })
            .finally(() => {
                completePercentLoadPromise = null;
            });

        return completePercentLoadPromise;
    }

    async function getCompletePercent() {
        return loadCompletePercent();
    }

    async function setCompletePercent(value) {
        await loadCompletePercent();
        completePercent = normalizeCompletePercent(value, completePercent);
        completePercentLoaded = true;

        await chrome.storage.local.set({
            [COMPLETE_PERCENT_STORAGE_KEY]: completePercent
        });

        const stored = await chrome.storage.local.get(STORAGE_KEY);
        await saveAll(stored[STORAGE_KEY]);
        return completePercent;
    }

    function normalizeItem(item) {
        const provider = String(item?.provider || "").trim();
        const title = String(item?.title || "").trim();
        const url = String(item?.url || "").trim();
        const currentTime = Number(item?.currentTime);
        const duration = Number(item?.duration);
        const storedProgress = Number(item?.progressPercent);
        const progressPercent = Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime)
            ? Math.max(0, Math.min(100, currentTime / duration * 100))
            : (Number.isFinite(storedProgress) ? Math.max(0, Math.min(100, storedProgress)) : null);

        return {
            id: String(item?.id || `${provider}:${url}`).trim(),
            provider,
            title,
            image: String(item?.image || "").trim(),
            url,
            currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
            duration: Number.isFinite(duration) && duration > 0 ? duration : null,
            progressPercent,
            updatedAt: Number(item?.updatedAt) || Date.now()
        };
    }

    function isValidItem(item) {
        return Boolean(
            item &&
            PROVIDERS.has(String(item.provider || "")) &&
            String(item.id || "").trim() &&
            String(item.title || "").trim() &&
            /^https?:\/\//i.test(String(item.url || "")) &&
            Number(item.currentTime) >= 1 &&
            Number(item.duration) > 0
        );
    }

    function sanitizeItems(rawItems) {
        const result = [];
        const seen = new Set();

        for (const raw of Array.isArray(rawItems) ? rawItems : []) {
            const item = normalizeItem(raw);
            if (!isValidItem(item) || Number(item.progressPercent) >= completePercent || seen.has(item.id)) continue;
            seen.add(item.id);
            result.push(item);
        }

        return result
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .slice(0, MAX_ITEMS);
    }

    async function getAll() {
        await loadCompletePercent();
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        return sanitizeItems(stored[STORAGE_KEY]);
    }

    async function saveAll(items) {
        await loadCompletePercent();
        const sanitized = sanitizeItems(items);
        await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
        return sanitized;
    }

    async function removeById(id) {
        const items = await getAll();
        return saveAll(items.filter(item => item.id !== id));
    }

    async function merge(importedItems) {
        const current = await getAll();
        const byId = new Map(current.map(item => [item.id, item]));

        for (const item of sanitizeItems(importedItems)) {
            const existing = byId.get(item.id);
            if (!existing || item.updatedAt > existing.updatedAt) byId.set(item.id, item);
        }

        return saveAll([...byId.values()]);
    }

    async function clear() {
        await chrome.storage.local.remove(STORAGE_KEY);
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
        if (!Object.prototype.hasOwnProperty.call(changes, COMPLETE_PERCENT_STORAGE_KEY)) return;

        completePercent = normalizeCompletePercent(
            changes[COMPLETE_PERCENT_STORAGE_KEY]?.newValue,
            DEFAULT_COMPLETE_PERCENT
        );
        completePercentLoaded = true;
    });

    window.StreamShellContinueWatching = {
        STORAGE_KEY,
        COMPLETE_PERCENT_STORAGE_KEY,
        DEFAULT_COMPLETE_PERCENT,
        get COMPLETE_PERCENT() {
            return completePercent;
        },
        getCompletePercent,
        setCompletePercent,
        MAX_ITEMS,
        getAll,
        saveAll,
        removeById,
        merge,
        clear
    };
})();
