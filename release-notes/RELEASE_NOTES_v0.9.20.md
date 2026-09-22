# Stream Shell 0.9.20

## Titlebar Installer Fix

- Hardened native-titlebar installation and bootstrap logging.
- Created the TitlebarHost/logging path before elevation so failures were actually visible.
- Read the extension ID from the existing native-manifest information instead of relying on brittle manual state.
- Added compile/registry/install diagnostics.

_Recovered from the original Stream Shell development chats / release messages._
