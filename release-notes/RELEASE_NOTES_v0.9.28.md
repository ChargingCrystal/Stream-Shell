# Stream Shell 0.9.28

## Titlebar Icon Reskin

- Reskinned the remaining left Native titlebar without changing its functional behavior.
- Made the bar slightly smaller and moved it a few pixels lower for better vertical centering inside the Opera titlebar.
- Replaced text labels `H / YT / N / P / D+ / CR` with the same icon shapes already used by the old Floating Navbar.
- Used the existing Home-line icon for Landing and the existing YouTube, Netflix, Prime Video, Disney+ and Crunchyroll assets for provider navigation.
- Preserved hover and active-state behavior.
- Converted the existing SVG artwork into small raster assets for Win32/GDI rendering rather than inventing new icon designs.
- Changed `manifest.json`, `native/StreamShellTitlebarHost.cs`, `native/install-titlebar-helper.ps1` and the small native titlebar icon assets.
- Left Discord, scrapers, Now Playing, `background.js` and window-state logic unchanged.

**Native helper:** Reinstall `native\install-titlebar-helper.cmd`, then fully close Stream Shell, reload the extension and reopen it.

_Recovered from the original Stream Shell development chat / release message._
