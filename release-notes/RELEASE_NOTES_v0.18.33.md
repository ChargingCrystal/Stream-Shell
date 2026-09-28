# Stream Shell 0.18.33

## Warm Provider Geometry Repair

- Fixed the remembered warm provider restoring as a full 32:9 Opera window instead of the Wide LEFT pane.
- Warm providers now start at the same LEFT-pane geometry as normal provider windows and are then minimized; off-screen parking is no longer used for this path.
- Added bounded verification/retry of restored window bounds before focus and native titlebar claiming.
- Repairs stale/off-screen remembered-provider geometry in place during warm-up while preserving the already-loaded provider tab/session.
- Twitch remains on the clean 0.18.32 single-window hard-reset implementation.

**Update:** extension reload only. No native-helper, Unified Remote or COBOL-finance reinstall is required.
