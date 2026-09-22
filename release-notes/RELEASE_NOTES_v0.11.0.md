# Stream Shell 0.11.0

## Provider API v1 + Global Continue Watching

- Introduced Provider API v1 as the common shell-facing layer for identity, watch context, media snapshots, playback controls, resume, capabilities and self-test.
- Added provider-agnostic Continue Watching storing provider, URL/media identity, timestamp, duration, title and artwork.
- Automatically removes completed Continue entries at the recovered default 95% threshold.
- Added a Provider Capability Matrix and launch self-test to Diagnostics.
- Updated Settings/Watchlist export/import to v3.
- Added `TODO_RULED_OUT.txt` to record intentionally rejected feature directions.

**Recovered SHA-256:** `5b6c147c6c151813d449c461d4e4f09ab43fc3b2659b9f1c1e43fab92d9fb26e`

_Recovered from the original Stream Shell development chats / release messages._
