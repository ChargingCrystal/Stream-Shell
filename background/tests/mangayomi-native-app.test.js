const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'background/src/05-mangayomi.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'shared/provider-registry-core.js'), 'utf8');

function createHarness({mode = 'wide', rightMode = 'dashboard', previouslyMinimized = false, nativeFails = false} = {}) {
    const state = {
        leftMode: 'youtube', rightMode,
        landingWindowId: 20, dashboardWindowId: 30,
        streamShellMangayomiExecutable: 'C:\\Apps\\Mangayomi.exe',
        streamShellSevenSeasAcknowledged: true
    };
    const windows = {12: 'normal', 20: previouslyMinimized ? 'minimized' : 'normal',
        30: previouslyMinimized ? 'minimized' : 'normal'};
    const calls = [], commands = [], paused = [];
    const storage = {
        get: async key => {
            if (Array.isArray(key)) return Object.fromEntries(key.map(k => [k, state[k]]));
            return {[key]: state[key]};
        },
        set: async values => Object.assign(state, values)
    };
    const ctx = vm.createContext({ URL, console,
        chrome: {storage: {local: storage}, runtime: {sendNativeMessage: async (host, args) => {
            commands.push({host, args}); calls.push('native:' + args.action);
            if (nativeFails) return {ok: false, error: 'not installed'};
            return {ok: true, running: true, visible: args.action === 'show'};
        }}},
        MANGAYOMI_NATIVE_HOST: 'com.streamshell.mangayomi',
        MANGAYOMI_PATH_KEY: 'streamShellMangayomiExecutable',
        STREAM_SHELL_PROVIDER_REGISTRY_KEY: 'streamShellProviderRegistry',
        LEFT: {left: 0, top: 0, width: 1920, height: 1080},
        RIGHT: {left: 1920, top: 0, width: 1920, height: 1080},
        shuttingDown: false,
        getStreamShellDisplayProfile: async () => ({mode}),
        stopVolumeCaptureForProviderChange: async () => {},
        ensureLandingWindow: async () => {calls.push('ensure:landing'); return 20;},
        ensureDashboardWindow: async () => {calls.push('ensure:dashboard'); return 30;},
        restoreWindow: async (id, bounds, focused) => {
            calls.push('restore:' + id + ':' + focused);
            assert.equal(focused, false, 'native activation must not steal the final focus');
            assert.equal(bounds.left, id === 20 ? 0 : 1920);
            windows[id] = 'normal';
        },
        getProviderWindows: async () => ({youtube: 12}),
        pauseProviderWindowPlayback: async id => paused.push(id),
        setWindowMuted: async () => {},
        safelyMinimizeWindow: async id => {
            calls.push('minimize:' + id);
            windows[id] = 'minimized';
            // Windows automatically minimizes owner-dependent Dashboard when
            // the Landing/Alt-Tab representative is minimized.
            if (id === 20) windows[30] = 'minimized';
        },
        recordFlightEvent: async event => { calls.push('flight:' + event.action); },
        broadcastState: async () => {calls.push('broadcast');}
    });
    vm.runInContext(core, ctx);
    vm.runInContext(source, ctx);
    return {ctx, state, windows, calls, commands, paused};
}

(async () => {
    // Wide: keep the Landing owner normal, with the Dashboard visible on RIGHT.
    const h = createHarness();
    await vm.runInContext('showMangayomi()', h.ctx);
    assert.equal(h.state.leftMode, 'mangayomi');
    assert.deepEqual(h.paused, [12]);
    assert.equal(h.windows[20], 'normal', 'Landing must remain a normal owner HWND');
    assert.equal(h.windows[30], 'normal', 'right Dashboard must remain visible');
    assert.equal(h.windows[12], 'minimized', 'old web provider must be parked');
    assert.deepEqual(h.calls.filter(x => x.startsWith('minimize:')), ['minimize:12']);
    assert.equal(h.commands[0].host, 'com.streamshell.mangayomi');
    assert.deepEqual(h.commands.map(x => x.args.action), ['show', 'show']);
    assert.equal(h.commands[0].args.left, 0);
    assert.equal(h.commands[0].args.top, 6, 'Wide Flutter caption avoids the full titlebar height');
    assert.equal(h.commands[0].args.height, 1074, 'preserve pane bottom while offsetting 6px');
    assert.ok(h.calls.indexOf('restore:20:false') < h.calls.indexOf('minimize:12'));
    assert.ok(h.calls.indexOf('restore:30:false') < h.calls.lastIndexOf('native:show'));
    assert.equal(h.calls.at(-1), 'broadcast');

    // Repair previous v0.21.0 state where minimizing Landing minimized Dashboard too.
    const old = createHarness({previouslyMinimized: true});
    await vm.runInContext('showMangayomi()', old.ctx);
    assert.equal(old.windows[20], 'normal');
    assert.equal(old.windows[30], 'normal');

    // RIGHT Discord or Twitch must never trigger a Dashboard restore.
    for (const rightMode of ['discord', 'twitch']) {
        const other = createHarness({rightMode});
        await vm.runInContext('showMangayomi()', other.ctx);
        assert.ok(!other.calls.includes('ensure:dashboard'));
        assert.equal(other.state.rightMode, rightMode);
        assert.equal(other.windows[20], 'normal');
    }

    // Compact has one surface; never create/show a Wide-only Landing anchor.
    const compact = createHarness({mode: 'compact'});
    await vm.runInContext('showMangayomi()', compact.ctx);
    assert.ok(!compact.calls.includes('ensure:landing'));
    assert.ok(!compact.calls.includes('ensure:dashboard'));

    // An unavailable helper must fail before touching Opera windows/state.
    const failed = createHarness({nativeFails: true});
    await assert.rejects(() => vm.runInContext('showMangayomi()', failed.ctx), /not installed/);
    assert.deepEqual(failed.calls, ['native:show']);
    assert.equal(failed.state.leftMode, 'youtube');

    await vm.runInContext('hideMangayomiIfActive()', h.ctx);
    assert.equal(h.commands.at(-1).args.action, 'hide');
    assert.ok(h.calls.includes('flight:mangayomi-hidden'), 'successfully parked native app is observable');
    assert.equal(h.state.leftMode, 'mangayomi', 'hide does not change the unrelated right pane');
    h.state.leftMode = 'youtube';
    const count = h.commands.length;
    await vm.runInContext('hideMangayomiIfActive()', h.ctx);
    assert.equal(h.commands.length, count, 'other left modes do not send an unwanted hide');
    console.log('Mangayomi Wide owner-anchor/Dashboard, Compact and right-pane isolation: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
