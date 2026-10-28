# Stream Shell v0.21.2 — FMHY, Mangayomi Chrome, Integration Layout

**Base:** v0.21.1. PATCH can be overlaid on v0.21.1, deleting only the documented moved files; FULL is the complete source tree. Neither archive includes user background PNGs or custom artwork.

## Changes
- FMHY: source descriptions included in directory searches. On GitHub raw failure, use a small built-in excerpt labeled *Offline excerpt*; it is not the entire FMHY catalogue. FMHY does **not** search individual movie/series names like TMDB.
- Mangayomi Wide left Titlebar: use the known Landing Opera HWND as overlay anchor. Suppress the standard foreign-window occlusion gate **only** for a matching Mangayomi process occupying most of the left pane; keep the safety gate for unrelated foreground applications, Discord and Twitch.
- Move dedicated Discord / Mangayomi C# executable source, install, uninstall and smoke-compile scripts to `integrations/discord/` and `integrations/mangayomi/`. Shared Titlebar remains in `native/`. Existing registered integration executables remain valid (their installed paths were not moved). Integration uninstallers no longer delete other native helpers.

## Upgrade
1. Apply PATCH onto v0.21.1, **removing** the old app-specific files from `native/` and old `native/tests/compile-mangayomi-host.ps1` (PATCH includes a deletion manifest); or use FULL in a fresh code directory. Preserve your own local backgrounds and custom artwork.
2. Reload unpacked Stream Shell in Opera GX.
3. **Re-run `native/install-titlebar-helper.ps1`** as the Titlebar C# source has changed. The existing Discord/Mangayomi native messaging registration does not require reinstalling merely for the source-file relocation. For new installations run `integrations/discord/install-discord-helper.ps1` and/or `integrations/mangayomi/install-mangayomi-helper.ps1`.
4. Verify Mangayomi left with Chrome visible and clickable and Discord on the right still above its Titlebar as before; check switching to unrelated foreground apps hides left Chrome.

## Validation caveats
Source, JS regression/syntax and bundle tests are automated; actual Win32/Opera/Flutter Z-order, PowerShell C# build and live GitHub retrieval cannot be exercised in the non-Windows test environment. They require live confirmation.
