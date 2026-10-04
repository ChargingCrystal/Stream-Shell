## 0.19.21 — Twitch Per-Window Anti-Raid Controls

- Repurposes the Twitch Settings anti-raid switch into a master **HUD visibility** switch; hiding the control no longer changes raid behavior by itself.
- Adds an independent anti-raid shield toggle to every Twitch Workspace window. Each slot keeps its own state, so one MoS window can follow raids while another blocks them.
- Per-window anti-raid starts disabled on existing/new slots to preserve the post-0.19.18 behavior until explicitly enabled.
- Restores raid detection for enabled slots by requiring a currently visible raid surface rather than a stale raid-labelled DOM node.
- Stores short-lived redirect guards per Twitch tab instead of globally, so simultaneous slots cannot overwrite each other's raid guard.
- Explicit Twitch channel-link navigation and Stream Shell slot edits still disarm the affected tab's guard; ordinary clicks no longer accidentally disable anti-raid.
- No YouTube / YouTube Music behavior changed in this release.

## 0.19.20 — Twitch Auto-Mode Scope Correction

- Corrects the 0.19.19 interpretation of Stream availability: only **Auto** is constrained by the detected Twitch surface.
- Auto resolves a bare streamer profile/offline channel to `Page`, and switches to `Stream` only when the current document is actually a live watch surface.
- Manual `Stream` remains an explicit override and is selectable on any managed Twitch page, as it was before 0.19.19.
- The HUD still highlights the effective visible mode (`Stream` or `Page`) instead of painting `Auto` as the active mode.
- No Marbles, navigation, maintenance reload, pane-fullscreen, workspace geometry or native-helper behavior changed.

## 0.19.19 — Twitch HUD Mode-State Fix

- The Twitch slot editor no longer paints `Auto` purple unconditionally. The purple state now follows the actually visible mode: `Stream` on a confirmed live watch surface, otherwise `Page`.
- `Stream` can only be selected while the slot is currently on a live Twitch channel watch surface. Channel profile/sub-pages, Drops, directories and offline channel roots keep Stream disabled.
- Stream cleanup is now gated by the live-surface check too, so a persisted/auto `stream` kind cannot hide Twitch chrome on a streamer profile.
- Live-state rechecks are finite and event-driven (load/navigation/player events); no new permanent polling loop was added.
- Workspace persistence, Marbles automation, hourly maintenance reloads, pane-fullscreen geometry and native-helper behavior are unchanged.

## 0.19.17 — Twitch Long-Session Maintenance

- Restores a 5-second Marbles chat hydration grace period after every Twitch channel transition, so old `!play` backlog cannot trigger a mid-round join.
- Cuts Twitch automation fallback DOM scans from every 5 seconds to every 30 seconds; mutation-driven claims remain immediate.
- Reduces covered-stream playback polling from 1.25 seconds to a 15-second safety audit while preserving event-driven resume on pause.
- Removes the 500 ms Twitch workspace URL poll and uses browser navigation/storage events instead.
- Ignores irrelevant `chrome.storage` changes in Twitch automation instead of rebuilding observers and rescanning the DOM.
- Makes titlebar/native reconciliation less aggressive while retaining event-driven updates and heartbeat safety.
- Stream-mode Twitch slots receive a staggered maintenance reload roughly once per hour; a focused or pane-fullscreen slot is deferred for 10 minutes instead of being interrupted.

## 0.19.15 — Twitch Marbles Submission Transaction Hotfix

- Fixed overlapping Marbles send attempts: a slot now has an explicit in-flight guard, so a continuing `!play` burst cannot schedule a second auto-join while the first Twitch chat submission is still settling.
- Removed the paste-then-`insertText` race that could asynchronously produce `!play!play`. The real Twitch editor now uses one Chromium editing path and waits for Twitch/Slate state to settle before any recovery action.
- Existing `!play` residue is treated as the same pending auto-command instead of appending another copy; failed auto-drafts are cleaned up so they cannot leak into the next round.
- A send counts as successful only after Twitch actually clears the chat editor. Merely placing `!play` in the box no longer starts the 120-second cooldown.
- Re-resolves the live Send button around React renders, retries submission without reinserting text, and avoids overwriting unrelated user-written chat drafts.
- Preserves a newer user click/focus if one happens during the tiny send transaction. The initial 5-second chat hydration buffer and all per-slot trigger/cooldown behavior remain unchanged.
- No native-helper or Unified Remote reinstall is required.

## 0.19.14 — Twitch Chat Editor Input Repair

- Fixed Marbles auto-join writing `!play` into Twitch's outer chat-input shell instead of the real nested editor, which could visually overlap the `Send a message` placeholder without becoming valid chat input.
- Twitch chat submission now resolves the actual nested contenteditable/textarea first and never falls back to direct `textContent` mutation.
- Added Slate-friendly paste insertion with Chromium `insertText` fallback, followed by a short wait for Twitch to enable its native Send button.
- Added an Enter-submit fallback for Twitch layouts that do not render a send button after valid editor input.
- Marbles detection, randomized 5-10-user trigger, 1-4 second delay and per-slot 120-second cooldown are unchanged.
- No native-helper or Unified Remote reinstall is required.

## 0.19.13 — Twitch Marbles Chat Auto-Join

- Added optional Marbles on Stream auto-join to managed Twitch Workspace windows. Each Twitch document observes only its own chat and detects fresh `!play` bursts locally.
- A round trigger is randomized between 5 and 10 unique chat users within a rolling 30-second window; after detection Stream Shell waits a 1-4 second jitter before submitting one `!play` through Twitch's native chat UI.
- Added a 120-second cooldown per Workspace slot (A-D), persisted in extension storage so parallel Marbles channels remain independent and a reload cannot immediately re-trigger the same slot.
- Added a 5-second initial chat-hydration guard so re-rendered history after navigation/reload does not immediately look like a new round.
- Added a Twitch Settings toggle for Marbles auto-join. The feature remains local DOM automation and does not use Twitch OAuth or chat APIs.
- Twitch Workspace geometry, pane fullscreen, draggable HUD, persistent playback and native-helper protocol are unchanged.

## 0.19.12 — Twitch Pane Fullscreen Browser-Geometry Repair

- Moved pane-fullscreen overscan and grid restore geometry entirely back to Chromium (`chrome.windows.update`). The native helper no longer moves the Opera HWND with `SetWindowPos` during fullscreen transitions.
- Fixed the fullscreen page being painted roughly one Opera-caption height away from its actual hit targets after native/browser geometry diverged.
- Fixed Page-mode Twitch slots that could return from pane fullscreen as a permanently black compositor surface even though playback/UI continued underneath and reload did not recover the pixels.
- Native Twitch claims now report the measured Opera titlebar height; Stream Shell uses that value for browser-owned top overscan, with a bounded fallback when no measurement is available yet.
- Pane-fullscreen exit now restores the browser grid rectangle first, then drops native fullscreen ownership and reclaims cluster chrome. This prevents the stock Opera titlebar from appearing underneath the Stream Shell chrome after restore.
- Kept per-layout draggable HUD positions and extended the post-transition viewport settle window slightly; no Twitch URL, mode, mute or playback state is recreated.
- Titlebar native protocol bumped to v6 so an older helper cannot reintroduce the deprecated native HWND-resize path.

