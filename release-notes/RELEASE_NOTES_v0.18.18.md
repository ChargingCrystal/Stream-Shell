# Stream Shell 0.18.18

## COBOL Finance Installer Compatibility

- Removed the exact `0.18.15` version gate from `install-cobol-finance.ps1`.
- The installer now compiles the finance native host and COBOL worker from the current Stream Shell checkout and reports the version read from `manifest.json`.
- Updated the missing-runtime diagnostic to point to the current checkout rather than an obsolete patch number.
- Finance calculations, billing-source classification and the Wide-only Financial Operations surface are unchanged from 0.18.17.

Re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating so the currently checked-out COBOL worker/native bridge are installed.
