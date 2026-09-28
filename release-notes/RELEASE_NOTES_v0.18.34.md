# Stream Shell 0.18.34 — Twitch Direct Split Lab

## Purpose

0.18.34 adds a deliberately isolated Wide-only Twitch split experiment based on the standalone two-window PoC that rendered reliably in Opera GX.

The goal is to test the proven popup lifecycle inside the real Stream Shell service worker before reintroducing workspace ownership, native titlebar clusters or multi-window automation.

## Direct 50/50 lifecycle

- Added a third `▦` action beside Twitch and Drops on the Wide Landing surface.
- The action opens two fresh Twitch `type:"popup"` windows directly at their final 50/50 coordinates inside the existing `RIGHT` pane.
- Normal click uses the last remembered non-Drops Twitch URL (or Twitch Home) on the left and Drops Inventory on the right.
- Shift-click uses the exact standalone PoC reference pair: `gronkhtv` on the left and `rainbow6` on the right.
- Both windows are born at final geometry. The lab path performs no full-pane bootstrap, post-creation resize, off-screen parking or `restoreWindow()` pass.
- Any existing single managed Twitch popup is retired before the lab pair is created, while its current non-Drops URL is preserved for the left lab slot.

## Isolation

- Lab windows are intentionally not assigned to the normal `twitchWindowId`.
- Native titlebar claiming is intentionally disabled for the lab pair.
- Normal Stream Shell Twitch content scripts still load, so this test isolates the Stream Shell extension/runtime layer from the old multi-window ownership/native-helper stack.
- Returning to normal Twitch, Dashboard, Discord or killing Stream Shell tears down the lab pair cleanly.

## Diagnostics

- Diagnostics schema is now v10 and exports `shell.twitchSplitLab`.
- The lab snapshot includes creation time, requested URLs, final slot geometry and live Opera window/tab state.
- Flight Recorder events identify split-lab creation and user-closed lab windows.

This is an experimental diagnostic bridge, not the restored Twitch Workspace.

**Update:** extension reload only. Do not reinstall the native helper; the split lab intentionally does not use it.
