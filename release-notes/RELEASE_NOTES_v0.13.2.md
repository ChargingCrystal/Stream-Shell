# Stream Shell 0.13.2

## Native Titlebar DPI / Multi-Monitor Hotfix

- Changed the native titlebar helper to derive left/right geometry from the selected monitor rather than absolute Chromium coordinates.
- Made the titlebar DPI/geometry path monitor-relative for mixed-DPI and docked setups.
- Resynchronized the already-running native helper when display/docking geometry changes.

**Native helper:** Reinstall the native titlebar helper.

_Recovered from the original Stream Shell development chats / release messages._
