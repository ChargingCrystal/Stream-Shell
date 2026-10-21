/* v0.20.39: v0.20.36-0.20.38 experimental Twitch player-audio
 * repair has been removed, while raid UI opt-out (without URL snapback),
 * Chromium tab mute / Floating Bar, Drops and covered-stream playback remain.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const utility = read('providers/player/twitch-utility.js');
const automation = read('providers/player/twitch-automation.js');
const background = read('background/src/05a-twitch.js');
const workspace = read('background/src/05aa-twitch-workspace-v2.js');
const manifest = JSON.parse(read('manifest.json'));

assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
assert.doesNotMatch(utility,/twitchPlayerAudio|repairTwitchPlayerMute|initTwitchPlayerAudioRepair|twitchPlayerMuteControl|readTwitchSavedPlayerAudio|twitchAudioRepairTimer|autoplayBlockSuspected|trustedRecoveryAttempts|playerAudio:/,
    'early utility must not retain experimental Twitch player unmute repair or telemetry');
assert.doesNotMatch(utility,/\.muted\s*=|\.volume\s*=|player-mute-unmute-button/,
    'early utility never writes media mute/volume or presses Twitch mute UI');
assert.match(utility,/function getPrimaryTwitchVideo\(/,
    'covered-stream playback control is preserved');
assert.match(utility,/workspacePlaybackGuardEnabled/,
    'covered-stream playback guard is preserved');

assert.match(automation,/function preventRaid\(/,'visible Twitch raid cancellation is preserved');
assert.match(automation,/leave raid\|cancel raid/,'raid UI cancellation remains targeted');
assert.doesNotMatch(automation,/type:\s*["']twitch-arm-raid-guard["']/,
    'raid UI must not rearm background URL snapback');
assert.doesNotMatch(background,/function enforceTwitchRaidGuard\s*\(/,
    'old URL snapback implementation must remain removed');
assert.doesNotMatch(background,/chrome\.tabs\.update\s*\(\s*tabId\s*,\s*\{\s*url:\s*guard\.sourceUrl/,
    'never force deliberate channel changes back to the old URL');
assert.match(background,/async function armTwitchRaidGuard\(_tab, _sourceUrl\)\s*\{\s*return false;/,
    'old background API remains a harmless compatibility no-op');
assert.match(workspace,/muted:\s*.*configuredMuted|muted:\s*.*\.muted|muted:\s*.*slot\.muted/,
    'the existing tab mute policy must stay wired to the Twitch workspace');

// Runtime smoke: on a managed cold-started Stream with the media initially
// muted, no new player-mute listener/click or repair timer is installed.
const source=utility.replace('    start().catch(() => {});',
    '    globalThis.__runEarlyTwitchStart = start; globalThis.__readEarlyTwitchRuntime = getTwitchRuntimeDiagnostics;');
assert.notEqual(source,utility,'early utility entrypoint hook is patchable');
const listeners={}; const events={}; const timers=[];
const video={tagName:'VIDEO',muted:true,volume:0,paused:false,ended:false,
    getBoundingClientRect(){return {width:600,height:300}},pause(){this.paused=true},
    play(){this.paused=false;return Promise.resolve()}};
let muteClicks=0, tabWrites=0;
const uiButton={click(){muteClicks++;},getAttribute(){return 'Unmute (m)'}};
const listen=(dst)=>(name,fn)=>{(dst[name]??=[]).push(fn)};
const context=vm.createContext({
    document:{visibilityState:'visible',hasFocus:()=>true,
        documentElement:{dataset:{},appendChild(){}},
        querySelectorAll:sel=>sel==='video'?[video]:[],
        querySelector:()=>uiButton,
        addEventListener:listen(listeners)},
    window:{addEventListener:listen(events),getSelection:()=>null},
    chrome:{runtime:{id:'test-extension',onMessage:{addListener(){}},sendMessage:async m=>
        m.type==='is-stream-shell-twitch-window' ? {managed:true} :
        m.type==='get-stream-shell-twitch-workspace-context' ?
          {managed:true,role:'slot',slotId:'b',raidProtectionEnabled:true,effectiveKind:'stream'} : {ok:true}},
        tabs:{update(){tabWrites++;}},
        storage:{local:{get:async()=>({rightMode:'twitch'})},onChanged:{addListener(){}}}},
    location:{pathname:'/someone',href:'https://www.twitch.tv/someone'},
    setTimeout(fn,ms){let t={fn,ms,cancelled:false};timers.push(t);return t;},
    clearTimeout(t){if(t)t.cancelled=true;},
    setInterval(fn,ms){let t={fn,ms,cancelled:false};timers.push(t);return t;},
    clearInterval(t){if(t)t.cancelled=true;},
    requestAnimationFrame:fn=>fn(), URL,Promise,Math,Date,Set,WeakMap,WeakSet,console
});
vm.runInContext(source,context);
(async()=>{
    await context.__runEarlyTwitchStart();
    const status=context.__readEarlyTwitchRuntime();
    assert.equal(status.slotId,'b');
    assert.equal('playerAudio' in status,false,'rolled-back Diagnostics no longer carries playerAudio');
    assert.equal('volumechange' in listeners,false,'player audio repair listeners removed');
    assert.ok(listeners.pointerdown?.length,'existing channel-navigation/adoption pointer listener retained');
    for (const callback of listeners.pointerdown||[]) callback({isTrusted:true,target:{closest:()=>null}});
    for (const name of ['playing','play','loadedmetadata']) {
        for (const callback of listeners[name]||[]) callback({target:video});
    }
    assert.equal(video.muted,true,'original Twitch player mute state untouched');
    assert.equal(video.volume,0,'original Twitch player volume untouched');
    assert.equal(muteClicks,0,'Twitch mute UI never clicked by early utility');
    assert.equal(tabWrites,0,'browser tab mute unaffected by this code');
    assert.ok(!timers.some(x=>x.ms===2200||x.ms===500||x.ms===100),
        'experimental 2.2s player-audio scans and short retry timers removed');
    console.log('Raid-only rollback: no Twitch player audio repair or forced raid URL snapback: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
