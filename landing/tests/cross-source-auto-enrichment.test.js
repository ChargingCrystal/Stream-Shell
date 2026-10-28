/* v0.21.13: saving either source automatically finds the other only on a
 * unique anime/TV or anime-movie/movie identity; no incorrect mutations. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tv={id:111,mediaType:'tv',title:'Solo Leveling',year:'2024',releaseDate:'2024-01-07'};
const anime={anilistId:151807,mediaType:'anime',title:'Solo Leveling',year:2024,format:'TV',episodes:12};
const film={id:222,mediaType:'movie',title:'Anime Film',releaseDate:'2020-03-11'};
const movie={anilistId:2222,mediaType:'anime',title:'Anime Film',year:2020,format:'MOVIE'};
const delay=()=>new Promise(r=>setImmediate(r));
let tmdbSaved=[],animeSaved=[],log=[],allowedToken=true;
let tmdbSearch=async q=> q==='Solo Leveling'?[tv]:q==='Anime Film'?[film]:[];
let animeSearch=async q=> q==='Solo Leveling'?[anime]:q==='Anime Film'?[movie]:[];
const tmdbStore={
    getAll:async()=>tmdbSaved.slice(),
    contains:async m=>tmdbSaved.some(x=>x.id===m.id&&x.mediaType===m.mediaType),
    add:async m=>{if(!tmdbSaved.some(x=>x.id===m.id&&x.mediaType===m.mediaType))tmdbSaved.push(m);log.push('tmdb-add')}
};
const animeStore={
    getAll:async()=>animeSaved.slice(),
    upsertAniList:async m=>{if(!animeSaved.some(x=>x.anilistId===m.anilistId))animeSaved.push({...m,source:'anilist'});log.push('anime-add')}
};
const context=vm.createContext({
    watchlistSort:{value:'added-desc'}, console:{debug(){}},
    window:{StreamShellWatchlist:tmdbStore,StreamShellExternalLibrary:animeStore,
        StreamShellMediaApi:{hasToken:async()=>allowedToken,searchMedia:q=>tmdbSearch(q)},
        StreamShellAniList:{searchAnime:q=>animeSearch(q),details:async item=>item}},
    refreshWatchlistCache:async()=>{},activePanel:'search',mediaPanel:{hidden:true},showWatchlist:async()=>{},
});
vm.runInContext(read('landing/src/library.js'),context);
vm.runInContext(read('landing/src/cross-source.js'),context);
const match=vm.runInContext('streamShellAutoLinkMatches',context);
const unique=vm.runInContext('streamShellAutoLinkUnique',context);
const tmdbEnrich=vm.runInContext('streamShellEnrichTmdbMedia',context);
const animeEnrich=vm.runInContext('streamShellEnrichAniListMedia',context);
assert.equal(match(tv,anime),true);
assert.equal(match(film,movie),true);
assert.equal(match(tv,{...anime,format:'MOVIE'}),false);
assert.equal(match(tv,{...anime,mediaType:'manga'}),false);
assert.equal(match(tv,{...anime,year:2025}),false);
assert.equal(match(tv,{...anime,title:'A Completely Different Show'}),false);
assert.equal(match(tv,{...anime,title:'Future Diary',originalTitle:'Solo Leveling'}),true,'alternative title allowed');
assert.equal(match(tv,{...anime,format:'OVA'}),false,'format must be unambiguous');
assert.equal(unique([anime,{...anime,anilistId:151808}],tv,'anilist'),null,'different IDs remain ambiguous');
assert.equal(unique([anime,anime],tv,'anilist').anilistId,anime.anilistId,'same ID deduped');
assert.equal(unique([tv,{...tv,id:112}],anime,'tmdb'),null,'multiple titles ambiguous');
(async()=>{
    tmdbSaved=[tv];animeSaved=[];log=[];
    await tmdbEnrich(tv);
    assert.equal(animeSaved.length,1,'TMDB save must obtain AniList metadata');
    assert.equal(animeSaved[0].anilistId,151807);
    await tmdbEnrich(tv);
    assert.equal(log.filter(x=>x==='anime-add').length,1,'repeated save not duplicated');

    tmdbSaved=[];animeSaved=[{...anime,source:'anilist'}];log=[];
    await animeEnrich(anime);
    assert.equal(tmdbSaved.length,1,'AniList save must obtain matching TMDB record');
    assert.equal(tmdbSaved[0].id,tv.id);
    await animeEnrich(anime);
    assert.equal(log.filter(x=>x==='tmdb-add').length,1);

    tmdbSaved=[];animeSaved=[{...anime,source:'anilist'}];log=[];
    allowedToken=false;
    await animeEnrich(anime);
    assert.equal(tmdbSaved.length,0,'TMDB credentials absent -> no incorrect save');
    allowedToken=true;

    tmdbSaved=[];animeSaved=[{...anime,source:'anilist'}];log=[];
    tmdbSearch=async()=>[tv,{...tv,id:112}];
    await animeEnrich(anime);
    assert.equal(tmdbSaved.length,0,'ambiguous search cannot add a second title');
    tmdbSearch=async()=>[tv];

    tmdbSaved=[tv];animeSaved=[];log=[];
    animeSearch=async()=>[anime,{...anime,anilistId:3333}];
    await tmdbEnrich(tv);
    assert.equal(animeSaved.length,0,'ambiguous AniList results cannot add an entry');
    animeSearch=async()=>[anime];

    tmdbSaved=[tv];animeSaved=[];log=[];
    animeSearch=async()=>{await delay();tmdbSaved=[];return [anime]};
    await tmdbEnrich(tv);
    assert.equal(animeSaved.length,0,'removed primary record must never be resurrected by late response');
    animeSearch=async()=>[anime];

    // App does not rewrite existing TMDB items, or backfill manga and novels as TV.
    assert.match(read('landing/src/library.js'), /if \(savedNow\) void streamShellEnrichTmdbMedia\(media\)/);
    assert.match(read('landing/src/anilist.js'), /void streamShellEnrichAniListMedia\(enriched\)/);
    assert.match(read('media/anilist-api.js'), /async function searchAnime\(query\)/);
    for(const build of ['landing/build-landing.ps1','dashboard/build-dashboard.ps1'])
        assert.match(read(build),/"cross-source\.js"/);
    console.log('Conservative cross-source auto enrichment: both save paths, ambiguity, removal, token fallback PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
