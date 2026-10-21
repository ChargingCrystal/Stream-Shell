'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'background/src/06-titlebar.js'), 'utf8');
const begin = src.indexOf('function stopTitlebarReconcileLoop()');
const end = src.indexOf('function requestTitlebarFocus(', begin);
assert.ok(begin !== -1 && end > begin);
const body = src.slice(begin, end);
let heartbeat = 0;
let providerRetries = 0;
let claims = 0;
let focusedClaims = 0;
const timers = [];
const native = { postMessage(message) { assert.equal(message.type,'heartbeat'); heartbeat++; } };
const context = vm.createContext({
    Date, Promise, console, setInterval(cb, ms) { timers.push({ cb, ms }); return timers.length; },
    clearInterval() {},
    titlebarPort: native, titlebarProtocolReady: true, shuttingDown: false,
    titlebarReconcileTimer: null, TITLEBAR_RECONCILE_INTERVAL_MS: 2500, TITLEBAR_PROTOCOL_VERSION: 9,
    titlebarProviderGeneration: 2, titlebarProviderAckGeneration: 1,
    streamShellDisplayProfileCache: { mode: 'wide' },
    shellWideFocusCacheReady: true, shellWideFocusVisibility: 'none',
    claimFocusedTitlebarSurface: async () => { focusedClaims++; },
    reconcileTwitchWorkspaceV2Claims: async () => { claims++; },
    sendTitlebarProviderPayload: () => { providerRetries++; }
});
vm.runInContext(body, context);
const execute = text => vm.runInContext(text, context);
async function tick(count) {
    for (let i=0; i<count; i++) { timers[0].cb(); await new Promise(resolve => setImmediate(resolve)); }
}
(async () => {
    execute('startTitlebarReconcileLoop()');
    assert.equal(timers.length,1);

    await tick(12);
    assert.equal(heartbeat,12,'native freshness heartbeat remains active');
    assert.equal(providerRetries,3,'provider ACK retries must keep running during game');
    assert.equal(focusedClaims,0,'do not inspect Opera while game owns Wide focus');
    assert.equal(claims,0,'do not audit Twitch HWNDs while game owns Wide focus');
    assert.equal(execute('titlebarSlowReconcileSkippedUnmanaged'),3);

    execute("shellWideFocusVisibility = 'shell'");
    await tick(4);
    assert.equal(heartbeat,16);
    assert.equal(focusedClaims,1,'self-heal resumes after focus returns');
    assert.equal(claims,1);
    assert.equal(execute('shouldDeferTitlebarSlowReconcile()'),false);

    execute("shellWideFocusVisibility = 'none'; shellWideFocusCacheReady = false;");
    await tick(4);
    assert.equal(focusedClaims,2,'unknown Wide cache must not suppress recovery');
    execute("shellWideFocusCacheReady = true; streamShellDisplayProfileCache = {mode:'compact'};");
    await tick(4);
    assert.equal(focusedClaims,3,'Compact recovery remains untouched');
    assert.equal(claims,3);
    assert.equal(heartbeat,24);
    console.log('Native idle-audit recovery: 12 heartbeats under game, ACK retries, automatic resume, Compact fallback PASS');
})().catch(error=>{console.error(error); process.exitCode=1});