**Native helper:** Re-run `native\install-titlebar-helper.cmd` after updating.

## 0.19.11 — Twitch Pane Fullscreen Restore & HUD Position Repair

- Made pane-fullscreen exit deterministic: restore the existing slot HWND to its calibrated grid rectangle, verify the resulting Opera outer bounds once, and issue at most one repair resize when the first transition was not accepted exactly.
- Re-announced the restored Twitch cluster member and repaired cluster z-order without recreating or navigating the Twitch tab.
- Native helper now rebuilds the right-side Twitch chrome ownership after pane fullscreen so the restored A/B window does not keep an exposed stock Opera titlebar.
- Stored draggable Twitch HUD positions separately for Grid and Pane Fullscreen. A HUD dragged beyond the normal 960px slot area while fullscreen therefore returns to its previous reachable Grid position when the slot shrinks.
- Added post-resize HUD settle/clamp passes and stale-drag cleanup to prevent off-screen or intermittently unresponsive HUDs after fullscreen transitions.

**Native helper:** Re-run `native\install-titlebar-helper.cmd` after updating.

## 0.19.10 — Twitch Workspace HUD & Pane Fullscreen

- Replaced the single selected-slot Twitch control bar with one compact draggable HUD in every populated Twitch slot. The collapsed launcher is a four-dot circle; click expands/collapses it and dragging the launcher moves it within that window. Positions persist per slot.
- Simplified the expanded HUD to the local slot only: mode status, mute/unmute, reload, right-pane fullscreen, Edit and clear. A/B/C/D cross-slot selectors are no longer needed because every Twitch window owns its own controls.
- Added per-slot reload without workspace-wide navigation, focus cycling or provider reconciliation.
- Added explicit right-pane fullscreen for a Twitch slot. The selected popup expands over the full 1920x1080 right pane while the other three windows stay alive underneath, then returns to its calibrated 2x2 bounds without reloading.
- Pane fullscreen temporarily exposes the normal Twitch Page interface for Stream slots; leaving fullscreen automatically restores the prior Stream cleanup because the persisted slot mode itself is never changed. Page slots remain Page throughout.
- Extended the native titlebar helper with one-shot Twitch pane fullscreen geometry. It overscans the Opera caption above the pane so the expanded Twitch surface is visually borderless without browser F11, and existing cluster raises keep only the expanded member on top while active.
- Workspace schema v7 migrates v6 in place without recreating A-D. Shutdown clears only transient pane-fullscreen state; URLs, modes and per-slot mute settings remain persistent.

**Native helper:** Re-run `native\install-titlebar-helper.cmd` after updating.

## 0.19.9 — Twitch Stream Chrome Cleanup

- Relaxed Twitch Workspace Stream mode so it now removes only Twitch's global top navigation/header and left navigation sidebar.
- Kept the native Twitch player layout, chat, channel information, action row and lower channel content intact instead of forcing a full-window player.
- Removed the automatic theatre-mode click from Stream mode; switching a slot between Page and Stream no longer changes Twitch's own theatre state.
- Page mode remains completely untouched and continues to expose the normal Twitch UI for Drops, Browse, Inventory and arbitrary Twitch routes.
- Added a minimal app-shell offset correction so the channel page can reclaim the vertical strip previously occupied by Twitch's hidden top navigation without resizing or recreating the Opera window.
- Workspace geometry, persistent playback, per-slot mute state, compositor wake behavior and native helper protocol are unchanged.

## 0.19.8 — Twitch Workspace Lifecycle & Compositor Wake Pass

- Added event-driven A-D native claiming: a workspace slot is claimed as soon as its first real Twitch title/status arrives, eliminating the fixed 700 ms startup race that could leave B-D behind Dashboard after a cold launch. Claims are cached per live window and re-announced once after a native-helper reconnect.
- Added a lightweight compositor wake pulse for existing Twitch tabs when the Workspace returns from Dashboard/Discord. It requests fresh Chromium frames without reload, resize, navigation or focus-cycling, targeting intermittent black surfaces that previously repainted only after tabbing into them.
- Added one cold-start settle raise after native member onboarding. It is no-activate and runs only for a newly-created Workspace, so B-D are restored above Dashboard without reintroducing the old A→B→C→D focus carousel.
- Removed redundant cluster raises after every scheduled claim wave; accepted native claims already repair cluster order themselves.
- Parallelized A-D shutdown and the remaining independent Stream Shell browser-window closes. Runtime ids are detached before teardown, so closing Stream Shell no longer waits for each Twitch/provider window sequentially.
- Workspace geometry, per-slot mute state, covered-playback behavior, Landing/Unified Remote controls and native protocol remain unchanged.

## 0.19.7 — Twitch Persistent Playback & Control Consolidation

- Added a Workspace-only covered-playback guard: if the primary Twitch video was playing while visible, Stream Shell keeps it playing when Dashboard/Discord or another desktop surface covers the Workspace. A user-paused stream remains paused.
- The guard is scoped to Workspace V2 Twitch windows and does not change the existing pause-on-switch behavior for Netflix, Prime Video, Disney+, Crunchyroll or YouTube.
- Collapsed the Landing Twitch utility to one 225 px button, matching Discord width. Drops and the old separate Workspace affordance are no longer exposed because both are now internal Workspace concerns.
- Unified Remote v0.9.0 now uses a 50/50 Discord + Twitch Auxiliary row. The dedicated 15% Drops button and drops-specific active tint were removed.
- Kept the legacy native `twitch-drops` bridge action for backward compatibility, but the shipped Landing and Unified Remote UIs no longer call it.
- Native helper protocol and Twitch Workspace geometry are unchanged; no helper reinstall or slot recreation is required.

## 0.19.6 — Twitch Workspace Chatless Audio & Seam Pass

- Calibrated the four-slot Wide grid to a 20 px per-row overlap: on the 3840×1080 reference each slot is now 960×560, with C/D starting at y=520. The resulting 40 px shared seam keeps stock Opera chrome covered while reducing Twitch-content occlusion.
- Removed the standalone Twitch popout-chat drawer from Workspace V2. It competed with B/D for native z-order and duplicated chat already available inside normal Twitch pages; the shared floating bar no longer exposes Chat.
- Added a per-slot browser-level mute/unmute control to the shared floating bar. The selected slot shows 🔇/🔊 and the choice persists in Workspace state across Twitch SPA navigation and slot reuse.
- Workspace slots now override the legacy global Twitch Auto Mute policy after an explicit slot choice, so manually unmuting a slot is not immediately undone by later Twitch tab updates.
- The v5 → v6 migration preserves the observed mute state where possible, closes any legacy chat drawer, and recreates A–D once at the calibrated direct-final geometry rather than resizing live Twitch surfaces.
- Browser/site zoom remains browser-owned; Stream Shell still does not force a Twitch zoom level.

