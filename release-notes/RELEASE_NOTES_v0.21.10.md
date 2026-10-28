# Stream Shell v0.21.10 — Mangayomi Titlebar PNG load / Dashboard wordmark

## Fixes

- Fixes the native Titlebar missing Mangayomi icon at its source: the original five are in the static preload list, but Mangayomi is a separately defined dynamic built-in. The C# `LoadButtonIcons()` now includes a Mangayomi button definition as an extra icon-loading group, storing `mangayomi.png` under the same action key used by the painter.
- The normal native installer was already copying the PNG. Reinstall the **shared** native Titlebar helper after applying the patch, because the existing running executable did not load the image.
- Increases Dashboard Mangayomi wordmark's apparent size by reducing its SVG whitespace. Embeds a display-size copy of the original image in the SVG wordmark to avoid non-rendering external `<image>` links. `assets/providers/icons/mangayomi.svg` is unchanged.

## No changes

- No Windows owner-graph modifications; native Mangayomi left focus, Desktop app-helper, Discord, Twitch, FMHY, Titlebar ordering, stored provider settings, or user backgrounds modified.

## Verification

- Source/Javascript quality gate and icon-loading static regression run locally; **Windows C# build and live native Titlebar test still required**. If Mangayomi remains pinned but only the text `MY` appears, check whether the Titlebar host installer successfully compiled and replaced the running executable.
