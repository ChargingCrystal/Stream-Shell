# Stream Shell v0.20.39 — Twitch Player Audio Rollback / Raid Guard Preserved

**Date:** 2026-10-21. **Intent:** Remove the three-version Twitch in-page audio experiment entirely, not add another speculative workaround.

## User decision and reason

The automatic restoration of Twitch Stream URLs still produced Twitch-player mute during first playback even when Twitch saved `video-muted={"default":false,"carousel":false}` and volume `0.59`. The v0.20.38 field log confirmed every B/C/D stream began `playing` muted; unmute/gesture attempts were either ineffective or only later successful. The user explicitly **accepts this Twitch/Opera cold-start quirk** and requests a rollback instead of continued debugging. The v0.20.36 Raid Guard removal of involuntary old-channel URL snapback is confirmed useful and must remain.

## Exact rollback scope

- Restore `providers/player/twitch-utility.js` from the complete v0.20.35 baseline, **exact byte equality verified**. This removes Twitch UI Unmute button auto-clicks, direct `video.muted` changes, first-playback event probes, trusted-pointer audio recovery, 60/120-second retry windows, 2.2s audits, `localStorage` mute/volume probes, Autoplay/Activation telemetry, player-audio counters and listeners/intervals, and their pagehide cleanup. Preserve the existing covered-workspace playback watchdog, Native compositor wake, early CSS admission marker, interaction/navigation handlers and lazy automation admission because they were already present in v0.20.35.
- No changes to Twitch per-slot `audioMuted`/floating-bar/Chromium `tab.muted` behavior. In this project, **tab auto-mute is not the same as in-page Twitch player auto-unmute** and is not being rolled back. Keep all existing settings keys and persistent slots.
- Keep exactly v0.20.36+ raid behavior from `providers/player/twitch-automation.js` and `background/src/05a-twitch.js`: only explicit, visible Raid UI cancellation; `armTwitchRaidGuard()` compatibility no-op; no `enforceTwitchRaidGuard()` and no forced `chrome.tabs.update({url:previousChannel})` after normal navigation. Actual raiding without a visible cancel surface is not claimed to be prevented.
- Preserve v0.20.35 concurrent Twitch alarm startup, 0.20.34 early CSS, 0.20.32 Marbles replay guard, native protocol/window claims, all handoff delays and 1250ms popup staggering.

## Regression / packaging

Replace both test implementations while keeping filenames for overwrite-PATCH compatibility: `background/tests/twitch-player-audio-raid-navigation.test.js` asserts the absence of the removed player-audio behavior and tests managed-stream startup, plus raid UI-only and zero snapback. `background/tests/twitch-first-playback-autoplay-policy.test.js` now asserts **no autoplay policy recovery** and preserved Chromium-tab mute ownership. Both remain required by `tools/check-project.mjs`.

Full offline gate: `node tools/check-project.mjs`. PATCH and FULL archives include current source, generated background bundle, docs/tests; no personal backgrounds or artwork. Native C# untouched, no reinstall. Historical release notes v0.20.36–v0.20.38 are retained but their audio implementation is superseded here.
