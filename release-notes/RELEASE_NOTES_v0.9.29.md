# Stream Shell 0.9.29

## Unified Titlebar Navigation

- Removed the Floating Navbar from the runtime path instead of merely hiding it.
- Made the left native titlebar the permanent navigation surface: `Home · YouTube · Netflix · Prime · Disney · Crunchyroll │ Dashboard · Discord │ Kill`.
- Added Dashboard using the former four-tile Floating Navbar SVG, Discord using the existing Discord SVG, and Kill using the existing Stream Shell skull icon.
- Added dividers after Crunchyroll and after Discord, including the required spacing around each divider.
- Recalculated titlebar/button widths for the new navigation set and moved the complete bar roughly 3 px downward for better vertical centering.
- Added a dedicated red hover state for Kill while preserving Dashboard/Discord active-state behavior.
- Removed any leftover Floating Navbar DOM node on startup and stopped its MutationObserver/remount path from running.
- Kept `common/shell.js` as the provider content runtime for Now Playing/scrapers and other shared behavior; only the obsolete Floating Navbar UI layer was removed.

**Native helper:** Reinstall the native titlebar helper because `StreamShellTitlebarHost.cs` changed.

_Recovered from the original Stream Shell development chat / release message._
