const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/fmhy.js'),'utf8');
const search = fs.readFileSync(path.join(__dirname, '../src/search.js'),'utf8');
class Node {
  constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.attrs={};this.handlers={};this.hidden=false;
    this.classList={add:x=>{this.className+=' '+x},toggle:(x,on)=>{if(on)this.className+=' '+x}};}
  append(...x){this.children.push(...x)}
  appendChild(x){this.children.push(x)}
  replaceChildren(...x){this.children=x}
  addEventListener(t,cb){this.handlers[t]=cb}
  setAttribute(k,v){this.attrs[k]=v}
}
const doc = { 'media-search-source':{value:'fmhy'},
  'media-search-tmdb-tab':new Node('button'),
  'media-search-anilist-tab':new Node('button'),
  'media-search-fmhy-tab':new Node('button') };
const ui = {URL,Date,console,setTimeout,clearTimeout,
  createElement:(t,c,x)=>new Node(t,c,x),
  document:{getElementById:id=>doc[id]},
  mediaSearchInput:{value:'previous TMDB movie',setAttribute:()=>{}},
  mediaSearchClear:{hidden:false,setAttribute:()=>{}},
  mediaPanelSubtitle:new Node('div'),mediaPanelBody:new Node('div'),
  mediaSearchSource:doc['media-search-source'],searchGeneration:1,searchTimer:null,searchResults:[],
  renderPanelMessage:()=>{},openPanel:()=>{},
  chrome:{runtime:{sendMessage:async()=>({ok:true})}},
  window:{StreamShellDirectLinks:{merge:async()=>true}}
};
const ctx=vm.createContext(ui);
vm.runInContext(source,ctx);
vm.runInContext(search,ctx);
ctx.rows=[
  {title:'Unmarked Fixes',url:'https://fix.example/',category:'gaming',section:'Gaming Tools',description:'Fix games',kind:'tool',recommended:false},
  {title:'Recommended Game Wiki',url:'https://wiki.example/',category:'gaming',section:'Gaming Tools',description:'Game fixes',kind:'tool',recommended:true},
  {title:'Recommended Video',url:'https://video.example/',category:'video',section:'Streaming',description:'Watch movies',kind:'stream',recommended:true},
  {title:'Game Downloads',url:'https://download.example/',category:'gaming',section:'Game Downloads',description:'Games',kind:'download',recommended:false}
];
vm.runInContext('fmhyResourceCache=rows; fmhyLoadedAreas=10; fmhyUsingFallback=false;',ctx);
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(rows, "").length',ctx),0,'no unbounded catalogue without an explicit category');
vm.runInContext('streamShellFmhySubtitle("Choose an Area")',ctx);
const chips=ui.mediaPanelSubtitle.children[0].children[1].children[1].children;
assert.equal(chips[0].textContent,'Gaming','gaming is immediately discoverable');
chips[0].handlers.click();
assert.equal(ui.mediaSearchInput.value,'','clicking a discovery category clears stale keyword');
assert.equal(ui.mediaSearchClear.hidden,true);
assert.equal(vm.runInContext('streamShellFmhySelectedAreas.has("gaming")',ctx),true);
const listing=ui.mediaPanelBody.children[0].children;
assert.equal(listing.length,3,'only Gaming records in browsing mode');
assert.equal(listing[0].children[1].children[0].children[0].textContent,'Recommended Game Wiki', 'FMHY starred picks first');
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(rows, "", {areas:new Set(["gaming"]),kinds:new Set(["tool"])}).length',ctx),2);
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(rows, "", {areas:new Set(["video"]),kinds:new Set()}).length',ctx),1);
assert.equal(vm.runInContext('streamShellFmhyDocumentArea("gaming-tools.md")',ctx),'gaming');
assert.equal(vm.runInContext('streamShellFmhyDocumentArea("gaming.md")',ctx),'gaming');
assert.equal(vm.runInContext('fmhyAllAreas',ctx),10);
// Incremental pagination rather than silently clipping exploration at 60.
ctx.big=Array.from({length:130},(_,i)=>({title:'Entry '+i,url:`https://games${i}.example/`,category:'gaming',section:'Game tools',description:'Library',kind:'tool'}));
vm.runInContext('renderFmhyResults(streamShellSearchFmhyIndex(big,""),searchGeneration)',ctx);
let page=ui.mediaPanelBody.children[0].children;
assert.equal(page.length,61,'60 rows and Show more control');
assert.match(page[60].textContent,/Show more/);
page[60].handlers.click();
page=ui.mediaPanelBody.children[0].children;
assert.equal(page.length,121,'next 60 rows and Show more');
page[120].handlers.click();
assert.equal(ui.mediaPanelBody.children[0].children.length,130,'all 130 entries reachable');
// Empty FMHY query with selected category must be scheduled; other search tabs
// should still require 2 characters as before.
vm.runInContext('mediaSearchInput.value="";scheduleSearch()',ctx);
assert.equal(vm.runInContext('searchGeneration',ctx),2,'category browsing is a real search event');
vm.runInContext('streamShellFmhySelectedAreas.clear();mediaSearchInput.value="";scheduleSearch()',ctx);
assert.equal(vm.runInContext('searchGeneration',ctx),3);
console.log('FMHY category-only discovery, Gaming docs, picks, pagination, and search scheduling: PASS');
