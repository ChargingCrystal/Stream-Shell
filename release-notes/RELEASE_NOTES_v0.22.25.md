# Stream Shell 0.22.25 — Restore Twitch auto-join viewer sampling

Author: Sven Rieseler

The 0.22.24 diagnostic export showed missing viewer counts, no join attempts and unchanged sample timestamps despite more than five minutes of runtime. Chat messages were still being observed.

Fixed an unintended clearInterval in syncFallbackTimer, which cancelled the dedicated viewer-count timer immediately after startup and on subsequent automation synchronization. Viewer sampling now continues once every five minutes per window. If Twitch has not rendered the count at startup, auto-join can recover on the next sample. Missing counts still pause percentage-based joins; no extra polling or API requests were added.

Validation: timer lifecycle regression checks repeated automation synchronization and disposal. Existing Marbles history admission and viewer-percentage tests retained. Live Opera validation remains pending.

Apply over 0.22.24, reload the extension and close/reopen Twitch Workspace windows so the old injected script is replaced. No native reinstall required. No background artwork bundled.
