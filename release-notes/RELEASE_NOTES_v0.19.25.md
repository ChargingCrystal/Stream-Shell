# Stream Shell 0.19.25

Wide right-pane isolation: Dashboard remains the visible right surface when a provider is opened or resumed from the left Dashboard.

- Native Twitch claim acceptance no longer raises any Twitch window while Dashboard or Discord is the selected right surface.
- Adds a native Dashboard z-order repair to counteract Opera/Windows owner or focus drift when Stream Shell owns foreground.
- Synchronizes Dashboard/Twitch mode with the native helper before restoring/focusing windows during deliberate right-pane transitions.
- Preserves Twitch A–D in memory; no reload, focus carousel, geometry changes or destructive slot resets.

**Install:** Replace the extension files and run `native\install-titlebar-helper.cmd` again, then reload the extension in `opera://extensions`. Existing `assets/backgrounds/` files are intentionally not packaged.
