/* v0.20.27: persisted Twitch IDs cannot mean 'warm' without live browser windows. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', '05aa-twitch-workspace-v2.js'), 'utf8');
const start = src.indexOf('async function isTwitchWorkspaceV2ColdStart(');
const end = src.indexOf('function showTwitchWorkspaceV2(', start);
assert.ok(start >= 0 && end > start);
(async () => {
    const live = new Set([101, 102, 103, 104]);
    const ctx = vm.createContext({
        Promise, Number,
        TWITCH_WORKSPACE_V2_SLOT_IDS: ['a','b','c','d'],
        getTwitchWorkspaceV2Window: async id => live.has(id) ? {id} : null
    });
    vm.runInContext(src.slice(start, end), ctx);
    const record = {slots:{a:{windowId:101},b:{windowId:102},c:{windowId:103},d:{windowId:104}}};
    const check = r => ctx.isTwitchWorkspaceV2ColdStart(r);
    assert.equal(await check(record), false, 'all four actual windows alive -> warm');
    live.delete(103);
    assert.equal(await check(record), true, 'one dead stored HWND -> cold');
    live.clear();
    assert.equal(await check(record), true, 'four stale IDs -> cold');
    assert.equal(await check({slots:{}}), true, 'no IDs -> cold');
    console.log('Twitch A-D physical window cold-start classification: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
