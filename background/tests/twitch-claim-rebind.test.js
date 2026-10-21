/* v0.20.6: Replacement popup must receive a NEW HWND, not a renewed stale native mapping. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root,'background/src/05aa-twitch-workspace-v2.js'),'utf8');
const native = require('./native-titlebar-source')();
const events = fs.readFileSync(path.join(root,'background/src/11-playback-state-events.js'),'utf8');
const cut = (start,end) => {const a=src.indexOf(start);const b=src.indexOf(end,a);assert.ok(a>=0&&b>a,start);return src.slice(a,b);};
const code = cut('async function ensureTwitchWorkspaceV2Slot(', '/* A native claim is NOT') + '\n' +
  cut('const twitchWorkspaceV2ClaimStates = new Map();','function scheduleTwitchWorkspaceV2Claims(');
const calls=[]; const store=[];
const ctx=vm.createContext({
 Date,Map,Set,Number,String,Promise,console,shuttingDown:false,
 TWITCH_WORKSPACE_V2_SLOT_IDS:['a','b','c','d'],TITLEBAR_PROTOCOL_VERSION:9,
 titlebarPort:{postMessage:m=>calls.push(m)}, titlebarProtocolReady:true,
 getTwitchWorkspaceV2Window:async id=>null,
 createTwitchWorkspaceV2Popup:async()=>({id:142,tabs:[{id:143,title:'Pondy_WLRUS - Twitch'}]}),
 getTwitchWorkspaceV2Rects:()=>({d:{left:2880,top:520,width:960,height:560}}),
 twitchWorkspaceV2ControllerUrl:id=>`slot-${id}`,
 isTwitchUrl:u=>!!u,
 setTwitchWorkspaceV2Record:async r=>{store.push(r);return r;},
 ensureTitlebarNative:async()=>{},
 chrome:{windows:{get:async id=>({id,tabs:[{id:143,title:'Pondy_WLRUS - Twitch'}],state:'normal'})},
   tabs:{update:async()=>{}}}
});
vm.runInContext(code,ctx);
const run=code=>vm.runInContext(code,ctx);
(async()=>{
  const record={slots:{d:{id:'d',kind:'stream',url:'https://www.twitch.tv/pondy_wlrus',audioMuted:true,windowId:42,tabId:43}}};
  ctx.record=record;
  const result=await run('ensureTwitchWorkspaceV2Slot(record,"d",false)');
  assert.equal(result.record.slots.d.windowId,142);
  assert.equal(run('twitchWorkspaceV2ForceRebindIds.has(142)'),true);
  assert.equal(await run('claimTwitchWorkspaceV2Window(142,"d",getTwitchWorkspaceV2Rects().d)'),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].forceRebind,true);
  assert.equal(calls[0].browserWindowId,142);
  run('acknowledgeTwitchWorkspaceV2Claim({layoutProfile:"wide",side:"right",mode:"twitch",member:"d",renewed:true,browserWindowId:42})');
  assert.equal(run('twitchWorkspaceV2ClaimStates.get(142).phase'),'pending','old popup ack ignored');
  run('acknowledgeTwitchWorkspaceV2Claim({layoutProfile:"wide",side:"right",mode:"twitch",member:"d",browserWindowId:142,renewed:true})');
  assert.equal(run('twitchWorkspaceV2ClaimStates.get(142).phase'),'pending','unverified renewal ignored');
  run('acknowledgeTwitchWorkspaceV2Claim({layoutProfile:"wide",side:"right",mode:"twitch",member:"d",browserWindowId:142,rebound:true})');
  assert.equal(run('twitchWorkspaceV2ClaimStates.get(142).phase'),'confirmed');
  assert.equal(run('twitchWorkspaceV2ForceRebindIds.has(142)'),false);
  assert.equal(await run('claimTwitchWorkspaceV2Window(142,"d",getTwitchWorkspaceV2Rects().d)'),true);
  assert.equal(calls.length,1,'confirmed stable claim does not re-send');
  assert.ok(events.includes('cancelTitlebarClaimRetries(false);'),'unmanaged focus must not cancel Twitch native claims');
  assert.ok(native.includes('WideTwitchClaimBrowserWindowIds'),'native must correlate HWND with browser ID');
  assert.ok(native.includes('claim.ForceRebind || browserIdentityChanged'),'native must detect old-window mapping');
  assert.ok(native.includes('forceRebind && !alreadyRebound ? mapped : IntPtr.Zero'),'new claim cannot select the old HWND');
  assert.ok(native.includes('forceRebind && alreadyRebound ?'),'retry of already rebound HWND remains idempotent');
  assert.ok(native.includes('GetJsonInt(json, "browserWindowId", 0)'),'native uses browser ID from claim');
  console.log('Twitch popup replacement native HWND rebind + pending claim isolation: 8 scenarios PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
