# Stream Shell 0.18.11

## Unified Remote state sync fix

- Added explicit `twitchTarget=resume|drops` state to distinguish the Twitch Resume/Show action from Drops Inventory without changing the established `rightMode=twitch` surface model.
- Propagated the target through extension storage, native titlebar state, state deduplication and the local `--status` bridge.
- Managed Twitch navigation now updates that target when switching between Drops Inventory and normal Twitch pages.
- This allows Unified Remote to highlight Twitch and Drops deterministically while preserving existing Twitch Auto-Mute, window and cleanup behavior.
- Volume Boost continues to be exported as `volume=0|1` for active-state highlighting.
