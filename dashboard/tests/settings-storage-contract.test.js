/* Settings/storage behavior contract: no Opera/DOM runtime required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const writes = [];
let fail = false;
let removed = [];
let recorder = 0;
const statuses = [];
let rerenders = 0;
const ctx = vm.createContext({
    console,
    STREAM_SHELL_PROVIDER_REGISTRY_KEY: 'streamShellProviderRegistry',
    defaultStreamShellProviderRegistry: () => ({version:2, providers:[]}),
    normalizeStreamShellProviderRegistry: value => ({normalized:true, ...value}),
    settingsValues: { streamShellTwitchAutoMute:true },
    settingsCenter: {hidden:false},
    normalizeSettingInput: value => value,
    showSettingsIoStatus: value => statuses.push(value),
    renderSettingsContent: () => {rerenders++;},
    chrome: {
        storage: {local: {
            async set(values) { writes.push({...values}); if (fail) throw new Error('storage failure'); },
            async remove(keys) {removed.push([...keys]);},
        }},
        runtime: {sendMessage: async () => {recorder++; return {ok:true};}}
    },
    sleepTimerState: null
});
const config = src('settings-config.js');
vm.runInContext(config.slice(0, config.indexOf('const SETTINGS_SECTIONS =')), ctx);
vm.runInContext(src('settings-storage.js'), ctx);
const expr = code => vm.runInContext(code, ctx);
const plain = code => JSON.parse(JSON.stringify(expr(code)));

assert.equal(expr('SETTINGS_STORAGE_KEYS.length'), 128);
assert.equal(expr('streamShellHydrateSettings({streamShellTwitchAutoMute:false,extraneous:"ignore"}).streamShellTwitchAutoMute'),false);
assert.equal(expr('Object.hasOwn(streamShellHydrateSettings({extraneous:"ignore"}),"extraneous")'),false);
assert.equal(expr('streamShellHydrateSettings(null).streamShellTwitchKeepActive'),true);
assert.equal(expr('streamShellExportSettings({streamShellWindowedPlayer_youtube:true})["streamShellWindowedPlayer_youtube__16_10"]'),true,
    'scoped export falls back to legacy base key');
assert.equal(expr('streamShellExportSettings({streamShellWindowedPlayer_youtube:true,streamShellWindowedPlayer_youtube__16_10:false})["streamShellWindowedPlayer_youtube__16_10"]'),false,
    'explicit scoped value wins over legacy base');
assert.equal(expr('streamShellExportSettings({}).streamShellContinueWatchingCompletePercent'),95);
assert.throws(() => expr('streamShellPrepareSettingsImport({unrelated:true})'), /No recognized/);
assert.throws(() => expr('streamShellPrepareSettingsImport([])'), /Invalid/);
assert.equal(expr('streamShellPrepareSettingsImport({streamShellTwitchAutoMute:false}).next.streamShellTwitchAutoMute'),false);
assert.equal(expr('streamShellPrepareSettingsImport({streamShellTwitchAutoMute:false}).legacyScopedKeys.length'),0,'unrelated partial import must preserve scoped overrides');
assert.equal(expr('streamShellPrepareSettingsImport({streamShellWindowedPlayer_youtube__16_10:true}).legacyScopedKeys.length'),0);
assert.equal(expr('streamShellPrepareSettingsImport({streamShellContinueWatchingCompletePercent:900}).next.streamShellContinueWatchingCompletePercent'),100);
assert.throws(() => expr('streamShellPrepareSettingsImport({streamShellVolumeBoost_twitch:"broken"})'), /Invalid numeric/);

(async () => {
    // Simulated Storage write ordering: the second write MUST wait for the first.
    let pending = [];
    ctx.chrome.storage.local.set = payload => new Promise((resolve, reject) => pending.push({payload,resolve,reject}));
    const first = expr('streamShellWriteSetting("streamShellTwitchAutoMute", false)');
    const second = expr('streamShellWriteSetting("streamShellTwitchAutoMute", true)');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length,1, 'second same-key write is queued');
    pending[0].reject(new Error('first write failed'));
    await assert.rejects(first);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length,2,'failed prior write does not poison queue');
    assert.equal(pending[1].payload.streamShellTwitchAutoMute,true);
    pending[1].resolve();
    await second;
    assert.equal(expr('streamShellSettingWriteQueues.size'),0);

    // A failed input change cannot be reported as saved, or generate a change event.
    const runtime = src('settings-runtime.js');
    const start = runtime.indexOf('async function persistSettingInput(input) {');
    const end = runtime.indexOf('\ndocument.addEventListener(',start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(runtime.slice(start,end),ctx);
    ctx.chrome.storage.local.set = async payload => {writes.push({...payload}); if(fail) throw new Error('storage failure');};
    fail = true;
    await expr('persistSettingInput({key:"streamShellTwitchAutoMute",value:false})');
    assert.equal(ctx.settingsValues.streamShellTwitchAutoMute,true);
    assert.equal(recorder,0);
    assert.ok(statuses.includes('Save failed'));
    assert.equal(rerenders,1);
    fail = false;
    await expr('persistSettingInput({key:"streamShellTwitchAutoMute",value:false})');
    assert.equal(ctx.settingsValues.streamShellTwitchAutoMute,false);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(recorder,1);

    // Legacy migration may remove old scoped keys, but ONLY after new keys commit.
    const controls = src('settings-controls.js');
    const importStart = controls.indexOf('async function importStreamShellSettings(file) {');
    const importEnd = controls.indexOf('\n\n',controls.indexOf('    showSettingsIoStatus("Imported");',importStart));
    assert.ok(importStart>=0 && importEnd>importStart);
    ctx.loadSettingsValues = async ()=>{};
    ctx.renderSettingsCenter = ()=>{};
    vm.runInContext(controls.slice(importStart,importEnd),ctx);
    const order = [];
    ctx.chrome.storage.local.set = async () => {order.push('set');if(fail) throw new Error('failure');};
    ctx.chrome.storage.local.remove = async () => {order.push('remove');};
    ctx.file = {text:async ()=>JSON.stringify({format:'stream-shell-settings',settings:{streamShellTwitchAutoMute:false}})};
    fail=true;
    await assert.rejects(expr('importStreamShellSettings(file)'));
    assert.deepEqual(order,['set'],'failed import preserves old display-scoped keys');
    fail=false;
    await expr('importStreamShellSettings(file)');
    assert.deepEqual(order,['set','set'],'partial legacy import does not erase unrelated scoped values');
    console.log('Dashboard settings hydration, import/export, ordered writes and failure rollback: PASS');
})().catch(error => {console.error(error);process.exitCode=1;});
