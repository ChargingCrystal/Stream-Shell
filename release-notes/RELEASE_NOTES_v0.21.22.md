# Stream Shell v0.21.22 — Mangayomi Native Host Recovery

**Date:** 2026-10-23

Fixes a Mangayomi Native Messaging installation failure found after updating to 0.21.21. The installer previously deleted the host EXE **before** compiling the new version. If compilation failed, the registry and JSON manifest still existed but referenced a missing file, yielding `Specified native messaging host not found`.

## Changes
- Compile the native host to a unique temporary output and verify the binary **before** replacing the installed EXE.
- Preserve the old executable on compilation failure and restore it on failed replacement.
- Verify the native host EXE and HKCU registration on completion; make failures visible in the terminal.
- Use HKCU installation without administrator elevation; preserve the current registered Opera extension ID unless explicitly overridden.
- No Flutter rebuild needed to repair the missing native host. Browser JS, Watchlist, Settings, Diagnostics and background assets unchanged.

## Recovery
From a normal PowerShell window:

```powershell
cd "C:\Users\sries\Stream Shell"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\integrations\mangayomi\install-mangayomi-helper.ps1"
Test-Path "$env:LOCALAPPDATA\StreamShell\NativeHost\StreamShellMangayomiHost.exe"
```

If the script fails, keep the complete PowerShell error output. If the EXE disappears **after** a successful install, inspect Windows Security > Protection history for a blocked/quarantined generated executable. Verify the Extension ID shown by the installer against `opera://extensions`.

If the latest Mangayomi fork build also failed with a WebView2Loader.dll lock, close the patched Mangayomi executable first and rerun `build-patched-mangayomi.ps1` separately; this is independent of the Native Messaging host registration.
