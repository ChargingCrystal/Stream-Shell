# Stream Shell 0.19.20 — Twitch Auto-Mode Scope Correction

0.19.20 narrows the 0.19.19 live-surface restriction to the place it was intended: Auto mode.

- Auto uses the live Twitch surface detector and resolves streamer profiles/offline channel roots to Page.
- Auto resolves a confirmed live watch surface to Stream.
- Manual Stream is again a user-authoritative override and is never disabled merely because the current page is a profile/sub-page.
- HUD mode coloring continues to represent the effective Stream/Page presentation rather than the Auto policy selector.
- Everything outside Twitch HUD mode selection is unchanged.

No native-helper reinstall is required.
