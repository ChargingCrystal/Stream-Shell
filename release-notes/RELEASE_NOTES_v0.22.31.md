## 0.22.31 — Resolve missing Shorts channel identity
- Add current Shorts host variants and grid-shelf-view-model containers.
- Resolve visible/near-visible Shorts by video ID when local channel identity is unavailable. Use a fixed YouTube Shorts endpoint and accept only player details whose video ID matches the request.
- Share one sequential resolver across tabs, with at least 1.5 seconds between network starts, an 8-second timeout, 4 MB response limit and at most 32 pending unique IDs. Duplicate requests share work.
- Persist up to 500 mappings: successful lookups for seven days, failures for ten minutes. Disabled/empty lists stop queued network work. No third-party service or API key.
- Ignore stale card results after navigation; retain the centered 30-degree visual label.
- Validation: API, identity, Shorts shelf and resolver regression tests passed. Live authenticated YouTube/Opera visual verification remains outstanding.
