# Stream Shell v0.20.30 — Twitch Staged Content Initialization

Released: 2026-10-21

## Runtime baseline: v0.20.29 Opera GX worst-case launch

The user again started YouTube first and then Twitch A–D without a freeze. The Deep Diagnostics Flight Recorder reports a `provider → twitch` protected cold start (`graceMs: 5500`, `delayMs: 2711`, `cold: true`), four created Twitch popups at `spacingMs: 1250` and `coldStart: true`. The four Twitch Native claims are confirmed; the transition queue has no pending work, YouTube's three governor workloads show zero failures, and the provider self-test passes. At capture, **one unrelated Dashboard Native claim** was pending (`wide|right|dashboard|`); this is not evidence of a Twitch claim failure. Twitch resume lasted 11206ms including the established intentional cold-start work. These details motivate **reducing simultaneous DOM work**, not shortening the now proven-safe renderer handoff.

## Changes

1. **Split manifest admission stages.** `providers/player/twitch-utility.js` remains a `document_start` script for essential managed-identity, diagnostics, play/pause intent for covered streams, navigation and user-initiated raid opt-out. `providers/player/twitch-workspace-v2.js` now injects at `document_idle`, allowing the Twitch renderer to build the page before mounting the HUD. Same matches and isolated extension world; no dynamic page-world script injection.
2. **Move Native surface wake early.** The compositor-pulse listener, previously owned by the HUD, now belongs to `twitch-utility.js`, to ensure the late HUD cannot lose early wake requests. Eliminate the redundant second set of six startup HUD surface-check timers; `refreshContext()` already scheduled checks.
3. **Deferred DOM automation.** In the utility's initial managed/context/settings handshake, keep storage and lifecycle listeners responsive but defer one full DOM MutationObserver, the first claim-points/Drops/raid scan, and the 30s fallback interval to a bounded timer: slot A 650ms, B 1000ms, C 1350ms, D 1700ms. Each timer starts after settings hydration; only one activation is possible. Pending work is cancelled on pagehide, and storage changes arriving before activation do not cause premature scans/observer attachment.
4. **Marbles integrity.** The existing chat parser still handles `!play` synchronously in MutationObserver callbacks once armed, including distinct-user burst counting and the existing hydration/cooldown guards. No new timed message polling or changed trigger policy. The deferred phase must be confirmed in Opera GX for first-chat detection timing.
5. **Diagnostic visibility and tests.** Add `automation.startup` (phase, delay, scheduled/activated timestamps and measured activation latency) to each slot's existing Twitch Deep Diagnostics snapshot. Add mandatory VM-based tests for manifest separation, compositor wake before HUD, every slot's delay, storage changes, reentry protection, unload cancellation and synchronous Marbles. Keep all existing tests.

## Unchanged / risk boundary

Do **not** change 5.5s cold / 3s warm renderer cross-surface admission, 1250ms Twitch popup spacing, Native claims/COM/titlebar, Twitch playback guard semantics, Marbles cooldown, user automation settings or storage schema. No personal Background PNG/SVG or custom artwork is bundled. No Native C# changes/reinstall. This is an incremental **content-script activation** improvement; `twitch-utility.js` definitions still parse at document_start. Full code-splitting of utility automation into a separately injected bundle is a later option after live startup metrics and behavior are established.

## Validation / install

Run `node tools/check-project.mjs` for source/bundle parity, syntax, behavior, layout and static native source contract. This does **not** compile C# on Windows or validate Opera GX's actual document_idle timing. Install PATCH over 0.20.29 or use FULL; reload the unpacked extension and repeat YouTube → Twitch A–D while monitoring Drops and Marbles.
