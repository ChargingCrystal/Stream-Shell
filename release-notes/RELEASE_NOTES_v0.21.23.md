# Stream Shell v0.21.23 — Mangayomi Native Host C# Compile Fix

**Date:** 2026-10-23

## Fixed

PowerShell `Add-Type` could not compile `StreamShellMangayomiHost.cs` because the new `open-result` branch declared `left`, `top`, `width` and `height` inside a nested scope, while the general window-positioning code declared the same names later in the enclosing `Main` scope. The classic C# compiler reports this as a conflicting local declaration. The `open-result` variables now use `resultLeft`, `resultTop`, `resultWidth` and `resultHeight`.

The staged installer from v0.21.22 is retained: it builds to a temporary EXE and does not replace a working installed helper unless compilation succeeds. The fix does not require recompiling the Mangayomi Flutter fork, changing the stored EXE path, or altering Opera settings.

## Recover the missing native host

1. Extract this release over your Stream Shell source directory.
2. In a **normal**, non-admin PowerShell:

```powershell
cd "C:\Users\sries\Stream Shell"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\integrations\mangayomi\install-mangayomi-helper.ps1"
Test-Path "$env:LOCALAPPDATA\StreamShell\NativeHost\StreamShellMangayomiHost.exe"
```

The last command should return `True`. Reload the Stream Shell extension in `opera://extensions`, then test the Mangayomi magnifier again. Windows C# compilation and Opera Native Messaging must still be validated on the target PC.

The previously failed Windows Flutter rebuild (locked `WebView2Loader.dll`) is separate: close the patched Mangayomi process before building again if exact result navigation still requires the updated fork.
