/* v0.20.15: a covered Dashboard must not run presentation-only clocks,
 * progress polling or anarchy animations, but must repaint on reveal. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const srcRoot = path.join(__dirname, '../src');
const read = file => fs.readFileSync(path.join(srcRoot, file), 'utf8');
function harness(initialVisibility = 'visible') {
  let nextId = 0;
  const timers = new Map();
  const listeners = new Map();
  const document = {
    visibilityState: initialVisibility,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    }
  };
  const ctx = vm.createContext({
    console, Date, Intl, document,
    setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, {fn, delay, kind:'timeout'}); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => { const id = ++nextId; timers.set(id, {fn, delay, kind:'interval'}); return id; },
    clearInterval: id => timers.delete(id),
  });
  return {ctx,document,timers,emit: name => (listeners.get(name)||[]).forEach(fn=>fn())};
}
{
  const h=harness('visible');
  h.ctx.clock={textContent:''};h.ctx.date={textContent:''};
  vm.runInContext(read('clock.js'), h.ctx);
  assert.equal(h.timers.size,1,'clock starts while visible');
  assert.ok(h.ctx.clock.textContent);
  h.document.visibilityState='hidden';h.emit('visibilitychange');
  assert.equal(h.timers.size,0,'clock has no wakeup timer while hidden');
  h.document.visibilityState='visible';h.emit('visibilitychange');
  assert.equal(h.timers.size,1,'clock restarts on reveal');
}
{
  const h=harness('visible');
  let calls=0;
  h.ctx.refreshNowPlayingProgress=()=>{calls++};
  const src=read('now-playing-render.js');
  const tail=src.slice(src.indexOf('let nowPlayingProgressTimer = null;'));
  vm.runInContext(tail,h.ctx);
  assert.equal(h.timers.size,1);
  h.document.visibilityState='hidden';h.emit('visibilitychange');
  assert.equal(h.timers.size,0,'hidden progress must not even poll its visibility');
  h.document.visibilityState='visible';h.emit('visibilitychange');
  const [id,timer]=[...h.timers][0];assert.equal(timer.delay,0,'reveal refresh is immediate');
  h.timers.delete(id);timer.fn();
  assert.equal(calls,1);
  assert.equal(h.timers.size,1,'regular visible progress refresh resumes');
}
{
  const h=harness('visible');
  const cls={toggle() {}};
  h.ctx.settingsCenter={hidden:false,style:{setProperty() {}}};
  h.ctx.settingsContent={classList:cls};
  h.ctx.settingsSection='anarchy';
  const src=read('settings-config.js');
  const head=src.indexOf('function hexToRgbTriplet(');
  const end=src.indexOf('document.addEventListener("visibilitychange", syncAnarchySettingsVisuals);',head);
  assert.ok(head>-1 && end>head);
  const chunk=src.slice(head,end+'document.addEventListener("visibilitychange", syncAnarchySettingsVisuals);'.length);
  h.ctx.anarchySettingsColorTimer=null;
  h.ctx.nextAnarchyColor=()=> '#abcdef';
  vm.runInContext(chunk,h.ctx);
  vm.runInContext('syncAnarchySettingsVisuals()',h.ctx);
  assert.equal(h.timers.size,1,'anarchy animation runs only in visible settings');
  h.document.visibilityState='hidden';h.emit('visibilitychange');
  assert.equal(h.timers.size,0,'animation sleeps behind WuWa');
  h.document.visibilityState='visible';h.emit('visibilitychange');
  assert.equal(h.timers.size,1,'animation resumes when visible');
  h.ctx.settingsCenter.hidden=true;vm.runInContext('syncAnarchySettingsVisuals()',h.ctx);
  assert.equal(h.timers.size,0,'closed settings do not animate');
}
console.log('Dashboard hidden idle budget, reveal recovery and anarchy animation: PASS');
