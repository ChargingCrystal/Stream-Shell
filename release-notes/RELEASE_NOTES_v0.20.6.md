# Stream Shell v0.20.6 — Twitch Claim Recovery

The 0.20.5 diagnostics exposed a newly recreated Twitch D popup (`tab.status=loading`, 0 heartbeat ticks) whose `nativeClaim` was already `confirmed` after 3 tries. This can happen when an old HWND is still registered in the native helper: the helper's claim renewal only checks that the old mapped HWND is live, not that it matches the new browser popup. The replacement requires an actual pane/title match on a different HWND.

Additionally, the 0.20.5 unmanaged-focus fast path sent a *global* `claim-cancel` when focus moved to normal Opera or a game. That may cancel pending Twitch claims. This is now local-only cancellation, without removing the fast path's performance benefits.

Changes:
- A newly created Twitch slot flags a forced native rebind, which excludes the stale HWND from candidate selection until a real new matching window is available.
- Native acknowledgement of a forced rebind must explicitly report `rebound:true` and echo the new `browserWindowId`; otherwise it is not marked confirmed in diagnostics.
- Retain normal fast renewals for all existing stable windows and non-Twitch surfaces.
- No change to the native protocol version (v9), but **the native helper must be reinstalled** after updating because its C# source changes.

Install PATCH over 0.20.5, reload in opera://extensions, and run `native/install-titlebar-helper.cmd` from the updated Stream Shell folder. The installer compiles the new native host. Local backgrounds/custom artwork are intentionally not included and must be preserved.

This is a targeted regression fix, not confirmation that intermittent Opera UI freezes have been eliminated. Test Twitch A-D claims after both a normal fresh launch and replacement of a closed Twitch pane, including returning from other Opera windows and WuWa.
