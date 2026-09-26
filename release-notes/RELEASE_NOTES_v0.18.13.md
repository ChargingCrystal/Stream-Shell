# Stream Shell 0.18.13

## Pause inactive provider playback

- Provider handoffs now request `pause()` through the existing provider adapter before the outgoing provider window is muted and minimized.
- Provider pause requests are issued in parallel so asynchronous adapter bridges do not serially delay a surface switch.
- Wide Landing/Home and Compact Dashboard use the same pause-before-park behavior when they replace a provider surface.
- Wide Dashboard/Settings do not pause the left provider because it remains visible in that layout.
- Returning to a parked provider does not auto-resume playback.
- Added historical Unified Remote notes for v0.1.0 through v0.7.2 to the bundled integration history.

No native-helper reinstall is required.
