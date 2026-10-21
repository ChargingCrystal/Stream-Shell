/* v0.20.35: maintenance alarm sync runs concurrently with Twitch popup startup,
   but is finished before the transition is announced. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/05aa-twitch-workspace-v2.js'), 'utf8');
const start = source.indexOf('async function syncTwitchWorkspaceV2StreamRefreshAlarms(');
const end = source.indexOf('async function handleTwitchWorkspaceV2StreamRefreshAlarm(', start);
assert.ok(start >= 0 && end > start);
const showStart = source.indexOf('async function _showTwitchWorkspaceV2(');
const showEnd = source.indexOf('async function assignTwitchWorkspaceV2Slot(', showStart);
assert.ok(showStart >= 0 && showEnd > showStart);
const showSource = source.slice(showStart, showEnd);
assert.ok(showSource.indexOf('const refreshAlarmsTask =') < showSource.indexOf('"twitch:sync-titlebar"'));
assert.ok(showSource.indexOf('const refreshAlarmsTask =') < showSource.indexOf('"twitch:raise-workspace"'));
assert.ok(showSource.indexOf('await refreshAlarmsTask;') > showSource.indexOf('scheduleTwitchWorkspaceV2SurfaceWake('));
assert.ok(showSource.indexOf('await refreshAlarmsTask;') < showSource.indexOf('action: "shown"'));

const ids = ['a', 'b', 'c', 'd'];
const slots = Object.fromEntries(ids.map(id => [id, {
    kind: id === 'a' ? 'page' : 'stream',
    url: id === 'a' ? 'https://www.twitch.tv/drops/inventory' : `https://www.twitch.tv/${id}`,
    windowId: ids.indexOf(id) + 101
}]));

(async () => {
    // If the old sequential loop were restored, only the first get would fire
    // before the pending promise is released. Four calls prove real concurrency.
    const pending = [];
    const calls = [];
    const ctx = vm.createContext({
        Promise, Date, Number,
        TWITCH_WORKSPACE_V2_SLOT_IDS: ids,
        twitchWorkspaceV2StreamRefreshAlarmName: id => `refresh:${id}`,
        isTwitchUrl: url => /^https:\/\/www\.twitch\.tv\//.test(url),
        getTwitchWorkspaceV2Record: async () => ({slots}),
        chrome: {alarms: {
            get: name => {calls.push('get:' + name); return new Promise(resolve => pending.push({name,resolve}));},
            clear: async name => {calls.push('clear:' + name);return true;}
        }},
        scheduleTwitchWorkspaceV2StreamRefresh: async id => {calls.push('create:' + id);return true;}
    });
    vm.runInContext(source.slice(start,end),ctx);
    let settled = false;
    const sync = vm.runInContext('syncTwitchWorkspaceV2StreamRefreshAlarms({slots: __slots})',
       Object.assign(ctx, {__slots: slots})).then(() => {settled = true;});
    assert.deepEqual(calls, ids.map(id => `get:refresh:${id}`), 'all four browser API reads are started without serial waits');
    assert.equal(settled,false);
    pending.forEach(entry => entry.resolve(entry.name === 'refresh:a' ? {name:entry.name} : null));
    await sync;
    assert.equal(settled,true);
    assert.ok(calls.includes('clear:refresh:a'), 'inactive page slot loses its stale alarm');
    for (const id of ['b','c','d']) assert.ok(calls.includes('create:'+id), `stream ${id} gets an alarm`);

    // A cached existing alarm should not be recreated. Failed gets continue
    // to use the previous recovery fallback and create the missing alarm.
    const ctx2 = vm.createContext({
        Promise, Date, Number,
        TWITCH_WORKSPACE_V2_SLOT_IDS: ids,
        twitchWorkspaceV2StreamRefreshAlarmName: id => `refresh:${id}`,
        isTwitchUrl: url => /^https:\/\/www\.twitch\.tv\//.test(url),
        getTwitchWorkspaceV2Record: async () => ({slots}),
        chrome: {alarms: {get: name => name === 'refresh:d' ? Promise.reject(new Error('transient')) : Promise.resolve({name}),clear:async()=>true}},
        scheduleTwitchWorkspaceV2StreamRefresh: async id => { calls.push('recovery:'+id); }
    });
    vm.runInContext(source.slice(start,end),ctx2);
    await vm.runInContext('syncTwitchWorkspaceV2StreamRefreshAlarms({slots: __slots})',Object.assign(ctx2,{__slots:slots}));
    assert.ok(calls.includes('recovery:d'),'failed alarm lookup retains missing-alarm fallback');
    assert.ok(!calls.includes('recovery:b'),'existing alarm remains undisturbed');

    // Drive the full launch entry with an unresolved alarm sync. UI + Native
    // setup and the popup raise must start without waiting for alarm reads,
    // while launch result must not be published until sync has finished.
    let finishAlarms;
    let alarmStarted = false;
    const milestones = [];
    const record = {version:7, lifecycle:'test',slots,selectedSlot:'a',activationCount:1};
    const full = vm.createContext({
        Promise, Date, Number, shuttingDown:false,
        TWITCH_WORKSPACE_V2_SLOT_IDS: ids,
        measureShellWindowStep: async (name,work) => {milestones.push(name);return work();},
        getStreamShellDisplayProfile: async () => ({mode:'wide'}),
        ensureDashboardWindow: async () => {},
        chrome:{storage:{local:{get:async()=>({rightMode:'dashboard'}),set:async()=>{}}}},
        hideDiscordForDashboard:async()=>{}, migrateIntoTwitchWorkspaceV2:async()=>record,
        isTwitchDropsUrl:()=>false, TWITCH_DROPS_URL:'https://www.twitch.tv/drops/inventory',
        assignTwitchWorkspaceV2Slot:async()=>record,
        isTwitchWorkspaceV2ColdStart:async()=>true,
        setTwitchWorkspaceV2Record:async v=>v,
        syncConnectedTitlebarNative:async()=>{milestones.push('native');},
        raiseTwitchWorkspaceV2:async v=>{milestones.push('raise');return v;},
        scheduleTwitchWorkspaceV2Claims:()=>{}, scheduleTwitchWorkspaceV2SurfaceWake:()=>{},
        syncTwitchWorkspaceV2StreamRefreshAlarms:()=>{alarmStarted=true;return new Promise(resolve=>{finishAlarms=resolve;});},
        recordFlightEvent:async()=>{milestones.push('shown');},
        broadcastTwitchWorkspaceV2LaunchState:async()=>{},
        twitchWorkspaceV2SummaryFromRecord:()=>({active:true})
    });
    vm.runInContext(showSource,full);
    let returned = false;
    const launch = vm.runInContext('_showTwitchWorkspaceV2("resume")',full).then(result=>{returned=true;return result;});
    // Flush enough microtasks for the async stubs and promise continuation.
    for(let i=0;i<30;i++) await Promise.resolve();
    assert.equal(alarmStarted,true,'maintenance started while navigating');
    assert.ok(milestones.includes('raise'),'raise is not blocked by maintenance');
    assert.equal(returned,false,'launch waits for alarm reconciliation');
    assert.ok(!milestones.includes('shown'),'UI announced only after maintenance completed');
    finishAlarms();
    const outcome = await launch;
    assert.equal(outcome.active,true);
    assert.ok(milestones.includes('shown'));
    console.log('Twitch maintenance-alarm parallelism and safe admission ordering: PASS');
})().catch(error => {console.error(error);process.exitCode=1;});
