# Stream Shell v0.21.1 — Mangayomi Wide window-anchor hotfix

**2026-10-22 · update over v0.21.0**

## What the live test revealed

Mangayomi starts and appears, but Stream Shell itself minimizes when it opens. v0.21.0 explicitly minimized the LEFT Landing window as part of switching to Mangayomi. On Wide 32:9, however, Landing is the native Alt+Tab OWNER of the shell's other Opera windows, including Dashboard. Windows may minimize owned windows when the owner is minimized. The integration must **cover** Landing with Mangayomi, not minimize it.

## Changes

- Keep the LEFT Landing in normal state behind Mangayomi and restore a Landing left minimized by 0.21.0; mute and minimize only inactive web-provider windows.
- Preserve the RIGHT Dashboard: when rightMode is dashboard, restore it on the right without taking focus; when rightMode is Discord or Twitch, leave it untouched.
- Preserve two-step native app foreground reassert after Opera popup state changes. Preserve the optional native helper and its installation path; this release **does not** require recompiling/reinstalling the Mangayomi native host.
- Compact remains a single pane and does not create a Wide Landing or right Dashboard.
- Adds a stateful VM regression that models the Win32 owner/child minimization coupling, validates repair of 0.21.0 state and keeps native failure side-effect-free.

## Manual retest

1. On Wide 32:9, open Shell Home (Landing LEFT, Dashboard RIGHT). Select Mangayomi.
2. Confirm Mangayomi occupies LEFT, Dashboard stays on RIGHT and remains usable; switch LEFT Mangayomi → YouTube → Mangayomi → Landing.
3. Repeat with Discord or Twitch selected on RIGHT and confirm neither switches/minimizes as a result of opening Mangayomi.
4. Verify that Windows Alt+Tab/Taskbar and native Titlebar behave sensibly while Mangayomi holds focus; cross-process Flutter overlay remains a known open live-test item.

**Unchanged:** v0.20.40 Twitch Raid Guard, Twitch player audio, FMHY, library/watchlist schema v4, provider registry, Discord native host. No user artwork/backgrounds included in the release archives.

## Pending

A live Windows test is needed to confirm the specific HWND/owner behavior and native Titlebar stacking. Dedicated Discord/Mangayomi helper and installer files are scheduled to move from `native/` into `integrations/` in a separate structure release; installer paths are intentionally unchanged here.
