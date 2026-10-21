/* v0.20.1: persistent callback failure must not cause a hot retry loop. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const timers = new Map();
let next = 1;
const warnings = [];
const ctx = vm.createContext({
    console: { warn: (...args) => warnings.push(args) },
    setTimeout: (fn, ms) => { const id = next++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    getCurrentProvider: () => 'youtube',
    getProviderAdapter: () => ({ isWatchContext: () => false }),
    getPrimaryVideo: () => null,
    document: { visibilityState: 'visible', hasFocus: () => true },
    recordProviderFlightEvent: () => {},
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/provider-resource-governor.js'), 'utf8'), ctx);
const run = code => vm.runInContext(code, ctx);
async function step() {
    const [id, item] = timers.entries().next().value || [];
    assert.ok(id);
    timers.delete(id);
    item.fn();
    for (let i=0;i<10;i++) await Promise.resolve();
}
(async () => {
    ctx.calls = 0;
    run(`var work = createProviderResourceLoop('test', async () => {
       calls++;
       if (calls < 4) throw new Error('simulated failure');
    }, 100, 'poll', { immediate: true })`);
    assert.equal(timers.size, 1);
    await step();
    assert.equal(run('getProviderResourceGovernorState().workloads[0].consecutiveFailures'), 1);
    assert.ok([...timers.values()][0].ms >= 2000);
    await step();
    assert.ok([...timers.values()][0].ms >= 4000);
    await step();
    assert.ok([...timers.values()][0].ms >= 8000);
    await step();
    assert.equal(run('getProviderResourceGovernorState().workloads[0].consecutiveFailures'), 0);
    assert.ok([...timers.values()][0].ms < 2000, 'success restores normal pacing');
    assert.equal(run('getProviderResourceGovernorState().workloads[0].totalFailures'), 3);
    assert.equal(warnings.length, 2, 'warn first and powers-of-two failures only');
    run('work.stop()');
    assert.equal(timers.size, 0);
    console.log('Provider governor exponential backoff + recovery: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
