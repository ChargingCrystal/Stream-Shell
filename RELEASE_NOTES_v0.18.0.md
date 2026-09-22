# Stream Shell 0.18.0

## Compact performance and fullscreen pass

- YouTube Playables are hidden by a new default-on Cleanup setting.
- Compact provider fullscreen now hides the native Stream Shell titlebar/backdrop and restores it on exit via native titlebar protocol v4.
- Compact native reconciliation does less repeated work while keeping the 500 ms foreground safety check.
- Alt+Tab caption/icon repair is event-driven with a 5-second drift audit instead of a 500 ms rewrite loop.
- Compact Home loads its independent media helpers in parallel.
- The remembered warm provider is created below the virtual desktop and minimized before use, preventing the full-display launch flash.

### Native helper

Re-run `native\install-titlebar-helper.cmd` after replacing the extension files because the native titlebar host changed.
