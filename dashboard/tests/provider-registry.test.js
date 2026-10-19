/* Shared provider registry + Dashboard layout smoke tests.
   Run: node dashboard/tests/provider-registry.test.js */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '../..');
function element(tag = 'div') {
    return {
        tag, children: [], dataset: {}, className: '', textContent: '',
        classList: { toggle() {}, add() {} },
        addEventListener() {}, remove() {},
        setAttribute(name, value) { this[name] = value; },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = [...children]; }
    };
}
const selector = element('section');
const stored = {};
const ctx = vm.createContext({
    URL, console,
    document: { querySelector: s => s === '.provider-selector' ? selector : null, createElement: element },
    chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` }, storage: { local: { set: async payload => Object.assign(stored, payload) } } },
    crypto: { randomUUID: () => '22222222-2222-2222-2222-222222222222' },
    settingsValues: {},
    PROVIDERS: new Set(['youtube','netflix','prime','disney','crunchyroll']),
    PROVIDER_NAMES: { youtube: 'YouTube' },
    currentLeftMode: 'netflix',
    renderProviderPlaybackIndicators() {}, renderAvailabilityIndicators() {},
    settingsCenterIsOpen: () => false,
    console
});
for (const rel of ['shared/provider-registry-core.js','dashboard/src/provider-registry.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx);
}
const exec = expression => vm.runInContext(expression, ctx);
const plain = expr => JSON.parse(JSON.stringify(exec(expr)));
assert.deepEqual(plain('streamShellPinnedProviders(defaultStreamShellProviderRegistry()).map(p => p.id)'), ['youtube','netflix','prime','disney','crunchyroll']);
assert.deepEqual(plain('STREAM_SHELL_PROVIDER_GRID_PATTERNS'), {
    1: [1], 2: [2], 3: [3], 4: [1,2,1], 5: [1,3,1], 6: [2,2,2], 7: [2,3,2]
});
const clean = plain('normalizeStreamShellProviderRegistry({dashboardOrder:["disney","disney","prime","bogus"],providers:[{id:"prime",showOnDashboard:false}]})');
assert.equal(clean.dashboardOrder.length, 5);
assert.equal(clean.dashboardOrder[0], 'disney');
assert.equal(clean.providers.find(p => p.id === 'prime').showOnDashboard, false);
assert.equal(plain('streamShellPinnedProviders(normalizeStreamShellProviderRegistry({providers:[{id:"youtube",showOnDashboard:false},{id:"netflix",showOnDashboard:false},{id:"prime",showOnDashboard:false},{id:"disney",showOnDashboard:false},{id:"crunchyroll",showOnDashboard:false}]})).length'), 1);
for (const url of ['javascript:alert(1)','file:///etc/passwd','http://localhost/','chrome://settings/','https://user:pass@example.com/','https://example.com/\nhttps://evil.com/']) {
    ctx.badUrl = url;
    assert.equal(exec('streamShellValidatedCustomUrl(badUrl)'), null, url);
}
assert.equal(exec('streamShellValidatedCustomUrl("https://example.com/a")'), 'https://example.com/a');
assert.equal(exec('streamShellValidatedArtworkKey("PaRaMoUnT")'), 'paramount');
assert.equal(exec('streamShellValidatedArtworkKey("../escape")'), '');
assert.equal(exec('streamShellValidatedArtworkKey("foo/bar")'), '');
assert.equal(exec('streamShellCustomArtworkPath("paramount", "wide")'), 'assets/backgrounds/custom_paramount_wide.png');
assert.equal(exec('streamShellCustomArtworkPath("paramount", "icon")'), 'assets/providers/custom/custom_paramount_icon.svg');
assert.equal(exec('streamShellCustomArtworkPath("paramount", "wordmark")'), 'assets/providers/custom/custom_paramount_wordmark.svg');

const custom = Array.from({length:9}, (_, i) => ({id:'custom-aaaaaaa'+String(i),kind:'custom',name:'Provider '+i,url:'https://example.com/'+i,enabled:true,showOnDashboard:i<4,showInTitlebar:true}));
ctx.custom = custom;
const norm = plain('normalizeStreamShellProviderRegistry({providers: custom, dashboardOrder: custom.map(p=>p.id)})');
const branded = plain('normalizeStreamShellProviderRegistry({providers:[{id:"custom-aabbccdd",kind:"custom",name:"Example",url:"https://example.com/",artKey:"CuStom_Art"}]})');
assert.equal(branded.providers.find(p => p.id === 'custom-aabbccdd').artKey, 'custom_art');
assert.equal(norm.providers.length,14);
assert.equal(norm.providers.filter(p=>p.enabled && p.showOnDashboard).length,7);
assert.equal(norm.titlebarOrder.length,14);
const bad = plain('normalizeStreamShellProviderRegistry({ providers: [...custom,{id:"custom-aaaaaaa1",kind:"custom",name:"X",url:"https://duplicate.com"},{id:"custom-evil000",kind:"custom",name:"X",url:"javascript:foo"}]})');
assert.equal(bad.providers.length,14);
ctx.registry = norm;
exec('settingsValues[STREAM_SHELL_PROVIDER_REGISTRY_KEY] = registry; syncDashboardProviderIdentities();');
assert.equal(exec('PROVIDERS.has("custom-aaaaaaa1")'), true);
assert.equal(exec('PROVIDER_NAMES["custom-aaaaaaa1"]'), 'Provider 1');
for (let count=1;count<=7;count++) {
    ctx.count=count;
    exec(`streamShellPinnedProviders = () => registry.providers.slice(0,count); renderProviderSelector()`);
    assert.deepEqual(selector.children.map(row=>row.children.length), plain(`STREAM_SHELL_PROVIDER_GRID_PATTERNS[${count}]`));
    assert.equal(Number(selector.dataset.providerCount), count);
    assert.equal(selector.children.flatMap(row=>row.children).length, count);
}
console.log('Shared registry + custom URL validation + all Dashboard layouts: PASS');
