# Stream Shell 0.20.9 – Renderer Startup Admission Control

**Purpose:** Mitigate the reproducible Opera GX lockup when YouTube and Twitch are activated almost simultaneously. This is targeted admission control, not a confirmed fix for every Chromium/Native-Helper hang.

- **Cross-surface launch guard:** For a rapid provider → Twitch or Twitch → provider handoff, the next foreground window transition waits until 5.5 seconds have elapsed since the previous transition completed. This only serializes explicit window actions; it does **not** pause streams, chat, MoS autojoin, playback, or ongoing automation. Normal warm switches after a quiet period proceed immediately.
- **Startup-warm guard:** A hidden, freshly warmed provider also starts a renderer. It starts the same settling interval for a immediately following Twitch launch.
- **Twitch cold-start pacing:** When A–D windows must be created/recreated, space consecutive new popups by 1.25 seconds so Chromium does not construct four Twitch renderers in one burst. Already-existing slots incur no popup spacing and aren't recreated.
- **Lightweight trace events:** `window-transition / renderer-handoff-staggered` and `twitch-workspace-v2 / staggered-popup-startup` make it easy to confirm the guard ran in a small Runtime export.
- Native C# helper and protocol v9 unchanged: no reinstall.
- User-specific background artwork is not part of either ZIP.

**Expected tradeoff:** An immediate YouTube → Twitch click now *deliberately* takes approximately 5.5 seconds longer, and first-time creation of four Twitch windows takes approximately 3.75 seconds longer. This is a controlled delay rather than unbounded Opera GUI starvation. Once warm, navigation is not intentionally slowed unless a different high-cost surface was activated in the preceding 5.5 seconds.

**Verification:** Source syntax check and Node regression tests including startup admission, cold/previously-live Twitch slots, and existing titlebar/claim scenarios. Full Opera GX/WuWa crash-reproduction cannot be executed in the build environment.
