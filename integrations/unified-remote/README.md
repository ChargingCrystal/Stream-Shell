# Unified Remote integration

This folder contains the first-party **Stream Shell Unified Remote v0.8.3** control surface.

It talks to Stream Shell through the local Windows control bridge exposed by the installed native titlebar helper. The remote does not duplicate provider/window-management logic and does not connect to the browser extension directly.

## Requirements

- Windows
- Stream Shell **0.18.11 or newer**
- Stream Shell native titlebar helper installed via `native/install-titlebar-helper.cmd`
- Unified Remote Server and the Unified Remote mobile app

## Install

### One-click

Run:

`install-unified-remote.cmd`

The installer copies the bundled remote to Unified Remote's Windows custom-remote directory:

`C:\ProgramData\Unified Remote\Remotes\Custom\Stream Shell`

If the existing Unified Remote data directory requires elevation, the installer retries with a UAC prompt.

After installing or updating the remote, restart Unified Remote Server from its web manager so the remote is reloaded.

### Manual

Copy this folder:

`Remotes\Custom\Stream Shell`

into:

`C:\ProgramData\Unified Remote\Remotes\Custom\`

The resulting path should be:

`C:\ProgramData\Unified Remote\Remotes\Custom\Stream Shell\remote.lua`

Then restart Unified Remote Server.

## Update / uninstall

Running the installer again overwrites the bundled Stream Shell remote files in place.

Run `uninstall-unified-remote.cmd` to remove only the installed `Stream Shell` custom remote. Stream Shell itself and Unified Remote Server are not modified.

## Behavior

- Provider, Landing, Dashboard, Settings, Volume Boost, Discord and Twitch buttons reflect Stream Shell's exported active state.
- In Wide mode, Settings overlays Dashboard, so both buttons can be active at once.
- Bringing Discord or Twitch above the right Stream Shell pane clears Dashboard/Settings highlighting.
- Unrelated external applications do not alter the last internal Stream Shell button state.
- Landing, Discord and Twitch controls are hidden in Compact mode.
- The remote polls bridge state once per second while its page is focused, so PC-side Stream Shell changes catch up without reopening the remote.
- Reload intentionally has no persistent active state.

## Files

Historical per-version notes for the custom remote are bundled next to the remote source as `RELEASE_NOTES_v*.txt`, covering the prototype/visual passes through the current v0.8.x state.

The actual custom remote lives under `Remotes/Custom/Stream Shell/` so the repository mirrors the directory subtree expected below Unified Remote's data root without embedding a fake `C:` drive tree.
