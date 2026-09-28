# Stream Shell 0.18.24

## Twitch Page-Context Window Isolation

- Fixed Twitch Workspace Page/Multi actions opening in Opera's normal browser window instead of remaining inside the Stream Shell right-side Twitch surface.
- Real Twitch Page instances now use dedicated one-tab popup contexts. The selected instance is restored at the existing `RIGHT` bounds; inactive instances stay parked off-screen and reusable.
- The Multi View workspace host now has its own Twitch-origin popup rather than an additional tab in the original Twitch popup.
- Runtime state now tracks both tab and window identity per Page instance plus the workspace-host window and active Twitch surface window.
- Known 0.18.23 leaked-tab mappings are migrated into managed popup windows when that session state is still available.
- Native titlebar claims, focus tracking, shutdown cleanup and Twitch Volume Boost routing now follow the selected Twitch surface window.
- The floating bar, Stream/Page chips, layouts and current Twitch/Drops/Unified Remote compatibility remain unchanged.
- Side-by-side real Page-instance tiling is not enabled yet, but the new multi-window group is the intended foundation for it.

**Update:** reload the extension only. No native-helper, COBOL-finance or Unified Remote reinstall is required.
