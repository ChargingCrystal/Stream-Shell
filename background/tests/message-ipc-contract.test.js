const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/09-message-helpers.js'), 'utf8');
const ctx = { console };
vm.runInNewContext(source, ctx);
const reply = ctx.streamShellRespondAsync;
const errorText = ctx.streamShellMessageErrorText;
assert.equal(typeof reply, 'function');
assert.equal(errorText(new Error('broken')), 'broken');
assert.equal(errorText({}), 'Request failed.');
assert.equal(errorText('', 'Fallback'), 'Fallback');

function invoke(operation, options) {
    return new Promise((resolve, reject) => {
        let replies = 0;
        const returned = reply(response => {
            replies++;
            if (replies > 1) reject(Error('Double response'));
            else queueMicrotask(() => resolve({response, replies}));
        }, operation, options);
        assert.equal(returned, true, 'MV3 sendResponse channel must remain open');
    });
}
(async () => {
    const mapped = await invoke(() => Promise.resolve(5), {success: value => ({ok: true, value: value + 1})});
    assert.equal(mapped.response.value, 6);
    const rejected = await invoke(() => Promise.reject(new Error('Promise rejected')));
    assert.equal(rejected.response.ok, false);
    assert.equal(rejected.response.error, 'Promise rejected');
    const synchronous = await invoke(() => { throw new Error('Synchronous API failure'); });
    assert.equal(synchronous.response.error, 'Synchronous API failure');
    const mapper = await invoke(() => 10, {success: () => { throw Error('Serialization error'); }});
    assert.equal(mapper.response.error, 'Serialization error');
    const fallback = await invoke(() => { throw null; }, {fallback:'Custom failure'});
    assert.equal(fallback.response.error, 'Custom failure');
    const nested = await invoke(() => { throw Error('bad'); }, {failure: () => { throw Error('fallback failed'); }});
    assert.equal(nested.response.error, 'fallback failed');
    await new Promise((resolve, reject) => {
        assert.equal(reply(() => { resolve(); throw new Error('Sender page closed'); }, () => null), true);
        setTimeout(() => reject(Error('Closed sender callback never executed')), 100);
    });
    console.log('PASS message IPC contract: reply once, sync/async errors, closed sender');
})().catch(error => { console.error(error); process.exitCode = 1; });
