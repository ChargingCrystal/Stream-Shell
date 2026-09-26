# Recovery Status

## What is now recovered

- **222 canonical version-specific release notes** from **0.1.0 through 0.18.12**.
- Notes are version-specific rather than chat summaries.
- Known regression/rollback builds are preserved as such.
- A reused 0.17.12 publication state is preserved separately in `variants/`.

## Deliberately not fabricated

The only explicit numbered hole currently visible in the reconstructed sequence is:

- `0.9.25`
- `0.9.26`
- `0.9.27`
- `0.9.28`
- `0.9.29`

There may also have been intentionally skipped numbers. A number is **not** treated as missing just because semver would allow it; it is only added when a recovered chat/release message proves that build existed.

## Merge rule for future recovered chats

1. If a new chat contains an exact release message, create/update the canonical `RELEASE_NOTES_vX.Y.Z.md`.
2. If the same version number was later reused for a materially different build, keep the canonical code release and add the other state under `variants/`.
3. Do not roll adjacent changes together just because they occurred in the same chat.
4. Preserve regression builds and immediate rollbacks; they are part of the real project history.
