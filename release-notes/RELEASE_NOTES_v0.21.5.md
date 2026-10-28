# Stream Shell 0.21.5 — Mangayomi native owner integration, clear-X restore

## Scope

- Mangayomi on Wide LEFT is temporarily attached to the explicitly claimed Opera Landing owner group. This is the structural difference behind Discord-style persistent layering: focusing or clicking the RIGHT Dashboard need not keep sending focus events to fix the LEFT app. Ownership is released on deselection, HWND replacement, profile reset and TitlebarHelper disposal. The selected HWND must be a visible `Mangayomi` process covering most of LEFT, and the shell heartbeat must be fresh. No global topmost, no foreign desktop window changes, and no change to Discord or Twitch.
- The existing bounded passive `raise` stays for initial focus ordering; owner integration is primary. New native diagnostics: `mangayomiWideOwnerAttached`, `mangayomiWideOwnerAttaches`.
- Increase the Wide Mangayomi JS geometry offset from 3 to 6 px; subtract 6 px from height. Same bottom coordinate; Compact unchanged.
- Restore clear-X for nonempty searches using value-aware CSS plus JavaScript state and ARIA; source tabs remain inside search panel header, not over search input. Wide and Compact use the same UI.

## Install

PATCH over 0.21.4; reload extension; **reinstall `native/install-titlebar-helper.ps1`** because the C# native shared TitlebarHost changed. Mangayomi integration helper itself is unchanged. Personal background and custom art assets are not packaged.

## Acceptance / limitations

Owner-graph behavior, titlebar alignment and search controls require a live Opera GX / Windows acceptance test. Linux build performs JavaScript checks and structural C# contract tests only; Windows C# compilation was **not** performed. Check new diagnostics while `leftMode=mangayomi`. Source repackage only, no GitHub push or tag. See `docs/TODO_RULED_OUT.txt`.
