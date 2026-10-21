# Stream Shell v0.20.31 — Twitch Lazy HUD Admission

Released: 2026-10-21

## v0.20.30 diagnostic checkpoint

The user confirmed another successful YouTube-first -> Twitch A-D cold start. The 0.20.30 Deep Log recorded a protected 5500ms provider-to-Twitch renderer lease (3904ms remaining), four confirmed Native Twitch claims and no pending Native claims or transition backlog. The three YouTube resource-governor workloads had zero failures. All four staged `automation.startup.phase` values were `active`, with actual activation after page startup at A 2561ms, B 2121ms, C 4696ms and D 5273ms. Marbles joins succeeded in B, C and D. Total Twitch resume duration was 12737ms, including the existing intentional cold-start protection.

## Changes

1. **Physical lazy load of the secondary HUD.** The large Twitch Workspace HUD script is removed from the automatic `document_idle` manifest registration. A tiny `providers/player/twitch-hud-loader.js` instead verifies the managed workspace role and slot before requesting the full script.
2. **Independent secondary load budget.** For covered A/B/C/D slots, the additional HUD admission delay is 750/1050/1350/1650ms after successful managed context discovery. Visible slots request immediate loading. Core Twitch playback guard, Native compositor wake, navigation, Marbles/claim/Drops automation and early diagnostics remain fully independent.
3. **Background-only injection.** `twitch-workspace-v2-load-hud` validates the sender's top-frame Twitch tab and managed V2 slot context before calling `chrome.scripting.executeScript` with the extension's local HUD file. When Chromium supplies `sender.documentId`, the load is pinned to that exact document to prevent stale cross-navigation injections. The HUD has a page-lifetime duplicate-execution guard.
4. **Bounded retries / pagehide ownership.** The loader retries transient context or injection failures, only within a bounded admission window. It cancels pending work on pagehide and never requests the HUD in unmanaged/legacy Twitch documents.
5. **Regression checks.** Add a required test for loader admission, all four delays, immediate visible slot handling, pagehide, retries, and background sender/injection contract. Update manifest and release documentation.

## Non-goals / verification

Existing 5.5s/3s cross-renderer handoff, 1250ms Twitch popup spacing, native HWND claims, Chrome/Opera window geometry, workspace playback intent, raid opt-out, Marbles triggers, native helper and existing provider content scripts are unchanged. No Native C# reinstall is necessary. A green offline test does not guarantee Opera GX runtime success; particularly verify that the Twitch HUD appears in every slot after admission. Personal wallpapers and custom artwork remain excluded from distribution.

Install PATCH over v0.20.30, or use FULL.
