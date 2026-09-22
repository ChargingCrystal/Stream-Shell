# Stream Shell 0.14.2

## Native Titlebar Hotpath Performance

- Optimized the native titlebar window-enumeration hot path.
- Checked geometry before more expensive process validation and stopped enumeration after the first valid HWND match.
- Preserved mixed-DPI/multi-monitor behavior while removing the titlebar-induced lag.
- Restored Wide responsiveness after the 0.13.2 multi-monitor changes.

_Recovered from the original Stream Shell development chats / release messages._
