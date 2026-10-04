# Stream Shell 0.19.10 — Twitch Workspace HUD & Pane Fullscreen

- Every populated Twitch slot now owns a compact draggable four-dot HUD. Click the launcher to expand/collapse; drag it in either state to move the controls, with position persisted per slot.
- Expanded controls are local to the current slot: mode, mute/unmute, reload, pane fullscreen, Edit and clear.
- Reload affects only the current Twitch tab.
- Pane fullscreen expands one existing Twitch popup across the full right Stream Shell pane while preserving the other three windows underneath and restores the calibrated 2×2 geometry on exit.
- A Stream slot temporarily renders the normal Twitch Page interface while pane-fullscreen is active, then automatically returns to Stream cleanup on exit. Page slots are unchanged.
- Native fullscreen geometry hides the Opera caption outside the pane instead of using browser F11.
- v6 workspace state migrates to v7 in place without recreating slot windows.

**Update:** reload the extension and re-run `native\install-titlebar-helper.cmd`. Unified Remote does not need reinstalling.
