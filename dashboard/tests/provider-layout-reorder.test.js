const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const handlers={};
const context=vm.createContext({
 URL,console,
 document:{addEventListener:(name,fn)=>{handlers[name]=fn;}},
 settingsValues:{streamShellSevenSeasAcknowledged:true},
 escapeSettingsHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
 chrome:{runtime:{getURL:p=>p}}
});
for(const f of ['shared/provider-registry-core.js','dashboard/src/provider-layout-settings.js'])
 vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run(`let r=defaultStreamShellProviderRegistry();
r.providers.find(p=>p.id==="youtube-music").enabled=true;
r.providers.find(p=>p.id==="youtube-music").showOnDashboard=true;`);
let result=run('reorderSettingsProviders(r,"dashboard","youtube","netflix",true)');
assert.deepEqual(Array.from(result.dashboardOrder).slice(0,3),['netflix','youtube','youtube-music']);
assert.equal(result.titlebarOrder,run('r.titlebarOrder'),'Dashboard drag preserves titlebar ordering');
result=run('reorderSettingsProviders(r,"titlebar","youtube-music","netflix",true)');
assert.deepEqual(Array.from(result.titlebarOrder).slice(0,3),['youtube','netflix','youtube-music']);
assert.equal(result.dashboardOrder,run('r.dashboardOrder'),'Titlebar keeps Music independent');
assert.equal(run('reorderSettingsProviders(r,"dashboard","youtube","youtube-music")'),run('r'));
run('r.dashboardOrder=["youtube","netflix","prime","youtube-music","disney","crunchyroll","mangayomi"]');
result=run('reorderSettingsProviders(r,"dashboard","disney","youtube",true)');
assert.deepEqual(Array.from(result.dashboardOrder).slice(0,4),['youtube','youtube-music','disney','netflix']);
assert.equal(new Set(result.dashboardOrder).size,result.dashboardOrder.length,'no duplicate entries');
assert.equal(run('reorderSettingsProviders(r,"other","youtube","netflix")'),run('r'));
assert.equal(run('reorderSettingsProviders(r,"dashboard","missing","netflix")'),run('r'));
const control=fs.readFileSync(path.join(root,'dashboard/src/settings-controls.js'),'utf8');
const start=control.indexOf('function settingSwitch('),end=control.indexOf('\nfunction ',start+10);
context.settingStorageKey=x=>x;context.settingChecked=()=>'';context.settingsValues={};
vm.runInContext(control.slice(start,end),context);
for(const key of ['streamShellVisualAnarchy','streamShellVisualZoom','streamShellVisualDeepFry','streamShellVisualVhs','streamShellVisualColor','streamShellVisualGravity','streamShellVisualAspect','streamShellVisualBoss'])
 assert.match(context.settingSwitch(key,'test','test'),/settings-switch-anarchy-dvd/);
assert.doesNotMatch(context.settingSwitch('streamShellTwitchAutoMute','test','test'),/settings-switch-anarchy/);
console.log('Dashboard groups, independent Titlebar order, invalid drops, and Visual Anarchy switches: PASS');
