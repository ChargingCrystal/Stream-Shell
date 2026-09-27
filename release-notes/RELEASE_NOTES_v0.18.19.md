# Stream Shell 0.18.19

## COBOL Printable Financial Report

- Added a printer-ready A4 subscription exposure statement generated directly by `subscription-reconcile.cob`.
- The COBOL worker now retains service rows and formats service/status/billing/cadence columns, monthly equivalents, annualized values, report date, summary counts and monthly billing exposure.
- Preserved the machine-readable reconciliation fields and added a bounded printable section (`PRINT_REPORT_BEGIN` / `PRINT_REPORT_END`) returned through the existing C# Native Messaging bridge.
- Added `PRINT REPORT` beside `RECONCILE`; the browser print dialog can send the COBOL statement to a printer or Save as PDF.
- Editing a price or cadence invalidates the current printable statement until a fresh reconciliation succeeds.
- Extended the installer self-test to assert that the COBOL worker emits both the reconciliation totals and printable report.
- Added `.gitattributes` with `*.cob linguist-language=COBOL`; this is an explicit truthful mapping, and the expanded COBOL source now exceeds the bundled Lua source by bytes.

**Native helper:** re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating because the COBOL worker changed. The titlebar helper does not need to be rebuilt.
