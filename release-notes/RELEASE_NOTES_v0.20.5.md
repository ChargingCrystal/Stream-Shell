# Stream Shell 0.20.5 — Focus Fast Path & Reconciliation Tracing

In the 0.20.4 field test, even batches of 1–2 focus notifications took 2.58–4.05 seconds and the first YouTube restore after a Twitch cold start took 9.65 seconds. This is not proof of the observed temporary Opera freeze: the diagnostics covered only ~77 seconds and cannot prove causal origin. It does expose repeated expensive focus reconciliation.

Changes:
- Ignore ordinary Opera and native application focus as Shell *navigation*. Use a lightweight native visibility update instead of launching a full set of browser window scans, tab-title claims and state broadcasts. Update provider resource focus states asynchronously.
- Preserve managed provider/Dashboard/Landing focus processing and original Twitch A–D behavior.
- More detailed `focus-phase` and `reconciled` timing diagnostics identify the slow part of each batch.

Install PATCH over 0.20.4 and reload from opera://extensions. The C# helper and Native Messaging protocol v9 are unchanged. No personal backgrounds or artwork included.

This is a targeted field-test candidate, not a confirmed solution for intermittent Opera-wide hangs. Please test both regular Opera focus and full-screen WuWa use.
