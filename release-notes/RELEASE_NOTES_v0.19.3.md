# Stream Shell 0.19.3 — Twitch Workspace Interaction & Focus Pass

This release fixes the first usable four-slot workspace rather than adding new surface types.

- Twitch HUD buttons are interactive again through actual Shadow DOM event listeners.
- `All` only restores native cluster z-order; it no longer reruns the workspace show pipeline.
- C/D are recreated once at a 32 px upward overlap so the upper row can cover their Opera caption band.
- Focus changes inside A-D use a Twitch fast path and no longer trigger generic provider reconciliation or a global state broadcast.
- Workspace window bound events no longer run provider reconciliation.
- Generic focused-titlebar claims are skipped for explicitly claimed workspace windows.

A/B are retained during the v2 -> v3 workspace migration. C/D are recreated once because changing live Twitch window geometry in place would reintroduce the rendering risk the direct-final-geometry architecture was designed to avoid.
