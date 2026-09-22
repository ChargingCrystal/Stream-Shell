# Stream Shell 0.15.0

## Titlebar Hardening

- Introduced explicit trusted HWND claims for Wide and Compact instead of broad implicit ownership.
- Added a 500 ms native foreground safety/reconciliation loop.
- Hid and demoted custom chrome to NOTOPMOST when an external foreground window overlaps the shell area.
- Introduced Native Protocol v2 hello/ack between extension and titlebar host.
- Added roughly 1.5-second heartbeat/reconciliation and a ~6.5-second fail-closed timeout.
- Expanded diagnostics around titlebar trust/claim state.
- Kept Display Auto/Wide/Compact switching behavior unchanged.

**Native helper:** Reinstall the native titlebar helper.

_Recovered from the original Stream Shell development chats / release messages._
