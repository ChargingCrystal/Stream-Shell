# Stream Shell 0.12.0

## Refactor / Cleanup

- Split Settings Center into multiple canonical source files.
- Split playback utilities into Core / Anarchy / Runtime responsibilities.
- Split YouTube utilities into smaller focused source units.
- Split routing/background helpers and removed the dead `common/src/provider-api.js` path.
- Deduplicated redundant playback-rate writes.
- Made Settings export report the manifest version dynamically rather than a hard-coded version.
- Restored the intended neon Anarchy visual state.
- Rebuilt/validated generated bundles after the structural cleanup.

**Recovered SHA-256:** `fd10dc7c41b7855d0d56c450950489642d62e49379148d9c678d8a36d95017ae`

_Recovered from the original Stream Shell development chats / release messages._
