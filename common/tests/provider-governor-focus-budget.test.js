/* v0.20.15: focus metadata alone must not start multiple DOM/poll jobs at 0ms,
 * while true playback/visibility transitions continue waking immediately. */
const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const path=require('node:path');
const timers=new Map();let nextId=0;const document={visibilityState:'visible',hasFocus:()=>false,documentElement:{setAttribute(){}}};
const ctx=vm.createContext({
  document,console,setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},
  clearTimeout:id=>timers.delete(id),
  getCurrentProvider:()=> 'youtube',getProviderAdapter:()=>({isWatchContext:()=>false}),getPrimaryVideo:()=>null,
  recordProviderFlightEvent:()=>{},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/provider-resource-governor.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
run(`updateProviderResourceGovernor('boot');var job=createProviderResourceLoop('metadata',async()=>{},1000,'metadata');`);
const first=[...timers.keys()][0];assert.ok(first);
run(`providerResourceGovernorWindowState.focused=true;updateProviderResourceGovernor('focus');`);
assert.deepEqual([...timers.keys()],[first],'focus-only cannot restart background jobs');
run(`providerResourceGovernorWindowState.minimized=true;updateProviderResourceGovernor('window-state');`);
assert.equal(timers.size,1);assert.notEqual([...timers.keys()][0],first);
assert.equal([...timers.values()][0].ms,0,'real mode switch wakes workload immediately');
run('job.stop()');assert.equal(timers.size,0);
console.log('Provider governor focus-only backpressure and mode recovery: PASS');
