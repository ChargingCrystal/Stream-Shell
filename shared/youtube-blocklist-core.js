/* Shared import validation. No channel list is bundled with Stream Shell. */
function normalizeYoutubeBlocklist(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.channels)) throw new Error('Expected a JSON object with a channels array.');
    if (data.platform && data.platform !== 'youtube') throw new Error('This list is not for YouTube.');
    if (data.channels.length > 20000) throw new Error('Maximum 20,000 channels per list.');
    const channels = new Map();
    for (const entry of data.channels) {
        if (!entry || !/^UC[\w-]{22}$/.test(entry.channelId || '')) throw new Error('Every channel needs a valid YouTube channelId.');
        const handle = typeof entry.handle === 'string' && /^@[^\s/?#]+$/.test(entry.handle) ? entry.handle : '';
        channels.set(entry.channelId, {channelId: entry.channelId, handle, name: String(entry.name || '').slice(0, 200)});
    }
    return {schemaVersion: 1, platform: 'youtube', title: String(data.title || 'YouTube blocklist').slice(0, 200), channels: [...channels.values()]};
}

function normalizeYoutubeFilterState(stored) {
    const lists = Array.isArray(stored?.lists) ? stored.lists :
        stored?.list?.channels?.length ? [{id:'legacy', enabled:true, mode:'blur', text:'on blocklist', list:stored.list}] : [];
    const normalized = lists.map(entry => ({id:String(entry.id),enabled:entry.enabled !== false,
        mode:entry.mode === 'remove' ? 'remove' : 'blur',text:typeof entry.text === 'string' ? entry.text.slice(0,200) : 'on blocklist',list:entry.list}));
    const channels = new Map();
    for (const entry of normalized) if (entry.enabled) for (const channel of entry.list.channels) channels.set(channel.channelId,channel);
    return {enabled:stored?.enabled === true,lists:normalized,list:{channels:[...channels.values()]}};
}
