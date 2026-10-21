/** v0.20.26: focus-only governor changes cannot restart YouTube DOM settle passes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const counts = { sync: 0, settle: 0, disconnect: 0, cancel: 0, clear: 0 };
let onGovernor;
const ctx = vm.createContext({
    console, Promise,
    getCurrentProvider: () => 'youtube',
    startProviderFeatureOnce: (_name, initializer) => Promise.resolve(initializer()),
    YOUTUBE_UTILITY_DEFAULTS: {},
    chrome: { storage: {
        local: { get: async () => ({}) },
        onChanged: { addListener() {} }
    } },
    document: { addEventListener() {} },
    setYouTubeThemeMarker() {}, syncYouTubeCleanupMarkers() {},
    handleYouTubeUtilityNavigation() {},
    syncYouTubeRuntimeObservers() { counts.sync++; },
    scheduleYouTubeNavigationSettle() { counts.settle++; },
    clearYouTubeUtilityDomTimer() { counts.clear++; },
    cancelYouTubeUtilitySettlePasses() { counts.cancel++; },
    disconnectYouTubeRuntimeObservers() { counts.disconnect++; },
    scheduleYouTubeUtilityDomSync() {},
    onProviderResourceGovernorChange(callback) { onGovernor = callback; },
    createProviderResourceLoop() { return { stop() {} }; }
});
const source = fs.readFileSync(path.join(__dirname, '../src/youtube-utilities-start.js'), 'utf8');
vm.runInContext(source, ctx);
(async () => {
    await vm.runInContext('startYouTubeUtilities()', ctx);
    assert.equal(counts.sync, 1, 'initial observer setup is retained');
    const allowed = { domObserversAllowed: true, mode: 'foreground-paused', focused: false };
    onGovernor({ ...allowed, focused: true }, allowed);
    onGovernor({ ...allowed, mode: 'foreground-playing' }, allowed);
    assert.equal(counts.sync, 1, 'focus/play state changes must not reattach observers');
    assert.equal(counts.settle, 0, 'focus/play state changes must not restart SPA settle passes');
    const hidden = { domObserversAllowed: false, mode: 'sleeping' };
    onGovernor(hidden, allowed);
    assert.equal(counts.disconnect, 1, 'hidden state disconnects observers');
    assert.equal(counts.cancel, 1, 'hidden state cancels pending settle passes');
    onGovernor({ ...hidden, focused: true }, hidden);
    assert.equal(counts.disconnect, 1, 'repeated hidden state cannot repeat teardown');
    onGovernor(allowed, hidden);
    assert.equal(counts.sync, 2, 'becoming observable resyncs DOM roots');
    assert.equal(counts.settle, 1, 'becoming observable schedules the bounded SPA settle');
    console.log('PASS YouTube observer wake budget: real visibility changes only');
})().catch(error => { console.error(error); process.exitCode = 1; });
