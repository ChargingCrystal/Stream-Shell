/** v0.20.25: provider page-lifetime feature startup owns listeners exactly once. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '../src/', name), 'utf8');
const countsFor = () => ({ reads: 0, storage: 0, dom: 0, win: 0, governor: 0, loops: 0, adapters: 0, observerCreates: 0, observerStarts: 0 });

function sandbox(provider, extras = {}) {
    const counts = countsFor();
    const pending = [];
    const adapter = {
        adapterKind: provider,
        isWatchContext: () => false,
        getMediaSnapshot: async () => null,
        extensions: {
            automation: { run: () => true },
            enhancements: { start: () => { counts.adapters++; }, syncSettings: () => {} },
            presentation: { sync: () => { counts.adapters++; } },
            autoSkip: { syncObserver: () => { counts.adapters++; } },
            windowedPlayer: { start: () => { counts.adapters++; } }
        }
    };
    const root = {};
    const context = vm.createContext({
        Promise,
        console,
        getCurrentProvider: () => provider,
        getProviderAdapter: () => adapter,
        getPrimaryVideo: () => null,
        isProviderSafeModeEnabled: () => false,
        shouldProviderResourceObserveDom: () => true,
        shouldProviderResourceRunVisualWork: () => false,
        providerApiNotifyExtensionChange: () => {},
        providerApiOn: () => { counts.dom++; return () => {}; },
        onProviderResourceGovernorChange: () => { counts.governor++; return () => {}; },
        createProviderResourceLoop: () => { counts.loops++; return {stop() {}}; },
        MutationObserver: class {
            constructor() { counts.observerCreates++; }
            observe() { counts.observerStarts++; }
            disconnect() {}
        },
        document: { documentElement: root, visibilityState: 'visible', addEventListener: () => { counts.dom++; } },
        window: { location: { pathname: '/watch', search: '', href: 'https://www.youtube.com/watch' }, addEventListener: () => { counts.win++; } },
        chrome: {
            storage: {
                local: {
                    get: () => { counts.reads++; return new Promise(resolve => pending.push(resolve)); },
                    remove: async () => {}, set: async () => {}
                },
                onChanged: { addListener: () => { counts.storage++; } }
            },
            runtime: { sendMessage: async () => ({ armed: false }), onMessage: { addListener: () => {} } }
        },
        // Resource Governor's helpers are only evaluated, never started.
        recordProviderFlightEvent: () => {},
        ...extras
    });
    vm.runInContext(source('provider-resource-governor.js'), context);
    // Preserve the real startup registry; isolate unrelated governor timers.
    context.createProviderResourceLoop = () => { counts.loops++; return { stop() {} }; };
    context.onProviderResourceGovernorChange = () => { counts.governor++; return () => {}; };
    const run = code => vm.runInContext(code, context);
    return { context, counts, pending, adapter, run };
}

async function assertOneStartup({ file, functionName, provider, extras = {}, after = async () => {}, expected }) {
    const s = sandbox(provider, extras);
    vm.runInContext(source(file), s.context);
    if (file === "playback-utilities.js") s.context.syncPlaybackUtilities = () => {};
    s.run(`var firstStart = ${functionName}(); var secondStart = ${functionName}();`);
    assert.equal(s.run('providerResourceFeatureStarts.size'), 1, `${file}: startup must have one owner`);
    assert.equal(s.counts.reads, expected.reads || 0, `${file}: duplicate storage hydration`);
    for (const resolve of s.pending.splice(0)) resolve({});
    await Promise.all([s.context.firstStart, s.context.secondStart]);
    await after(s);
    assert.equal(s.run(`startProviderFeatureOnce("${expected.key}:${provider}", () => { throw Error("second startup"); }) === providerResourceFeatureStarts.get("${expected.key}:${provider}")`), true);
    await s.run(`${functionName}()`);
    assert.equal(s.run('providerResourceFeatureStarts.size'), 1, `${file}: later restarts must remain idempotent`);
    for (const field of ['storage', 'dom', 'win', 'governor', 'loops', 'adapters', 'observerStarts']) {
        if (expected[field] === undefined) continue;
        assert.equal(s.counts[field], expected[field], `${file}: unexpected ${field} registration count`);
    }
    return s;
}

(async () => {
    // Guard is also safe during synchronous reentrant initialization.
    const reentrant = sandbox('youtube');
    reentrant.run(`var invocations = 0, nested; var once = startProviderFeatureOnce('demo', () => { invocations++; nested = startProviderFeatureOnce('demo', () => { invocations++; }); });`);
    assert.equal(reentrant.run('invocations'), 1);
    assert.equal(reentrant.run('once === nested'), true);
    await reentrant.context.once;
    reentrant.run(`var again = startProviderFeatureOnce('demo', () => { invocations++; });`);
    assert.equal(reentrant.run('once === again'), true);
    assert.equal(reentrant.run('invocations'), 1);

    await assertOneStartup({
        file: 'netflix-enhancements.js', functionName: 'startNetflixEnhancements', provider: 'netflix',
        expected: { key: 'netflix-enhancements', reads: 1, storage: 1, governor: 1, loops: 1, observerStarts: 1 }
    });
    await assertOneStartup({
        file: 'crunchyroll-enhancements.js', functionName: 'startCrunchyrollEnhancements', provider: 'crunchyroll',
        expected: { key: 'crunchyroll-enhancements', reads: 1, storage: 1, adapters: 1 }
    });
    await assertOneStartup({
        file: 'prime-enhancements.js', functionName: 'startPrimeEnhancements', provider: 'prime',
        expected: { key: 'prime-enhancements', reads: 1, storage: 1, governor: 1, adapters: 2 }
    });
    await assertOneStartup({
        file: 'youtube-utilities-start.js', functionName: 'startYouTubeUtilities', provider: 'youtube',
        extras: {
            YOUTUBE_UTILITY_DEFAULTS: { theme: true },
            setYouTubeThemeMarker: () => {}, syncYouTubeCleanupMarkers: () => {},
            handleYouTubeUtilityNavigation: () => {}, syncYouTubeRuntimeObservers: () => {},
            clearYouTubeUtilityDomTimer: () => {}, cancelYouTubeUtilitySettlePasses: () => {},
            disconnectYouTubeRuntimeObservers: () => {}, scheduleYouTubeNavigationSettle: () => {},
            scheduleYouTubeUtilityDomSync: () => {}, applyYouTubePreferredQuality: () => {},
            applyYouTubeUploadDate: () => {}, syncYouTubeLoopSetting: () => {},
            runYouTubeAutoLike: () => {}
        },
        expected: { key: 'youtube-utilities', reads: 1, storage: 1, dom: 3, governor: 1, loops: 1 }
    });
    await assertOneStartup({
        file: 'windowed-player-start.js', functionName: 'startWindowedPlayer', provider: 'youtube',
        extras: {
            WINDOWED_PLAYER_PROVIDERS: new Set(['youtube']),
            getWindowedPlayerStorageKey: () => 'windowed-youtube',
            displayScopedStorageKey: key => `${key}__32_9`,
            readDisplayScopedSetting: () => false,
            syncWindowedPlayerMode: () => {}
        },
        expected: { key: 'windowed-player', reads: 1, storage: 1, win: 1, adapters: 1 }
    });
    await assertOneStartup({
        file: 'playback-utilities.js', functionName: 'startPlaybackUtilities', provider: 'youtube',
        extras: {
            PLAYBACK_UTILITY_PROVIDERS: ['youtube'],
            WINDOWED_PLAYER_PROVIDERS: new Set(['youtube']),
            playbackUtilityDefaults: {}, playbackUtilitySettings: {},
            playbackUtilityKeysForProvider: () => [],
            syncPlaybackUtilities: () => {},
            displayScopedStorageKey: key => key,
            handleWindowedDoubleClick: async () => {}, handleSleepTimerEnded: () => {},
            syncPlaybackRate: () => {}
        },
        expected: { key: 'playback-utilities', reads: 1, storage: 1, dom: 4, governor: 1, loops: 1 }
    });
    await assertOneStartup({
        file: 'now-playing-tracker.js', functionName: 'startNowPlayingTracking', provider: 'youtube',
        extras: { NOW_PLAYING_KEY_PREFIX: 'now-playing-', getProviderMediaIdentity: () => null },
        expected: { key: 'now-playing-tracking', reads: 0, dom: 2, loops: 1 }
    });
    console.log('PASS provider feature startup: reentrancy + seven page-lifetime owners');
})().catch(error => { console.error(error); process.exitCode = 1; });
