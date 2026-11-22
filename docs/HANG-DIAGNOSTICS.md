# Native hang diagnostics (0.22.3)

This diagnostic update corrects evidence collection for the browser-wide Opera GX
hang. It does not change Twitch/player load or claim to resolve the underlying freeze.

## Install over 0.22.2

1. Extract the update ZIP into the existing extension directory, replacing its files.
2. Run `native/install-hang-diagnostics.cmd`. The script compiles the native host and
   runs isolated tests (including a dump of the test process) before installing it.
   These tests need no browser freeze, interaction or manual reproduction.
3. Reload the extension in `opera://extensions`, then restart Opera GX.

The script leaves the installed helper untouched if a pre-install check fails.
Reloading the extension alone does not rebuild the installed native helper.
The next `native-start` row must show `schema:3` and `hostVersion:"0.22.3"`.
No Mangayomi rebuild, background image replacement or new browser permission.

## Corrected timing

0.22.2 sometimes read `now` before another thread refreshed its heartbeat/UI tick.
The negative difference was cast to unsigned and became a false ~49-day stall.
This caused excessive pre-gap logging and premature capture quota consumption.

0.22.3 copies shared timestamps before reading the monotonic clock, clamps negative
signed modular differences to zero, and uses the same immutable observation for
both JSON and trigger decisions. Ordinary TickCount rollover is preserved; a
single diagnostic interval beyond 24.8 days is deliberately not trusted.

Each received heartbeat publishes its receipt tick, sequence, validated sender UTC
stamp and measured arrival delay as one immutable object. `heartbeatTransitMs`
means receipt UTC minus sender UTC. `heartbeatSenderAgeMs` adds the monotonic age
since receipt, so delivery of an already-old queued heartbeat cannot reset health.
These values describe the pipeline, not which browser thread caused its delay.

Capture triggers:

- No processed heartbeat for >=30 seconds (`heartbeat-gap`).
- Native UI progress absent for >=30 seconds (`ui-gap`).
- Heartbeat sender age >=15 seconds and measured arrival delay >=5 seconds
  (`heartbeat-transport-delay`), even if the most recent receipt was just now.

Two timely five-second watchdog observations are required to request a dump.
A delayed watchdog tick (>=15 seconds) resets confirmation. Two healthy observations
close an incident, avoiding repeated pre-gap flushes after a single fresh message.
Wall-clock changes >2 seconds relative to monotonic time are logged and disable
clock-dependent transport triggering for 60 seconds. The native/UI gap checks
remain monotonic. Invalid/future sender timestamps have no transport-delay value.

## Logs and capture evidence

Files remain under `%LOCALAPPDATA%\StreamShell\Logs`:

- `performance-YYYY-MM-DD.jsonl` and `.jsonl.1`: persistent rotating records.
- `HangDumps\*.dmp`: filtered stack/thread dumps of at most two claimed Opera
  browser processes plus the native host.
- `HangDumps\capture-*.jsonl`: per-incident evidence, including the triggering
  snapshot, dump filenames/results and completion progress. Keep this sidecar
  with its dumps even if the main performance log has rotated.

The dedicated recorder remains independent of the native reader, UI loop,
ThreadPool and stdout. It never waits for StateLock and does not send responsiveness
probe messages to Opera. Every five seconds it samples command/reader/output/UI
progress, visibility decisions, claimed windows and up to 64 Opera process counters.
CPU counters are cumulative milliseconds, not instantaneous percentages. Window
`hung` is Windows' indication, not definitive proof of responsiveness.

A minute of history stays in memory and is flushed once when an incident begins.
Healthy snapshots are persisted every minute; active incidents every five seconds.
`sampleAt` is observation time; `at` is persistence time. The existing 4 MiB rotation
with one backup per date and 14-day retention remain. No window titles, URLs,
command lines or tokens are deliberately written to JSONL.

Immediately before reserving a capture slot, the supervisor rechecks progress. If
it has recovered, `native-dump-skipped-recovered` is recorded without consuming a
slot or starting the cooldown. A dump is evidence of conditions at capture time;
the sidecar records whether health had recovered by its completion.

## Bounds

Dump workers run separately, with a ten-second timeout per worker and a 64 MiB
acceptance limit. Failed/oversized partial dumps are deleted; size may briefly exceed
the limit between polling intervals. Only a created worker may be terminated, never
an Opera/host target. PID/start-time identity checks remain in place. Renderer and
GPU processes are not automatically dumped in this first pass.

At most two batches per UTC day and a ten-minute cooldown are retained. Quota markers
now start with `v3-`, so 0.22.2 false alarms cannot block the corrected recorder on
the upgrade day. Prior evidence is preserved. Before a batch, retain at most three
older dumps; one batch adds at most three. Dumps, sidecars and attempt markers older
than three days are pruned at startup/capture. No files are uploaded automatically.
Dumps can contain private memory/path information despite filtering.

## Validation

`node tools/check-project.mjs` includes portable timing regression tests. The small
syntax adapter in `native/tests/hang-timing.test.js` executes the actual C# numeric
and decision expressions; it is not a C# compiler or a Windows runtime test.
Coverage includes 100,000 concurrent-update cases, TickCount rollover, confirmed
backlog detection, recovery hysteresis, delayed watchdog ticks and clock changes.

Optional local replay (raw logs are not copied into the repository):

```powershell
node native/tests/hang-timing.test.js path/to/performance.jsonl.1 path/to/performance.jsonl
```

Windows-native counterparts run automatically via the guarded installer, together
with contention, JSON parsing, retention and a real dump of the isolated test process:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File native/tests/compile-titlebar-host.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File native/tests/test-hang-diagnostics.ps1
```

Implementation environment: portable checks and local log replay ran; Windows
compilation/runtime could not run here. The existing unrelated regression
`mangayomi-titlebar-exception.test.js` still rejects the pre-existing legacy
`native/StreamShellDiscordHost.cs`, as it does on the unchanged base repository.
