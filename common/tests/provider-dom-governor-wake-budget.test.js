/** v0.20.28: focus-only governor churn must not repeatedly reconcile Netflix/Prime DOM. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');

async function netflixWakeBudget() {
    const calls = { observing: 0, disconnect: 0, runs: 0, scheduled: 0 };
    let governor;
    let settingsChanged;
    let domAllowed = true;
    let safeMode = false;
    const tasks = [];
    const ctx = vm.createContext({
        console, Promise,
        getCurrentProvider: () => 'netflix',
        startProviderFeatureOnce: (_name, start) => Promise.resolve(start()),
        getProviderAdapter: () => ({ extensions: { automation: { run: () => { calls.runs++; return true; } } } }),
        isProviderSafeModeEnabled: () => safeMode,
        shouldProviderResourceObserveDom: () => domAllowed,
        MutationObserver: class {
            observe() { calls.observing++; }
            disconnect() { calls.disconnect++; }
        },
        document: { documentElement: {} },
        setTimeout(fn) { calls.scheduled++; tasks.push(fn); return tasks.length; },
        clearTimeout() {},
        chrome: { storage: {
            local: { get: async () => ({}) },
            onChanged: { addListener(fn) { settingsChanged = fn; } }
        } },
        createProviderResourceLoop: () => ({ stop() {} }),
        onProviderResourceGovernorChange(fn) { governor = fn; },
        providerApiNotifyExtensionChange() {}
    });
    vm.runInContext(source('netflix-enhancements.js'), ctx);
    await vm.runInContext('startNetflixEnhancements()', ctx);
    assert.equal(calls.observing, 1, 'Netflix initial observer attaches once');
    const front = { domObserversAllowed: true, focused: false, mode: 'foreground-paused' };
    governor({ ...front, focused: true }, front);
    governor({ ...front, mode: 'foreground-playing' }, front);
    assert.equal(calls.observing, 1, 'Netflix focus/play changes must not reattach DOM observer');
    assert.equal(calls.scheduled, 0, 'Netflix focus/play changes must not schedule an extra DOM pass');
    domAllowed = false;
    const sleep = { domObserversAllowed: false, focused: false, mode: 'sleeping' };
    governor(sleep, front);
    assert.equal(calls.disconnect, 1, 'Netflix asleep state disconnects observer');
    assert.equal(calls.scheduled, 0, 'Netflix hidden state must not schedule a new DOM pass');
    governor({ ...sleep, focused: true }, sleep);
    assert.equal(calls.disconnect, 1, 'Netflix focus change while asleep does not repeat teardown');
    domAllowed = true;
    governor(front, sleep);
    assert.equal(calls.observing, 2, 'Netflix visible state reattaches observer');
    assert.equal(calls.scheduled, 1, 'Netflix visible state schedules one recovery pass');
    settingsChanged({ streamShellNetflixAutoSkipIntro: { newValue: true } }, 'local');
    assert.equal(calls.scheduled, 1, 'Netflix setting changes coalesce pending DOM work');
    assert.equal(calls.observing, 2, 'Netflix settings change does not duplicate observer');
    safeMode = true;
    vm.runInContext('syncNetflixEnhancementObserver()', ctx);
    assert.equal(calls.disconnect, 2, 'Netflix Safe Mode still disconnects DOM observer');
}

async function primeWakeBudget() {
    const calls = { presentation: 0, skip: 0, anarchy: 0 };
    let governor;
    let settingsChanged;
    const ctx = vm.createContext({
        console, Promise,
        getCurrentProvider: () => 'prime',
        startProviderFeatureOnce: (_name, start) => Promise.resolve(start()),
        getProviderAdapter: () => ({ adapterKind: 'prime', extensions: {
            presentation: { sync() { calls.presentation++; } },
            autoSkip: { syncObserver() { calls.skip++; } },
            subtitles: { setColor() {}, getState() { return {}; } }
        } }),
        shouldProviderResourceRunVisualWork: () => false,
        isProviderSafeModeEnabled: () => false,
        chrome: { storage: {
            local: { get: async () => ({}) },
            onChanged: { addListener(fn) { settingsChanged = fn; } }
        } },
        onProviderResourceGovernorChange(fn) { governor = fn; },
        performance: { now: () => 0 },
        setInterval: () => 1, clearInterval() {}
    });
    vm.runInContext(source('prime-enhancements.js'), ctx);
    const originalAnarchy = ctx.syncPrimeSubtitleAnarchy;
    ctx.syncPrimeSubtitleAnarchy = function (...args) {
        calls.anarchy++;
        return originalAnarchy(...args);
    };
    await vm.runInContext('startPrimeEnhancements()', ctx);
    assert.deepEqual(calls, { presentation: 1, skip: 1, anarchy: 1 }, 'Prime initial sync');
    const front = { domObserversAllowed: true, visualWorkAllowed: true, focused: false, mode: 'foreground-paused' };
    governor({ ...front, focused: true }, front);
    governor({ ...front, mode: 'foreground-playing' }, front);
    assert.deepEqual(calls, { presentation: 1, skip: 1, anarchy: 1 }, 'Prime focus/play churn has zero DOM/marker work');
    const backgroundPlaying = { ...front, domObserversAllowed: true, visualWorkAllowed: false, mode: 'background-playing' };
    governor(backgroundPlaying, front);
    assert.deepEqual(calls, { presentation: 1, skip: 1, anarchy: 2 }, 'Prime background-play only updates visual budget');
    const sleep = { ...backgroundPlaying, domObserversAllowed: false, mode: 'sleeping' };
    governor(sleep, backgroundPlaying);
    assert.equal(calls.skip, 2, 'Prime sleeping state disconnects auto-skip DOM observer');
    governor({ ...sleep, focused: true }, sleep);
    assert.equal(calls.skip, 2, 'Prime sleeping focus churn does not recheck observer');
    governor(front, sleep);
    assert.deepEqual(calls, { presentation: 1, skip: 3, anarchy: 3 }, 'Prime visible recovery restores both budgets');
    settingsChanged({ streamShellPrimeUiFixEnabled: { newValue: false } }, 'local');
    assert.deepEqual(calls, { presentation: 2, skip: 4, anarchy: 4 }, 'Prime setting changes still resync presentation and observers');
    vm.runInContext('syncPrimeEnhancementMarkers(); syncPrimeAutoSkipObserver();', ctx);
    assert.deepEqual(calls, { presentation: 3, skip: 5, anarchy: 5 }, 'Safe Mode external reconcile functions remain live');
}

(async () => {
    await netflixWakeBudget();
    await primeWakeBudget();
    console.log('PASS Provider DOM governor wake budget: Netflix / Prime focus, visibility, settings and Safe Mode paths');
})().catch(error => { console.error(error); process.exitCode = 1; });
