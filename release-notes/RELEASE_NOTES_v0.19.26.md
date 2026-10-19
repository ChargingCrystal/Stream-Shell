# Stream Shell 0.19.26 — Right Pane Selection & Left Focus

## Fixes
- Removes v0.19.25's automatic Dashboard Z-order polling that fought with Twitch window ordering.
- Removes the unrelated right-side Discord hide call when using Dashboard provider buttons or Now Playing in Wide layout.
- Restores the chosen right pane after left-side provider focus, with `SWP_NOACTIVATE` (no right-side focus transfer).
- Handles an explicit right-side Dashboard selection with the same bounded reassertion.
- Preserves successful Twitch A-D claim retries and the Twitch-only repair introduced in 0.19.24.
- Avoids sending stale right-side state after asynchronous focus and visibility operations.

## Installation
Reinstall the native Titlebar Helper after replacing the extension files.
