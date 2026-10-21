const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/11-playback-state-events.js'), 'utf8');
const from = source.indexOf('async function broadcastTwitchWorkspaceV2LaunchState(');
const to = source.indexOf('chrome.tabs.onUpdated.addListener(', from);
assert.ok(from > 0 && to > from);
const sent = [];
const ctx = vm.createContext({
    shuttingDown: false, Date, Promise, console,
    chrome: {
        storage: { local: {get: async () => ({activeProvider:'youtube',leftMode:'youtube',rightMode:'twitch',twitchTarget:'resume'})} },
        runtime: { sendMessage: msg => { sent.push(msg); return new Promise(() => {}); } },
        windows: { getAll: () => {throw new Error('chrome.windows must not be called');} }
    },
    twitchWorkspaceV2SummaryFromRecord: rec => ({active:true,selectedSlot:rec.selectedSlot}),
    recordFlightEvent: async () => {}
});
vm.runInContext(source.slice(from,to),ctx);
(async()=>{
    await Promise.race([
        vm.runInContext('broadcastTwitchWorkspaceV2LaunchState({selectedSlot:"b"})',ctx),
        new Promise((_,rej)=>setTimeout(()=>rej(Error('still awaiting renderer broadcast')),200))
    ]);
    assert.equal(sent.length,1);
    assert.equal(sent[0].rightMode,'twitch');
    assert.equal(sent[0].twitchWorkspace.selectedSlot,'b');
    assert.equal(sent[0].landingExposed,false);
    console.log('nonblocking Twitch UI broadcast: PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
