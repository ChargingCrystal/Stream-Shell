# Stream Shell v0.20.36 — Twitch Player Audio / Raid Navigation Ownership

> **Historical note:** This release's Twitch in-page player-audio changes were fully rolled back in [v0.20.39](RELEASE_NOTES_v0.20.39.md). The v0.20.36 anti-raid URL snapback removal remains active.

**Date:** 2026-10-21  
**Scope:** Twitch managed slot playback and background anti-raid navigation policy. No Native C# or layout/CSS changes.

## User field report (v0.20.35)

- The user reports a recurring legacy issue: a new or periodically refreshed Twitch stream can become **muted inside Twitch's player UI**. Existing floating-bar mute controls already mute the **browser tab**, but that is independent of the underlying video's `.muted` status. An in-app muted player is undesirable for background Drops playback. The v0.20.35 diagnostic snapshot shows `tab.muted: true` for the stream slots, but **did not capture HTMLMediaElement.muted or Twitch's UI mute state**, so the source and recurrence cannot be established from the snapshot alone.
- Raid guard was still forcing an unwanted return to the channel the user intentionally left. Code inspection confirmed `armTwitchRaidGuard` saved a previous URL in session storage for 45 seconds and `enforceTwitchRaidGuard` used `chrome.tabs.update({url: guard.sourceUrl})` on **any** Twitch channel switch, unable to distinguish a raid from deliberate navigation.
- Background v0.20.35 runtime: 4/4 Twitch slots/Native mappings, zero pending claims, zero observed tab reloads (initial commit only per slot); four automation modules initialized in a single successful attempt each. History batches of 50 messages were rejected in B/C/D. `twitch:resume` ~11.675s, `twitch:raise-workspace` ~6.579s, cold stagger and existing handoff leases remain essential and unchanged.

## Fix 1 — Twitch player audio restoration, without browser tab unmute

`providers/player/twitch-utility.js`, in the existing **early lightweight kernel**, registers a bounded event-based repair when the verified workspace slot is of kind `stream`. It listens to player `play`, `playing`, `loadedmetadata` and `volumechange`, with a startup check after 500ms. If the primary media element is muted or an explicitly labelled Twitch `Unmute` control is found, repair waits until video playback has already started (to avoid blocking Chromium muted-autoplay), then first uses that control when unambiguous and falls back to HTMLMediaElement.muted=false. Any Twitch hydration-induced re-mute may retry, but no more often than every 1.4s, at most eight attempts per media element and within the first 60 seconds of the document. No `MutationObserver`, extra browser IPC, or new windows. Repair timers are canceled on `pagehide`.

The slot's **browser tab mute is never toggled** by this code; the floating bar and existing `audioMuted` state remain the sole owner. Stream Shell does not control Chromium's autoplay policy or guarantee the Twitch player will accept programmatic unmute on all user profiles. Observe the new `twitchRuntime.playerAudio` fields (`currentVideoMuted`, `currentVideoVolume`, `unmuteAttempts`, `unmuteSuccesses`, `lastResult`) in the next live field log.

## Fix 2 — Raid guard must never hijack intentional channel navigation

The raid background 45-second URL rollback has been **removed**. No `enforceTwitchRaidGuard` runs on tab updates; the compatibility message `twitch-arm-raid-guard` safely returns false for pre-existing pages. The deferred Twitch automation keeps the **visible active raid UI cancellation** (clicking 'Leave raid'/'Cancel raid' when an actual raid surface appears) but no longer arms a timer that rewrites the user's browser URL. Session guard data from older versions can be cleared opportunistically by the existing disarm endpoint; it cannot redirect. This consciously favors explicit user channel choice: a Twitch raid with no visible cancel/leave UI may not be stopped, since a generic URL change alone is not evidence of a raid.

## QA / constraints

Required regression `background/tests/twitch-player-audio-raid-navigation.test.js` covers fresh Twitch audio UI, HTMLMediaElement fallback, re-mute on hydration, non-stream exclusions, lifecycle timer cancellation, strict separation from tab-mute policy and no background raid URL rollback. Re-run all offline checks with `node tools/check-project.mjs` and validate PATCH overlay equality before release.

**Unchanged:** Early Twitch CSS marker, lazy HUD and deferred automation, history freshness and Marbles behavior, Native wake/claims, A–D 1.25s stagger, handoff leases, and stream refresh alarm scheduling. No artwork or Native reinstall.
