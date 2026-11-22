/* v0.20.40: a viewer raid is only canceled via its positively identified
 * banner/Leave button or an explicitly tagged raid referral; never trap
 * legitimate user channel changes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const automation = fs.readFileSync(path.join(root,'providers/player/twitch-automation.js'),'utf8');
const background = fs.readFileSync(path.join(root,'background/src/05aa-twitch-workspace-v2.js'),'utf8');
const autoStart=automation.indexOf('    function raidContainers() {');
const autoEnd=automation.indexOf('    function automationEnabled() {',autoStart);
assert.ok(autoStart>=0&&autoEnd>autoStart);
const autoSource=automation.slice(autoStart,autoEnd);
assert.match(automation,/setInterval\(preventRaid, 1500\)/,'raid countdown is audited promptly');
assert.doesNotMatch(automation,/lastStableChannelUrl|twitch-arm-raid-guard/,'legacy generic snapback not revived');

class Element {
    constructor({text='',attrs={},buttons=[],visible=true,selector='div'}={}) {
        this.textContent=text;this.attrs=attrs;this.buttons=buttons;
        this.visible=visible;this.tagName=selector.toUpperCase();
        this.className=attrs.class||'';this.disabled=false;this.clicks=0;
    }
    getAttribute(name){return this.attrs[name]??null;}
    matches(sel){return this.tagName==='BUTTON' && sel.includes('button');}
    querySelectorAll(){return this.buttons;}
    getClientRects(){return this.visible?[{width:300,height:30}]:[];}
    click(){this.clicks++;}
}
const labels={lastResult:'not-seen',bannersSeen:0,optOutAttempts:0,lastOptOutAt:null,lastOptOutLabel:null,lastScanAt:null};
let roots=[];
const recoveryStops=[];
const context=vm.createContext({
    Element,Date,Number,Array,Set,WeakMap,
    core:{stopPlaybackRecovery:reason=>recoveryStops.push(reason)},
    document:{querySelectorAll(){return roots;}},
    getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),
    raidProtectionEnabled:true,raidGuardCooldownUntil:0,raidGuardMetrics:labels,
    recentClicks:new WeakMap(),
    isEnabled:element=>Boolean(element&&!element.disabled),
    clickOnce:function(element){element.click();return true;}
});
vm.runInContext(autoSource,context);
const scan=()=>vm.runInContext('preventRaid()',context);
let unrelated=new Element({text:'Do you wish to leave?',attrs:{role:'dialog'},buttons:[new Element({text:'Leave',selector:'button'})]});
roots=[unrelated];scan();assert.equal(unrelated.buttons[0].clicks,0,'generic Leave is never clicked');
const raidLeave=new Element({text:'Leave',attrs:{'aria-label':'Leave'},selector:'button'});
const raidBanner=new Element({text:'Someone is raiding another channel in 15s',attrs:{'data-a-target':'raid-banner'},buttons:[raidLeave]});
roots=[raidBanner];scan();assert.equal(raidLeave.clicks,1,'viewer Leave button is clicked within raid banner');
assert.equal(labels.optOutAttempts,1);
assert.deepEqual(recoveryStops,['raid-opt-out']);
scan();assert.equal(raidLeave.clicks,1,'short opt-out cooldown prevents repeated clicks');
const raidHidden=new Element({text:'Raiding another channel',attrs:{'data-a-target':'raid-banner'},buttons:[new Element({text:'Leave',selector:'button'})],visible:false});
context.raidGuardCooldownUntil=0;roots=[raidHidden];scan();assert.equal(raidHidden.buttons[0].clicks,0,'hidden stale banner not clicked');
const ambiguous=new Element({text:'Channel is raiding now',attrs:{'data-a-target':'raid-banner'},buttons:[new Element({text:'Continue',selector:'button'})]});
roots=[ambiguous];scan();assert.equal(labels.lastResult,'raid-banner-no-opt-out','missing opt-out is not falsely called success');
assert.equal(context.raidGuardCooldownUntil,0,'missing button does not suppress future scans');
const nestedOnly=new Element({text:'Leave',attrs:{'data-a-target':'raid-leave-button'},selector:'button'});
roots=[nestedOnly];scan();assert.equal(nestedOnly.clicks,1,'positive raid-selector button can be targeted directly');
context.raidProtectionEnabled=false;context.raidGuardCooldownUntil=0;roots=[raidBanner];scan();assert.equal(raidLeave.clicks,1,'off means off');

const funcStart=background.indexOf('const twitchWorkspaceV2RaidRedirectRecoveries = new Map();');
const funcEnd=background.indexOf('async function reconcileClosedTwitchWorkspaceV2Window(',funcStart);
assert.ok(funcStart>=0 && funcEnd>funcStart);
const bgSource=background.slice(funcStart,funcEnd);
const baseUrl='https://www.twitch.tv/original';
const raidUrl='https://www.twitch.tv/recipient?referrer=raid';
const normalUrl='https://www.twitch.tv/recipient';
const makeRecord=raidProtectionEnabled=>({slots:{b:{url:baseUrl,kind:'stream',kindSource:'auto',label:'original',tabId:8,windowId:7,raidProtectionEnabled}}});
const changes=[];let record=makeRecord(true),persist=0,alarms=0;
const cx=vm.createContext({
    URL,Date,Number,Map,Promise,
    chrome:{tabs:{update:async (id,arg)=>{changes.push([id,arg]);return {id};}}},
    getTwitchWorkspaceV2Record:async()=>record,
    getTwitchWorkspaceV2SlotByWindowId:()=> 'b',
    isTwitchUrl:url=>/^https:\/\/www\.twitch\.tv\//.test(url),
    isTwitchDropsUrl:()=>false,
    twitchWorkspaceV2ChannelFromUrl:url=>new URL(url).pathname.slice(1).split('/')[0],
    inferTwitchWorkspaceV2Kind:()=> 'stream',
    setTwitchWorkspaceV2Record:async next=>{persist++;record=next;return next;},
    syncTwitchWorkspaceV2StreamRefreshAlarms:async()=>{alarms++;},
    rememberTwitchContentUrl:async()=>{},
    recordFlightEvent:async()=>{},
});
vm.runInContext(bgSource,cx);
const sync=async url=>vm.runInContext('syncTwitchWorkspaceV2Location(__tab)',Object.assign(cx,{__tab:{id:8,windowId:7,url}}));
(async()=>{
    await sync(raidUrl);
    assert.equal(changes.length,1,'explicit raid referral restored once');
    assert.equal(changes[0][1].url,baseUrl,'restore only existing original channel');
    assert.equal(persist,0,'raid target never persisted for upcoming launch');
    await sync(raidUrl);
    assert.equal(changes.length,1,'duplicate webNavigation/tab update deduplicated');
    await sync(normalUrl);
    assert.equal(changes.length,1,'normal deliberate navigation never rolled back');
    assert.equal(record.slots.b.url,normalUrl,'normal navigation persists');
    assert.equal(persist,1);
    record=makeRecord(false);
    await sync(raidUrl);
    assert.equal(changes.length,1,'anti-raid off leaves tagged navigation alone');
    assert.equal(record.slots.b.url,raidUrl,'disabled guard persists new target');
    assert.ok(alarms>=1);
    console.log('Twitch Raid Guard: viewer banner Leave, opt-out timing and tagged-only redirect: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
