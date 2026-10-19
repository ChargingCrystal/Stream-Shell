# Contributing to Stream Shell

Stream Shell is a **personal, Windows / Opera GX-first project** rather than a general-purpose streaming product. Reproducible fixes and focused improvements are welcome; arbitrary browser, layout or service support is not promised.

## Before reporting a bug

Check the latest version, recent [release notes](release-notes/) and existing issues. Include the affected provider, display mode (**Wide 32:9** or **Compact 16:9/16:10**), Opera GX/Chromium and Windows versions, and a short reproduction sequence. For built-in provider problems, mention whether Provider Safe Mode affects the bug.

For native issues, note whether the titlebar or the separate Discord helper was installed and whether its installation was refreshed for the relevant native release. If using a custom provider, distinguish the custom site's own browser behavior from window/registry behavior in Stream Shell.

Diagnostics can help, but **full JSON exports may contain URLs, Twitch channel names, local settings and token-related configuration**. Review/redact private information before sharing logs, screenshots or attached files publicly.

## Project architecture (0.20.0)

- **Five built-in provider adapters**: YouTube, Netflix, Prime Video, Disney+ and Crunchyroll. They use service-specific scripts and must keep those boundaries.
- **Custom providers**: validated HTTPS URL, stable ID, optional artwork key, managed Opera window. They have no automatic provider-specific scripting, media extraction or extra host permissions.
- **Provider Registry**: shared validation in `shared/provider-registry-core.js`; independent Dashboard order/pinning (maximum seven) and Native Titlebar order/visibility (unlimited, with overflow); stored/importable settings.
- **Wide**: left provider focus must never accidentally change the selected right-side Dashboard/Discord/Twitch surface. Preserve acknowledged Twitch A-D window claims and right-pane Z-order behavior.
- **Compact**: single-screen host (16:9 / 16:10). Test layout differences explicitly instead of copying Wide geometry or window ownership rules blindly.
- **Native titlebar**: C# Windows helper with its own protocol/version. Custom PNG primary → provider SVG monochrome fallback → initials; provider theme accent must not tint icons. The Discord helper is separate.

Keep the five local artwork conventions documented in the [README](README.md). Custom PNGs/SVGs and user backgrounds **must not enter patches or releases**. No automatic Settings artwork-import feature is planned.

## Editing and builds

Canonical JavaScript source is usually under `*/src/` or `shared/`; generated runtime bundles (`background.js`, `dashboard/dashboard.js`, `dashboard/compact-home.js`, etc.) are loaded by Opera GX. See the relevant `SOURCE-README.txt` and local `build-*.ps1` before changing generated output.

When implementing a change:

- Keep site-specific DOM/player code inside the provider adapter; use shared logic only where there is a genuine shared consumer.
- Never make native geometry, a generic Opera window or a mere focus event sufficient to claim ownership of an arbitrary HWND; preserve explicit/native claim boundaries.
- Keep Netflix playback mutations through its MAIN-world player bridge rather than directly writing `video.currentTime` or triggering generic `play()` / `pause()` / speed / volume changes.
- Preserve warm provider-window reuse; reordering or theming buttons must not reload playing content.
- Keep Wide right-pane state independent of dashboard provider selection and Now Playing navigation.
- Preserve stable provider IDs and registry normalization across settings export/import.

## Testing and pull requests

Run applicable Node tests and build scripts, then verify the affected workflow in Opera GX when possible. Include the display mode, provider(s), window/Titlebar state, overflow behavior if relevant, and diagnostics evidence. For any C# helper change, say whether `native\install-titlebar-helper.cmd` must be rerun and which protocol version is expected.

Explain the change, why it was needed, exact files/surfaces touched, and actual test coverage in the PR. Do not describe Windows/Opera live checks as passed unless tested on Windows/Opera. The [PR template](.github/pull_request_template.md) outlines useful details.

Functional application releases should update `manifest.json`, `CHANGELOG.md` and `release-notes/RELEASE_NOTES_vX.Y.Z.md`. **Documentation-only changes do not require an application version bump.** Older release notes are historical and should not silently be rewritten to describe newer runtime behavior; update current docs instead.

## License

Contributions are subject to the repository's existing [PolyForm Noncommercial License 1.0.0](LICENSE.md). Commercial use remains restricted.
