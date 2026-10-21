# Stream Shell v0.20.22 – Settings Value Validation & Scoped Import Safety

**Type:** Narrow Dashboard settings data-integrity refactor. No feature/UI additions.

## Changes

- `dashboard/src/settings-storage.js` enforces known boolean, numeric-bound and enumerated-value contracts before importing settings. Numeric values outside their UI range are clamped; volume boosts round to 10% steps. Empty strings, nulls, non-finite values and unknown options reject the entire import before storage writes.
- `dashboard/src/settings-runtime.js` routes UI input through the same value normalizer. An invalid value displays `Invalid setting value` and is never queued to storage.
- Legacy partial-import migration now removes scoped overrides only for base keys included in the incoming backup. An unrelated import (such as Twitch auto-mute only) leaves the existing 32:9/16:9/16:10 controls alone. For mixed base/scoped imports, explicitly supplied display targets are protected.
- Added independent `dashboard/tests/settings-validation.test.js` and updated previous storage test expectations. The CI quality gate requires the new test.

## Deliberate boundaries

- This is not a new universal settings registry; existing independent Provider Registry persistence, per-provider content-script storage, Native protocol and COBOL Finance continue unchanged.
- No root-directory changes and no background/startup/Twitch/Win32 work.
- Existing stored settings are not rewritten on extension startup; validation applies when a Dashboard setting is changed or a backup is imported.
- No C# changes or Native reinstall. Do not overwrite `assets/backgrounds/` or custom user artwork.

## Validation / Installation

Run `node tools/check-project.mjs` (bundle parity, JS syntax, regression tests, C# source contract). Windows/Opera UI still requires normal smoke testing. Apply PATCH over v0.20.21 and reload the extension.
