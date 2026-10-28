const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root,'background/src/05-mangayomi.js'),'utf8');
const native = fs.readFileSync(path.join(root,'integrations/mangayomi/StreamShellMangayomiHost.cs'),'utf8');
const focus = fs.readFileSync(path.join(root,'background/src/11-playback-state-events.js'),'utf8');
const dash = fs.readFileSync(path.join(root,'background/src/04-dashboard-window.js'),'utf8');
assert.match(native,/action != "raise"/,'native host accepts passive raise');
assert.match(native,/SWP_NOMOVE \| SWP_NOSIZE \| SWP_NOACTIVATE/,'no resize or keyboard focus theft');
assert.match(native,/if \(!IsWindowVisible\(hwnd\) \|\| IsIconic\(hwnd\)\)/,'no restore of minimized app');
assert.match(focus,/state\.leftMode === 'mangayomi' && state\.rightMode === 'dashboard'/,'focus scoped to left Mangayomi/right Dashboard');
assert.match(focus,/focusedWindowId === state\.dashboardWindowId/,'only trusted right focus');
assert.match(dash,/scheduleMangayomiWideReassert\(\)/,'explicit dashboard activation repair');
let current={leftMode:'mangayomi', rightMode:'dashboard'};
let sent=[]; let timers=[];
const ctx=vm.createContext({
    chrome:{storage:{local:{get:async()=>({...current,streamShellSevenSeasAcknowledged:true})}},runtime:{sendNativeMessage:async(_host,msg)=>{
        sent.push(msg);return {ok:true};}}},
    setTimeout:(fn)=>{timers.push(fn);return timers.length;}, clearTimeout:()=>{},
    MANGAYOMI_NATIVE_HOST:'com.streamshell.mangayomi', MANGAYOMI_PATH_KEY:'path',
    LEFT:{left:0,top:0,width:1920,height:1080},
    streamShellDisplayProfileCache:{mode:'wide'},
    getStreamShellDisplayProfile:async()=>({mode:'wide'}),
    shuttingDown:false, console, Date
});
vm.runInContext(src,ctx);
async function flush(){while(timers.length){const fn=timers.shift();await fn();}}
(async()=>{
    vm.runInContext('scheduleMangayomiWideReassert()',ctx);await flush();
    assert.equal(sent.length,1);assert.equal(sent[0].action,'raise');
    assert.equal(sent[0].left,0);
    current.leftMode='youtube';vm.runInContext('scheduleMangayomiWideReassert()',ctx);await flush();
    assert.equal(sent.length,1,'not active Mangayomi => no raise');
    current.leftMode='mangayomi';current.rightMode='discord';vm.runInContext('scheduleMangayomiWideReassert()',ctx);await flush();
    assert.equal(sent.length,1,'Discord right pane => no raise');
    current.rightMode='dashboard';ctx.streamShellDisplayProfileCache={mode:'compact'};
    vm.runInContext('scheduleMangayomiWideReassert()',ctx);await flush();
    assert.equal(sent.length,1,'Compact => no raise');
    console.log('Mangayomi passive no-focus raise, left/right/Compact isolation: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
