## 0.22.33 — Filter controls and merged search fix
- Reuse Settings switches for global filtering, each filter list and Merged search.
- Place filter enable/import actions beside the page title. Keep delete actions in a fixed trailing column, using the existing dark Settings X button. Preserve blur-field alignment across modes; wrap controls on narrow layouts.
- Fix merged search: AniList API search results lack the Library source field. Tag results at the merge boundary without modifying the raw cache, so matching entries merge and unmerge without another request.
- Regression test now uses the actual search-result shape without a stored Library source or ID.

Validation: cached merge/unmerge, paired Watchlist removal and bundle tests passed; JavaScript syntax checks passed. Live Opera visual verification remains outstanding.
