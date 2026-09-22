# Stream Shell 0.9.44

## Launcher Fix

- Added a named-event warm-start path so an already-running Stream Shell can be restored without a browser handoff tab.
- Pumped the launcher message queue so Explorer/taskbar launch feedback can finish cleanly.
- Changed true cold start to launch Opera directly rather than relying on ShellExecute/DDE behavior.
- Improved right-pane foreground handoff and removed stale old launcher instances during install.

_Recovered from the original Stream Shell development chats / release messages._
