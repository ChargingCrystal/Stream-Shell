# Stream Shell 0.21.12 — Cross-source Library linking

## Changes
- Same anime saved under TMDB TV and AniList no longer occupies two Library rows if it has a unique title/alias match, the same release year and a compatible medium.
- Joined row preserves the TMDB selection and availability pipeline (provider chips / refresh), and shows AniList cover, score, episode count and metadata. Open Mangayomi remains an app-level action, not a title-specific deep link.
- Data remains in its original independent TMDB/AniList stores: there is no migration, overwrite, automatic deletion, or change to JSON v4 export/import. The Library badge counts the linked pair as one title; both Series and Anime filters include it.
- Only high-confidence matches: no manga or novel merging into TV, no missing/different year, no ambiguous multi-candidate linking. Same title with different seasons can remain separate; future explicit links may improve this.
- No new host permissions, network calls or native Windows helper changes.

## Installation
PATCH over 0.21.11 or install FULL. Reload the unpacked Opera GX extension. Do not reinstall native helpers.

## Testing
Run `node tools/check-project.mjs`; covers source contracts and simulated matching. Confirm the TMDB Solo Leveling (2024) and AniList Solo Leveling (2024, anime) display as one row in Wide and Compact. Confirm both the TMDB availability and AniList metadata, and verify that removing a source entry leaves the other saved entry intact.

## Packaging
As always, user backgrounds and personal artwork must remain outside release ZIPs; GitHub is not changed.
