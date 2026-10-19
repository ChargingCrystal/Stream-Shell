Stream Shell — custom native titlebar icons

For artwork key `paramount`, the primary native titlebar icon is:
  custom_paramount.png

Put the PNG in this folder and set the provider's Local artwork key to
`paramount` under General > Providers. The image is rasterized to a neutral
monochrome 32x32 icon (alpha retained), independently of the chosen titlebar
accent color. A transparent PNG with a clean silhouette works best.

Fallback order:
  1. native/titlebar-icons/custom/custom_paramount.png
  2. assets/providers/custom/custom_paramount_icon.svg
  3. Provider initials, e.g. P+

The primary PNG is fetched directly by the extension worker (max 16 KiB)
and normalized into a 32x32 neutral monochrome raster by the C# helper.
Only the provider-SVG fallback uses the offscreen renderer. If primary PNG
lookup fails, Diagnostics records the actual reason under
native.titlebarArtwork.primaryFailure. Local custom artwork
is not included in either release ZIP. Reload the extension after changing
artwork. Diagnostics: native.titlebarArtwork reports the chosen source and
fallback reason if necessary.
