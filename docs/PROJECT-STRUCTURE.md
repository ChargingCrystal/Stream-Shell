# Stream Shell – current architecture and repository contract

**Current version: 0.22.1.** This document describes active ownership rules; previous implementation decisions belong in [CHANGELOG](../CHANGELOG.md) and [release notes](../release-notes/). Stream Shell is an **unpacked Opera GX / Chromium MV3 extension**, not an npm-hosted web app. The repository root must contain `manifest.json` and the generated `background.js`.

## Directory ownership

| Directory / file | Responsibility | Change rule |
| --- | --- | --- |
| `manifest.json`, `background.js` | MV3 permissions and worker entrypoint | Keep at root; rebuild worker from `background/src/` |
| `background/src/`, `background/tests/` | Window lifecycle, native orchestration, provider dispatch, Seven Seas execution gates, performance signals | Preserve sender validation, claims and single-response IPC |
| `common/src/`, `common/tests/`, `common/shell.js` | Shared provider/content-script lifecycle, video utilities and Anarchy | Generated bundle; never break page-lifetime cleanup |
| `dashboard/src/`, `dashboard/tests/`, `dashboard/` | Dashboard, Settings, native provider configuration, Diagnostics and Compact Home | Rebuild generated Dashboard/Compact bundles |
| `landing/src/`, `landing/tests/`, `landing/` | Library, Watchlist, TMDB+AniList Media search, FMHY browsing, Mangayomi result panel | Shared presentation behavior across Wide/Compact |
| `providers/` | Site-specific player/DOM adapters and styles | Do not inject built-in adapters into custom HTTPS providers |
| `shared/`, `media/` | Provider Registry, settings-independent helpers and media metadata/library storage | Keep stable IDs and source-specific storage |
| `twitch-workspace/` | Twitch workspace popup/slot surfaces | Respect four-slot Wide window ownership and lifecycle |
| `native/` | Shared Windows TitlebarNativeHost source, installer and tests | Separate from app-specific helpers |
| `integrations/discord/` | Discord desktop helper | Independent installation and lifecycle |
| `integrations/mangayomi/` | Mangayomi host, patched source bridge and build instructions | Separately installed app and Native Messaging host |
| `integrations/cobol-finance/`, `integrations/unified-remote/` | Optional specialized integrations | Do not fold into unrelated runtime modules |
| `popup/`, `offscreen/`, `subscriptions/` | Manifest popup, offscreen audio/icon helpers, subscription feature | Preserve referenced HTML/JS paths |
| `assets/` | Project artwork plus user-maintained backgrounds/custom icons | Exclude personal user images from Git/release packages |
| `tools/`, `docs/`, `release-notes/`, `.github/` | Validators, architecture, release history and CI | No feature runtime code in docs/tools |

Some runtime bundles concatenate ordered source fragments. Consult the adjacent `SOURCE-README.txt` and `build-*.ps1`. A change to canonical source **must** rebuild and commit its generated runtime counterpart.

## Layout and provider contracts

- **Wide 32:9:** left Landing / native companion / streaming provider vs independent right Dashboard / Discord / Twitch surfaces. A left action must not silently steal or reassign the right pane. Real Win32 ownership follows explicitly claimed windows, not geometry alone.
- **Compact 16:9/16:10:** one active full-width surface. The Subscriptions card was removed in v0.21.30; Library/Search and providers use the full height, with dynamic provider sizing. Compact must not inherit Wide-only permanent two-pane assumptions.
- **Provider Registry:** validated common definitions in `shared/provider-registry-core.js`, independent Dashboard-pinned order (up to seven) and native Titlebar visibility/order. Keep imported/exported IDs stable. Custom providers are HTTPS-only and never receive privileged built-in provider scripts automatically.
- Provider switching should keep native companions reusable: ordinary switching can hide an app, while **explicit Kill Mangayomi** and the global Skull kill end the configured process tree. Cleanup commands remain available even when Seven Seas access is revoked.

## Seven Seas – a runtime invariant (v0.21.31+)

The user-facing **General → Seven Seas** opt-in defaults to **off**. FMHY HTTP browsing and Mangayomi start, lookup and result opening are gated in the execution paths (background/native dispatch), not solely in UI controls. Disabling the switch revokes new gated actions without deleting settings. The native app kill path is independently available for cleanup. Do not add a new route through popup, Dashboard, titlebar, import, background or another host without covering that route with the same guard.

