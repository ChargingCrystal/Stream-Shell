BACKGROUND SOURCE SPLIT
=======================

Runtime rule
------------
manifest.json loads only ../background.js. The files in src/ are editing sources and are concatenated byte-for-byte by build-background.ps1.
Do not add individual src files to manifest.json unless intentionally changing runtime semantics.

Build order
-----------
- ../shared/resume-utils.js       shared Continue Watching URL canonicalization, media identity + stale-link reconstruction fallback
- 00-config-home.js               constants, service-worker state, action click handler and shell-home orchestration
- 00a-flight-recorder.js          session-scoped Diagnostics event ringbuffer
- 00b-display-profile.js          32:9 / 16:10 detection, Auto/Wide/Compact state and target-display legacy pane geometry
- 01-window-utils.js              generic restore/minimize/remove helpers
- 02-providers.js                 provider-window persistence, creation, switching and muting
- 03-landing-window.js            Landing window lifecycle, focus and reload logic
- 04-dashboard-window.js          Dashboard window lifecycle and focus logic
- 05-discord.js                   Discord native host show/status integration
- 06-titlebar.js                  titlebar native host connection, state and native messages
- 06a-volume-capture.js           tabCapture/offscreen volume routing and titlebar command bridge
- 06b-crunchyroll-skip-events.js  Crunchyroll public skip-timing fetch helper
- 06c-sleep-timer.js              persistent sleep-timer alarms and provider pause/dashboard actions
- 07-shutdown.js                  Stream Shell shutdown/kill orchestration
- 08-subscriptions.js             subscription scraping, Prime verification and sync pipeline
- 09-message-helpers.js           sender guards, MAIN-world YouTube quality helper and active-provider/full-export Diagnostics collection
- 09-message-router.js            chrome.runtime message routing
- 10-window-visibility.js         window geometry, foreground bounds and Landing exposure checks
- 10a-resource-governor.js        provider window minimized/focused/active state for content-side workload throttling
- 11-playback-state-events.js     playback reconciliation, state broadcast and Chrome window listeners
- 12-direct-links.js              direct-link context menu, storage handoff and regular-browser opening
- 12a-stale-link-resolver.js      adapter-first reconstruction of persisted provider media links before Continue resume
- 13-self-test.js                 lightweight launch checks plus lazy provider API self-test reports
- 14-repair.js                    targeted background-side Repair dispatch/escalation

After editing, run build-background.ps1 and reload the extension.
The source split intentionally changes no runtime behavior.

0.12.0 moved the helper/Diagnostics prelude out of the already-large message router while retaining one background.js service-worker runtime.

Continue Watching URL/identity rules and deterministic stale-link fallback reconstruction are shared with the content-script Provider API via shared/resume-utils.js. The live dedicated adapter is still preferred when resolving a persisted link.

0.12.1 Diagnostics performance pass
----------------------------------
Dashboard panel snapshots collect full content diagnostics only from the active provider; inactive providers keep cheap window/tab metadata and use cached self-test reports in the Dashboard. Explicit JSON export still requests all provider content snapshots. Panel Flight Recorder payloads are limited to the 60 visible events while retaining total/max counts; full export keeps the complete ringbuffer.

0.13.x display profiles
-----------------------
0.13.0 added display profile state via chrome.system.display. Auto prefers a 32:9 display when present, otherwise the 16:10 target; manual Wide/Compact overrides are stored globally.

0.13.1 anchors legacy window geometry to the selected display's real virtual-desktop bounds before shell windows are created/restored. Wide splits the selected 32:9 display into two panes. Compact remains pre-host but temporarily fits the same two-pane semantics inside the 16:10 work area so the laptop profile can be tested without windows spilling across displays.

0.13.2 native titlebar geometry sync
------------------------------------
Titlebar state messages now carry the current LEFT/RIGHT pane geometry and include it in the state de-duplication key. Reopening the shell after a display-profile change therefore re-synchronizes an already-connected native helper instead of leaving it on stale pre-dock coordinates. The native host separately matches HWNDs by monitor-relative geometry to bridge Chromium logical coordinates and Win32 Per-Monitor-DPI coordinates.

0.14.0 Compact single-surface host
---------------------------------
Compact no longer uses the temporary 50/50 staging split. LEFT and RIGHT resolve to the same full 16:10 work area; Dashboard is Compact Shell Home and provider windows are swapped onto that same surface. Landing remains Wide-only. State broadcasts include layoutProfile so Dashboard and the native titlebar can select the correct host/navigation model.
