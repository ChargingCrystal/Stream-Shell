const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const code = fs.readFileSync(path.join(root, 'background/src/05-mangayomi.js'), 'utf8');

function harness(nativeResponse) {
  const commands = [], calls = [];
  const context = vm.createContext({
    console, Date,
    shuttingDown: false,
    chrome: {
      storage: {local: {get: async () => ({streamShellMangayomiExecutable: 'C:\\Apps\\Mangayomi.exe', streamShellSevenSeasAcknowledged:true})}},
      runtime: {sendNativeMessage: async (name, command) => {
        commands.push(command.action);
        return nativeResponse;
      }}
    },
    MANGAYOMI_PATH_KEY: 'streamShellMangayomiExecutable',
    MANGAYOMI_NATIVE_HOST: 'com.streamshell.mangayomi',
    LEFT: {left:0, top:0, width:1920, height:1080},
    getStreamShellDisplayProfile: async () => ({mode:'wide'}),
    switchProvider: async name => { calls.push(name); }
  });
  vm.runInContext(code, context);
  return {context, commands, calls};
}

(async () => {
  const stock = harness({ok:false, error:'MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: no registered compatible handler'});
  const fallback = await vm.runInContext('streamShellMangayomiDirectSearch("Plastic Memories", "anime")', stock.context);
  assert.equal(fallback.dispatched, false);
  assert.equal(fallback.fallback, true);
  assert.match(fallback.reason, /no registered compatible handler/);
  assert.deepEqual(stock.calls, [], 'lookup must not foreground Mangayomi');
  assert.deepEqual(stock.commands, ['lookup']);

  const patched = harness({ok:true, running:true, visible:true, searchResultsJson: JSON.stringify({ok:true, query:'Plastic Memories', sources:[{sourceId:1,name:'Demo',lang:'en',status:'empty',hits:[]}]})});
  const dispatched = await vm.runInContext('streamShellMangayomiDirectSearch("Plastic Memories", "anime")', patched.context);
  assert.equal(dispatched.dispatched, true);
  assert.equal(dispatched.fallback, false);
  assert.equal(dispatched.searchResults.sources[0].name, "Demo");

  const failed = harness({ok:false, error:'Native helper crashed'});
  await assert.rejects(() => vm.runInContext('streamShellMangayomiDirectSearch("Test", "anime")', failed.context), /Native helper crashed/);
  console.log('Mangayomi stock fallback/experimental dispatch/error isolation: PASS');
})().catch(error => { console.error(error); process.exitCode=1; });
