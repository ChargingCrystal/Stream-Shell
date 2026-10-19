# Stream Shell 0.19.27 — Dynamic Provider Grid Foundation

Phase 1 of the user-approved dynamic provider architecture.

- Dashboard provider buttons are now generated from a versioned saved registry.
- General -> Providers: show/hide and reorder the five built-in providers, 1–5 displayed currently.
- Wide Dashboard: all seven layouts defined for the future maximum of seven pinned providers; default five retain the old 1–3–1 arrangement.
- Compact: vertical dynamic list, centered when fewer than five cards are pinned.
- Registry persisted in normal Settings Export/Import. Existing built-in providers and navigation untouched.
- No dynamic native titlebar or additional URL providers in this phase; see `PROVIDER_REGISTRY_ROADMAP.md`.

## Installation

Overwrite existing extension with Full or Patch ZIP, then reload the unpacked extension from `opera://extensions`. Native helper not changed, so no reinstall needed this time.

## Verification

Syntax checks on Dashboard sources/bundle and `node dashboard/tests/provider-registry.test.js` passed. Windows/Opera GX runtime visual test still required.
