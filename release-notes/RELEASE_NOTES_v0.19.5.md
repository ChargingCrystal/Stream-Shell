# Stream Shell 0.19.5 — Twitch Workspace Seam Calibration

This is a narrow geometry/UI calibration pass for the four-slot Twitch compositor.

- symmetric overlap reduced from 32 px to 25 px per row
- on the 1080 px Wide pane, A/B/C/D are each 960×565
- C/D start at y=515, leaving a 50 px shared seam region instead of 64 px
- the redundant `All` floating-bar action is removed
- Twitch zoom remains browser-owned; Stream Shell does not force a zoom percentage
- v4 workspace windows are recreated once at the new direct-final geometry; normal switching still never resizes healthy Twitch windows
