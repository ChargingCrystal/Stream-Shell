/* Internal extension API: imports are explicit; the default list is empty. */
const YOUTUBE_BLOCKLIST_KEY = 'streamShellYoutubeBlocklistV1';
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'youtube-blocklist-api') return false;
    const run = async () => {
        const dashboard = isDashboardSender(sender);
        let youtube = false;
        try { youtube = /(^|\.)youtube\.com$/.test(new URL(sender.url || sender.tab?.url).hostname); } catch {}
        if (sender.id !== chrome.runtime.id || (!dashboard && !(youtube && message.action === 'get'))) throw new Error('Unsupported sender.');
        const stored = await chrome.storage.local.get(YOUTUBE_BLOCKLIST_KEY);
        let state = normalizeYoutubeFilterState(stored[YOUTUBE_BLOCKLIST_KEY]);
        if (message.action === 'import') {
            if (state.lists.length >= 30) throw new Error('Maximum 30 filter lists.');
            state.lists.push({id:crypto.randomUUID(),enabled:true,mode:'blur',text:'on blocklist',list:normalizeYoutubeBlocklist(message.data)});
            state.enabled = true;
        } else if (message.action === 'enable') {
            state = {...state, enabled: message.enabled === true};
        } else if (message.action === 'remove') {
            state.lists = message.listId ? state.lists.filter(entry => entry.id !== message.listId) : [];
        } else if (message.action === 'update') {
            const entry = state.lists.find(entry => entry.id === message.listId);
            if (!entry) throw new Error('Filter list not found.');
            if (typeof message.enabled === 'boolean') entry.enabled = message.enabled;
            if (['blur','remove'].includes(message.mode)) entry.mode = message.mode;
            if (typeof message.text === 'string') entry.text = message.text.slice(0,200);
        } else if (message.action !== 'get') throw new Error('Unknown blocklist action.');
        state = normalizeYoutubeFilterState(state);
        if (message.action !== 'get') await chrome.storage.local.set({[YOUTUBE_BLOCKLIST_KEY]: state});
        return {ok: true, state};
    };
    run().then(respond).catch(error => respond({ok: false, error: String(error.message || error)}));
    return true;
});
