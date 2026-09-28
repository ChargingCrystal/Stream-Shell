# Stream Shell 0.18.31

## Twitch Physical Window Ownership Repair

0.18.31 fixes a native-tile runtime aliasing bug where the floating bar could show four selected Twitch instances while only two physical Opera windows existed. Multiple logical instances could retain the same `windowId`; the tiler then moved those two windows through four slot rectangles, leaving the lower half of the pane uncovered.

### Changes

- one logical Twitch instance now owns exactly one physical popup window;
- registration and runtime reconciliation remove stale duplicate mappings;
- Native Tile checks for duplicate `windowId` values before applying slot geometry and rebuilds the conflicting instance into a fresh popup;
- failed physical-window allocation removes that tile from the active set rather than leaving a lying 1/2/3/4 state;
- diagnostics expose `physicalWindowCount` and `ownershipConflictCount`;
- Twitch workspace/runtime schema is now v7. The first reload from 0.18.30 closes the disposable v6 Twitch popup set once and recreates contexts from the persistent instance definitions.

The fixed 1/2/3/4 native tile geometry, browser-level mute and native titlebar protocol v5 are otherwise unchanged.

**Update:** extension reload only. No native-helper, COBOL-finance or Unified Remote reinstall is required.
