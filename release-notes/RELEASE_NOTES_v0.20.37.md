# Stream Shell v0.20.37 — Twitch Player Mute State Reconciliation

> **Historical note:** This release's Twitch in-page player-audio changes were fully rolled back in [v0.20.39](RELEASE_NOTES_v0.20.39.md). The v0.20.36 anti-raid URL snapback removal remains active.

**Date:** 2026-10-21  
**Scope:** Twitch player audio detection on managed stream slots. No Native helper or browser-tab mute changes.

## Field report and root issue

- v0.20.36 user confirms raid guard no longer hijacks deliberate channel changes. Whether actual raids are still cancelled is not yet live-tested; retain UI-only cancellation behavior from v0.20.36.
- The cold-opening Twitch streams still visually start **muted inside Twitch**. The user's internal navigation from a normal Twitch page to a stream avoids this. A site autostart issue is therefore more likely than a general volume preference.
- Crucially, v0.20.36 Deep Diagnostics contradict the visible UI: managed stream slots B/C/D all reported `unmuteAttempts: 2`, `unmuteSuccesses: 2`, `lastResult: player-unmuted`, `currentVideoMuted: false`, and video volume ~0.59. All three browser tabs remained separately muted via Stream Shell's own floating bar. Thus the HTMLMediaElement `muted` boolean **cannot establish** Twitch's own React player mute/UI state. v0.20.36 counted false-positive success from the video property.
- Browser autoplay policy is a plausible contributing factor, because muted autoplay is generally permitted but unmuted autoplay may require site engagement/user activation. A site-level sound permission (`Allow`) may help in some Chromium profiles, but is not proven for this exact Opera GX configuration. Stream Shell cannot manufacture trusted user activation; an in-browser UI test remains essential.

## Fix — player-UI-first detection and verification

`providers/player/twitch-utility.js` now identifies Twitch's own `player-mute-unmute-button`, reads its accessible action (`Unmute` means muted, `Mute` means unmuted) and tracks it independently of `video.muted`. A Twitch UI showing **Unmute** triggers a request via the Twitch control even when the HTML video property already reads false. A success is counted only after a later scan confirms both `UI=unmuted` and `video.muted=false`, instead of counting a direct property assignment. If the mute control is unavailable, diagnostics record `media-unmuted-ui-unknown` rather than claiming success.

The repair runs only on verified managed Stream slots, only after the media is playing, and only for the first **120 seconds** of a document. It adds one light 2200ms interval with no DOM-wide observer or extra browser messages, limiting attempts to 12 per video and at most once per 1.4 seconds. Trusted manual clicks on Twitch's player mute control disable auto-repair for that document, so intentional user mute is respected. `pagehide` cancels all pending timers. This is **best effort**: Chromium/Twitch autoplay rules may still reject a programmatic (untrusted) Twitch mute-button click.

### New/clarified Deep Diagnostics

`playerAudio.currentUiMuteState` (`muted|unmuted|unknown`), `currentUiMuteLabel`, `currentVideoPaused`, `uiUnmuteAttempts`, `uiConfirmedUnmutes`, `lastConfirmedAt`, `manualMuteRespected`, and `scanCount`. `unmuteSuccesses` now means **UI-verified**, not just `video.muted=false`. Compare UI with player media properties and separate tab `.muted` (floating bar). Check UI state AFTER startup and after maintenance reload, not only immediately following click.

## Regression and non-goals

- Extended VM regression tests specifically the false-positive case `video.muted=false` while Twitch UI is `Unmute`, confirms UI transition before incrementing successes, preserves paused-autoplay restraint, later hydration re-mute, unknown-UI fallback, page exclusion, and pagehide behavior.
- No browser/tab unmute toggling on cold start (avoids several seconds of unintended audible output from four streams); browser mute remains per-slot under the floating bar.
- No new extension permissions, DOM mutation observers, Native C# or timing changes to HUD/automation, Native wake/claims, Marbles freshness or 5.5-second cold renderer lease / 1250ms slot staggering.

**Live follow-up:** Verify whether Twitch's own mute icon is finally unmuted and whether `uiConfirmedUnmutes` increases. If it stays `muted` while `uiUnmuteAttempts` rises, the browser may be refusing an untrusted programmatic unmute. Explicitly enabling Twitch Sound permission in Opera GX site settings can be tried as a user-controlled browser setting; do not silently change global site permissions.
