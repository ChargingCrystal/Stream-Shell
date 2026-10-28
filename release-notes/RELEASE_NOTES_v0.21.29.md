# Stream Shell 0.21.29 — Performance black box

An intermittent hang after 1–4 hours is difficult to reproduce using manual Diagnostics.
This update records only conspicuous latency incidents, and keeps a compact
append-only log between sessions.

- File: `%LOCALAPPDATA%\StreamShell\Logs\performance-YYYY-MM-DD.jsonl`
- Events: `native-start`, `renderer-timer-gap` (>= 2 s), `renderer-long-task`
  (>= 350 ms, if Chromium supports it), `background-timer-gap` (>= 2 s),
  `native-overlay-stall` (>= 2 s), `native-heartbeat-gap` (>= 30 s).
- Logging in local time-sliced JSONL with UTC timestamps. 4 MiB file rotation;
  keep 14 days, cleaned on helper startup. No page URLs, titles, content or tokens.
- Fallback: 240 incidents in extension `chrome.storage.local` if native unavailable.
- In Dashboard Diagnostics the Environment and event timeline point to the log location.

## Update steps

1. Overlay this ZIP onto the existing extension, without touching local backgrounds.
2. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\tests\compile-titlebar-host.ps1`
   to verify C# compilation before installing anything.
3. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\install-titlebar-helper.ps1`
   (existing installer updates the native titlebar executable and manifest).
4. Reload the Stream Shell extension in `opera://extensions`. Launch Stream Shell.
5. After a stall or several hours, open `%LOCALAPPDATA%\StreamShell\Logs`.

The Windows C# compile and actual Opera GX runtime must be verified on Windows.
A missed callback or heartbeat may also reflect Windows sleep/background throttling;
this log identifies timing and component, not necessarily the underlying cause.
