# Stream Shell 0.9.48

## Deterministic HWND Fix

- Added a Stream Shell title marker to classify managed Opera HWNDs deterministically.
- Disabled the DWM border color to remove the remaining 1px seam.
- Changed the Now Playing title marquee to hover-only.

> Historical note: The deterministic title-marker/ownership logic proved unsafe and could catch normal Opera windows; 0.9.49 rolled that part back.

_Recovered from the original Stream Shell development chats / release messages._
