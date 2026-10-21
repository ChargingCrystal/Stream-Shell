/** v0.20.23: provider-specific factories inherit capabilities and media snapshots
 * from the resolved adapter, not from a stale base adapter closure. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceRoot = path.join(__dirname, '../src');
const names = ['disney', 'netflix', 'crunchyroll', 'prime', 'youtube'];
const events = [];
const fakeVideo = { duration: 120 };
const location = { href: 'https://example.test/watch/1', origin: 'https://example.test' };
const ctx = vm.createContext({
    PROVIDERS: Object.fromEntries(names.map(name => [name, { label: name }])),
    window: { location },
    getCurrentProvider: () => 'disney',
    getPrimaryVideo: () => fakeVideo,
    getPlaybackSnapshot: () => ({ duration: 120, currentTime: 30, playbackState: 'paused' }),
    isWatchContext: () => true,
    getProviderTitle: () => 'Generic title',
    getProviderArtwork: () => 'Generic image',
    getProviderMediaIdentity: () => 'identity',
    normalizeProviderResumeUrl: (_, url) => url,
    resolveProviderMediaLink: () => null,
    recordProviderFlightEvent: (action, event) => events.push({ action, event })
});
vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'provider-api-core.js'), 'utf8'), ctx);

for (const name of names) {
    vm.runInContext(`registerProviderAdapter(${JSON.stringify(name)}, base => ({
        ...base, adapterKind: ${JSON.stringify(name)},
        extensions: { uniqueFeature: { id: ${JSON.stringify(name)} } },
        getExtensionCapabilities: () => ({ uniqueFeature: { supported: true, available: true, state: ${JSON.stringify(name)} } }),
        getTitle: () => ${JSON.stringify(name + ' title')}
    }));`, ctx);

    const adapter = vm.runInContext(`getProviderAdapter(${JSON.stringify(name)})`, ctx);
    assert.equal(adapter.id, name);
    assert.equal(adapter.adapterKind, name);
    assert.equal(adapter.getCapabilities().extensions.uniqueFeature.state, name,
        `${name} capabilities must consult the resolved adapter (not the base closure)`);
    assert.equal(vm.runInContext(`getProviderAdapter(${JSON.stringify(name)})`, ctx), adapter,
        'resolved adapter must remain cached');
    assert.equal(typeof adapter.getMediaSnapshot, 'function');
}

// A provider deliberately overriding the generic contract keeps its own semantics.
vm.runInContext(`registerProviderAdapter('disney', base => ({
    ...base, adapterKind: 'custom-disney', getCapabilities: () => ({ custom: true })
}));`, ctx);
assert.equal(vm.runInContext(`getProviderAdapter('disney').getCapabilities().custom`, ctx), true,
    'explicit factory capability overrides must not be replaced');
// Restore the ordinary adapter contract for the snapshot checks below.
vm.runInContext(`registerProviderAdapter('disney', base => ({
    ...base, adapterKind: 'disney', getTitle: () => 'disney title'
}));`, ctx);

(async () => {
    for (const name of names) {
        const adapter = vm.runInContext(`getProviderAdapter(${JSON.stringify(name)})`, ctx);
        const snapshot = await adapter.getMediaSnapshot();
        assert.equal(snapshot.title, name + ' title', 'snapshot must use the resolved provider title getter');
        assert.equal(snapshot.provider, name);
    }
    assert.equal(events.filter(event => event.action === 'initialized').length, names.length + 2,
        'adapter init must happen once per cached factory generation');

    // Real provider files must not redeclare common bindings. YouTube intentionally
    // keeps its specialized cached getMediaSnapshot implementation.
    for (const name of names) {
        const source = fs.readFileSync(path.join(sourceRoot, `provider-adapter-${name}.js`), 'utf8');
        assert.doesNotMatch(source, /adapter\.getCapabilities\s*=/, `${name} must inherit common capability binding`);
        if (name !== 'youtube') {
            assert.doesNotMatch(source, /adapter\.getMediaSnapshot\s*=/, `${name} must inherit common media snapshot`);
        } else {
            assert.match(source, /async getMediaSnapshot\s*\(/, 'YouTube must retain its cached snapshot override');
        }
    }
    console.log('Provider API adapter capability and snapshot contracts: PASS');
})().catch(err => { console.error(err); process.exitCode = 1; });
