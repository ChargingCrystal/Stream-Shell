# Stream Shell v0.22.0 — Kill + Anarchy Director

## Native application hard stop
- Settings → General → Providers → **Kill Mangayomi (process)** (both Wide and Compact).
- Requires confirmation, then sends a native `kill` command only for the configured Mangayomi binary, forcibly terminates its processes and descendants and validates exit. This is a hard stop; unsaved Mangayomi work will be lost.
- Normal provider switching still only hides Mangayomi. The global skull Kill now also terminates the configured Mangayomi process. Seven Seas opt-in is not required for terminating an app already running; the other actions remain gated.
- Stremio is not yet supported.
- **Native Helper update required**: compile with `integrations/mangayomi/tests/compile-mangayomi-host.ps1` and install using `integrations/mangayomi/install-mangayomi-helper.ps1` before testing Kill.

## Visual Anarchy Director
- Settings → General → Anarchy, initially off.
- Random events: Deep Fry, Zoom, VHS scanlines, Color Roulette, Gravity rotation and Aspect Ratio Crimes.
- Frequency: Occasional (60–120 sec), Chaotic (20–60 sec), Absolute (5–15 sec); intensity slider and separately switchable effects.
- Optional Boss Fights sometimes combine up to three selected effects.
- One shared event scheduler (no additional per-effect polling loops). Only a visible, active, playing video is eligible. All injected inline styles/overlays are removed on exit or disable.
- Existing Playback, Subtitle and DVD Anarchy continue independently; Provider Safe Mode suppresses the new Director.

## Tests and install
- Offline JS quality gate covers source/bundle parity and new native command + visual timer/cleanup regression tests.
- Actual Windows C# compiler success, forced process stop and on-device video visual correctness require user verification before calling this production-hardened.
- Overlay ZIP over existing extension (background image files excluded), compile/install native Mangayomi helper, reload extension under `opera://extensions`.
- Twitch freeze investigation and TitlebarNativeHost post-exit cleanup remain TODO.
