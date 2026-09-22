# Stream Shell 0.14.12

## Compact Foreground Authority

- Returned Compact chrome to TOPMOST positioning like Wide, but made native Win32 foreground state authoritative for whether it is shown.
- Prevented stale Chromium `visibilityMode=none` messages from evicting a still-known Compact shell HWND.
- When focus leaves Stream Shell, hides/demotes the Compact chrome through NOTOPMOST rather than leaving it over other apps.
- Kept the existing claim/grouping architecture.

_Recovered from the original Stream Shell development chats / release messages._
