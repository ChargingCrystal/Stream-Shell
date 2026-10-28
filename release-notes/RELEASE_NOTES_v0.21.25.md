# Stream Shell v0.21.25 — Mangayomi automatic background startup

**Date:** 2026-10-23

## Fixed

The previous Native Messaging helper waited only seven seconds for a **visible** Mangayomi Win32 window before trying to search. That made a normal click fail when the configured fork was not already open. A leftover `mangayomi-bridge.json` could also mislead detection after Mangayomi had exited.

The new `lookup` branch starts the **configured patched EXE** automatically (minimized), waits for its local search bridge to initialize, validates that the bridge descriptor belongs to the same live PID, and returns real extension results in Stream Shell's left panel. It does not use the native app's visible window or URI scheme as a prerequisite, and hides a newly started app afterward. A result selection is still the action that brings Mangayomi into view. Shift-click remains a direct switch to Mangayomi.

## Install

1. Extract over the existing Stream Shell folder, keeping local backgrounds.
2. In normal PowerShell, run:

```powershell
cd "C:\Users\sries\Stream Shell"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\integrations\mangayomi\tests\compile-mangayomi-host.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\integrations\mangayomi\install-mangayomi-helper.ps1"
```

3. Reload the Stream Shell Opera GX extension and normal-click the Mangayomi magnifier **without launching Mangayomi manually**.

Only the C# helper and extension change. A new Flutter build is not required for lookup, assuming the previously built patched EXE supports `/v1/search`. The earlier v0.21.20 `/v1/open` direct detail navigation still requires a successful updated Flutter fork build.

## Verification

JS regressions and bundle parity can run offline. Windows PowerShell `Add-Type` compilation and the actual cold-start app/bridge handshake require the target Windows machine; neither is claimed as already tested.
