# Stream Shell — Dynamic Provider Registry / Dashboard & Native Titlebar

**Decision confirmed 2026-10-19. Starting point v0.19.26; first implementation v0.19.27.**

## User-approved behavior (do not re-ask)

- Register and configure any number of providers in **General -> Providers**, with built-ins retaining all their existing integrations. Future custom providers may be given a name, URL, icon/fallback and ordinary managed provider window. Provider-specific player integration is **not** automatically available to a custom site.
- Provider list and its order are persistent and import/export compatible.
- **Dashboard is separately configurable**: pin **1 to 7** providers, no empty or ghost buttons. User chooses which providers and their relative order; there is no mandatory 7-slot placeholder grid.
- **Wide Dashboard row distributions:** 1 => [1], 2 => [2], 3 => [3], 4 => [1,2,1], 5 => [1,3,1] (existing layout), 6 => [2,2,2], 7 => [2,3,2]. Horizontally centered, with the whole group centered. Compact presents its own single vertical list, fitting the existing fixed-height media area.
- **Native left/Compact titlebar is independently extensible**: all enabled providers can appear there, including those not pinned to the Dashboard; no artificial seven-provider cap. Need width/overflow strategy for narrow Compact/very long provider lists (e.g. `...` overflow), and respect window chrome/non-provider controls.
- Adding/removing/reordering providers **while running** updates both Dashboard and native titlebar without restarting the native helper, reloading a playing video or unexpectedly changing focus. Existing provider HWND/tab identity must be stable when only the button configuration changes.
- The right half of Wide (Dashboard/Discord/Twitch A-D), its selection and Z-order MUST remain independent. Preserve v0.19.24 acknowledgement-based Twitch claim recovery and v0.19.26 focus handling; never bring Twitch to front merely because a left provider button was clicked.
- **ZIP releases omit `assets/backgrounds` PNGs**, preserving locally customized images. Keep `provider_wide.png` and `provider_compact.png` naming conventions; custom providers should have a no-image fallback.

## v0.19.27 — IMPLEMENTED / first tranche

- Introduced `dashboard/src/provider-registry.js` and persisted `streamShellProviderRegistry` configuration; schema version 1 has built-in provider entries, dashboard ordering, titlebar ordering placeholder, pin flags. Built-in defaults match 0.19.26.
- Replaced fixed five-button Dashboard HTML with DOM renderer; preserves current 5-button [1,3,1] at default. Encodes 1..7 layouts and adds centered compact-short-list handling / 6-7 compact geometry.
- Added **General -> Providers** settings page to pin/unpin and move **the existing five providers** (minimum one pinned). Changes save to `chrome.storage.local` and apply to Dashboard immediately, including playback and availability indicator reattachment.
- Registry is included in settings export/import (normalizer handles object format).
- Test `node dashboard/tests/provider-registry.test.js` verifies default/normalization and all seven renderer row layouts. No native C# change: **do not run helper installer solely for v0.19.27**.
- **NOT yet supported:** entering a custom URL, actually adding a sixth/seventh provider, dynamic titlebar control, separate titlebar custom order UI. Titlebar stays identical to v0.19.26; this is intentional, not a completed implementation.

## v0.19.28 — IMPLEMENTED / custom provider windows (Phase 2)

- Shared registry core (`shared/provider-registry-core.js`) is bundled before Dashboard/Background source. Schema v2 accepts custom ID/name/HTTPS URL/text icon with strict validation and deduplication, retains v1 built-in registry settings, and preserves separate Dashboard/Titlebar orders for Phase 3.
- General -> Providers allows custom add/edit/delete, enable/disable and Dashboard pin/reorder; explicit 1..7 limit only applies to pinned Dashboard cards. Text-only icon fallback avoids missing assets; no custom site's CSS/JS is injected and no host permission is requested just to open a normal HTTPS window.
- Background window manager resolves custom targets on demand, retaining existing popup IDs when only registry metadata changes. URL edits take effect on the next explicit activation; removal closes only the owned custom window, cleans its URL key and switches away if active without changing Wide rightMode.
- Dashboard/Background Node mock tests exercise 1..7 grids, URL safety, duplicate IDs, warm window reuse, intentional navigation, left/right isolation and no custom deep-link integration. **Opera GX/native HWND tests not yet run**.
- Native C# helper and its existing five left-side buttons **remain static**. Do not reinstall helper solely for 0.19.28. Users cannot currently activate custom providers from native Titlebar.

