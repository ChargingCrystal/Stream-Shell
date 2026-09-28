# Stream Shell 0.18.20

## Remote Contrast + YouTube Windowed Reflow

- Updated the bundled Unified Remote to v0.8.4 with lower-intensity Twitch/Discord active-state backgrounds and a darker Discord idle surface so the auxiliary logos remain readable.
- Kept Drops and all provider/navigation active-state behavior unchanged.
- Added a bounded YouTube layout refresh sequence whenever Windowed Fullscreen is enabled or disabled.
- The refresh sequence runs after the root layout marker changes and after YouTube theater-mode transitions, fixing stale dimensions that previously produced black borders when entering Windowed Fullscreen or clipped video after leaving it until refresh.
- Stream Shell still only exits YouTube theater mode when it was the component that entered theater mode.

**Update steps:** reload the extension. Re-run `integrations/unified-remote/install-unified-remote.cmd` and restart Unified Remote Server for the remote visual changes. No native-helper or COBOL-finance reinstall is required.
