# Stream Shell v0.20.21 – Settings & Storage Consistency

**Type:** Narrow architecture/data-integrity release. No new user features.

## Changes

- Added `dashboard/src/settings-storage.js`, loaded directly after `settings-config.js`, as the single Dashboard-specific helper for settings hydration, exporting complete settings snapshots, import validation, and serialized per-key writes. This is NOT a generalized repository-wide storage wrapper.
- A change to a setting is considered committed only after `chrome.storage.local.set` succeeds; failed writes no longer leave a falsely saved value in memory. A visible `Save failed` message restores the UI from its last confirmed values. Updates to the same key are ordered; separate keys are independent.
- Export still includes all recognized keys and resolves missing 32:9/16:9/16:10 scoped settings from their legacy base key. Import keeps the provider-registry normalizer and existing boolean/numeric/string rules.
- Rejects malformed, empty or unrelated JSON before changing storage. For old settings files that have no scoped keys, clears obsolete scoped overrides only **after** the replacement storage write succeeds.
- Settings-change telemetry is best effort. A telemetry failure no longer makes a successful save look like a failure; Sleep Timer action transport failures receive their own status message.
- Regression test checks scoped fallback, malformed imports, legacy migration order, same-key write serialization, error recovery, unsuccessful save rollback, and healthy saves. CI requires this contract.

## Preserved

- Twitch, Marbles, Discord, YouTube/Netflix/Prime/Disney/Crunchyroll, COBOL Finance, Native titlebar and HWND mappings, renderer handoff delays, and the existing Background IPC contract are untouched.
- Provider Registry keeps its own pre-existing serialized mutation/validation path. Browser-wide window/storage scans and startup behavior are not modified.
- No C# modification; no Native Helper reinstall required. User backgrounds and custom provider artwork are excluded from both release archives.

## Validation

Run `node tools/check-project.mjs`. It checks all five generated bundles byte for byte, JavaScript syntax, regression behavior, manifest references and the Native static contract. Windows Opera GX integration and long-term sleep/wakeup behavior cannot be proven by Node tests.

Install the PATCH over v0.20.20, reload the extension.