## v0.19.29 — IMPLEMENTED / browser visual regression repair

- Windows/Opera GX six-button screenshot exposed an actual geometry defect: flex children were given unequal outer widths when custom icon padding differed from built-in padding. Wide row renderer now uses CSS Grid equal border-box tracks, while maintaining all approved row patterns and original row width budgets; Compact still flattens rows into a vertical list.
- Custom provider visual defaults now include a neutral CSS gradient plus their configured name as non-interactive low-opacity wordmark, avoiding a broken empty `<img>` element. This is NOT a real brand logo, automatic custom image loading or an expanded custom-asset editor.
- Browser live check to request: six buttons all equal in width, five maintains original 1–3–1, seven 2–3–2, Compact, no broken wordmark. Paramount+ gray page is UNRESOLVED; verify regular Opera GX tab at identical URL before changing window manager or adding site-specific hacks. Opera is not on Paramount+'s officially supported browser list.
- No native titlebar/helper, provider routing, right pane, Twitch recovery or Discord logic changed.

## v0.19.30 — IMPLEMENTED IN CODE / Phase 3 (Windows runtime verification pending)

- General -> Providers has separate **Native titlebar** visibility and reordering controls, regardless of Dashboard pinning or its seven-button cap. All enabled titlebar-marked entries are sent in `titlebarOrder`. Global Enabled remains shared.
- `background/src/06-titlebar.js`: independent protocol-v7 provider-list transport, UTF-8/base64 row payload, strict normalized records, monotonic generations, acknowledged updates with retry, reconnect replay, storage-change race guard. This does not touch left/right HWND claims, Twitch recovery or focus.
- `native/StreamShellTitlebarHost.cs`: dynamic left/Compact provider buttons, preserved built-in icons and global-control positions, geometry/dividers/hit-test updated, fallback text initials and native `...` overflow popup for hidden buttons. Right Dashboard/Discord/Twitch arrays unchanged.
- `node background/tests/dynamic-titlebar.test.js` tests ordering, independent pin/visibility, UTF-8 and acknowledgement/retry. JavaScript bundles rebuilt and syntax checked. **No Windows C# compiler/Opera GUI in the build environment; the native code needs on-device compile/install and interactive verification.**
- Installer **MUST** be rerun (`native\install-titlebar-helper.cmd`) after v0.19.30 extraction, then reload Opera GX extension. Extension & helper protocol bumped **6 -> 7**. When the old helper is still running, handshake intentionally refuses the connection until it is replaced.

## v0.19.31 — IMPLEMENTED IN CODE / first local branding + Twitch telemetry

- Custom providers can specify an optional stable **Local artwork key**. Safe derived paths for PNG icon/wordmark + Wide/Compact backgrounds inside the installed extension. Image fallbacks do not require image files, and all custom media and background PNGs are excluded from ZIPs. No arbitrary local-path/remote-URL loads, provider navigation or native C# changes. Custom native Titlebar continues displaying initials.
- Twitch runtime diagnostics now return visibility/focus, per-slot heartbeat timer drift and `!play` observation/join timing on demand from the actual Twitch content script. Query each slot with a bounded timeout; no periodic storage writes, no Twitch state/automation behavior changes. Full JSON export includes per-slot measurements, and the overlay summarizes availability/delays. Capturing a delayed session is required for a conclusion.
- Tests: Node regression suites, JS syntax, bundle parity and release ZIP integrity. Opera GX visual/rendering and observed MoS runtime still require user verification.

## v0.19.32 — IMPLEMENTED IN CODE / background parity and SVG-only custom icons

- Landing now resolves custom `activeProvider` through the same registry and artwork key as Dashboard; custom Wide background is applied to BOTH panes. In Compact the normal compact suffix remains. Missing assets retain neutral/text fallback. The Landing registry is re-read on storage updates, with race-safe initial loading.
- Custom **icon + wordmark only accept local SVG files** (`custom_<key>_icon.svg`, `custom_<key>_wordmark.svg`); custom **backgrounds remain PNG** (`custom_<key>_wide.png`, `custom_<key>_compact.png`). This supersedes v0.19.31's PNG-icon convention. No embedded custom images in distribution ZIPs, no C# changes.
- Native Titlebar custom buttons still use text/initials. Native SVG icons and Settings-based image imports are separate follow-ups. Opera GX visual test is outstanding.

