# Stream Shell 0.17.12

## YouTube Playlist / Autoplay Title Tracking

- Stopped accepting/caching stale YouTube titles after playlist advance or autoplay.
- Accepted a title only when it can be tied to the current `v=` video ID through the player link or current `ytd-watch-flexy` state.
- Invalidated stale title state instead of carrying it into the next video.
- Fixed Continue Watching entries inheriting the previous video's title.
- Changed the YouTube Now Playing provider logic, rebuilt `common/shell.js` and bumped the manifest.

**Recovered SHA-256:** `35e5dc2e7c0e6331833323f153ee439c2a85b26cf68544739ca9980849434b14`

_Recovered from the original Stream Shell development chats / release messages._
