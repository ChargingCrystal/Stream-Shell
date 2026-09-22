# Stream Shell 0.11.16

## Resource Governor v2

- Added adaptive throttling for Stream Shell's own provider observers, polling loops and DOM checks.
- Used provider visibility/activity/minimized/watch-context/playing state to decide how much work should run.
- Parked heavy provider observers when a provider is hidden and paused instead of closing the provider tab/window.
- Exposed governor state through Diagnostics (schema v6).

**Recovered SHA-256:** `97a2459363ff9d2a47246fffc02617fd2bad6a347d29ee6ee47a4c84206af39d`

_Recovered from the original Stream Shell development chats / release messages._
