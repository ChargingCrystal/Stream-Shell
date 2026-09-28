# Stream Shell 0.18.25

## Twitch Popup Bootstrap Recovery

- Fixed Twitch buttons on Landing and the native titlebar no longer opening the Twitch surface after upgrading through the 0.18.24 popup-window migration.
- pre-0.18.25 Twitch runtime mappings are no longer imported into the popup-window runtime model. Session identity is disposable and now starts clean on a schema mismatch; persistent workspace instances remain unchanged.
- Removed Twitch tab-to-popup migration through `chrome.windows.create({ tabId, ... })`. New Page contexts and the Multi View host are created directly as managed popup windows from their Twitch URLs.
- Twitch pages that try to spawn a normal Opera tab are mirrored into a fresh managed popup and the just-created spawned tab is closed instead of being moved between window types.
- Kept the floating bar, Page/Embed instance model, layouts, one-popup-per-context topology, titlebar integration and existing Twitch automation model.

**Update:** reload the extension only. No native helper, COBOL finance or Unified Remote reinstall is required. Existing Twitch tabs already leaked into Opera's normal browser area are intentionally left untouched and can be closed manually.
