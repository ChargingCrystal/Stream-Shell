# Stream Shell 0.11.15

## Per-Provider Safe Mode

- Added Safe Mode independently for all five providers.
- Safe Mode keeps Provider API, Resume, Now Playing, Diagnostics, Audio, Sleep Timer and ordinary playback available.
- Disables Stream Shell's invasive provider DOM/UI modifications so provider-site failures can be isolated from extension failures.
- Bumped Diagnostics schema to v5 and added safe-mode test coverage.

**Recovered SHA-256:** `a18bd41c84704818a46c1df321d2ac34d2581113a2442f80003e3bc986ec43d9`

_Recovered from the original Stream Shell development chats / release messages._
