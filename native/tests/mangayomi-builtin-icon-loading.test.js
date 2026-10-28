// The original five providers are preloaded from the fixed LeftButtons array.
// Mangayomi uses the dynamic registry, so it MUST be explicitly preloaded too.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const chrome = read('native/titlebar-src/02-Titlebar-Buttons-And-Paint.cs');
const host = read('native/StreamShellTitlebarHost.cs');
const install = read('native/install-titlebar-helper.ps1');
const status = read('native/titlebar-src/15-Native-ReadLoop-And-Status.cs');
const preload = chrome.match(/private static void LoadButtonIcons\(\)[\s\S]*?private static void DisposeButtonIcons\(\)/)?.[0];
assert.ok(preload, 'find real startup IconCache loader');
assert.match(host, /new ButtonDef\("YT", "youtube", "youtube\.png"/);
assert.match(host, /new ButtonDef\("CR", "crunchyroll", "crunchyroll\.png"/);
assert.match(chrome, /case "mangayomi": return new ButtonDef\("MY", id, "mangayomi\.png"/);
assert.match(preload, /BuiltinProviderButton\("mangayomi"\)/,
  'the pinned Mangayomi icon must enter ButtonIcons at startup, just like five default providers');
assert.match(preload, /ButtonIcons\[button\.Action\] = new Bitmap\(source\)/,
  'check that the preload registers the bitmap under the same action as the renderer');
assert.match(chrome, /ButtonIcons\.TryGetValue\(buttons\[i\]\.Action, out icon\)/,
  'the painter must use the same key as the preload');
assert.match(install, /Join-Path \$IconSourceRoot "mangayomi\.png"/,
  'installer must copy the matching asset');
const png = fs.readFileSync(path.join(root, 'native/titlebar-icons/mangayomi.png'));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.match(status, /mangayomiTitlebarIconLoaded/, 'native diagnostics must expose actual bitmap-cache state');
assert.ok(png.length > 100, 'expect actual raster icon pixels');
console.log('Mangayomi native Titlebar bitmap start-load -> registry -> renderer path: PASS');
