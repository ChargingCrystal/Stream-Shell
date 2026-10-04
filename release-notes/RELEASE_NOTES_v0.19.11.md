# Stream Shell 0.19.11 — Twitch Pane Fullscreen Restore & HUD Position Repair

- Fixed a Twitch slot not returning cleanly to its calibrated 2×2 geometry after leaving right-pane fullscreen. The restore path now performs one bounded geometry verification/repair instead of assuming Opera accepted the first transition.
- Re-announces the restored Twitch member and repairs cluster order after fullscreen exit, keeping the surviving HWND instead of recreating or reloading the Twitch document.
- Native helper now rebuilds the right-side Twitch chrome ownership after pane fullscreen so A/B do not remain exposed with Opera's stock browser titlebar after returning to the grid.
- Split draggable HUD positions into per-slot **Grid** and **Pane Fullscreen** positions. Dragging a HUD into the far side of the 1920px fullscreen pane no longer overwrites its reachable 960px-grid position.
- Added repeated viewport-settle clamping around the deliberate fullscreen resize and persists the final reachable HUD position only after the viewport has stabilized.
- Clears stale HUD drag state across rerenders, focus loss and native geometry transitions to avoid a detached launcher leaving the replacement HUD intermittently unresponsive.
- No Twitch URL, Stream/Page mode, mute state or playback state is reset by the fix.

**Native helper:** Re-run `native\install-titlebar-helper.cmd` after updating.
