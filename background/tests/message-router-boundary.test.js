const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const router = fs.readFileSync(path.join(__dirname, '../src/09-message-router.js'), 'utf8');
let handler = null;
const state = { reject: false };
const chrome = {
    runtime: { onMessage: { addListener(fn) { handler = fn; } } },
    storage: {
        local: {
            get: () => state.reject
                ? Promise.reject(new Error('Storage temporarily unavailable'))
                : Promise.resolve({ activeProvider: 'youtube', leftMode: 'youtube', rightMode: 'dashboard' })
        }
    }
};
vm.runInNewContext(router, {
    chrome,
    isLandingExposed: () => Promise.resolve(false),
    getStreamShellDisplayProfile: () => Promise.resolve({ mode: 'wide' }),
    getTwitchWorkspaceV2Summary: () => Promise.resolve({ active: true }),
    Promise, console, shuttingDown: false
});
assert.equal(typeof handler, 'function');
for (const invalid of [null, undefined, false, 'get-state', [], {}, { type: 3 }]) {
    assert.equal(handler(invalid, {}, () => { throw Error('Unexpected response'); }), false);
}
function invoke(message) {
    return new Promise(resolve => {
        const returned = handler(message, {}, resolve);
        assert.equal(returned, true, 'Async message channel must stay open');
    });
}
(async () => {
    const ok = await invoke({ type: 'get-state' });
    assert.equal(ok.activeProvider, 'youtube');
    assert.equal(ok.layoutProfile, 'wide');
    state.reject = true;
    const failed = await invoke({ type: 'get-state' });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /Storage temporarily unavailable/);
    console.log('PASS message router: malformed envelopes ignored; get-state always settles');
})().catch(error => { console.error(error); process.exitCode = 1; });
