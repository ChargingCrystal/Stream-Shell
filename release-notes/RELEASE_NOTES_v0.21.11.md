# Stream Shell 0.21.11 — AniList metadata & Library 2.0

## Changes
- Search sources: TMDB / FMHY / **AniList** in Landing (Wide + Compact), preserving the existing clear-X.
- AniList uses anonymous GraphQL and searches anime, manga and novels. Results display title, cover, year, format, episode/chapter count and score. Detail information (description, genres, alternative titles) is fetched on saving when available.
- AniList results save to the existing local external library, separate from TMDB. Identical AniList IDs are deduplicated, and exact-title manually saved entries are enriched in place.
- Mixed Library sorting works across TMDB and AniList/manual entries; existing Watchlist export/import v4 remains backward-compatible and preserves optional AniList metadata.
- No provider availability, streaming link discovery, AniList login, external MangaYomi database access, background downloads or automatic reading progress tracking. Mangayomi opens as an app, not a per-title target.

## Installation
PATCH over 0.21.10 or install FULL. Reload the unpacked Opera GX extension; new optional permission `https://graphql.anilist.co/*` may need approval. Native helpers **do not need reinstalling**.

## Quality
Run `node tools/check-project.mjs`; test against live AniList endpoint in Opera GX (network API cannot be exercised in offline CI). All backgrounds and user custom artworks must stay outside release ZIPs.
