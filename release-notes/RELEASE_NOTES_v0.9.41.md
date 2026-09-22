# Stream Shell 0.9.41

## Launcher

- Added `StreamShellLauncher.exe` as a Windows-facing Stream Shell entry point.
- Added AppUserModelID/name/icon/relaunch metadata so taskbar/Start-menu activation can launch the shell.
- Used an internal launcher page to trigger the existing `openShellHome()` path and remove the temporary handoff tab.
- Kept the 0.9.40 Alt+Tab ownership model.

_Recovered from the original Stream Shell development chats / release messages._
