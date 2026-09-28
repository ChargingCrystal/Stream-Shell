# Stream Shell 0.18.32

## Twitch Multi-View Hard Reset

0.18.32 deliberately removes the experimental Twitch workspace / multi-window implementation from the active code path instead of patching it again.

Diagnostics from 0.18.31 showed four distinct physical Twitch windows and zero ownership conflicts while Opera still rendered only one reliable Twitch surface. That disproved the previous ownership diagnosis and showed that the current multi-window approach itself is not a stable foundation on Opera GX.

### Restored baseline

- Twitch runtime and window lifecycle: 0.18.21 baseline.
- Twitch utility DOM automation: 0.18.21 baseline.
- Twitch audio / volume-capture behavior: 0.18.21 baseline.
- Twitch titlebar client and native helper: protocol v4 / 0.18.21 baseline.
- Wide-only Twitch/Drops UX returns to the established single managed Twitch window.
- No Twitch workspace content script is shipped.

The 0.18.22–0.18.31 release notes are retained as historical experiment/regression records.

### Update

Use the clean 0.18.32 package. Re-run `native\install-titlebar-helper.cmd` once so the installed native helper matches the restored protocol v4 client. Unified Remote and COBOL finance do not need reinstalling.
