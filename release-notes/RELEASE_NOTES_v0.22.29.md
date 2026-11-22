## 0.22.29 — Importable YouTube visual blocklist
- Add YouTube → Blocklist with explicit JSON import, enable/disable and removal. No channel list or political category is bundled or enabled by default.
- Internal youtube-blocklist-api validates and persists the imported channels array. Archived/unresolved entries are not imported. Invalid imports leave the previous list intact.
- Mark identifiable thumbnails and channel avatars with blur and a red “on blocklist” overlay while retaining navigation and playback.
- Match renderer-local channel IDs, with optional imported handles as fallback. Observe lazy-loaded/recycled cards in bounded batches; restore images after disabling/removing the list.
- No additional network requests, YouTube Data API key or remote channel-resolution service.
- Includes all prior updates and release notes through 0.22.28.

Validation: API/identity regression tests, bundle and syntax checks passed. Browser visual test could not start in this environment (socket permission restriction); authenticated YouTube/Opera verification remains outstanding. Cards without an exposed channel ID or matching imported handle remain unmarked.
