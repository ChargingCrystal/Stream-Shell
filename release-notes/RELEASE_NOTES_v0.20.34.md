# Stream Shell v0.20.34 — Twitch Startup Reflow / Reload Audit

**Date:** 2026-10-21  
**Scope:** Twitch content presentation and diagnostics only. No Native C# changes, no popup pacing or renderer handoff changes.

## Motivation / field evidence

The user's Opera GX v0.20.33 cold-start run survived YouTube → Twitch with four confirmed native slot claims, four successful lazy automation loads (`loadAttempts: 1`, no errors), 147 ignored historical chat lines, and empty transition queue. But more visible Twitch 'reloads' have been reported since the lazy split. The capture has only the **current document** per slot (`navigationType: navigate`), so it cannot prove whether a prior full reload occurred. No `maintenance-reload` Flight Recorder event appeared in this capture. Avoid treating UI reflow and browser reload as synonyms.

## Changed

- **Early passive Stream CSS:** `providers/player/twitch-stream-cleanup.css` is delivered by the existing Twitch kernel's manifest entry at `document_start`. Its selectors are gated by `html[data-stream-shell-twitch-workspace-clean="true"]`, so ordinary unmanaged Twitch pages remain unaffected. The small kernel sets the marker as soon as the managed slot's Stream kind is confirmed. Previously the separate, delayed HUD installed and applied this CSS after Twitch had painted, which could make the full header/sidebar visibly appear and disappear.
- **HUD remains lazy:** `twitch-workspace-v2.js` no longer creates/writes a separate cleanup stylesheet. It refines/removes the marker based on auto/offline Stream surface detection and fullscreen Page mode. Auto Stream status is held steady through a bounded 14-second initial Twitch SPA hydration period before treating an absent live badge as an offline Page; a follow-up check runs at the boundary. The HUD's separate shadow-root styling is unchanged.
- **Top-frame navigation audit:** `background/src/05aa-twitch-workspace-v2.js` registers passive `chrome.webNavigation.onCommitted` tracking for Twitch main-frame documents. New `navigationAudit` per slot in Deep Diagnostics reports `tracked`, `trackingSince`, `observedCommits`, `observedReloads`, `clientRedirects`, `lastTransitionType`, and timestamps. Confirmed `transitionType=reload` emits a `twitch-workspace-v2/document-reloaded` Flight Recorder event. Map is bounded to 64 tab IDs. MV3 worker restarts reset the tracking horizon (counters only include observed commits, not lifetime claims).
- **No timing churn:** Existing A–D popup interval, handoff leases, Native wake/claims, Marbles history quarantine, automation splitting and lazy HUD are untouched.

## Validation / limitations

- Mandatory VM test `background/tests/twitch-startup-reflow-and-navigation-audit.test.js` verifies CSS gating/ownership, real navigation vs subframes/non-Twitch pages, reload classification, redirect classification, and bounded state.
- Existing staged Twitch VM test verifies the kernel sets the Stream cleanup marker before loading the heavy automation.
- The offline suite proves source/contract behavior, not live Twitch SPA paint or actual Opera GX reload semantics. Compare the next field log's per-slot `navigationAudit` with the user's visible reloads. If all show `observedReloads: 0` while the visual reset persists, prioritize SPA/compositor reflow, not browser tab reload commands.
- All local custom backgrounds and user-supplied icons remain excluded from releases.
