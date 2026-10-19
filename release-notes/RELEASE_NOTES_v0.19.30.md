# Stream Shell v0.19.30 — Provider Registry Phase 3: Dynamic Native Titlebar

The native toolbar on the left/Compact surface is now driven by the same persisted provider list as General Settings. Titlebar visibility and ordering are independent from the Dashboard, which still pins 1–7 entries with the preapproved row patterns. Built-in icons are retained. Custom entries use text initials.

A v7 native-messaging update transmits validated provider IDs, short initials and menu names as an encoded UTF-8 list with generation/ack/retry and reconnect replay. Native toolbar width and dividers adapt to the actual provider count. Extra providers move to a `...` overflow popup without changing the right Wide controls.

Install: patch over v0.19.29 (or Full ZIP), reinstall `native\install-titlebar-helper.cmd` and reload the extension. **Required:** native helper and extension must both run protocol v7. No background PNGs are distributed.

Verification: Node mock tests for registry/defaults/window-management/dynamic native protocol passed; syntax and source-bundle parity passed. Windows C# compilation, native popup behavior, DPI overflow and Opera GX/window-focus integration remain unverified until live testing. Do not label those cases as confirmed.

Suggested Windows tests: (1) five defaults in Wide, (2) add titlebar-only Custom, (3) reorder and hide without restarting, (4) change buttons while YouTube is playing, (5) many added providers trigger `...`, (6) Compact mode, (7) right Twitch A–D and Dashboard remain independent after left navigation, (8) native helper restart rehydrates button list.
