const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'background/src/09-message-router.js'), 'utf8');
const start = source.indexOf('        if (message.type === "dashboard-diagnostics-lite") {');
const end = source.indexOf('        if (\n            message.type ===\n                "dashboard-diagnostics"',start);
assert.ok(start > 0 && end > start, 'lite handler exists');
const block = source.slice(start, end);
assert.doesNotMatch(block, /chrome\.(?:storage|windows|tabs|scripting)\./, 'panel must not do browser work');
assert.doesNotMatch(block, /await\s/, 'cached reply must not wait on promises');
let reply = null;
const now = Date.now();
const selfTest = { startedAt: now - 10000, ok:true, providers: {youtube:{windowAlive:true, report:{ok:true,apiVersion:1,capabilities:{'common.playback':{supported:true,available:true}}}}}};
const ctx = {
 message:{type:'dashboard-diagnostics-lite'}, sender:{},
 isDashboardSender:()=>true,sendResponse:data=>{ reply = data; },
 shellWideFocusCache:{ activeProvider:'youtube',leftMode:'youtube',rightMode:'twitch',providerWindows:{youtube:100},landingWindowId:10,dashboardWindowId:20, streamShellLaunchSelfTest:selfTest, twitchv2:{version:7,selectedSlot:'b',slots:{a:{kind:'page',windowId:41},b:{kind:'stream',windowId:42},c:{kind:'stream',windowId:43},d:{kind:'stream',windowId:44}}}},
 TWITCH_WORKSPACE_V2_STORAGE_KEY:'twitchv2',STREAM_SHELL_SELF_TEST_KEY:'streamShellLaunchSelfTest',
 TWITCH_WORKSPACE_V2_SLOT_IDS:['a','b','c','d'], TWITCH_WORKSPACE_V2_VERSION:7,
 twitchWorkspaceV2ClaimStates:new Map([[41,{phase:'confirmed',member:'a',attempts:1,sentAt:now-1000,acknowledgedAt:now-200}],[42,{phase:'pending',member:'b',attempts:2,sentAt:now-300}]]),
 twitchWorkspaceV2ForceRebindIds:new Set(), PROVIDERS:{youtube:1,netflix:1,prime:1,disney:1,crunchyroll:1},
 titlebarPort:{},titlebarProtocolReady:true,TITLEBAR_PROTOCOL_VERSION:9,TITLEBAR_RECONCILE_INTERVAL_MS:2500,
 titlebarLastNativeStatus:{twitchClusterMembers:4,twitchClusterMap:'a=123'},
 titlebarSettingsOpen:false,titlebarVolumeActive:false,streamShellTitlebarArtworkStatus:new Map(),
 titlebarProviderSyncPhase:'artwork-ready',titlebarProviderGeneration:2,titlebarProviderAckGeneration:2,
 titlebarProviderLastSentAt:1,titlebarProviderLastAckAt:2,titlebarProviderLastRejectedIconCount:0,titlebarProviderLastError:null,
 shellWideFocusVisibility:'shell',flightRecorderEvents:[],STREAM_SHELL_FLIGHT_RECORDER_MAX_EVENTS:80,
 shellWideFocusEventCount:20,shellWideFocusLastId:10,shellWideFocusCacheReady:true,
 shellWindowEventPendingCount:0,shellWindowEventRunning:false,streamShellTransitionActive:null,streamShellTransitionWaiters:0,
 streamShellLastRendererLaunchKind:'twitch',streamShellLastRendererLaunchFinishedAt:now,
 streamShellDisplayProfileCache:{mode:'wide',targetDisplay:{referenceTarget:'32:9'}},
 titlebarSlowReconcileSkippedUnmanaged:3,titlebarSlowReconcileLastRanAt:now-1000,
 shouldDeferTitlebarSlowReconcile:()=>false,
};
vm.runInNewContext('(function () {\n'+block+'\n})()',ctx);
assert.equal(reply.ok,true);
assert.equal(reply.titlebarProtocolReady,true);
assert.equal(reply.displayProfile.mode,'wide');
assert.equal(reply.providerWindows.youtube.windowId,100);
assert.equal(reply.launchSelfTest.providers.youtube.report.ok,true);
assert.equal(reply.twitchWorkspaceV2.windows[0].nativeClaim.phase,'confirmed');
assert.equal(reply.twitchWorkspaceV2.windows[1].nativeClaim.phase,'pending');
assert.equal(reply.twitchWorkspaceV2.windows[2].nativeClaim,null);
assert.equal(reply.browserWindowsTotal,null,'not falsely report browser total 0');
assert.equal(reply.discord,null,'unpolled Discord is not a failed helper');
const frontend=fs.readFileSync(path.join(root,'dashboard/src/settings-diagnostics.js'),'utf8');
const cellStart=frontend.indexOf('function diagnosticsCapabilityCell(');
const cellEnd=frontend.indexOf('async function collectSettingsDiagnostics',cellStart);
const htmlContext={PROVIDER_NAMES:{youtube:'YouTube',netflix:'Netflix'},escapeSettingsHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;')};
vm.runInNewContext(frontend.slice(cellStart,cellEnd),htmlContext);
// vm declared functions are attached to context after execution.
const matrix=htmlContext.diagnosticsCapabilityMatrix({youtube:{known:true,alive:null,cached:true},netflix:{known:false}},selfTest);
assert.match(matrix,/v1\*/,'cached provider is not shown as down');
assert.doesNotMatch(matrix,/DOWN/,'unknown liveness must not mean DOWN');
assert.match(matrix,/OK/,'cached capability renders');
assert.match(frontend,/hydrateActiveProviderDiagnostics\(settingsDiagnosticsSnapshot, epoch\)/,'active provider gets one deferred targeted check');
console.log('Diagnostics panel cached health + real native claims + deferred provider hydrate: PASS');
