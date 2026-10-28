// A clickable, truthful search handoff. Stock Mangayomi has no source-result API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const source = read('landing/src/mangayomi-search-handoff.js');
const events = [];
const sandbox = {
    navigator: { clipboard: { writeText: async text => { events.push(['copy',text]); } } },
    chrome: { runtime: { sendMessage: async message => { events.push(['open',message.type]);return message.type === 'landing-mangayomi-direct-search' ? {ok:true,dispatched:true,searchResults:{ok:true,sources:[]}} : {ok:true}; } } },
    window: { prompt: () => { throw Error('unwanted prompt'); }, alert: () => { events.push(['fallback-alert']); } },
    document: {},
    createElement: (_tag,_class) => ({ addEventListener() {}, setAttribute() {}, title:'', disabled:false })
};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
// The landing render surface is tested separately; observe the handoff here.
sandbox.streamShellRenderMangayomiSourceResults = data => { events.push(['render',data.sources.length]); };
assert.equal(vm.runInContext('streamShellMangayomiSearchTitle(" Solo   Leveling ", "anime")',sandbox), 'Solo Leveling');
assert.equal(vm.runInContext('streamShellMangayomiSearchTitle("Bad", "tv")',sandbox), '');
assert.equal(vm.runInContext('streamShellMangayomiSearchTitle("Hey\\nworld", "novel")',sandbox), 'Hey world');
(async () => {
    // Primary action: background source lookup, never show the native app.
    const lookup = await vm.runInContext('streamShellHandoffMangayomiSearch("Mirai Nikki", "anime")',sandbox);
    assert.equal(lookup.ok,true);
    assert.equal(lookup.dispatched,true);
    assert.equal(lookup.switched,false);
    assert.equal(lookup.copied,false);
    assert.deepEqual(events,[['open','landing-mangayomi-direct-search'], ['render',0]]);
    assert.equal(await vm.runInContext('streamShellHandoffMangayomiSearch("Movie", "tv")',sandbox).then(v=>v.ok), false);
    assert.equal(events.length,2);

    // Shift+LMB: copy the title first, then switch without a source lookup.
    const switchResult = await vm.runInContext('streamShellHandoffMangayomiSearch("Mirai Nikki", "anime", true)',sandbox);
    assert.equal(switchResult.switched,true);
    assert.equal(switchResult.dispatched,false);
    assert.equal(switchResult.copied,true);
    assert.deepEqual(events.slice(2), [['copy','Mirai Nikki'], ['open','landing-show-mangayomi']]);

    sandbox.chrome.runtime.sendMessage = async message => { events.push(['open', message.type]); return {ok:true, dispatched:false, fallback:true}; };
    const fallback = await vm.runInContext('streamShellHandoffMangayomiSearch("Mirai Nikki", "anime")',sandbox);
    assert.equal(fallback.ok, true);
    assert.equal(fallback.copied, false);
    assert.equal(fallback.dispatched, false);
    assert.equal(fallback.fallback, true);
    assert.deepEqual(events.slice(4), [['open','landing-mangayomi-direct-search'], ['fallback-alert']]);
    assert.deepEqual(events.filter(item => item[0] === 'copy'), [['copy','Mirai Nikki']],
        'only Shift+click copies; the normal click does not touch the clipboard');
    // A denied clipboard write must never prevent the direct provider switch.
    // Simulate a native page where the legacy selection fallback is unavailable.
    sandbox.navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
    sandbox.document.createElement = () => ({value:'',style:{},setAttribute(){},focus(){},select(){},remove(){}});
    sandbox.document.body = {appendChild(){}};
    sandbox.document.execCommand = () => false;
    const beforeDenied = events.length;
    const denied = await vm.runInContext('streamShellHandoffMangayomiSearch("Another", "anime", true)',sandbox);
    assert.equal(denied.copied,false);
    assert.equal(denied.switched,true);
    assert.deepEqual(events.slice(beforeDenied), [['open','landing-show-mangayomi']]);
    assert.match(source, /streamShellHandoffMangayomiSearch\(query, mediaType, !!event\.shiftKey\)/);
    assert.match(source, /Shift\+click: copy title and switch to Mangayomi/);

    const landing = read('landing/src/library.js');
    const anilist = read('landing/src/anilist.js');
    assert.match(landing,/streamShellMangayomiSearchButton\(media\.title, media\.mediaType\)/);
    assert.match(landing,/streamShellMangayomiSearchButton\(anilist\.title, "anime"\)/);
    assert.match(anilist,/streamShellMangayomiSearchButton\(media\.title, media\.mediaType\)/);
    for (const build of ['landing/build-landing.ps1','dashboard/build-dashboard.ps1']) {
        assert.match(read(build),/"mangayomi-search-handoff\.js"/);
    }
    console.log('Mangayomi normal-click lookup and Shift-click native switch: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
