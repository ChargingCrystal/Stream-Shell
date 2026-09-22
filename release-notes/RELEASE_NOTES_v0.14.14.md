# Stream Shell 0.14.14

## Native Installer Hardening

- Resolved the extension ID before elevation.
- Made the elevated install stage synchronous (`-Wait`) so success/failure cannot disappear behind the calling shell.
- Kept the installer/error window available long enough to read failures and strengthened persistent logging.
- Made no native titlebar logic change.

_Recovered from the original Stream Shell development chats / release messages._
