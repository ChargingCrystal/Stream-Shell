# Stream Shell 0.19.21 — Twitch Per-Window Anti-Raid Controls

0.19.21 moves anti-raid policy out of one global Twitch setting and into the four persistent Twitch Workspace windows.

## Twitch

- The Settings switch now only decides whether the anti-raid shield is visible in Twitch HUDs.
- Each Twitch slot has its own anti-raid on/off state.
- Anti-raid is off by default per slot; enabling it affects only that window.
- Active raid detection requires a visible raid surface, avoiding stale-DOM snapback while allowing raid blocking to work again.
- Background raid guards are tracked per tab, so multiple Twitch windows remain independent.

No YouTube or YouTube Music changes are included.
