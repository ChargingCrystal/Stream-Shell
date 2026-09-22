# Stream Shell 0.9.16

## Playback Performance Fix

- Removed Now Playing blur and pulse effects that were costing paint/compositing time.
- Removed the automatic title marquee from the hot path.
- Reduced frequent storage writes; long-running progress persistence moved to roughly minute-scale updates.
- Preserved immediate updates for play/pause, seek and ended transitions.
- Resolved the observed Netflix buffering/quality regression and improved YouTube smoothness without regressing Prime/Crunchyroll.

_Recovered from the original Stream Shell development chats / release messages._
