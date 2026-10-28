# Stream Shell v0.21.3 — FMHY Cards, Library UX, Mangayomi Titlebar

**Base:** 0.21.2. Hotfix release, not a new subsystem. No changes to Twitch/Discord controls or the Mangayomi launcher, FMHY fetch URL, TMDB metadata, or user's image assets.

## What changed

1. **FMHY:** The cards had only two children but inherited `.media-item`'s three-column layout (`34px 1fr auto`), forcing title/details into the narrow icon cell. Each result now renders an `↗` launch icon, flexible title/category/source/hostname/2-line description, and `♡` Save-to-Direct action as three explicit children. `▷` section navigation links are excluded from results. Visual treatment follows existing Stream Shell Media and Direct Links cards. Wide Landing and Compact Home CSS are kept aligned.
2. **Library:** Remove the duplicate Manga/Anime/Novel native dropdown. Category chips handle selection and filter simultaneously. On Anime/Manga/Novels, a neutral-styled one-line add form uses the selected type. On All/Movies/Series it is hidden; TMDB search continues to add films and series. Existing watchlist and external library storage/import/export schema remain unchanged. Search source (TMDB vs FMHY) and Sort are independent data-source/order controls, not additional media categories.
3. **Mangayomi titlebar:** 0.21.2 exempted a matched left Mangayomi HWND from the foreign-foreground occlusion gate, but Wide chrome was only pushed TOPMOST when geometry or visibility changed. If Mangayomi raised itself above the overlay later, the toolbar stayed behind it. Add a Z-order check/reassert for the *left chrome backdrop and left controls only*, conditioned on Wide + `leftMode=mangayomi` + heartbeat + matching process + largely pane-filling left rectangle + known claimed Landing anchor. Right pane, Discord, Twitch and unrelated applications retain their prior ordering.

## Apply / test

- Unpack **PATCH over v0.21.2**, or use FULL. No migration or Discord/Mangayomi native-host reinstall required. Existing `integrations/` structure is retained.
- **Re-run `native/install-titlebar-helper.ps1`** to rebuild and install the changed shared C# Titlebar helper. Then reload the Opera extension/restart Stream Shell.
- Open Mangayomi via its Dashboard button: left 1920×1080 Mangayomi, right Dashboard and **clickable native Titlebar over Mangayomi**. Switch provider → Mangayomi → provider. Cover left pane with another unrelated application; titlebar must *not* float above it. Open Discord on right; it should keep its pre-v0.21.0 layering.
- For a useful live Diagnostics export, capture it while Mangayomi is *still open on the left*. The native status now includes `leftMode`, `leftChromeVisible`, `leftToolbarVisible` and `mangayomiWideChromeRepairs` to tell whether the repair was attempted; v0.21.2's export was after switching back to YouTube.
- If you want a **Mangayomi button inside** the titlebar, separately enable `Show in Titlebar` for Mangayomi in Provider Settings; your v0.21.2 Diagnostics reported it disabled. The toolbar should remain visible regardless of that setting.
- FMHY query `manga`, click open/save; results must show full-width titles and descriptions. Library filter Manga/Anime/Novels and save an entry, switch All, then ensure import/export is still intact.

## Quality / limits

- Run `node tools/check-project.mjs` for Linux JS syntax, source/bundle parity, UI contracts and native source checks. These checks do **not** replace compiling/running the C# helper or visually testing Win32 Z-order in Opera GX on Windows.
- Backgrounds and private provider artwork are absent from distributed ZIPs. No repository push.
