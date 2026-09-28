# Stream Shell 0.18.30

## Twitch Native Tile Layout

0.18.30 replaces the unstable simulated Twitch Multi geometry with a deterministic native-window tiler.

### Native slots

- **1 tile:** one full `RIGHT`-pane window.
- **2 tiles:** fixed 50/50 left/right columns.
- **3 tiles:** two half-width windows on the upper row and one half-width window centered on the lower row.
- **4 tiles:** fixed 2×2 grid.
- A small upper/lower-row overlap is applied so upper windows can cover the lower Opera chrome strip when z-order permits. The custom Stream Shell titlebar is unchanged and remains a separate follow-up.

### Interaction model

- A persistent `tileOrder` (maximum four IDs) is the only slot authority. Chip order no longer doubles as layout order.
- Multi toggles Native Tile on/off. Leaving Native Tile returns the selected instance to one full-right window.
- The floating bar exposes explicit `1 2 3 4` visible-count controls instead of Single/Split/Grid/Focus modes.
- Selecting an already visible instance only focuses that window. It does not resize siblings or reinterpret Multi state.
- Selecting an untiled instance appends it to a free slot; if all four slots are occupied it replaces the currently selected slot.
- New Page/Stream instances append to the next free slot while Native Tile is active.

### Stability

- Hidden keep-active Twitch windows are no longer resized or parked during every cluster action.
- Geometry is only diff-applied to the windows that are actually visible in the current slot layout.
- Browser-level tab mute remains unchanged and Twitch's in-player mute control is not used.

### Migration

- Twitch workspace/runtime schema is v6.
- Existing instances and previous tile membership are preserved as `tileOrder`.
- Active pre-v6 Multi state resets once to Single after reload so broken legacy geometry is not carried forward.

**Update:** reload the extension. The native v5 titlebar helper remains compatible; no native-helper, COBOL-finance or Unified Remote reinstall is required.
