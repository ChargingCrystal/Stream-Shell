/* Both catalogues searched in one operation; missing TMDB token doesn't block AniList. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/search.js'),'utf8');
class Node {constructor(tag,cls='',content=''){this.tag=tag;this.className=cls;this.textContent=content;this.children=[];this.hidden=false;this.listeners={};this.classList={toggle:()=>{}};}
 append(...els){this.children.push(...els)} appendChild(el){this.children.push(el)} replaceChildren(...els){this.children=els}
 setAttribute(){} addEventListener(n,cb){this.listeners[n]=cb}}
(async()=>{
let tmdbCalls=0,anilistCalls=0,token=true;
const nodes={'media-search-source':{value:'tmdb'},'media-search-tmdb-tab':new Node('button'),'media-search-fmhy-tab':new Node('button')};
const context=vm.createContext({console,document:{getElementById:id=>nodes[id]},
 createElement:(...a)=>new Node(...a),searchGeneration:5,
 mediaSearchInput:{value:'mirai nikki',setAttribute:()=>{}},mediaPanelSubtitle:new Node('div'),mediaPanelBody:new Node('div'),
 window:{StreamShellMediaApi:{hasToken:async()=>token,searchMedia:async()=>{tmdbCalls++;return [{title:'Future Diary',mediaType:'tv'}]}},
 StreamShellAniList:{search:async()=>{anilistCalls++;return [{title:'Mirai Nikki',mediaType:'anime',anilistId:1}]}} ,
 StreamShellExternalLibrary:{getAll:async()=>[]}},
 isSaved:()=>false,createMediaItem:i=>new Node('article','',i.mediaType),streamShellAniListResultCard:i=>new Node('article','',i.mediaType),
 refreshWatchlistCache:async()=>{},renderPanelMessage:()=>{},openPanel:()=>{},searchResults:[],searchTimer:null});
vm.runInContext(source,context);
await vm.runInContext('runSearch("mirai nikki",5)',context);
assert.equal(tmdbCalls,1);assert.equal(anilistCalls,1);
assert.equal(context.mediaPanelBody.children[0].children.length,4,'both sources grouped into one panel');
token=false;
vm.runInContext('searchGeneration=6',context);
await vm.runInContext('runSearch("mirai nikki",6)',context);
assert.equal(tmdbCalls,1,'no TMDB request without token');assert.equal(anilistCalls,2,'AniList still searched');
assert.equal(context.mediaPanelBody.children[0].children.length,2,'AniList results remain accessible');
console.log('Unified TMDB + AniList query and missing-token degradation: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
