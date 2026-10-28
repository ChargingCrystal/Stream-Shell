# Mangayomi desktop integration (Stream Shell 0.22.1)

Mangayomi remains a **separate Windows Flutter application**. Stream Shell connects to the user-installed, explicitly configured executable using a dedicated Native Messaging helper and, for source search, an **optional patched fork**. Neither a Mangayomi EXE nor source-service credentials are bundled in the extension.

**Access control:** the default-off **General → Seven Seas** acknowledgement must be enabled for Mangayomi start, search and result navigation. The explicit **Kill Mangayomi (process)** command remains available for cleanup when Seven Seas is off.

## Components

| File / area | Purpose |
| --- | --- |
| `StreamShellMangayomiHost.cs` | Dedicated Windows Native Messaging process and configured-app dispatch |
| `install-mangayomi-helper.ps1` | Staged, per-user helper compiler/installer |
| `tests/compile-mangayomi-host.ps1` | C# compile smoke test without installing |
| `build-patched-mangayomi.ps1` | Build a separate patched Windows Flutter app from Mangayomi source |
| `enable-patched-search.ps1` | Explicitly opt in to the patched source-search bridge |
| `background/src/05-mangayomi.js` | Browser-side orchestration and runtime gates |

Native helper output/manifest use `%LOCALAPPDATA%\StreamShell\NativeHost\`. The patched fork's authenticated loopback descriptor is in the user's local Stream Shell state; never commit it.

## Install / update

1. Load the unpacked extension in Opera GX via `opera://extensions`. Verify its extension ID when installing the native host.
2. From the **extension root** run the Windows compile test:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integrations\mangayomi\tests\compile-mangayomi-host.ps1
   ```

3. If the compiler passes, install the helper:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integrations\mangayomi\install-mangayomi-helper.ps1
   ```

4. Compile the optional patched fork **separately** with `build-patched-mangayomi.ps1` (requires a Windows Flutter/Rust/C++ build environment) and configure its exact executable under **General → Providers**. Do not overwrite a working stock installation implicitly. Close the fork before rebuilding to avoid locked DLLs.
5. Enable the bridge explicitly using `enable-patched-search.ps1` with its documented patched-build arguments, and restart the fork as needed. Enable **General → Seven Seas** and reload the Opera extension.

A normal extension-only update does **not** rebuild the C# executable or Flutter fork. Only rerun relevant installers/builds for changes that touch those components.

## Current behavior

- **Normal magnifier click:** query the installed sources through the configured patched fork. If the fork is not running, the helper can start it minimized, verify the authenticated localhost bridge/process identity and wait for readiness.
- **Shift + left click:** copy the selected title to clipboard and switch to the desktop app, without requesting source search.
- **Select a source result:** use the fork's short-lived opaque result identity to navigate to that exact item. An accepted `/v1/open` reply does not guarantee that the Flutter window is immediately visible; the extension follows up on window readiness without requesting a duplicate open.
- **Switch provider:** ordinary switching may hide Mangayomi instead of terminating it.
- **General → Providers → Kill Mangayomi (process):** after explicit confirmation, force-close the configured executable and its child processes. The global Skull kill also terminates it. The command is intentionally separate from `hide`; it does not target arbitrary processes and does not require Seven Seas to remain enabled.

## Problems / diagnostics

- `Specified native messaging host not found`: verify the per-user registry path, JSON manifest, extension ID and **presence of the compiled EXE**. A registered manifest referencing a missing EXE is not a working installation.
- Compiler `CS0136`: use the separated result-open handler in the current source and run `tests/compile-mangayomi-host.ps1` before installing. Never replace a working helper EXE before compilation succeeds.
- `MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE`: check exact configured fork, bridge enablement and whether the descriptor PID belongs to the live fork. A stale descriptor alone is not a running bridge.
- A search result that opens late: wait for the existing app window; never start a second app/process just to show a result already accepted.
- `WebView2Loader.dll` locked during a fork rebuild: quit the patched Mangayomi process before compiling. Check Windows Defender Controlled Folder Access if Mangayomi cannot open its own user database.

Live Windows/Flutter behavior requires on-device verification. The general extension tests and C# compile smoke test cannot prove successful playback or installed-source accuracy. Read [SEARCH-BRIDGE.md](SEARCH-BRIDGE.md) for lower-level fork notes, which may include historical implementation details.
