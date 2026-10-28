const fs = require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root = path.resolve(__dirname,'../..');
const src = fs.readFileSync(path.join(root,'landing/src/fmhy.js'),'utf8');
const search = fs.readFileSync(path.join(root,'landing/src/search.js'),'utf8');
class E {
  constructor(tag, cls='', text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.attrs={};this.handlers={};this.hidden=false;
    this.classList={toggle:(c,on)=>{this.className=this.className.replace(' '+c,'');if(on)this.className+=' '+c;},add:c=>{this.className+=' '+c;}};}
  append(...els){this.children.push(...els)}
  appendChild(el){this.children.push(el)}
  replaceChildren(...els){this.children=els}
  setAttribute(k,v){this.attrs[k]=v}
  addEventListener(k,fn){this.handlers[k]=fn}
}
const ctx=vm.createContext({URL,console,Date,setTimeout,clearTimeout,createElement:(tag,cls,text)=>new E(tag,cls,text),
  mediaSearchSource:{value:'fmhy'},mediaSearchInput:{value:'manga'},searchGeneration:1,
  mediaPanelSubtitle:new E('div'),mediaPanelBody:new E('div'),
  chrome:{runtime:{sendMessage:async()=>({ok:true})}},window:{StreamShellDirectLinks:{merge:async()=>true}},
  renderPanelMessage:()=>{}});
vm.runInContext(src,ctx);
const sample = [
  {title:'Manga Index',url:'https://a.test/',category:'reading',section:'Manga Libraries',description:'Manga',kind:'library'},
  {title:'Manga Streaming',url:'https://b.test/',category:'video',section:'Streaming',description:'Manga',kind:'stream'},
  {title:'Manga Tools',url:'https://c.test/',category:'video-tools',section:'Tools',description:'Manga',kind:'tool'},
  {title:'Other Site',url:'https://d.test/',category:'video',section:'TV',description:'Movies',kind:'stream'}
];
ctx.sample=sample;
assert.equal(vm.runInContext('STREAM_SHELL_FMHY_DOCS.length',ctx),11,'nine existing documents plus Gaming and Gaming Tools');
assert.equal(vm.runInContext('STREAM_SHELL_FMHY_AREAS.length',ctx),10,'Gaming grouped as one discovery area');
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(sample,"manga").length',ctx),3);
vm.runInContext('streamShellFmhySelectedAreas.add("reading");streamShellFmhySelectedAreas.add("video")',ctx);
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(sample,"manga").length',ctx),2,'multiple areas OR');
vm.runInContext('streamShellFmhySelectedKinds.add("stream")',ctx);
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(sample,"manga").length',ctx),1,'AND between area and kind');
assert.equal(vm.runInContext('streamShellSearchFmhyIndex(sample,"manga")[0].title',ctx),'Manga Streaming');
vm.runInContext('streamShellFmhySelectedAreas.clear();streamShellFmhySelectedKinds.clear();renderFmhyResults(streamShellSearchFmhyIndex(sample,"manga"),1)',ctx);
const filterBar=ctx.mediaPanelSubtitle.children[0];
assert.equal(filterBar.children.length,3,'summary, area chips, kind chips');
assert.equal(filterBar.children[1].children[1].children.length,10);
assert.equal(filterBar.children[2].children[1].children.length,5);
assert.match(src,/offline excerpt/i);
assert.ok(vm.runInContext('streamShellParseFmhyMarkdown("* ⭐ **[Title](https://test.example/)** - Streaming", "video")[0].recommended',ctx));
assert.equal(vm.runInContext('streamShellFmhyResourceKind("video-tools", "Video Tools", "Download")',ctx),'tool');
// One combined set of filters governs TMDB and AniList at the same time.
const dom={
  'media-search-source':{value:'tmdb'},
  'media-search-tmdb-tab':new E('button'),
  'media-search-fmhy-tab':new E('button')};
const ctx2=vm.createContext({console,document:{getElementById:id=>dom[id]},createElement:(tag,cls,text)=>new E(tag,cls,text),
  mediaSearchInput:{value:'clover',placeholder:'',setAttribute:()=>{}},mediaPanelSubtitle:new E('div'),mediaPanelBody:new E('div'),
  mediaSearchClear:{hidden:false,setAttribute:()=>{}},searchGeneration:1,
  openPanel:()=>{},showSearchHint:()=>{},scheduleSearch:()=>{},
  window:{StreamShellExternalLibrary:{getAll:async()=>[]}},
  createMediaItem:x=>new E('article','',x.mediaType),streamShellAniListResultCard:x=>new E('article','',x.mediaType),
  isSaved:()=>false});
vm.runInContext(search,ctx2);
const movies=[{id:1,mediaType:'movie'},{id:2,mediaType:'tv'}];
const anime=[{mediaType:'anime'},{mediaType:'manga'},{mediaType:'novel'}];
ctx2.movies=movies;ctx2.anime=anime;
(async()=>{
  vm.runInContext('streamShellSearchResultCache.tmdb={query:"clover",items:movies};streamShellSearchResultCache.anilist={query:"clover",items:anime};',ctx2);
  await vm.runInContext('streamShellRenderUnifiedResults("clover",1)',ctx2);
  let list=ctx2.mediaPanelBody.children[0];
  assert.equal(list.children.length,7,'two section headings + five media entries');
  let toolbar=ctx2.mediaPanelSubtitle.children[0];
  assert.equal(toolbar.children[1].children.length,5,'five combined type chips');
  toolbar.children[1].children[2].handlers.click(); // Anime only
  await new Promise(setImmediate);
  list=ctx2.mediaPanelBody.children[0];
  assert.equal(list.children.length,2,'only Anime section + one Anime result');
  toolbar=ctx2.mediaPanelSubtitle.children[0];
  toolbar.children[1].children[0].handlers.click(); // Movies + Anime
  await new Promise(setImmediate);
  list=ctx2.mediaPanelBody.children[0];
  assert.equal(list.children.length,4,'two section headings + Movie + Anime');
  console.log('FMHY facets and unified TMDB/AniList local filtering: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
