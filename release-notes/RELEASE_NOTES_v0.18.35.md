# Stream Shell 0.18.35 — Twitch Split Managed-Automation Probe

This is the second isolated Twitch split experiment after 0.18.34 proved that two real Opera Twitch popups can render inside the Wide RIGHT pane when they are created directly at their final geometry.

## What changed

- Both split-lab windows are now accepted as managed Twitch automation windows.
- Existing Twitch utility automation may therefore initialize in each split context, including channel-points/Drops scanning and raid-guard participation.
- The split windows still do **not** use `twitchWindowId`, native titlebar claims, native cluster ownership, parking, restore passes or post-creation resize.
- Diagnostics now report `automationManaged` and `automationMarker` for each split window. The marker reflects the Twitch content script's `data-stream-shell-twitch` root flag.
- Normal `▦` opens Resume/Home + Drops; Shift+`▦` opens `gronkhtv` + `rainbow6`.

## Test goal

If both windows continue rendering with `automationManaged: true` and `automationMarker: true`, the old black-surface failure is not caused by Twitch's ordinary Stream Shell content automation. The next isolated layer can then be native/window identity.

## Update

Reload the extension only. No native helper, Unified Remote or COBOL finance reinstall is required.
