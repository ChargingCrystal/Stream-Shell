/* Landing/Dashboard wide panorama parity + custom SVG-only artwork.
 * Run: node landing/tests/provider-background.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const registrySource = fs.readFileSync(path.join(root, 'shared/provider-registry-core.js'), 'utf8');
const landingSource = fs.readFileSync(path.join(__dirname, '..', 'src/orchestrator.js'), 'utf8');
const beginning = landingSource.indexOf('function landingProviderBackground(provider, variant) {');
assert.ok(beginning !== -1, 'landing resolver must exist');
const ending = landingSource.indexOf('\n\n/*\n * ============================================================\n * BACKGROUND STATE', beginning);
assert.ok(ending > beginning, 'landing resolver has canonical boundary');
const snippet = landingSource.slice(beginning, ending);
const context = vm.createContext({
    URL,
    chrome: { runtime: { getURL: p => `chrome-extension://example/${p}` } },
});
vm.runInContext(registrySource, context);
vm.runInContext(`let landingProviderRegistry = normalizeStreamShellProviderRegistry({providers: [
    {id: 'custom-aaaaaaaa', kind: 'custom', name: 'Paramount+', url: 'https://example.com', artKey: 'PaRaMoUnT'},
    {id: 'custom-bbbbbbbb', kind: 'custom', name: 'No Art', url: 'https://example.org'}
]});\n${snippet}`, context);
const run = js => vm.runInContext(js, context);
const wide = run('landingProviderBackground("custom-aaaaaaaa", "wide")');
assert.equal(wide.provider, 'custom-aaaaaaaa');
assert.match(wide.image, /assets\/backgrounds\/custom_paramount_wide\.png/);
assert.match(wide.image, /linear-gradient/);
const compact = run('landingProviderBackground("custom-aaaaaaaa", "compact")');
assert.match(compact.image, /assets\/backgrounds\/custom_paramount_compact\.png/);
const builtin = run('landingProviderBackground("netflix", "wide")');
assert.match(builtin.image, /assets\/backgrounds\/netflix_wide\.png/);
const missing = run('landingProviderBackground("custom-bbbbbbbb", "wide")');
assert.equal(missing.provider, 'custom-bbbbbbbb');
assert.doesNotMatch(missing.image, /url\(/);
assert.match(missing.image, /linear-gradient/);
assert.equal(run('landingProviderBackground("not-known", "wide").provider'), 'netflix');
assert.equal(run('streamShellCustomArtworkPath("paramount", "icon")'), 'assets/providers/custom/custom_paramount_icon.svg');
assert.equal(run('streamShellCustomArtworkPath("paramount", "wordmark")'), 'assets/providers/custom/custom_paramount_wordmark.svg');
assert.equal(run('streamShellCustomArtworkPath("paramount", "wide")'), 'assets/backgrounds/custom_paramount_wide.png');
assert.ok(landingSource.includes('changes[STREAM_SHELL_PROVIDER_REGISTRY_KEY]'), 'live registry change listener');
assert.ok(landingSource.includes('landingProviderRegistryUpdated'), 'late async read guard');
const bundle = fs.readFileSync(path.join(__dirname, '..', 'landing.js'), 'utf8');
assert.ok(bundle.startsWith(registrySource), 'standalone Landing bundle includes validated shared registry');
console.log('Landing shared background, Compact art, SVG-only icons and dynamic registry: PASS');
