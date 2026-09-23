# Contributing to Stream Shell

Thanks for taking an interest in Stream Shell.

Stream Shell is first and foremost a **personal project** built around the maintainer's own Opera GX / Windows streaming setup. Issues and pull requests are welcome, but the public repository is not a promise to support every browser, operating system, display layout, provider variant, or workflow.

## Before opening an issue

Please:

1. Reproduce the problem on the latest public release when practical.
2. Check existing issues and the relevant file under [`release-notes/`](release-notes/) for known regressions or recent changes.
3. If the problem affects a provider, note whether that provider still works with **Safe Mode** enabled.
4. Include enough environment information to reproduce the problem: Stream Shell version, Opera GX/Chromium version, Windows version, display profile, provider, and relevant Diagnostics/log output.
5. Review logs and Diagnostics exports before posting them publicly. Remove anything you consider personal or sensitive.

Provider DOMs and browser behavior change without notice, so a provider-specific regression does not necessarily mean the core shell is broken.

## Scope

Current personal display targets are:

- **Wide 32:9**
- **Compact 16:9**
- **Compact 16:10**

Other resolutions may receive a best-effort fallback, but Stream Shell is deliberately **not** a general-purpose responsive product with an arbitrary-resolution support matrix.

Feature requests are most useful when they describe a concrete use case rather than asking for completeness for its own sake.

## Development conventions

Stream Shell keeps canonical source fragments next to generated runtime bundles. See the repository `README.md` and the `SOURCE-README.txt` / build scripts near the larger bundles before editing generated files directly.

When making changes:

- Keep provider-specific DOM/player behavior behind the provider adapter where possible.
- Reuse shared shell data/logic instead of creating provider- or layout-specific copies.
- Expand the Provider API only when a real shared-shell consumer needs the capability.
- Preserve explicit native-window trust boundaries. Native geometry/process/focus observations may validate a Stream Shell claim; they must not independently promote ordinary Opera windows into Stream Shell.
- Do not replace Netflix playback writes with direct `video.currentTime`, `play()`, `pause()`, rate, or volume mutations. Stream Shell uses the Netflix MAIN-world player bridge for those operations.
- Avoid resource "optimizations" that close or reload inactive provider windows; fast warm switching is intentional.

## Testing

There is no exhaustive automated compatibility matrix. Test the surfaces affected by your change and describe what you tested in the pull request.

Useful checks include the affected provider in normal mode, Safe Mode behavior when relevant, SPA navigation, Dashboard/provider switching, the relevant display profile, native titlebar behavior if native helper code changed, and fullscreen/volume behavior if playback integration changed.

If you modify the native titlebar helper, mention whether `native\install-titlebar-helper.cmd` must be run again.

## Release notes and versioning

Functional app releases should receive a version-specific note under:

`release-notes/RELEASE_NOTES_vX.Y.Z.md`

Keep notes concrete: what changed, what regressed or was rolled back, and any required reinstall/migration step.

Documentation-only corrections to historical release notes do **not** require an application version bump.

## Pull requests

Keep pull requests focused enough that the change can be reasoned about and tested. Explain what changed, why, the affected providers/layouts/native components, what you tested, and whether a release note or helper reinstall is required.

Large refactors are easier to review when behavior-preserving cleanup is separated from new functionality.

## License

By contributing, you agree that your contribution is distributed under the repository's existing [PolyForm Noncommercial License 1.0.0](LICENSE.md).

Commercial use remains restricted by that license.
