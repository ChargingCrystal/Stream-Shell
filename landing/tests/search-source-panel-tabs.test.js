const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
for(const htmlFile of ['landing/landing.html','dashboard/dashboard.html']){
  const html=fs.readFileSync(path.join(root,htmlFile),'utf8');
  assert.match(html,/<input type="hidden" id="media-search-source" value="tmdb">/);
  assert.match(html,/id="media-search-tmdb-tab"/);assert.match(html,/id="media-search-fmhy-tab"/);
  const search=html.match(/id="search-control"[\s\S]*?id="media-search-clear"/)[0];
  assert.doesNotMatch(search,/media-search-tmdb-tab|media-search-fmhy-tab/,'search clear unobstructed');
  const tabs=html.match(/id="search-header-title"[\s\S]*?id="media-panel-subtitle"/)[0];
  assert.match(tabs,/id="media-search-tmdb-tab"[\s\S]*id="media-search-fmhy-tab"/);
  assert.doesNotMatch(tabs,/id="media-search-anilist-tab"/);
  assert.match(tabs,/TMDB \+ AniList/);
  assert.match(tabs,/ss-search-source-tabs/,'use library tab style within panel');
}
const js=fs.readFileSync(path.join(root,'landing/src/search.js'),'utf8');
assert.match(js,/function setMediaSearchSource\(source\)/);
assert.match(js,/tab\.setAttribute\("aria-selected", String\(selected\)\)/);
assert.doesNotMatch(js,/searchHeaderTitle\.textContent\s*=/,'search tabs must never be overwritten');
for(const f of ['landing/src/fmhy.js','landing/src/token.js'])
  assert.doesNotMatch(fs.readFileSync(path.join(root,f),'utf8'),/searchHeaderTitle\.textContent\s*=/);
console.log('Wide/Compact source tabs, unobstructed clear, header persistence: PASS');
