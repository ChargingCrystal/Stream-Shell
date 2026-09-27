# Stream Shell 0.18.17

## Crunchyroll Google Play Billing Source

- Added Crunchyroll to the Google Play subscription cross-check.
- Play-billed Crunchyroll now displays `Google Play` in the subscription row even when Crunchyroll itself exposes no renewal/end date.
- Renewal/end dates still come from Crunchyroll's own account page when available; Google Play dates are intentionally not substituted because the Play page contains multiple subscription cards.
- The Financial Operations report now classifies Crunchyroll under Google Play after the next subscription sync.

No COBOL/native finance reinstall is required. Reload Stream Shell and run subscription sync once.
