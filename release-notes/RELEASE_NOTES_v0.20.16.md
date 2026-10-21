# Stream Shell v0.20.16 — Native IPC Idle-Aware Recovery

- Continue sending native heartbeat every 2.5 s and retrying provider-button acknowledgements.
- Defer the costly 10-second background browser-window and Twitch-HWND reconciliation while Wide mode has a reliable cache and an unmanaged foreground window (such as WuWa). Reconciliation automatically resumes on the next scheduled tick after Stream Shell regains focus.
- The guard is conservative: Compact mode and unknown/warming Wide focus remain on the original recovery path, as do regular managed Wide windows. No change to Twitch chat, MoS Autojoin, Drops or Points.
- Restore `runtimeCounters` and `cacheReady` in Deep diagnostics (they were erroneously null/false in Deep even when populated in Runtime), with three native-audit counters visible in the Diagnostics panel.
- Twitch native-claim status remains acknowledgement-based: a missing cached acknowledgement is not synthesized from native cluster membership. The 0.20.15 Deep log showed slot C with no cached claim despite a four-member native cluster.
- No native helper changes, no startup-delay changes, no new polling loops.
