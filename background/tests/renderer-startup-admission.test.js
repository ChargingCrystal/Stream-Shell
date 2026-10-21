/* v0.20.9 regression: do not confuse extension FIFO serialization with
 * actual Chromium renderer initialization; rapid cross-surface launches must
 * be staggered and a fresh A-D grid must not spawn four Twitch tabs at once. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', 'src');
const config = fs.readFileSync(path.join(root, '00-config-home.js'), 'utf8');
const begin = config.indexOf('const STREAM_SHELL_TRANSITION_MAX_WAITERS');
const end = config.indexOf('function openShellHome()', begin);
assert.ok(begin >= 0 && end > begin);

(async () => {
    let now = 1000;
    const pauses = [];
    const events = [];
    class TestDate extends Date { static now() { return now; } }
    const ctx = vm.createContext({
        Date: TestDate, Promise, console, shuttingDown: false,
        shellWideFocusCacheReady:true,
        shellWideFocusCache:{providerWindows:{youtube:10},'workspace-v2':{slots:{a:{windowId:1},b:{windowId:2},c:{windowId:3},d:{windowId:4}}}},
        TWITCH_WORKSPACE_V2_STORAGE_KEY:'workspace-v2',
        chrome:{runtime:{sendMessage:async()=>{}}},
        setTimeout: (cb, ms) => { pauses.push(ms); now += ms; cb(); },
        recordFlightEvent: async event => { events.push(event); }
    });
    vm.runInContext(config.slice(begin, end), ctx);
    const launch = name => vm.runInContext(
        `runStreamShellWindowTransition('${name}', async () => Date.now())`, ctx);

    assert.equal(await launch('provider:youtube'), 1000);
    assert.equal(await launch('twitch:workspace'), 6500, 'Twitch must wait for YouTube renderer to settle');
    assert.deepEqual(pauses, [5500]);
    assert.equal(await launch('twitch:workspace'), 6500, 'Twitch-to-Twitch must stay fast');
    assert.deepEqual(pauses, [5500]);
    assert.equal(await launch('provider:youtube'), 12000, 'opposite transition must be protected too');
    now += 7000;
    assert.equal(await launch('twitch:workspace'), 19000, 'no artificial delay after quiet period');
    assert.equal(pauses.length, 2);
    assert.equal(events.filter(e => e.action === 'renderer-handoff-staggered').length, 2);
    // Warm after 30s, with all cached windows already alive, but not at cold start.
    now = 44000;
    await launch('provider:youtube');
    const beforeWarm = pauses.length;
    assert.equal(await launch('twitch:workspace'), 47000, 'warm handoff must be 3 seconds');
    assert.deepEqual(pauses.slice(beforeWarm), [3000]);
    assert.equal(events.filter(e=>e.action==='renderer-handoff-staggered').at(-1).detail.graceMs,3000);
    // A missing Twitch slot stays cold even after 30 seconds.
    vm.runInContext("shellWideFocusCache['workspace-v2'].slots.d.windowId = null", ctx);
    await launch('provider:youtube');
    assert.equal(await launch('twitch:workspace'), 55500, 'fresh popup keeps 5.5s protection');

    const twitch = fs.readFileSync(path.join(root, '05aa-twitch-workspace-v2.js'), 'utf8');
    const start = twitch.indexOf('const TWITCH_WORKSPACE_V2_COLD_SLOT_SPACING_MS');
    const stop = twitch.indexOf('async function raiseExistingTwitchWorkspaceV2(', start);
    assert.ok(start >= 0 && stop > start);
    const delays = [], focused = [], created = [];
    let id = 100;
    const slots = ['a','b','c','d'];
    const grid = Object.fromEntries(slots.map(s=>[s,{windowId:null}]));
    const twin = vm.createContext({
        Date: TestDate, Promise, console, shuttingDown:false,
        TWITCH_WORKSPACE_V2_SLOT_IDS:slots,
        STREAM_SHELL_RENDERER_WARM_AFTER_MS:30000,
        streamShellRendererColdUntil:0,
        setTimeout:(cb,ms)=>{delays.push(ms);cb();},
        ensureTwitchWorkspaceV2Slot:async(rec,slot)=>{
            const old=rec.slots[slot].windowId;
            const windowId=old||++id;
            if(!old)created.push(slot);
            return {record:{...rec,slots:{...rec.slots,[slot]:{windowId}}},window:{id:windowId}};
        },
        chrome:{windows:{update:async(win,opts)=>focused.push({win,...opts})}},
        raiseTwitchWorkspaceV2NativeCluster:()=>{},
        setTwitchWorkspaceV2NativePaneFullscreen:async()=>{},
        recordFlightEvent:async ev=>events.push(ev)
    });
    vm.runInContext(twitch.slice(start,stop),twin);
    const result=await twin.raiseTwitchWorkspaceV2({slots:grid,paneFullscreenSlot:null,selectedSlot:'a'}, 'a');
    assert.deepEqual(created, slots);
    assert.deepEqual(delays,[1250,1250,1250]);
    assert.deepEqual(focused,[{win:101,focused:true}]);
    await twin.raiseTwitchWorkspaceV2(result,'a');
    assert.equal(created.length,4,'existing Twitch pages must not be recreated');
    assert.equal(delays.length,3,'warm Twitch switching must not be delayed');
    assert.ok(events.some(e=>e.action==='staggered-popup-startup'&&e.detail.newPopups===4));
    console.log('Renderer handoff and cold Twitch startup pacing: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
