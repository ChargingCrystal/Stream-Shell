Stream Shell dashboard source layout
====================================

Runtime rule
------------
Opera loads dashboard/dashboard.js only. Do not add the files in dashboard/src to dashboard.html.

Development rule
----------------
Edit the feature files in dashboard/src, then run build-dashboard.ps1. The script concatenates the source files byte-for-byte in the required order and writes dashboard.js.

This deliberately avoids ES modules, extra <script> tags, bundlers and declaration/hoisting changes in the dashboard runtime.

Source order (consult build-dashboard.ps1 for authority)
-------------------------------------------------------------------
- ../shared/provider-registry-core.js  validated shared registry (prefixed to bundle)
- state.js
- provider-registry.js           dynamic Dashboard cards, separate titlebar management, custom provider settings
- contextual-motion.js
- now-playing-ui.js
- now-playing-artwork.js
- now-playing-progress.js
- now-playing-render.js
- clock.js
- svg-helpers.js
- availability.js
- provider-search.js
- provider-open.js
- selected-media.js
- settings-config.js
- settings-storage.js            Dashboard hydration, import/UI validation, ordered per-key writes
- settings-controls.js
- settings-diagnostics.js
- settings-provider-pages.js
- settings-runtime.js
- click-router.js
- compact-home-loader.js        loads dedicated Compact Home bundle in Compact only
- shell-state.js

Compact bundle dashboard/compact-home.js is separately built from
compact-home-prefix.js + the canonical landing/src chunks +
compact-home-suffix.js. The browser does not load those landing chunks in
Wide's Dashboard.

Notes
-----
The former settings-center.js source exceeded 120 KB and mixed configuration, generic controls, diagnostics, provider pages and runtime event handling. 0.12.0 split it into focused source chunks without adding runtime scripts; dashboard.js remains the single dashboard runtime bundle.

Settings export filenames/version metadata derive from manifest.json instead of carrying a second hardcoded extension version.

0.12.1 Diagnostics performance pass
----------------------------------
Panel snapshots probe only the active provider live; inactive provider capability state falls back to cached launch self-test reports. Full multi-provider diagnostics are collected only for explicit JSON export. The Diagnostics overlay avoids backdrop blur, suppresses painting of the covered Settings workspace, and uses content-visibility containment for off-screen sections.

0.13.x display profile foundation
---------------------------------
Settings exposes the global Auto/Wide/Compact display mode only under the General tab; provider sidebars contain provider-specific controls. Diagnostics schema v9 renders the background display inventory/profile state, including target bounds/scale, applied geometry and planned geometry.

0.13.1 anchors the legacy panes to the selected display. Wide uses the real 32:9 virtual-desktop coordinates. Compact is still pre-host and temporarily fits both legacy panes inside the 16:10 work area until the merged single-screen Shell Home replaces them.

0.14.0 Compact Shell Home
-------------------------
The dashboard bundle now appends Landing's media/subscription source chunks inside an isolated async scope that initializes only for layoutProfile=compact. This preserves one dashboard.js runtime while reusing Watchlist/Search/Continue/Recent/Direct/Subscriptions logic without duplicating it. Wide does not initialize the Compact block.

Compact uses the Dashboard as the only Shell Home window. Provider windows share the same full work-area geometry and are swapped with Dashboard; the standalone Landing window is not created in Compact.

0.14.1 Compact stability isolation
---------------------------------
The Landing-derived Compact Home runtime is no longer appended to dashboard.js. dashboard.js stays close to the pre-Compact Wide bundle and contains only a tiny compact-home-loader.js. In Compact sessions that loader injects dashboard/compact-home.js; Wide never downloads/parses/executes the 80+ KB Watchlist/Search/Subscriptions runtime. The Compact bundle is built from compact-home-prefix.js + the canonical Landing source chunks + compact-home-suffix.js, so the feature logic still has one source of truth.

0.14.3 Compact layout rhythm / source-of-truth rule
--------------------------------------------------
Compact layout geometry derives its physical spacing from the established Wide UI and halves those measurements for the laptop's 200% Windows scale. Watchlist/Search/Continue/Recent/Direct/Subscriptions remain sourced only from the canonical landing/src chunks. landing.js and compact-home.js are generated host bundles; never fork feature/data logic into dashboard/src just to support Compact presentation.

0.20.22 import/UI validation
---------------------------
The settings-storage.js normalizer constrains Dashboard options and numeric inputs and checks imports before any storage mutation. Scoped display migration removes only explicitly covered base keys. Other scripts' independent settings storage is not redirected.
