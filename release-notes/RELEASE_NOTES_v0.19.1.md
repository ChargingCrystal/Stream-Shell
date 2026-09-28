# Stream Shell 0.19.1 — Twitch Workspace V2 Surface Repair

This build repairs the first 0.19.0 four-slot foundation without changing the direct-final-geometry rule that made parallel Twitch rendering stable.

- Four physical compositor cells now exist while the workspace is active. Empty cells are local Stream Shell controller pages; configured cells are real Twitch pages in the same window.
- Assigning or clearing a slot navigates that cell instead of creating/destroying another popup.
- Dashboard no longer owns the interactive empty-slot grid.
- Startup gets bounded z-order retries only; cells are never resized or parked.
- Native v5 now renders/owns right chrome for A, B, C, D and the optional chat drawer.
- Native z-order reconciliation restores workspace members above Dashboard when Stream Shell is foreground, while leaving unrelated foreground apps untouched.
- 0.19.0 workspace state migrates in place.

Re-run `native\\install-titlebar-helper.cmd`, then reload the extension.