## 0.19.5 — Twitch Workspace Seam Calibration

- Calibrated the symmetric A/B ↔ C/D overlap from 32 px to 25 px per row. On the 3840×1080 Wide target each Twitch cell is now 960×565, with the lower row starting at y=515.
- Reduced middle-seam occlusion so A/B still cover the lower Opera caption while no longer eating as far into C/D Twitch content or the shared control bar.
- Removed the redundant `All` HUD action. Its only job was to re-raise the already-visible four-member native cluster, so in a healthy workspace it intentionally had no visible effect; the Landing Twitch action remains the workspace-level bring-to-front control.
- Kept browser zoom unmanaged by Stream Shell; Opera/Chromium remains responsible for persisting the user's Twitch zoom level.
- The v4 → v5 workspace migration recreates A–D once at the calibrated direct-final geometry rather than resizing live Twitch surfaces.

## 0.19.4 — Twitch Workspace Shared Control Bar & Seam Repair

- Made the 32 px middle-row caption overlap symmetric: A/B now extend downward while C/D keep their upward overlap, fully covering the remaining stock Opera caption strip at the 2×2 seam.
- Added a one-time workspace schema v4 migration that preserves C/D and recreates only A/B at their new direct-final geometry; normal workspace switching still never resizes healthy Twitch windows.
- Replaced four per-window Twitch HUDs with one shared floating workspace bar. Only the currently focused/selected slot renders it; lightweight A/B/C/D selectors move focus without rerunning the full workspace show pipeline.
- Workspace slot focus now updates `selectedSlot` through one storage-only fast path, keeping the shared bar in sync without provider reconciliation or global shell broadcasts.
- Left Twitch zoom untouched. Browser/site zoom remains browser-owned rather than being forced by Stream Shell, so a user-set 80% can persist normally if Opera retains it.

## 0.19.3 — Twitch Workspace Interaction & Focus Pass

- Fixed the in-page Twitch workspace HUD: its buttons now use real Shadow DOM event listeners instead of an inert `ShadowRoot.onclick` expando.
- Added Enter/Escape handling to the slot editor and made **All** a lightweight z-order operation rather than a full workspace re-show.
- Lower-row slots C/D now start with a 32 px caption overlap so their stock Opera titlebars can sit behind A/B while their client content still begins at the 50/50 row boundary.
- Added a one-time schema v3 migration that preserves A/B (including Drops) and recreates only C/D at the new direct-final geometry.
- Workspace focus and bounds events now bypass generic provider reconciliation, global state broadcasts, and duplicate focused-titlebar claims.
- Native cluster raises now restore C/D first and A/B second, preserving the caption overlap without stealing focus from the lower row.

## 0.19.2 - Twitch Workspace stability pass

- Removed repeated delayed focus/claim cascades from Workspace V2.
- Removed Dashboard raise from Twitch workspace activation.
- Restored the proven native titlebar renderer and kept only a one-shot native cluster raise.
- Removed the duplicate full-show cycle after slot assignment.
- Deduplicated Twitch workspace HUD refreshes and reduced SPA state churn.

## 0.19.1 — Twitch Workspace V2 Surface Repair

- Replaced the Dashboard-backed empty-cell layer with four persistent top-level compositor cells. Empty A-D cells now use an extension-owned slot controller window at the same final 960×540 geometry; assigning a stream/page navigates that exact cell into Twitch instead of creating a separate late popup.
- Added bounded post-create z-order retries without resize/navigation/recreation to cover Chromium/Win32 startup ordering races.
- Disabled the old Dashboard Twitch backdrop UI so it can no longer cover live Twitch cells or present stale `Window is starting…` cards.
- Added native no-activate Twitch-cluster z-order repair while Stream Shell itself owns foreground activation. Returning through Alt+Tab can therefore restore the four-cell compositor above Dashboard without surfacing it over unrelated applications.
- Extended native right-side chrome from the legacy A/B pair to dedicated A/B/C/D plus chat overlay ownership. Empty controller cells are claimed like Twitch cells and receive the same Stream Shell chrome/taskbar identity.
- Added strict slot-controller sender validation for A-D assignment messages.
- Workspace state schema is now v2 and migrates 0.19.0 state in place so existing A/B windows are not orphaned during extension reload.

**Update:** reload the extension and re-run `native\\install-titlebar-helper.cmd` because the native host changed. Protocol remains v5.

## 0.19.0 — Twitch Workspace V2 Foundation

- Replaced the active two-member Twitch Split Lab path with a persistent Wide four-slot compositor. Slots A-D are fixed 2×2 real Opera/Twitch popups created directly at their final 960×540 geometry; empty slots own no browser window.
- The Landing Twitch action now initializes the workspace once and later activations are z-order/focus only. Dashboard and Discord cover live slot windows without resize, off-screen parking or teardown.
- Added explicit per-slot assignment for either a stream channel or an arbitrary `twitch.tv` page. Bare channel roots auto-select Stream mode; deeper Twitch routes stay ordinary pages unless explicitly marked Stream.
- Added a conservative stream-only cleanup layer that hides Twitch navigation/chat/below-player furniture and expands the real top-level channel player instead of attempting to iframe arbitrary Twitch pages.
- Added one persistent top-level Twitch popout-chat drawer shared by the workspace. Chat can switch between channel-bearing slots while reusing the same chat window; hiding it covers the live document instead of destroying it.
- Added Dashboard-backed empty-slot/recovery cells for C/D and any missing slot, plus lightweight in-page slot controls for edit/chat/show-all/remove.
- Extended native v5 Twitch member claiming to A-D/chat without changing the helper protocol. The existing helper remains compatible; the current native custom right-chrome renderer still has dedicated overlay pairs for the first two cluster members only.
- Added `twitchWorkspaceV2` state/diagnostics with fixed geometry, slot URLs, document identity, discard state, chat state and native cluster membership.

**Update:** extension reload only from 0.18.37. The native helper protocol remains v5, so no reinstall is required for this foundation build.

## 0.18.37 — Twitch Persistent Split Workspace

- Sticky 50/50 Twitch workspace after first Split View activation.
- Landing Twitch/Drops actions reuse member A/B instead of closing and recreating the split pair.
- Added document identity/reuse diagnostics for reload verification.
- Native helper protocol remains v5; reinstall is not required when upgrading from 0.18.36.

# Changelog

## 0.18.36 — Twitch Persistent Split + Native Cluster Claim

- Kept the proven direct-final-geometry 50/50 Twitch windows alive when switching to Dashboard or Discord. Wide `Keep Twitch active while covered` now covers the existing pair instead of destroying it, so Drops/stream documents retain their runtime state and window IDs.
- Re-entering the same split mode raises the existing A/B windows in place without URL navigation, resize, parking or recreation. A deliberate normal/Shift split-mode change may still rebuild the pair.
- Restored a narrowly scoped native protocol v5 for the new architecture: split members are claimed independently with exact half-pane bounds and a stable `a`/`b` member identity instead of reviving the old workspace/tiler stack.
- Native taskbar/Alt+Tab identity now preserves both claimed Twitch members as one Stream Shell cluster, and a second right-side chrome pair covers Opera's stock caption on the second half-window.
- The black-surface-sensitive lifecycle remains unchanged: both Twitch windows are still born once at their final 960×1080 coordinates and are not resized during normal surface switching.

