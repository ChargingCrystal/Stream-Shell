# Stream Shell v0.20.2 — Twitch Workspace Launch Latency

## Root of the observed post-launch queue stall

In v0.20.1, the Flight Recorder captured `twitch:resume` taking **9,455 ms** and a subsequent `provider:youtube` command waiting **8,674 ms** before it began. The Twitch workspace was already visually shown while the window transition was still running. Code review found that the activation path synchronously returned `getTwitchWorkspaceV2Diagnostics()`, which queries all four Twitch windows one after another, including injected document-identity checks and renderer-message calls bounded to 1.3 seconds **per slot**. Because the v0.20.1 queue correctly serialized full transitions, this diagnostic collection blocked the next user-requested window action.

## Fix

- Normal `showTwitchWorkspaceV2()` responses now return the lightweight `getTwitchWorkspaceV2Summary()` (storage/configuration only). The heavy per-slot renderer diagnostics are **never awaited on this launch path**.
- Full Twitch A–D diagnostics remain available in the explicit Diagnostics overlay/JSON export.
- On unusually slow post-launch state broadcasts (>750 ms), add a single `twitch-workspace-v2 / slow-broadcast` timing event for targeted follow-up investigation.
- Do not change Twitch slot creation, focus, native claims/ack handling, native window recovery, MoS autojoin, or the C# helper. Native Messaging protocol remains v9.

## Install

Overlay PATCH on v0.20.1 (or use FULL), reload the unpacked extension at `opera://extensions`. **Do not reinstall native helper**; local backgrounds and custom artwork remain outside the ZIP.

## Verification

The regression test asserts the activation response stays lightweight even when full diagnostics is deliberately slow; standard Node tests, JavaScript syntax and generated-bundle parity are checked. The measured 9.46-second / 8.67-second timings are from the user's v0.20.1 capture. Improvements in real Opera GX and long-running WuWa sessions require user validation; other Chromium/Win32 bottlenecks may still exist.
