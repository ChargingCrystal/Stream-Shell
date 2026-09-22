# Stream Shell 0.9.27

## Left Titlebar Only

- Removed the Native titlebar overlay from the right screen entirely.
- Kept only the left-side native navigation bar: `H | YT | N | P | D+ | CR`.
- Eliminated the right-side overlay HWND over both Dashboard and Discord.
- Removed the right-side TOPMOST/focus-handoff conflict that could block Discord UI.
- Allowed the left Stream Shell bar to remain visible while Discord is active on the right.
- Kept the left bar hidden when normal Opera or another unrelated app owns the relevant left-side context.
- Changed only `native/StreamShellTitlebarHost.cs` and `manifest.json`; Background, Discord helper, scrapers and Now Playing stayed unchanged.

**Native helper:** Reinstall `native\install-titlebar-helper.cmd`, then fully close Stream Shell, reload the extension and reopen it.

_Recovered from the original Stream Shell development chat / release message._
