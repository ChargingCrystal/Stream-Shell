# Stream Shell 0.19.13 — Twitch Marbles Chat Auto-Join

- Added optional Marbles on Stream `!play` auto-join for managed Twitch Workspace slots.
- Each slot watches only its own Twitch chat and keeps an independent 120-second cooldown.
- A trigger is chosen between 5 and 10 unique `!play` users inside a rolling 30-second burst window.
- After the trigger, Stream Shell waits 1-4 seconds before submitting one `!play` using Twitch's native chat input/send controls.
- The per-slot cooldown is persisted so a Twitch reload does not immediately reset it.
- Added a short initial hydration guard to avoid treating freshly rendered chat history as a new Marbles round.
- Added a Twitch Settings toggle for the feature.
- No native-helper or Unified Remote reinstall is required.
