# Stream Shell v0.20.19 – Repository Layout & Structure Hygiene

A **structure-only** code-care release. The existing runtime directory boundaries remain in place. Added [`docs/PROJECT-STRUCTURE.md`](../docs/PROJECT-STRUCTURE.md) as the canonical map for ownership, build outputs, tests, Native modules, integrations and exceptional COBOL Finance behavior.

- Relocate two legacy regression tests into `landing/tests/` and `offscreen/tests/`; update relative file loading and the CI-required test list.
- Move `CODE_AUDIT_v0.20.17.md` and `TODO_RULED_OUT.txt` to `docs/` and update current links.
- Remove unused `tools/ci-bootstrap.mjs`, refresh stale `docs/CI-SETUP.md` and check root/test placement in `tools/check-project.mjs`.
- Keep all generated runtime bundles and Native C# files **byte-identical**. No functionality, event cadence, titlebar protocol or native installer changes.
- Existing unpacked installations require removal of the old relocated files after applying the PATCH: `landing/provider-background.test.js`, `offscreen/titlebar-svg.test.js`, `CODE_AUDIT_v0.20.17.md`, `TODO_RULED_OUT.txt`, and `tools/ci-bootstrap.mjs`. This is necessary because extracting a ZIP never deletes old files.
- Do not delete or overwrite personal wallpapers or custom provider artwork.
