# Stream Shell 0.9.26

## Titlebar Ownership Fix

- Stopped the Native Helper from deciding Stream Shell ownership purely from Opera window geometry.
- Made the extension explicitly tell the helper whether the active surface is `shell`, `discord` or `none`.
- Removed the titlebar from normal Opera windows by relying on extension-confirmed Stream Shell ownership.
- Reduced Discord-side chrome to a compact Dashboard button instead of keeping the full right-side bar over Discord.
- Changed Dashboard restoration so the extension restores the Dashboard and the Native Helper performs the final foreground handoff.
- Removed the previous repeated ~180 ms TOPMOST reassertion that could keep the Windows auto-hide taskbar awake.
- Reduced the native polling loop to roughly 500 ms and only repositions the bar when geometry/state actually changes.
- Explicitly demotes the overlay out of the TOPMOST layer when hidden.
- Changed `background.js`, `native/StreamShellTitlebarHost.cs` and `manifest.json`.

**Native helper:** Reinstall `native\install-titlebar-helper.cmd`, then fully close Stream Shell, reload the extension and reopen it.

_Recovered from the original Stream Shell development chat / release message._
