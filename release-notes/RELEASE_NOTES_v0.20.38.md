# Stream Shell v0.20.38 — Twitch first-playback audio and autoplay admission

> **Historical note:** This release's Twitch in-page player-audio changes were fully rolled back in [v0.20.39](RELEASE_NOTES_v0.20.39.md). The v0.20.36 anti-raid URL snapback removal remains active.

**Date:** 2026-10-21. Scope: verified managed Twitch stream slots only; no Native helper, tab-mute or playback guard changes.

## v0.20.37 field evidence

User reports initial Twitch player UI **unmuted during black-screen loading**, immediately **muted when the first video frame appears** for directly restored stream URLs. Intra-Twitch page navigation via user interaction does not exhibit the same symptom. The new Twitch UI telemetry now confirms the player fully muted **while playing**:

| Slot | Twitch mute UI at snapshot | HTML video | Unmute attempts | Confirmed successes |
|--|--|--|--:|--:|
| B | Unmute (m) | muted=true, volume=0, paused=false | 11 | 0 |
| C | Unmute (m) | muted=true, volume=0, paused=false | 11 | 0 |
| D | Unmute (m) | muted=true, volume=0, paused=false | 4 | 1 (later remuted) |

All three chromium tabs are independently muted via the Stream Shell Floating Bar. The UI is not merely mislabeled. The repeated synthetic click strategy has failed. The likely contributing cause is the site's first-playback/autoplay fallback: Chromium normally permits silent autoplay but may require domain interaction, engagement or appropriate site/browser policy for audio. `HTMLElement.click()` from extension content script is not guaranteed to satisfy the genuine user gesture requirement. Stored Twitch `video-muted` and `volume` preferences could also be involved; the 0.20.37 JSON did not include them. **Neither hypothesis is yet proven in this Opera GX environment.**

## Controlled change

- On the first `playing` event after managed stream admission record whether video/UI is muted, with the first subsequent mute observation. Keep current status in `playerAudio`.
- Read (do not overwrite) Twitch's localStorage keys `video-muted` and `volume` and expose them in diagnostics, together with `navigator.userActivation` and optional `navigator.getAutoplayPolicy` where supported. Some browser builds may return `unknown`.
- Stop flooding Twitch with ineffective untrusted UI requests: **maximum 2 attempts without user activation per video instance**, versus 12 in 0.20.37. Mark `autoplayBlockSuspected` only as a suspicion, with the exact last result; video remains playing for Drops, browser tab stays muted.
- If a real pointerdown occurs elsewhere on that same managed Twitch page while playing muted, attempt the UI-unmute **synchronously within the trusted event task** and verify on the next scan. An intentional direct Twitch mute-button click is always owned by the user and disables automatic repair for that document.
- The light 2.2s / 120s audit window and pagehide cancellation remain. No Twitch navigation changes, provider switching, early CSS or Lazy-HUD changes; no Chromium/Opera flags, no site permission manipulation, no Native reinstallation.

## Testing and next field check

`background/tests/twitch-first-playback-autoplay-policy.test.js` asserts failed fake unmute does not keep clicking, tests saved preferences/policy diagnostics, simulates genuine user interaction and confirmation, and checks that manual mute and pagehide still prevail. Existing audio and raid regressions remain.

**What to look for in a new Deep Log:** `playerAudio.savedPlayerAudio.videoMuted`, `savedPlayerAudio.volume`, `autoplayPermission.userActivation`, `autoplayPermission.policy`, `firstPlayingAt`, `firstPlayingMuted`, `firstPlayingUiState`, `autoplayBlockSuspected`, `attemptsWithoutActivation`, `trustedRecoveryAttempts`, `currentUiMuteState`, `currentVideoMuted`, `currentVideoVolume`. Capture directly after a fresh cold-start, then optionally after genuine Twitch interaction in a slot. If the browser itself disallows unmuted autoplay, no extension-side synthetic click can guarantee silent headless automatic unmute; a deliberate Opera policy/setting test is required rather than disrupting Drops playback.
