# Stream Shell 0.19.19 — Twitch HUD Mode-State Fix

## Changes

- The Twitch editor highlights the current effective `Stream`/`Page` mode instead of permanently highlighting `Auto`.
- `Stream` is selectable only on the currently open live Twitch channel surface; profile/sub-pages and offline channel roots keep it disabled.
- Stream chrome cleanup follows the same live-surface guard, preventing Stream styling from leaking onto streamer profile pages.
- Live-surface state is refreshed from finite startup/navigation checks and player lifecycle events rather than a continuous poll.

## Installation note

No native-helper or Unified Remote reinstall is required. Reload the extension after updating.
