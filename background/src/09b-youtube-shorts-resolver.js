/* Bounded, shared identity resolution for visible Shorts. Never execute page HTML. */
const SS_SHORTS_CACHE_KEY = 'streamShellYoutubeShortsIdentityV1';
let ssShortsChain = Promise.resolve(), ssShortsLastRequest = 0;
const ssShortsPending = new Map();
function ssShortsPlayerIdentity(html, videoId) {
    const pattern = /(?:var\s+ytInitialPlayerResponse\s*=|window\["ytInitialPlayerResponse"\]\s*=|"playerResponse"\s*:)/g;
    for (const match of html.matchAll(pattern)) {
        let start = match.index + match[0].length;
        while (/\s/.test(html[start] || '') && start < html.length) start++;
        if (html[start] !== '{') continue;
        let depth = 0, quoted = false, escaped = false;
        for (let i = start; i < Math.min(html.length, start + 2000000); i++) {
            const ch = html[i];
            if (quoted) {if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; continue;}
            if (ch === '"') quoted = true;
            else if (ch === '{') depth++;
            else if (ch === '}' && --depth === 0) {
                try {
                    const details = JSON.parse(html.slice(start, i + 1)).videoDetails;
                    if (details?.videoId === videoId && /^UC[\w-]{22}$/.test(details.channelId || '')) return details.channelId;
                } catch {}
                break;
            }
        }
    }
    return null;
}
async function ssResolveShortIdentity(videoId) {
    if (!/^[\w-]{11}$/.test(videoId || '')) throw new Error('Invalid video ID.');
    if (ssShortsPending.has(videoId)) return ssShortsPending.get(videoId);
    if (ssShortsPending.size >= 32) return {channelId: null, retryAfterMs: 30000};
    const task = ssShortsChain.then(async () => {
        const stored = await chrome.storage.local.get([SS_SHORTS_CACHE_KEY, YOUTUBE_BLOCKLIST_KEY]);
        const state = stored[YOUTUBE_BLOCKLIST_KEY];
        if (!state?.enabled || !state.list?.channels?.length) return {channelId: null, retryAfterMs: 600000};
        const cache = stored[SS_SHORTS_CACHE_KEY] || {};
        const hit = cache[videoId];
        if (hit && hit.expires > Date.now()) return {channelId: hit.channelId, retryAfterMs: hit.expires - Date.now()};
        const wait = Math.max(0, 1500 - (Date.now() - ssShortsLastRequest));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        // Recheck after waiting so disabling the feature stops queued network work.
        const latest = (await chrome.storage.local.get(YOUTUBE_BLOCKLIST_KEY))[YOUTUBE_BLOCKLIST_KEY];
        if (!latest?.enabled || !latest.list?.channels?.length) return {channelId: null, retryAfterMs: 600000};
        ssShortsLastRequest = Date.now();
        let channelId = null;
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(`https://www.youtube.com/shorts/${videoId}`, {credentials:'omit', signal:controller.signal});
            if (response.ok) {
                const reader = response.body.getReader(); let bytes = 0, text = '', decoder = new TextDecoder();
                try {
                    while (true) {
                        const {value, done} = await reader.read(); if (done) break;
                        bytes += value.byteLength; if (bytes > 4000000) break;
                        text += decoder.decode(value, {stream:true});
                    }
                } finally {await reader.cancel().catch(() => {});}
                channelId = ssShortsPlayerIdentity(text, videoId);
            }
        } catch {} finally {clearTimeout(timeout);}
        const ttl = channelId ? 7 * 86400000 : 600000;
        cache[videoId] = {channelId, expires:Date.now() + ttl};
        const entries = Object.entries(cache).filter(([,entry]) => entry.expires > Date.now()).sort((a,b) => b[1].expires-a[1].expires).slice(0,500);
        await chrome.storage.local.set({[SS_SHORTS_CACHE_KEY]:Object.fromEntries(entries)});
        return {channelId, retryAfterMs:ttl};
    });
    ssShortsPending.set(videoId, task);
    ssShortsChain = task.catch(() => {});
    try {return await task;} finally {ssShortsPending.delete(videoId);}
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'youtube-shorts-identity') return false;
    let allowed = false;
    try {allowed = sender.id === chrome.runtime.id && /(^|\.)youtube\.com$/.test(new URL(sender.url || sender.tab?.url).hostname);} catch {}
    if (!allowed) {respond({ok:false}); return false;}
    ssResolveShortIdentity(message.videoId).then(result => respond({ok:true,...result})).catch(() => respond({ok:false}));
    return true;
});
