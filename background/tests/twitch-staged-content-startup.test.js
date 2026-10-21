/* Stream Shell v0.20.33: early-core and physically deferred Twitch automation contract. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'),'utf8'));
const earlyScript = 'providers/player/twitch-utility.js';
const lateScript = 'providers/player/twitch-automation.js';
const contentScripts=manifest.content_scripts;
const early=contentScripts.find(s=>s.js?.includes(earlyScript));
const hud=contentScripts.find(s=>s.js?.includes('providers/player/twitch-hud-loader.js'));
assert.deepEqual(early.js,[earlyScript]);
assert.equal(early.run_at,'document_start');
assert.equal(hud.run_at,'document_idle');
assert.deepEqual(hud.js,['providers/player/twitch-hud-loader.js']);
assert.ok(!contentScripts.some(s=>s.js?.includes(lateScript)), 'late automation must not be auto-parsed in any Twitch frame');
const source=fs.readFileSync(path.join(root, earlyScript),'utf8');
const automation=fs.readFileSync(path.join(root, lateScript),'utf8');
const hudSource=fs.readFileSync(path.join(root,'providers/player/twitch-workspace-v2.js'),'utf8');
assert.match(source,/stream-shell-twitch-workspace-wake/);
assert.match(source,/function tryResumeCoveredWorkspacePlayback/);
assert.doesNotMatch(source,/function observeMarblesChat|function claimDrops|function claimChannelPoints/);
assert.doesNotMatch(hudSource,/stream-shell-twitch-workspace-wake/);
assert.match(automation,/for \(const line of lines\) recordMarblesPlay\(line\);/);

async function flush(){for(let i=0;i<12;i++) await Promise.resolve();}
async function scenario(slot,stopBeforeWake=false){
    const timers=[],intervals=[],listeners={},docListeners={},messages=[],observers=[],storageListeners=[];
    const event=(list)=>(name,handler)=>{(list[name]??=[]).push(handler);};
    class Observer{constructor(fn){this.fn=fn;this.count=0;this.disconnected=false;observers.push(this);}observe(){this.count++;}disconnect(){this.disconnected=true;}}
    const element={dataset:{},appendChild(){},getBoundingClientRect(){return {};}};
    let injections=0;
    const browser={
      document:{documentElement:element,visibilityState:'hidden',hasFocus:()=>false,
        addEventListener:event(docListeners),querySelector:()=>null,querySelectorAll:()=>[],
        createElement:()=>({style:{},setAttribute(){},getBoundingClientRect(){return {};},remove(){}})},
      window:{addEventListener:event(listeners)},
      chrome:{runtime:{onMessage:{addListener:fn=>messages.push(fn)},sendMessage:async message=>{
        if(message.type==='is-stream-shell-twitch-window')return {managed:true};
        if(message.type==='get-stream-shell-twitch-workspace-context')return {managed:true,role:'slot',slotId:slot,raidProtectionEnabled:true,effectiveKind:'stream'};
        if(message.type==='twitch-workspace-v2-load-automation'){
          injections++;
          vm.runInContext(automation,context);
          return {ok:true};
        }
        return {ok:true};
      }},storage:{local:{get:async()=>({rightMode:'twitch'})},onChanged:{addListener:fn=>storageListeners.push(fn),removeListener:fn=>{}}}},
      location:{pathname:'/streamer',href:'https://www.twitch.tv/streamer'},
      URL,URLSearchParams,Date,Math,Promise,Set,WeakSet,WeakMap,Element:class{},HTMLElement:class{},console,
      MutationObserver:Observer,
      setTimeout(fn,ms){let t={fn,ms,cancelled:false};timers.push(t);return t;},
      clearTimeout(t){if(t)t.cancelled=true;},
      setInterval(fn,ms){let t={fn,ms,cancelled:false};intervals.push(t);return t;},
      clearInterval(t){if(t)t.cancelled=true;},
      requestAnimationFrame(fn){fn();}
    };
    browser.window.getSelection=()=>null;
    const context=vm.createContext(browser);
    vm.runInContext(source.replace('    start().catch(() => {});','    globalThis.__start = start; globalThis.__report = getTwitchRuntimeDiagnostics;'),context);
    await vm.runInContext('__start()',context);
    assert.equal(observers.length,0);
    assert.equal(element.dataset.streamShellTwitchWorkspaceClean,'true','stream CSS marker applied before late scripts');
    assert.equal(injections,0);
    assert.equal(storageListeners.length,1, 'only early lightweight storage listener');
    const stage=timers.find(t=>t.ms===({a:650,b:1000,c:1350,d:1700})[slot]);
    assert.ok(stage,`slot ${slot} stagger timer`);
    assert.equal(context.__report().automation.startup.phase,'scheduled');
    if(stopBeforeWake){
       listeners.pagehide[0]();
       assert.equal(stage.cancelled,true);
       await stage.fn();await flush();
       assert.equal(injections,0);
       return;
    }
    await stage.fn();await flush();
    assert.equal(injections,1);
    assert.equal(observers.length,1);
    assert.equal(observers[0].count,1);
    assert.equal(intervals.filter(t=>t.ms===30000).length,1);
    assert.equal(storageListeners.length,2, 'deferred script owns only automation setting listener');
    assert.equal(context.__report().automation.startup.phase,'active');
    assert.ok(context.__report().automation.startup.activatedAfterMs>=0);
    assert.equal(typeof context.window.__streamShellTwitchCoreV1.registerAutomation,'function');
    vm.runInContext(automation,context);
    assert.equal(observers.length,1,'idempotent duplicate injection');
    await stage.fn();await flush();
    assert.equal(injections,1,'stale timer must not retry completed load');
    listeners.pagehide[0]();
    assert.equal(observers[0].disconnected,true);
    assert.ok(intervals.every(t=>t.cancelled));
    assert.equal(context.__report().automation.startup.phase,'stopped');
}
(async()=>{
    for(const slot of ['a','b','c','d'])await scenario(slot);
    await scenario('d',true);
    console.log('Twitch essential kernel + true deferred module, diagnostics, observer, pagehide: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
