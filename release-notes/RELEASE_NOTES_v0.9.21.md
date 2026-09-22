# Stream Shell 0.9.21

## Titlebar Bootstrap Fix

- Moved critical bootstrap setup into the CMD stage so the TitlebarHost/log path exists before PowerShell/UAC work.
- Bypassed local PowerShell execution-policy friction for the installer.
- Focused this build on getting the native host to start deterministically rather than changing titlebar behavior.

_Recovered from the original Stream Shell development chats / release messages._
