# Stream Shell v0.21.31 — Compact Search + Seven Seas

## Compact UI (16:9 and 16:10)
- Search source tabs are on their own line. The summary and multi-select filters wrap within the panel instead of competing for one horizontal row.
- FMHY Area and Kind chips wrap naturally with normal readable font sizes: no horizontal scrollbar; panel body consumes remaining vertical space.
- Exterior gaps and provider/media column layout from 0.21.30 remain unchanged. No changes to Wide window geometry.

## Media search
- **Media · TMDB + AniList** replaces separate TMDB and AniList search tabs.
- Each search runs both catalog queries and presents attributed TMDB results followed by AniList results, with grouped headings.
- Five combined multi-select filters: **Movies, Series, Anime, Manga, Novels**. Empty selection means all types; toggles reuse cached data and do not refetch.
- One unavailable API does not hide results from the other. A missing TMDB token is indicated in the summary; AniList remains functional.
- TMDB Watchlist and AniList external Library continue as separate data stores; no schema migration or ID conflation.

## Seven Seas acknowledgement
- Settings → General → **Seven Seas** contains the off-by-default master switch **“I acknowledge the existence of the seven seas”**.
- A visible disclaimer explains that third-party sources might contain unlicensed material and that the user is responsible for their chosen sources and content. The acknowledgement is not a guarantee of legality.
- When off: FMHY tab cannot be selected; FMHY index fetch is denied. Mangayomi cannot be enabled in Provider controls, shown in the Dashboard/titlebar or invoked using native lookup/navigation. This is enforced in the runtime, not only by CSS. Native `hide` remains available for clean switching on revoke.
- When enabled: normal FMHY and configured Mangayomi behavior becomes available. Future optional Stremio integration can reuse the same setting; none is included here.

## Install / verify
1. Overlay this code-only ZIP on the existing Stream Shell directory; leave local background artwork untouched.
2. Reload the extension at `opera://extensions` and reopen Compact Home.
3. Search a term and switch Movies/Anime/Manga chips; both catalog groups should appear when available.
4. Confirm FMHY and Mangayomi are disabled before the opt-in; enable General → Seven Seas, then test FMHY and Mangayomi. Turn it off again to verify immediate denial.

No native helper or Mangayomi Flutter rebuild is required. Source syntax/regression tests run on Linux; Opera GX/Windows UI acceptance remains pending. The previously reported orphaned TitlebarNativeHost process is still scheduled for a dedicated native lifecycle patch, not changed here.
