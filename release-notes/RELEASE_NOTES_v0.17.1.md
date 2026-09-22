# Stream Shell 0.17.1

## Provider-Wide Performance Audit

- Reduced the global bootstrap marker observer to the root attributes it actually protects.
- Made Twitch's observer trigger heavy Bonus/Drops/Raid scans only for relevant DOM changes, retaining a fallback.
- Coalesced Netflix and Prime mutation-triggered work.
- Throttled Netflix's expensive semantic button scan and `document.body.innerText` title fallback.
- Optimized the generic video lookup to return a single `<video>` directly before doing geometry scans.
- Changed Dashboard clock updates to minute granularity and parked Now Playing progress work while hidden.
- Paused Landing native-Discord polling while Landing is hidden and performed an immediate catch-up on return.
- Kept the freshly refactored 0.17.0 YouTube source unchanged.

**Recovered SHA-256:** `a20c0917bdf59110c973743d5f046b632a1412dd7362b0bc3caa329ebefff0cb`

_Recovered from the original Stream Shell development chats / release messages._
