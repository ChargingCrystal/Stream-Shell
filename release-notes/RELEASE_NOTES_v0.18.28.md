# Stream Shell 0.18.28

## Twitch Workspace Stabilization

- Keeps inactive Twitch surfaces warm on the real RIGHT pane instead of repeatedly parking/restoring them off-screen.
- Avoids parking newly created Twitch pages while they are still loading, reducing Opera GX black-surface failures.
- Makes Twitch active-window writes idempotent and removes session-runtime-driven floating-bar refresh storms.
- Uses lightweight UI snapshots; full Twitch runtime reconciliation is now diagnostics-only.
- Makes floating-bar visibility focus-authoritative so only the focused Twitch window renders the controls.
- Applies Multi View geometry only when it actually changed and avoids repeated cluster claim scheduling.
- Preserves browser-level mute and the native v5 cluster helper introduced in 0.18.27.

**Update:** reload the extension. The native helper does not need to be reinstalled.
