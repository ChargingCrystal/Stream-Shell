# Stream Shell v0.20.23 – Provider API Contract Consolidation

**Type:** Narrow content-script Provider API refactor / error-path hardening; no new UI or features.

## Changes

- `common/src/provider-api-core.js` now rebinds inherited `getCapabilities()` centrally to the **resolved provider adapter**, while preserving explicit provider-specific overrides. Factories typically spread the base adapter; retaining its original closure would otherwise discard provider-specific extension capabilities. The five built-in adapters no longer repeat the same getter assignment.
- Disney+, Netflix, Crunchyroll and Prime inherit the common `getMediaSnapshot()` method (which resolves the cached concrete adapter) instead of declaring equivalent wrappers. YouTube **keeps** its specialized static metadata cache and custom `getMediaSnapshot()` override.
- `common/src/provider-api-start.js` invokes provider-specific `resolveMediaUrl()` inside a Promise chain. A synchronous exception (e.g. while an SPA is still hydrating) now returns a normal `{ok:false,error}` reply rather than leaving the MV3 message unanswered. Existing domain-ownership validation, return shape and success logging remain unchanged.
- Add `common/tests/provider-api-contract.test.js` (all five adapter binding contracts, media snapshot semantics, initialization caching) and `common/tests/provider-media-resolver.test.js` (provider mismatch, synchronous error, Promise rejection, untrusted URL, success reply). Required by CI.

## Deliberate boundaries

- **No** changes to player control operations, Netflix MAIN-world playback bridge, provider DOM selectors, per-provider navigation watchers, storage contracts, YouTube quality/Auto Like, Twitch slots, native Win32 claims, startup delays, COBOL Finance or popup behavior.
- No new runtime directories. Source order remains unchanged; only `common/shell.js` is regenerated from edited common modules.
- Not a complete provider lifecycle overhaul: further event cleanup/observer consolidation needs focused live behavior tests before being attempted.
- Existing custom provider windows remain unmanaged by these built-in content-script adapter APIs; registry behavior is unchanged.

## Validation / installation

Run `node tools/check-project.mjs` from the extension root. Full runtime verification still requires Opera GX / Windows smoke testing. Apply PATCH over **v0.20.22**, reload the extension; **no Native helper reinstall**. Personal `assets/backgrounds/` and custom artwork are not bundled.
