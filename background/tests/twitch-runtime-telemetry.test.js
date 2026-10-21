/* Ensures the content-script telemetry endpoint is safe to query without
 * a live Twitch tab. Real timer-throttling behavior needs an Opera GX test. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const file = path.resolve(__dirname, '../../providers/player/twitch-utility.js');
const source = fs.readFileSync(file, 'utf8');
const tail = '    start().catch(() => {});';
assert.equal(source.split(tail).length, 2);
const code = source.replace(tail, `    globalThis.__getTelemetry = getTwitchRuntimeDiagnostics;\n    globalThis.__runtimeMetrics = twitchRuntimeMetrics;`);
const ctx = vm.createContext({
  URL, Date, Set, WeakMap, WeakSet, Math, console,
  document: { visibilityState: 'hidden', hasFocus: () => false },
  chrome: {runtime: {onMessage: {addListener: () => {}}}},
  location: { pathname: '/example_channel' }
});
vm.runInContext(code, ctx, { filename: file });
const report = JSON.parse(JSON.stringify(ctx.__getTelemetry()));
assert.equal(report.documentVisibility, 'hidden');
assert.equal(report.workspaceCovered, true);
assert.equal(report.channel, 'https://www.twitch.tv/example_channel');
assert.equal(report.automation.observedPlayCount, 0);
assert.equal(report.automation.lastJoinAttemptAt, null);
assert.equal(report.automation.heartbeatDelayedCount, 0);
assert.ok(!('chatText' in report.automation), 'do not export chat text');
ctx.__runtimeMetrics.heartbeatMaxDriftMs = 6400;
ctx.__runtimeMetrics.lastJoinTimerDriftMs = 2400;
assert.equal(ctx.__getTelemetry().automation.heartbeatMaxDriftMs, 6400);
assert.equal(ctx.__getTelemetry().automation.lastJoinTimerDriftMs, 2400);
console.log('Twitch in-memory timing diagnostics schema: PASS');