**Update:** re-run `native\install-titlebar-helper.cmd` once because the titlebar protocol/helper changed from v4 to v5, then reload the extension. Unified Remote and COBOL finance do not need reinstalling.

## 0.18.35 — Twitch Split Managed-Automation Probe

- Promoted both direct-final-geometry split-lab popups into Stream Shell's Twitch automation trust set without changing their proven window lifecycle or coordinates.
- Twitch channel-points/Drops automation and raid-guard eligibility can now initialize independently in both split windows; the legacy single `twitchWindowId` remains unused for the lab.
- Kept native titlebar claiming, native window-cluster identity, post-creation resize/restore and off-screen parking disabled so this release isolates content/runtime ownership from compositor geometry.
- Extended split diagnostics with per-window `automationManaged` plus the live `data-stream-shell-twitch` root marker so an export can prove whether each Twitch content script actually entered managed mode.
- Preserved normal click as Resume/Home + Drops and Shift-click as the `gronkhtv` + `rainbow6` reference pair.

**Update:** extension reload only. No native-helper, Unified Remote or COBOL-finance reinstall is required.

## 0.18.34 — Twitch Direct Split Lab

- Added a Wide-only `▦` Twitch split-lab action on Landing that transplants the known-good standalone PoC lifecycle into Stream Shell.
- Normal click opens Resume/Home + Drops; Shift-click opens the exact known-good PoC pair (`gronkhtv` + `rainbow6`). Both are created directly at final 50/50 `RIGHT`-pane coordinates with no bootstrap resize, restore pass or off-screen parking.
- Existing single-window Twitch state is retired cleanly before the lab starts and its current non-Drops URL is preserved as the left split target.
- Kept the lab windows outside normal `twitchWindowId` ownership and native titlebar claiming so this build tests Stream Shell background/content integration without reintroducing the failed 0.18.22–0.18.31 cluster stack.
- Added split-lab lifecycle cleanup, Flight Recorder events and diagnostics schema v10 with live window/tab snapshots.

**Update:** extension reload only. No native-helper, Unified Remote or COBOL-finance reinstall is required.

## 0.18.33 — Warm Provider Geometry Repair

- Fixed the remembered warm provider being the only provider capable of restoring across the full 32:9 display instead of the Wide LEFT pane. Warm providers are now created once at the same real LEFT geometry as ordinary providers and then minimized, so Opera keeps the correct restore rectangle.
- Removed off-screen parking from the remembered provider warm-start path. A minimized provider is already hidden; moving it below the virtual desktop could overwrite/lose the restore geometry that the later provider activation depends on.
- Added verified geometry restoration with short bounded retries. Stream Shell now waits until the requested pane bounds are actually observed before focusing and native-titlebar claiming a restored window. This also prevents a transient stale full-display rectangle from failing the helper's Wide pane geometry proof.
- Existing malformed/off-screen warm-provider windows are normalized in place before remaining minimized, preserving the already-loaded provider tab/session while repairing its native restore rectangle.

**Update:** extension reload only. No native-helper, Unified Remote or COBOL-finance reinstall is required.

## 0.18.32 — Twitch Multi-View Hard Reset

- Removed the experimental Twitch multi-window / workspace implementation introduced across 0.18.22–0.18.31 from the active code path.
- Restored the complete Twitch runtime, content automation, titlebar integration and audio behavior to the known-good 0.18.21 implementation.
- Restored the titlebar native helper/client protocol to the 0.18.21 v4 baseline.
- Removed the workspace content script from the shipped package; Twitch returns to the single managed Wide utility window with the established Twitch/Drops navigation behavior.
- Kept the historical 0.18.22–0.18.31 release notes intact so the failed experiment remains documented rather than rewritten.

**Update:** replace the current package with 0.18.32 and re-run `native\install-titlebar-helper.cmd` once to restore the matching v4 native helper. Unified Remote and COBOL finance do not need reinstalling.

## 0.18.31 — Twitch Physical Window Ownership Repair

- Fixed the native Twitch tiler showing fewer physical windows than the floating bar claimed. The runtime now enforces a strict one-logical-instance-per-Opera-window ownership invariant instead of allowing multiple Twitch instances to point at the same popup.
- Added conflict-aware instance registration: assigning a tab/window to one Twitch instance automatically releases stale mappings from every other logical instance. Reconciliation uses the same ownership rule, so duplicate mappings cannot silently reappear later.
- Native Tile now verifies physical window uniqueness before applying slot geometry. If two selected instances still resolve to the same window, the later instance is rebuilt into a fresh popup before layout is applied.
- If a selected tile cannot obtain a unique physical window, it is removed from the active tile set instead of leaving the UI on `4` while only two real windows exist. Diagnostics now expose physical-window count and duplicate ownership mappings.
- Bumped the Twitch workspace/runtime schema to v7. On the first reload from 0.18.30, disposable v6 Twitch runtime windows are closed once and rebuilt from the persistent logical instance list, clearing the corrupt aliasing state that produced the two-window/four-slot screenshot.
- Preserved the 0.18.30 fixed 1/2/3/4 slot geometry, browser-level per-instance mute and the existing v5 native titlebar helper. Custom Twitch titlebar work remains intentionally out of scope.

**Update:** extension reload only. Existing managed Twitch popups will close once during the v6 -> v7 runtime reset and are recreated on demand. No native-helper, COBOL-finance or Unified Remote reinstall is required.

## 0.18.30 — Twitch Native Tile Layout

- Replaced the simulated Twitch Multi layout semantics with a deterministic native-window tiler. Each visible Twitch Page/Embed instance keeps its own real Opera popup and Multi only assigns those windows to fixed slots inside the Wide `RIGHT` pane.
- Added a stable `tileOrder` (maximum four members) separate from chip/order state. Selecting a visible member focuses that exact window without reinterpreting the layout; selecting an untiled member swaps it into the currently selected slot when all four slots are occupied.
- Layout now depends only on visible tile count: 1 = full right pane, 2 = 50/50 columns, 3 = two upper halves plus one centered lower half, 4 = deterministic 2×2. The old Single/Split/Grid/Focus geometry modes no longer drive Twitch window placement.
- Replaced the floating-bar layout controls with explicit `1 2 3 4` visible-tile controls. Multi is now a real toggle: entering Native Tile preserves the selected membership; leaving it returns the selected instance to a single full-right window.
- Adding a Page or Stream while Native Tile is active appends it to the next free slot (up to four) and reflows exactly once. Hidden keep-active contexts are left untouched instead of being resized/parked during every cluster action.
- Chip selection inside Native Tile is now focus-only when membership does not change, avoiding the repeated full-cluster geometry pass that caused needless GPU/compositor churn.
- Added a small vertical overlap between upper and lower native-window rows so the upper windows can cover the lower Opera chrome strip when z-order permits. Custom Stream Shell titlebar repair is intentionally still a separate follow-up.
- Preserved browser-level per-instance mute; Twitch's own player mute state is not used.
- Bumped the Twitch workspace/runtime schema to v6. Existing instances and previous tiled membership migrate into `tileOrder`, while an active 0.18.29 Multi session starts once in Single mode to avoid carrying broken geometry forward.

