# Stream Shell v0.20.28 — Netflix & Prime DOM Governor Wake Budget

Released: 2026-10-21

## Grounded result from v0.20.27 diagnostics

The previously failing **YouTube first → Twitch A–D** path completed in Opera GX. The Flight Recorder confirmed `renderer-handoff-staggered` from `provider` to `twitch` with `cold: true`, `graceMs: 5500`, `delayMs: 4379`, and `leaseSource: memory`. The Twitch workspace reported four new popups with 1250ms spacing and `coldStart: true`. All A–D Native Claims were confirmed and there were zero pending window transitions or YouTube governor workload failures. The 11895ms Twitch resume includes deliberate startup pacing; it is not evidence of a new freeze. This is a successful real-world repro test, not proof of every possible race interleaving.

## Changes

1. **Netflix observer admission:** Keep the existing once-per-document MutationObserver and governor polling loop. Ignore governor updates whose `domObserversAllowed` value is unchanged, including focus-only and playing/paused mode churn. Reconnect and schedule one debounced pass on a real hidden → visible or sleeping → playable transition. The existing settings and Safe Mode paths continue to reconcile the DOM observer immediately.
2. **Prime observer admission:** Only reconcile Prime's skip-control MutationObserver when `domObserversAllowed` changes. Separately reconcile subtitle Anarchy's 50/200ms visual timers when `visualWorkAllowed` changes. Prime UI/subtitle presentation markers remain controlled by settings/Safe Mode changes, not governor focus events. This avoids unnecessary attribute mutation and provider state-notification traffic.
3. **Regression coverage:** New `common/tests/provider-dom-governor-wake-budget.test.js` exercises focus-only changes, playing/paused, background-playing, sleeping, visibility recovery, storage changes and the existing explicit Safe Mode synchronization interfaces. Test is mandatory in `tools/check-project.mjs`.

## Unchanged

Provider-specific automation behavior, existing observers and their detection selectors, YouTube observer logic, all Twitch A–D controllers and the validated 5.5s/3s renderer handoff timing, 1.25s popup stagger, native C# protocol, window geometry, persisted settings, generated artwork and personal wallpapers. This release does not need a Native Helper reinstall.

## Validation & installation

Run `node tools/check-project.mjs` for JavaScript syntax, bundle parity, all regressions and static C# source-contract tests. Node mocks do not establish Netflix/Prime's actual Opera GX DOM compatibility; test video controls and Safe Mode on those sites during normal use. Apply PATCH over v0.20.27 or use FULL; do not delete locally stored custom provider artwork/backgrounds when updating.
