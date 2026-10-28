# Stream Shell v0.20.40 — Viewer Raid Guard, evidence-only recovery

**Date:** 2026-10-21. **Status:** Static/VM tests passed; **real Twitch raid yet to be confirmed in Opera GX**. Not a GitHub Release or tag.

## Problem

Live Twitch raid bypassed v0.20.39's Raid Guard even though the user confirmed its removal of generic old-channel snapback. The current UI handler required the string `raid` on a visible container and a `Leave Raid`/`Cancel Raid`-style button, skipped standalone viewer `Leave`, imposed a 12s cooldown without a successful click, and used a 30s fallback scan despite a limited raid countdown. Twitch's normal viewer Raid UI provides a Leave / opt-out button before automatic navigation.

## Changes

- `providers/player/twitch-automation.js`: scoped raid banner selector variants + visible raid evidence; accepts standalone `Leave` ONLY inside a positively identified visible raid surface. Opt-out attempts are cooldown-throttled after actual click. Extra 1,500ms **raid-only** timer runs only when a managed slot enables anti-raid; normal 30s automation fallback and Marbles/Points/Drops budgets unchanged.
- Live per-slot `automation.raidGuard` Diagnostics: `enabled`, `bannersSeen`, `optOutAttempts`, `lastOptOutAt`, `lastOptOutLabel`, `lastScanAt`, `lastResult`.
- `background/src/05aa-twitch-workspace-v2.js`: if Twitch directs an anti-raid-protected slot onto a different channel with explicit `?referrer=raid`, restore the previous saved channel. Only this positive marker qualifies; no arbitrary cross-channel navigation is recovered. Suppress duplicate onUpdated/webNavigation hits for 10 seconds. A Flight Recorder event `twitch-raid-guard/tagged-raid-redirect-recovered` is emitted. If Twitch omits both banner and referral marker, the transition cannot be identified reliably and may still proceed.
- `background/tests/twitch-raid-optout-positive-evidence.test.js`: behavior regression for visible banner, generic dialog, hidden raid, no actionable button, cooldown, disabled flag, tagged-only recovery, normal user navigation and duplicate suppression. Registered in `tools/check-project.mjs`.
- `README.md`, `CHANGELOG.md`, `docs/PROJECT-STRUCTURE.md`, `docs/TODO_RULED_OUT.txt` refreshed. Native helper and original Chromium-tab mute remain unchanged. User-requested v0.20.39 player-audio rollback unchanged. Optional user Backgrounds not bundled.

## Validation

Run `node tools/check-project.mjs` for syntactic, regression, Native contract and bundle parity checks. Windows/Opera GX and real Twitch raid interception are **not** emulated by this Linux suite.
