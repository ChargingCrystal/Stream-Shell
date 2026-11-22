const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../providers/player/twitch-automation.js'), 'utf8');
function fn(name) {
 const start = source.indexOf(`    function ${name}(`);
 const end = source.indexOf('\n    }', start) + 6;
 return source.slice(start, end);
}
let next = 1;
const timers = new Map();
const context = vm.createContext({
 setInterval(callback, delay) { const id=next++; timers.set(id,{callback,delay}); return id; },
 clearInterval(id) {timers.delete(id);},
 setTimeout(callback, delay) {const id=next++;timers.set(id,{callback,delay});return id;},
 clearTimeout(id) {timers.delete(id);},
 chrome:{storage:{onChanged:{removeListener(){}}}},
});
vm.runInContext(`
let viewerCountTimer = null;
let viewerCount = null, viewerCountChannel = null, viewerCountUpdatedAt = null, viewerCountStartupAttempts = 0;
let ready = false;
const refreshViewerCount = () => ready;
let fallbackTimer = null, raidGuardTimer = null, scanTimer = null;
let automationStarted = true, automationDocumentAlive = true, raidProtectionEnabled = true;
const MARBLES_CONFIG = {fallbackScanMs:30000};
const automationEnabled = () => true, scan = () => {}, preventRaid = () => {};
const observer = {disconnect(){}}, cancelPendingMarblesJoin = () => {}, onSettingsChanged = () => {};
${fn('sampleViewerCount')}
${fn('beginViewerCountAcquisition')}
${fn('syncFallbackTimer')}
${fn('dispose')}
globalThis.probe = {syncFallbackTimer,dispose,beginViewerCountAcquisition,ready:()=>{ready=true;}};`, context);

const probe=context.probe;
probe.beginViewerCountAcquisition();
function tick() {
 const [id,timer]=[...timers.entries()].find(([,t])=>t.delay===5000 || t.delay===300000);
 timers.delete(id);timer.callback();
}
for(let i=0;i<4;i++) {tick();assert.equal([...timers.values()][0].delay,5000);}
probe.ready();tick();
assert.equal([...timers.values()][0].delay,300000,'successful delayed acquisition switches to five minutes');
for(let i=0;i<5;i++) {
 probe.syncFallbackTimer();
 assert.equal([...timers.values()].filter(t=>t.delay===300000).length,1);
 assert.equal(timers.size,3);
}
probe.beginViewerCountAcquisition();
assert.equal([...timers.values()].filter(t=>t.delay===5000).length,1,'channel change restarts acquisition');
probe.dispose();assert.equal(timers.size,0);
console.log('Delayed viewer acquisition, five-minute steady state, channel reset and disposal: PASS');
