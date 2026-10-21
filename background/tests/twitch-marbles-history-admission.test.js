/* Stream Shell 0.20.32: replayed Twitch chat must never satisfy a live !play quorum. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'providers/player/twitch-automation.js'), 'utf8');
const tail = '    if (!core.registerAutomation({start, dispose, getDiagnostics, onWorkspaceChanged, onRaidProtectionChanged})) {';
assert.equal(source.split(tail).length, 2);
assert.match(source, /historyBatchThreshold: 4/);
assert.match(source, /initialHydrationGuardMs: 12000/);
assert.match(source, /marblesChatMessageAgeMs\(line, now\)/);
const testing = source.slice(0,source.indexOf(tail)) + `
    globalThis.__marblesProbe = {
        armMarblesHydrationGuard, observeMarblesChat,
        getTwitchRuntimeDiagnostics: () => ({automation:getDiagnostics()}),
        scheduleMarblesAutoJoin, getGuard: () => marblesHydrationGuardUntil
    };
})();`;


let now = 1800000000000;
class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
}
class Element {
    constructor({username='', text='', timestamp=null, chat=true}={}) {
        this.username = username; this.textContent = text; this.timestamp = timestamp;
        this.chat = chat; this.nextElementSibling = null; this.parentElement=null;
    }
    matches(selector) { return this.chat && selector.includes('chat-line-message'); }
    querySelector(selector) {
        if (selector.includes('username')) return this.username ? {textContent:this.username} : null;
        if (selector.includes('chat-timestamp') || selector.includes('time[datetime]')) {
            if (!this.timestamp) return null;
            return {
                getAttribute: key => key === 'datetime' ? this.timestamp : null,
                textContent: this.timestamp
            };
        }
        return null;
    }
    querySelectorAll() { return []; }
}
const timers = [];
const context = vm.createContext({
    Date: FakeDate, Element, Math: Object.assign(Object.create(Math), {random: () => 0}),
    document: {visibilityState:'hidden',hasFocus:()=>false},
    window: {__streamShellTwitchCoreV1: {isAlive:()=>true, getSlotId:()=> 'b', getRaidProtectionEnabled:()=>true}},
    location: {pathname:'/streamer',href:'https://www.twitch.tv/streamer'},
    chrome: {runtime:{onMessage:{addListener() {}}}},
    setTimeout: (cb,delay) => { const entry={cb,delay,cancelled:false};timers.push(entry);return entry; },
    clearTimeout: timer => { timer.cancelled = true; },
    console, WeakSet, WeakMap, Set, Promise, URL, URLSearchParams
});
vm.runInContext(testing,context);
const probe = context.__marblesProbe;
const stats = () => probe.getTwitchRuntimeDiagnostics().automation;
const line = (user, stamp=null) => new Element({username:user,text:'!play',timestamp:stamp});
const deliver = (...lines) => probe.observeMarblesChat([{addedNodes:lines}]);

probe.armMarblesHydrationGuard('https://www.twitch.tv/streamer');
now += 6100;
for(let i=0;i<8;i++) deliver(line('replayed'+i));
assert.equal(stats().observedPlayCount,0,'the old five-second guard must NOT be enough');
assert.equal(timers.length,0);
// Wait past the new initial guard; a genuine incremental live quorum is admitted.
now = probe.getGuard()+1;
for(let i=0;i<4;i++) deliver(line('live'+i));
assert.equal(timers.length,0);
deliver(line('live4'));
assert.equal(timers.length,1,'5 genuine distinct live messages should schedule exactly one join');
assert.equal(stats().uniquePlayUsersInBurst,5);
const originalTimer=timers[0];
// Six hydrated lines arriving in one mutation must cancel a pending false join
// and re-arm quarantine, even if they appear after the initial 12s cutoff.
now += 500;
deliver(...Array.from({length:6},(_,i)=>line('old'+i)));
assert.equal(originalTimer.cancelled,true);
assert.equal(stats().uniquePlayUsersInBurst,0);
assert.equal(stats().historyBatchesDiscarded,1);
assert.equal(stats().historicalLinesDiscarded,6);
now += 5000;
for(let i=0;i<6;i++) deliver(line('quarantine'+i));
assert.equal(timers.length,1,'a late replay extends the history guard');
now=probe.getGuard()+1;
const oldIso = new Date(now - 180000).toISOString();
deliver(line('historical',oldIso));
assert.equal(stats().historicalLinesDiscarded,7,'Twitch ISO timestamp must reject old history');
assert.equal(stats().timestampedLinesChecked,1);
const prepended=line('prepended');
prepended.nextElementSibling=line('already-there');
deliver(prepended);
assert.equal(stats().historicalLinesDiscarded,8,'prepending ahead of mounted rows is not a new chat message');
const freshIso = new Date(now - 1000).toISOString();
for(let i=0;i<5;i++) deliver(line('new'+i,freshIso));
assert.equal(timers.length,2,'live timestamped incremental !play quorum still schedules');
assert.ok(stats().lastFreshChatPlayAt > 0);
// The same DOM element cannot be counted twice.
const repeated=line('repeat');
deliver(repeated);deliver(repeated);
assert.equal(stats().observedPlayCount,11,'same row should be counted once');
// Navigating resets all chat burst state and cancels pending timers.
const lastTimer=timers.at(-1);
probe.armMarblesHydrationGuard('https://www.twitch.tv/other');
assert.equal(lastTimer.cancelled,true);
assert.equal(stats().uniquePlayUsersInBurst,0);
assert.equal(stats().observedChannel,'https://www.twitch.tv/other');
assert.equal(stats().historyBatchesDiscarded,1);
console.log('Twitch Marbles history quarantine, timestamps, batch, tail, fresh quorum, navigation: PASS');
