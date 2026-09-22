# Stream Shell 0.17.0

## YouTube Runtime Refactor

- Removed the global YouTube `MutationObserver` over `document.documentElement`.
- Replaced it with small targeted observers for popup, player, guide and active Shorts like state.
- Reworked SPA navigation around bounded settle passes instead of rerunning broad feature scans after arbitrary DOM mutations.
- Made the Resource Governor park YouTube DOM work while hidden/paused.
- Cached Upload Date targets and bounded expensive inline-script fallback work per video.
- Cached `More from YouTube` cleanup targets and split translated-audio survey handling from Continue Watching.
- Scoped Shorts thumb observation to the actual active Like button.
- Added a fast active-video path for Shorts / `#movie_player` and reused it for Auto Like.
- Deferred subscribed-channel DOM reads until the actual Auto-Like threshold.
- Cached static Now Playing metadata for the same video while leaving playback/RYD dynamic.
- Bound Windowed-Fullscreen pointermove only while Windowed mode is active and made Quality retries generation-aware.
- Preserved the 0.16.10 RYD hydration behavior during this release.

**Recovered SHA-256:** `886993a36d86338a2496279ff451959fd2ea1e7180036be3d9fe5f63fbbb9c86`

_Recovered from the original Stream Shell development chats / release messages._
