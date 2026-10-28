# Stream Shell v0.21.27 — FMHY Discovery 2.0

**Date:** 2026-10-23

## Search

- Source order: **TMDB → AniList → FMHY** on Wide and Compact, TMDB remains the default.
- Search types use permanent multi-select chips below the source tabs. TMDB: Movies/Series; AniList: Anime/Manga/Novels. Zero selections = show all; multiple selections = union. Filtering works against already-loaded search results, without API re-requests.
- The Library's existing type filter and stored items are unchanged.

## FMHY Discovery 2.0

- Live discovery now reads nine explicitly chosen sections from FMHY's public Markdown directory: Video, Reading, Audio, Video tools, International, Downloads, Torrenting, Learning, Web tools.
- Independent **Area** and **Kind** multi-select filters, plus title-first relevance sorting and optional FMHY community-star indicator.
- Distinguishes streaming websites, downloads, libraries, indexes and tools using **heuristics** derived from source section/description. These labels do not certify a site's capabilities or status.
- Reports partial live availability (e.g. 7/9 documents loaded). If none are available, clearly labels the bundled limited offline excerpt. Source links remain external and can still be saved to Direct.

## Install / verification

Copy over the existing Stream Shell files and reload the extension from `opera://extensions`. Local background assets are excluded. No native helper reinstall or Flutter build is needed. Use `node tools/check-project.mjs` for source, bundle and offline JS regression checks. A browser-live network test was not performed in this environment.
