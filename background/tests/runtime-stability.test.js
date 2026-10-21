/* v0.20.1: bounded diagnostics writes + explicit window-transition backpressure. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const scheduled = new Map();
let nextTimer = 1;
const setTimeoutFake = (fn, ms) => { const id = nextTimer++; scheduled.set(id, { fn, ms }); return id; };
const clearTimeoutFake = id => scheduled.delete(id);
const storage = {};
let writes = 0;
let releasePendingWrite = null;
let blockWrites = false;
const warnings = [];
const ctx = vm.createContext({
    console: { warn: (...args) => warnings.push(args), log() {} },
    Date, Promise, setTimeout: setTimeoutFake, clearTimeout: clearTimeoutFake,
    PROVIDERS: { youtube: {} },
    chrome: {
        runtime: { getURL: name => `chrome-extension://test/${name}` },
        storage: {
            session: {
                get: async key => ({ [key]: storage[key] }),
                set: async value => {
                    writes++;
                    if (blockWrites) await new Promise(resolve => { releasePendingWrite = resolve; });
                    Object.assign(storage, value);
                }
            },
            local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
            onChanged: { addListener() {} }
        }
    }
});
for (const f of ['background/src/00a-flight-recorder.js', 'background/src/00-config-home.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext(code, ctx);
const drainMicrotasks = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function fireOneTimer() {
    const [id, task] = scheduled.entries().next().value || [];
    assert.ok(id, 'expected a scheduled timer');
    scheduled.delete(id);
    task.fn();
    await drainMicrotasks();
}
(async () => {
    const writesBefore = writes;
    for (let i = 0; i < 251; i++) {
        await run(`recordFlightEvent({action:'event${i}',category:'test'})`);
    }
    assert.equal(writes, writesBefore, 'event production must not persist per-event');
    assert.equal(scheduled.size, 1, 'a burst must schedule a single flush');
    assert.equal((await run('getFlightRecorderSnapshot()' )).count, 80, 'ring must remain bounded');
    blockWrites = true;
    await fireOneTimer();
    assert.equal(writes, 1, 'burst must persist only one snapshot');
    for (let i = 0; i < 25; i++) await run(`recordFlightEvent({action:'next${i}'})`);
    assert.equal(scheduled.size, 0, 'no writes may pile up during a stalled write');
    blockWrites = false;
    releasePendingWrite();
    await drainMicrotasks();
    assert.equal(scheduled.size, 1, 'dirty in-flight batch schedules one follow-up');
    await fireOneTimer();
    assert.equal(writes, 2, 'follow-up snapshot persists latest events');
    assert.equal(storage.streamShellFlightRecorder.events.at(-1).action, 'next24');
    assert.equal((await run('getFlightRecorderSnapshot()')).persistence.storageFailures, 0);

    let releaseFirst;
    const order = [];
    ctx.order = order;
    ctx.first = () => new Promise(resolve => { releaseFirst = () => { order.push('end1'); resolve('one'); }; });
    ctx.second = () => { order.push('start2'); return Promise.resolve('two'); };
    ctx.third = () => { order.push('start3'); return Promise.resolve('three'); };
    const a = run('runStreamShellWindowTransition("first", async () => { order.push("start1"); return first(); })');
    await drainMicrotasks();
    const b = run('runStreamShellWindowTransition("second", second)');
    const c = run('runStreamShellWindowTransition("third", third)');
    await assert.rejects(run('runStreamShellWindowTransition("fourth", () => Promise.resolve())'), /busy switching/);
    await drainMicrotasks();
    assert.deepEqual(order, ['start1']);
    releaseFirst();
    assert.deepEqual(await Promise.all([a, b, c]), ['one', 'two', 'three']);
    assert.deepEqual(order, ['start1', 'end1', 'start2', 'start3']);
    assert.equal(run('streamShellTransitionWaiters'), 0);
    // Rejections release the lock, rather than poisoning it for future clicks.
    await assert.rejects(run('runStreamShellWindowTransition("broken", () => Promise.reject(Error("bad")))'), /bad/);
    assert.equal(await run('runStreamShellWindowTransition("recovery", () => Promise.resolve("ok"))'), 'ok');
    console.log('Runtime stability: bounded diagnostics persistence and transition FIFO: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
