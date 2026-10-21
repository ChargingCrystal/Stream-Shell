# Stream Shell v0.20.26 — Provider Governor Snapshot Ordering & YouTube DOM Wake Budget

Released: 2026-10-21

## Why

The v0.20.25 Deep Diagnostics export reports a healthy active YouTube provider,
three working Governor loops, and four confirmed native Twitch slot claims.
Its Flight Recorder also shows a long Twitch cold-start transition (~10.7 s)
and a provider switch (~12.4 s, including ~7.7 s queued wait). Those are
recorded performance observations, not a demonstrated regression from v0.20.25.
The current patch **does not change** the intentional renderer/Twitch delays.

## Changes

1. **Latest-only asynchronous window-state snapshots:** in
   `common/src/provider-resource-governor.js`, each browser-IPC refresh receives
   a monotonically increasing sequence. Only the most recently requested
   response may apply. A newer pushed background window state invalidates any
   refresh started before the push. A foreign-provider response cannot replace
   the current provider's state. Rejection safely retains the existing state.
2. **YouTube DOM observer wake budget:** in
   `common/src/youtube-utilities-start.js`, governor events only reattach
   targeted observers and restart bounded SPA settle passes when
   `domObserversAllowed` actually changes. Pure focus and play/pause mode
   changes keep the current DOM observers untouched. Genuine parking/wake
   and `yt-navigate-finish` continue their original teardown/rebind behavior.
3. **Regression coverage:** new required tests
   `common/tests/provider-window-state-ordering.test.js` and
   `common/tests/youtube-observer-wake-budget.test.js` assert ordering,
   push precedence, cross-provider safety and selective observer reactivation.

## Deliberately unchanged

The background window transition queue, Twitch A–D popup stagger, renderer
handoff grace, native titlebar/Discord, provider adapter contracts, playback,
Safe Mode, settings persistence and custom wallpapers have not been altered.
This is a provider-content runtime patch; **no Native helper reinstall**.

## Applying

Use PATCH over **v0.20.25** and reload the unpacked extension in Opera GX, or
use FULL as a complete code baseline. Release archives exclude your local
background PNGs and optional custom artwork. Do not delete existing local
artwork when updating.

## Validation

Run `node tools/check-project.mjs` to verify bundled source parity, syntax,
regressions and the static C# source contract. These are not Windows/Opera GX
integration tests. Next runtime validation: YouTube playback + rapid focus
switches + hidden/visible wake; Netflix/Prime SPA/settings toggles; cold Twitch
startup and provider transition timing using the Flight Recorder.
