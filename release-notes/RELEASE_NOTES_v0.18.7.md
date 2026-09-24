# Stream Shell v0.18.7

## YouTube Compact titlebar / focus repair

This release fixes the remaining YouTube-only Compact titlebar differences without changing the established behavior of Netflix, Prime Video, Disney+, Crunchyroll or Wide mode.

- YouTube now uses the same minimum 34-logical-pixel Opera caption baseline as the other Compact providers.
- The YouTube masthead/page layout receives an 8px Compact-only inset matching the native overlay overhang, preventing the corrected titlebar from clipping YouTube's own top controls.
- YouTube focus loss now ignores transient, unclaimed Opera helper/tool HWNDs when checking whether the Stream Shell titlebar is actually occluded.
- Real normal Opera windows and foreign applications still hide the titlebar when they physically cover the Stream Shell titlebar band.
- YouTube fullscreen focus reconciliation uses a second confirmation sample before clearing the fullscreen claim.

## Included Compact fixes since v0.18.6

- Fixed Compact 16:9 subscription row sizing.
- Removed Compact Now Playing and its minimized-provider snapshot path.
- Preserved Compact fullscreen titlebar suppression across Alt-Tab/focus loss.
- Reconciled stale fullscreen state against the live provider document.

**Native helper:** reinstall `native/install-titlebar-helper.cmd` after updating.
