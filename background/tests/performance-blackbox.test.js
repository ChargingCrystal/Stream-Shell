import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8');
let now = 0;
let visible = 'visible';
let interval;
const calls = [];
const listeners = {};
let perfObserver;
class PerformanceObserverMock {
    constructor(callback) { this.callback = callback; perfObserver = this; }
    observe() {}
}
const sandbox = {
    globalThis: {},
    location: {pathname:'/dashboard/dashboard.html'},
    performance: {now: () => now},
    document: {
        get visibilityState() {return visible;},
        addEventListener(name, cb) { listeners[name] = cb; }
    },
    chrome: {runtime: {sendMessage: async message => {calls.push(message);return {ok:true};}}},
    setInterval(cb, delay) {interval = {cb,delay};return 1;},
    PerformanceObserver: PerformanceObserverMock,
    Map, Number, String, Math, Set
};
vm.runInNewContext(read('shared/performance-watchdog.js'), sandbox);
assert.equal(interval.delay, 1000);
now = 1000; interval.cb();
assert.equal(calls.length,0,'ordinary 1s callback must stay silent');
now = 5000; interval.cb();
assert.equal(calls.length,1,'visible 3s delay must generate incident');
assert.equal(calls[0].incident.kind,'renderer-timer-gap');
assert.equal(calls[0].incident.source,'dashboard');
visible = 'hidden'; listeners.visibilitychange();
now = 90000; interval.cb();
assert.equal(calls.length,1,'hidden renderer must not log background throttle');
visible = 'visible'; listeners.visibilitychange();
now = 91000; interval.cb();
assert.equal(calls.length,1,'first visible callback must not report previous hidden time');
now = 92000; perfObserver.callback({getEntries: () => [{duration:200},{duration:700}]});
assert.equal(calls.length,2,'longtask >=350ms reported');
assert.equal(calls[1].incident.kind,'renderer-long-task');
const native = read('native/titlebar-src/18-Json-Diagnostics-And-Cleanup.cs');
const routing = read('native/titlebar-src/16-Native-Command-Routing.cs');
const lifecycle = read('native/titlebar-src/01-HostLifecycle-And-WindowProc.cs');
const background = read('background/src/00a-flight-recorder.js');
const router = read('background/src/09-message-router.js');
assert.match(native,/performance-.*\.jsonl/);
assert.match(native,/Directory\.CreateDirectory\(PerformanceLogDirectory\)/);
assert.match(native,/private static void StartPerformanceHeartbeatWatchdog/);
assert.match(native,/86400000/);
assert.match(routing,/case "performance-event":/);
assert.match(routing,/MarkPerformanceHeartbeat\(\)/);
assert.match(lifecycle,/StartPerformanceHeartbeatWatchdog\(\)/);
assert.match(background,/STREAM_SHELL_PERFORMANCE_FALLBACK_LIMIT = 240/);
assert.match(background,/titlebarPort\.postMessage\(/);
assert.match(router,/isShellHomeUiSender\(sender\)/);
assert.ok(!read('manifest.json').includes('"downloads"'), 'new download permission unnecessary');
assert.match(read('dashboard/dashboard.html'),/shared\/performance-watchdog\.js/);
assert.match(read('landing/landing.html'),/shared\/performance-watchdog\.js/);
console.log('PASS: perf black box event thresholds, visible-only gap, native JSONL writer, sender boundary');
