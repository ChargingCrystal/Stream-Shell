# Stream Shell 0.18.0

## Compact Performance and Fullscreen Pass

- Added a default-on YouTube Cleanup option for Playables.
- Made Compact true fullscreen hide the native Stream Shell titlebar/backdrop and restore it on exit.
- Moved the native titlebar protocol to v4.
- Reduced repeated Compact native reconciliation / Alt+Tab presentation work while retaining foreground safety checks.
- Parallelized independent Compact Home media-helper loading.
- Created the remembered warm provider minimized and below the virtual desktop so it no longer flashes maximized during startup.

**Native helper:** Reinstall the native titlebar helper (protocol v4).

**Recovered SHA-256:** `ebc13ff477fd81c11bb11f864789559804a01a1b460f97e3c01d5ef1de9a8ca5`

_Recovered from the original Stream Shell development chats / release messages._
