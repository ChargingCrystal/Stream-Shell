/* Seven Seas is a real native-command gate, not a hidden UI toggle. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'background/src/05-mangayomi.js'),'utf8');
const registry = fs.readFileSync(path.join(root, 'shared/provider-registry-core.js'),'utf8');
(async () => {
  let enabled = false;
  const sent = [];
  const ctx = vm.createContext({console, Date, URL, shuttingDown:false,
    chrome:{storage:{local:{get:async key => key === 'streamShellSevenSeasAcknowledged'
      ? {streamShellSevenSeasAcknowledged:enabled}
      : key === 'streamShellProviderRegistry'
        ? {streamShellProviderRegistry:null} : {streamShellMangayomiExecutable:'C:\\Mangayomi.exe'}}},
      runtime:{sendNativeMessage:async (_,arg)=>{sent.push(arg.action);return {ok:true};}}},
    MANGAYOMI_NATIVE_HOST:'com.streamshell.mangayomi',
    MANGAYOMI_PATH_KEY:'streamShellMangayomiExecutable',
    STREAM_SHELL_PROVIDER_REGISTRY_KEY:'streamShellProviderRegistry',
    LEFT:{left:0,top:0,width:1920,height:1080},
    getStreamShellDisplayProfile:async()=>({mode:'compact'})
  });
  vm.runInContext(registry,ctx);
  vm.runInContext(source,ctx);
  await assert.rejects(vm.runInContext('mangayomiNativeCommand("show")',ctx), /Seven Seas/);
  await assert.rejects(vm.runInContext('mangayomiNativeCommand("lookup",{query:"Title",itemType:"anime"})',ctx), /Seven Seas/);
  await assert.rejects(vm.runInContext('mangayomiNativeCommand("open-result",{resultId:"abcdefghijabcdefghijabcd"})',ctx), /Seven Seas/);
  assert.deepEqual(sent, [], 'disabled integration never calls the native messaging host');
  await vm.runInContext('mangayomiNativeCommand("hide")',ctx);
  assert.deepEqual(sent,['hide'],'cleanup remains permitted');
  enabled = true;
  await vm.runInContext('mangayomiNativeCommand("show")',ctx);
  assert.deepEqual(sent,['hide','show'],'native actions resume after acknowledgement');
  console.log('Seven Seas: native transport denied, cleanup permitted, opt-in works: PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