**Update:** extension reload only. The native v5 titlebar helper from 0.18.27 remains compatible; no native-helper, COBOL-finance or Unified Remote reinstall is required.

## 0.18.29 — Twitch Workspace Interaction Mapping

- Reworked Twitch workspace interaction semantics into an explicit Single/Multi state machine. Selecting a Twitch/Page chip while Multi View is active now selects/focuses that cluster member instead of silently collapsing Multi View into a full-size single window.
- Adding a stream or normal Twitch page now preserves the current mode: additions made from Single open as a single surface, while additions made inside Multi remain inside the active cluster.
- Stabilized Multi membership/main selection. Entering Multi repairs stale main/selected IDs against the actual tiled set, selecting a previously untiled chip promotes it into the cluster, and removing the final tiled member exits Multi deterministically.
- Kept Grid ordering stable when selection changes. Main-member ordering is now only applied to layouts that actually need a primary tile (`Single`, `Split`, `Focus`).
- Fixed stale Split/Grid geometry leaking into later actions. Twitch windows that are no longer visible members are normalized back to full `RIGHT` bounds underneath the active surface when keep-active is enabled, instead of remaining as ghost half/quarter windows.
- Single-surface switching performs the same one-time geometry normalization, so a previous Multi layout cannot randomly reappear after a focus/z-order change.
- Bumped the Twitch workspace/runtime schema to v5. Existing instances, tile membership and layout preferences are preserved, while an active pre-0.18.29 Multi session starts cleanly in Single mode after reload.
- The native v5 titlebar helper from 0.18.27 is unchanged; custom-titlebar work for the Twitch cluster remains intentionally out of scope for this release.

**Update:** extension reload only. No native-helper, COBOL-finance or Unified Remote reinstall is required.

## 0.18.28 — Twitch Workspace Stabilization

- Removed the off-screen parking churn from normal Twitch instance switching when `Keep Twitch active while covered` is enabled. Managed Twitch windows now stay warm on their real right-pane coordinates and switching primarily changes focus/z-order instead of moving every GPU-backed Twitch surface out of and back into the desktop.
- New Twitch Page/Embed popups are no longer created and immediately parked while they are still loading, avoiding an Opera GX compositor path that could leave restored Twitch pages on an indefinite black surface.
- Made Twitch active-window persistence idempotent so repeated focus events no longer rewrite session/local runtime state when the active HWND did not actually change.
- Replaced the floating-bar state refresh path with a lightweight snapshot. Normal UI refreshes no longer reconcile every Twitch window and query every mapped tab; full live reconciliation is reserved for diagnostics.
- Floating bars now use local browser focus as their visibility authority and hide immediately on blur, eliminating transient double bars while active-window storage catches up.
- Stopped every Twitch content script from reacting to session-runtime identity writes. Workspace redraws now follow logical workspace changes plus explicit focus catch-up only.
- Multi View geometry is diff-applied: unchanged Twitch windows are no longer restored/resized on every workspace action, and native cluster claims are scheduled once per discovered window instead of repeatedly for every layout pass.
- Browser-level per-instance mute and the native v5 Twitch window-cluster identity from 0.18.27 remain unchanged.

**Update:** extension reload only. The 0.18.27 native titlebar helper remains current; no native-helper, COBOL-finance or Unified Remote reinstall is required.

## 0.18.27 — Twitch Multi-View Window Cluster

- Replaced the dedicated Multi View popup with a real Twitch window-cluster layout. Every Twitch Page or Embed instance owns one managed popup, and Multi View now tiles the selected instances directly inside the existing Wide `RIGHT` pane.
- Added per-instance Multi inclusion (`▦`) so normal Twitch pages such as Home, Drops, Campaigns, Following/Directory and arbitrary `twitch.tv` URLs can be arranged beside stream embeds instead of only replacing the full Twitch pane.
- Added Single, Split, Grid and Focus geometry for mixed Page/Embed window clusters; the selected/main instance remains the focus authority while non-visible contexts stay warm off-screen.
- Reworked stream audio control to Chromium tab-level mute. Stream Shell no longer has to toggle Twitch's own player mute state: the embed is logically unmuted while the containing managed tab is muted/unmuted externally.
- Upgraded the native titlebar protocol to v5 and added member-aware Twitch surface claims so multiple simultaneous Twitch HWNDs can remain registered as one logical `right|twitch` Stream Shell cluster.
- Native taskbar/Alt+Tab reconciliation now preserves every registered Twitch cluster member instead of minimizing all but one persistent Twitch HWND.
- Diagnostics schema v11 exposes Multi View layout/tiled-instance state, while native status reports the Twitch cluster member count/map.

**Update:** reinstall the native titlebar helper with `native\install-titlebar-helper.cmd`, then reload the extension. No COBOL-finance or Unified Remote reinstall is required.

## 0.18.26 — Twitch Popup Bootstrap Geometry + Diagnostics

- Fixed the remaining inert Twitch actions in Opera GX by restoring popup creation to the valid visible `RIGHT` pane geometry before moving inactive Twitch contexts to the off-screen parking area.
- The 0.18.24/0.18.25 popup model had started new Twitch popups directly at parking coordinates below the virtual desktop; on the tested Opera GX setup this could fail before any managed Twitch window existed, so both Landing and native-titlebar Twitch actions appeared to do nothing.
- New managed Twitch popups now bootstrap at the established right-pane bounds and are only parked after creation. Existing window reuse, one-popup-per-Page-context state and the workspace model remain unchanged.
- Added Twitch show-requested/show-complete/show-failed Flight Recorder events so activation failures are visible in exported diagnostics instead of only the service-worker console.
- Diagnostics schema v10 now exports the Twitch workspace snapshot, active/managed window state and a dedicated Twitch overview card.

**Update:** extension reload only. No native-helper, COBOL-finance or Unified Remote reinstall is required.

## 0.18.25 — Twitch Popup Bootstrap Recovery

- Fixed Twitch actions from Landing and the native titlebar becoming inert after the 0.18.24 page-window migration.
- Stopped importing legacy/broken pre-0.18.25 Twitch session runtime IDs into the popup-window runtime model; schema-mismatched Twitch runtime identity is now discarded and rebuilt lazily while persistent logical instances remain intact.
- Removed all Twitch `tabId -> popup` migration/conversion paths. Opera GX does not reliably support converting already-escaped normal-browser tabs into the managed popup topology used by Stream Shell.
- New Page instances, Drops and the Multi View host now create clean managed popup contexts directly with their target Twitch URL.
- Twitch-created external tabs are re-opened in a fresh managed popup and the disposable spawned tab is closed instead of being moved between Opera windows.
- Kept the Phase-2 floating bar, logical Page/Embed instance state, one-popup-per-context model, layouts, titlebar routing and `rightMode=twitch` compatibility unchanged.

