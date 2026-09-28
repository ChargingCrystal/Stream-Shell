# Stream Shell 0.18.21

## Unified Remote Active-State Rollback

- Rolled the Unified Remote runtime/state-update path back to the known-good v0.8.3 implementation after v0.8.4 stopped live active-state highlighting on the installed remote.
- Kept the requested lower-intensity active backgrounds for Discord (`#343b68`) and Twitch (`#4c2d63`).
- Restored Discord's inactive background to the shared neutral remote color (`#66707d`).
- Kept the YouTube Windowed Fullscreen reflow fix from 0.18.20 unchanged.

**Update steps:** re-run `integrations/unified-remote/install-unified-remote.cmd` and restart Unified Remote Server. No native-helper or COBOL-finance reinstall is required.
