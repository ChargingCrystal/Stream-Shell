# Stream Shell quality gates

The main **Stream Shell quality** workflow runs on each push and pull request (and manually):

- Byte-accurate generated bundle parity, plus manifest and HTML asset references.
- Syntax of independently parseable JS files.
- **All** `*.test.js` files, including legacy top-level tests, and a required set of critical behavior tests.
- Python Native source-contract checks. **This is not an Opera runtime test.**

Run the same checks locally using `node tools/check-project.mjs` (Node 22+ and Python 3).
No `npm install` or third-party dependencies are required.

The separate **Stream Shell native Windows build** workflow compiles the real titlebar helper on `windows-2022` when native C# or build tooling changes. It can also be launched manually from the Actions tab. It does **not** run the helper or install it on the runner; this smoke test detects C# compiler failures earlier.

Both workflows are intentionally simple. A green check proves these automated contracts; it cannot prove Opera GX window integration or multi-hour stability. The C# compiler invocation in `native/tests/compile-titlebar-host.ps1` deliberately mirrors the one in `native/install-titlebar-helper.ps1` and must be kept in sync.
