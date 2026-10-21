# Stream Shell v0.20.18 — Restore Wide COBOL Finance Report

The hidden Financial Operations report failed to open because the generated `landing/landing.js` had silently omitted `landing/src/finance.js` starting with v0.19.35. This release restores the original, unchanged Finance module to **Wide Landing only**; the five quick clicks on **Subscriptions** again open the overlay. Compact Home intentionally excludes it. The GnuCOBOL host and its settings are unchanged.

The source/build parity test and an executable five-click smoke test now guard against accidentally removing this module again. The v0.20.17 code audit's dormant-prototype assessment was incorrect (erratum recorded in the audit document).

Install PATCH over v0.20.17 and reload the extension. No native helper or GnuCOBOL reinstall is needed if the finance host is already installed. If the overlay opens but reports `COBOL ENGINE UNAVAILABLE`, separately check the optional finance native host via `integrations/cobol-finance/install-cobol-finance.cmd`.

No changes to the browser background worker, Twitch, dashboard, native helper, performance tuning or personal backgrounds.
