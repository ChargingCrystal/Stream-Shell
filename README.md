<p align="center">
  <img src="assets/brand/stream-shell-wordmark.png" alt="Stream Shell" width="620">
</p>

# Stream Shell

**Stream Shell** is a personal, Windows-focused desktop streaming shell built as an unpacked **Opera GX / Chromium Manifest V3 extension** with optional native Windows helpers. It manages streaming-provider windows, combines library/navigation tools, and adds provider-specific playback utilities.

**Current version: 0.20.3** · [Changelog](CHANGELOG.md) · [Release notes](release-notes/RELEASE_NOTES_v0.20.3.md)

> Built primarily for one Windows / Opera GX setup. Other configurations are best-effort; this is not a hosted streaming service, a provider client, or an official integration with any streaming platform.

## How it works

Stream Shell has two display modes:

| Mode | Shell layout | Window behavior |
| --- | --- | --- |
| **Wide (32:9)** | Landing/library on the left, Dashboard or a utility surface on the right | Left-side provider windows are managed separately from the right-side Dashboard, Discord and four-slot Twitch workspace. |
| **Compact (16:9 / 16:10)** | Single-screen Shell Home and provider workspace | Home and providers use the same display area; there is no permanent two-pane split. |

Display targeting can be automatic or selected under **General → Display**. Wide is designed for a 32:9 monitor; Compact targets standard/laptop displays. The Windows-specific titlebar/window behavior requires the native helper described below.

### Provider Registry (0.20.0)

The original five services are **built-in providers**: **YouTube, Netflix, Prime Video, Disney+ and Crunchyroll**. They retain their own adapters and site-specific enhancements.

You can also create **custom providers** under **General → Providers** using a name, HTTPS URL, optional initials and optional artwork key. Custom providers open as managed Opera windows; they **do not** automatically gain player controls, scraping, content-script injection or other site-specific integrations. A site's normal Opera GX compatibility still applies.

- **Dashboard:** up to **seven** independently ordered, optional provider buttons. Wide uses predefined centered arrangements (five = 1–3–1, six = 2–2–2, seven = 2–3–2); no empty button placeholders. Compact uses a vertical list.
- **Native titlebar:** a **separate** enable/order list with no seven-button limit. Excess buttons move to the native `...` overflow menu.
- **Live updates:** changing the registry updates provider navigation and native buttons without recreating existing provider windows just to reorder controls. Saved settings participate in Stream Shell settings export/import.
- **Appearance:** a titlebar accent can be selected per provider; it controls the theme/active/hover backgrounds, **not** the neutral monochrome icon pixels.

### Other features

- Wide Landing and Compact Shell Home: library/watchlist, Continue Watching, Recent items, search, direct links and subscription-related views.
- Provider-specific features: playback controls, subtitles, skip actions, visual cleanup and provider themes. Availability varies by service and site version.
- YouTube: windowed fullscreen, quality controls, optional Return YouTube Dislike ratio, auto-like and related utilities.
- Twitch: **four managed Wide slots (A–D)**, window recovery, Drops/channel-points options, raid controls and optional Marbles on Stream autojoin. Diagnostics include per-slot visibility, timer drift and join-attempt data.
- Discord desktop integration on the Wide right side via its **separate** native helper.
- Optional tab-capture volume booster, settings search, settings export/import, Diagnostics/Flight Recorder and self-tests.

### Twitch/Opera startup decongestion (0.20.3)

Twitch launch sends a lightweight Dashboard/Landing state notification instead of awaiting a full window-enumerating state broadcast in the explicit transition FIFO. An already-normal provider window in the correct pane now uses a focus-only restore fast path. New `window-transition` / `step-timing` Flight Recorder events identify individual slow phases (>350 ms) in Twitch/provider activation. Full Diagnostics export still collects live Twitch renderer data on demand. No native helper changes; see [v0.20.3 notes](release-notes/RELEASE_NOTES_v0.20.3.md).

### Twitch cold-start latency (0.20.2)

Opening the Twitch workspace now returns a lightweight status rather than synchronously probing all four Twitch renderers through the full Diagnostics collector. This prevents those expensive per-slot checks from occupying the global window-transition queue after the workspace is already visible. The detailed Twitch Diagnostics export is unchanged. No native helper update is required. See [v0.20.2 notes](release-notes/RELEASE_NOTES_v0.20.2.md).

### Runtime stability (0.20.1)

The Flight Recorder now batches Diagnostics persistence instead of serializing a full storage write after each event. Home/provider/Twitch workspace window transitions have bounded backpressure, and failing provider-side periodic work is automatically slowed down. Video playback, Twitch chat and automation are not part of this transition queue. The native helper remains on protocol v9 and does not need reinstalling. See the [v0.20.1 release notes](release-notes/RELEASE_NOTES_v0.20.1.md). Long-running Opera GX/WuWa stress testing remains pending.

## Install

**Requirements:** Windows with Opera GX (primary test target), permission to load an unpacked extension, and a local copy of the project. Some functions need the native Windows helper(s); optional library metadata uses your own TMDB Read Access Token.

