# Stream Shell COBOL Finance

**Introduced in Stream Shell 0.18.14; runtime-path handling hardened in 0.18.15; billing exposure classification refined in 0.18.16; installer version coupling removed in 0.18.18; printer-ready statement generation added in 0.18.19.**

Optional Wide-only subscription finance integration for Stream Shell.

The integration turns the subscription state already displayed by Stream Shell into a fixed-width ledger and runs that ledger through a real GnuCOBOL reconciliation worker. The browser UI does not calculate the authoritative report totals itself. COBOL returns the monthly run rate, annualized expenditure, status counts and billing-source exposure, and from 0.18.19 it also produces the complete fixed-width printer-ready financial statement.

## Why this exists

Stream Shell already tracks subscription state and billing-source metadata. Actual plan prices are deliberately entered by the user because provider scraping cannot reliably represent discounts, legacy plans, family arrangements or store-specific pricing.

The finance surface is intentionally restricted to Wide. Compact does not include `landing/src/finance.js` in its generated Home bundle.

## Requirements

- Stream Shell 0.18.19 in Wide mode.
- Windows native messaging.
- GnuCOBOL. The installer accepts `cobc` from `PATH` and also detects the standard MSYS2 UCRT64 location (`C:\msys64\ucrt64\bin\cobc.exe`).
- The Stream Shell titlebar helper installed first, or the extension ID supplied manually to the installer.

The compiler is only invoked during installation, but the compiled worker depends on the GnuCOBOL/MinGW runtime DLLs supplied by the Windows distribution. Stream Shell records the resolved compiler/runtime `bin` directory during installation and injects that directory into the COBOL worker process environment automatically. Opera therefore does not need to inherit MSYS2 in its own `PATH`.

## Install

From the repository root, run:

```powershell
.\integrations\cobol-finance\install-cobol-finance.cmd
```

The installer normally reuses the extension ID from the installed Stream Shell titlebar host. To provide it explicitly:

```powershell
.\integrations\cobol-finance\install-cobol-finance.ps1 -ExtensionId <32-character-extension-id>
```

The installer:

1. compiles `StreamShellFinanceHost.cs` into the native-messaging bridge;
2. compiles `subscription-reconcile.cob` into `StreamShellFinanceCobol.exe`;
3. runs a fixed-record COBOL self-test that verifies both totals and printable statement generation;
4. writes the `com.streamshell.finance` native host manifest; and
5. registers the host for the current Windows user.

Installed files live under `%LOCALAPPDATA%\StreamShell\FinanceHost`.

## Open the report

In the Wide Landing surface, click the **Subscriptions** heading five times in quick succession.

The hidden Financial Operations surface lets each displayed service store a local price and monthly/yearly cadence. `ACTIVE` and `ENDING` subscriptions are included in exposure totals; inactive, sign-in, verify and unknown states are excluded.

Press **RECONCILE** to run the current ledger through COBOL. After a successful reconciliation, **PRINT REPORT** becomes available. The print action uses the statement text produced by COBOL and applies an A4 print layout; the normal browser print dialog can print it physically or save it as PDF. Changing a price or cadence invalidates the printable statement until reconciliation runs again.

For finance exposure classification, an explicit Google Play source remains `Google Play`. Other explicit sources are treated as `Direct`. Netflix, Prime Video, Disney+ and Crunchyroll also default to `Direct` when the subscription scraper has no billing-source label. `Other / unknown` remains a fallback for services whose billing path cannot be inferred and is hidden from the exposure strip while its value is zero.

## Record format

Each provider is emitted as one 24-character fixed-width record:

```text
PPPPPPPPPPPPSCAAAAAAAAAB
```

Where:

- `P` - provider ID, 12 characters padded with spaces;
- `S` - subscription status: `A` active, `E` ending, `I` inactive, `U` unknown/non-billable;
- `C` - cadence: `M` monthly or `Y` yearly;
- `A` - 9-digit amount in euro cents;
- `B` - billing source: `D` direct, `G` Google Play, `O` other/unknown.

## COBOL output format

The worker writes one report file with two sections.

The first section is line-oriented machine data:

```text
STATUS=OK
ENGINE=GNUCOBOL
REPORT_DATE=2026-09-27
ACTIVE=0004
ENDING=0001
MONTHLY_CENTS=000000004830
ANNUAL_CENTS=000000057964
DIRECT_CENTS=000000002348
GOOGLE_CENTS=000000002482
OTHER_CENTS=000000000000
```

The second section is bounded by `PRINT_REPORT_BEGIN` and `PRINT_REPORT_END`. Everything inside that boundary is formatted by COBOL as a 96-column statement containing the service ledger, summary totals and monthly billing exposure. JavaScript only extracts that text and hands it to the browser print pipeline; it does not rebuild the statement.

## Runtime path

```text
Wide Landing
  -> chrome.runtime.sendNativeMessage(com.streamshell.finance)
  -> StreamShellFinanceHost.exe
  -> StreamShellFinanceCobol.exe
  -> reconciliation fields + COBOL printable statement
  -> Financial Operations UI / A4 print path
```

This is optional. If the finance native host is not installed, normal Stream Shell subscription handling is unaffected; only the hidden finance report shows the engine as unavailable.

## Repository language classification

The repository includes `.gitattributes` with `*.cob linguist-language=COBOL`. This is an explicit mapping of the actual GnuCOBOL source, not generated filler. The printable-report implementation also makes the COBOL worker larger than the bundled Unified Remote Lua source, so COBOL is large enough to compete for a visible slot in GitHub's language summary instead of being folded into `Other` solely because it was the seventh-smallest language.

## Uninstall

From the repository root, run:

```powershell
.\integrations\cobol-finance\uninstall-cobol-finance.cmd
```
