# Stream Shell 0.18.27 — Twitch Multi-View Window Cluster

## Mixed Twitch Multi View

- `Multi` is now a layout mode instead of a separate Twitch browser window.
- Every Page and Embed instance owns one managed Opera popup and can be included/excluded from Multi View with the `▦` chip control.
- Real Twitch pages (Home, Drops, Campaigns, Following/Directory and arbitrary Twitch URLs) can now be tiled beside stream embed instances.
- Single, Split, Grid and Focus layouts arrange the selected managed windows within the existing Wide `RIGHT` pane.
- Inactive contexts remain warm off-screen so login/session/page state can be reused.

## External audio control

- Stream Shell now mutes Twitch instances at the Chromium tab level rather than toggling Twitch's player mute control.
- Official stream embeds are created logically unmuted; the containing tab supplies Stream Shell's mute state.
- The floating bar speaker toggles this browser-level mute per instance, including Page instances.

## Native Twitch window cluster

- Native titlebar protocol is now **v5**.
- Twitch surface claims carry an instance/member ID so multiple Twitch HWNDs can remain registered under one logical `right|twitch` Stream Shell surface.
- Taskbar/Alt+Tab reconciliation preserves all registered Twitch cluster members instead of minimizing every Twitch HWND except the old single persistent surface.
- Native status exposes the Twitch cluster member count/map.

## Diagnostics

- Diagnostics schema v11 exposes Multi View layout/tiled-instance state.

**Required update step:** run `native\install-titlebar-helper.cmd`, then reload Stream Shell in Opera. No COBOL-finance or Unified Remote reinstall is required.
