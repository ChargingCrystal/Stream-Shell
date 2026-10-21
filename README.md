<p align="center">
  <img src="assets/brand/stream-shell-wordmark.png" alt="Stream Shell" width="620">
</p>

# Stream Shell

**Stream Shell** is a personal, Windows-focused desktop streaming shell built as an unpacked **Opera GX / Chromium Manifest V3 extension** with optional native Windows helpers. It manages streaming-provider windows, combines library/navigation tools, and adds provider-specific playback utilities.

**Current version: 0.20.39** · [Changelog](CHANGELOG.md) · [Release notes](release-notes/RELEASE_NOTES_v0.20.39.md)

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

### Safer Background IPC (0.20.20)

Selected Settings/Diagnostics requests and `get-state` now use a shared, reply-once
asynchronous response boundary that catches both thrown browser API errors and
rejected promises. Sender permission checks still happen before any privileged work;
Runtime cached Diagnostics remains synchronous and does not probe browser windows.
The initial scope deliberately excludes Twitch/window-transition IPC; see
[IPC conventions](docs/IPC-CONVENTIONS.md) and [v0.20.20 notes](release-notes/RELEASE_NOTES_v0.20.20.md).

### Twitch player audio rollback, raid guard retained (0.20.39)

On user request, the experimental player-side auto-unmute and autoplay diagnosis from v0.20.36–v0.20.38 were **completely rolled back**: `providers/player/twitch-utility.js` matches the stable v0.20.35 early kernel byte-for-byte. Stream Shell does not click Twitch's own mute button, change the video element's `muted`/`volume` properties or attempt autoplay recovery. A Twitch stream may consequently start muted by Twitch/Opera; this is an **accepted behavior**, not an active repair task. The normal **Chromium tab mute** remains independently controlled by the Twitch Floating Bar and saved per-slot `audioMuted` settings, including automatic tab muting. The v0.20.36 raid navigation fix is retained: choosing another Twitch channel never causes the old 45-second URL rollback; visible raid cancellation remains. [v0.20.39 release notes](release-notes/RELEASE_NOTES_v0.20.39.md).

### Concurrent Twitch maintenance admission (0.20.35)

The 0.20.34 field log confirmed that early managed Stream CSS eliminated flicker: each Twitch slot recorded one browser navigation and zero reloads. The remaining alarm housekeeping phase cost ~567ms while the four Twitch popups were already being created. v0.20.35 **checks the four independent alarm slots in parallel and overlaps them with the existing Native/renderer startup**, while still awaiting reconciliation before declaring the transition complete. No extra renderer jobs, late CSS, window reloads or native changes. See [v0.20.35 notes](release-notes/RELEASE_NOTES_v0.20.35.md).

### Twitch early stream layout and real reload telemetry (0.20.34)

After the 0.20.31 lazy HUD split, stream-only header/sidebar cleanup could arrive **several seconds after Twitch first painted**. The passive CSS now loads at `document_start` with the essential Twitch kernel; only managed Stream slots enable its marker, and the lazy HUD later refines auto/offline/fullscreen presentation. No HUD/DOM automation is moved back to early startup. Deep Diagnostics adds a per-slot `navigationAudit` counting **actual browser top-frame commits/reloads** since the current MV3 service worker was started, not UI repaint events. A confirmed browser reload is also recorded by the Flight Recorder. The v0.20.33 field log itself cannot tell whether earlier visible resets were full reloads. [Release notes](release-notes/RELEASE_NOTES_v0.20.34.md).

### Physical Twitch automation code splitting (0.20.33)

The Twitch `document_start` utility is now a small **essential kernel** (~430 lines instead of 1,157): managed window/slot identity, Native compositor surface wake, playback guard, navigation, lightweight telemetry and settings. The full ~760-line Marbles chat-history observer, point/Drop claims, raid DOM recognition and chat submission utilities live in `providers/player/twitch-automation.js`. They are *not* loaded by the manifest at startup. After each slot's existing 650/1000/1350/1700ms stagger, the background validates the requesting top-frame managed A–D slot and injects the deferred script into its requesting document only (a missing Chromium document ID is rejected). The kernel registers it exactly once and retains the diagnostics interface and pagehide cleanup. The HUD remains its own lazy module. This avoids parsing and initializing all automation functions at `document_start` while keeping Marbles' v0.20.32 replay/history filtering and the established Native/renderer handoff unchanged. [Release notes](release-notes/RELEASE_NOTES_v0.20.33.md).

