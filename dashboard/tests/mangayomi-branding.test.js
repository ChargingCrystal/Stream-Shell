/* Mangayomi is a native LEFT identity with normal Dashboard/Titlebar visuals.
 * Source/asset regression; Windows paint and font rendering still require a live test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const state = read('dashboard/src/state.js');
const view = read('dashboard/src/shell-state.js');
const theme = read('dashboard/dashboard.css');
const chrome = read('native/titlebar-src/02-Titlebar-Buttons-And-Paint.cs');
const chromeTheme = read('native/titlebar-src/07-Chrome-Theme.cs');
const icon = read('assets/providers/icons/mangayomi.svg');
const wordmark = read('assets/providers/wordmarks/mangayomi.svg');

assert.match(state, /mangayomi:\s*"Mangayomi"/);
assert.match(state, /mangayomi:\s*"assets\/providers\/wordmarks\/mangayomi\.svg"/);
assert.match(state, /const PROVIDERS\s*=\s*new Set\(\["youtube", "netflix", "prime", "disney", "crunchyroll"\]\)/,
    'the native app must not become a browser player/reload adapter');
assert.match(view, /streamShellPersistentBackgroundProvider/);
const vm = require('node:vm');
const context = vm.createContext({URL});
vm.runInContext(read('shared/provider-registry-core.js'), context);
assert.equal(vm.runInContext('streamShellPersistentBackgroundProvider({leftMode:"mangayomi",activeProvider:"youtube"},defaultStreamShellProviderRegistry())',context),'mangayomi',
    'native left identity must win over stale activeProvider');
assert.match(theme, /body\[data-provider="mangayomi"\]\s*\{\s*--accent-rgb:\s*239, 68, 68/);
assert.match(chrome, /case "mangayomi": return new ButtonDef\("MY", id, "mangayomi\.png"/);
assert.match(chrome, /action == "crunchyroll" \|\| action == "mangayomi"\)/,
    'normal active-state pipeline must recognize the native provider');
assert.match(chrome, /active \? chromeTheme\.Active : chromeTheme\.Hover/,
    'native provider must inherit existing hover/active paint behavior');
assert.match(chromeTheme, /mode, "mangayomi", StringComparison\.OrdinalIgnoreCase\)\)\s*return CustomChromeTheme\("#EF4444"\)/);
assert.match(chromeTheme, /!String\.IsNullOrEmpty\(button\.AccentColor\)/,
    'saved provider titlebar color overrides must remain respected');
assert.match(icon, /fill="#BE1521"|fill="#E30D19"|fill="#E30A17"/,
    "provider icon must contain the traced Mangayomi red artwork");
assert.match(icon, /<svg[^>]+width="2089"[^>]+height="2089"/,
    "provider icon must use the supplied traced SVG asset");
assert.match(wordmark, /font-family=\"OpenDyslexic/);
assert.match(wordmark, /Mangayomi<\/text>/);
assert.match(wordmark, /href="data:image\/png;base64,/, 'wordmark icon must be self-contained when embedded as an img');
assert.match(wordmark, /viewBox="0 0 680 128"/, 'avoid enormous intrinsic whitespace that shrinks the wordmark');
const nativeIcon = fs.readFileSync(path.join(root, 'native/titlebar-icons/mangayomi.png'));
assert.equal(nativeIcon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(nativeIcon.readUInt32BE(16), 64);
assert.equal(nativeIcon.readUInt32BE(20), 64);
assert.match(read('native/install-titlebar-helper.ps1'), /mangayomi\.png/);
console.log('Mangayomi Dashboard wordmark, icon, native Titlebar hover/active and palette: PASS');
