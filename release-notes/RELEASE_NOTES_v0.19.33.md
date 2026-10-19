# Stream Shell 0.19.33 — Native SVG icons & titlebar palette

## Design decision

Primary user-supplied native SVG under `native/titlebar-icons/custom/custom_<key>.svg` keeps its original colors. Fallback automatically rasterizes `assets/providers/custom/custom_<key>_icon.svg` into monochrome (accent tinted); final fallback is the configured provider initials. The key is the existing validated `artKey`, not the provider's label or URL. No separate PNG versions to maintain.

## Settings

General > Providers > Native titlebar includes a color picker + editable hex input for **every provider**. Accepted format `#RRGGBB` (case-insensitive, normalized uppercase); clear the hex field to return to the default. Built-in PNG icons keep their original colors by default and become monochrome-tinted only when a color is specified. Custom override SVGs preserve their own colors; the fallback SVG and textual initials obey the chosen color. The chosen hex also generates a dark-toned native Titlebar palette (background, hover, active, caption and border), including a live refresh when it changes. Built-in themes remain unchanged without an override. Saved through `streamShellProviderRegistry` like other provider settings.

## Runtime architecture

Chrome MV3 background reads only extension-local SVG paths, uses browser ImageBitmap + OffscreenCanvas to render a transparent 32x32 PNG, and sends bounded base64 PNG through the existing versioned native provider update. C# validates PNG signature, pixel dimensions, content length, provider ID and color; it never parses an arbitrary SVG directly. Parsed bitmaps are held until safe release to avoid drawing a disposed Bitmap in the native overlay. Missing/unreadable assets are nonfatal. Cached SVG rasterization resets after extension reload.

- Primary: `native/titlebar-icons/custom/custom_paramount.svg`
- Fallback: `assets/providers/custom/custom_paramount_icon.svg`
- Wordmark (Dashboard, unchanged): `assets/providers/custom/custom_paramount_wordmark.svg`
- Backgrounds (unchanged): `assets/backgrounds/custom_paramount_wide.png` and `custom_paramount_compact.png`

No user SVGs, icons or background PNGs are shipped inside either ZIP. All files remain local during update. Changing files requires an extension reload; changing colors/reordering in settings updates the titlebar live.

## Regression scope

No Twitch, Discord or right-pane focus/recovery edits. Native provider message protocol **7 to 8**, so reinstall `native/install-titlebar-helper.cmd` and reload Opera GX extension. Unit tests cover priority, rendering fallback, color, payload, reuse; Windows C# compile and actual native SVG rendering remain to be verified locally.
