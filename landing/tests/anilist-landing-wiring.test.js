const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const file of ['landing/landing.html','dashboard/dashboard.html']) {
const t=read(file);
assert.equal((t.match(/id="media-search-anilist-tab"/g)||[]).length,0, "merged media search has no separate AniList tab");
assert.match(t,/id="media-search-source" value="tmdb"/);
assert.match(t,/id="media-search-clear"/);
}
assert.equal((read('landing/landing.html').match(/src="\.\.\/media\/anilist-api\.js"/g)||[]).length,1, 'API loaded once');
assert.match(read('dashboard/src/compact-home-prefix.js'), /"media\/anilist-api\.js"/);
assert.match(read('manifest.json'), /https:\/\/graphql\.anilist\.co\/\*/);
assert.match(read('landing/src/search.js'), /streamShellRenderUnifiedResults\(query, generation/);
assert.match(read('landing/src/library.js'), /streamShellSortedLibrary\(tmdbItems,nativeItems\)/);
assert.match(read('landing/src/anilist.js'), /upsertAniList/, 'AniList result save persists via external library');
console.log('AniList Landing: search tab, compact script, permission, library: PASS');
