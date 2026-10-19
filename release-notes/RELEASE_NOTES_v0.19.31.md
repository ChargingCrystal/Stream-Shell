# Stream Shell v0.19.31 — Twitch Runtime Telemetry and Local Artwork

## Twitch diagnostics (new, no behavior change)

Each managed Twitch slot responds to `stream-shell-twitch-runtime-diagnostics` from the extension. This is in-memory sampling with no background storage churn. It returns `documentVisibility`, focused/covered state, join counters and last timestamps, unique observed `!play` users in current burst, scheduled jitter vs. actual wake-up, heartbeat delay and worst observed timer drift. The 10-second heartbeat does not send chat actions or keep the browser artificially awake. The background diagnostics query waits at most 1300 ms per slot (4 slots max) and records whether it received a reply. Use the exported JSON -> `shell.twitchWorkspaceV2.windows[].twitchRuntime` / `twitchRuntimeStatus`; the panel offers a summary card. Old diagnostics lacked these data; they do not prove a past throttling event.

## Local custom artwork (first branded asset integration)

Set **General -> Providers -> Edit custom provider -> Local artwork key**, e.g. `paramount`. Copy optional PNG files into the installed extension directory:

- `assets/providers/custom/custom_paramount_icon.png` (Dashboard icon)
- `assets/providers/custom/custom_paramount_wordmark.png` (large provider wordmark)
- `assets/backgrounds/custom_paramount_wide.png` (Wide 32:9 panorama)
- `assets/backgrounds/custom_paramount_compact.png` (Compact background)

When one or more files are missing, initials/name/gradient remain visible. Edit or reorder provider entries without reloading video windows; after copying local PNGs into extension root reload the extension. Artwork keys permit only `[a-z0-9_-]`, lower-case normalization, <= 32 chars, and no arbitrary paths/remote URLs. The asset key is stored in the registry and settings import/export; the **images themselves are local and not part of settings export**. Custom images are deliberately excluded from both FULL and PATCH ZIPs, as are all background PNGs. Existing backgrounds for integrated providers are never rewritten. Native Windows titlebar custom-provider buttons still use text initials; native PNG icon transport is not included in this tranche.

## Tests / remaining work

- Code: check JS syntax, shared registry/layout, native protocol and custom-window regression tests; source bundle equality and ZIP CRC. Windows visual test still needed for PNG fallbacks/Wide and Compact, plus Twitch timer metrics during a delayed MoS Autojoin.
- Native protocol v7 and C# helper unchanged; no reinstall required.
- Still open: optional direct file picker for asset import, native custom PNG icon artwork, Compact/high-DPI overflow edgecases, and actual Opera GX runtime assessment of periodic Twitch script throttling.
