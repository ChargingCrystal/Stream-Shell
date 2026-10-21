/** v0.20.24: named provider work is replaced, never stacked across SPA init. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const timers = new Map();
let nextTimerId = 0;
const context = vm.createContext({
    setTimeout: (fn, ms) => { const id = ++nextTimerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    console,
    getCurrentProvider: () => 'youtube',
    getProviderAdapter: () => ({ isWatchContext: () => false }),
    getPrimaryVideo: () => null,
    document: { visibilityState: 'visible', hasFocus: () => true },
    recordProviderFlightEvent: () => {}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/provider-resource-governor.js'), 'utf8'), context);
const run = text => vm.runInContext(text, context);

(async () => {
    context.firstRuns = 0;
    context.secondRuns = 0;
    run(`var first = createProviderResourceLoop('shared', async () => { firstRuns++; }, 250, 'metadata');`);
    assert.equal(timers.size, 1);
    assert.equal(run('providerResourceGovernorListeners.size'), 1);

    run(`var second = createProviderResourceLoop('shared', async () => { secondRuns++; }, 250, 'metadata');`);
    assert.equal(timers.size, 1, 'replacement must cancel the old timeout');
    assert.equal(run('providerResourceGovernorListeners.size'), 1, 'replacement must unsubscribe the old governor listener');
    assert.equal(run('getProviderResourceGovernorState().workloads.length'), 1);
    run('first.stop(); first.wake();');
    assert.equal(timers.size, 1, 'stopping or waking stale handle cannot touch the replacement');
    assert.equal(run('getProviderResourceGovernorState().workloads.length'), 1);

    const [id, scheduled] = [...timers][0];
    timers.delete(id);
    await scheduled.fn();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(context.firstRuns, 0);
    assert.equal(context.secondRuns, 1);
    assert.equal(timers.size, 1, 'replacement loop must keep scheduling');

    // Replace while a callback is awaiting an external resource.
    context.resolvePending = null;
    run(`var pending = createProviderResourceLoop('awaited', () => new Promise(resolve => { resolvePending = resolve; }), 100, 'dom', { immediate: true });`);
    const pendingId = [...timers].find(([id, task]) => task.ms === 0)?.[0];
    assert.ok(pendingId, 'pending workload is scheduled immediately');
    const pendingCallback = timers.get(pendingId).fn;
    timers.delete(pendingId);
    pendingCallback();
    assert.equal(typeof context.resolvePending, 'function');
    run(`var replacement = createProviderResourceLoop('awaited', async () => {}, 100, 'dom');`);
    context.resolvePending();
    for (let i = 0; i < 15; i++) await Promise.resolve();
    assert.equal([...timers].length, 2, 'settled stale async callback cannot re-arm its timer');
    assert.equal(run('getProviderResourceGovernorState().workloads.length'), 2);

    // Different named loops coexist; stopping one never removes the other.
    run('replacement.stop(); replacement.stop();');
    assert.equal(timers.size, 1);
    assert.equal(run('getProviderResourceGovernorState().workloads.length'), 1);
    run('second.stop();');
    assert.equal(timers.size, 0);
    assert.equal(run('providerResourceGovernorListeners.size'), 0);
    assert.equal(run('getProviderResourceGovernorState().workloads.length'), 0);
    console.log('Provider resource named-loop lifecycle and async teardown: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
