# Stream Shell 0.18.26 — Twitch Popup Bootstrap Geometry + Diagnostics

## Twitch popup bootstrap

- Create every new managed Twitch popup on the real Wide `RIGHT` pane first.
- Park inactive page/workspace popups only after their browser window exists.
- This restores Landing and native-titlebar Twitch actions on Opera GX where direct off-screen popup creation could fail before a Twitch window/runtime mapping was created.

## Diagnostics

- Record Twitch `show-requested`, `show-complete` and `show-failed` events in the Flight Recorder.
- Export Twitch workspace/runtime state in diagnostics schema v10.
- Show a dedicated Twitch diagnostics card with instance count, managed-window count, active window and active surface.

The logical Twitch workspace, one-popup-per-Page-context topology, Floating Bar and compatibility projection remain unchanged.

**Update:** reload the extension only. No native-helper, COBOL-finance or Unified Remote reinstall is required.