**Update:** reload the extension. No native helper, COBOL finance or Unified Remote reinstall is required. Twitch tabs leaked into Opera's normal browser area by 0.18.23 can be closed manually; 0.18.25 intentionally does not move or close pre-existing user/browser tabs during migration.

## 0.18.24 — Twitch Page-Context Window Isolation

- Fixed Phase-2 Twitch workspace actions escaping into Opera's normal browser window when creating additional tabs from the managed popup.
- Replaced the fragile multi-tab-in-one-popup assumption with one managed popup window per real Twitch Page instance plus one dedicated popup for the Multi View workspace host.
- Kept `rightMode=twitch` as one logical right-side surface: the selected Twitch popup occupies `RIGHT`, while inactive page/workspace popups are parked off-screen and kept reusable.
- Added runtime mappings for `instanceId -> windowId/tabId`, a selected Twitch surface window, and a dedicated workspace-host window.
- Page chips, Drops, arbitrary Twitch URLs and the Multi View host now switch between managed popup contexts instead of creating normal Opera tabs.
- Added migration for known 0.18.23 runtime tabs: when their session mapping survives, leaked normal-browser Twitch tabs are moved into dedicated managed popups.
- Updated titlebar, focus, shutdown and Twitch Volume Boost routing to follow the selected Twitch surface window instead of assuming one fixed Twitch window ID.
- Preserved the visible floating bar, Stream/Page instance model, stream layouts, Twitch/Drops compatibility projection and Unified Remote semantics from 0.18.23.

**Update:** reload the extension. No native helper, COBOL finance or Unified Remote reinstall is required. Any normal Opera tabs already leaked by 0.18.23 can be closed manually if their session mapping did not survive the reload.

## 0.18.23 — Twitch Workspace Phase 2 + Floating Bar Revival

- Added the first visible Twitch Workspace UI as a draggable, persisted floating control bar inside managed Twitch tabs, intentionally reviving the old pre-titlebar floating-control concept for a new workspace-specific job.
- Added chips for Multi View, reusable page instances and stream instances; non-pinned instances can be closed directly from the bar.
- Added an inline `+` panel that accepts a channel/Twitch URL and explicitly creates either a Stream instance or a real Page instance.
- Added a dedicated Twitch-hosted workspace tab and official `player.twitch.tv` iframe tiles for simultaneous streams without an external MultiTwitch service.
- Added Single, Split, Grid and Focus layouts plus main-stream selection and per-tile reload/close controls.
- Kept arbitrary Twitch pages as real logged-in browser tabs/contexts; page chips switch those tabs instead of attempting to iframe normal Twitch pages.
- Added robust workspace-host identification via a Twitch HTTPS marker URL so restored/reloaded sessions do not accidentally adopt the host as a normal page instance.
- Kept `rightMode=twitch`, existing Twitch/Drops buttons, native titlebar behavior, auto-claim/raid automation and Unified Remote compatibility unchanged.
- Chat switching and Player-API audio ownership remain intentionally deferred to the next workspace phase.

**Update:** reload the extension. No native helper, COBOL finance or Unified Remote reinstall is required.

## 0.18.22 — Twitch Workspace Phase 1

- Replaced the managed Twitch popup's strict single-tab invariant with a phase-1 instance manager while keeping Twitch as one Wide-only right-side surface.
- Added persistent logical Twitch page-instance state plus session-only runtime tab mappings, selected-instance state and a reserved workspace-host tab slot for the later embed workspace.
- `Twitch` and `Drops` now use separate reusable tabs in the same managed Twitch window, so switching to Drops no longer destroys/reloads the normal Twitch page context.
- Added internal add/select/close/reload/mute page-instance operations and Twitch URL/channel normalization for the later chip/tab UI.
- Adopted Twitch-created tabs/popups into the existing managed Twitch window instead of rewriting the source tab back to the new target.
- Changed raid protection from one global guard to per-tab guards and stop Twitch Volume Boost capture when the active managed Twitch tab changes.
- Preserved `rightMode=twitch` and the legacy `twitchTarget=resume|drops` projection so Landing, native titlebar and Unified Remote behavior remain compatible during the migration.
- Reserved a lazy `workspaceHostTabId` and instance-context message contract for Phase 2; no multi-stream embed UI is enabled yet.

## Unreleased

## 0.18.21 — Unified Remote Active-State Rollback

- Rolled the Unified Remote runtime/state-update path back to the known-good v0.8.3 implementation after v0.8.4 stopped live active-state highlighting on the installed remote.
- Kept the requested lower-intensity active backgrounds for Discord (`#343b68`) and Twitch (`#4c2d63`).
- Restored Discord's inactive background to the shared neutral remote color (`#66707d`); no special Discord idle color remains.
- Kept the YouTube Windowed Fullscreen reflow fix from 0.18.20 unchanged.

**Unified Remote:** re-run `integrations/unified-remote/install-unified-remote.cmd` and restart Unified Remote Server. No native-helper, COBOL-finance or other reinstall is required.

## 0.18.20 — Remote Contrast + YouTube Windowed Reflow

- Tuned Unified Remote v0.8.4 auxiliary highlighting: Discord now uses a darker idle surface plus a restrained active blue, while Twitch uses a less saturated/darker active purple so both logos remain readable.
- Kept provider/navigation/Volume/Drops active-state semantics unchanged.
- Fixed live YouTube Windowed ↔ Windowed Fullscreen switching leaving stale player geometry until a page refresh.
- Added bounded YouTube layout-refresh pulses after the Stream Shell root marker changes and after theater-mode transitions, letting YouTube recompute player dimensions for both directions without reloading the page.
- Preserved the existing rule that Stream Shell only restores theater mode when Stream Shell itself forced theater mode.

**Unified Remote:** re-run `integrations/unified-remote/install-unified-remote.cmd` (or recopy the custom remote) and restart Unified Remote Server. No native-helper rebuild is required.

## 0.18.19 — COBOL Printable Financial Report

- Added a printer-ready A4 Financial Operations report generated by the real GnuCOBOL reconciliation worker, not reconstructed in JavaScript.
- COBOL now retains the reconciled service rows and emits a fixed-width statement with report date, service/status/billing/cadence columns, monthly and annualized values, summary totals and monthly billing exposure.
- Added `PRINT REPORT` beside `RECONCILE`; printing uses the COBOL-produced statement and supports the browser print dialog / Save as PDF path.
- Print output is invalidated whenever a price or cadence changes, requiring a fresh reconciliation before printing stale numbers.
- Extended the finance installer self-test to verify the printable-report markers and report body in addition to the machine-readable totals.
- Added an explicit Linguist mapping for `*.cob` as COBOL; the finance worker is now materially larger than the bundled Lua remote, so COBOL can surface as a first-class repository language instead of being folded into Other.

