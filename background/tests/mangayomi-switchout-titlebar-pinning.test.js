/* 0.21.6: Native app pinning and lossless left-side handoff. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const buttons = read('native/titlebar-src/02-Titlebar-Buttons-And-Paint.cs');
const helper = read('integrations/mangayomi/StreamShellMangayomiHost.cs');
const installer = read('native/install-titlebar-helper.ps1');
assert.match(installer, /mangayomi\.png/);
const browser = read('background/src/02-providers.js');

// Previously the JS worker sent mangayomi but TryApplyProviderConfig rejected
// the ENTIRE message. No valid button made it to native chrome.
assert.match(buttons, /\^\(youtube\|netflix\|prime\|disney\|crunchyroll\|mangayomi\|custom-/);
assert.match(buttons, /case "mangayomi": return new ButtonDef\("MY", id, "mangayomi\.png"/);
assert.ok(fs.existsSync(path.join(root, 'native/titlebar-icons/mangayomi.png')));

const posted=[];
const ctx=vm.createContext({ URL, btoa, TextEncoder, console,
  chrome:{storage:{onChanged:{addListener:()=>{}},local:{get: async()=>({streamShellSevenSeasAcknowledged:true})}}},
  shuttingDown:false, titlebarPort:{postMessage:m=>posted.push(m)},
  titlebarProtocolReady:true, TITLEBAR_PROTOCOL_VERSION:9
});
for (const file of ['shared/provider-registry-core.js','background/src/06-titlebar.js'])
  vm.runInContext(read(file),ctx);
vm.runInContext(`const reg = defaultStreamShellProviderRegistry();
reg.providers.find(p=>p.id==='mangayomi').showInTitlebar = true;
globalThis.testRegistry = reg;`,ctx);
(async()=>{
  await vm.runInContext('syncTitlebarProviderRegistry(testRegistry)',ctx);
  await new Promise(setImmediate);
  assert.ok(posted.length>=1);
  const actual=Buffer.from(posted.at(-1).payloadB64,'base64').toString('utf8');
  assert.match(actual,/^mangayomi\tMY\tMangayomi\t/m);
  assert.ok(actual.split('\n').length===6,'one native app + five builtins');
  // Browser provider and Landing switches should hide BEFORE updating leftMode.
  assert.ok(browser.indexOf('await hideMangayomiIfActive();',browser.indexOf('async function _switchProvider('))>=0);
  assert.ok(browser.indexOf('await hideMangayomiIfActive();',browser.indexOf('async function _switchProvider('))
    <browser.indexOf('leftMode: providerName',browser.indexOf('async function _switchProvider(')));
  assert.match(read('background/src/03-landing-window.js'), /await hideMangayomiIfActive\(\)/);

  // Hiding an owned Flutter window must not rely solely on SW_MINIMIZE.
  assert.match(helper, /ShowWindow\(hwnd, SW_HIDE\)/);
  assert.match(helper, /bool hidden = !IsWindowVisible\(hwnd\)/);
  assert.match(helper, /SWP_HIDEWINDOW/);
  // Native messaging host is ephemeral. Hidden Flutter windows need HWND
  // enumeration; Process.MainWindowHandle alone becomes zero after SW_HIDE.
  assert.match(helper, /static IntPtr FindMainWindow\(Process process\)/);
  assert.match(helper, /EnumWindows\(delegate/);
  assert.match(helper, /FindMainWindow\(process\)/);
  console.log('Mangayomi pin payload/native allowlist + icon, owned Flutter hide/reopen contract: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
