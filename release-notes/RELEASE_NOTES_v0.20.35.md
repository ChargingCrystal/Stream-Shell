# Stream Shell v0.20.35 — Concurrent Twitch Maintenance Admission

**Date:** 2026-10-21  
**Scope:** Background Twitch 4-slot alarm bookkeeping / explicit launch critical path only. No Native C# or content CSS/JS changes.

## Field evidence (v0.20.34)

The user confirms startup header/sidebar flicker is gone with the early passive Twitch CSS. The new per-tab navigation audit shows **one top-frame commit per slot, zero observed reloads and redirects** throughout the captured MV3 worker lifetime. All four late automation modules are active after one successful injection each, the native cluster has four members/zero pending claims, and Marbles rejects three historical chat batches totaling 148 lines. Twitch resumed in 9,102ms, of which `twitch:raise-workspace` was 5,767ms (partly the deliberate 3 × 1,250ms browser popup pacing), and the **serial `twitch:refresh-alarms` cost 567ms**. This is isolated browser alarm housekeeping and does not need to delay the visual startup.

## Implementation

- `background/src/05aa-twitch-workspace-v2.js`: `syncTwitchWorkspaceV2StreamRefreshAlarms` checks the four independent A–D alarm names concurrently with `Promise.all`, preserving each slot's existing stream/page cancellation and missing-alarm creation. Alarm period, deferred focus/fullscreen refresh, stream kind checks and periodic maintenance reload logic are **unchanged**.
- `_showTwitchWorkspaceV2` starts alarm synchronization immediately after `rightMode` is persisted, overlapping with **native titlebar sync and sequential A–D popup creation**. It still awaits the alarm promise before notifying UI/recording the final `shown` Flight Recorder event and returning the transition result. Therefore no new fire-and-forget maintenance state or MV3 lifecycle risk.
- All renderer handoff leases, 1.25s A–D popup stagger, Native claims/wake, HUD lazy admission, early passive CSS, Marbles history protection, and settings data remain intact.

## Validation

New required behavioral test `background/tests/twitch-alarm-concurrent-admission.test.js` checks that all four `alarms.get()` requests are initiated before any response completes, creates missing stream alarms, clears an inactive page alarm, retains existing alarms, tolerates a rejected alarm lookup, and verifies the explicit Twitch launch raises windows before alarm housekeeping resolves **while still awaiting it before the final UI notification/return**.

Offline `node tools/check-project.mjs` validates bundles and regression suite. Real Opera GX performance improvement is **not** claimed until live field diagnostics. In the next run compare total `twitch:resume` duration, `twitch:raise-workspace` duration, and maintenance timings; step-timing reports execution duration, not blocking/waiting overlap.

No new permissions, no native reinstall and no local artwork are needed.