**COBOL finance helper:** Re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating.

## 0.18.18 — COBOL Finance Installer Compatibility

- Removed the stale exact-version gate from the COBOL finance installer; it now compiles the finance bridge/worker from the current checkout instead of only accepting Stream Shell 0.18.15.
- Reads the current manifest version dynamically for installer output, so later compatible patch releases can reinstall the finance worker without being rejected before compilation.
- Generalized the native-host runtime-path diagnostic so it no longer points to one obsolete Stream Shell version.
- No finance calculation, billing classification or Wide-only UI behavior changed from 0.18.17.

## 0.18.17 — Crunchyroll Google Play Billing Source

- Added Crunchyroll to the Google Play subscription cross-check so Play-billed Crunchyroll memberships show `Google Play` instead of an empty billing source.
- Preserved renewal/end dates supplied by Crunchyroll itself while deliberately not substituting dates inferred from the multi-card Google Play page.
- Finance billing exposure now classifies Play-billed Crunchyroll under Google Play after the next subscription sync.
- No COBOL/native finance reinstall is required; reload the extension and run subscription sync once.

## 0.18.16 — Finance Billing Exposure Cleanup

- Removed the dedicated Amazon exposure bucket from the Wide Financial Operations report.
- Classified Netflix, Prime Video, Disney+ and Crunchyroll as Direct billing when no explicit billing-source label is available.
- Kept explicit Google Play billing separate for services such as YouTube and Discord.
- Folded any other explicit provider billing source into Direct while retaining Other / unknown as a fallback for genuinely unresolved cases; the fallback is hidden from the exposure strip while it is zero.
- Simplified the COBOL ledger billing code set from `D/G/A/O` to `D/G/O` and removed `AMAZON_CENTS` from the reconciliation report.
- Updated the native ledger validator and Wide exposure grid for the new three-bucket model.

**COBOL finance helper:** Re-run `integrations/cobol-finance/install-cobol-finance.cmd` after updating.

## 0.18.15 — COBOL Runtime Path Hardening

- Fixed the Wide Financial Operations worker failing at runtime with Windows status `0xC0000135` when Opera did not inherit the MSYS2 UCRT64 `bin` directory in `PATH`.
- The finance installer now detects the standard MSYS2 UCRT64 GnuCOBOL installation in addition to normal `PATH` lookup.
- The installer automatically configures `COB_CONFIG_DIR`, `COB_COPY_DIR` and the GnuCOBOL runtime/library paths when an MSYS2-style compiler layout is detected.
- The installed native finance bridge now stores the compiler/runtime `bin` directory and prepends it to the COBOL child process environment, so `libcob` and its MinGW dependencies resolve even when Stream Shell is launched from Opera.
- Improved the native bridge diagnostic for Windows DLL-load failure (`0xC0000135`).
- No Landing/Compact UI behavior changed from 0.18.14; reinstall the COBOL finance integration after updating.

## 0.18.14 — Wide COBOL Finance

- Added a hidden Wide-only Financial Operations surface behind the Landing Subscriptions heading.
- Added local per-service price/cadence storage and fixed-width subscription-ledger generation for the six displayed subscription services.
- Added `integrations/cobol-finance/` with a real GnuCOBOL reconciliation worker plus a C# Native Messaging bridge.
- COBOL returns active/ending counts, monthly run rate, annualized expenditure and billing-source exposure for the report.
- Kept Compact free of the finance runtime; `finance.js` is included only in the Wide Landing bundle.
- Added a compile-time/runtime self-test to the finance installer and kept all install/uninstall entry points inside the integration folder rather than the repository root.
- The existing titlebar helper does not require a rebuild; the separate COBOL finance native host must be installed for reconciliation.

## 0.18.13 — Pause Inactive Provider Playback

- Pauses provider playback through the shared provider adapter before an outgoing provider window is muted/minimized during provider switches.
- Applies the same pause-before-park behavior when returning to Wide Landing/Home and when Compact Dashboard replaces a provider surface.
- Keeps Wide Dashboard/Settings behavior unchanged because the left provider remains visible there.
- Does not auto-resume playback when returning to a previously parked provider; playback remains paused until the user resumes it.
- Added the missing Unified Remote release-note history from v0.1.0 through v0.7.2 alongside the already bundled v0.8.x notes.
- No native-helper reinstall is required for this release.

## 0.18.12 — Unified Remote Repository Integration

- Added the first-party Stream Shell Unified Remote v0.8.3 under `integrations/unified-remote/` instead of maintaining it as a detached sidecar archive.
- Mirrored Unified Remote's `Remotes/Custom/Stream Shell` subtree inside the repository and added Windows installer/uninstaller wrappers targeting the official `C:\ProgramData\Unified Remote\Remotes\Custom\Stream Shell` location.
- Documented the native titlebar-helper dependency, install/update flow, Compact/Wide behavior and active-state semantics.
- Updated public project/version descriptions to include the optional remote-control integration.
- No Stream Shell runtime, provider, window-management or native-helper behavior changed from 0.18.11.

## 0.18.11 — Unified Remote State Sync Fix

- Added an explicit `twitchTarget=resume|drops` bridge state while keeping `rightMode=twitch` unchanged for existing Twitch window, Auto-Mute and cleanup logic.
- Included the Twitch target in native titlebar state deduplication so switching between Twitch Resume and Drops always propagates even when the right-side surface itself does not change.
- Kept the target synchronized when the managed Twitch tab navigates between Drops Inventory and normal Twitch content, so external highlighting reflects the live page instead of only the last remote action.
- Extended `StreamShellTitlebarHost.exe --status` with `twitchTarget` for deterministic external-control highlighting.
- Kept the existing Volume Boost state export available for Unified Remote active-state styling.

## 0.18.10 — Unified Remote Action Surface

- Wired the remaining Unified Remote controls through the local native control bridge: Home, Settings, all five providers, Reload, Volume Boost, Discord, Twitch and Kill.
- Added a native bridge status query so external control surfaces can adapt to the active Wide/Compact layout instead of assuming the 32:9 action set.
- Marked Discord and Twitch controls as Wide-only at the bridge boundary; Compact remotes can hide those actions and receive an explicit `unsupported-compact` error if invoked externally.
- Split Twitch into separate Resume/Show and Drops Inventory actions while keeping the established single-window Twitch model; no legacy Drops worker is restored.

## 0.18.9 — Unified Remote Control Bridge

- Added a local named-pipe control bridge to the existing native titlebar host so trusted local control surfaces can reuse Stream Shell's existing action vocabulary instead of duplicating provider/window logic.
- Added `StreamShellTitlebarHost.exe --action <name>` client mode with explicit action allowlisting and bridge-ready/error responses.
- Kept the native-messaging protocol at v4; the bridge forwards accepted actions through the same native action event path already used by the titlebar.
- Added the first Unified Remote bridge pilot for Dashboard while leaving the remaining remote buttons in preview mode until the transport is verified on-device.

