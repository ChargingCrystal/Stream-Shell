/* No cross-store deletion and no false positives: only a unique, compatible,
 * same-year AniList anime is linked to an existing TMDB title for display. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
const script = fs.readFileSync(path.join(root,'landing/src/library.js'),'utf8');
const ctx = vm.createContext({watchlistSort:{value:'added-desc'}});
vm.runInContext(fs.readFileSync(path.join(root,'landing/src/mangayomi-search-handoff.js'),'utf8'),ctx);
vm.runInContext(script,ctx);
const link = (tmdb,external) => Array.from(vm.runInContext('streamShellLinkLibraryEntries',ctx)(tmdb,external));
const soloTMDB = {id:111,mediaType:'tv',title:'Solo Leveling',releaseDate:'2024-01-07',addedAt:100};
const soloAniList = {id:'uuid-ani',source:'anilist',mediaType:'anime',anilistId:151807,title:'Solo Leveling',year:2024,format:'TV',coverUrl:'https://s4.anilist.co/title.jpg',addedAt:200};
let items = link([soloTMDB],[soloAniList]);
assert.equal(items.length,1,'matching anime + TV must render once');
assert.equal(items[0].kind,'linked');
assert.strictEqual(items[0].media,soloTMDB,'TMDB reference stays intact for availability');
assert.strictEqual(items[0].anilist,soloAniList,'AniList metadata/cover remains independently saved');
assert.equal(items[0].media.id,111);
assert.equal(items[0].anilist.anilistId,151807);
const sorting = vm.runInContext('streamShellSortedLibrary',ctx);
assert.equal(Array.from(sorting([soloTMDB],[soloAniList])).length,1);
assert.equal(link([soloTMDB],[{...soloAniList,year:2025}]).length,2,'season/year mismatch must not auto-merge');
assert.equal(link([soloTMDB],[{...soloAniList,mediaType:'manga'}]).length,2,'manga must not merge with TV');
assert.equal(link([soloTMDB],[{...soloAniList,format:'MOVIE'}]).length,2,'anime movies must not merge into TV');
assert.equal(link([{...soloTMDB,mediaType:'movie'}],[{...soloAniList,format:'MOVIE'}]).length,1,'movies may match anime movies');
assert.equal(link([soloTMDB],[{...soloAniList,source:'mangayomi'}]).length,2,'manual entries without AniList identity remain separate');
assert.equal(link([{...soloTMDB,year:null,releaseDate:''}],[soloAniList]).length,2,'missing year must not guess');
assert.equal(link([soloTMDB,{...soloTMDB,id:112}],[soloAniList]).length,3,'ambiguous TMDB records must stay separate');
assert.equal(link([soloTMDB],[soloAniList,{...soloAniList,id:'other',anilistId:151808}]).length,3,'ambiguous AniList records must stay separate');
assert.equal(link([soloTMDB],[{...soloAniList,title:'  SOLO - Leveling ' }]).length,1,'punctuation/spacing/case normalized');
assert.equal(link([soloTMDB],[{...soloAniList,title:'Other Title',originalTitle:'Solo Leveling'}]).length,1,'alternative titles match same year');
assert.equal(link([{...soloTMDB,title:'Dune'}],[soloAniList]).length,2,'unrelated titles never merge');
// Render wiring: native AniList row is hidden only when paired, and linked
// cards keep the original TMDB card factory (availability and action handlers).
assert.match(script,/createMediaItem\(tmdb,options\)/);
assert.match(script,/streamShellAniListCover\(anilist,"ss-anilist-cover"\)/);
assert.match(script,/row\.insertBefore\(cover,main\)/);
assert.match(script,/visibleRows = streamShellSortedLibrary\(tmdbItems,nativeItems\)\s*\.filter\(streamShellLibraryMatchesType\)/);
assert.match(script,/streamShellLinkedMediaRow\(row\.media,row\.anilist\)/);
assert.match(script,/streamShellLinkLibraryEntries\(watchlistItems,externalItems\)\.length - watchlistItems\.length/);
console.log('Cross-source Library title linking: unique, typed, dated, non-destructive display PASS');

// Render integration regression: linked row retains the original TMDB card
// and gains cover and secondary app/detail actions without another media card.
class E {
    constructor(tag,cls='',txt='') { this.tag=tag; this.className=cls; this.textContent=txt; this.children=[]; this.listeners={}; this.attrs={}; this.hidden=false;
        this.classList={add:name=>{this.className+=` ${name}`}}; }
    appendChild(node) { this.children.push(node); return node; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    insertBefore(node,before) { const i=this.children.indexOf(before); if (i<0) throw Error('missing child'); this.children.splice(i,0,node); }
    querySelector(name) {
        if (name.startsWith('.')) return this.children.find(v=>String(v.className).split(' ').includes(name.slice(1))) ||
            this.children.map(v=>v.querySelector?.(name)).find(Boolean) || null;
        return null;
    }
    setAttribute(name,val) { this.attrs[name]=val; }
    addEventListener(name,cb) { this.listeners[name]=cb; }
}
const row = new E('article','media-item');
const main = new E('button','media-item-main');
const titleRow = new E('div','media-item-title-row');
titleRow.appendChild(new E('span','media-item-type','Series'));
main.append(titleRow,new E('div','media-item-meta'));
const actions = new E('div','media-item-actions');
actions.appendChild(new E('button','media-item-action remove','×'));
row.append(new E('button','media-item-refresh'),main,actions);
let invoked=0;
Object.assign(ctx,{
    createMediaItem:(media,opts)=>{ invoked++; assert.strictEqual(media,soloTMDB); assert.equal(opts.mode,'watchlist'); return row; },
    streamShellAniListCover:()=>new E('img','ss-anilist-cover'),
    streamShellAniListDetails:()=>new E('div','ss-anilist-details'),
    createElement:(tag,cls,txt)=>new E(tag,cls,txt),
    chrome:{runtime:{sendMessage:async()=>({ok:true})}},
    window:{alert:()=>{throw Error('no alert expected')}}
});
const renderer=vm.runInContext('streamShellLinkedMediaRow',ctx);
const rendered=renderer(soloTMDB,soloAniList);
assert.strictEqual(rendered,row);assert.equal(invoked,1);
assert.equal(row.children[1].tag,'img','AniList artwork next to TMDB selection');
assert.equal(row.children[2],main,'original TMDB main is preserved');
assert.equal(main.querySelector('.media-item-type').textContent,'ANIME · SERIES');
assert.equal(row.querySelector('.ss-anilist-details').hidden,true);
assert.equal(actions.children.length,3,'TMDB remove plus AniList details and Mangayomi');
assert.equal(actions.children[2].textContent,'×','existing TMDB removal survives');
actions.children[1].listeners.click();
assert.equal(row.querySelector('.ss-anilist-details').hidden,false,'details control toggles');
console.log('Linked Library card: original TMDB controls, AniList cover, extras PASS');
