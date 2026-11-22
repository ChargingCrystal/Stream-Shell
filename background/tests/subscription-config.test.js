const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

(async()=>{
const registrySource = read('shared/provider-registry-core.js');
const config = {
 youtube:{visible:true,url:'https://www.youtube.com/paid_memberships?billing=1',amount:12,interval:'month'},
 netflix:{visible:false},prime:{visible:false},disney:{visible:false},crunchyroll:{visible:false},discord:{visible:false},
 'custom-abcdefgh':{visible:true,mode:'auto',url:'https://example.org/account',amount:120,interval:'year',status:'active'}
};
const stored = {
 streamShellSubscriptionConfig:config,
 streamShellProviderRegistry:{providers:[{id:'custom-abcdefgh',kind:'custom',name:'Custom',url:'https://example.org/',enabled:true}]},
 streamShellSubscriptions:{items:{'custom-abcdefgh':{status:'ending',renewal:'original'},netflix:{status:'active',renewal:'retained'}}}
};
const calls=[], writes=[];
const context=vm.createContext({
 URL, console, SUBSCRIPTION_STORAGE_KEY:'streamShellSubscriptions',
 GOOGLE_PLAY_SUBSCRIPTIONS_URL:'https://play.google.com/store/account/subscriptions',
 PRIME_CENTRAL_URL:'https://www.amazon.de/gp/primecentral',
 setTimeout, clearTimeout, subscriptionSyncLock:null,
 chrome:{storage:{local:{get:async()=>stored,set:async data=>writes.push(data)}},
 tabs:{query:async()=>[{id:7}]}},
 safelyRemoveWindow:async()=>{}
});
vm.runInContext(registrySource,context);
vm.runInContext(read('background/src/08-subscriptions.js'),context);
context.createSubscriptionSyncWindow=async()=>({id:8});
context.navigateSubscriptionTab=async(id,url)=>calls.push(url);
context.wait=async()=>{};
context.scrapeSubscriptionTab=async()=>({status:'active',checkedAt:10});
context.scrapeGooglePlaySubscriptionsTab=async()=>({});
context.mergeGooglePlaySubscriptionData=items=>{items.netflix={status:'inactive'};items['custom-abcdefgh']={status:'inactive'};};
const result=await vm.runInContext('_syncSubscriptions("youtube")',context);
assert.equal(calls[0],config.youtube.url,'sync must use the edited account URL');
assert(!calls.some(url=>url.startsWith('https://example.org')),'custom providers cannot opt into unsupported scraping');
assert.equal(result.items.netflix.status,'active','per-provider sync retains unselected scraped data');
assert.equal(result.items['custom-abcdefgh'].renewal,'original','Google Play cannot overwrite manual providers');
calls.length=0;
await vm.runInContext('_syncSubscriptions("custom-abcdefgh")',context);
assert.equal(calls.length,0,'manual-only sync must not open a window');

const entries=vm.runInContext('streamShellSubscriptionEntries(normalizeStreamShellProviderRegistry({providers:[{id:"custom-abcdefgh",kind:"custom",name:"Custom",url:"https://example.org"}]}),'+JSON.stringify(config)+')',context);
assert.equal(entries.filter(p=>p.visible).length,2);
assert.equal(entries.find(p=>p.id==='custom-abcdefgh').mode,'manual');
assert(!entries.some(p=>p.id==='youtube-music'),'Music is not double-counted');
assert(!("amount" in entries[0]),"subscription config must not own Finance prices");
const unsafe=vm.runInContext('streamShellSubscriptionEntries(defaultStreamShellProviderRegistry(),{youtube:{url:"javascript:alert(1)",amount:-4}})',context)[0];
assert.equal(unsafe.url,'');

class Element {
 constructor(){this.children=[];this.dataset={};this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);}
 appendChild(node){this.children.push(node);}
 replaceChildren(){this.children=[];}
 addEventListener(){}
}
const grid=new Element(), meta=new Element(), button=new Element();
const ui=vm.createContext({
 URL,Intl,Date,Map,Number,console,
 subscriptionSyncMeta:meta,subscriptionSyncButton:button,subscriptionItems:new Map(),
 SUBSCRIPTION_STORAGE_KEY:'streamShellSubscriptions',
 SUBSCRIPTION_STATUS_LABELS:{active:'ACTIVE',ending:'ENDING',inactive:'INACTIVE',unknown:'UNKNOWN'},
 document:{querySelector:s=>s==='.subscription-grid'?grid:null,createElement:()=>new Element()},
 chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p},storage:{onChanged:{addListener(){}}}}
});
vm.runInContext(registrySource,ui);
vm.runInContext(read('landing/src/subscriptions.js'),ui);
vm.runInContext('landingSubscriptionConfig='+JSON.stringify(config)+';landingSubscriptionRegistry=normalizeStreamShellProviderRegistry('+JSON.stringify(stored.streamShellProviderRegistry)+');renderSubscriptionState({items:{youtube:{status:"active"}}});',ui);
assert.equal(grid.children.length,2,'Landing shows exactly the configured subscription rows');
assert.equal(grid.children[1].children.length,4,'original four-column panel');
assert.equal(meta.textContent,'Never synced');
console.log('Subscription URLs, manual-only mode, existing finance ownership, targeted sync and dynamic Landing rendering: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
