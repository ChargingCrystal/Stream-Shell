// Portable execution of the actual C# timing/decision expressions, not a second
// implementation. This is not a C# compiler or a Windows minidump runtime test.
// The same cases also run natively in hang-diagnostics-harness.cs on Windows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../titlebar-src/18-Json-Diagnostics-And-Cleanup.cs'), 'utf8');
function bodyAfter(marker) {
    const start = src.indexOf(marker);
    assert.ok(start >= 0, `missing ${marker}`);
    const begin = src.indexOf('{', start);
    let depth = 1, end = begin + 1;
    // These pure numeric methods contain no braces inside string literals.
    for (; end < src.length && depth; end++) {
        if (src[end] === '{') depth++;
        if (src[end] === '}') depth--;
    }
    assert.equal(depth, 0);
    return src.slice(begin + 1, end - 1);
}
const ageBody = bodyAfter('private static uint PerformanceAge(')
    .replace('int elapsed = unchecked(now - then);', 'const elapsed = (now - then) | 0;')
    .replace(/0u/g, '0').replace('(uint)elapsed', '(elapsed >>> 0)');
assert.ok(!/unchecked|\buint\b/.test(ageBody), 'unsupported C# age expression');
const age = new Function('now', 'then', ageBody);
// The outer body is a C# getter. Execute the inner, unchanged decision body.
const reasonBody = bodyAfter('internal string Reason').trim().replace(/^get\s*\{/, '').replace(/\}\s*$/, '');
const classify = new Function('ProcessedAge', 'UiAge', 'ClockStable', 'Heartbeat', 'SenderAge', reasonBody);
const gateBody = bodyAfter('internal bool Observe(').replace(/Math\.Min/g, 'Math.min');
const makeGate = new Function(`
    let Active = false, evidenceSamples = 0, healthySamples = 0, requested = false;
    return { observe(stalled, watchdogGap) { ${gateBody} }, get active() { return Active; } };
`);
const clockBody = bodyAfter('private static bool PerformanceClockChanged(')
    .replace('Math.Abs', 'Math.abs').replace('.TotalMilliseconds', '');
const clockChanged = new Function('PerformanceAge', `return function(now, previousTick, utc, previousUtc) { ${clockBody} };`)(age);
const senderBody = bodyAfter('internal long SenderAge').trim().replace(/^get\s*\{/, '').replace(/\}\s*$/, '');
const senderAge = new Function('ClockStable', 'Heartbeat', 'ReceivedAge', senderBody);
const classifyValues = (receivedAge, processedAge, uiAge, transit, stable = true) => {
    const heartbeat = { TransitMs: transit };
    return classify(processedAge, uiAge, stable, heartbeat, senderAge(stable, heartbeat, receivedAge));
};
assert.equal(age(1000, 1063), 0, 'the observed -63 ms race must not become 4294967233 ms');
assert.equal(age(-2147483640, 2147483640), 16, 'signed TickCount boundary');
assert.equal(age(10, -10), 20, 'full unsigned rollover');
assert.equal(age(100000, 0), 100000, 'real stalls preserved');
for (let n = 0; n < 100000; n++) {
    const now = (n * 7919) | 0;
    const received = (now + n % 100) | 0;
    const processed = (now + n % 60) | 0;
    const ui = (now + n % 80) | 0;
    assert.equal(classifyValues(age(now, received), age(now, processed), age(now, ui), 25), 'none');
}
assert.equal(classifyValues(100, 100, 10, 16000), 'heartbeat-transport-delay');
assert.equal(classifyValues(100, 100, 10, 14899), 'none');
assert.equal(classifyValues(100, 100, 10, 14900), 'heartbeat-transport-delay');
assert.equal(classifyValues(100, 100, 10, 3600000, false), 'none');
assert.equal(classifyValues(100, 100, 30000, 0), 'ui-gap');
assert.equal(classifyValues(30000, 30000, 10, -1), 'heartbeat-gap');
assert.equal(classifyValues(5000, 5000, 10, -1), 'none');
assert.equal(clockChanged(5000, 0, 5000, 0), false);
assert.equal(clockChanged(5000, 0, 3600000, 0), true);
assert.equal(clockChanged(-2147483640, 2147483640, 16, 0), false);
const gate = makeGate();
assert.equal(gate.observe(true, 5000), false);
assert.equal(gate.observe(true, 5000), true);
assert.equal(gate.observe(true, 5000), false);
gate.observe(false, 5000); assert.equal(gate.active, true);
gate.observe(false, 5000); assert.equal(gate.active, false);
assert.equal(gate.observe(true, 60000), false);
assert.equal(gate.observe(true, 5000), false);
assert.equal(gate.observe(true, 5000), true);
const progressBody = bodyAfter('private static PerformanceProgress ReadPerformanceProgress(');
assert.ok(progressBody.indexOf('int now = Environment.TickCount') > progressBody.indexOf('ref PerformanceUiTick'),
    'shared timestamps must be copied before reading now');
assert.match(src, /BuildPerformanceSnapshot\(out progress\)[\s\S]*?bool stalled = progress\.Reason != "none"/,
    'watchdog must classify the same progress observation as its JSON');
assert.match(src, /"v3-" \+ day/, 'old false-alarm quota must not block corrected recorder');
console.log('PASS timing: 100000 concurrent-update cases, wraparound, transport backlog, recovery and clock/sleep gates');

// Optional local replay; raw diagnostic files are never copied into the repo.
if (process.argv.length > 2) {
    const unique = new Map();
    for (const file of process.argv.slice(2)) {
        for (const line of fs.readFileSync(file, 'utf8').trim().split(/\r?\n/)) {
            const row = JSON.parse(line);
            if (row.sampleAt) unique.set(`${row.nativePid}/${row.sampleAt}`, row);
        }
    }
    const rows = [...unique.values()].sort((a, b) => a.sampleAt.localeCompare(b.sampleAt));
    const replayGate = makeGate();
    let races = 0, classified = 0, requests = 0, previous;
    for (const row of rows) {
        const fix = value => { if (value > 0x7fffffff) races++; return Math.max(0, value | 0); };
        const received = fix(row.heartbeatReceivedAgeMs);
        const processed = fix(row.heartbeatProcessedAgeMs);
        const ui = fix(row.uiAgeMs);
        // Reconstruct arrival delay from immutable sender stamp and receipt age.
        // Old records have a few ms of collection skew; threshold cases are tested above.
        const transit = row.heartbeatSentAtUtc
            ? Math.max(0, Date.parse(row.sampleAt) - Date.parse(row.heartbeatSentAtUtc) - received) : -1;
        const why = classifyValues(received, processed, ui, transit);
        const dt = previous && previous.nativePid === row.nativePid
            ? Date.parse(row.sampleAt) - Date.parse(previous.sampleAt) : 60000;
        if (why !== 'none') classified++;
        if (replayGate.observe(why !== 'none', dt)) {
            requests++;
            console.log(`REPLAY capture request ${row.sampleAt}: ${why}`);
        }
        previous = row;
    }
    console.log(`REPLAY: ${rows.length} unique samples, ${races} wrapped timing fields neutralized, ${classified} delayed samples, ${requests} capture requests`);
}
