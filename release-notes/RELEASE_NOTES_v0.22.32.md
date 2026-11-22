## 0.22.32 — Filter lists, merged search and settings order
- Import multiple independent YouTube filter lists. Enable each list separately and choose Blur with a custom label, or Remove. Existing imports migrate to a Blur list without reimport. Remove takes priority for overlapping channels.
- Remove both stored entries when deleting a linked TMDB + AniList Watchlist row.
- Add a persistent Merged search switch beside the media search summary. Toggle already loaded results between linked and separate views without another search; use the existing Library matching rules.
- Drag Settings categories to reorder them. Persist the order separately for each provider.
- Includes the cumulative updates and release notes through 0.22.31.

Validation: filter API, identity, Shorts resolver, merged search, paired Watchlist removal and Settings/bundle regression tests passed. Browser visual verification remains outstanding: local Chromium cannot start because socket creation is restricted.
