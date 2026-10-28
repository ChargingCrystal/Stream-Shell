# Stream Shell v0.21.7 — Mangayomi visual integration

## Changes

- Dashboard: when `leftMode=mangayomi`, show **Mangayomi** as the visual provider rather than retaining the previous web provider logo/theme. Include a bundled red Torii-style logo, white Mangayomi wordmark, and restrained red Dashboard accent. `activeProvider` remains the actual last browser provider. No new wallpaper is included.
- Native Titlebar: include `mangayomi` in the same `IsActionActive` path as all browser providers. Normal native hover/active fills and icon opacity now apply. Mangayomi gets a muted red Titlebar theme and updated monochrome symbol; saved custom color overrides remain effective.
- No changes to Mangayomi or Discord Windows-process control, owner graph, Z-order, Twitch automation, FMHY search, library, custom providers, user backgrounds or other external integrations.

## Upgrade from v0.21.6

Apply PATCH over v0.21.6, or extract FULL without replacing your local backgrounds and custom artwork. Recompile/reinstall **only the common Titlebar helper** (new C# theme/active-state logic and icon):

```powershell
.\native\install-titlebar-helper.ps1
```

Then reload the extension in Opera GX. Neither `integrations/mangayomi` nor `integrations/discord` needs reinstallation.

## Acceptance

1. Launch Mangayomi LEFT from Dashboard. RIGHT Dashboard should show Mangayomi branding, not YouTube/Netflix's stale wordmark; Mangayomi card remains selected.
2. With Mangayomi pinned in the native Titlebar, hover the button and confirm the subtle hover fill. Click to select Mangayomi and confirm the active fill persists after the pointer leaves; switch back to another left provider and confirm Mangayomi returns to idle.
3. Check a configured custom Titlebar color for Mangayomi remains respected. Confirm normal provider switching, right Discord and Twitch focus are unaffected.

Automated source/asset tests do not verify physical Windows GDI painting or Flutter focus; live Windows testing is still required. GitHub has not been changed.