### Marbles chat replay protection (0.20.32)

Twitch can insert historical chat lines long after the page and MutationObserver start. The earlier 5-second startup grace did not reliably exclude that replay: Deep Diagnostics showed joins shortly after the five-second guard. The new **Marbles-only** freshness gate waits at least 12 seconds after chat/slot storage hydration or channel navigation, rejects multi-line history batches (which extend the startup quarantine), ignores messages inserted ahead of existing chat rows, and rejects stale messages when Twitch exposes a parseable timestamp. An organic burst still needs 5–10 **distinct users** inside 30 seconds and keeps the existing 1–4-second jitter/cooldown. Deep Diagnostics now counts dropped historical/hydration rows without capturing chat content or usernames. This is intentionally conservative: a large *real* batch may be skipped rather than risk autojoining a finished round. [Release notes](release-notes/RELEASE_NOTES_v0.20.32.md).

### On-demand Twitch HUD injection (0.20.31)

The full Twitch Workspace HUD is no longer registered as an automatic content script. A tiny `document_idle` loader checks whether the document belongs to a managed A–D slot, then requests a slot-staggered injection from the background. Chromium injection targets the requesting document ID when provided, and the HUD has a document-lifetime duplicate-load guard. Non-slot/unmanaged Twitch pages do not parse the 709-line HUD. A visible slot is admitted immediately; pagehide cancels pending admission. Critical compositor wake/playback protection, popup spacing, Native claims and the existing automation phase remain unchanged. [Release notes](release-notes/RELEASE_NOTES_v0.20.31.md).

### Staged Twitch startup / background automation admission (0.20.30)

Four newly opened Twitch popups no longer load the workspace HUD and attach broad DOM-automation observers in the same initial phase. `providers/player/twitch-utility.js` remains a `document_start` content script for managed-window identity, Native compositor wake, telemetry, covered playback intent, navigation/raid opt-out and settings events. The separate Twitch HUD is lazy-loaded on demand after a small `document_idle` loader. After startup/settings hydration, per-slot Twitch automation defers its **DOM observer**, first claim scan and 30-second fallback interval by A:650 / B:1000 / C:1350 / D:1700ms. Marbles `!play` detection remains synchronous in MutationObserver callbacks once armed; startup phase/timing are exposed through existing Twitch Deep Diagnostics. Popup creation spacing, Native claims, renderer handoff leases, Marbles cooldown and anti-raid are not altered. [Release notes](release-notes/RELEASE_NOTES_v0.20.30.md).

### Windowed-player settings event ordering (0.20.29)

Provider-side Windowed Player now resolves display-scoped settings directly from a page-local legacy/scoped snapshot after initial hydration. `chrome.storage.onChanged` batches are applied atomically (scoped override takes precedence; deleting it exposes the latest legacy key), without scheduling asynchronous per-change `get()` calls that could finish out of order. This is limited to the common Windowed Player start path; Dashboard import and ordinary Settings writes retain their independent validation/write queues. Renderer/Twitch handoff admission is unchanged. [Release notes](release-notes/RELEASE_NOTES_v0.20.29.md).

### Provider DOM governor wake budget (0.20.28)

Netflix and Prime now recheck their own DOM observers only when their resource-governor DOM eligibility changes. Prime's subtitle Anarchy visual budget is independent; focus-only/play-mode changes no longer reapply its presentation markers or schedule auto-skip checks unnecessarily. Settings changes, Safe Mode and real hidden/visible transitions retain their existing synchronization. No Twitch or renderer timing changes. [Release notes](release-notes/RELEASE_NOTES_v0.20.28.md).

### Cross-surface startup admission after provider-first launches (0.20.27)

