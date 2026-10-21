# Stream Shell v0.20.17 — Repository Quality Gate & Safe IPC Boundaries

- Whole-project audit of v0.20.16 source/manifest, C# modules, background, shell/dashboard, providers, Twitch, HTML and build definitions. Detailed findings in `docs/CODE_AUDIT_v0.20.17.md`.
- Add `node tools/check-project.mjs` and GitHub Actions CI for generated-bundle parity, runtime asset references, standalone JS syntax, all JS regressions, and the existing native C# source contract (not a Windows compile).
- Fix previously inconsistent Landing build list: `finance.js` is an archived independent module **not present in the working v0.20.16 Landing bundle**, so a rebuild must not unexpectedly enable it. Shipped Landing runtime remains byte-for-byte unchanged.
- Harden the background message boundary against malformed envelopes; make `get-state` send an error response if its async data reads fail.
- No C# changes; no changes to focus, window reclaims, Twitch automation, cold/warm renderer admission, Skeleton or Provider playback. Native helper reinstall **not** required.
- Local backgrounds/custom artwork continue to be excluded from release archives.
