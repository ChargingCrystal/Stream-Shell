# Stream Shell 0.16.10

## YouTube RYD Hydration / Performance Fix

- Added a short invisible YouTube `#columns` viewport warmup for new `/watch` videos so Return YouTube Dislike can hydrate in Windowed Fullscreen.
- Checked after roughly 1.8 seconds and parked the warmed metadata column offscreen by about five seconds.
- Kept the actual RYD parser unchanged.
- Throttled the translated-audio survey scan to at most once per ~1.2 seconds and removed the full-DOM fallback.
- Restricted Shorts thumb cleanup/synchronization to Shorts instead of doing work on normal `/watch` pages.
- Kept Native/Twitch/window management byte-identical to 0.16.9.

_Recovered from the original Stream Shell development chats / release messages._
