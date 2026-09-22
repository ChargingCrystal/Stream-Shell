# Stream Shell 0.11.7

## Provider-Specific Continue Resume

- Normalized YouTube saved links to clean `/watch?v=...` URLs, preserving playlist/index while removing `t`, `start` and `time_continue` noise.
- Added stabilized multi-check YouTube seeking so the target timestamp survives player initialization.
- Normalized Netflix entries to canonical `/watch/<id>` links with a pending resume seek.
- Added Prime's detail-page bootstrap: wait for a usable Resume/Play control, click it, wait for the real player, then apply the timestamp.
- Kept Crunchyroll on its already-working direct resume path; Disney remained unverified.
- Added resume strategy/pending target information to Diagnostics.

**Recovered SHA-256:** `bf7a050118dd0e7b755fe03909139b5fe0e39e860a792e527032d44daa181afc`

_Recovered from the original Stream Shell development chats / release messages._
