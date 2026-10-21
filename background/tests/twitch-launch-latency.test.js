/* v0.20.3: launching Twitch never runs slow synchronous browser/window diagnostics. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/05aa-twitch-workspace-v2.js'), 'utf8');
const start = source.indexOf('async function _showTwitchWorkspaceV2(');
const end = source.indexOf('async function assignTwitchWorkspaceV2Slot(', start);
assert.ok(start >= 0 && end > start, 'expected the canonical Twitch activation function');
assert.match(source.slice(end), /async function getTwitchWorkspaceV2Diagnostics\(/, 'full diagnostics function must still exist');

const calls = [];
const record = {
    version: 7,
    lifecycle: 'test',
    slots: Object.fromEntries(['a', 'b', 'c', 'd'].map((id, i) => [id, { kind: 'stream', windowId: 100+i, url: 'https://www.twitch.tv/example' }])),
    selectedSlot: 'a', activationCount: 12,
};
const ctx = vm.createContext({
    Date, Promise, console,
    measureShellWindowStep: async (_name, operation) => operation(),
    shuttingDown: false,
    TWITCH_WORKSPACE_V2_SLOT_IDS: ['a', 'b', 'c', 'd'],
    getStreamShellDisplayProfile: async () => ({ mode: 'wide' }),
    ensureDashboardWindow: async () => { calls.push('dashboard'); },
    chrome: { storage: { local: { get: async () => ({ rightMode: 'dashboard' }), set: async () => {} } } },
    hideDiscordForDashboard: async () => {},
    migrateIntoTwitchWorkspaceV2: async () => record,
    TWITCH_DROPS_URL: 'https://www.twitch.tv/drops/inventory',
    isTwitchDropsUrl: () => false,
    assignTwitchWorkspaceV2Slot: async () => record,
    setTwitchWorkspaceV2Record: async rec => rec,
    isTwitchWorkspaceV2ColdStart: async () => false, // All four mock slot windows exist.
    syncConnectedTitlebarNative: async () => {},
    raiseTwitchWorkspaceV2: async rec => { calls.push('raise'); return rec; },
    scheduleTwitchWorkspaceV2Claims: () => { calls.push('claims'); },
    scheduleTwitchWorkspaceV2SurfaceWake: () => { calls.push('wake'); },
    syncTwitchWorkspaceV2StreamRefreshAlarms: async () => {},
    recordFlightEvent: async () => {},
    broadcastTwitchWorkspaceV2LaunchState: async () => { calls.push('fast-broadcast'); },
    twitchWorkspaceV2SummaryFromRecord: () => { calls.push('summary'); return { active: true, version: 7 }; },
    getTwitchWorkspaceV2Diagnostics: async () => { calls.push('FULL_DIAGNOSTICS'); return new Promise(() => {}); }
});
vm.runInContext(source.slice(start, end), ctx);
(async () => {
    const status = await Promise.race([
        vm.runInContext('_showTwitchWorkspaceV2("resume")', ctx),
        new Promise((_, reject) => setTimeout(() => reject(new Error('launch waited for full diagnostics')), 600))
    ]);
    assert.equal(status.active, true);
    assert.ok(calls.includes('claims') && calls.includes('wake') && calls.includes('fast-broadcast'));
    assert.ok(calls.includes('summary'));
    assert.ok(!calls.includes('FULL_DIAGNOSTICS'), 'per-slot probes must NOT execute during normal activation');
    console.log('Twitch activation without per-slot diagnostics: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
