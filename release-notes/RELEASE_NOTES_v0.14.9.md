# Stream Shell 0.14.9

## Compact HWND_TOP Experiment

- Moved Compact titlebar/backdrop to `HWND_TOP` in the normal Z-order.
- Avoided continuously reasserting Z-order every 500 ms.
- Kept Wide unchanged.

**Native helper:** Reinstall the native titlebar helper.

**Recovered SHA-256:** `16348e93264a72ab19f1e6ddd1d710b4a0de7cdf2775ba7716c9da4b48114c66`

> Historical note: The bar was initially correct but could fall behind Opera after a provider switch because visibility stayed true while Z-order changed.

_Recovered from the original Stream Shell development chats / release messages._
