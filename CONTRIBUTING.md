# Contributing to Stream Shell

Stream Shell is a personal, Windows / Opera GX-first streaming workspace. Contributions are welcome when they improve existing functionality or are aligned with the architecture; support for arbitrary browsers, services or hardware is not guaranteed.

**Current application release: 0.22.1.** Start with the [README](README.md), [project structure](docs/PROJECT-STRUCTURE.md), [CI quality guide](docs/CI-QUALITY.md) and the latest [release notes](release-notes/RELEASE_NOTES_v0.22.1.md).

## Scope and design rules

- Preserve **Wide 32:9** left/right-window isolation and **Compact 16:9 / 16:10** behavior. Test both Compact aspect ratios when making CSS or layout changes.
- Respect the shared Provider Registry: Dashboard provider selection (max seven) and native titlebar provider ordering/overflow are independently configurable. Custom HTTPS providers do not inherit built-in script permissions.
- Keep independent desktop applications independent. Mangayomi uses a dedicated optional Windows Native Messaging host and an opt-in patched app; no bundled desktop EXE. Stremio is not yet implemented.
- **Seven Seas is default-off and enforced in the runtime.** Any new action that starts, searches or opens content through a gated integration must be checked on its actual execution path, not merely hidden in Settings. Closing/killing an already-running app must remain possible for cleanup.
- Never weaken Native Messaging sender authorization, configured-process/path identity checks, local-bridge credentials, or explicit window-ownership boundaries for convenience.
- Prefer a single scheduled loop per page feature, with cleanup on navigation, visibility change and extension shutdown. Avoid extra unbounded MutationObservers or timers; Wide freeze diagnosis remains open.
- Isolate and restore Anarchy's temporary video styles rather than replacing provider-managed CSS transformations. Default off.
- Preserve saved Library, Watchlist and display-scoped settings on update. No silent migrations or reordering that destroys user preferences.
- Do **not** add user-supplied background images, custom artwork, diagnostic exports, local tokens, databases or helper binaries to the repository.

## Development workflow

Canonical JavaScript source lives in the relevant `src/` directories; Opera loads the generated bundles. Follow each `SOURCE-README.txt` and `build-*.ps1` before editing generated files. Keep tests next to their owning area under `tests/`, maintain the folder boundaries in `docs/PROJECT-STRUCTURE.md`, and update user-facing documentation when behavior changes.

From the extension root:

```powershell
node tools/check-project.mjs
```

The offline checks need Node 22+ and Python 3. For Windows Native changes, additionally run the appropriate compiler check:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\native\tests\compile-titlebar-host.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integrations\mangayomi\tests\compile-mangayomi-host.ps1
```

Only run the one(s) relevant to your changes. Windows compiler checks do not demonstrate actual Opera / window / Flutter behavior. Document which checks ran and which were not possible. In particular, do not interpret mocked player tests as proof of a long-session browser freeze fix.

## Issues and pull requests

Report the exact version/commit, browser and OS, **Wide / Compact** mode, active provider(s), steps to reproduce and expected/observed behavior. For native issues, indicate which helper version was actually compiled/installed, whether Opera GX was restarted, and if relevant the configured executable path (redact personal directory names).

Include test results and describe whether generated bundles were rebuilt. Never publish full raw Diagnostics or performance logs without reviewing/redacting URLs, account details, tokens, channel names and filesystem paths.

Functional releases update `manifest.json`, `CHANGELOG.md` and a `release-notes/RELEASE_NOTES_vX.Y.Z.md` file. Documentation-only edits **do not require a new extension version**; avoid rewriting historical release notes to describe later behavior.

## Licensing

Contributions are covered by the existing [PolyForm Noncommercial License 1.0.0](LICENSE.md). Commercial usage is restricted.
