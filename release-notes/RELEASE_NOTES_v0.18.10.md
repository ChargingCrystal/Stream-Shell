# Stream Shell 0.18.10

## Unified Remote Action Surface

- Completed the Unified Remote action bridge for Home, Dashboard, Settings, all providers, Reload, Volume Boost, Discord, Twitch and Kill.
- Added `StreamShellTitlebarHost.exe --status` for lightweight local bridge state (`layout`, `left`, `right`, Settings, Volume Boost and fullscreen state).
- Added Compact-aware external-action gating: Discord, Twitch and Twitch Drops remain Wide-only instead of pretending to work in Compact.
- Added a distinct `twitch-drops` action that opens the Drops Inventory in the existing managed Twitch window; the retired separate Drops worker remains retired.

