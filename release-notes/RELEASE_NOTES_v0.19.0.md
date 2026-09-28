# Stream Shell 0.19.0 — Twitch Workspace V2 Foundation

0.19.0 stops extending the temporary 0.18.34–0.18.37 two-window lab and turns its proven direct-final-geometry lifecycle into the new Twitch architecture.

## Workspace model

- Wide Twitch now owns four fixed content slots, **A–D**, arranged as a deterministic 2×2 grid inside the 1920×1080 RIGHT pane. Each slot is 960×540 on the reference 3840×1080 display.
- A slot is either empty or backed by exactly one real top-level Opera/Twitch popup. Empty slots create no browser window.
- Slot windows are born directly at final geometry. Normal workspace activation never tiles, parks, resizes or rebuilds them.
- Dashboard and Discord cover the workspace. Returning to Twitch raises the existing slot windows; the Twitch button is no longer a content lifecycle switch.
- The initial workspace keeps A useful immediately with the remembered Twitch URL/Home and B with Drops Inventory, while C/D start empty.

## Streams and arbitrary Twitch pages

- A slot accepts either a channel name or an arbitrary `twitch.tv` URL.
- A bare channel root is automatically treated as a Stream surface. Deeper routes such as channel subpages, Drops, directories and settings remain ordinary Page surfaces unless the user explicitly chooses Stream.
- Ordinary pages stay real top-level Twitch documents. Stream Shell does not attempt to frame pages Twitch does not expose as embeds.
- Stream surfaces get a conservative content-side cleanup pass: Twitch top/side navigation, built-in right chat and below-player furniture are hidden and the real player is expanded to the slot viewport.

## Shared chat

- Added one optional persistent Twitch popout-chat drawer rather than one embedded chat per stream.
- The drawer can switch between channel-bearing slots by navigating the same chat popup.
- Hiding chat only places the existing document behind the content grid so its runtime state can stay alive.

## Workspace controls

- Empty/recovery slots are rendered by the existing Dashboard window underneath the real Twitch popups, allowing a new stream or Twitch page to be assigned without creating another extension host window.
- Every live slot gets a small low-opacity Stream Shell HUD for editing the slot, opening its chat, raising the full workspace or removing the slot.
- The Landing grid button now opens the real Workspace; Shift/reference-mode behavior from the temporary lab is retired.

## Native/runtime integration

- Existing titlebar protocol v5 is reused. A-D and the optional chat drawer are claimed as stable Twitch cluster members with their exact final rectangles.
- Twitch points/Drops/raid automation trusts content slots but intentionally excludes the separate chat window.
- Twitch tabs are marked non-auto-discardable while managed.
- Diagnostics schema v12 adds `twitchWorkspaceV2`, including each slot's configured/live geometry, URL, tab state, `performance.timeOrigin`, workspace content marker, chat state and native cluster membership.

### Current foundation limitation

The v5 native helper can register all A-D/chat HWNDs, but its custom right-side chrome renderer still has dedicated overlay pairs only for the first two ordered Twitch cluster members. C/D remain managed/claimed, but extending the custom caption overlay itself is a separate follow-up rather than changing the working popup lifecycle in the same build.

## Update

Extension reload only when upgrading from 0.18.37. The native helper protocol is still v5; do **not** reinstall it for this build.
