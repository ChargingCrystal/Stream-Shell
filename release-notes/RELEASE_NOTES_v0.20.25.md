# Stream Shell v0.20.25 — Provider Feature Startup Ownership

Released: 2026-10-21

## Why

v0.20.24 ensures that a named provider Resource Governor loop cannot run more
than once at a time. However, replaying a feature's `start*()` entrypoint could
still register extra `chrome.storage.onChanged` handlers, DOM/window listeners,
Provider API subscriptions and Governor callbacks. The risk is greatest when
one startup is waiting for `chrome.storage.local.get()` and another begins.

## Changes

- Add `startProviderFeatureOnce(name, initialize)` to the existing provider
  Resource Governor source module. It installs an ownership promise **before**
  calling an initializer, so reentrant calls or concurrent async starts share
  one registration. Initializer execution remains synchronous up to its own
  first `await`; the normal startup order and governor pace are unchanged.
- Guard seven page-lifetime startup entrypoints: `startYouTubeUtilities`,
  `startNetflixEnhancements`, `startPrimeEnhancements`,
  `startCrunchyrollEnhancements`, `startWindowedPlayer`,
  `startPlaybackUtilities` and `startNowPlayingTracking`.
- Keep existing per-feature observers and SPA rebind/cleanup logic (especially
  targeted YouTube observers, Prime skip observer, Netflix enhancements,
  Crunchyroll navigation, Netflix MAIN-world bridge) intact. This release
  does **not** introduce global teardown or a new folder structure.
- Add `common/tests/provider-feature-start-lifecycle.test.js`: tests a
  synchronous reentrant start and exercises all seven feature entrypoints,
  including double starts before storage hydration completes. Make the test
  mandatory in `tools/check-project.mjs`.

## Limits and installation

The lifecycle registry belongs to **one provider document**, not to the
browser session. Ordinary SPA navigation and feature-setting changes still
run normally; creating a fresh page initializes fresh handlers. A partial
initialization failure is not retried in-place because listeners may already
exist; reload the affected provider page if startup fails.

Apply the PATCH over **v0.20.24** and reload the unpacked extension, or use
FULL for a clean code checkout. **Native helper reinstall is not needed.**
Do not overwrite or delete your local `assets/backgrounds/` PNGs or custom
SVG/PNG artwork; the release archives exclude personal images.

## Validation

Run `node tools/check-project.mjs`. It checks byte-exact generated bundle
parity, JS syntax, behavioral regressions and Native C# source parity.
On-device Opera GX / Windows smoke tests remain necessary for actual
navigation, Netflix/Prime observer behavior, and multi-hour stability.
The optional v0.20.24 Deep Diagnostics snapshot showed three healthy YouTube
Resource Governor workloads, not a full five-provider live test.
