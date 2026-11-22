/* Read only renderer-local channel identity; no list or extension API enters MAIN. */
(() => {
    function channelIdFromRenderer(data) {
        const seen = new WeakSet();
        let budget = 200;
        function visit(value, depth) {
            if (!value || typeof value !== 'object' || depth > 9 || --budget < 0 || seen.has(value)) return '';
            seen.add(value);
            if (/^UC[\w-]{22}$/.test(value.channelId || '')) return value.channelId;
            if (/^UC[\w-]{22}$/.test(value.browseEndpoint?.browseId || '')) return value.browseEndpoint.browseId;
            // Owner fields first. Do not descend into unrelated recommendation lists.
            for (const key of ['ownerText','shortBylineText','longBylineText','channelName','author','owner','channel','avatar','metadata','videoOwnerRenderer','reelPlayerHeaderRenderer','navigationEndpoint','endpoint','command','onTap','innertubeCommand','browseEndpoint','runs','title','content','pageHeaderViewModel','attribution','lockupMetadataViewModel','contentMetadataViewModel','metadataRows','metadataParts','text','commandRuns','authorEndpoint','videoRenderer','richItemRenderer','lockupViewModel','shortsLockupViewModel','reelItemRenderer','channelRenderer']) {
                const child = value[key];
                for (const item of Array.isArray(child) ? child : [child]) {
                    const id = visit(item, depth + 1);
                    if (id) return id;
                }
            }
            return '';
        }
        return visit(data, 0);
    }
    document.addEventListener('stream-shell-blocklist-identify', event => {
        const node = event.target;
        if (!(node instanceof Element)) return;
        const id = channelIdFromRenderer(node.data || node.__data?.data || node.data_);
        node.setAttribute('data-ss-blocklist-channel', id);
    }, true);
})();
