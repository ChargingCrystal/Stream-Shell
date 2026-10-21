/** v0.20.23: MV3 provider message listener handles sync throws and async failures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let resolver = () => null;
let listener;
let registered = 0;
const events = [];
const adapter = {
    adapterKind: 'fake',
    isWatchContext: () => false,
    resolveMediaUrl: (...args) => resolver(...args),
    linkResolverStrategy: 'test fallback'
};
const ctx = vm.createContext({
    getCurrentProvider: () => 'youtube',
    getProviderAdapter: () => adapter,
    getPrimaryVideo: () => null,
    recordProviderFlightEvent: (action, detail) => events.push({ action, detail }),
    providerApiEmit() {},
    scheduleProviderApiSelfTest() {},
    tryApplyPendingResume() {},
    isProviderOwnedMediaUrl: (_, url) => typeof url === 'string' && url.startsWith('https://www.youtube.com/watch?v='),
    getProviderMediaIdentity: () => 'fallback-identity',
    normalizeProviderResumeUrl: (_, url) => url,
    chrome: {
        runtime: { onMessage: { addListener(fn) { registered++; listener = fn; } } },
        storage: { onChanged: { addListener() {} } }
    },
    document: { addEventListener() {} },
    window: { addEventListener() {} },
    setTimeout() { return 1; },
    PENDING_RESUME_KEY_PREFIX: 'streamShellPendingResume_',
    CONTINUE_WATCHING_COMPLETE_PERCENT_STORAGE_KEY: 'streamShellContinueWatchingCompletePercent',
    continueWatchingCompletePercent: 95,
    providerApiStarted: false,
    providerApiProgressEventAt: 0,
    providerApiLastLaunchSelfTestStartedAt: null
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/provider-api-start.js'), 'utf8'), ctx);
vm.runInContext('startProviderApi(); startProviderApi()', ctx);
assert.equal(registered, 1, 'provider API should install only one message listener');

async function request(message) {
    const replies = [];
    const result = listener(message, {}, response => replies.push(response));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(replies.length, 1, 'every relevant request must receive exactly one response');
    return { result, reply: replies[0] };
}

(async () => {
    let actual = await request({type:'stream-shell-provider-resolve-media-link', provider:'netflix'});
    assert.equal(actual.reply.ok, false);
    assert.match(actual.reply.error, /mismatch/i);

    resolver = () => { throw new Error('player still hydrating'); };
    actual = await request({type:'stream-shell-provider-resolve-media-link', provider:'youtube'});
    assert.equal(actual.result, true, 'listener keeps async MV3 response channel open');
    assert.equal(actual.reply.ok, false);
    assert.match(actual.reply.error, /still hydrating/);

    resolver = () => Promise.reject(new Error('navigation interrupted'));
    actual = await request({type:'stream-shell-provider-resolve-media-link', provider:'youtube'});
    assert.match(actual.reply.error, /navigation interrupted/);

    resolver = () => ({url: 'https://evil.example/watch?v=1'});
    actual = await request({type:'stream-shell-provider-resolve-media-link', provider:'youtube'});
    assert.equal(actual.reply.ok, false, 'non-provider URLs must be refused');

    resolver = () => Promise.resolve({
        url: 'https://www.youtube.com/watch?v=abc',
        identity: 'abc', strategy: 'watch-id', reconstructed: true
    });
    actual = await request({type:'stream-shell-provider-resolve-media-link', provider:'youtube'});
    assert.equal(actual.reply.ok, true);
    assert.equal(actual.reply.result.provider, 'youtube');
    assert.equal(actual.reply.result.url, 'https://www.youtube.com/watch?v=abc');
    assert.equal(actual.reply.result.strategy, 'watch-id');
    assert.equal(actual.reply.result.reconstructed, true);
    assert.equal(events.filter(event => event.action === 'resolved').length, 1,
        'only resolved provider links are recorded as success');
    console.log('Provider media-link resolver sync/async IPC contract: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
