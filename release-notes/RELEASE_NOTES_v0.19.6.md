# Stream Shell 0.19.6 — Twitch Workspace Chatless Audio & Seam Pass

- 960×560 A–D grid on the Wide 3840×1080 reference (20 px overlap per row / 40 px shared middle seam).
- Removed the separate Twitch chat drawer and its HUD action.
- Added persistent per-slot browser mute/unmute in the shared Twitch workspace bar.
- Manual slot audio choices now survive Twitch navigation instead of being re-applied by global Auto Mute.
- One-time v5 → v6 recreation of A–D keeps the no-live-resize compositor rule; any legacy chat drawer is closed during migration.
- Native helper protocol is unchanged; no helper reinstall is required.
