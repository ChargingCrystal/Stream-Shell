# Stream Shell v0.20.11 – Functional Reconciliation & Twitch Skeleton

Recommended: apply PATCH over v0.20.10, reload Opera extension. Native helper updated: rerun `native/install-titlebar-helper.cmd` for C# cleanup.

- 5.5s safety gap remains on cold start and for 30 seconds after new Twitch popup creation; warm cross-surface handoff may use 3.0s.
- Twitch A-D cold window spacing stays 1.25s.
- Visual 2x2 Twitch skeleton on dashboard during cold startup. No extra browser APIs.
- Focus-selected Twitch slots update without IPC scans; provider governor focus updates from cached window+tab identity.
- Native browser-window/handle map cleanup now synchronized on duplicate and stale member removal.
- Safety caveat: Windows-specific native behavior requires real Opera/Windows test. No claim of Windows test coverage.
- Backgrounds and custom artwork are not in this release.
