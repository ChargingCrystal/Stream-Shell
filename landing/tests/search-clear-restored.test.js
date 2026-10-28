const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const p of ['landing/landing.html','dashboard/dashboard.html']) {
 const h=file(p);
 assert.match(h,/id="media-search-input"/);
 assert.match(h,/id="media-search-clear"/);
 assert.match(h,/aria-label="Clear search"/);
 assert.ok(h.indexOf('id="media-search-clear"')>h.indexOf('id="media-search-input"'));
 const group=h.split('id="search-control"')[1].split('id="media-search-clear"')[0];
 assert.doesNotMatch(group,/media-search-tmdb-tab|media-search-fmhy-tab/);
}
const js=file('landing/src/search.js');
assert.match(js,/mediaSearchClear\.hidden\s*=\s*query.length ===\s*0/);
assert.match(js,/async function clearSearch\(\)/);
assert.match(js,/mediaSearchInput.value\s*=\s*""/);
const events=file('landing/src/orchestrator.js');
assert.match(events,/mediaSearchClear\.addEventListener\(\s*"click"/);
assert.match(events,/clearSearch\(\)/);
const css=file('landing/landing.css');
assert.match(css,/:has\(\.media-search-input:not\(:placeholder-shown\)\) \.media-search-clear/);
assert.match(css,/:has\(\.media-search-input:placeholder-shown\) \.media-search-clear/);
console.log('PASS dedicated clear-X in Wide/Compact TMDB+FMHY, value-driven visibility, click clears');
