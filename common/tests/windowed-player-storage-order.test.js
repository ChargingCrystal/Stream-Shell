/** v0.20.29: windowed-player display-scoped settings must not regress on rapid storage events. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const BASE = 'streamShellWindowedPlayer_youtube';
const SCOPED = `${BASE}__16_10`;

function makePage(initial) {
    const history = [];
    const listeners = [];
    const context = vm.createContext({
        Promise,
        Set,
        Map,
        console,
        getCurrentProvider: () => 'youtube',
        WINDOWED_PLAYER_PROVIDERS: new Set(['youtube']),
        getWindowedPlayerStorageKey: () => BASE,
        displayScopedStorageKey: key => `${key}__16_10`,
        readDisplayScopedSetting: (stored, base, fallback) => {
            if (Object.prototype.hasOwnProperty.call(stored, `${base}__16_10`)) return stored[`${base}__16_10`];
            return Object.prototype.hasOwnProperty.call(stored, base) ? stored[base] : fallback;
        },
        getProviderAdapter: () => ({
            extensions: { windowedPlayer: {
                storageKeys: ['windowedOther'],
                hydrate(stored) { history.push(['hydrate', stored.windowedOther]); },
                handleStorageChanges(changes) { return 'windowedOther' in changes; },
                start() { history.push(['start']); }
            }}
        }),
        syncWindowedPlayerMode: (provider, enabled) => history.push(['sync', provider, enabled]),
        window: { addEventListener: (name, fn) => listeners.push(['window', name, fn]) },
        chrome: { storage: {
            local: { get: async () => {
                history.push(['read']);
                return { ...initial };
            }},
            onChanged: { addListener: fn => listeners.push(['storage', fn]) }
        }}
    });
    vm.runInContext(source('provider-resource-governor.js'), context);
    vm.runInContext(source('windowed-player-start.js'), context);
    const change = (data, area = 'local') => {
        const listener = listeners.find(x => x[0] === 'storage')?.[1];
        assert.ok(listener, 'storage subscription was registered');
        listener(data, area);
    };
    const syncs = () => history.filter(x => x[0] === 'sync').map(x => x[2]);
    const reads = () => history.filter(x => x[0] === 'read').length;
    return { context, history, listeners, change, syncs, reads };
}

(async () => {
    const page = makePage({ [BASE]: true, [SCOPED]: false, windowedOther: 'first' });
    await page.context.startWindowedPlayer();
    assert.deepEqual(page.syncs(), [false], 'scoped false must beat legacy true');
    assert.equal(page.reads(), 1, 'one hydration read');
    assert.equal(page.listeners.filter(x => x[0] === 'storage').length, 1);
    assert.equal(page.listeners.filter(x => x[0] === 'window').length, 1);

    // Legacy changes cannot displace an explicit scoped override.
    page.change({ [BASE]: { oldValue: true, newValue: false } });
    page.change({ [BASE]: { oldValue: false, newValue: true } });
    assert.deepEqual(page.syncs(), [false], 'legacy writes must not override an active scoped key');

    // Removing the scoped override immediately exposes the latest legacy value.
    page.change({ [SCOPED]: { oldValue: false, newValue: undefined } });
    assert.deepEqual(page.syncs(), [false, true]);
    page.change({ [BASE]: { oldValue: true, newValue: false } });
    assert.deepEqual(page.syncs(), [false, true, false]);

    // One storage event can change both keys. Explicit scoped value wins.
    page.change({
        [BASE]: { newValue: true },
        [SCOPED]: { newValue: false }
    });
    assert.deepEqual(page.syncs(), [false, true, false, false]);
    page.change({
        [BASE]: { newValue: false },
        [SCOPED]: { newValue: true }
    });
    assert.equal(page.syncs().at(-1), true);
    page.change({ [SCOPED]: { oldValue: true, newValue: undefined } });
    assert.equal(page.syncs().at(-1), false, 'scoped deletion must reveal most recent base value');

    // A synchronous cascade of changes must be settled in event order. There
    // must be no outstanding storage.get callback capable of rolling it back.
    page.change({ [BASE]: { newValue: true } });
    page.change({ [SCOPED]: { newValue: false } });
    page.change({ [SCOPED]: { newValue: true } });
    page.change({ [SCOPED]: { newValue: undefined } });
    assert.equal(page.syncs().at(-1), true);
    await Promise.resolve();
    assert.equal(page.syncs().at(-1), true);
    assert.equal(page.reads(), 1, 'no asynchronous re-reads on storage change');

    // Unrelated keys or other storage areas do not affect the feature.
    const count = page.syncs().length;
    page.change({ [BASE]: { newValue: false } }, 'session');
    page.change({ unrelated: { newValue: false } });
    assert.equal(page.syncs().length, count);
    page.change({ windowedOther: { newValue: 'updated' } });
    assert.equal(page.syncs().length, count + 1, 'extension-owned settings still resync');

    // A second feature entry must not register any new listeners or hydrate again.
    await page.context.startWindowedPlayer();
    assert.equal(page.reads(), 1);
    assert.equal(page.listeners.filter(x => x[0] === 'storage').length, 1);

    const fallbackPage = makePage({ [BASE]: true });
    await fallbackPage.context.startWindowedPlayer();
    assert.deepEqual(fallbackPage.syncs(), [true]);
    fallbackPage.change({ [SCOPED]: { newValue: false } });
    fallbackPage.change({ [BASE]: { newValue: false } });
    assert.equal(fallbackPage.syncs().at(-1), false);
    fallbackPage.change({ [SCOPED]: { newValue: undefined }, [BASE]: { newValue: true } });
    assert.equal(fallbackPage.syncs().at(-1), true);
    assert.equal(fallbackPage.reads(), 1);

    console.log('PASS windowed-player scoped storage: atomic overrides, fallback, no delayed reads, one owner');
})().catch(error => { console.error(error); process.exitCode = 1; });
