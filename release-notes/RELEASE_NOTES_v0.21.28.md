# Stream Shell v0.21.28 — FMHY Category Discovery

**Date:** 2026-10-23

## New browsing behavior

- On **FMHY**, select an **Area** chip without typing: Stream Shell loads that directory category and shows its resources automatically.
- Areas also act as category searches when a previous search term is present: selecting an Area clears that term; type a new keyword afterwards to refine your chosen areas. Multiple Area chips are OR-combined, Kind chips are OR-combined, and the two groups are AND-combined.
- **Gaming** combines `gaming.md` and `gaming-tools.md` from the live `fmhy/edit` Markdown directory. The 9 previous areas remain, for **10 visible areas / 11 source documents**.
- In textless category mode, resources FMHY labels with ⭐ appear first; no invented star ratings or external safety judgments are assigned. Text searches keep title-oriented ranking.
- Results show in 60-item pages with **Show more**; no hidden truncation after the first page.

## Existing behavior preserved

- TMDB, AniList, Library, Mangayomi, Dashboard and native helpers unchanged. FMHY opens normal external Opera links or saves them to **Direct**.
- Previously successful FMHY requests are served from the existing bounded in-memory cache. Per-area failures are reflected in the live count; a clearly marked small offline excerpt remains available when all live documents fail.
- No new network origin permission, native installation or Flutter rebuild. User wallpapers/backgrounds remain local and are not included.

## Install and test

Overwrite your Stream Shell extension files with this package and reload the unpacked extension under `opera://extensions`. Run `node tools/check-project.mjs` for offline syntax, bundle and regression checks. A live Opera GX session remains the final browser verification.
