/* v0.20.15: trusted pointer activity is rate-limited without delaying
 * synchronous Marbles chat parsing (hidden Chrome timers are throttled). */
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../../providers/player/twitch-utility.js'),'utf8');
const deferred=fs.readFileSync(path.resolve(__dirname,'../../providers/player/twitch-automation.js'),'utf8');
assert.match(deferred,/const inspected = new Set\(\)/);
assert.match(deferred,/for \(const line of lines\) recordMarblesPlay\(line\);/);
assert.doesNotMatch(src,/function observeMarblesChat/, 'Marbles DOM scan must not parse at document_start');
const start=src.indexOf('        let lastInteractionNoticeAt = 0;');
const end=src.indexOf('        document.addEventListener("click", event => {',start);
assert.ok(start>0&&end>start);
let now=10000;let handler=null;let sends=0;
const ctx=vm.createContext({
  Date:{now:()=>now},
  document:{addEventListener(type,cb){if(type==='pointerdown')handler=cb;}},
  chrome:{runtime:{sendMessage:()=>{sends++;return Promise.resolve();}}}
});
vm.runInContext(src.slice(start,end),ctx);
handler({isTrusted:false}); assert.equal(sends,0);
handler({isTrusted:true}); assert.equal(sends,1);
now+=100;handler({isTrusted:true});assert.equal(sends,1);
now+=899;handler({isTrusted:true});assert.equal(sends,1);
now+=1;handler({isTrusted:true});assert.equal(sends,2);
now+=1500;handler({isTrusted:true});assert.equal(sends,3);
console.log('Twitch user-interaction IPC budget and synchronous Marbles observer: PASS');
