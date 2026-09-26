# Stream Shell 0.18.9

## Unified Remote Control Bridge

- Added a local named-pipe control bridge to the existing native titlebar host.
- Added `StreamShellTitlebarHost.exe --action <name>` client mode with explicit action allowlisting and a short bridge timeout.
- Reused the existing native titlebar action event path so remote controls do not duplicate Dashboard/provider/settings/window logic.
- Kept native-messaging protocol v4 unchanged.
- Initial Unified Remote pilot wires Dashboard through the bridge; the remaining controls stay preview-only until the transport is verified.

**Native helper:** Reinstall `native/install-titlebar-helper.cmd` after updating.
