# Stream Shell v0.19.32 — Custom Branding Compatibility Hotfix

## Fixed

1. **Wide background on both panes:** Standalone Landing had a five-provider allowlist and fell back to Netflix for custom IDs. Landing now uses the same shared registry and `artKey` as Dashboard, so a `custom_paramount_wide.png` covers both halves of the Wide background. Both panes keep their original 200%-width crop geometry.
2. **SVG-only icons and wordmarks:** Custom provider logos now use SVG, matching the format of integrated provider icons. No PNG fallback for icons/wordmarks; missing SVGs show the original text initials/wordmark. Backgrounds remain PNG.
3. **Live registry changes:** Landing redraws artwork on storage changes. A delayed initial registry read cannot override newer changes. A missing art key keeps a neutral gradient rather than Netflix artwork.

## Required filenames (key `paramount`)

- `assets/providers/custom/custom_paramount_icon.svg` (Dashboard icon)
- `assets/providers/custom/custom_paramount_wordmark.svg` (Dashboard wordmark)
- `assets/backgrounds/custom_paramount_wide.png` (the same image across Landing and Dashboard)
- `assets/backgrounds/custom_paramount_compact.png` (Compact)

Only local extension files are accepted; paths are generated from validated `artKey`. SVG is not directly rendered inside the C# titlebar yet: custom native buttons still use initials.

## Tests and delivery

Run `node landing/tests/provider-background.test.js`, `node dashboard/tests/provider-registry.test.js` plus existing background tests. `landing/landing.js` must bundle the shared registry core before the normal landing chunks; `dashboard/dashboard.js` stays the canonical dashboard source concatenation and `dashboard/compact-home.js` reuses the landing chunks inside its isolated runtime. Check syntax/bundle parity and ZIP CRC. All user-supplied artwork is omitted from Full/Patch release ZIPs, along with shipped background PNGs. Preserve the existing Twitch A–D/native HWND and v0.19.26 provider-focus implementation. No native helper reinstall required.
