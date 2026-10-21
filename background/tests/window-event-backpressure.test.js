/* v0.20.8 emergency: Wide event path never awaits Opera storage/window IPC. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../src/11-playback-state-events.js'),'utf8');
const start = source.indexOf('/* v0.20.8 EMERGENCY:');
const end = source.indexOf('chrome.windows.onRemoved.addListener(\n    async removedWindowId',start);
assert.ok(start > 0 && end > start);
const timers = new Map(); let nextId=0, focusedListener, boundsListener, changeListener;
let releaseStorage;
let tabUpdateListener, tabActivatedListener;
const record = {slots:{a:{windowId:41},b:{windowId:42},c:{windowId:43},d:{windowId:44}},selectedSlot:'a'};
let storageReads = 0;
const calls = {native:[],claims:[],focus:[],broadcast:0,messages:[],resources:0,providerMessages:[],raise:[]};
const initial = {providerWindows:{youtube:22},landingWindowId:21,dashboardWindowId:23,
  twitchWindow:11,'tw-v2':record,rightMode:'dashboard',activeProvider:'youtube',leftMode:'youtube',twitchTarget:'resume'};
const ctx = vm.createContext({Date,Promise,console,shuttingDown:false,
  TWITCH_WINDOW_STORAGE_KEY:'twitchWindow',TWITCH_WORKSPACE_V2_STORAGE_KEY:'tw-v2',
  streamShellDisplayProfileCache:{mode:'wide'},
  setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},
  getTwitchWorkspaceV2SlotByWindowId:(r,id)=>Object.keys(r?.slots||{}).find(k=>r.slots[k].windowId===id)||null,
  twitchWorkspaceV2SummaryFromRecord:r=>({active:!!r,slots:Object.keys(r?.slots||{})}),
  cancelTitlebarClaimRetries:()=>{},
  sendTitlebarState:(...args)=>calls.native.push(args),
  broadcastProviderResourceWindowStates:async()=>{calls.resources++;},
  raiseTwitchWorkspaceV2NativeCluster:slot=>calls.raise.push(slot),
  reconcileCompactFocusedSurface:async id=>{calls.focus.push(id);},
  reconcileProviderPlaybackWindows:async()=>{},
  claimFocusedTitlebarSurface:async id=>{calls.claims.push(id);},
  syncDiscordVisibilityState:async()=>{},
  broadcastState:async()=>{calls.broadcast++;},
  recordFlightEvent:async()=>{},
  chrome:{windows:{WINDOW_ID_NONE:-1,onFocusChanged:{addListener:f=>focusedListener=f},onBoundsChanged:{addListener:f=>boundsListener=f},onRemoved:{addListener:()=>{}}},
    tabs:{onUpdated:{addListener:f=>tabUpdateListener=f},onActivated:{addListener:f=>tabActivatedListener=f},sendMessage:async (id,message)=>calls.providerMessages.push({id,message})},
    runtime:{sendMessage:async message=>calls.messages.push(message)},
    storage:{onChanged:{addListener:f=>changeListener=f},local:{get:async()=>{storageReads++;return new Promise(resolve=>{releaseStorage=()=>resolve(initial);});},set:async()=>{}}}}
});
vm.runInContext(source.slice(start,end),ctx);
const flush = async()=>{for(let i=0;i<50;i++) await Promise.resolve();};
async function nextTimer(){const t=timers.entries().next().value;assert.ok(t);timers.delete(t[0]);t[1].fn();await flush();}
(async()=>{
  // Opera storage never responds: 100s of focus/geometry messages still produce no further IPC.
  for(let i=0;i<150;i++)focusedListener(i%2 ? 22 : 100+i);
  for(let i=0;i<150;i++)boundsListener({id:22});
  assert.equal(storageReads,1,'only startup cache hydration is in flight');
  assert.equal(timers.size,0,'no Wide debounce to fill');
  assert.equal(calls.claims.length,0);
  assert.equal(calls.native.length,0,'uninitialized cache never sends incorrect native state');
  releaseStorage();await flush();
  tabUpdateListener(222,{}, {windowId:22,active:true});
  focusedListener(22);
  await flush();
  assert.equal(calls.native.at(-1)[2],'shell');
  assert.equal(calls.providerMessages.at(-1).message.state.focused,true);
  focusedListener(100);
  assert.equal(calls.native.at(-1)[2],'none');
  focusedListener(42);
  await flush();
  assert.equal(calls.native.at(-1)[2],'shell');
  assert.equal(calls.raise.at(-1),'b','direct focus must restore Twitch B cluster');
  assert.equal(vm.runInContext("shellWideFocusCache['tw-v2'].selectedSlot", ctx),'b');
  assert.equal(calls.providerMessages.at(-1).message.state.focused,false,
    'lost provider focus must reach governor without window query');
  for(let i=0;i<70;i++)focusedListener(42);
  assert.equal(calls.native.length,3,'unchanged visibility is deduplicated');
  assert.equal(storageReads,1,'no storage IPC on hot path');
  assert.equal(calls.claims.length,0,'no native claims on hot path');
  assert.equal(calls.messages.length,0,'no UI broadcasts on hot path');
  changeListener({rightMode:{newValue:'discord'}},'local');
  focusedListener(-1);
  assert.equal(calls.native.at(-1)[2],'discord');
  // Compact retains its intentional fully managed focus path.
  ctx.streamShellDisplayProfileCache.mode='compact';
  focusedListener(22);
  assert.equal(timers.size,1);
  // compact will wait on slow IPC, but Wide never can.
  console.log('Wide focus zero-IPC scans + Twitch slot focus + provider governor: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
