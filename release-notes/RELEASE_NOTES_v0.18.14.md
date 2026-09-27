# Stream Shell 0.18.14

## Wide COBOL Finance

- Added a hidden Wide-only Financial Operations report opened by clicking the Landing `Subscriptions` heading five times.
- Added local price and monthly/yearly cadence settings for the six subscription services already displayed by Stream Shell.
- Added a fixed-width 24-character subscription ledger and a real GnuCOBOL reconciliation worker under `integrations/cobol-finance/`.
- Added a dedicated C# Native Messaging bridge (`com.streamshell.finance`) that validates the ledger, runs the compiled COBOL worker and returns its report to the extension.
- Reconciliation reports active/ending counts, monthly run rate, annualized expenditure and Direct / Google Play / Amazon / Other billing exposure.
- Kept the feature strictly Wide-only: `landing/src/finance.js` is included in `landing/landing.js` but deliberately excluded from the Compact Home bundle.
- Finance installation compiles both native pieces and runs a real COBOL self-test before registering the host.
- Kept all finance install/uninstall entry points inside `integrations/cobol-finance/`; no new top-level launcher scripts are added.

**Native helper:** the existing titlebar helper does not need to be rebuilt. Install the separate finance host with `integrations/cobol-finance/install-cobol-finance.cmd`. GnuCOBOL (`cobc`) is required during installation.
