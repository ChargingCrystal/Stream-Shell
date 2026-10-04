# Stream Shell 0.19.12 — Twitch Pane Fullscreen Browser-Geometry Repair

- Pane fullscreen and grid restore geometry are now owned exclusively by Chromium. The native titlebar helper tracks fullscreen z-order only and no longer repositions/resizes the Opera HWND behind Chromium's back.
- Fixes the caption-height visual/input offset seen after pane-fullscreen transitions.
- Fixes Page-mode slots returning as a permanently black compositor surface while the underlying Twitch document continues running.
- Native Twitch claims expose the measured Opera titlebar height so browser-owned fullscreen overscan can hide the caption without hard-coding the local chrome size.
- Fullscreen exit restores the grid bounds before releasing native fullscreen ownership, then reclaims the member and wakes its compositor in bounded passes.
- Preserves the existing Stream/Page behavior, per-slot HUD Grid/Fullscreen positions, audio state and persistent playback.

**Native helper:** Re-run `native\install-titlebar-helper.cmd` after updating.
