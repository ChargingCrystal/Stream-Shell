# Stream Shell 0.19.9 — Twitch Stream Chrome Cleanup

## Changed

- Stream-mode Twitch slots now hide only Twitch's global top navigation and left navigation sidebar.
- Twitch chat, channel information, stream actions and lower channel content remain available.
- Removed the previous forced full-viewport player sizing and automatic theatre-mode activation.
- Page-mode slots remain untouched.
- Reclaims the top-navigation strip through a minimal app-shell offset adjustment without resizing or recreating workspace windows.

## Unchanged

- Four-slot 2×2 Workspace geometry
- Persistent covered playback
- Per-slot mute/unmute state
- Drops/channel-points utility logic
- Compositor wake handling
- Native helper protocol

No native helper or Unified Remote reinstall is required for this release.
