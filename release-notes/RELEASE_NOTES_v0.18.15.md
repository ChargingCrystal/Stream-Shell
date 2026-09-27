# Stream Shell 0.18.15

## COBOL Runtime Path Hardening

- Fixed the Wide Financial Operations COBOL worker failing at runtime with Windows status `0xC0000135` even though installation/self-test had succeeded.
- Added standard MSYS2 UCRT64 GnuCOBOL discovery when `cobc` is not already available through `PATH`.
- The installer now configures the MSYS2 GnuCOBOL config/copy/library environment automatically when applicable.
- The resolved compiler/runtime `bin` directory is persisted into the finance-host install directory.
- The C# Native Messaging bridge prepends that runtime directory to the COBOL child-process `PATH`, so `libcob` and dependent MinGW DLLs resolve when launched from Opera rather than the installation PowerShell session.
- Added a specific diagnostic for Windows DLL-load status `0xC0000135`.

Re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating. No titlebar-helper rebuild is required.
