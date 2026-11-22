const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const utility = fs.readFileSync(path.join(__dirname, '../../providers/player/twitch-utility.js'), 'utf8');
const source=utility.replace('    start().catch(() => {});',
    '    globalThis.__runEarlyTwitchStart = start; globalThis.__readEarlyTwitchRuntime = getTwitchRuntimeDiagnostics; globalThis.__resume = requestWorkspacePlaybackResume; globalThis.__stop = stopWorkspacePlaybackRecovery;');
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
    video.paused = true;
    let calls = 0, resolvePlay;
    video.play = () => { calls++; return new Promise(resolve => { resolvePlay = resolve; }); };
    context.__resume(video);
    for (let i=0;i<20;i++) context.__resume(video);
    assert.equal(calls,1,'pending browser play request blocks further attempts');
    resolvePlay(); await new Promise(setImmediate);
    video.play = () => { calls++; return Promise.reject(new Error('offline')); };
    for (let i=0;i<8;i++) { context.__resume(video); await new Promise(setImmediate); }
    assert.equal(calls,3,'only three attempts before actual playback resumes');
    assert.equal(context.__readEarlyTwitchRuntime().playbackRecovery.stopped,'retry-limit');
    const fire = name => { for (const fn of listeners[name] || []) fn({target:video}); };
    for (const name of ['ended','emptied','error']) {
        fire('playing'); fire(name);
        context.__resume(video);
        assert.equal(calls,3,`${name} prevents further play calls`);
        assert.equal(context.__readEarlyTwitchRuntime().workspaceWantedPlaying,false);
        assert.ok(timers.filter(t=>t.ms===15000).every(t=>t.cancelled),'recovery intervals stopped');
    }
    fire('playing');
    context.__stop('raid-opt-out'); context.__resume(video);
    assert.equal(calls,3,'raid opt-out stops playback recovery');
    fire('play'); context.__resume(video);
    assert.equal(calls,3,'mere play request cannot reset the stopped state');
    fire('playing'); context.__resume(video); await new Promise(setImmediate);
    assert.equal(calls,4,'actual playback unlocks a new recovery episode');

    const automation=fs.readFileSync(path.join(__dirname,'../../providers/player/twitch-automation.js'),'utf8');
    assert.match(automation,/core\.stopPlaybackRecovery\?\.\("raid-opt-out"\)/);
    const fn=automation.slice(automation.indexOf('    function scheduleMarblesAutoJoin()'),automation.indexOf('    function recordMarblesPlay('));
    let timers2=[], sendCalls=0, finish;
    const c=vm.createContext({viewerCount:100,viewerCountChannel:'https://www.twitch.tv/test',currentChannelUrl:()=> 'https://www.twitch.tv/test',marblesRange:()=>[1000,4000],settings:{streamShellTwitchMarblesAutoJoin:true},marblesPendingTimer:null,marblesJoinInFlight:false,automationDocumentAlive:true,marblesLastAutoPlayAt:0,MARBLES_CONFIG:{cooldownMs:120000,minDelayMs:1000,maxDelayMs:4000},Date,Math,randomIntInclusive:()=>1000,twitchRuntimeMetrics:{joinAttempts:0},setTimeout:fn=>(timers2.push(fn),timers2.length),sendMarblesPlayCommand:()=>{sendCalls++;return new Promise(resolve=>{finish=resolve;});},resetMarblesBurst:()=>{}});
    vm.runInContext(fn,c);
    vm.runInContext('scheduleMarblesAutoJoin()',c);const task=timers2.shift()();
    for(let i=0;i<20;i++)vm.runInContext('scheduleMarblesAutoJoin()',c);
    assert.equal(timers2.length,0);assert.equal(sendCalls,1);
    finish(false);await task;
    vm.runInContext('scheduleMarblesAutoJoin()',c);assert.equal(timers2.length,1,'failed join releases gate');
    console.log('Twitch stream-end, raid opt-out, bounded pending playback and autojoin: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
