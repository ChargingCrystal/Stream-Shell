# Stream Shell 0.18.36 — Twitch Persistent Split + Native Cluster Claim

0.18.36 keeps the proven direct-final-geometry 50/50 Twitch pair alive while other right-side surfaces cover it, then adds native member-aware ownership without reviving the retired 0.18.22–0.18.31 workspace/tiler stack.

## What changed

- Dashboard and Discord no longer destroy the split pair when `Keep Twitch active while covered` is enabled. The same two Opera windows stay alive underneath the covering surface.
- Returning to the same split mode raises the existing A/B windows in place. Their URLs are not rewritten and their windows are not recreated, parked or resized, so Drops/stream runtime state can survive the round trip.
- Native titlebar protocol v5 adds explicit `a` / `b` Twitch member claims. Each claim carries the exact 960×1080 half-pane bounds plus the tab-title fingerprint, so both HWNDs can be admitted into one logical `right|twitch` Stream Shell cluster.
- Native taskbar/Alt+Tab reconciliation preserves both Twitch members instead of treating the second one as an unrelated Opera popup.
- A second right-side chrome/backdrop pair covers the stock Opera caption on the second half-window; the first half continues using the existing right-side chrome path.
- Diagnostics expose whether the split is currently visible or merely covered plus the native cluster member count/map reported by the helper.

## Update

Run `native\install-titlebar-helper.cmd` once after replacing the extension because the helper/protocol changed from v4 to v5, then reload Stream Shell in `opera://extensions`. Unified Remote and COBOL finance are unchanged.
