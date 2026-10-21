# Stream Shell v0.20.32 — Marbles Live-Chat Freshness Admission

Date: 2026-10-21

## Trigger / evidence
The user confirmed another successful worst-case YouTube-first → Twitch A–D cold launch with v0.20.31, but observed that the Marbles autojoin was occasionally firing midround or before the next round because Twitch hydrates older chat messages after the old 5s grace period. The attached v0.20.31 Deep Log shows all four Twitch slots active, four confirmed Native claims, healthy YouTube workload counters, 5.5s cold admission correctly applied, no queue backlog; for B/C the previous hydration guard ended at 16:04:32/16:04:35Z and a join was submitted at 16:04:39/16:04:40Z. These timings demonstrate a risk window but the log has no raw chat message times to prove those particular joins were historical. Native/HUD stability is preserved.

## Fix: history-aware, intentionally conservative Marbles admission

- **Hydration clock:** Marbles-only initial and per-channel navigation grace is now 12s (was 5s). Starts only after a managed Twitch window has resolved settings and channel identity, not at content-script evaluation. Deferred slot observers do not silently consume it while not armed.
- **Batch replay:** A mutation delivering >=4 previously unprocessed chat lines is treated as probable history hydration. Discard all those lines, cancel any pending join and discard the current burst. During the first 45s of the current channel epoch, re-arm a separate 8s quarantine from that history batch; this guards late-loaded history after the original grace. At most one observer is attached and the rest of Twitch automation remains unaffected.
- **Timestamp freshness:** When Twitch exposes a parseable `time[datetime]`, `data-timestamp` / `chat-timestamp` or visible HH:mm/AM-PM, discard stale/future `!play` messages. Exact times older than 30s are rejected; minute-only labels are evaluated conservatively against the end of their displayed minute. Missing timestamps do not block genuine messages once the hydration gate is clear; new incremental chat lines remain supported.
- **DOM order:** Lines inserted ahead of already mounted chat messages are not fresh tail arrivals. Duplicate line DOM nodes are ignored.
- **Telemetry:** New per-slot `automation.historyBatchesDiscarded`, `historicalLinesDiscarded`, `hydrationLinesDiscarded`, `timestampedLinesChecked`, `lastFreshChatPlayAt`, `chatEpochStartedAt`, `lastHistoryBurstAt`, plus existing `hydrationGuardUntil`; never export chat message content or usernames.
- **Expected trade-off:** A genuine rapid batch containing four or more live lines in one mutation will be dropped. This deliberately prefers missing one round to sending a stray `!play` midround. The original unique-user burst threshold (5–10, random), 30s burst window, 1–4s jitter and two-minute cooldown remain unchanged.

## Scope / tests
`providers/player/twitch-utility.js`, isolated VM tests, manifest version, README/Changelog, TODO and source-structure notes. No Native C# or Native protocol edits; no Windows helper reinstall. No changes to provider→Twitch cold/warm renderer handoff 5.5s/3s or Twitch popup 1250ms spacing; no HUD-loader changes. Node tests are deterministic, and Opera GX live validation is still necessary, especially for Twitch's actual DOM markup/timestamps and true new-round autojoin reliability. The user-owned backgrounds and custom artworks remain excluded from both release ZIPs.

Install PATCH over 0.20.31, or use FULL with the same local personal assets preserved.
