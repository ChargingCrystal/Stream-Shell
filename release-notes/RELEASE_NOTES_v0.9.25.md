# Stream Shell 0.9.25

## Titlebar Paint Fix

- Fixed the native titlebar paint path after the overlay could appear as a Windows busy-cursor rectangle and stall before its first successful paint.
- Corrected the Win32 imports for `SetBkMode()` and `SetTextColor()` from `user32.dll` to the correct `gdi32.dll`.
- Assigned the overlay class an explicit normal Windows arrow cursor.
- Removed synchronous `UpdateWindow()` calls so painting proceeds through the normal Windows message queue instead of forcing a blocking paint.
- Added paint-exception logging to `titlebar.log` so render failures no longer silently break the WindowProc.
- Moved the `overlay show:` log point before the actual paint so visibility transitions remain observable even if rendering fails.
- Changed only `native/StreamShellTitlebarHost.cs` and `manifest.json` from 0.9.24.

**Native helper:** Reinstall `native\install-titlebar-helper.cmd`, then fully close Stream Shell, reload the extension and reopen it.

_Recovered from the original Stream Shell development chat / release message._