## v0.19.33 — IMPLEMENTED IN CODE / native icon pipeline and color overrides

- Added native icon override convention (`native/titlebar-icons/custom/custom_<key>.svg`) with primary priority; normal custom provider icon SVG is converted to a **monochrome accent-tinted raster** if no native icon exists; initials if neither works. Images are rasterized in extension context and sent as bounded PNG payload; C# uses System.Drawing only to draw PNGs.
- Per-provider titlebar accent (`titlebarColor`) stored in registry with strict #RRGGBB validation. General > Providers > Native titlebar offers both picker and editable hex field. The chosen color controls a darkened native Titlebar/DWM theme as well as fallback icon tint. Built-ins preserve previous themes/icons unless explicitly tinted, custom primary SVG keeps original colors.
- Native protocol **v8** adds color and image fields; reinstall helper. Windows/Opera live verification pending. No changes to Twitch/Discord/right-pane code.
- Custom art remains excluded from release ZIPs, including native override SVGs. Existing background/wordmark handling remains the same.

## v0.19.34 — CORRECTIVE RELEASE / duplicate fields, SVG renderer, monochrome theme separation

- Opera GX screenshot demonstrated duplicate native titlebar color controls and text (`P+`) despite local custom SVG. Root issues: duplicate titlebar-row HTML in v0.19.33; MV3 SVG blob decoder + arbitrary 3-KB PNG limit silently fell back to text. Correct to one theme color picker + hex field.
- Shared offscreen document (`offscreen/volume-audio.html`) now loads `offscreen/titlebar-svg.js` in addition to unmodified volume-audio.js. DOM Image decode -> 32x32 Canvas -> alpha-preserving fixed neutral gray raster; only validated local icon paths accepted. The existing `ensureVolumeOffscreenDocument()` creates/reuses the document; do NOT create a second offscreen document or terminate an ongoing audio session when converting icons.
- Both native primary SVG and provider SVG fallback are rendered NEUTRAL MONOCHROME. Per-provider `titlebarColor` only customizes titlebar/DWM chrome, hover and active background; never image pixels or initials. Builtins keep their original images and theme colors if unset.
- `background/src/09-message-router.js` includes `titlebarArtwork` in diagnostics response; `dashboard/src/settings-diagnostics.js` preserves it under `native.titlebarArtwork` in full JSON. If an icon is not shown, distinguish `artwork-key-not-set`, `file-missing`, `svg-render-failed`, etc. Before blaming renderer, ensure **Local artwork key** is set to the same key as the SVG filename.
- C# updated for larger bounded PNG payload, no TintIcon color matrix. Protocol stays at **v8**, but native helper **must be reinstalled** because C# source changed.
- DO NOT touch current Twitch/Discord owner, C# Z-order/restore, native action bindings, Wide panes, custom URL routing, or browser-specific provider adapters. User custom SVGs and backgrounds remain excluded from ZIPs.
- Real Windows SVG rendering and offscreen/audio concurrency have NOT been tested in Opera GX. Test primary SVG, fallback when primary absent, text when both absent, active color themes without icon tint, live updates/overflow and a working volume booster.

## Next implementation stages / not yet confirmed

1. **Native live validation:** Reinstall helper, switch titlebar providers under Wide (32:9) while streaming, test Compact 16:10 and 16:9, verify no flicker/focus stealing and native `...` overflow at low pane width/high DPI, verify helper restart/reconnect preserves active provider HWND and buttons.
2. **Custom branding/editor:** Custom icons/wordmarks are now SVG-only (0.19.32), backgrounds PNG. Direct artwork importing via Settings is explicitly ruled out by user (manual folders preferred). Native PNG primary was verified live in v0.19.37. Remaining: Compact/high-DPI and overflow live verification. Keep user artwork out of ZIPs.
3. **Optional hardening:** Native menu height with 100+ titlebar entries, titlebar DPI-specific screenshots and media adapter behavior. Never accidentally turn plain HTTPS providers into injected/custom-player providers.
4. **Hard regression guard:** v0.19.24 Twitch A–D accepted claims and v0.19.26 left-only focus/right pane isolation, plus Dashboard/Now Playing. Do not reintroduce v0.19.25's permanent Z-order repair loop.

