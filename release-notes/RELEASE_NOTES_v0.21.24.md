# Stream Shell v0.21.24 — Mangayomi Host C# Scope Isolation

**Date:** 2026-10-23

## Fix

The v0.21.23 native host source still failed the Windows PowerShell C# compiler: `positioned` was declared inside the `open-result` block and later in the same outer `Main` method. This is a C# scoping error (CS0136), not a Windows permission or Mangayomi runtime issue.

The **entire `open-result` flow has been extracted to a standalone method** rather than continuing to rename individual nested locals. The main handler delegates to it, while the generic `show/search` window positioning is unchanged. The installer still stages the new EXE and installs it only if compilation passes.

## Restore the Native Messaging host

Extract this ZIP over the existing Stream Shell directory, then in a normal PowerShell:

```powershell
cd "C:\Users\sries\Stream Shell"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\integrations\mangayomi\install-mangayomi-helper.ps1"
Test-Path "$env:LOCALAPPDATA\StreamShell\NativeHost\StreamShellMangayomiHost.exe"
```

Do not reinstall or rebuild the Flutter Mangayomi fork for this compiler error. Reload the Stream Shell Opera GX extension after a successful install. If the compiler reports another error, preserve its complete output. CI/source tests are not a substitute for Windows `Add-Type` compilation.
