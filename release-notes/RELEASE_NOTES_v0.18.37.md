# Stream Shell 0.18.37 — Twitch Persistent Split Workspace

0.18.37 promotes the proven direct-final-geometry pair from a lab-only action into a sticky Wide Twitch workspace without reintroducing the retired 0.18.22–0.18.31 tiler lifecycle.

## What changed

- Once the 50/50 Split View exists, the ordinary Landing **Twitch** and **Drops** controls reuse that same A/B pair instead of tearing it down and creating a new single Twitch window.
- **Twitch** selects/focuses member A; **Drops** selects/focuses member B. A member is only navigated when it no longer matches the requested role, so pressing the same control again is focus/z-order only.
- Dashboard and Discord still cover the live pair without moving, resizing, parking or destroying either Twitch surface.
- Split resume keeps the same native v5 A/B cluster claims and records `reuseCount`, last focused member and activation reason.
- Diagnostics schema v11 adds each Twitch document's `performance.timeOrigin` and navigation type so accidental document reloads can be distinguished from simple surface activation.
- Shift+Split remains the fixed `gronkhtv` + `rainbow6` reference pair. Switching between reference and mixed mode still intentionally rebuilds the pair once because the requested URLs are different.

## Update

Extension reload only when upgrading from 0.18.36. The native helper remains protocol v5 and does not need to be reinstalled.
