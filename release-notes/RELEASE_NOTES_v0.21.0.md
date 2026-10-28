# Stream Shell v0.21.0 — FMHY discovery & Mangayomi native LEFT integration

Date: 2026-10-21. Base: 0.20.40. This is **not** a GitHub release or tag. The user's remote `main` remains 0.20.39 unless they explicitly push an updated project.

## Included

1. FMHY resource search on Landing and Compact Home next to TMDB. Powered by fetched `fmhy/edit` docs Markdown, HTTPS-only links, six-hour page cache and category/title/host match. Results can open in normal Opera or save to Direct Links. FMHY is a community directory, not media title data and not a guarantee that links work.
2. Mangayomi is a **native** provider type in the shared registry (v3). Dashboard and Titlebar controls are independent and **off by default**; turning Dashboard on uses slot 6 under the existing seven-slot limit. Button invokes a separate Native Messaging helper to position/restore Mangayomi in the **LEFT 1920x1080 pane** without navigating Opera. Right pane unchanged. No fake web-player adapter or injected extension scripts.
3. `native/StreamShellMangayomiHost.cs` + install/uninstall scripts. Requires Mangayomi Windows installed and one-time host registration for the current unpacked extension ID. Set an explicit Mangayomi.exe path under General > Providers if the app is not already running or installed in a recognized location. The executable basename is validated by the host.
4. Rename Official -> Library, preserve the four main tabs. Add type filters and a small manual Anime/Manga/Novel entry form. Entries are locally stored and open the Mangayomi app, not individual manga chapters. Existing TMDB media IDs remain numeric; no implicit watch-state/DB coupling. Watchlist export/import v4 includes externalMedia and retains legacy imports.
5. Regression contracts for native-left-window isolation, FMHY parser, safe external library storage, settings/provider registry. Build parity and syntax verified with `node tools/check-project.mjs`.

## Not yet included / live verification

- Windows C# helper compile and actual Opera GX Native Messaging + Flutter HWND/focus are not provable with Linux Node tests; Windows CI will compile the helper when pushed. First local Windows test should verify install, path detection, active native window location/focus, switching back to Opera, right-pane independence and compact behavior.
- The Titlebar button is wired in the Registry/Native action, but the **visual Titlebar over a non-Opera Flutter window** is unverified and may require further native surface ownership changes. Do not claim full Flutter/titlebar compositor integration yet.
- Mangayomi library synchronization, chapter read-progress, launch-to-specific-title/deeplinks are intentionally deferred pending verified external interfaces.
- FMHY sources may change structure or go offline; no embedded remote content or availability claims are made.
- Raid Guard v0.20.40 still needs a real Twitch raid test; untouched here. Twitch player mute rollback remains unchanged. No Native Discord or Twitch integration changes.

## Install / use

Apply PATCH over v0.20.40 or use FULL. Reload the unpacked extension. For Mangayomi, run `native/install-mangayomi-helper.ps1` on Windows for the extension ID (separate from existing Discord helper). In Dashboard > General > Providers you can save a full executable path, enable the Mangayomi item, and turn on Dashboard and/or Titlebar visibility. Open the Mangayomi tile; returning to Landing or another left provider should park its native window. FMHY: open Landing Search and select FMHY.

Background PNGs and user artwork are excluded from both ZIP archives. No git push, GitHub Release or tag is included.
