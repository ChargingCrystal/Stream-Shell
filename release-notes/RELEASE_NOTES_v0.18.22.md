# Stream Shell 0.18.22

## Twitch Workspace Phase 1

- Twitch remains one Wide-only right-side browser window, but that window can now retain multiple managed Twitch page contexts instead of enforcing one tab.
- Normal Twitch content and Drops Inventory are persistent built-in page instances and switch without destroying each other's page state.
- Added persistent logical instance state, session-only tab/runtime mappings, arbitrary Twitch page-instance operations and a reserved workspace-host tab for the future multi-stream embed surface.
- Twitch-created tabs/popups are adopted into the managed Twitch window.
- Raid guard state is now per tab, and changing the active Twitch tab releases a Volume Boost capture tied to the previous tab.
- `rightMode=twitch` and `twitchTarget=resume|drops` remain available as compatibility projections for current Landing, titlebar and Unified Remote behavior.

This release intentionally contains no multi-stream layout or chat UI yet. It is the lifecycle/state foundation for Phase 2.
