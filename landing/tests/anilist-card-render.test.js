const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
class E {
    constructor(tag,cls='',content='') {this.tag=tag;this.className=cls;this.textContent=content;this.children=[];this.attrs={};this.listeners={};this.hidden=false;}
    append(...children){this.children.push(...children)}
    appendChild(child){this.children.push(child)}
    replaceChildren(...children){this.children=children}
    setAttribute(key,value){this.attrs[key]=value}
    addEventListener(key,callback){this.listeners[key]=callback}
}
const saved=[];
const enrichQueued=[];
const row={title:'The Title',anilistId:77,mediaType:'anime',coverUrl:'https://s4.anilist.co/file/title.jpg',year:2026,score:79,genres:[]};
const ctx=vm.createContext({Date,console,searchGeneration:1,mediaSearchSource:{value:'tmdb'},
    mediaPanelSubtitle:new E('div'),mediaPanelBody:new E('div'),
    formatDateTime:v=>String(v),
    createElement:(tag,cls='',content='')=>new E(tag,cls,content),
    document:{createElement:tag=>new E(tag)},
    window:{StreamShellAniList:{validCover:u=>u,details:async media=>({...media,description:'Story'})},
        StreamShellExternalLibrary:{getAll:async()=>saved,upsertAniList:async media=>{saved.push(media);return media}}},
    streamShellEnrichAniListMedia:async media=>{enrichQueued.push(media);},
    refreshWatchlistCache:async()=>true,
    streamShellSearchMatchesType:()=>true, streamShellSearchTypeSubtitle:()=>{},
    renderPanelMessage:()=>{throw Error('unexpected empty results')}
});
vm.runInContext(fs.readFileSync(path.join(root,'landing/src/mangayomi-search-handoff.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'landing/src/anilist.js'),'utf8'),ctx);
(async()=>{
await vm.runInContext('renderAniListResults([{title:"The Title",anilistId:77,mediaType:"anime",coverUrl:"https://s4.anilist.co/file/title.jpg",score:79}],1)',ctx);
const list=ctx.mediaPanelBody.children[0],card=list.children[0];
assert.equal(card.children.length,4,'cover, information, actions, details');
assert.equal(card.children[0].tag,'img');
assert.equal(card.children[1].children[0].children[0].textContent,'The Title');
const buttons=card.children[2].children;
assert.equal(buttons.length,3);
await buttons[2].listeners.click();
assert.equal(saved.length,1);assert.equal(saved[0].description,'Story');assert.equal(buttons[2].disabled,true);
assert.equal(enrichQueued.length,1,'successful save schedules optional TMDB enrichment');
buttons[1].listeners.click();assert.equal(card.children[3].hidden,false);
console.log('AniList cards: save action, metadata, cover, details toggle: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
