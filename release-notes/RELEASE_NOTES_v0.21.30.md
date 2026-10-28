# Stream Shell 0.21.30 — Compact Home parity

A single Compact dashboard for both 16:9 and 16:10 now takes full advantage of the screen, using the same configured dashboard providers and native titlebar as Wide.

## Layout

- **Removed** Compact Subscriptions entirely, including its UI DOM. The Wide Landing subscriptions widget and user-stored subscription data remain available as before.
- Extended the provider rail and Watchlist/Search panel to the former bottom edge of the removed subscriptions card. The library and search panels now have noticeably more vertical space.
- Increased the rail width from 270 to 306 CSS px on 16:10 and from 304 to 352 CSS px on 16:9; the existing provider-to-media column gap and right/left outside margins stay exactly the same.
- The same selected/pinned Dashboard providers as Wide render in Compact. One to seven buttons are stacked with a dynamic height/spacing based on the selected count; a zero-provider config remains empty rather than throwing an error. Custom icon artwork remains supported.
- Titlebar order, visibility and theme color are still configurable in General → Providers and already use the same registry in Compact. No duplicate titlebar settings or native rebuild.

## Installation

1. Overlay the ZIP on the existing Stream Shell extension directory. Backgrounds are intentionally not in the archive; personal artwork is preserved.
2. Reload the extension under `opera://extensions` and open Compact Shell Home.
3. In **General → Providers**, change pinned Dashboard provider counts and order; independently configure Titlebar entries and colors, then try both Compact ratios.

This release changes only the extension's HTML/CSS/JS and documentation. **No C# helper reinstall or Flutter build needed.** JS/structural tests are green, but an actual Opera GX 16:9/16:10 visual pass is still needed.

### Deferred native issue

The already-reported persistent `TitlebarNativeHost` process after closing Opera GX remains tracked. It was **not altered in this layout-only update** to avoid introducing an unverified native-host change while the new performance blackbox is being evaluated.
