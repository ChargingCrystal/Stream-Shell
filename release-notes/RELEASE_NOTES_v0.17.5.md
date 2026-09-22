# Stream Shell 0.17.5

## RYD Windowed Layout Fix

- Found the real RYD blocker: `opacity: 0` on YouTube `#columns` prevented RYD from hydrating.
- Removed `opacity: 0` while keeping the metadata column parked at `left: -100000px` and non-interactive.
- Changed only YouTube Windowed CSS plus manifest version.

**Recovered SHA-256:** `d90322f640fa499f015cb5f0f6e76c60f4998fba6e7e342351b38b9a48687ae9`

_Recovered from the original Stream Shell development chats / release messages._
