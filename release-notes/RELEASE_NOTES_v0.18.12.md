# Stream Shell 0.18.12

## Unified Remote repository integration

- Added Stream Shell Unified Remote v0.8.3 directly to the main repository under `integrations/unified-remote/`.
- Kept the remote in a `Remotes/Custom/Stream Shell` subtree matching Unified Remote's expected custom-remote layout below its Windows data root.
- Added installer and uninstaller wrappers for `C:\ProgramData\Unified Remote\Remotes\Custom\Stream Shell`, including an elevation retry when the Unified Remote data directory is not writable.
- Added installation, requirements, update and active-state documentation.
- Updated repository-facing descriptions and the public version marker.

No extension/runtime or native-helper logic changed from 0.18.11. Existing 0.18.11 titlebar-helper installations remain valid.
