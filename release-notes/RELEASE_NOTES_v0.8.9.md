# Stream Shell 0.8.9

## Prime Interactive Fix

- Made Prime `VERIFY`, `SIGN IN` and similar states explicitly interactive instead of treating them like passive scrape failures.
- Stopped periodic reloads while a visible Amazon authentication flow is in progress.
- Returned to Prime Central once after authentication to re-evaluate subscription state.
- Preserved the already-correct Crunchyroll renewal-date result.

_Recovered from the original Stream Shell development chats / release messages._
