# Stream Shell v0.21.14 — Mangayomi Search Handoff

The first safe stage of a future Global Search integration. A magnifier on AniList results and Anime/Manga/Novel library rows copies the exact title to the clipboard **before** opening Mangayomi in the left pane. Select Global Search in Mangayomi and paste with `Ctrl+V`.

**Honest boundary:** the stock Mangayomi app has no callable external Global Search/deep link or source-results API. This release does not automatically query Mangayomi's extensions or return provider availability. An actual source-search bridge needs a Mangayomi-side update or fork; see `integrations/mangayomi/SEARCH-BRIDGE.md`.

- Based on v0.21.13; no native helper reinstall, new permissions, database migration, automatic web requests or UI automation.
- Existing TMDB/AniList cross-source enrichment, cards, imports/exports and Window/Titlebar behavior unchanged.
- Patch excludes local wallpapers and custom artwork.
