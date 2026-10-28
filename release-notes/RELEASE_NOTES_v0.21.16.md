# Stream Shell v0.21.16 — Mangayomi unregistered-URI safe fallback

## Confirmed cause

The experimental direct search from v0.21.15 ShellExecuted `mangayomi://global-search` without checking whether Windows had any registered handler. Windows responded with the Microsoft Store "Get an app" dialog. The existing fork patch is source-only: the installed stock Mangayomi does not implement `global-search` URI handling.

## Fix

- Native Mangayomi host checks HKCU `Software\Classes\mangayomi` protocol command and a separate patched-build-only opt-in (`Software\StreamShell\MangayomiBridge`, `DirectSearchEnabled=1`) before ShellExecute. The command must point to the actual Mangayomi.exe and forward `%1`.
- Without BOTH, it fails closed **before** launching the URI. Stream Shell treats the specific response as a normal clipboard/search handoff rather than reporting direct search completion. Normal click is unchanged.
- `integrations/mangayomi/enable-patched-search.ps1` can opt into URI search **only after** users build/install a compatible patched Mangayomi Windows executable. It is not a patcher or a substitute for a compiled fork. It writes an association only when explicitly run with the confirmation switch. A `-Disable` option removes Stream Shell's opt-in.
- The stock Mangayomi release still cannot accept a query or return search results. Those features are NOT claimed as fixed.

## Upgrade

Apply PATCH on top of 0.21.15 or use FULL; then run `integrations/mangayomi/install-mangayomi-helper.ps1` again, and reload Opera GX. Do **not** run `enable-patched-search.ps1` on stock Mangayomi. Test Shift+click: it should copy the title, open the left Mangayomi pane and **not** open the Microsoft Store dialog.

## Validation

Source tests and generated JS bundles are checked offline. Win32 compilation/registry/actual Mangayomi interaction require Windows live tests. No personal wallpapers or custom artwork included; GitHub not modified.
