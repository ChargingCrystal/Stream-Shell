# Dashboard settings / storage conventions (v0.20.29)

## Ownership

- `dashboard/src/settings-config.js` owns defaults, known keys and display-scoped key names.
- `dashboard/src/settings-storage.js` owns the *pure* hydration/export/import codecs and the serial write queue for ordinary Dashboard settings.
- `dashboard/src/settings-controls.js` owns markup and import/export UI interactions.
- `dashboard/src/settings-runtime.js` owns DOM event handling, state updates, and notifications.
- `dashboard/src/provider-registry.js` remains authoritative for provider-registry mutations; do not redirect its already serialized writes through the generic settings queue.
- None of these helpers belong in the `background.js` window-management path or common content scripts.

## Behavior contracts

1. `chrome.storage.local` owns persistent settings. Defaults are computed, not bulk-written on startup. Unknown storage keys are ignored by Settings export/hydration.
2. Display-scoped settings use `baseKey__32_9`, `baseKey__16_9` or `baseKey__16_10`. When a scoped key is absent, the legacy unsuffixed value is the effective fallback. Export retains this backward compatibility.
3. Import accepts recognized keys only and fails on empty/unrelated JSON. Validate the whole payload **before** mutating storage, rejecting invalid boolean/enum/numeric values rather than silently resetting defaults. Out-of-range valid numbers are bounded to UI limits. Only remove display-scoped overrides for **base keys actually present in the legacy file**, after their new values were saved; mixed imports protect explicitly scoped entries. Storage is not transactional; cross-operation failures can still leave a partial legacy migration.
4. Both imports and ordinary UI inputs call `streamShellNormalizeSettingValue` from `settings-storage.js`. Keep each new high-impact select, range or number input and its validator in sync. This is not a provider/content-script schema or a global migration-on-startup.
5. Ordinary UI writes for the same key are serialized to avoid out-of-order persistence. Do not write to the in-memory committed settings cache before `set()` succeeds. A failed write must be visible and allow the next queued write to proceed. Different keys need no global lock.
6. Diagnostics/Flight Recorder events are best effort and must not gate a completed settings save. Avoid new polling or repeated `chrome.storage.local.get` on input/hover/focus paths.
7. Preserve specialized error paths and transport semantics for the Sleep Timer, provider registry, browser window state and Twitch claims. Do not unify them solely for stylistic reasons.

## Validation

Run `node tools/check-project.mjs` or `node dashboard/tests/settings-storage-contract.test.js` and `node dashboard/tests/settings-validation.test.js`.
Required tests exercise export fallback, import safety/migration order, write queue and failure rollback. Node mock tests do not replace live Opera GX or Windows Native integration.

## Provider content-script storage (v0.20.29: Windowed Player only)

`common/src/windowed-player-start.js` owns a distinct page-lifetime `chrome.storage.onChanged` listener for the current provider's Windowed Player. It hydrates **once** with both the legacy base key and the current display-scoped key, and tracks whether a scoped override is present. Subsequent change batches update that in-memory pair **synchronously**: an existing scoped key always wins, a scoped-key deletion exposes the latest legacy value, and a batch containing both keys is applied as one effective setting. Extension-specific `hydrate`, `handleStorageChanges`, and `start` callbacks keep their existing ownership. Do not reintroduce asynchronous `storage.local.get` inside this change listener: delayed read completions can revert newer UI settings.

This contract is **not** a global cache of all provider settings, and does not change Dashboard serialization, Netflix/Prime/YouTube enhancement storage listeners, Twitch, native Windows, or provider registry semantics. The invariant is checked by `common/tests/windowed-player-storage-order.test.js` and the page-lifetime test. Opera GX still needs live checks for display switching, Settings import/export and different providers.
