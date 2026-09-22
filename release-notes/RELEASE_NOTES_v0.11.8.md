# Stream Shell 0.11.8

## Netflix MAIN-World Player Bridge

- Stopped writing `video.currentTime` directly on Netflix after the O7375/DRM failures.
- Added an isolated-content-script → `window.postMessage` → MAIN-world bridge into Netflix's internal player API.
- Routed Netflix seek/resume, play, pause, playback rate and volume through the bridge.
- Added Diagnostics bridge state (`ready` / `waiting`) and the `main-world-netflix-player-api` command path.

_Recovered from the original Stream Shell development chats / release messages._
