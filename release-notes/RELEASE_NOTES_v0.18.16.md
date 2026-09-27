# Stream Shell 0.18.16

## Finance Billing Exposure Cleanup

- Removed the Amazon-specific exposure bucket from the Wide Financial Operations report.
- Netflix, Prime Video, Disney+ and Crunchyroll now default to Direct billing when the subscription scraper has no explicit billing-source label.
- Explicit Google Play sources remain separate, preserving correct exposure for YouTube/Discord when billed through Google Play.
- Other explicit provider billing sources are treated as Direct; `Other / unknown` remains only as a fallback for genuinely unresolved billing paths and is hidden while its value is zero.
- Simplified the COBOL fixed-record billing code set from `D/G/A/O` to `D/G/O`.
- Removed the COBOL `AMAZON_CENTS` accumulator/output and updated the native ledger validator and Wide exposure layout.

**COBOL finance helper:** Re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating.
