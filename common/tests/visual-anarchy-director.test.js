const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/visual-anarchy.js'), 'utf8');

function fixture(effect, options = {}) {
  let seq = 0;
  const timers = new Map();
  const values = new Map([
    ['filter', ['brightness(1.2)', '']],
    ['transform', ['translateX(1px)', 'important']],
    ['scale', ['.95', 'important']],
    ['rotate', ['5deg', '']]
  ]);
  const style = {
    getPropertyValue(k) { return values.get(k)?.[0] || ''; },
    getPropertyPriority(k) { return values.get(k)?.[1] || ''; },
    setProperty(k, v, priority = '') { values.set(k, [String(v), priority]); },
    removeProperty(k) { values.delete(k); }
  };
  const video = { style, paused: false, isConnected: true, getBoundingClientRect: () => ({ left: 12, top: 20, width: 800, height: 450 }) };
  const root = { children: [], appendChild(child) { this.children.push(child); child.parent = this; } };
  const fullscreenHost = { children: [], appendChild(child) { this.children.push(child); child.parent = this; } };
  const document = {
    hidden: false,
    fullscreenElement: options.fullscreen === 'video' ? video : options.fullscreen === 'container' ? fullscreenHost : null,
    createElement: () => ({style: {}, id: '', setAttribute() {}, remove() { this.removed = true; }}),
    documentElement: root
  };
  const settings = {
    streamShellVisualAnarchy: true,
    streamShellVisualFrequency: 'absolute',
    streamShellVisualIntensity: 75,
    streamShellVisualZoom: false,
    streamShellVisualDeepFry: false,
    streamShellVisualVhs: false,
    streamShellVisualColor: false,
    streamShellVisualGravity: false,
    streamShellVisualAspect: false,
    streamShellVisualBoss: false,
    [`streamShellVisual${{zoom:'Zoom',deepfry:'DeepFry',vhs:'Vhs',color:'Color',gravity:'Gravity',aspect:'Aspect'}[effect]}`]: true
  };
  const mockMath = Object.create(Math);
  mockMath.random = () => 0.1;
  const ctx = vm.createContext({
    document, visualAnarchyTimer: null, visualAnarchyActive: null, visualAnarchyProvider: null,
    playbackUtilitySettings: settings,
    isProviderSafeModeEnabled: () => false,
    getProviderResourceGovernorState: () => ({visible: true,leftMode: 'youtube',minimized: false,playing: true}),
    getPrimaryVideo: () => video,
    randomBetween: (a,b) => (a+b)/2,
    setTimeout(fn, delay) { const id = ++seq; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    Math: mockMath, Number, Object, String, console
  });
  vm.runInContext(source, ctx);
  return { ctx, settings, document, video, values, style, timers, root, fullscreenHost };
}
function run(f, code) { return vm.runInContext(code, f.ctx); }
function value(f, name) { return f.style.getPropertyValue(name); }
function effectStart(f) {
  run(f, 'syncVisualAnarchy("youtube")');
  assert.equal(f.timers.size, 1, 'single Director scheduling timer');
  const first = [...f.timers.entries()][0];
  f.timers.delete(first[0]); first[1].fn();
  assert.equal(f.timers.size, 1, 'single expiry timer during an effect');
  return f.ctx.visualAnarchyActive;
}

for (const effect of ['zoom','deepfry','vhs','color','gravity','aspect']) {
  const f = fixture(effect);
  const active = effectStart(f);
  assert.deepEqual([...active.chosen], [effect], `selected ${effect}`);
  assert.equal(value(f, 'transform'), 'translateX(1px)', `${effect} does not overwrite player transform`);
  switch (effect) {
    case 'zoom': {
      const scales = value(f, 'scale').split(' ').map(Number);
      assert.equal(scales.length, 2);
      assert.ok(scales.every(s => s > 1.1), `zoom must be visible: ${scales}`);
      assert.match(value(f, 'transform-origin'), /% .*%/);
      break;
    }
    case 'deepfry': assert.match(value(f, 'filter'), /contrast\(.*saturate/); break;
    case 'vhs':
      assert.match(value(f, 'translate'), /px .*px/);
      assert.match(value(f, 'filter'), /sepia/);
      assert.equal(f.root.children.length, 1, 'scanlines overlay mounted');
      assert.ok(Number(f.root.children[0].style.opacity) >= .4, 'scanline overlay sufficiently visible');
      break;
    case 'color': assert.match(value(f, 'filter'), /(hue-rotate|invert|sepia|grayscale)/); break;
    case 'gravity': assert.ok(Math.abs(parseFloat(value(f, 'rotate'))) >= 10, 'tilt must be visible'); break;
    case 'aspect': {
      const scales = value(f, 'scale').split(' ').map(Number);
      assert.ok(scales.some(s => Math.abs(s - 1) >= .2), 'aspect distortion must be visible');
      break;
    }
  }
  // Disabling while active stops all events and restores *exact* inline styles.
  f.settings.streamShellVisualAnarchy = false;
  run(f, 'syncVisualAnarchy("youtube")');
  assert.equal(f.timers.size, 0);
  assert.equal(value(f, 'filter'), 'brightness(1.2)');
  assert.equal(value(f, 'transform'), 'translateX(1px)');
  assert.equal(f.style.getPropertyPriority('transform'), 'important');
  assert.equal(value(f, 'scale'), '.95');
  assert.equal(f.style.getPropertyPriority('scale'), 'important');
  assert.equal(value(f, 'rotate'), '5deg');
  assert.equal(value(f, 'translate'), '');
  assert.equal(value(f, 'transition'), '');
  if (effect === 'vhs') assert.equal(f.root.children[0].removed, true);
}

// Fullscreen overlays must be mounted inside the top-layer fullscreen host.
const fullscreen = fixture('vhs', { fullscreen: 'container' });
effectStart(fullscreen);
assert.equal(fullscreen.root.children.length, 0);
assert.equal(fullscreen.fullscreenHost.children.length, 1);
run(fullscreen, 'stopVisualAnarchy()');
assert.equal(fullscreen.fullscreenHost.children[0].removed, true);

// Native fullscreen <video> cannot contain a child overlay, but the video-level
// VHS treatment must still be visible and have no orphan DOM nodes.
const nativeFullscreen = fixture('vhs', { fullscreen: 'video' });
effectStart(nativeFullscreen);
assert.equal(nativeFullscreen.root.children.length, 0);
assert.match(value(nativeFullscreen, 'filter'), /contrast\(/);
assert.match(value(nativeFullscreen, 'translate'), /px/);

// Boss fights need 2-3 actual enabled effects (not six independent timers).
const boss = fixture('zoom');
boss.settings.streamShellVisualDeepFry = true;
boss.settings.streamShellVisualGravity = true;
boss.settings.streamShellVisualBoss = true;
const combination = effectStart(boss);
assert.equal(combination.boss, true);
assert.ok(combination.chosen.length >= 2);
assert.equal(new Set(combination.chosen).size, combination.chosen.length);
assert.equal(boss.timers.size, 1);
assert.notEqual(value(boss, 'scale'), '.95');
assert.match(value(boss, 'filter'), /contrast/);
run(boss, 'stopVisualAnarchy()');
assert.equal(boss.timers.size, 0);

// Renderers should remain paused after the provider becomes hidden.
const hidden = fixture('zoom');
run(hidden, 'syncVisualAnarchy("youtube")');
hidden.document.hidden = true;
run(hidden, 'syncVisualAnarchy("youtube")');
assert.equal(hidden.timers.size, 0);

console.log('Visual Anarchy Director: 6 visible effects, fullscreen VHS, Boss Fight, exact reset and one timer: PASS');
