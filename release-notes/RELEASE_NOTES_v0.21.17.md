# v0.21.17 — Mangayomi Search Bridge (experimental build kit)

The Mangayomi Windows release is NOT bundled. This build includes source changes and a Windows build script for a separately built Mangayomi fork. The default Mangayomi installation still uses the clipboard handoff.

## Setup
1. On Windows install Flutter Desktop, Rust (including flutter_rust_bridge_codegen), Git, Python 3 and Visual Studio C++ tools.
2. Run `.\integrations\mangayomi\build-patched-mangayomi.ps1` from a PowerShell session; use the entire generated Windows Release folder (do not copy only the exe).
3. Close the stock Mangayomi process, point Stream Shell's Mangayomi executable setting to the newly built Mangayomi.exe, then launch the fork and confirm its normal features work.
4. Run `.\integrations\mangayomi\enable-patched-search.ps1 -IInstalledPatchedBuild -ExecutablePath "C:\...\Mangayomi.exe"` only after verifying the fork works. **Restart the patched Mangayomi app after enabling the bridge marker**: it is read only at launch.
5. Reinstall `.\integrations\mangayomi\install-mangayomi-helper.ps1`, reload Stream Shell, then Shift+click an Anime/Manga/Novel search action.

Shift-click sends a search to Mangayomi's actual installed extensions, then navigates the patched Mangayomi app into its Global Search after the external scan completes (to avoid simultaneous duplicate source scans). Results are also shown in the Stream Shell Dashboard overlay. Large source lists may take some time.

Search results come only from Mangayomi's installed sources; errors, timeouts and empty sources are included. The bridge uses localhost with a random token under `%LOCALAPPDATA%\StreamShell`, activated only by the user. Results do not prove playback availability. Source links are metadata only; no web page is automatically opened.

**Not verified**: Mangayomi Dart/Flutter compilation, Windows runtime, real extension searches, and native helper build; this environment does not have Flutter or Windows. Static JS regression tests are not substitutes for this test.

To disable the bridge run `.\integrations\mangayomi\enable-patched-search.ps1 -Disable`. Backgrounds and user artwork are excluded; GitHub unchanged.
