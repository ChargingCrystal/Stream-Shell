# Stream Shell 0.19.4 — Twitch Workspace Shared Control Bar & Seam Repair

This release refines the usable four-slot Twitch compositor without changing its direct-final-geometry lifecycle.

- A/B now extend 32 px downward while C/D retain their 32 px upward overlap, hiding the remaining stock Opera caption strip at the middle seam.
- Workspace schema v4 recreates only A/B once for the new geometry and preserves C/D.
- Only the selected Twitch slot renders the floating workspace controls, replacing the four duplicated HUDs with one shared bar.
- The shared bar includes A/B/C/D selectors that focus an existing slot through the lightweight workspace path.
- Clicking/focusing a slot updates the selected workspace member without generic provider reconciliation or a global state broadcast.
- Twitch zoom is intentionally not forced; Opera remains authoritative for site/tab zoom persistence.

The native helper protocol and binary source are unchanged from 0.19.3, so no native-helper reinstall is required.
