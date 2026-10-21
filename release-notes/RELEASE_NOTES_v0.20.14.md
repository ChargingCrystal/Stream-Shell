# Stream Shell v0.20.14 — Native Resilience & C# Code Care

## Purpose
Structural reliability pass of the native Windows titlebar helper, based on v0.20.13. No browser-side event path, renderer start guard, window geometry, Twitch stagger or dashboard UI was changed.

## Native fixes

- All Win32 callbacks are contained by a top-level managed exception boundary. Overlay reconciliation, focus and input handling also have targeted error handling; a single recoverable exception should not terminate the entire host process.
- The native messaging reader isolates each decoded command: a failing handler logs an error and sends `native-command-error` rather than silently terminating the reader.
- Replaced indefinite cross-process `SendMessage` (WM_GETICON/WM_SETICON) and `SetWindowText` requests with `SendMessageTimeoutW`, using 350 ms max per operation.
- When an unrelated fullscreen window covers both configured Wide panes and no claims are pending, the native host hides its own overlays and skips heavy ongoing Taskbar/Alt-Tab checks. As soon as the foreign window is no longer the foreground covering both panes, normal reconciliation resumes. Compact and split-pane scenarios keep their previous behavior.
- Native message routing, button action routing and provider labels use focused switch statements without modifying the action set.
- Runtime health counters are held in an instance-owned `NativeRuntimeHealth` type; they are exposed via native status (`callbackFailures`, `commandFailures`, `fullscreenIdleSkips`, `slowOverlaySyncs`), where available in Deep diagnostics.

## Installer safety

- Windows installer compiles `StreamShellTitlebarHost.next.exe` first; it no longer deletes/stops the known-good host before validating C# compilation.
- On successful compilation, it replaces the old binary and retains `StreamShellTitlebarHost.backup.exe`; failed replacement restores the old binary.
- Installer and JS test source reader recognize 19 native module files.

## Non-goals and risk

- There is no automatic Chromium/Opera renderer un-parking here. Browser-side renderer suspension, OOMs, extension worker pauses or GPU driver stalls cannot be repaired by exception handling inside a separate C# process.
- The existing singleton C# host still has static process-wide Win32/claim state because its WndProc, native reader and native control bridge share a single lifetime. Converting all of that state to instances without Windows compilation/long-run testing would be a risky unrelated rewrite. Health state has been encapsulated separately.
- The Windows PowerShell Add-Type compilation and real Opera GX/WuWa long-run test could not be performed in the Linux build environment. Keep v0.20.13 as rollback during the next smoke test.

## Validation

- 21 Node JavaScript regression test files passed.
- Native structural/source contract tests verify 234 carried-over method names, C# module completeness, bounded Opera messaging and key protocol-v9 branches.
- C# source lexical delimiter scan completed and the installer compile-before-stop ordering was verified.

## Suggested smoke test

1. Run `native/install-titlebar-helper.cmd` and verify success (especially the new compiler path).
2. Reload the extension; verify the Titlebar and native protocol v9 in Diagnostics.
3. Check Twitch A–D, Discord switch, Alt-Tab, Taskbar identity and fullscreen returns.
4. Reproduce the long WuWa background test, then open Deep diagnostics and inspect the four new native health fields.
