# Stream Shell v0.22.1 — Visual Anarchy Rendering Fix

**Release date:** 2026-10-27

The first real-world v0.22.0 test confirmed that Deep Fry and Colorblind worked but Zoom, VHS, Gravity, and Aspect Ratio were not reliably visible. The Mangayomi process kill succeeded and is unchanged.

## Fixed
- Zoom and Aspect Ratio use the independent CSS `scale` property; Gravity uses `rotate`. These compose with providers' own `transform` declarations without clobbering them.
- Zoom, tilt, squashing/stretching and occasional mirroring avoid imperceptible random magnitudes at normal intensity.
- VHS has stronger scanlines, fullscreen top-layer placement where possible, and a video-level color/jitter treatment for native video fullscreen without an overlay.
- Boss Fight events (12% chance when at least two effects are enabled) combine 2–3 distinct effects using the existing single scheduler.
- All temporary CSS properties, priorities, and VHS overlays are restored/removed when an event ends, providers switch, or Anarchy is disabled.

## Verification
- Offline test simulates all six effects individually, fullscreen VHS in both DOM configurations, Boss Fight selection/composition, and exact cleanup.
- JavaScript syntax and generated bundle parity checked by `node tools/check-project.mjs`.
- **Not tested in Opera GX with live protected-provider videos**; that user-side visual validation remains necessary.

## Upgrade
Overwrite the existing extension code with this archive and reload it at `opera://extensions`. No C# helper compilation, Flutter fork rebuild, or configuration reset required. **Local background assets are intentionally excluded.**
