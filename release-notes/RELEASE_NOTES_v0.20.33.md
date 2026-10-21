# Stream Shell v0.20.33 — Twitch Automation Physical Code-Split

Date: 2026-10-21

## Evidence from v0.20.32 Opera GX Deep Diagnostics

The user reported that v0.20.32 survived another worst-case startup **without observed Marbles false joins**. The v0.20.32 snapshot confirms three detected history batches, totaling 148 discarded historical chat lines across B/C/D (50/48/50), plus 15 hydration-discarded lines on C. Slot C also logged a submitted, successful Marbles autojoin after history quarantine. All A–D runtimes are active and their Twitch Native claims confirmed; the native overall snapshot has one temporarily pending **Dashboard** claim. Window transition counters are clear. A warm provider/Twitch round-trip is present in addition to successful cold Twitch startup. `twitch:resume` measured 11.61s on this run, so performance work remains beneficial.

## Actual code splitting (not only delayed DOM work)

- `providers/player/twitch-utility.js` (~430 lines) remains the **only Twitch `document_start` JS**: managed identity/admission handshake, slot and raid-state tracking, playback intent, compositor wake, throttled interaction IPC and navigation intercept, 10s heartbeat and per-slot Diagnostics endpoint.
- `providers/player/twitch-automation.js` (~760 lines) now exclusively owns heavy DOM observer/scan, Community Points, Drops, raid detection and Marbles chat observation, cooldown, timestamp/order/batch history quarantine and editor submission. It is not auto-injected by the manifest. The exact delay is A/B/C/D 650/1000/1350/1700ms before the core requests the late module.
- The background message router verifies sender Twitch URL, top frame, managed V2 `role=slot`, valid A–D slot and binds `chrome.scripting.executeScript` strictly to `sender.documentId`; missing document identity is rejected rather than risking cross-navigation injection. No outside tabs, unmanaged Twitch pages or subframes can request the optional module.
- The late module exposes only a small content-world bridge to the core; startup is exactly once, settings and channel/raid changes are forwarded, pagehide disposes observer/timers/pending joins. Diagnostics continue to report `automation.startup` and the Marbles history counters, including before the module is active.
- Existing optional `twitch-hud-loader.js` + `twitch-workspace-v2.js` remain untouched. Native compositor wake, 1.25s Twitch slot popup stagger, provider/Twitch 5.5s/3s handoff lease and C# helpers remain unchanged.

## Checks and known limits

Static project quality gate and isolated VM regression cover the kernel's early lifecycle, successful A–D late injection, duplicate rejection, premature pagehide, stats, retained history replay tests and trusted background admission contract. **Actual Opera GX startup feel, Drops/Points, first Marbles new-round joins and HUD/network contentions require live verification**; the offline tests cannot prove a speedup or live Twitch markup correctness. A late injected script is permitted only for verified A–D slots; generic unmanaged Twitch windows intentionally receive no DOM automation.

FULL and PATCH archives exclude user wallpapers and custom provider/titlebar artwork. PATCH overlays v0.20.32; Native helper reinstall is unnecessary.
