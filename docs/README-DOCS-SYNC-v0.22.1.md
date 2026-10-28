# Documentation sync for Stream Shell 0.22.1

Date: 2026-10-28. Documentation-only change; extension version stays **0.22.1**.

Updated: main README, CONTRIBUTING, SECURITY, architecture contract, quality/CI instructions, Mangayomi integration documentation, titlebar helper current notes, and .gitignore.

The application Changelog and v0.22.1 release notes already describe current code changes; those historical records are intentionally unchanged. The main README has been consolidated so it does not duplicate obsolete per-release implementation notes.

For public release, **do not add personal wallpapers/custom provider artwork, diagnostic logs, local credentials or installed helper binaries**. Git ignore rules do not untrack assets previously committed; use `git rm --cached` on the affected paths to remove them from the current index while retaining local copies. Git history is unchanged.

Known open investigations: persistent TitlebarNativeHost process after Opera GX shutdown; rare full-shell freezes, with Twitch-related behavior only a working hypothesis. Stremio is planned, not present.
