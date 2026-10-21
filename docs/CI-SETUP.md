# Stream Shell CI – setup and operation

GitHub Actions workflows are in `.github/workflows/`:

- `project-quality.yml`: push / pull request / manual, Ubuntu, Node 22 and Python 3. Runs `node tools/check-project.mjs` for JS syntax, bundle parity, Manifest/HTML references, critical behavior tests, native **source** parity, and repository layout.
- `native-windows.yml`: push / pull request when Native C# or its build tooling changes, plus manual runs. Uses Windows to compile the C# Titlebar Host **without installing or launching** it.

## Setup

Both workflows are committed alongside source; no setup script or npm dependencies needed. Push your local tree to GitHub and inspect the [Actions tab](https://github.com/ChargingCrystal/Stream-Shell/actions). Workflow permissions are read-only. No tokens or secrets need to be configured.

## Local test

From extension/repository root:

```sh
node tools/check-project.mjs
```

Requires Node 22+ and Python 3. On Windows use the PowerShell builds adjacent to the four source trees when changing source fragments; CI validates outputs but does not rewrite bundles.

On native changes you can also invoke `native/tests/compile-titlebar-host.ps1` on Windows. It does not install the helper.

## Interpreting failures

- **Bundle parity**: generated file did not match its ordered source fragments; use the adjacent `build-*.ps1` and commit both source and bundle.
- **Regression missing/failed**: a behavior contract disappeared or changed; do not just delete tests to get green.
- **Project layout**: docs and tests should live in their designated area; consult [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md).
- **Windows Native compile**: compile failure; installing the running helper should wait until the source is corrected.

These checks cannot establish Opera GX or background renderer long-session stability by themselves.
