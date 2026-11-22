## 0.22.27 — Consistent Twitch channel transitions
- Both chat-driven and workspace-driven SPA channel changes invalidate the previous viewer count and start delayed acquisition exactly once.
- Cancel pending joins and discard previous-channel chat bursts before using the new stream. F5 and hourly reload continue through the normal fresh-document startup.
- Preserve bounded startup retries and five-minute steady-state viewer sampling.
- Regression coverage exercises both SPA detection orders and cancellation.
