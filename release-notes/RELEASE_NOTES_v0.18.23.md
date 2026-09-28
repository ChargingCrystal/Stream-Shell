# Stream Shell 0.18.23

## Twitch Workspace Phase 2 + Floating Bar Revival

- Added the visible Twitch Workspace floating control bar to managed Twitch tabs. The bar is draggable and keeps its position across page switches.
- Added unified chips for Multi View, full Page instances and Stream instances plus an add panel for channel names/Twitch URLs.
- Added a dedicated Twitch-origin workspace host and simultaneous official Twitch player embeds with Single, Split, Grid and Focus layouts.
- Stream chips open/focus the Multi View; page chips activate their reusable real Twitch tab, preserving normal login/cookies and Twitch page behavior.
- Added main-stream selection, stream reload/close and close controls for non-pinned page instances.
- Hardened workspace-host recovery so it cannot be mistaken for a normal page instance after reload/restart.
- Preserved the existing Twitch/Drops controls, `rightMode=twitch`, native titlebar and Unified Remote behavior.
- Chat switching and final per-stream audio ownership are intentionally left for the next phase.

**Update:** reload the extension. No native-helper, COBOL-finance or Unified Remote reinstall is required.
