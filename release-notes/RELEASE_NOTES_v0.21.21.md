# Stream Shell v0.21.21 — Mangayomi magnifier shortcuts

**Date:** 2026-10-23

- **Normal left-click:** query the opted-in Mangayomi bridge and show installed-source hits in Stream Shell's existing left Search panel, without opening or raising Mangayomi.
- **Shift + left-click:** switch directly to native Mangayomi (same provider switch as its dashboard/titlebar button), without automatic search or copying a title.
- Exact result navigation from v0.21.20 is retained, but remains unverified until the fork rebuild succeeds and the updated Mangayomi Native Messaging helper is installed.
- The fork build script now aborts early with the running fork PID if the patched Release executable is still active; this avoids the confirmed WebView2Loader.dll file lock / MSB3027.
- No changes to the right Dashboard, Settings, Diagnostics, Twitch, Discord, Titlebar, user watchlist or backgrounds. Local backgrounds excluded from ZIP.

## Upgrade

1. Overlay this ZIP over Stream Shell; reload the unpacked extension in Opera GX.
2. Close the **patched fork** completely before rerunning `integrations/mangayomi/build-patched-mangayomi.ps1` (the previous build failed because `mangayomi.exe` PID 9204 locked a DLL).
3. Install the updated integration helper with `integrations/mangayomi/install-mangayomi-helper.ps1`, then start the patched fork.

Only the extension needs updating for the click mapping. Fork rebuild + Native Helper update are required for exact result navigation from v0.21.20, not for the mapping itself.
