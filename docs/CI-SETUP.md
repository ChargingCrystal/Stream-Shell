# Stream Shell – GitHub Actions setup (0.22.1)

The workflows live under `.github/workflows/`:

- **`project-quality.yml`:** on push, pull request and manual dispatch; Ubuntu / Node 22 / Python 3; runs `node tools/check-project.mjs` for bundle parity, JS regression tests, manifest/HTML paths, layout checks and native source contracts.
- **`native-windows.yml`:** runs for relevant native source/build changes and can be started manually; compiles the shared Windows Titlebar host, **without installing or launching** it.

No npm dependencies, GitHub Actions secrets, authentication tokens or workflow administrator permissions are required for these basic checks.

## Local quality and native smoke tests

From the repository/extension root:

```powershell
node tools/check-project.mjs
```

For changed Windows native code:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\tests\compile-titlebar-host.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integrations\mangayomi\tests\compile-mangayomi-host.ps1
```

The second command is for the **optional Mangayomi host**; it is not automatically covered by the titlebar workflow. Source-only changes should still be checked for safe staging, active extension ID and native process identity on the actual Windows machine.

## Push checklist

1. Ensure source files and their generated bundles agree, and `manifest.json` displays the intended version.
2. Preserve the default-off **Seven Seas** gating for FMHY/Mangayomi; avoid publishing personal tokens or a pre-enabled user configuration.
3. Exclude user backgrounds/custom artwork, runtime logs and local native binaries. If files were already tracked in Git, remove those *index entries* before pushing without deleting local files.
4. Check `git status`, run the quality suite, commit, push, and confirm both workflows on the GitHub Actions tab.

A green check is **not** a substitute for real Opera GX, Flutter or multi-hour Windows testing. See [CI Quality](CI-QUALITY.md) for coverage and limitations.
