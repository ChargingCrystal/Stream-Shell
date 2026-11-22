# Stream Shell 0.22.23 — Viewer-based auto-join and compact Twitch settings

Author: Sven Rieseler

Apply over 0.22.22. Reload the extension in opera:extensions and reopen Stream Shell. No additional native-host reinstall is required for this version. Reopen Twitch windows to load the updated automation.

- Replace absolute message thresholds with configurable minimum/maximum viewer percentages. Read the displayed viewer count on startup and once every five minutes per Twitch window, with no API calls or viewer-count mutation observer. Round the randomized percentage threshold up to whole distinct chat users; wait when the count is missing or belongs to another channel. Retain jitter, chat freshness safeguards and per-slot cooldown. Compact range fields into a responsive two-column grid and place Audio alongside Auto-join. Restore missing release history.

Background artwork is not bundled.
