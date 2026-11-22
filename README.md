<p align="center">
  <img src="assets/brand/stream-shell-wordmark.png" alt="Stream Shell" width="620">
</p>

# Stream Shell

**A personal streaming workspace for Windows and Opera GX.** Stream Shell brings streaming providers, media discovery, a local Library, playback tools and desktop integrations into one configurable interface.

It runs as an unpacked **Chromium Manifest V3 extension**. Optional Windows Native Messaging helpers provide native titlebar controls and desktop-window integration. Streaming still happens on the providers' own websites and through your existing accounts.

**Version 0.22.35** · [Changelog](CHANGELOG.md) · [Release notes](release-notes/) · [Installation](#installation) · [Contributing](CONTRIBUTING.md)

## One workspace, two layouts

| Layout | Designed for | Workspace |
| --- | --- | --- |
| **Wide** | 32:9 ultrawide displays | A left media area alongside a separately managed Dashboard, Discord or Twitch workspace. |
| **Compact** | 16:9 and 16:10 displays | A single-screen Home and provider windows, with space for Library and Search. |

Select **Auto**, **Wide** or **Compact** in **General → Display**. Both layouts share saved media, provider configuration and settings. Native window-management features require the Windows helper.

## Providers and customization

Built-in browser integrations cover **YouTube, YouTube Music, Netflix, Prime Video, Disney+ and Crunchyroll**. YouTube and Music share a split Dashboard button. Additional HTTPS services can be added as custom providers with their own name, URL, local artwork and titlebar color.

- Choose which providers are enabled and shown on the Dashboard or native titlebar.
- Reorder providers through draggable lists and visual layout previews.
- Configure provider colors, Wide/Compact backgrounds and local icons.
- Reorder Settings categories and add optional personal notes or links to individual pages.
- Search Settings, show or hide explanations, and import/export supported configuration.

Custom providers open as basic HTTPS windows. They do not automatically gain built-in playback adapters or additional host permissions.

## Discover, save and resume

**Media search** queries TMDB and AniList together for movies, series, anime, manga and novels. Type filters narrow the results. **Merged search** combines confidently matched TMDB/AniList entries; switching it off restores separate results without repeating the search.

The local **Library / Watchlist** keeps titles from both sources, with linked presentation where titles, years and media types match. Removing a linked entry removes both saved source records.

**Continue** tracks playback progress for YouTube, Netflix, Prime Video, Disney+ and Crunchyroll. An adjustable percentage range controls when a title appears and when it counts as complete. Automatic additions can be enabled separately for each supported provider. **Recent** and **Direct** provide additional history and saved-link views.

TMDB-backed discovery requires its API configuration. Metadata, streaming-availability information and artwork come from their respective external services.

## Playback and YouTube tools

Provider-specific options include player and interface adjustments, volume controls, subtitle customization, skip controls and YouTube like/dislike and Shorts utilities. Available features depend on the provider.

**YouTube filter lists** accept user-imported JSON channel lists. Each list can be enabled independently and configured to:

- **Blur** supported thumbnails and images with a custom label.
- **Remove** matching elements from the page.

No channel list is bundled. Overlapping Remove rules take priority. Channel matching includes supported Shorts surfaces, with a throttled, cached identity fallback for visible Shorts whose channel is not exposed locally. See [YouTube filtering](docs/YOUTUBE-BLOCKLIST.md) for the format and matching limits.

## Twitch workspace

The Wide Twitch workspace manages multiple stream windows and offers optional channel-point and Drop claims, mute controls, raid handling and Marbles auto-join.

Auto-join supports a configurable delay range and a participation threshold based on the stream's viewer count. Viewer counts refresh at most once every five minutes per window; unavailable or stale channel identity prevents admission. Stream changes and refreshes are handled by the workspace lifecycle logic.

## Subscriptions and Finance

Configure subscriptions independently of pinned providers. Settings supports visibility, plan details, billing/account URLs, payment dates and automatic or manual data sources.

Prices and billing intervals are shared with the Finance overview, so edits in either place use the same data. YouTube Premium and Music share one subscription entry. Automatic subscription details depend on existing provider adapters; custom providers use manual details.

## Optional desktop integrations

- **Native titlebar:** provider switching, desktop window controls and integration with the Wide layout.
- **Discord:** desktop-window integration alongside the streaming workspace.
- **Mangayomi:** optional integration with a separately built compatible fork, including installed-source search, opening a selected result and switching to the application.
- **FMHY:** browse and search external resource directories, open links or save them to Direct.

FMHY and Mangayomi are gated by the explicit **General → Seven Seas** opt-in, which is disabled by default. Mangayomi requires its own application build and helper installation; executable binaries are not bundled with the extension. Follow the [Mangayomi setup guide](integrations/mangayomi/README.md).

## Anarchy

Optional Playback, Subtitle and DVD Anarchy sit alongside a Visual Anarchy Director. Enable individual effects such as Zoom, Deep Fry, VHS, Color Roulette, Gravity and Aspect Ratio changes; adjust event frequency and intensity, or allow combined Boss Fight events.

Anarchy is disabled by default. Its Settings controls use independent changing neon colors, including the intensity slider.

## Diagnostics

Diagnostics provides runtime information and exportable reports. The native performance recorder can also retain unusual stalls in daily logs, including cases where the interface cannot export a report:

```text
%LOCALAPPDATA%\StreamShell\Logs\performance-YYYY-MM-DD.jsonl
```

The recorder captures coarse indicators such as timer gaps, long renderer tasks and delayed heartbeats. It is not a full profiler. See [Hang diagnostics](docs/HANG-DIAGNOSTICS.md).

## Installation

The primary supported setup is **Windows with Opera GX**. Other Chromium browsers are not the main test target. Loading the extension does not require npm packages.

1. Clone or download this repository.
2. Open `opera://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Open Stream Shell and configure the display profile and providers.
5. For native titlebar/window features, install `native/install-titlebar-helper.ps1` or its `.cmd` launcher, then reload the extension. See [Native titlebar setup](native/TITLEBAR-README.txt).
6. Configure optional API credentials and desktop integrations only for the features you want to use.

### Updating

Replace the extension code, reload it in `opera://extensions`, then reload the Dashboard/Landing and affected provider windows. Reinstall native helpers when the release notes specify native changes.

Keep personal background images and custom artwork in place. Cumulative update ZIPs omit background artwork and are intended to be applied to an existing installation.

### Local artwork

| Asset | Path |
| --- | --- |
| Provider backgrounds | `assets/backgrounds/<provider>_wide.png` and `<provider>_compact.png` |
| Custom provider icon | `assets/providers/custom/custom_<key>_icon.svg` |
| Custom provider wordmark | `assets/providers/custom/custom_<key>_wordmark.svg` |
| Custom native titlebar icon | `native/titlebar-icons/custom/custom_<key>.png` |
| Custom backgrounds | `assets/backgrounds/custom_<key>_wide.png` and `custom_<key>_compact.png` |

Personal artwork is excluded from Git by the repository's ignore rules. Keep credentials, local diagnostics and user data out of commits as well.

## Development

| Directory | Responsibility |
| --- | --- |
| `background/` | MV3 background worker, window orchestration and native messaging |
| `dashboard/` | Dashboard, Settings, Diagnostics and Compact Home |
| `landing/` | Library, search and media presentation |
| `common/`, `providers/` | Shared browser runtime and provider/player integrations |
| `shared/`, `media/` | Provider registry, metadata clients and local media stores |
| `native/`, `integrations/` | Windows helpers and optional desktop integrations |
| `tools/`, `docs/`, `release-notes/` | Validation, technical documentation and release history |

Source fragments and shipped bundles must stay in sync. Follow the build scripts and `SOURCE-README.txt` files in the relevant directories.

The project validation command requires **Node.js 22+ and Python 3**:

```powershell
node tools/check-project.mjs
```

It checks syntax, references, bundle parity and regression tests. Native changes also require Windows compilation and testing. Automated checks do not replace live Opera GX testing against streaming websites.

See [Project structure](docs/PROJECT-STRUCTURE.md), [CI quality](docs/CI-QUALITY.md), [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## Project status

Stream Shell is a personal project developed primarily around an Opera GX setup with ultrawide and laptop layouts. Streaming-site changes can break adapters, and individual integrations have different levels of coverage. Rare Wide/browser freezes remain under investigation; diagnostic logs help distinguish symptoms from causes.

## License and attribution

Source-available for non-commercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Copyright © 2026 Sven Rieseler.

Stream Shell is independent of Netflix, Amazon/Prime Video, Disney+, Crunchyroll, Google/YouTube, Twitch, Discord, TMDB, AniList, FMHY and Mangayomi. Their names, marks and content belong to their respective owners. Stream Shell does not host streaming content or replace provider subscriptions.
