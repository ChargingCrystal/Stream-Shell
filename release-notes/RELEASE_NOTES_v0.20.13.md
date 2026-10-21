# Stream Shell v0.20.13 — Native Titlebar Source Split

**Change scope:** source structure + native installer. v0.20.12 behavior remains the exact baseline.

- 1 core file, `native/StreamShellTitlebarHost.cs`, for all native constants/state/data definitions/Win32/COM interop.
- 18 ordered and named partial-class modules in `native/titlebar-src/`, covering startup, toolbars, twitch/z-order, claim/rebind, visibility, overlays, Taskbar/Alt-Tab, geometry, native IPC, control bridge and diagnostics.
- The PowerShell installer concatenates valid partial-class definitions into a single compilation input, keeping the prior Add-Type compiler/reference/output configuration.
- **No C# method bodies, field initializers, native protocol messages or timing values were modified.** The parity test reconstructs the exact original v0.20.12 C# file by SHA-256.

## Installation

1. Overlay the PATCH on v0.20.12, or install the FULL archive.
2. Execute `native/install-titlebar-helper.cmd` to rebuild the Windows executable from the new source layout.
3. Reload Stream Shell in `opera://extensions`.

Backgrounds and custom artwork are not part of the archives. This environment has no Windows PowerShell/.NET Framework toolchain to run a live C# compilation; the real installer and native HWND behavior still need tomorrow's Windows smoke test.
