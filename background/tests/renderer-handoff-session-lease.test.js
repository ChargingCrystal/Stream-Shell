/* v0.20.27: MV3 worker restart must not erase the provider -> Twitch startup
 * cooldown. The same session lease covers Twitch -> provider and startup-warm. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = fs.readFileSync(path.join(__dirname, '..', 'src', '00-config-home.js'), 'utf8');
const start = config.indexOf('const STREAM_SHELL_TRANSITION_MAX_WAITERS');
const end = config.indexOf('function openShellHome()', start);
assert.ok(start >= 0 && end > start);

(async () => {
    let now = 1000;
    const session = {};
    const waits = [];
    const events = [];
    const visual = [];
    const liveWindows = new Set([1, 2, 3, 4, 10, 12, 14]);
    class TestDate extends Date { static now() { return now; } }
    const newWorker = () => {
        const ctx = vm.createContext({
            Date: TestDate, Promise, console, shuttingDown: false,
            shellWideFocusCacheReady: true,
            shellWideFocusCache: {
                providerWindows: { youtube: 10, netflix: 12, 'custom-42': 14 },
                workspace: { slots: {a: {windowId: 1}, b: {windowId: 2}, c: {windowId: 3}, d: {windowId: 4}} }
            },
            TWITCH_WORKSPACE_V2_STORAGE_KEY: 'workspace',
            chrome: {
                runtime: { sendMessage: async msg => visual.push(msg) },
                windows: { get: async id => {
                    if (!liveWindows.has(id)) throw new Error('No such window');
                    return {id};
                } },
                storage: { session: {
                    get: async key => ({[key]: session[key]}),
                    set: async values => Object.assign(session, values)
                } }
            },
            setTimeout: (fn, ms) => { waits.push(ms); now += ms; fn(); },
            recordFlightEvent: async evt => events.push(evt)
        });
        vm.runInContext(config.slice(start, end), ctx);
        return ctx;
    };
    const launch = (ctx, kind) => vm.runInContext(
        `runStreamShellWindowTransition('${kind}', async () => Date.now())`, ctx);
    const warmStartup = ctx => vm.runInContext(
        `runStreamShellWindowTransition('startup-warm', async () => { await rememberStreamShellRendererLaunch('provider'); return Date.now(); })`, ctx);

    let worker = newWorker();
    await launch(worker, 'provider:youtube');
    assert.equal(session.streamShellRendererHandoffLease.kind, 'provider');
    now += 2300;
    worker = newWorker(); // MV3 service-worker eviction while YouTube is loading.
    assert.equal(await launch(worker, 'twitch:resume'), 6500,
        'Twitch must respect provider cooldown after a worker restart');
    assert.deepEqual(waits, [3200]);
    assert.equal(events.filter(evt => evt.action === 'renderer-handoff-staggered').at(-1).detail.leaseSource, 'session');
    assert.ok(visual.some(item => item.stage === 'waiting'), 'Twitch loading UI must survive worker restart');
    assert.equal(session.streamShellRendererHandoffLease.kind, 'twitch');

    now += 800;
    worker = newWorker();
    assert.equal(await launch(worker, 'provider:netflix'), 12000,
        'Reverse Twitch -> any provider also survives worker restart');
    assert.deepEqual(waits, [3200, 4700]);

    now += 200;
    worker = newWorker();
    assert.equal(await launch(worker, 'provider:custom-42'), 12200,
        'Same-kind provider navigation must not delay other providers');
    assert.equal(waits.length, 2);

    now += 45000;
    worker = newWorker();
    assert.equal(await launch(worker, 'twitch:resume'), now,
        'Expired session lease must not add a delay');
    assert.equal(waits.length, 2);

    now += 100;
    worker = newWorker();
    await warmStartup(worker); // Hidden last-provider warmup is not named provider:.
    now += 1000;
    worker = newWorker();
    const expected = now + 4500;
    assert.equal(await launch(worker, 'twitch:workspace'), expected,
        'The parked warm provider must also protect a subsequent Twitch cold start');
    assert.equal(events.filter(evt => evt.action === 'renderer-handoff-staggered').at(-1).detail.leaseSource, 'session');
    assert.deepEqual(waits, [3200, 4700, 4500]);
    assert.equal(session.streamShellRendererHandoffLease.kind, 'twitch');
    assert.equal(session.streamShellRendererHandoffLease.at, now);

    // The hidden race in 0.20.26: the cache still contains four integers,
    // but one/all Twitch popups have been destroyed by Opera. The short warm
    // handoff must not be used on an actual cold 4-slot recreation.
    now += 33000;
    worker = newWorker();
    now += 31000; // Allow the worker-local 30s startup-cold interval to expire.
    await launch(worker, 'provider:youtube');
    now += 2000;
    liveWindows.delete(4);
    const startCold = now;
    assert.equal(await launch(worker, 'twitch:resume'), startCold + 3500,
        'Stale A-D popup ID must select 5.5s cold grace, not the 3s warm grace');
    assert.equal(events.filter(evt => evt.action === 'renderer-handoff-staggered').at(-1).detail.cold, true);
    liveWindows.add(4);
    now += 31000;
    await launch(worker, 'provider:netflix');
    now += 1000;
    const warmStart = now;
    assert.equal(await launch(worker, 'twitch:resume'), warmStart + 2000,
        'Four verified live Twitch popups may use the 3s warm grace');
    assert.equal(events.filter(evt => evt.action === 'renderer-handoff-staggered').at(-1).detail.cold, false);
    console.log('Cross-surface MV3 session lease, both directions, custom provider, warm startup: PASS');
})().catch(err => { console.error(err); process.exitCode = 1; });
