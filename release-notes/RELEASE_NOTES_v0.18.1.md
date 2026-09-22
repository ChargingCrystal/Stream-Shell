# Stream Shell 0.18.1

## 16:9 Compact Target

- Added 16:9 as a first-class Compact display target without introducing a third UI/runtime mode.
- Kept the same Compact single-surface layout/titlebar behavior used by 16:10.
- Set Auto target priority to `32:9 → 16:9 → 16:10`.
- Made forced Compact choose 16:9 ahead of 16:10 when both are available.
- Extended Diagnostics to identify `compact-16:9`, `compact-16:10` and `wide-32:9` targets.

_Recovered from the original Stream Shell development chats / release messages._