**Stremio is a future candidate, not an implemented integration.** Its potential gate is not evidence of a working Stremio provider.

## Media discovery ownership

- **TMDB + AniList:** combined Media search queries both catalogs, shows source-specific results and filters Movies/Series/Anime/Manga/Novels via multi-select chips. Missing credentials or a failed catalog must not suppress usable results from the other. Results are never silently merged into one writeable database.
- **Library:** TMDB Watchlist and AniList stored records remain separate; a conservative title/format/year match can link them **in rendering only**. Preserve saved records and manual-add behavior.
- **FMHY:** resource directory discovery; filters for Area and inferred Kind, Gaming source directory coverage and category browsing with empty query when an Area is selected. Uses FMHY's remote curated Markdown plus a limited offline fallback, displays community-star curation rather than invented safety ratings, and links externally / saves via Direct. Do not present FMHY listings as proof of a specific film stream.
- **Mangayomi:** native helper dispatches to a configured local patched fork. Ordinary magnifier click asks the app's authenticated localhost source bridge for results; Shift+click copies title and switches to the app; selecting an exact source result uses opaque source-scoped IDs, not arbitrary URLs. Direct search may launch the configured fork in the background, verifies PID/bridge identity and waits for the bridge rather than window visibility. `/v1/open` accepted does not imply the Flutter HWND is immediately ready; delay reveal without re-opening the result. The helper must never accidentally select a stock app by window title alone.

## Native Windows helpers

The shared titlebar helper uses `native/StreamShellTitlebarHost.cs` and `native/titlebar-src/` modules; its installer is `native/install-titlebar-helper.ps1`, compiler check `native/tests/compile-titlebar-host.ps1`. Per-app helpers reside in `integrations/`. Native Messaging manifests and compiled EXEs live under user-local Windows locations; **they do not belong in the extension archive or Git source tree**.

- Use explicit claimed HWNDs and correct provider/window identity; no broad focus-based ownership or unbounded desktop enumeration loops.
- Native C# changes must pass the Windows compile smoke test before installation. For Mangayomi, `integrations/mangayomi/tests/compile-mangayomi-host.ps1` tests the Add-Type compilation; the staged installer must not delete a working host on failed compilation.
- Performance Blackbox: modern titlebar helper writes daily `%LOCALAPPDATA%\StreamShell\Logs\performance-YYYY-MM-DD.jsonl`, bounded and rotated. Browser-side fallback incidents remain separate. Long-task/timer gaps are diagnostic symptoms, not proof of cause.
- **Known unresolved:** TitlebarNativeHost may survive Opera GX termination. Do not claim automatic exit is fixed without a Windows lifecycle regression.

## Provider runtime and Anarchy

- Provider scripts must use the existing bounded lifecycle/state and resource-governor controls. Keep retries, timeouts, observers and timer registration tied to actual page/document lifetime.
- The Visual Anarchy Director is off by default, uses **one event scheduler** per active player document, and supports Zoom, Deep Fry, VHS, Color Roulette, Gravity, Aspect Ratio and optional multi-effect Boss Fights. Effect code must restore all temporary styles/overlays on disable, provider switch or document teardown. Do not overwrite the player's `transform`; CSS `scale`/`rotate` is used to compose with provider styles.
- Twitch is a working part of Wide but a potential contributor to rare full-shell freezes. Do not introduce aggressive polling or perform broad refactors based only on this suspicion; correlate with Blackbox incidents before claiming a root cause.

## Tests, docs and release rules

`node tools/check-project.mjs` (Node 22+, Python 3) checks layout, manifest/HTML referenced assets, JS syntax, bundle parity and regression tests. It includes native **source** checks; a Windows compile smoke test and real Opera GX validation are separate requirements. See [CI Quality](CI-QUALITY.md) and [CI Setup](CI-SETUP.md).

- Keep new `*.test.js` files in the owning component's `tests/` directory.
- Release changes update `manifest.json`, `CHANGELOG.md` and `release-notes/RELEASE_NOTES_vX.Y.Z.md`; docs-only synchronization is **not** a release increment.
- Exclude `assets/backgrounds/*.png`, custom provider artwork, local databases/credentials, binary helpers, diagnostics and logs. A `.gitignore` rule does **not** remove assets already tracked in Git history; untrack those paths explicitly before pushing.
- Prefer narrow, independently testable fixes over broad architecture churn. Do not claim Windows live behavior from Node mocks or headless CSS simulations.
