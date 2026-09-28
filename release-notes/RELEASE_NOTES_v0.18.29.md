# Stream Shell 0.18.29

## Twitch Workspace Interaction Mapping

0.18.29 fixes the interaction/state mapping that could leave Multi highlighted while a chip opened a full-size surface, leak old Split/Grid geometry into Single mode, or make the leftmost Single layout appear as a random half-window.

### Behavior

- Multi View now owns the mode. Selecting a Twitch/Page/Stream chip while Multi is active selects that member **inside Multi** instead of exiting to a full-size window.
- Adding streams/pages preserves the current Single/Multi mode.
- Grid keeps a stable chip/order mapping; main-member reordering is limited to Single, Split and Focus where a primary tile is meaningful.
- Tiled/main/selected state is repaired before Multi is shown, including stale or zero-member edge cases.
- Removing the final tiled member exits Multi into a deterministic Single surface.

### Window geometry

- Windows that leave the visible Multi set no longer keep stale half/quarter geometry. With Twitch keep-active enabled they are stacked full-size at the normal RIGHT bounds underneath the active surface.
- Switching to a Single/full-page instance performs the same normalization once, after which ordinary page switching is focus/z-order only.
- This keeps the 0.18.28 no-off-screen-parking performance improvement while removing ghost Split/Grid windows.

### Migration

- Twitch workspace/runtime schema is now v5. Existing instances, tile membership and layout preferences remain; an active older Multi session is reset to Single once after reload so 0.18.29 starts from a coherent mode.
- No native titlebar-helper changes are included in this release.

**Update:** reload the extension. No native-helper, COBOL-finance or Unified Remote reinstall is required.
