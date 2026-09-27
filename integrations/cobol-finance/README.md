# Stream Shell COBOL Finance

**Introduced in Stream Shell 0.18.14; runtime-path handling hardened in 0.18.15; billing exposure classification refined in 0.18.16; installer version coupling removed in 0.18.18.**

Optional Wide-only subscription finance integration for Stream Shell.

The integration turns the subscription state already displayed by Stream Shell into a fixed-width ledger and runs that ledger through a real GnuCOBOL reconciliation worker. The browser UI does not calculate the authoritative report totals itself; the COBOL worker returns the monthly run rate, annualized expenditure, status counts and billing-source exposure rendered by the report.

## Why this exists

Stream Shell already tracks subscription state and billing-source metadata. Actual plan prices are deliberately entered by the user because provider scraping cannot reliably represent discounts, legacy plans, family arrangements or store-specific pricing.

The finance surface is intentionally restricted to Wide. Compact does not include `landing/src/finance.js` in its generated Home bundle.

## Requirements

- Stream Shell 0.18.16 in Wide mode.
- Windows native messaging.
- GnuCOBOL. The installer accepts `cobc` from `PATH` and also detects the standard MSYS2 UCRT64 location (`C:\msys64\ucrt64\bin\cobc.exe`).
- The Stream Shell titlebar helper installed first, or the extension ID supplied manually to the installer.

The compiler is only invoked during installation, but the compiled worker depends on the GnuCOBOL/MinGW runtime DLLs supplied by the Windows distribution. Stream Shell 0.18.15 records the resolved compiler/runtime `bin` directory during installation and injects that directory into the COBOL worker process environment automatically. Opera therefore does not need to inherit MSYS2 in its own `PATH`.

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
3. runs a fixed-record COBOL self-test;
4. writes the `com.streamshell.finance` native host manifest; and
5. registers the host for the current Windows user.

Installed files live under `%LOCALAPPDATA%\StreamShell\FinanceHost`.

## Open the report

In the Wide Landing surface, click the **Subscriptions** heading five times in quick succession.

The hidden Financial Operations surface lets each displayed service store a local price and monthly/yearly cadence. `ACTIVE` and `ENDING` subscriptions are included in exposure totals; inactive, sign-in, verify and unknown states are excluded.

Press **RECONCILE** to run the current ledger through COBOL.

For finance exposure classification, an explicit Google Play source remains `Google Play`. Other explicit sources are treated as `Direct`. Netflix, Prime Video, Disney+ and Crunchyroll also default to `Direct` when the subscription scraper has no billing-source label; this avoids treating normal provider billing as unknown merely because only the renewal date was available. `Other / unknown` remains a fallback for services whose billing path cannot be inferred and is hidden from the exposure strip while its value is zero.

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

The COBOL report is line-oriented `KEY=VALUE` data. All monetary values returned to the UI are integer euro cents.

## Runtime path

```text
Wide Landing
  -> chrome.runtime.sendNativeMessage(com.streamshell.finance)
  -> StreamShellFinanceHost.exe
  -> StreamShellFinanceCobol.exe
  -> reconciliation report
  -> Financial Operations UI
```

This is optional. If the finance native host is not installed, normal Stream Shell subscription handling is unaffected; only the hidden finance report shows the engine as unavailable.

## Uninstall

From the repository root, run:

```powershell
.\integrations\cobol-finance\uninstall-cobol-finance.cmd
```
