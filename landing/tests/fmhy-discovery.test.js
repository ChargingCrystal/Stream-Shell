const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname,'../src/fmhy.js'), 'utf8');
const ctx=vm.createContext({URL, console, Date, setTimeout, clearTimeout});
vm.runInContext(source,ctx);
const markdown=`# Video
## Movies and Anime
- [Good Source](https://example.org/movies) • [Bad](javascript:alert(1))
- [Manga World](https://example.org/manga)
- [Credentials](https://user:password@example.org/unsafe)
## Music
* 🌟 **[Stream One](https://stream.example.com/)** - Movies / TV / Anime / 4K
* ⭐ **[Reading Library](https://books.example.com/)** - Novels / Manga
- [Music Library](https://music.example.com/)
# No Links
plain [Junk](https://x.example.com)`;
const results=vm.runInContext('streamShellParseFmhyMarkdown(markdown,"video")',vm.createContext({...ctx,markdown}));
assert.equal(results.length,5,'FMHY list bullets and safe primary HTTPS links');
assert.equal(results[0].section,'Movies and Anime');
const matches=vm.runInContext('streamShellSearchFmhyIndex(items,"manga")',vm.createContext({...ctx,items:results}));
assert.equal(matches.length,2, 'matches resource titles and descriptive FMHY text');
assert.ok(matches.some(item => item.title === 'Manga World'));
assert.ok(matches.some(item => item.title === 'Reading Library'));
assert.match(source,/Live FMHY directory/);
assert.match(source,/offline excerpt/i);
assert.ok(vm.runInContext('streamShellSearchFmhyIndex(STREAM_SHELL_FMHY_FALLBACK, "music").length > 0', ctx));
assert.ok(vm.runInContext('streamShellSearchFmhyIndex(STREAM_SHELL_FMHY_FALLBACK, "manga").length > 0', ctx));
assert.doesNotMatch(source,/innerHTML\s*=/,'remote data never assigned as HTML');
console.log('FMHY Markdown safe parser, category matching and display: PASS');

// When Opera cannot fetch GitHub raw Markdown, searches still have a
// clearly labeled, source-grounded fallback; no token/API key is needed.
(async () => {
    class FakeAbortController { constructor() { this.signal = {}; } abort() {} }
    const offline = vm.createContext({URL, console, Date, setTimeout, clearTimeout,
        AbortController: FakeAbortController,
        fetch: async () => { throw Error('network blocked'); }});
    vm.runInContext(source, offline);
    const offlineResults = await vm.runInContext('streamShellFetchFmhyResources()', offline);
    assert.ok(offlineResults.length >= 12);
    assert.ok(offlineResults.some(item => item.description.includes('Manga')));
    assert.equal(vm.runInContext('fmhyUsingFallback', offline), true);
    const online = vm.createContext({URL, console, Date, setTimeout, clearTimeout,
        AbortController: FakeAbortController,
        fetch: async () => ({ok: true, text: async () => '* ⭐ **[FictionHub](https://fiction.example/)** - Novels / Manga'})});
    vm.runInContext(source, online);
    const onlineResults = await vm.runInContext('streamShellFetchFmhyResources()', online);
    assert.equal(onlineResults.length, 1); // same URL is deduplicated across docs
    assert.equal(onlineResults[0].title, 'FictionHub');
    assert.equal(vm.runInContext('fmhyUsingFallback', online), false);
    console.log('FMHY live-fetch deduplication / offline fallback: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
