/* v0.20.31: optional HUD is not loaded by default; wait for managed slot,
 * limit to top frame and bind script injection to the request document. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const paths = manifest.content_scripts.flatMap(entry => entry.js || []);
assert.ok(paths.includes('providers/player/twitch-hud-loader.js'));
assert.ok(!paths.includes('providers/player/twitch-workspace-v2.js'), 'heavy HUD must not auto-parse on document_idle');
const loader = fs.readFileSync(path.join(root, 'providers/player/twitch-hud-loader.js'), 'utf8');
const background = fs.readFileSync(path.join(root, 'background/src/09-message-router.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'providers/player/twitch-workspace-v2.js'), 'utf8');
assert.match(background, /message\.type === "twitch-workspace-v2-load-hud"/);
assert.match(background, /sender\.frameId !== 0/);
assert.match(background, /getTwitchWorkspaceV2Context\(tab\.windowId\)/);
assert.match(background, /documentIds: \[sender\.documentId\]/);
assert.match(background, /files: \["providers\/player\/twitch-workspace-v2\.js"\]/);
assert.match(hud, /__streamShellTwitchHudLoaded === true/);

async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
async function scenario({slot='b', role='slot', managed=true, visible=false, unload=false, rejectOnce=false} = {}) {
    const timers = [];
    const calls = [];
    const listeners = {};
    let failed = false;
    const context = vm.createContext({
        document: { visibilityState: visible ? 'visible' : 'hidden' },
        window: {addEventListener: (name, handler) => { listeners[name]=handler; }},
        chrome: {runtime: {sendMessage: async ({type}) => {
            calls.push(type);
            if(type === 'get-stream-shell-twitch-workspace-context') return {managed,role,slotId:slot};
            if(rejectOnce && !failed){ failed=true; throw Error('MV3 restart'); }
            return {ok:true};
        }}},
        setTimeout: (handler, ms) => {let timer={handler,ms,cancelled:false};timers.push(timer);return timer;},
        clearTimeout: timer => {timer.cancelled=true;},
        Object, Array, Promise, console
    });
    vm.runInContext(loader,context);
    await flush();
    if (!managed) {
        assert.equal(calls.length,1);
        assert.equal(timers[0].ms,205);
        return;
    }
    if(role !== 'slot') { assert.equal(timers.length,0); return; }
    assert.equal(timers.length,1);
    assert.equal(timers[0].ms,visible ? 0 : ({a:750,b:1050,c:1350,d:1650})[slot]);
    if(unload) {listeners.pagehide();assert.equal(timers[0].cancelled,true);}
    timers[0].handler();
    await flush();
    assert.equal(calls.filter(c=>c==='twitch-workspace-v2-load-hud').length,unload ? 0 : 1);
    if(!unload && !rejectOnce){timers[0].handler();await flush();assert.equal(calls.filter(c=>c==='twitch-workspace-v2-load-hud').length,1);}
    if(rejectOnce && !unload){
        const retry=timers.at(-1); assert.ok(retry.ms>=160);
        retry.handler();await flush();const second=timers.at(-1);second.handler();await flush();
        assert.equal(calls.filter(c=>c==='twitch-workspace-v2-load-hud').length,2);
    }
}
(async()=>{
 for(const slot of ['a','b','c','d']) await scenario({slot});
 await scenario({slot:'a',visible:true});
 await scenario({role:'legacy'});
 await scenario({managed:false});
 await scenario({slot:'d',unload:true});
 await scenario({slot:'b',rejectOnce:true});
 console.log('Twitch HUD lazy injection, slot admission, pagehide, retry: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