1. Clone/download the repository and keep the project files together. The unpacked extension folder must contain `manifest.json`.
2. Visit `opera://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the project folder.
3. Open Stream Shell and choose **Wide** or **Compact** (or leave display mode on Auto).
4. For native titlebar buttons, window chrome/grouping and Native Messaging integration, run **`native\install-titlebar-helper.cmd`** on Windows, complete its prompts, and reload the extension.
5. For Discord desktop-window control, install the separate helper as explained in [`native/README.txt`](native/README.txt). Other integrations are optional.

For regular extension-only updates, replace the code files and reload the extension in `opera://extensions`. **Reinstall the native titlebar helper when a release note explicitly says its C# host/protocol changed.** For **0.20.0 over 0.19.37**, no helper reinstall is required (native protocol v9 is unchanged).

**Local artwork is not in release ZIPs.** Keep your existing backgrounds and custom logos in their directories when updating; do not mirror/delete the project directory as part of an update.

## Custom artwork: local naming conventions

Enter an artwork key such as `paramount` under **General → Providers**. Files are optional and must be placed manually relative to the unpacked extension root:

| Surface | Expected file | Format |
| --- | --- | --- |
| Dashboard icon | `assets/providers/custom/custom_paramount_icon.svg` | SVG |
| Landing/Dashboard wordmark | `assets/providers/custom/custom_paramount_wordmark.svg` | SVG |
| Native titlebar primary icon | `native/titlebar-icons/custom/custom_paramount.png` | PNG |
| Wide panoramic background | `assets/backgrounds/custom_paramount_wide.png` | PNG |
| Compact background | `assets/backgrounds/custom_paramount_compact.png` | PNG |

The **same Wide background** is used across the Landing and Dashboard sides. The **native titlebar** tries the custom PNG first, then a monochrome rendition of the Dashboard SVG, then text initials. A transparent, high-contrast PNG silhouette works best. Selected titlebar colors never recolor icon pixels.

Built-in backgrounds follow the existing `<provider>_wide.png` / `<provider>_compact.png` convention. Missing optional artwork falls back to a neutral presentation. Reload the extension after changing local image files. See [`assets/providers/custom/README.txt`](assets/providers/custom/README.txt) and [`native/titlebar-icons/custom/README.txt`](native/titlebar-icons/custom/README.txt).

**Note:** Local backgrounds and custom assets are intentionally excluded from release archives and Git commits. Back them up separately when moving computers.

## Optional integrations

| Integration | Details |
| --- | --- |
| Native titlebar | [`native/TITLEBAR-README.txt`](native/TITLEBAR-README.txt) — required for native Windows chrome and dynamic titlebar provider buttons |
| Discord desktop helper | [`native/README.txt`](native/README.txt) — independent from titlebar installation |
| TMDB | Optional media metadata / search / availability; supply your own Read Access Token in settings |
| Return YouTube Dislike | Optional third-party ratio information for YouTube |
| Unified Remote | [`integrations/unified-remote/README.md`](integrations/unified-remote/README.md) |
| GnuCOBOL finance integration | [`integrations/cobol-finance/README.md`](integrations/cobol-finance/README.md) — optional subscription report |

## Developer layout

| Location | Purpose |
| --- | --- |
| `shared/provider-registry-core.js` | Common validated Provider Registry used by Dashboard and background runtime |
| `background/src/` → `background.js` | Source chunks → generated Manifest V3 service worker bundle |
| `dashboard/src/` → `dashboard/dashboard.js` | Dashboard and General/Provider Settings source → generated runtime bundle |
| `landing/src/` → Landing bundle and Compact Home | Library/navigation logic shared by Wide Landing and Compact Home |
| `providers/`, `common/`, `twitch-workspace/` | Provider adapters, shared playback helpers and Twitch scripts |
| `native/` | C# Native Messaging helpers and Windows installer scripts |
| `release-notes/` | Version notes and [Provider Registry design history](release-notes/PROVIDER_REGISTRY_ROADMAP.md) |

Edit the canonical `src/` files and rebuild generated JavaScript bundles using their adjacent `build-*.ps1` scripts. Before committing or packaging, run `node tools/check-project.mjs` (Node 22+ and Python 3). It verifies all generated bundles, Manifest/HTML asset paths, JavaScript syntax, regression tests and the native C# **source** contract without modifying installed helpers. GitHub Actions runs the same check on pushes and pull requests. See [`CODE_AUDIT_v0.20.17.md`](CODE_AUDIT_v0.20.17.md) for code-care findings and deferred risks. Consult the `SOURCE-README.txt` files before editing compiled bundles directly.

## Privacy, diagnostics and support

Settings, registry configuration, library data and optional tokens are stored in browser extension storage; Stream Shell does not include a project-operated telemetry service. Certain optional features communicate with external services (including TMDB and Return YouTube Dislike). **Full Diagnostics JSON can contain opened URLs, Twitch channels, playback state and configuration. Review/redact exports before sharing them publicly.**

This is a **personal, best-effort project**, not a product with a guaranteed support schedule or compatibility matrix. Site updates and browser changes can break integrations. See [Contributing](CONTRIBUTING.md) and the [Security Policy](SECURITY.md) when reporting issues.

## License and acknowledgements

Source-available for non-commercial use under [PolyForm Noncommercial License 1.0.0](LICENSE.md). Copyright © 2026 Sven Rieseler.

Stream Shell is independent of and not endorsed by Netflix, Amazon/Prime Video, Disney, Crunchyroll, Google/YouTube, Twitch, Discord, TMDB, JustWatch, Return YouTube Dislike or Unified Remote. Service names/logos belong to their respective owners.