A provider opened first now receives the same effective renderer settling
protection before Twitch A–D as Twitch-first followed by a provider. Stored
Twitch slot IDs are validated against **live** Opera windows before choosing
3s warm vs 5.5s cold handoff; four stale stored IDs must not make a cold A–D
recreation appear warm. A small MV3 `chrome.storage.session` timestamp lease
preserves the grace period across worker eviction/restarts, including the
parked startup provider. Twitch slot spacing and native focus order are
unchanged. See [v0.20.27 notes](release-notes/RELEASE_NOTES_v0.20.27.md).

### Provider window-state consistency (0.20.26)

The provider-side Resource Governor now ignores delayed window-state replies
when a newer visibility/focus snapshot or pushed window update has arrived.
YouTube targeted DOM observers only restart their bounded SPA settle sequence
when observation actually changes between allowed and parked; normal focus-only
transitions do not trigger unnecessary scans. No Twitch startup/renderer timings,
Native helper code, or provider feature settings changed. See
[v0.20.26 notes](release-notes/RELEASE_NOTES_v0.20.26.md).

### Settings storage consistency (0.20.21)

Settings in the Dashboard use a shared storage contract: rapid changes to the
same setting are persisted in order, failed writes show an error instead of a
false success, and invalid imports cannot silently clear scoped preferences.
Legacy Wide/Compact setting exports stay compatible. See
[settings/storage conventions](docs/SETTINGS-STORAGE-CONVENTIONS.md) and
[v0.20.21 notes](release-notes/RELEASE_NOTES_v0.20.21.md).

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

For the complete ownership map, exceptions, test placement and root policy, see **[Project Structure](docs/PROJECT-STRUCTURE.md)**.

| Location | Purpose |
| --- | --- |
| `shared/provider-registry-core.js` | Common validated Provider Registry used by Dashboard and background runtime |
| `background/src/` → `background.js` | Source chunks → generated Manifest V3 service worker bundle |
| `dashboard/src/` → `dashboard/dashboard.js` | Dashboard and General/Provider Settings source → generated runtime bundle |
| `landing/src/` → Landing bundle and Compact Home | Library/navigation logic shared by Wide Landing and Compact Home |
| `providers/`, `common/`, `twitch-workspace/` | Provider adapters, shared playback helpers and Twitch scripts |
| `native/` | C# Native Messaging helpers and Windows installer scripts |
| `release-notes/` | Version notes and [Provider Registry design history](release-notes/PROVIDER_REGISTRY_ROADMAP.md) |

Edit the canonical `src/` files and rebuild generated JavaScript bundles using their adjacent `build-*.ps1` scripts. Before committing or packaging, run `node tools/check-project.mjs` (Node 22+ and Python 3). It verifies all generated bundles, Manifest/HTML asset paths, JavaScript syntax, regression tests and the native C# **source** contract without modifying installed helpers. GitHub Actions runs the same check on pushes and pull requests. See [`docs/CODE_AUDIT_v0.20.17.md`](docs/CODE_AUDIT_v0.20.17.md) for code-care findings and deferred risks. Consult the `SOURCE-README.txt` files before editing compiled bundles directly.

## Privacy, diagnostics and support

Settings, registry configuration, library data and optional tokens are stored in browser extension storage; Stream Shell does not include a project-operated telemetry service. Certain optional features communicate with external services (including TMDB and Return YouTube Dislike). **Full Diagnostics JSON can contain opened URLs, Twitch channels, playback state and configuration. Review/redact exports before sharing them publicly.**

This is a **personal, best-effort project**, not a product with a guaranteed support schedule or compatibility matrix. Site updates and browser changes can break integrations. See [Contributing](CONTRIBUTING.md) and the [Security Policy](SECURITY.md) when reporting issues.

## License and acknowledgements

Source-available for non-commercial use under [PolyForm Noncommercial License 1.0.0](LICENSE.md). Copyright © 2026 Sven Rieseler.

Stream Shell is independent of and not endorsed by Netflix, Amazon/Prime Video, Disney, Crunchyroll, Google/YouTube, Twitch, Discord, TMDB, JustWatch, Return YouTube Dislike or Unified Remote. Service names/logos belong to their respective owners.
