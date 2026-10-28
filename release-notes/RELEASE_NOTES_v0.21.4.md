# Stream Shell v0.21.4 — Mangayomi Wide focus parity and Landing controls

**Base:** v0.21.3. **Date:** 2026-10-22.

## Mangayomi

- After the RIGHT Dashboard gains focus, preserve the native Mangayomi window above the LEFT Landing without changing the keyboard foreground. Passive `raise` is Win32 `SetWindowPos(HWND_TOP, SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE)`; unlike `show`, it never starts/restores/minimizes a process. Only Wide `leftMode=mangayomi`/`rightMode=dashboard` can dispatch it. No Discord/Twitch/native Titlebar C# changes.
- Move Mangayomi's native LEFT window down **3px** (reduce height 3px) so first Flutter content pixels aren't hidden beneath the Stream Shell overlay. Needs visual Windows test.
- **Mandatory one-time reinstallation of Mangayomi helper** after upgrading: `integrations/mangayomi/install-mangayomi-helper.ps1`. Its C# native messaging protocol adds `raise`; the existing installed `.exe` cannot handle it. Do not reinstall the shared Titlebar or Discord helper for this release.

## Landing — Wide + Compact

- TMDB / FMHY become two normal Stream Shell `library-tab` buttons at the top of the Search panel. Remove conflicting dropdown from search input; Clear X is unobstructed.
- The `All types` Library filter disclosure reveals the same six category chips only when needed, reducing visual clutter. Once a category is chosen, chips collapse. Manga/Anime/Novel manual add remains available for selected types.

## Scope and checks

- Tests: see `tools/check-project.mjs`; new regression coverage for native focus isolation and search UI. All generated JS bundles rebuilt from source. Old Watchlist data preserved. Twitch, Raid Guard, Discord, Titlebar C# runtime and provider player scripts unchanged.
- Windows native compilation, Win32 focus ordering and actual visual alignment are **not yet verified** from this environment. No GitHub push/tag. User backgrounds and custom artwork excluded from both archives.
