# Stream Shell v0.20.15 – Background Idle Budget & Runtime Code Care

Pure JS performance/maintenance update. Native code, startup admission, transition skeletons and Twitch playback rules are unchanged.

- Dashboard: suspend presentation-only minute clock and now-playing progress timers entirely while the Dashboard document is hidden; refresh instantly after visibility returns.
- Settings: stop the 200-ms Anarchy color-preview interval when the document is hidden, and restart on reveal only when that settings section is actually visible.
- Provider resource governor: focus-only metadata changes do not restart every poll/DOM workload at 0 ms; real mode/visibility/watch/playback transitions continue to wake jobs immediately.
- Twitch: throttle trusted pointerdown interaction IPC to 1/s (background acceptance remains a 3-second window); de-duplicate chat nodes in MutationObserver callbacks while processing each `!play` synchronously. Keep auto-claim points, drops, raid protection, Twitch keep-playing and Marbles chat activity fully operational.
- No new window scans, timers, native messages or changes to C#; no helper reinstall required.
- 24 Node-based regression test files passed, including 3 new behavioral test files. Real-world Opera GX long-running stability remains to be verified by usage rather than a forced 1-hour game test.
