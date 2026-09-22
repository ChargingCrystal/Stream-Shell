# Stream Shell 0.14.16

## Compact Claim Retry Hardening

- Added Compact HWND claim retries while a new provider window/title is still loading.
- Added `tabs.onUpdated` retry support and an explicit claim-accepted path.
- Aborted outstanding claims when normal Opera takes focus rather than continuing to adopt by stale geometry.
- Added AppUserModelID retry handling for newly created Compact windows.
- Kept 32:9/Wide behavior unchanged.

_Recovered from the original Stream Shell development chats / release messages._
