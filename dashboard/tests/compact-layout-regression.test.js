/* Compact 16:9 / 16:10 alignment and shared Landing runtime contract. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('dashboard/dashboard.css');
const html = read('dashboard/dashboard.html');
const native = read('native/titlebar-src/02-Titlebar-Buttons-And-Paint.cs');
assert.doesNotMatch(html, /id=["']subscription-panel["']/);
assert.doesNotMatch(html, /id=["']subscription-sync["']/);
assert.match(html, /id=["']media-hub["']/);
assert.match(html, /class=["']provider-selector["']/);
assert.match(css, /--compact-main-height:\s*calc\(416px \+ var\(--compact-section-gap\) \+ var\(--compact-bottom-height\)\)/);
assert.match(css, /--compact-main-height:\s*calc\(484px \+ var\(--compact-section-gap\) \+ var\(--compact-bottom-height\)\)/);
assert.match(css, /--compact-main-height:\s*calc\(348px \+ var\(--compact-section-gap\) \+ var\(--compact-bottom-height\)\)/);
assert.match(css, /grid-template-rows:\s*repeat\(var\(--compact-provider-count, 5\), minmax\(0, 1fr\)\)/);
assert.match(css, /gap:\s*calc\(var\(--compact-gap\) \* var\(--compact-provider-gap-factor, 1\)\)/);
assert.match(css, /left:\s*calc\(var\(--compact-edge-x\) \+ var\(--compact-provider-width\) \+ var\(--compact-column-gap\)\)/);
assert.match(css, /height:\s*var\(--compact-main-height\)/);
assert.doesNotMatch(css, /body\[data-layout-profile=["']compact["']\].*?\.subscription-panel\s*\{/);
// Both Compact and Wide use the native registry's dynamic titlebar buttons;
// no second Compact list is introduced.
assert.match(native, /providers\s*=\s*DynamicProviderButtons/);
assert.match(native, /ComposeLeftButtons\(compact, providers, paneWidth/);
const source = read('landing/src/subscriptions.js');
const context = vm.createContext({
    subscriptionSyncMeta: null, subscriptionSyncButton: null,
    SUBSCRIPTION_STORAGE_KEY: 'unused', chrome: { storage: { local: { get() { throw Error('compact must not load subscriptions'); } } } }
});
vm.runInContext(source, context);
assert.doesNotThrow(() => vm.runInContext('renderSubscriptionState({items:{}})', context));
Promise.all([
    vm.runInContext('loadSubscriptionState()', context),
    vm.runInContext('syncSubscriptions()', context)
]).then(() => console.log('Compact media expansion, adaptive provider grid, titlebar parity and absent subscriptions: PASS'))
  .catch(error => { console.error(error); process.exitCode = 1; });
