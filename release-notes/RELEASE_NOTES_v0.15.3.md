# Stream Shell 0.15.3

## Wide Z-Order Occlusion Fix

- Checked relevant windows above the left Stream Shell HWND, not only the current foreground window.
- Prevented Wide titlebar chrome from resurfacing when focus moves but another window still sits above the left shell area.
- Kept Compact behavior unchanged.

_Recovered from the original Stream Shell development chats / release messages._
