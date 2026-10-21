/** v0.20.26: stale resource-governor window snapshots cannot roll back newer state. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/provider-resource-governor.js'), 'utf8');
const pending = [];
const listeners = [];
const ctx = vm.createContext({
    Promise, console,
    document: {
        visibilityState: 'visible', hasFocus: () => false,
        documentElement: { setAttribute() {} }, addEventListener() {}
    },
    window: { addEventListener() {} },
    chrome: { runtime: {
        sendMessage: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
        onMessage: { addListener: listener => listeners.push(listener) }
    } },
    getCurrentProvider: () => 'youtube',
    getProviderAdapter: () => ({ isWatchContext: () => true }),
    getPrimaryVideo: () => null,
    providerApiOn: () => {},
    recordProviderFlightEvent: () => {}
});
vm.runInContext(source, ctx);
const run = expression => vm.runInContext(expression, ctx);
const snapshot = () => run('getProviderResourceGovernorState()');
const state = minimized => ({ managed: true, provider: 'youtube', minimized, shellActive: !minimized, windowState: minimized ? 'minimized' : 'normal' });

(async () => {
    run('startProviderResourceGovernor()'); // request #0 (startup)
    assert.equal(pending.length, 1);
    const older = run('refreshProviderResourceWindowState("old-focus")'); // #1
    const newer = run('refreshProviderResourceWindowState("new-blur")'); // #2
    pending[2].resolve(state(true));
    await newer;
    assert.equal(snapshot().minimized, true, 'newest response should apply');
    pending[1].resolve(state(false));
    await older;
    assert.equal(snapshot().minimized, true, 'stale reply must not undo newer window state');
    pending[0].resolve(state(false));
    await Promise.resolve(); await Promise.resolve();
    assert.equal(snapshot().minimized, true, 'startup reply must not undo a later refresh');

    const pendingOld = run('refreshProviderResourceWindowState("before-push")'); // #3
    assert.equal(listeners.length, 1);
    listeners[0]({ type: 'stream-shell-resource-window-state', state: state(false) });
    assert.equal(snapshot().minimized, false, 'native push should apply immediately');
    pending[3].resolve(state(true));
    await pendingOld;
    assert.equal(snapshot().minimized, false, 'in-flight snapshot must not override native push');

    const latest = run('refreshProviderResourceWindowState("after-push")'); // #4
    pending[4].resolve(state(true));
    await latest;
    assert.equal(snapshot().minimized, true, 'new request after push should be accepted');

    const otherProvider = run('refreshProviderResourceWindowState("foreign")'); // #5
    pending[5].resolve({ ...state(false), provider: 'netflix' });
    await otherProvider;
    assert.equal(snapshot().minimized, true, 'foreign provider state must not replace current provider');

    const error = run('refreshProviderResourceWindowState("ipc-rejected")'); // #6
    pending[6].reject(new Error('extension context invalidated'));
    await error;
    assert.equal(snapshot().minimized, true, 'failed refresh must preserve current state');
    console.log('PASS provider window-state request ordering and native-push precedence');
})().catch(error => { console.error(error); process.exitCode = 1; });
