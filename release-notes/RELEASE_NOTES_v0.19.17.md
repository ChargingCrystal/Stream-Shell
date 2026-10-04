# Stream Shell 0.19.17 — Twitch Long-Session Maintenance

This build targets long-running Twitch Workspace sessions without changing the established 0.19.12 pane-fullscreen geometry.

## Changes

- Marbles Auto-Join gets a fresh 5-second chat hydration grace period whenever the channel changes.
- Twitch automation fallback scans move from 5 s to 30 s; relevant DOM mutations still trigger immediate work.
- Covered playback uses event-driven resume plus a 15 s safety watchdog instead of a 1.25 s continuous poll.
- The Twitch Workspace no longer polls `location.href` every 500 ms; browser navigation events keep slot state synchronized.
- Twitch storage listeners now ignore unrelated local-storage writes.
- Background tab-update handling skips title/favicon/audible-only updates.
- Titlebar heartbeat remains safely below the native 6.5 s timeout, while periodic claim self-healing runs only every 10 s.
- Native overlay drift auditing moves from 500 ms to 1 s; explicit sync events remain immediate.
- Stream slots are maintenance-reloaded every ~60 minutes, staggered by slot. Focused or pane-fullscreen slots defer the reload by 10 minutes. Page/Drops slots are not auto-reloaded.

## Installation note

The native titlebar helper changed in this build, so reinstall/update the native helper after updating the extension.
