/* v0.20.12: cold renderer handoff must show real DOM placeholders but never
 * perform a browser probe or get stuck when the transition completes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../src/shell-state.js'), 'utf8');
const start = src.indexOf('/* Twitch cold-launch placeholder.');
const end = src.indexOf('chrome.runtime.sendMessage({\n    type:', start);
assert.ok(start >= 0 && end > start);
let listener = null; const elements = new Map(); const timers = new Map(); let nextTimer = 0;
const stageNode = {textContent:''};
const surface = () => ({hidden:true,id:null,innerHTML:'',setAttribute(){},querySelector(query){return query === '.ss-ts-stage' ? stageNode : null;}});
const dashboard = {appendChild(node){elements.set(node.id,node);}};
const ctx = vm.createContext({
    Number,console,clearTimeout:id=>timers.delete(id),
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,fn);return id;},
    chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},
    document:{getElementById:id=>elements.get(id)||null,createElement:()=>surface(),querySelector:q=>q === '.dashboard'?dashboard:null}
});
vm.runInContext(src.slice(start,end),ctx);
assert.equal(typeof listener,'function');
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'waiting',id:8});
let overlay=elements.get('stream-shell-twitch-skeleton');
assert.ok(overlay);
assert.equal(overlay.hidden,true);
assert.ok(overlay.innerHTML.includes('ss-ts-card'));
for(const letter of ['a','b','c','d']) {
    assert.ok(overlay.innerHTML.includes(`data-slot="${letter}"`), `missing native pane placeholder ${letter}`);
}
assert.equal((overlay.innerHTML.match(/class="ss-ts-head"/g)||[]).length,4,
  'each of the four placeholders needs its own heading so native overlays cannot split a global header');
const css=fs.readFileSync(path.join(__dirname,'../dashboard.css'),'utf8');
assert.match(css,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/\.ss-ts-card:nth-child\(-n\+2\)\{padding-bottom:64px;\}/);
assert.doesNotMatch(css,/\.stream-shell-twitch-skeleton\s*\{[^}]*padding:\s*30px/);

for(const fn of timers.values())fn();timers.clear();
assert.equal(overlay.hidden,false);
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'creating',id:8});
assert.match(stageNode.textContent,/Starting Twitch A–D/);
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'done',id:7});
assert.equal(overlay.hidden,false,'late completion from old transition must not hide the current skeleton');
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'done',id:8});
assert.equal(overlay.hidden,true);
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'waiting',id:9});
listener({type:'stream-shell-transition-visual',surface:'twitch',stage:'failed',id:9});
assert.equal(overlay.hidden,true);
console.log('Twitch skeleton transitions and stale completion protection: PASS');
