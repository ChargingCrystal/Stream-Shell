# Stream Shell 0.20.3 — Twitch Broadcast Decongestion

This update targets measured v0.20.2 cold-start stalls: a Twitch `broadcastState()` took 3,393 ms, and the next YouTube transition still took 6,760 ms (plus 4,952 ms queued).

- Twitch activation now sends a compact state event using its existing A–D workspace record, instead of awaiting another browser-wide foreground/window enumeration and full broadcast under the global transition FIFO.
- Reopening an already-normal provider window whose pane geometry matches now performs only the required focus change. Minimized/off-geometry windows retain the original guarded multi-step restoration.
- Slow provider transition phases are written to the Flight Recorder (`window-transition / step-timing`) so the next report can identify the remaining costly operation.
- Full detailed Twitch diagnostics are still available from Diagnostics Export. No Twitch chat, MoS, Drops or native C# behavior is intentionally changed.

**Install:** Overlay PATCH onto 0.20.2 and reload the unpacked extension. Native Messaging protocol v9 and C# helper are unchanged; no native reinstall.

**Validation:** Automated regression tests cover the lean launch path and warm/slow window restore paths. Real Opera GX responsiveness must be validated by the user, especially during four-slot Twitch cold start and WuWa background conditions.
