# Stream Shell 0.8.7

## Subscription Verify + Discord

- Added Prime authentication handling with explicit `VERIFY` / sign-in state and a long interactive wait for passkey/login flows.
- Added Discord as a sixth subscription/status entry.
- Added Google Play cross-checking for YouTube/Discord subscription metadata and a Google Play billing-source label.
- Kept YouTube's own membership state authoritative while allowing Google Play to describe billing.
- Used `UNKNOWN` instead of inventing a Discord state when Play-store data was inconclusive.

_Recovered from the original Stream Shell development chats / release messages._
