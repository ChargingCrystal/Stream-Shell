# Stream Shell v0.20.24 — Provider Named-Loop Lifecycle Guard

Released: 2026-10-21

## Why

The shared Resource Governor tracks workloads by name, but `createProviderResourceLoop()` previously registered another independent timer and governor state listener when a feature recreated a loop with an existing name. This could create duplicated polling after SPA/feature initialization and make Diagnostics show only the most recent loop while the old timer continued running.

## Changes

- The governor keeps one owned handle per workload name in `common/src/provider-resource-governor.js`. Registering that name again stops its existing timer and removes its state-change subscription before the replacement is installed.
- `stop()` is idempotent and may only remove the workload entry if its handle still owns the name; stale `stop()` / `wake()` calls cannot affect a newer loop.
- Running async callbacks are not forcibly interrupted. Once a replaced callback eventually resolves or rejects, its stopped handle cannot schedule a new timer.
- Existing governor pacing multipliers, failure backoff, listener wake conditions, public handle methods and diagnostics workload shape are preserved.
- `common/tests/provider-loop-lifecycle.test.js` exercises loop replacement, event-listener cleanup, ownership races, in-flight callback completion, and independent loop names. This test is required by `tools/check-project.mjs`.

## Scope and known limits

No broad provider SPA listener/MutationObserver restructuring. Netflix MAIN-world bridge, YouTube page observers, Discord, Twitch A–D, titlebar Native Messaging, cold-start stagger and Win32 focus/claim paths remain unchanged. Browser page lifecycle is still managed by each provider feature; `createProviderResourceLoop()` handles own only the work registered under their names.

## Installation

Apply the PATCH over **v0.20.23**, then reload the unpacked extension. **Native helper reinstall is not required.** Local `assets/backgrounds/` images and custom artwork are deliberately not included.

## Validation

Run `node tools/check-project.mjs` to verify bundle parity, source syntax, regression suite and the Native source contract. The new loop-specific test uses controlled timers/promises; actual prolonged Opera GX runtime stability is not demonstrated by offline tests. Follow-up: compare Deep Diagnostics `resourceGovernor.workloads` after extended provider navigation and a background gaming session.
