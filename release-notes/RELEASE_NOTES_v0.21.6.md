# Stream Shell 0.21.6 — Native app handoff and Titlebar pinning

## User-reported regressions

- After activating Wide LEFT Mangayomi, selecting a different LEFT provider through the native Titlebar previously hid the Stream Shell chrome while Mangayomi's own app controls reappeared. The app could remain over Landing, then fall behind it when clicking RIGHT Dashboard. v0.21.6 updates the **Mangayomi integration helper's hide action** to hide, rather than only minimize, its verified window. Once `leftMode` switches, the TitlebarHost's existing owner-graph reconciliation releases its claim. `FindMainWindow` now includes a precise process-ID-filtered Flutter top-level window search even when hidden, preventing unnecessary duplicate app launches on the next `show`. The right pane is unchanged. Browser-side errors are included in the flight recorder.
- Toggling Mangayomi's titlebar checkbox refreshed the native bar but never added the button. Root cause: `TryApplyProviderConfig()` rejected `mangayomi`, so the entire `provider-buttons` message was declined. The allowlist, built-in button icon declaration and titlebar icon installer have been updated; the background serializer already supported the ID.

## Update v0.21.5 → v0.21.6

Unpack PATCH over 0.21.5. Reinstall BOTH changed binaries:

```powershell
.\native\install-titlebar-helper.ps1
.\integrations\mangayomi\install-mangayomi-helper.ps1
```

Then reload Stream Shell in Opera GX. No Discord reinstall required. FULL is standalone. Personal backgrounds and custom artwork are omitted from releases.

## Acceptance

1. Launch Mangayomi on LEFT; keep Dashboard on RIGHT. Select YouTube/Netflix via the top Titlebar. The Mangayomi window must disappear completely; the selected browser provider must become visible. Switch back and confirm the same Mangayomi process/window is restored.
2. Pin/unpin Mangayomi under Settings → General → Providers → Native Titlebar. Its icon should be visible only when enabled and should switch to Mangayomi when clicked. Other buttons must remain.
3. Repeatedly click the right Dashboard after both transitions; Mangayomi must not reappear when deselected. Test Discord and Twitch right-hand surfaces for regressions.

The offline test suite validates JS/source/asset constraints, not actual Win32 behavior or C# compilation. The Windows installer/compile and interactive Opera GX test remain outstanding. GitHub has not been changed.
