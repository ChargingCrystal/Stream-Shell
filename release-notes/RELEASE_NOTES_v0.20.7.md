# Stream Shell v0.20.7 — Wide Focus IPC Decongestion

## Why

The v0.20.6 Flight Recorder identified a 22.807-second focus reconciliation for **one** Opera window-focus event. The 14.603-second `broadcastState()` portion repeatedly fetched storage and enumerated browser windows while the browser was busy. Native helper remained connected. Twitch D was missing its browser-window ID in this snapshot and reappeared when Twitch was shown again; this is **not** proof of a native claim failure.

## Runtime changes

- Wide focus and ordinary window-size changes stop waiting for the complete `broadcastState()` path; use already-loaded state and an asynchronous coalesced UI notification instead.
- No more than one in-flight UI state message from these passive events; retain only the latest replacement. Drop delayed notifications after 1.8 s instead of overwriting a later user-initiated provider change.
- Managed focus no longer enumerates all provider windows for playback cleanup; relevant managed bounds changes trigger one non-overlapping, asynchronous scan.
- Ignore browser window-size changes outside Stream Shell, avoiding irrelevant broad enumerations.
- Compact still runs the authoritative broadcast on focus, and deliberate provider/Twitch navigation retains existing full state updates.
- Log when an A-D Twitch browser popup is physically removed (slot and IDs), so a future D disappearance can be distinguished from native claim issues.

## Install

Overlay PATCH on an existing 0.20.6 folder or extract FULL, preserve your personal Background and Custom artwork files, then reload `opera://extensions`. No native helper reinstall: C# and protocol v9 unchanged.

## Verification

Node regression tests passed (11 test files including updated focus/bounds/backpressure). **Opera GX on Windows and WuWa sustained-load testing is still required.**
