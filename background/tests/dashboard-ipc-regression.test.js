const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helpers = fs.readFileSync(path.join(__dirname, '../src/09-message-helpers.js'), 'utf8').split('async function isManagedProviderWindow(')[0];
const router = fs.readFileSync(path.join(__dirname, '../src/09-message-router.js'), 'utf8');

let listener;
const state = { allowed: true, mode: 'success', calls: [], reads: 0 };
const chrome = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: {local: {get: () => {state.reads++;return Promise.resolve({activeProvider:'youtube'})}}}
};
const context = {
    chrome, Promise, console, shuttingDown: false,
    isDashboardSender: () => state.allowed,
    isLandingExposed: () => Promise.resolve(false),
    getStreamShellDisplayProfile: () => Promise.resolve({mode:'wide'}),
    getTwitchWorkspaceV2Summary: () => Promise.resolve({active:true}),
    setTitlebarSettingsOpen: open => {state.calls.push(['settings',open]);if (state.mode === 'throw') throw Error('Settings throw');if (state.mode === 'reject') return Promise.reject(Error('Settings rejected'));return Promise.resolve();},
    recordFlightEvent: event => {state.calls.push(['flight',event.source]);if (state.mode === 'throw') throw Error('Recorder throw');if (state.mode === 'reject') return Promise.reject(Error('Recorder rejected'));return Promise.resolve();},
    runStreamShellProviderRepair: (provider,action) => {state.calls.push(['repair',provider,action]);if(state.mode==='throw')throw Error('Repair throw');if (state.mode === 'reject') return Promise.reject(Error('Repair rejected'));return Promise.resolve({ok:true,repair:'completed'})}
};
vm.runInNewContext(helpers + '\n' + router, context);
assert.equal(typeof listener, 'function');
function invoke(message) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('IPC timeout: '+message.type)), 1500);
        let replied = false;
        const result = listener(message, {}, value => {
            if (replied) return reject(Error('Duplicate response'));
            replied = true;clearTimeout(timeout);resolve({value});
        });
        if (result !== true && !replied) reject(Error('No async channel or sync response'));
    });
}
(async () => {
    const cases = [
        ['dashboard-settings-visibility',{open:true}, 'settings'],
        ['dashboard-flight-event',{event:{category:'test',action:'audit'}},'flight'],
        ['dashboard-diagnostics-repair',{provider:'youtube',action:'resync-content-state'},'repair']
    ];
    for (const [type,payload,operation] of cases) {
        for (const mode of ['success','throw','reject']) {
            state.mode = mode; state.allowed = true;
            const result = await invoke({type,...payload});
            assert.equal(result.value.ok,mode === 'success',`${type} / ${mode}`);
            if (type==='dashboard-diagnostics-repair') {
                assert.equal(result.value.error, mode==='success' ? undefined : `Repair ${mode==='throw'?'throw':'rejected'}`);
            }
            assert.equal(state.calls.at(-1)[0],operation);
        }
        state.allowed=false;
        const before = state.calls.length;
        const denied = await invoke({type,...payload});
        assert.equal(denied.value.ok,false);
        assert.equal(state.calls.length,before,`${type} must reject untrusted senders before any work`);
    }
    state.allowed=true;
    state.mode='success';
    const stateReply = await invoke({type:'get-state'});
    assert.equal(stateReply.value.activeProvider,'youtube');
    assert.equal(stateReply.value.layoutProfile,'wide');
    console.log('PASS dashboard IPC: trust boundaries, async replies, failure contracts');
})().catch(error => { console.error(error); process.exitCode = 1; });