## 0.18.8 — Display-Target Settings + Compact Occlusion Fix

- Fixed Compact titlebar occlusion checks at monitor edges by using DWM visible frame bounds instead of Chromium's invisible maximized resize frames; focusing a window on an adjacent monitor no longer hides unobstructed Stream Shell chrome.
- Added display-target-specific Windowed Fullscreen settings for 32:9, 16:9 and 16:10, including YouTube quick actions and YouTube/Crunchyroll double-click gestures, while keeping unrelated provider settings shared.

## 0.18.7 — YouTube Compact Titlebar / Focus Repair

- Normalized Compact YouTube titlebar sizing to the same 34-logical-pixel Opera caption baseline used by the other providers, preventing YouTube from collapsing the custom titlebar geometry.
- Compensated YouTube's fixed masthead/page layout for the native helper's 8-logical-pixel caption overhang so the corrected titlebar height no longer clips the top of YouTube's own controls.
- Hardened Compact YouTube focus-loss handling: transient unclaimed Opera helper/tool HWNDs no longer count as real occluders, while the real foreground Opera window, known normal Opera windows and foreign applications still do.
- Added a YouTube-only second fullscreen-state confirmation after cross-window focus changes so one transient false Fullscreen API sample cannot resurrect the titlebar over a still-active fullscreen transition.
- Fixed Compact 16:9 subscription row sizing so enlarged subscription content no longer overlaps the Subscriptions / Updated header.
- Removed the Now Playing card from Compact 16:9 and 16:10; Now Playing remains a Wide-only multiscreen feature.
- Removed the Compact-only minimized-provider snapshot retention and background playback-indicator path that only supported that card.
- Kept Compact 16:9/16:10 native titlebar chrome suppressed when a fullscreen provider loses foreground focus; Alt-Tab no longer clears the fullscreen state, while Wide keeps its existing fullscreen geometry behavior.
- Reconciled Compact fullscreen titlebar state against the live provider document after focus changes, so true fullscreen keeps chrome hidden while a stale fullscreen claim no longer hides the titlebar when Stream Shell remains visibly unobstructed on another monitor.

## 0.18.6

- Increased Compact 16:9 subscription provider icons and provider-name typography again for better balance with the rest of the dashboard.
- Enlarged subscription status pills so the larger status text has proper vertical breathing room instead of nearly touching the capsule edges.
- Increased renewal/date/source text sizing in the 16:9 subscriptions panel.
- Reworked Compact 16:9 subscription dividers as dedicated centered separators so they stay aligned after the larger row/icon sizing.
- Release notes now live exclusively under `release-notes/` instead of accumulating in the repository root.

## 0.18.5

- Increased Compact 16:9 Watchlist/Search panel typography so tabs, sort controls, subtitles and empty-state copy scale with the rest of the widescreen layout.
- Enlarged Compact 16:9 subscription provider icons, names, status labels, renewal/source text and panel heading now that the 16:9 target has its own vertical budget.
- Moved per-version release notes into `release-notes/` to keep the repository root from accumulating release-note files.

## 0.18.4

- Fixed Compact dashboard horizontal gutter symmetry so the right-edge inset now matches the left side on both 16:9 and 16:10 targets.
- Used more of the lower 16:9 viewport by enlarging the Compact subscriptions panel and its internal row spacing instead of leaving dead space beneath the layout.
- Slightly increased the 16:9 outer gutter and provider/media separation for a cleaner widescreen balance.

## 0.18.3

- Further tuned the Compact 16:9 dashboard: larger Stream Shell brand mark, slightly larger outer gutters, larger inter-section spacing, taller primary content blocks and expanded subscription height to use the viewport better.
- Increased Watchlist/Search/media-panel and empty-state readability on Compact 16:9, including larger watchlist message typography.
- Fixed Compact subscription header clipping introduced by the previous 16:9 sizing pass.
- Compact native titlebar chrome on 16:9 and 16:10 now remains visible while Stream Shell stays unobstructed, matching Wide's visible-until-occluded behavior instead of hiding immediately on Alt-Tab.

## 0.18.2

- Tuned the Compact 16:9 Dashboard independently from 16:10: slightly larger provider cards, typography, media controls and subscription text with a larger provider/media gutter.
- Enlarged the Compact 16:9 provider wordmark while keeping the Stream Shell brand mark unchanged.
- Fixed Compact provider titlebar chrome being clipped by Chromium's invisible maximized-window resize frame at monitor edges.

## 0.18.1

- Added native 16:9 display targeting while reusing the existing Compact titlebar and single-surface layout.
- Auto display priority is now 32:9 > 16:9 > 16:10.
- Forced Compact mode supports both 16:9 and 16:10 targets and prefers 16:9 when both are connected.
- Diagnostics now identify the selected aspect target explicitly.

## 0.18.0

- Added a default-on YouTube cleanup switch for Playables / instant-game shelves and navigation.
- Fixed Compact native titlebar chrome remaining visible during true provider fullscreen.
- Reduced Compact/native hot-path work by trusting claimed HWND mappings, throttling Alt+Tab presentation repair and avoiding full browser-window enumeration during claim heartbeats.
- Parallelized independent Compact Home media helper loading.
- Warm-start providers are created offscreen before minimization so Compact no longer flashes the remembered provider across the full display at launch.

This is not a complete history of every private build. It records the recent public baseline and the refactors/fixes immediately leading into it.

## 0.17.12

- Fixed YouTube playlist/autoplay transitions caching the previous video's title in Now Playing and Continue Watching.

## 0.17.11

- Fixed the Manifest V3 match pattern used by the Volume Booster fullscreen bridge.
- Volume Booster can temporarily release tab capture for native fullscreen and reattach afterward.

## 0.17.9

- Hardened active YouTube Shorts detection beyond the fragile `is-active` marker.
- Shared the resolver with Shorts icon replacement, Auto-Like and active-video lookup.

## 0.17.8

- Added temporary Shorts discovery during delayed `watch/home → shorts` mounting without restoring a global YouTube observer.

## 0.17.7

- Watchlist toggle now reopens the last active library tab during the same session.
- Improved delayed Shorts heart → thumbs-up replacement.

## 0.17.6

- Fixed stale YouTube title caching across SPA navigation.

## 0.17.5

- Fixed immediate Return YouTube Dislike hydration in Windowed Fullscreen by removing a conflicting zero-opacity ancestor while keeping the hidden column off-screen/non-interactive.

## 0.17.1

- General performance cleanup across Twitch, Netflix, Prime, Dashboard and Landing.
- Removed unnecessary document-wide/root mutation work and reduced idle polling.

## 0.17.0

- Large YouTube runtime refactor.
- Replaced the old document-wide mutation observer with targeted observers and bounded navigation settle passes.
- Reduced repeated DOM scans, geometry reads and static Now Playing metadata work.
