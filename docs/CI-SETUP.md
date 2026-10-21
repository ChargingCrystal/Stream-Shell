# Stream Shell CI setup

This is an additive CI-only patch. It does not modify the extension runtime or existing build scripts.

## Install
1. Extract this archive at the root of the GitHub working copy (the folder containing `manifest.json`).
2. Commit and push the two files `.github/workflows/project-quality.yml` and `tools/ci-bootstrap.mjs`.
3. Go to **GitHub > ChargingCrystal/Stream-Shell > Actions > Stream Shell quality** and inspect the run.

Command-line alternative, from the repository root:

```sh
git add .github/workflows/project-quality.yml tools/ci-bootstrap.mjs
git commit -m "ci: add Stream Shell automated quality checks"
git push
```

## What it checks

* On the current GitHub v0.20.0: Manifest V3, five generated bundles, JS syntax, seven available regression tests, and referenced manifest files.
* v0.20.0 has a known shipped mismatch: landing/build-landing.ps1 lists finance.js, but shipped landing.js excludes it. This is an explicit GitHub Actions warning on this historical version only, not a silent pass.
* On v0.20.17+ (once pushed): `tools/check-project.mjs` is the authoritative gate, including complete manifest/HTML, native C# source contract and the current regression suite (25 tests in v0.20.18).
* Native C# Windows compilation and Opera integration are NOT covered yet.

No npm dependencies or secrets are required. Pushes and pull requests run automatically; the Actions tab also offers Run workflow. If GitHub Actions is disabled in repository settings, enable it there.
