# Stream Shell v0.20.20 – Background IPC Response Consistency

**Release type:** Narrow architecture/code-care release; no new UI features.

## Shipped

- Added `streamShellRespondAsync(sendResponse, operation, options)` to the pre-existing Background message helper module. It preserves Chromium MV3's async listener contract (`return true`), calls a successful operation once and sends **one** response, even when the operation throws synchronously, rejects asynchronously, or a success-mapper throws.
- A sender page may close before a reply arrives. The helper catches response-delivery exceptions without restarting operations or leaking unhandled errors.
- Standardized exactly four low-risk message types: `dashboard-settings-visibility`, `dashboard-flight-event`, `dashboard-diagnostics-repair`, `get-state`.
- Existing authorization checks run **before** work and remain unchanged. Existing response shapes remain compatible: settings/flight `{ok:boolean}`, repair passes through its service result, `get-state` retains its legacy flat success fields and `{ok:false,error}` failure format.
- Added tests for trusted/untrusted Dashboard callers, synchronous throws, promise rejections, closed reply channels, result mapping and reply-once behavior. Project quality gate now treats the new tests as required.
- Updated version, Changelog, README, Background module notes, and live TODO / ruled-out guardrails.

## Deliberately not changed

- Cached `dashboard-diagnostics-lite` stays **strictly synchronous and cache-only**; it is not given a promise, timer, or additional Browser APIs.
- Full `dashboard-diagnostics` remains its existing demand-driven deep-collector path; no new timeouts that could truncate exports.
- Native/Twitch/Win32 claim and recovery messages, window transitions, playback, auto-join, timers and renderer-admission delays are unchanged.
- No new background polling, no native C# build or reinstall, no changes to custom/personal background artwork.
- Other router branches still use existing request handling; broader migrations must be separate tested releases, not automatic search-and-replace.

## Validation and deployment

- Offline project gate: `node tools/check-project.mjs` (byte-parity of five bundles, syntax, Node regressions, Native static source contract).
- The Windows C# helper was not modified, and this environment did not run Opera GX integration tests. Verify Diagnostics Settings visibility and Repair on real Opera if convenient.
- Apply **PATCH over v0.20.19**, reload the unpacked extension at `opera://extensions`. **No Native helper reinstallation required.**
- PATCH and FULL archives intentionally exclude personal backgrounds/custom artwork.
