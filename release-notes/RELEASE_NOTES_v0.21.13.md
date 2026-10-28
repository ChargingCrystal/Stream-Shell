# Stream Shell v0.21.13 — automatic cross-source enrichment

## Behavior

A new TMDB series/movie save triggers a bounded AniList **anime-only** search (not Mangayomi source scraping), and a newly saved AniList anime triggers a TMDB multi-search when the TMDB read token is available. The explicit save succeeds immediately: discovery happens asynchronously. At most two distinct title or alternative-title queries run per save, and only a unique same-year and same-format title candidate is automatically persisted in the other store. When matches exist, the existing v0.21.12 combined card displays TMDB streaming availability with AniList art/metadata. No unrelated apps, media providers or titlebars are affected.

## Safety / limitations

- Supports AniList `TV` / `TV_SHORT` matched to TMDB `tv` and AniList `MOVIE` matched to TMDB `movie`; no manga/novel/OVA/ONA/special matching.
- Requires exact release-year agreement and unique normalized title or original/native title. Localized titles may not match; ambiguous IDs or an absent year will be skipped rather than guessed. No result means no automatic pair, not absence of availability.
- A configured TMDB token is needed for the AniList -> TMDB lookup. AniList public search needs no account. Network failures do not undo the original save.
- No historical library backfill on install. Previously saved matching pairs still display together; existing standalone older items remain until manually resaved from search.
- Source records and version-4 export/import remain separate; no data migration. No new permissions, Windows native helper rebuild, or backgrounds in distribution.

## QA

Offline regression checks cover bidirectional search, duplicate IDs, format/year/title rejection, missing TMDB credentials and deletion during a pending lookup. Network APIs and Opera GX live behavior still require user verification.
