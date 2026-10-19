/* Run: node dashboard/tests/provider-settings-layout.test.js */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../..');
const ctx = vm.createContext({
    console, URL, settingsValues: {},
    escapeSettingsHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    settingsSubgroup: (title, content) => `<section class="settings-subgroup"><h3>${title}</h3>${content}</section>`,
    settingsPage: (title, content) => `<main><h2>${title}</h2>${content}</main>`,
    document: { querySelector: selector => ctx.dom[selector] || null },
    dom: {}
});
for (const name of ['shared/provider-registry-core.js', 'dashboard/src/provider-registry.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), ctx);
}
const expr = code => vm.runInContext(code, ctx);
const custom = {
    id: 'custom-abcdef12', kind: 'custom', name: 'Paramount+', url: 'https://www.paramountplus.com/',
    icon: 'P+', artKey: 'paramount', enabled: true, showInTitlebar: true,
    showOnDashboard: true, titlebarColor: '#6E2FC1'
};
ctx.customProvider = custom;
expr('settingsValues[STREAM_SHELL_PROVIDER_REGISTRY_KEY] = normalizeStreamShellProviderRegistry({providers:[customProvider]})');
const html = expr('renderProviderRegistrySettings()');
assert.match(html, /settings-provider-registry-columns/);
assert.match(html, /settings-custom-provider-fields/);
assert.match(html, /settings-custom-provider-bottom/);
assert.equal((html.match(/data-registry-enabled=/g) || []).length, 6);
assert.equal((html.match(/data-registry-titlebar-visible=/g) || []).length, 6);
assert.equal((html.match(/data-registry-titlebar-color-picker=/g) || []).length, 6);
assert.equal((html.match(/data-artwork-path=/g) || []).length, 5);
const initial = {
    icon: 'assets/providers/custom/custom_key_icon.svg',
    wordmark: 'assets/providers/custom/custom_key_wordmark.svg',
    native: 'native/titlebar-icons/custom/custom_key.png',
    wide: 'assets/backgrounds/custom_key_wide.png',
    compact: 'assets/backgrounds/custom_key_compact.png'
};
for (const value of Object.values(initial)) assert.ok(html.includes(value), value);
for (const [kind, text] of Object.entries(initial)) {
    ctx.dom[`[data-artwork-path="${kind}"]`] = { textContent: text };
}
expr('updateStreamShellLocalArtworkHints("PARAMOUNT")');
for (const [kind, node] of Object.entries(ctx.dom)) {
    assert.ok(node.textContent.includes('paramount'), `${kind} must be updated without rerendering`);
}
expr('editingStreamShellProviderId = "custom-abcdef12"');
const edit = expr('renderProviderRegistrySettings()');
assert.match(edit, /custom_paramount\.png/);
assert.match(edit, /id="settings-custom-provider-cancel"/);
const css = fs.readFileSync(path.join(root, 'dashboard/dashboard.css'), 'utf8');
assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /minmax\(0, 25fr\) minmax\(80px, 10fr\) minmax\(0, 65fr\)/);
assert.match(css, /max-width: 1360px/);
assert.ok(!html.includes('never include custom artwork'));
console.log('Provider settings layout, paths, edit controls and dynamic artwork hints: PASS');
