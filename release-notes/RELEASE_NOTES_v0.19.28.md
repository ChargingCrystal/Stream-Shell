# Stream Shell 0.19.28 — Custom Provider Windows (Registry Phase 2)

## Implemented

- Shared, versioned `shared/provider-registry-core.js` normalizes legacy v1 and current v2 settings for both Dashboard and Background. Built-in URL/adapter metadata stays authoritative; custom provider IDs are stable, deduplicated, and HTTPS-only. Rejects unsafe schemes, credentials and malformed URLs on both sides of the message boundary.
- **General → Providers**: Add/edit/delete a custom provider by name, HTTPS URL and optional short icon/initials. Enable/disable any provider, reorder Dashboard pins, and assign up to seven pinned providers. Built-in provider adapters and styles are preserved. Unpinned custom providers stay in the saved registry for Titlebar Phase 3.
- **Dynamic Dashboard**: The agreed 1–7 Wide grids and Compact list now work with real sixth/seventh custom providers. Custom buttons use safe text-only fallback artwork, not provider-specific assets.
- **Window lifecycle**: Custom providers open via the existing left-window manager as unmodified `chrome.windows.create` HTTPS popups. Window IDs are stable across button reorders and renames; future switches reuse the window. Changing a custom URL navigates only at the next explicit activation, not when saving settings.
- **Removal**: Removed custom provider windows are cleaned up by ID (and related stored URL entry is discarded). Removing an active custom provider switches the left side to the integrated YouTube window and retains the existing right mode.
- **Separation**: Custom provider buttons do not trigger provider-specific media deep links, adapters or availability scoring. No extra host permissions or arbitrary-site content injection. v0.19.24 Twitch acknowledgement recovery and v0.19.26 right-pane focus isolation remain unchanged.
- **Settings persistence**: Registry data remains included in Settings Export/Import. Corrupt, duplicate or unsafe entries are excluded by the normalizer.

## Not yet implemented

- **Phase 3:** Live dynamic native Titlebar (custom button icons, independent Titlebar ordering, overflow, state sync). The Native Helper remains the v0.19.26 implementation; its buttons are still the five fixed built-ins. Do **not** reinstall the native helper for this release.
- Custom pages do not get automatic playback tracking, skip controls, Now Playing or custom wallpaper.

## Validation and test

- `node dashboard/tests/provider-registry.test.js`
- `node background/tests/custom-provider-window.test.js`
- JS syntax verification for sources and both generated bundles. Static native C# unchanged.
- **Still requires Windows/Opera GX test** for real HWND claiming, Compact and Wide, and right Dashboard/Twitch focus transitions.

## Installation

Overwrite v0.19.27 with the FULL ZIP, or apply the PATCH ZIP. Reload extension in `opera://extensions`. Background image PNGs are deliberately omitted from both archives and must remain in the existing local directory.
