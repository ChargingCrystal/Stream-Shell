# Stream Shell 0.14.10

## Compact Z-Order Reassert

- Added an actual Z-order relationship check instead of treating `IsWindowVisible()` as proof that the titlebar is above the shell.
- Reasserted `HWND_TOP` only when the active Compact titlebar has fallen behind the current Stream Shell HWND.
- Added foreground-root protection so the repair does not promote Stream Shell chrome over unrelated applications.
- Avoided permanent TOPMOST and avoided unconditional 500 ms `SetWindowPos` churn.

_Recovered from the original Stream Shell development chats / release messages._