## Technical location shortcuts

- Dashboard bundle order: `dashboard/build-dashboard.ps1`, generated `dashboard/dashboard.js` (MUST rebuild after editing source chunks).
- Registry + Dashboard renderer: `dashboard/src/provider-registry.js`. General settings: `dashboard/src/settings-config.js`, `dashboard/src/settings-runtime.js`, `dashboard/src/settings-controls.js`. Dashboard markup/styles: `dashboard/dashboard.html`, `dashboard/dashboard.css`.
- Background bundle: `background/build-background.ps1`, generated `background.js`; routing in `background/src/09-message-router.js` and `background/src/02-providers.js`.
- Native titlebar in `native/StreamShellTitlebarHost.cs`, installed with `native/install-titlebar-helper.cmd`. Native actions/transport in `background/src/06-titlebar.js`.
- DO NOT mistake v0.19.27's Dashboard-only settings for working custom provider and native titlebar support.

### v0.19.35 — Compact settings and native PNG primary

Custom provider Add/Edit no longer displays the bulky example file paths or generic
help copy. The fields are sufficient. Native titlebar **primary** is now the locally
provided `native/titlebar-icons/custom/custom_<key>.png`, not a `.svg`.
The optional `assets/providers/custom/custom_<key>_icon.svg` remains the automatic
monochrome fallback, and the custom initials are last. The existing offscreen DOM
renderer accepts both safe local image forms; monochrome applies to icon pixels,
while the separately configured hex color controls chrome/active/hover backgrounds.
No Native Messaging protocol changes and no C# helper changes; extension reload only.
Use `native.titlebarArtwork` in exported Diagnostics to verify `native-png` source.

### v0.19.36 — Non-blocking native provider list / isolated icon failure

Fixes the v0.19.35 regression in which the custom provider can disappear from the native toolbar. Provider text rows are now sent before the offscreen renderer is used; the later PNG/SVG icon pass is optional, capped at 2.5 seconds per local asset. Native rejects corrupt / oversized images individually, never whole provider configurations. The helper's decoded PNG limit now matches the JS Base64 size budget. New diagnostics field `native.titlebarProviderSync` shows the native ack/generation, last error and number of rejected icons, next to per-provider `native.titlebarArtwork`.
This C# helper update requires re-running `native\install-titlebar-helper.cmd` after applying the patch; protocol stays v8. All local icons/backgrounds are user-maintained and excluded from release archives.

### v0.19.37 — Primary PNG without offscreen renderer

Observed: v0.19.36 logs `primaryFailure: offscreen-timeout` with `source: provider-svg`, though the primary PNG was placed locally. The fallback is correctly working; the PNG decode chain is not. Now the MV3 background worker fetches validated raw primary PNG bytes from its own extension directory (up to 16 KiB). Native C# code validates PNG signature/dimensions, scales to 32px and neutral-monochrome normalizes it, retaining transparency. SVG fallback only uses the existing DOM offscreen renderer. The text-first titlebar synchronization and the right pane's HWND ownership remain unmodified. Protocol v9 requires reinstalling helper. **Windows compile and live Opera tests are required; do not claim native raster confirmed before testing.**

### v0.20.0 — Provider settings layout milestone (2026-10-19)

User-tested v0.19.37 confirms custom native PNG primary succeeds and native Titlebar sync is acknowledged. Use this as stable baseline; NO icon/window-helper changes for this version. **General → Providers** now displays Dashboard and Native Titlebar management next to each other on wide displays, with compact dense rows; responsive single-column below 1360 CSS pixels. Add/Edit fields are Name (25%), Initials (10%), HTTPS URL (65%) in the same row, Artwork key plus actions below, and five concise local file paths (SVG provider icon/wordmark, PNG native titlebar/Wide/Compact) that update as key is typed. No direct Settings upload: user explicitly prefers manual asset placement. Preserve artwork/Background ZIP exclusion. Native protocol v9; no reinstall required. Remaining validation: actual Opera GX visual Compact at 16:9/16:10, overflow under high DPI, long provider lists, and user testing of custom provider actions. Do not touch Twitch A-D or left/right HWND behavior in a layout release.
