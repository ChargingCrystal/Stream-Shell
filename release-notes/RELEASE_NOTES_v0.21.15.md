# v0.21.15 — Mangayomi Global Search experimental deep-link bridge

- Opt-in Shift+click on Mangayomi search actions dispatches `mangayomi://global-search?type=...&query=...` using the existing trusted Native Messaging helper. A normal click retains the proven v0.21.14 clipboard handoff.
- Added a **separate upstream Dart patch** in `integrations/mangayomi/fork-patches/0001-global-search-uri.patch`. A custom Windows Mangayomi build is required. **Stock Mangayomi will ignore the new deep link.**
- This opens Mangayomi's own actual Global Search, which searches installed extensions. It does **not** send search results back to Stream Shell; that needs a second, secured interprocess protocol.
- No background scanner, no URL scraping, no fake availability statuses, no changes to Twitch/Discord/Titlebar ownership.
- Live Flutter build and Windows testing pending. The GitHub repos are not modified.
