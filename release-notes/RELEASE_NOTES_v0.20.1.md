# Stream Shell v0.20.1 — Runtime Stability / Backpressure

## Scope

First controlled reliability pass after the v0.20.0 Provider Registry release. The reported failure involves delayed Opera GX browser-wide commands and multi-minute shutdown delays under prolonged WuWa load. Twitch chat and MoS autojoin may continue functioning. This release **does not claim the freeze has been fully root-caused or fixed**; it removes concrete queueing/retry amplifiers and adds useful timing telemetry.

## Changes

- **Flight Recorder:** keep a bounded 200-event in-memory ring and coalesce session-storage snapshots to approximately one write per second. Only one `chrome.storage.session.set` may be in flight. Diagnostics export uses the live ring and reports persistence status; window actions no longer await per-event persistence.
- **Startup/window transition backpressure:** coordinate full Home launch, warm provider launch, explicit provider switches and four-slot Twitch workspace activation using one bounded FIFO. A maximum of two additional transitions can wait while another is running; excess clicks receive a retryable `busy switching windows` response, rather than building an unbounded queue. This only covers UI/window transitions: it does **not** delay Twitch chat, active video, Drops, Channel Points, or Marbles autojoin.
- **Provider Resource Governor:** record failed callbacks, durations and the last error; apply exponential retry backoff (capped at 60 seconds), with automatic return to normal pacing after success. Report first/power-of-two repeated failures to the extension console instead of swallowing every error.
- **Native Titlebar bridge:** serialize slow periodic surface-claim reconciliation calls; if Opera is delayed, later ticks skip rather than pile up duplicate browser window requests. No Native C# changes.
- **Regression coverage:** Node mock tests for stalled Flight Recorder storage, bounded window-transition queue, and repeated failing provider work.

## Install / update

Extract the **PATCH** over the existing v0.20.0 installation (or use FULL), then reload the unpacked extension in `opera://extensions`. **Native helper reinstall is NOT required**; C# and Native Messaging protocol v9 are unchanged. Keep local background PNGs and custom SVG/PNG artwork; they are omitted from the ZIPs.

## Verification and remaining work

JS bundles regenerated from canonical source chunks. All available Node mock tests passed and JS/JSON syntax checked. Live Opera GX, native Windows HWND, Discord, GPU load and WuWa stress behavior could **not** be verified here. If the freeze persists, compare `Flight Recorder` transition timing (`window-transition/timing`) and resource-governor failure counters in Diagnostics after a long session. A clean Windows live-test still determines whether subsequent Native-Helper instrumentation, C# decomposition, or GPU/render-process investigation is needed.
