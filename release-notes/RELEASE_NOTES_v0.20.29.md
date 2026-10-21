# Stream Shell v0.20.29 — Windowed Player Storage Event Ordering

Released: 2026-10-21

## Runtime baseline: v0.20.28 Opera GX worst-case launch

The user repeated the prior worst-case **YouTube first → Twitch A–D** path. This time it did not freeze. The Deep Diagnostics Flight Recorder shows provider→Twitch handoff with `cold: true`, `graceMs: 5500`, `delayMs: 3798` and four staggered Twitch popups (1250ms); Twitch reports `coldStart: true`. All four Native claims are confirmed, zero pending claims/transitions, zero YouTube resource-governor workload failures and successful Provider API self-test. The 12862ms Twitch transition includes intentionally serialized startup/grace work; **do not reduce the proven-safe admission times** on these data alone. Other providers still lack live observation in this specific export.

## Changes

1. **Scoped setting event-order fix:** The common Windowed Player previously re-read the base key when a display override was removed, and re-read the scoped key whenever a legacy base value changed. Those asynchronous responses could arrive **after** a newer change event and overwrite it, changing the player mode back unexpectedly.
2. **Single hydration, atomic changes:** Record the base enabled value and current display-scoped override from the existing startup `storage.local.get`. From then on, reflect `chrome.storage.onChanged` batches synchronously. Explicit scoped values always win; scoped deletion reveals the most recent legacy fallback; simultaneous legacy/scoped updates resolve together. Avoid per-change round-trips to storage, which also reduces writes/reads while switching Settings controls.
3. **Preserved hooks:** Existing provider adapter `hydrate`, `handleStorageChanges` and `start` callbacks remain in place; unrelated storage keys and areas stay ignored as before. This is limited to common Windowed Player content scripts, **not** a global settings cache or a Dashboard storage migration.
4. **Regression test:** New mandatory `common/tests/windowed-player-storage-order.test.js` tests explicit false overrides, legacy precedence, removal, mixed batches, rapid toggles, extension-controlled keys and no duplicate startup listeners. Existing lifecycle and provider tests still run.

## Unchanged

Twitch A–D popup/controller behavior, 5.5s cold / 3s warm provider/Twitch admission, 1250ms popup spacing, Native C#/titlebar/Discord, YouTube DOM observers, provider media logic, Settings UI validation and import/export, storage key names, personal artwork/backgrounds. No Native Helper reinstall required.

## Validation and install

`node tools/check-project.mjs` validates byte-exact source/bundle parity, syntax, regression coverage, layout and static C# source contract; no Windows-native compilation or live Opera GX storage interaction is claimed. Apply PATCH over v0.20.28 or use FULL, preserving local backgrounds and custom artwork. After updating, reload the extension.
