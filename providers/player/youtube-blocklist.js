(() => {
    const KEY = 'streamShellYoutubeBlocklistV1';
    const shorts = 'ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,ytd-shorts-lockup-view-model,yt-shorts-lockup-view-model,ytd-reel-item-renderer,.shortsLockupViewModelHost';
    const cards = shorts + ',ytd-rich-item-renderer,ytd-rich-grid-media,ytd-comment-view-model,ytd-comment-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-playlist-video-renderer,ytd-channel-renderer,ytd-video-owner-renderer,ytd-reel-item-renderer,yt-lockup-view-model,ytm-shorts-lockup-view-model,yt-shorts-lockup-view-model,ytd-reel-player-header-renderer,ytd-c4-tabbed-header-renderer,yt-page-header-renderer';
    const images = 'ytm-shorts-lockup-view-model-v2 img,ytd-shorts-lockup-view-model img,.shortsLockupViewModelHost img,ytm-shorts-lockup-view-model img,yt-shorts-lockup-view-model img,ytd-reel-item-renderer img,ytd-thumbnail video,ytd-video-preview video,ytd-thumbnail img,yt-thumbnail-view-model img,.yt-lockup-view-model__content-image img,.shortsLockupViewModelHostThumbnailContainer img,yt-avatar-shape img,yt-decorated-avatar-view-model img,yt-img-shadow#avatar img,#avatar img,#channel-avatar img,img.ytCoreImageHost';
    let ids = new Set(), handles = new Set(), enabled = false, timer = null, currentState = null;
    const pending = new Set(), marked = new Set(), removed = new Set();
    let idRules = new Map(), handleRules = new Map(), matchedRule = null;
    function matchRule(key, handle = false) {
        const rule = (handle ? handleRules : idRules).get(key);
        if (rule) matchedRule = rule;
        return Boolean(rule);
    }
    const learned = new Map(), resolving = new Set();
    let generation = 0, activeRequests = 0;
    function shortVideoId(card) {
        const link = card.querySelector('a[href*="/shorts/"]');
        try {
            const url = new URL(link?.getAttribute('href'), location.href);
            if (!/(^|\.)youtube\.com$/.test(url.hostname)) return '';
            return url.pathname.match(/^\/shorts\/([\w-]{11})(?:\/|$)/)?.[1] || '';
        } catch {return '';}
    }
    const visibleShorts = new Set();
    const visibility = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) {visibleShorts.add(entry.target); queue(entry.target);}
            else visibleShorts.delete(entry.target);
        }
    }, {rootMargin:'100px'});
    function requestIdentity(card, videoId) {
        if (!videoId || !visibleShorts.has(card) || resolving.has(videoId) || activeRequests >= 2) return;
        const cached = learned.get(videoId);
        if (cached && cached.expires > Date.now()) return;
        resolving.add(videoId); activeRequests++;
        const requestGeneration = generation;
        chrome.runtime.sendMessage({type:'youtube-shorts-identity',videoId}).then(result => {
            learned.set(videoId, {channelId:result?.channelId || null, expires:Date.now() + (result?.retryAfterMs || 30000)});
            if (learned.size > 500) learned.delete(learned.keys().next().value);
            if (enabled && generation === requestGeneration) {
                for (const element of visibleShorts) if (shortVideoId(element) === videoId) queue(element);
            }
        }).catch(() => learned.set(videoId,{channelId:null,expires:Date.now()+30000})).finally(() => {
            resolving.delete(videoId); activeRequests--;
            if (enabled) for (const element of visibleShorts) {if (element.isConnected) queue(element); else visibleShorts.delete(element);}
        });
    }
    function channelMatch(card, allowShelf = true) {
        card.dispatchEvent(new CustomEvent('stream-shell-blocklist-identify', {bubbles: true}));
        const id = card.getAttribute('data-ss-blocklist-channel');
        const videoId = card.matches(shorts) ? shortVideoId(card) : '';
        if (id) {
            if (videoId) learned.set(videoId,{channelId:id,expires:Date.now()+7*86400000});
            return matchRule(id);
        }
        const known = learned.get(videoId);
        if (known?.channelId && known.expires > Date.now()) return matchRule(known.channelId);
        for (const link of card.querySelectorAll('a[href]')) {
            if (link.closest('#description-text,#description,#content-text')) continue;
            try {
                const url = new URL(link.getAttribute('href'), location.href);
                if (!/(^|\.)youtube\.com$/.test(url.hostname)) continue;
                if (url.pathname.startsWith('/channel/')) {
                    if (matchRule(url.pathname.split('/')[2])) return true;
                } else if (url.pathname.startsWith('/@') && matchRule(decodeURIComponent(url.pathname.split('/')[1]).toLowerCase(), true)) return true;
            } catch {}
        }
        if (card.matches('ytd-c4-tabbed-header-renderer,yt-page-header-renderer')) {
            const segment = decodeURIComponent(location.pathname.split('/')[1] || '').toLowerCase();
            return matchRule(segment, true) || (location.pathname.startsWith('/channel/') && matchRule(location.pathname.split('/')[2]));
        }
        if (allowShelf && card.matches(shorts)) {
            const shelf = card.closest('grid-shelf-view-model,yt-grid-shelf-view-model,ytd-reel-shelf-renderer,ytd-rich-shelf-renderer,ytd-shelf-renderer');
            if (shelf) {
                // Read the shelf's own identity, never the first child Short's author.
                shelf.dispatchEvent(new CustomEvent('stream-shell-blocklist-identify', {bubbles:true}));
                const shelfId = shelf.getAttribute('data-ss-blocklist-channel');
                if (shelfId) return matchRule(shelfId);
                const heading = shelf.querySelector('#title,h2,h3');
                if (heading && channelMatch(heading, false)) return true;
                // Search groups can expose the author only in a preceding channel
                // result. Require the explicit "Shorts from …" heading as well.
                const section = shelf.closest('ytd-item-section-renderer');
                const channel = section?.querySelector('ytd-channel-renderer');
                const name = channel?.querySelector('#channel-title,#text.ytd-channel-name,ytd-channel-name')?.textContent?.trim();
                const title = heading?.textContent?.trim() || '';
                const prefix = /^(?:Latest Shorts from|Shorts from|Neueste Shorts von|Shorts von)\s+/i;
                if (name && prefix.test(title) && title.replace(prefix, '').trim() === name && channelMatch(channel, false)) return true;
            }
        }
        if (videoId) requestIdentity(card, videoId);
        return false;
    }
    const geometry = new Map();
    const resize = new ResizeObserver(entries => {
        for (const entry of entries) {
            const item = geometry.get(entry.target);
            if (item) positionLabel(entry.target, item);
        }
    });
    function positionLabel(surface, {img, label}) {
        const box = surface.getBoundingClientRect(), picture = img.getBoundingClientRect();
        label.style.setProperty('left', `${picture.left - box.left + picture.width / 2}px`, 'important');
        label.style.setProperty('top', `${picture.top - box.top + picture.height / 2}px`, 'important');
        label.style.setProperty('font-size', `${Math.max(4, Math.min(25, picture.width / Math.max(8, label.textContent.length * .7), picture.height / Math.max(4, label.textContent.length * .45)))}px`, 'important');
    }
    function unmark(surface) {
        resize.unobserve(surface); geometry.delete(surface);
        surface.classList.remove('ss-blocklist-surface', 'ss-blocklist-position');
        surface.querySelectorAll('.ss-blocklist-image').forEach(img => img.classList.remove('ss-blocklist-image'));
        surface.querySelectorAll(':scope > .ss-blocklist-label').forEach(label => label.remove());
        marked.delete(surface);
    }
    function process(card) {
        if (!card.isConnected) return;
        if (card.matches(shorts)) visibility.observe(card);
        matchedRule = null;
        const blocked = enabled && channelMatch(card);
        const rule = matchedRule;
        card.classList.remove('ss-blocklist-removed'); removed.delete(card);
        for (const surface of [...marked]) if (card.contains(surface)) unmark(surface);
        if (!blocked) return;
        if (rule?.mode === 'remove') {card.classList.add('ss-blocklist-removed'); removed.add(card); return;}
        for (const img of card.querySelectorAll(images)) {
            // Nested cards identify their own channel, never inherit their parent card.
            if (img.closest(cards) !== card) continue;
            const surface = img.closest('ytd-thumbnail,yt-thumbnail-view-model,.shortsLockupViewModelHostThumbnailContainer,.yt-lockup-view-model__content-image') || (img.parentElement?.tagName === 'PICTURE' ? img.parentElement.parentElement : img.parentElement);
            if (!surface) continue;
            img.classList.add('ss-blocklist-image');
            if (getComputedStyle(surface).position === 'static') surface.classList.add('ss-blocklist-position');
            surface.classList.add('ss-blocklist-surface');
            if (!surface.querySelector(':scope > .ss-blocklist-label')) {
                const label = document.createElement('span');
                label.className = 'ss-blocklist-label'; label.textContent = rule?.text ?? 'on blocklist';
                surface.append(label);
                const item = {img, label};
                geometry.set(surface, item); positionLabel(surface, item); resize.observe(surface);
            }
            marked.add(surface);
        }
    }
    function flush() {
        timer = null;
        for (const surface of marked) if (!surface.isConnected) unmark(surface);
        const batch = [...pending].slice(0, 60);
        batch.forEach(card => {pending.delete(card); process(card);});
        if (pending.size) timer = setTimeout(flush, 100);
    }
    function queue(node) {
        if (!(node instanceof Element) || !enabled) return;
        const parent = node.closest(cards);
        if (parent) pending.add(parent);
        node.querySelectorAll(cards).forEach(card => pending.add(card));
        if (pending.size && timer === null) timer = setTimeout(flush, 100);
    }
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') queue(record.target);
            else {
                // Ignore our own labels; their insertion must not trigger a feedback loop.
                const nodes = [...record.addedNodes, ...record.removedNodes];
                if (nodes.length && nodes.every(node => node instanceof Element && node.classList.contains('ss-blocklist-label'))) continue;
                queue(record.target);
            }
        }
    });
    function apply(state) {
        state = normalizeYoutubeFilterState(state);
        currentState = state; generation++;
        for (const card of removed) card.classList.remove('ss-blocklist-removed');
        removed.clear(); idRules.clear(); handleRules.clear();
        for (const entry of state.lists) if (entry.enabled) for (const channel of entry.list.channels) {
            const rule = {mode:entry.mode,text:entry.text};
            if (!idRules.has(channel.channelId) || rule.mode === 'remove') idRules.set(channel.channelId, rule);
            const handle = (channel.handle || '').toLowerCase();
            if (handle && (!handleRules.has(handle) || rule.mode === 'remove')) handleRules.set(handle,rule);
        }
        visibility.disconnect(); visibleShorts.clear();
        observer.disconnect();
        clearTimeout(timer); timer = null; pending.clear();
        [...marked].forEach(unmark);
        ids = new Set((state?.list?.channels || []).map(channel => channel.channelId));
        handles = new Set((state?.list?.channels || []).map(channel => (channel.handle || '').toLowerCase()).filter(Boolean));
        enabled = state?.enabled === true && ids.size > 0;
        if (!enabled) return;
        observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['href','src']});
        queue(document.documentElement);
    }
    let storageRevision = 0;
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) {storageRevision++; apply(changes[KEY].newValue);}
    });
    const revision = storageRevision;
    chrome.runtime.sendMessage({type:'youtube-blocklist-api', action:'get'}).then(result => {
        if (revision === storageRevision && result?.ok) apply(result.state);
    }).catch(() => {});
    document.addEventListener('yt-navigate-finish', () => queue(document.documentElement));
    document.addEventListener('yt-page-data-updated', () => queue(document.documentElement));
    window.addEventListener('pageshow', event => {if (event.persisted) apply(currentState);});
    window.addEventListener('pagehide', () => {observer.disconnect(); resize.disconnect(); visibility.disconnect(); visibleShorts.clear(); generation++; clearTimeout(timer); pending.clear();});
})();
