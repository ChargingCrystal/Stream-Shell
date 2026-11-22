# Stream Shell 0.22.26 — Wait for Twitch viewer count during startup

Author: Sven Rieseler

- Delay the initial viewer-count read by five seconds and retry every five seconds during a bounded one-minute loading phase. After the first valid count, refresh every five minutes. If loading remains unsuccessful for one minute, back off to five minutes.
- Restart acquisition on channel navigation. Retain the last valid same-channel count if a later DOM sample is temporarily unavailable.
- Do not cancel pending joins during routine viewer-count refreshes. Expose attempted versus successful sampling times in diagnostics.
- Test delayed availability, transition to five-minute sampling, channel reset, timer synchronization and disposal.

Reload the extension and close/reopen Twitch Workspace windows. No native reinstall required. Background artwork excluded.
