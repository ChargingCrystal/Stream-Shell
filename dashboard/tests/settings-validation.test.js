/* Import/UI settings validation. Pure VM: never starts Windows/Opera. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
const ctx = vm.createContext({
    STREAM_SHELL_PROVIDER_REGISTRY_KEY: 'streamShellProviderRegistry',
    defaultStreamShellProviderRegistry: () => ({version: 2, providers: []}),
    normalizeStreamShellProviderRegistry: value => value
});
const config = src('settings-config.js');
vm.runInContext(config.slice(0, config.indexOf('const SETTINGS_SECTIONS =')),ctx);
vm.runInContext(src('settings-storage.js'),ctx);
const evaluate = expr => vm.runInContext(expr,ctx);
const normalize = (key,value) => {
    ctx.payload = { [key]: value };
    return evaluate('streamShellPrepareSettingsImport(payload)');
};
const val = (key,value) => JSON.parse(JSON.stringify(normalize(key,value).next[key]));
const rejects = (key,value,matcher) => assert.throws(()=>normalize(key,value), matcher);

assert.equal(val('streamShellVolumeBoost_youtube', 999999),600);
assert.equal(val('streamShellVolumeBoost_twitch', 123),120);
assert.equal(val('streamShellVolumeBoost_netflix', '200'),200);
assert.equal(val('streamShellYoutubeAutoLikePercent',-5),1);
assert.equal(val('streamShellYoutubeAutoLikeSeconds',9500),7200);
assert.equal(val('streamShellYoutubeUploadDateRelativeDays', 2.8),3);
assert.equal(val('streamShellContinueWatchingCompletePercent',1000),100);
rejects('streamShellYoutubeAutoLikePercent','',/Invalid numeric/);
rejects('streamShellVolumeBoost_prime','Infinity',/Invalid numeric/);
rejects('streamShellVolumeBoost_prime',null,/Invalid numeric/);
rejects('streamShellVolumeBoost_prime',false,/Invalid numeric/);
rejects('streamShellTwitchAutoMute','false',/Invalid boolean/);
rejects('streamShellDisplayMode','ultrawide-mystery',/Invalid option/);
rejects('streamShellYoutubeQuality','10000k',/Invalid option/);
rejects('streamShellPlaybackSpeed_youtube','100',/Invalid option/);
rejects('streamShellAudioProfile_twitch','extreme',/Invalid option/);
rejects('streamShellPrimeSubtitleScale','9',/Invalid option/);
rejects('streamShellWindowedPlayer_youtube__16_10','true',/Invalid boolean/);
rejects('streamShellYoutubeUploadDateRelativeDays',[],/Invalid numeric/);
assert.equal(val('streamShellPlaybackSpeed_netflix','1.5'),'1.5');
assert.equal(val('streamShellSleepTimerAction','dashboard'),'dashboard');

// Single invalid field in a composite backup aborts before storage mutations.
assert.throws(()=>{
    ctx.payload = {streamShellTwitchAutoMute: true,streamShellYoutubeAutoLikePercent: 'nope'};
    evaluate('streamShellPrepareSettingsImport(payload)');
}, /Invalid numeric/);

// Partial legacy backups must not wipe scoped keys belonging to other features.
let cleanup=normalize('streamShellWindowedPlayer_youtube',true).legacyScopedKeys;
assert.deepEqual(Array.from(cleanup),[
    'streamShellWindowedPlayer_youtube__32_9',
    'streamShellWindowedPlayer_youtube__16_9',
    'streamShellWindowedPlayer_youtube__16_10'
]);
assert.equal(normalize('streamShellTwitchAutoMute',true).legacyScopedKeys.length,0);
ctx.payload = {
    streamShellWindowedPlayer_youtube: true,
    streamShellWindowedPlayer_youtube__16_10: false
};
assert.equal(evaluate('streamShellPrepareSettingsImport(payload).legacyScopedKeys.length'),0,
    'mixed legacy + explicit scoped values must not erase scoped profiles');

// UI input follows the SAME constraints as import, not its own hidden rulebook.
const runtime=src('settings-runtime.js');
const begin=runtime.indexOf('function normalizeSettingInput(input) {');
const end=runtime.indexOf('async function persistSettingInput(input) {',begin);
assert.ok(begin>=0&&end>begin);
vm.runInContext(runtime.slice(begin,end),ctx);
ctx.input={dataset:{settingKey:'streamShellYoutubeAutoLikePercent',settingNumber:'true'},type:'number',value:'101'};
assert.equal(evaluate('normalizeSettingInput(input).value'),100);
assert.equal(ctx.input.value,'100');
ctx.input={dataset:{settingKey:'streamShellAudioProfile_twitch'},type:'select-one',value:'impossible'};
assert.throws(()=>evaluate('normalizeSettingInput(input)'),/Invalid option/);
ctx.input={dataset:{settingKey:'streamShellTwitchAutoMute'},type:'checkbox',checked:false};
assert.equal(evaluate('normalizeSettingInput(input).value'),false);
console.log('Dashboard settings validation: numeric bounds, enums, corrupt imports, scoped migrations, UI parity PASS');
