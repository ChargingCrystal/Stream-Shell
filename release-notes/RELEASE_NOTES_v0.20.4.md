# Stream Shell 0.20.4 — Window Event Backpressure

Measured v0.20.3 performance: Twitch cold start fell to 2.1 s from 5.9 s in 0.20.2. The first subsequent YouTube restore still took 5.6 s (including 1.7 s window acquisition), while the next command was 115 ms. This patch targets **ongoing browser work amplification** instead of just Twitch launch latency.

- Batch native Opera focus + bounds notifications into a single latest-state reconciliation. Multiple notifications during another batch are merged into one follow-up rather than spawning unbounded overlapping chains.
- Preserve explicit Twitch A–D focus lightweight handling and skip all-Twitch bounds changes; only non-Twitch changes run a full broadcast.
- Skip Discord native-status probes when the right pane isn't Discord.
- Drop the second provider registry read when `switchProvider()` has already refreshed it under the transition lock.
- Flight Recorder reports slow/high-volume batches as `window-events / reconciled` with `received`, `boundsWindows`, `hadFocus` and `durationMs`. Failures surface in diagnostics.

**Install:** Overlay 0.20.4 PATCH over 0.20.3, then reload via `opera://extensions`. Native helper and protocol v9 unchanged. No personal backgrounds or custom icons included.

**Validation:** Automated tests for focus/bounds storms and normal vs Twitch-specific behavior; full Opera + WuWa prolonged runtime requires a real-world follow-up. This is a targeted stability experiment, not a proven fix for all freezes.
