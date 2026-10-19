# Stream Shell 0.19.24

Twitch Wide 4-slot window assignment and right-side z-order recovery.

- A/B/C/D claims must be explicitly acknowledged by the Windows titlebar helper before Stream Shell marks a window as assigned.
- Missing claims retry on title changes and a throttled 10-second background audit; concurrent claims per window are deduplicated.
- The helper reports expired claims and corrects Dashboard/row z-order drift after applying native Alt+Tab window ownership.
- Right Twitch titlebars now attach to A/B only, never mistakenly to lower-row C/D.
- Twitch pages and existing slot geometry remain untouched; no reload or focus carousel is introduced.
- The runtime `background.js` is rebuilt from the split source files, including the pending Compact source changes from v0.19.23.

**Required after replacing code:** Re-run `native\install-titlebar-helper.cmd` from the updated Stream Shell folder and reload the extension in Opera GX.
