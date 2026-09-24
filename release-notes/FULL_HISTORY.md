# Stream Shell — Full Recovered Patch Notes

## 0.1.0 — Initial MV3 Shell

- Introduced the first Manifest V3 Stream Shell build around Netflix, Prime Video and Crunchyroll.
- Opened the three services as persistent tabs inside a dedicated popup shell window instead of disposable browser tabs.
- Added provider switching through the shared Stream Shell content runtime.
- Persisted the managed shell window ID in `chrome.storage.local` so the extension could reuse the existing shell.
- Added the first Prime Video 32:9 player CSS correction.

## 0.2.0 — Window & Overlay Foundation

- Moved Stream Shell into a dedicated 1920×1080 normal browser window.
- Added a draggable Stream Shell overlay/control surface.
- Kept provider tabs persistent in the managed window and muted inactive/background provider tabs.
- Retained the existing Prime Video ultrawide fix.

## 0.3.0 — Dual-Pane Shell

- Split the experience into separate provider windows rather than one tab-only shell.
- Established the 1920×1080 left/right desktop layout used by the early 32:9 workflow.
- Added a right-side Dashboard/Discord surface while providers occupied the left side.
- Created the basic two-window model that later evolved into Wide mode.

## 0.4.0 — Managed Window Foundation

- Moved critical shell injection earlier to `document_start`.
- Added a self-healing Crunchyroll switch bar so provider navigation could recover after page changes.
- Added managed-window shutdown/kill behavior instead of leaving orphaned Stream Shell windows behind.
- Strengthened the distinction between normal Opera windows and Stream-Shell-managed surfaces.

## 0.5.0 — Five-Provider Expansion

- Added YouTube and Disney+ to the original Netflix / Prime Video / Crunchyroll set.
- Expanded provider maps, manifest matches and Dashboard controls to five streaming services.
- Extended managed provider-window creation and content-script handling to the new services.

## 0.6.0 — UI Cleanup

- Standardized the Stream Shell interface on English UI text.
- Reworked the floating control bar into a movable overlay-only surface with persisted position.
- Reorganized the five provider buttons into a more deliberate grouped layout and enlarged the primary controls.
- Redesigned Dashboard status/footer controls and added Reload, Discord and Kill Stream Shell actions.
- Added the placeholder theme/artwork structure that the later branded Landing/Dashboard design would use.

> The historical chat referred to this build as `v0.6`; the recovered manifest line uses the 0.6 generation.

## 0.7.0 — Landing & Branding Architecture

- Added a dedicated Landing page while keeping Dashboard on the right side.
- Introduced split left/right provider background assets for the five services.
- Added Stream Shell branding assets plus provider icons and provider wordmarks.
- Changed startup to land on the branded Landing surface first rather than immediately exposing a provider.
- Retained Discord and the existing dual-pane provider/Dashboard architecture.

## 0.8.0 — Provider Theme Baseline

- Established provider background assets for YouTube, Netflix, Prime Video, Disney+ and Crunchyroll with separate left/right artwork.
- Introduced the `providers/theme/` architecture and retained an inactive Netflix theme proof of concept.
- Kept provider theming scoped to Stream-Shell-managed windows through the existing root marker.
- Separated the idea of visual provider themes from functional player fixes.

## 0.8.1 — Netflix Theme Test

- Activated the Netflix theme content-script path for `*.netflix.com`.
- Injected `providers/theme/netflix.js` and `providers/theme/netflix.css` at `document_start`.
- Exposed the Netflix background asset through `web_accessible_resources`.
- Validated that the injection architecture worked; remaining failures were selector/background-layer issues rather than provider detection.

## 0.8.2 — YouTube + Netflix Themes

- Integrated Stream Shell wallpaper theming for YouTube and Netflix.
- Corrected theme gating so the styles only apply inside Stream-Shell-managed windows.
- Excluded YouTube `/watch/*` playback pages from the wallpaper treatment to avoid fighting the player.

## 0.8.3 — Theme URL & Netflix Canvas Fix

- Fixed provider wallpaper URLs to resolve correctly from the extension (`chrome-extension://…`).
- Strengthened Netflix canvas/root targeting around `#appMountPoint` and the actual visible background hierarchy.
- Kept the YouTube/Netflix theme architecture otherwise unchanged.

## 0.8.4 — Provider Edge Shade

- Brought the Landing-page edge/bottom shading into the YouTube and Netflix provider themes.
- Improved the visual transition between the provider artwork and Stream Shell UI without changing provider logic.

## 0.8.5 — Landing Glass

- Removed the visible shadows around Landing controls.
- Increased Landing control transparency to better match the Dashboard glass treatment.
- Kept the underlying Landing/provider behavior unchanged.

## 0.8.6 — Discord Desktop

- Removed the browser-style Discord Dashboard integration in favor of the installed stable Discord client.
- Added Discord beside the Landing/Dashboard controls with a neutral glass state and Blurple active state.
- Reused an existing Discord main window when possible and positioned it into the right pane.
- Changed normal Stream Shell switching to minimize/cover Discord rather than killing it.

## 0.8.7 — Subscription Verify + Discord

- Added Prime authentication handling with explicit `VERIFY` / sign-in state and a long interactive wait for passkey/login flows.
- Added Discord as a sixth subscription/status entry.
- Added Google Play cross-checking for YouTube/Discord subscription metadata and a Google Play billing-source label.
- Kept YouTube's own membership state authoritative while allowing Google Play to describe billing.
- Used `UNKNOWN` instead of inventing a Discord state when Play-store data was inconclusive.

## 0.8.8 — Subscription State Fixes

- Restricted YouTube Google Play data to billing-source use instead of replacing YouTube's own membership state.
- Simplified Discord subscription display to `Google Play` without the incorrect Play Pass date.
- After Prime authentication, reopened Prime Central and re-ran the membership scrape.
- Stopped authenticated Amazon states from remaining stuck on `VERIFY` once a valid membership signal was available.

## 0.8.9 — Prime Interactive Fix

- Made Prime `VERIFY`, `SIGN IN` and similar states explicitly interactive instead of treating them like passive scrape failures.
- Stopped periodic reloads while a visible Amazon authentication flow is in progress.
- Returned to Prime Central once after authentication to re-evaluate subscription state.
- Preserved the already-correct Crunchyroll renewal-date result.

## 0.9.0 — Adaptive Dashboard Brand

- Replaced the Dashboard logo/STREAM SHELL block with clock/date when the left Landing surface is freely visible.
- Restored Dashboard branding when the left side is covered so the right pane still identifies Stream Shell.
- Used native window visibility/overlap information to drive the adaptive brand state.

## 0.9.1 — Now Playing

- Added the first Dashboard Now Playing card in the lower-left area.
- Added artwork, scrolling title and provider detection for all five services.
- Positioned Now Playing between the existing status/footer elements without changing provider playback itself.

## 0.9.2 — Now Playing Live

- Added a live playback progress bar and PLAYING / PAUSED / READY / ENDED states.
- Added session playback time and provider activity indicators.
- Made the Now Playing area clickable to return to the active player window.
- Fixed Discord minimization behavior around Dashboard/player switching.

## 0.9.3 — State Fixes

- Reworked Discord state handling after the first Now Playing integration.
- Kept the title marquee active while playback is running.
- Made the clock/date branding behavior adapt more reliably to the current shell state.

## 0.9.4 — Provider & Artwork State Fixes

- Changed provider activity dots so only the actually active provider is marked.
- Added TMDB backdrop fallback when provider artwork cannot be scraped.
- Shortened episode-style titles before metadata lookup to improve matching.
- Removed the unwanted Kill-button shadow.

## 0.9.5 — Netflix Now Playing Fix

- Improved Netflix title normalization/shortening for Now Playing and metadata matching.
- Preferred TMDB backdrop artwork before weaker generic artwork fallbacks.

## 0.9.6 — Playback State Persistence

- Stopped clearing Now Playing merely because another window temporarily covers the provider.
- Cleared provider playback state only on meaningful transitions such as minimize, close or provider switch.
- Made Netflix title detection/normalization more aggressive so playback metadata survives UI changes.

## 0.9.7 — Discord Main-Window Detection

- Changed the native Discord helper to look specifically for the real Discord main window instead of helper/update windows.
- Ranked candidate windows by title, class and geometry.
- Added a stable-Discord restart/wake fallback when no usable main window exists.

## 0.9.8 — Windowless Discord Helper

- Built the Discord helper as a windowless Windows application so it no longer leaves its own console/UI behind.
- Switched Discord hiding to native `SW_HIDE` behavior for cleaner shell transitions.

## 0.9.9 — Discord Overlay Fix

- Changed Dashboard switching so Discord remains intact behind Dashboard instead of being hidden/minimized immediately.
- Avoided a Native Helper update for the overlay experiment.

> This build regressed Discord launching: the next chat reported that only a helper window could appear, leading directly to the 0.9.10 rollback.

## 0.9.10 — Discord Rollback

- Rolled the Discord foundation back to the known-good 0.9.3-era behavior after the 0.9.9 overlay regression.
- Kept the newer subscription sync, Now Playing work and Netflix fixes rather than rolling back the whole app.

## 0.9.11 — Dashboard Footer Layout

- Reworked the Dashboard footer layout around the growing Now Playing surface.
- Temporarily doubled Now Playing height to roughly 144 px for a roomier media layout.
- Changed only Dashboard presentation plus the manifest version.

## 0.9.12 — Now Playing Layout Refinement

- Reduced Now Playing from the oversized 0.9.11 layout to about 116 px.
- Placed artwork top-left with playback state beside it.
- Reserved a full-width title row below the artwork/state area.
- Placed the progress bar below the title with elapsed/total time at the right.
- Established the first visually stable Now Playing baseline.

## 0.9.13 — Provider Metadata Regression Fixes

- Restored Landing/provider background shading after a visual regression.
- Made Netflix title tracking persist when the player UI disappears.
- Improved Prime selectors to avoid generic/non-title metadata.
- Normalized Crunchyroll episode metadata toward the series/title information Stream Shell needs.

## 0.9.14 — Netflix Member API Removal

- Removed the Netflix member/API path that had become unreliable or unnecessarily invasive.
- Kept the surrounding subscription/Now Playing/provider behavior on the safer local/DOM paths.

## 0.9.15 — Cross-Window Sync Reduction

- Reduced unnecessary cross-window state synchronization between Stream Shell surfaces.
- Targeted the performance overhead that had begun to affect playback while preserving the visible shell behavior.

## 0.9.16 — Playback Performance Fix

- Removed Now Playing blur and pulse effects that were costing paint/compositing time.
- Removed the automatic title marquee from the hot path.
- Reduced frequent storage writes; long-running progress persistence moved to roughly minute-scale updates.
- Preserved immediate updates for play/pause, seek and ended transitions.
- Resolved the observed Netflix buffering/quality regression and improved YouTube smoothness without regressing Prime/Crunchyroll.

## 0.9.17 — Discord Stable Window

- Hardened native Discord main-window detection and reuse.
- Stopped ordinary Stream Shell switches from minimizing Discord unnecessarily.
- Added a Squirrel/stable-install wake fallback when Discord is installed but the main window is unavailable.

## 0.9.18 — Native Titlebar Prototype

- Introduced a separate native titlebar host.
- Added left titlebar navigation for Home/YouTube/Netflix/Prime/Disney+/Crunchyroll and right navigation for Dashboard/Discord.
- Reused the existing Stream Shell navigation handlers instead of creating a second navigation system.
- Auto-started/closed the titlebar host with Stream Shell and hid overlays while minimized/fullscreen.
- Kept the old floating navigation as a fallback during the prototype.

## 0.9.19 — Native Titlebar Fix

- Adjusted Opera client-drawn titlebar detection and removed the false fullscreen/`WindowFromPoint` vetoes that blocked overlays.
- Built the host as a `ConsoleApplication` to make diagnostics/install behavior more predictable.
- Made the installer target the exact extension path/ID.
- Added `%LOCALAPPDATA%\StreamShell\TitlebarHost\titlebar.log` diagnostics.

## 0.9.20 — Titlebar Installer Fix

- Hardened native-titlebar installation and bootstrap logging.
- Created the TitlebarHost/logging path before elevation so failures were actually visible.
- Read the extension ID from the existing native-manifest information instead of relying on brittle manual state.
- Added compile/registry/install diagnostics.

## 0.9.21 — Titlebar Bootstrap Fix

- Moved critical bootstrap setup into the CMD stage so the TitlebarHost/log path exists before PowerShell/UAC work.
- Bypassed local PowerShell execution-policy friction for the installer.
- Focused this build on getting the native host to start deterministically rather than changing titlebar behavior.

## 0.9.22 — Titlebar Z-Order Fix

- Promoted the click-through titlebar overlays into the required top-level Z-order so they render above Opera.
- Added foreground-aware hiding so the overlays do not remain painted over unrelated applications.
- Forced explicit window updates and expanded native logging around show/hide/Z-order decisions.

## 0.9.23 — Titlebar Foreground Fix

- Relaxed foreground matching to accept the relevant Chromium root/process/geometry instead of requiring one overly specific HWND relationship.
- Improved overlay visibility when Opera's foreground window structure differs from the originally observed layout.

## 0.9.24 — Titlebar Process-Family Fix

- Changed foreground matching from strict process-ID identity to the Opera/Discord process family plus expected geometry.
- Reduced false negatives caused by Chromium spawning/activating sibling processes or windows.
- Required a full helper restart after install so the new native logic actually took effect.

## 0.9.30 — Windows Taskbar Identity

- Assigned Stream Shell its own Windows AppUserModelID/taskbar group instead of leaving shell windows under Opera.
- Added the Stream Shell taskbar icon and provider overlay badges.
- Kept ordinary Opera windows outside the Stream Shell taskbar identity.

## 0.9.31 — Window Safety Net

- Added an off-screen recovery pass: after a delay, managed windows with less than roughly 20% visible area were snapped back.
- Targeted orphaned/off-screen shell windows after focus/window-management experiments.

> This safety-net approach was later rejected because it could interfere with ordinary Opera session/window placement.

## 0.9.32 — Provider Chrome Theme

- Added provider-specific native titlebar/DWM caption and border colors.
- Applied matching Dashboard/titlebar tinting while keeping Discord outside provider theming.
- Turned provider identity into part of the native Windows chrome rather than only the web UI.

## 0.9.33 — Taskbar Ownership Repair

- Added cleanup for stale Stream Shell AppUserModelID assignments.
- Restricted taskbar ownership claims to the active, extension-confirmed Stream Shell foreground HWND.
- Kept provider-colored chrome/badges while reducing accidental capture of normal Opera windows.
- Removed the dangerous 0.9.31 snapback strategy from the normal path.

## 0.9.34 — Native Startup Fix

- Removed the blocking multi-second startup cleanup/sweep that delayed the native host.
- Separated AppUserModelID cleanup from the taskbar API so one unavailable COM path could not block the whole host.
- Kept ownership limited to known Stream Shell windows.

## 0.9.35 — Opera Taskbar Split Stabilizer

- Explicitly marked both Stream Shell browser windows with the Stream Shell AppUserModelID.
- Reasserted the normal Opera identity on non-shell windows so minimizing/restoring Opera did not absorb them into Stream Shell.
- Preserved provider titlebar coloring while stabilizing taskbar grouping.
- Restored original Windows properties when Stream Shell exits.

## 0.9.36 — Provider Chrome Hijack

- Added a click-through provider-colored overlay over the left Opera caption area.
- Used provider colors for YouTube, Netflix, Prime, Disney+, Crunchyroll and Landing.
- Added the STREAM SHELL label and kept a separate clickable navigation layer.
- Restricted the overlay to confirmed Stream Shell HWNDs.

## 0.9.37 — Minimal Native Chrome

- Removed the 1px accent line at the bottom of the custom titlebar.
- Increased titlebar height by roughly 8 px and fully overpainted the native caption area.
- Replaced native Minimize/Maximize/Close on the left with Stream Shell-owned controls.
- Blocked the right caption area without duplicating unnecessary controls there.
- Kept the existing taskbar split/identity logic.

## 0.9.38 — Right-Aligned Chrome Navigation

- Removed the custom Minimize/Maximize/Close experiment again.
- Right-aligned Stream Shell navigation from Landing through Kill over the native caption-button area.
- Kept the taller custom titlebar, removed the bottom line and preserved the taskbar split/provider colors.

## 0.9.39 — Dashboard Chrome Exposure Fix

- Decoupled right-side Dashboard chrome visibility from the left shell `visibilityMode`.
- Kept Dashboard chrome visible when the left side changes or normal Opera is used there.
- Added real foreign-window overlap checks for the right titlebar zone.
- Hid Dashboard chrome only when another window actually covers the right caption area, then restored it automatically.
- Left 0.9.38 taskbar grouping, navigation alignment and provider colors unchanged.

**Native helper:** Reinstall the native titlebar helper.

## 0.9.40 — AltTab

- Made Landing the permanent hidden Windows anchor for the Stream Shell window group.
- Attached Provider, Dashboard and Discord windows as owned windows under that logical shell.
- Reduced Alt+Tab to one Stream Shell entry instead of separate internal surfaces.
- Updated the representative title/icon dynamically for the current provider.
- Kept the Windows media/player process outside the Stream Shell ownership graph.

## 0.9.41 — Launcher

- Added `StreamShellLauncher.exe` as a Windows-facing Stream Shell entry point.
- Added AppUserModelID/name/icon/relaunch metadata so taskbar/Start-menu activation can launch the shell.
- Used an internal launcher page to trigger the existing `openShellHome()` path and remove the temporary handoff tab.
- Kept the 0.9.40 Alt+Tab ownership model.

## 0.9.42 — Launcher Hotfix

- Fixed launcher compilation on systems where PowerShell `Add-Type -CompilerOptions` was unavailable.
- Switched the launcher build to the .NET CodeDOM compiler.
- Kept launcher behavior, Alt+Tab logic and embedded icon unchanged.

## 0.9.43 — Grouping Fix

- Restored taskbar grouping to the known-good 0.9.40 model.
- Removed RelaunchCommand/DisplayName manipulation from live Opera HWNDs.
- Kept inactive providers minimized but hid their legacy gray desktop minimize boxes.
- Kept the left Stream Shell titlebar visible when foreign windows only occupy the right half.
- Created a real Start-menu Stream Shell shortcut with the Stream Shell AppUserModelID/icon.
- When Stream Shell is already running, the launcher signals the native host directly instead of creating a temporary Opera tab; cold start retains the internal fallback.

**Native helper:** Reinstall the native titlebar helper.

## 0.9.44 — Launcher Fix

- Added a named-event warm-start path so an already-running Stream Shell can be restored without a browser handoff tab.
- Pumped the launcher message queue so Explorer/taskbar launch feedback can finish cleanly.
- Changed true cold start to launch Opera directly rather than relying on ShellExecute/DDE behavior.
- Improved right-pane foreground handoff and removed stale old launcher instances during install.

## 0.9.45 — Launcher Identity Fix

- Removed the remaining extension-tab/URL-based launcher handoff.
- Used the installed Opera shortcut/path for cold startup and coordinated the startup sequence with the native host.
- Added a longer startup window for the browser/extension/native pieces to come online in order.
- Validated stored window IDs before reuse and removed the old left-half geometry heuristic.

## 0.9.46 — Seam & Taskbar Fix

- Changed Discord parking to native `SW_HIDE` to remove the visible seam between shell panes.
- Protected ordinary Opera HWNDs from late Stream Shell ownership signals.
- Reasserted Opera AppUserModelID on affected non-shell windows and rebuilt only the affected taskbar button.
- Kept launcher/pinning/Alt+Tab behavior otherwise unchanged.

## 0.9.47 — Regression Recovery

- Rolled native titlebar/Alt+Tab/grouping behavior back to the 0.9.45 logic after the 0.9.46 regressions.
- Removed the `protectedNormal` path that could cause normal Opera/titlebar behavior to break.
- Kept targeted taskbar rebuilding.
- Replaced Discord `SW_HIDE` with DWM cloaking so Discord could disappear without disturbing its normal window state.

## 0.9.48 — Deterministic HWND Fix

- Added a Stream Shell title marker to classify managed Opera HWNDs deterministically.
- Disabled the DWM border color to remove the remaining 1px seam.
- Changed the Now Playing title marquee to hover-only.

> The deterministic title-marker/ownership logic proved unsafe and could catch normal Opera windows; 0.9.49 rolled that part back.

## 0.9.49 — Safe Rollback Fix

- Returned to the 0.9.47 grouping/titlebar model after the 0.9.48 HWND-classification regression.
- Kept the DWM seam/border fix from 0.9.48.
- Kept the hover-only Now Playing marquee.
- Removed the dangerous title-marker/HWND filtering and extra grouping changes.

## 0.9.50 — Fullscreen Guard

- Detected true Chromium fullscreen when a managed provider expands across both Wide panes.
- Hid only Stream Shell custom titlebar overlays/buttons while fullscreen is active.
- Restored the custom chrome automatically when normal geometry returns.
- Left AppUserModelID, owner relationships, taskbar, launcher and Discord behavior untouched.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.0 — Extension Baseline

- Rebased the mainline on the stable pre-launcher 0.9.40-style shell rather than continuing the launcher experiment chain.
- Removed launcher/Start-menu taskbar-launch machinery from the baseline.
- Retained custom native titlebars, Alt+Tab grouping, provider/Dashboard/Landing behavior, Discord integration, Watchlist/Search/History and player/provider features.
- Retained the fullscreen chrome guard and the hover-only Now Playing title behavior.

## 0.10.1 — Landing Source Split

- Split the large Landing runtime into source fragments for maintainability.
- Rebuilt the runtime so generated `landing.js` remained byte-identical to the pre-split behavior.
- Made no functional UI/runtime change.

## 0.10.2 — Source Split, Safe Runtime

- Continued the source-only decomposition without changing the shipped generated Landing runtime.
- Kept build output byte-identical while establishing a safer source/build workflow for future edits.

## 0.10.3 — Dashboard Source Split

- Split the monolithic Dashboard JavaScript into maintainable source chunks.
- Rebuilt `dashboard.js` byte-identically so the refactor did not change behavior.

## 0.10.4 — Right Chrome Guard

- Restricted right-side custom Dashboard chrome to actual Stream Shell Dashboard context.
- Prevented the right titlebar overlay from appearing over unrelated windows when the Dashboard is not the visible right surface.

## 0.10.5 — Right Z-Order Guard

- Changed right-side chrome visibility to follow actual Dashboard visibility/occlusion rather than only shell state.
- Allowed Dashboard chrome to remain while the left pane changes, but hid it when another window really covers the right pane.

## 0.10.6 — Atomic Chrome Sync

- Fixed the split state where titlebar buttons remained visible while the backdrop disappeared and Opera's native caption showed through.
- Made shell membership/chrome visibility a single decision per HWND per sync cycle.
- Applied that one decision to both backdrop and toolbar.
- Preserved the 0.10.5 right-side Z-order behavior.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.7 — Right Chrome Cloak Guard

- Ignored DWM-cloaked windows when evaluating right-side occlusion.
- Prevented hidden/cloaked helper windows from suppressing Dashboard chrome.
- Kept provider-color coupling and the existing left-side behavior.

## 0.10.8 — Dashboard Owned Chrome

- Attached the right-side titlebar overlays directly to the Dashboard as owned non-topmost windows.
- Reduced independent right-chrome Z-order drift while preserving provider-derived color state.

## 0.10.9 — Common Source Split

- Split `common/shell.js` into canonical source fragments while preserving the generated runtime.
- Isolated the legacy floating-shell code so it could be evaluated/removed separately.

## 0.10.10 — Floating Shell Removed

- Removed the obsolete floating-shell UI/runtime that the native titlebar had replaced.
- Cut `common/shell.js` substantially (roughly 3305 → 1669 lines in the recovered release message).
- Kept provider playback behavior while deleting the dead overlay stack.

## 0.10.11 — Background Source Split

- Split `background.js` into source areas/chunks while retaining one generated runtime bundle.
- Kept generated behavior byte-identical during the structural refactor.

## 0.10.12 — Canonical Backgrounds

- Replaced the derived left/right image copies with five canonical 32:9 provider background originals.
- Used the canonical artwork across Landing, Dashboard and the YouTube/Netflix theme paths.
- Kept the visual composition intentionally equivalent while simplifying asset ownership.

## 0.10.13 — Dead Code Cleanup

- Removed `StreamShellLauncher.cs` and remaining dead launcher material from the extension baseline.
- Removed duplicate Prime CSS, unused Crunchyroll theme code, dead titlebar SVGs and stale floating-shell cleanup.
- Reduced unnecessary `web_accessible_resources` exposure.
- Normalized manifest icon assets.

## 0.10.14 — Legacy & Brand Cleanup

- Removed the obsolete 1254px Stream Shell logo asset.
- Resized/normalized Landing wordmark usage.
- Removed the no-longer-needed Discord host permission and additional launcher-migration leftovers.
- Narrowed resources and cleanup helpers to the current architecture.

## 0.10.15 — Provider Layout Cleanup

- Moved Prime's functional player stylesheet into `providers/player/prime.css`.
- Updated manifest references while keeping the stylesheet byte-identical.
- Removed the previous cleanup helper after the path migration.

## 0.10.16 — Minimized Window Parking

- Parked iconic/minimized managed Opera provider representations outside the virtual desktop to avoid visible desktop artifacts.
- Preserved normal provider restore behavior.
- Kept the change confined to native window handling.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.17 — YouTube Shorts Activity Fix

- Used active Shorts-specific selectors instead of generic watch-page assumptions.
- Cleared stale normal-video activity when YouTube SPA navigation enters/leaves Shorts.
- Added `yt-navigate-finish` handling so activity follows SPA transitions.

## 0.10.18 — Ignore Shorts in Activity

- Stopped creating normal Now Playing/activity entries for YouTube Shorts.
- Removed the previous normal-video activity immediately when switching into Shorts.
- Avoided title/duration/activity scraping for Shorts in this build.

## 0.10.19 — Now Playing Visibility Guard

- Rendered Now Playing only when the provider scraper reports a valid playback status.
- Showed Reload only when a streaming provider is actually visible on the left.
- Kept Reload hidden on Landing.

## 0.10.20 — Adaptive Now Playing Artwork

- Sized Now Playing artwork from the actual image aspect ratio instead of forcing one shape.
- Kept artwork height at 54 px with bounded width.
- Handled 16:9, square and portrait artwork naturally and kept a 16:9 fallback when no image loads.

## 0.10.21 — Left Titlebar Isolation

- Attempted to restore/switch left-side Landing/provider windows without activation/focus stealing.
- Removed the native left focus handoff as part of that isolation attempt.

> The focus-isolation approach was found too aggressive and was corrected in 0.10.22.

## 0.10.22 — Left Focus Single Handoff

- Restored `focused:true` for the left provider/Landing activation path.
- Removed only the redundant extra native `requestTitlebarFocus("left")` handoff.
- Left Dashboard/Discord/native behavior unchanged.

## 0.10.23 — Direct Watchlist & Dashboard Motion

- Added subtle Dashboard layout motion for panel/category changes.
- Added `Official`, `Recent` and `Direct` Watchlist categories.
- Added direct-URL storage/opening and a Direct-link workflow.
- Extended Watchlist import/export to format v2 including Direct links.
- Updated Watchlist counters to include the new categories.

## 0.10.24 — Extension Action Popup

- Added an extension action popup with Open Stream Shell.
- Added Save current page / Update saved link and Open Direct links actions.
- Removed the earlier website right-click context-menu workflow that provider sites could suppress.

## 0.10.25 — Last Provider Restore

- Persisted the last active streaming provider.
- Restored that provider state on normal startup.
- Kept Direct/Home entry paths Landing-based rather than forcing provider restore everywhere.

## 0.10.26 — Warm Provider / Landing State

- Kept Landing visibly selected at startup while the remembered provider is warmed in the background.
- Separated `activeProvider` from `leftMode` so a warm provider does not falsely appear as the visible surface.
- Displayed the provider titlebar/icon only once that provider is actually opened.

## 0.10.27 — Now Playing Polish

- Colored the progress bar and PLAYING/status text with the active provider's titlebar color.
- Fixed title clipping around the progress bar.
- Changed long titles from hover-only movement to a continuous slow marquee.
- Added provider identity/badge treatment to the Now Playing card.

## 0.10.28 — Windowed Player Test

- Added the first persistent Windowed-player toggle for YouTube and Crunchyroll.
- Stored Windowed state separately in `chrome.storage.local`.
- Added provider-specific Windowed CSS without touching Native/Discord/titlebar code.

## 0.10.29 — YouTube Hover Masthead

- Made YouTube's native logo/search masthead available on top-edge hover while Windowed mode is active.
- Kept the rest of the Windowed player focused on playback instead of permanently showing the full YouTube shell.

## 0.10.30 — Crunchyroll Exact Windowed Player

- Reworked Crunchyroll Windowed mode around the actual player wrapper / `#player-container` / Bitmovin/video viewport.
- Locked body scrolling while the Windowed player is active.
- Avoided scaling unrelated Crunchyroll page UI.

## 0.10.31 — Crunchyroll SPA Persistence

- Reapplied the Crunchyroll Windowed marker after SPA/pushState episode navigation.
- Kept the player layout in Windowed mode across episode changes without a full page reload.

## 0.10.32 — Now Playing Extra Controls

- Removed the provider badge from Now Playing after the layout became too busy.
- Moved the Windowed-mode toggle into the Now Playing top-right area.
- Stopped the control click from bubbling into the card/window activation action.

## 0.10.33 — YouTube Quick Actions + Prime UI Toggle

- Exposed YouTube `.ytp-fullscreen-quick-actions` while Stream Shell Windowed mode is active.
- Added a persistent Prime UI-fix kill switch, defaulting ON.
- Kept the Windowed/Now Playing integration provider-specific.

## 0.10.34 — YouTube Native Auto-Hide

- Made Stream Shell's YouTube extras follow the native `ytp-autohide` player state.
- Faded quick actions together with the bottom timeline/controls instead of keeping them permanently visible.
- Hid Comments in Windowed mode while leaving Prime behavior unchanged.

## 0.10.35 — YouTube Extras Visibility Attempt

- Tried to isolate/hide the Comments region using a parent `:has(...)` selector.
- The selector was too broad and could hide the wrapper containing Stream Shell's extras as well.

> Historical regression build. 0.10.36 immediately removes the problematic parent-hiding rule.

## 0.10.36 — YouTube Extras Visibility Fix

- Removed the problematic `:has(...)` parent-hiding selector from 0.10.35.
- Hid only the Comments element/region itself.
- Restored Windowed controls, EX/quick actions and native autohide behavior.

## 0.10.37 — YouTube Native Controls Sync

- Removed the independent ~2.2-second visibility timer for YouTube extras.
- Bound Stream Shell extras directly to `#movie_player.ytp-autohide`.
- Kept Comments hiding and user toggles separate from the native-control visibility state.

## 0.10.38 — Cleanup & Refactor

- Removed a duplicate Common build path and split the Windowed-player implementation into cleaner source units.
- Removed Crunchyroll legacy host polling/attributes.
- Removed dead Discord-helper code and redundant classes/CSS.
- Strengthened bundle/source validation after the cleanup.

## 0.10.39 — Provider Settings Center + YouTube Utilities

- Introduced provider-tabbed Settings instead of one flat settings surface.
- Added YouTube Preferred Quality, Upload Date, Auto Like and Cleanup controls.
- Set recovered defaults to 1080p preferred quality, 12-hour upload-date format and 69% Auto Like threshold.
- Established the Settings Center structure later shared by other provider features.

## 0.10.40 — Settings Layout Polish

- Repositioned the Settings cog and grouped options into clearer categories.
- Placed Auto Like percentage/time controls side by side.
- Separated Upload Date, Player and Cleanup groups for faster scanning.

## 0.10.41 — Expanded Settings Workspace

- Expanded Settings to take over the Dashboard workspace from the branding area down to the footer.
- Animated the normal Dashboard content out/in around Settings.
- Used multi-column layout: Player/Upload Date in two columns and Auto Like/Cleanup in three.
- Added clearer provider-section separators.

## 0.10.42 — Persistent Footer + Titlebar Settings Toggle

- Kept the Dashboard footer visible while Settings is open with a dedicated gutter.
- Unified Settings open/close around a cog/X interaction.
- Added the Settings cog to the native titlebar between Dashboard and Discord.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.43 — Active Settings State + Volume Booster

- Synchronized the titlebar Settings cog active state with the actual Settings overlay.
- Added per-provider Web Audio volume controls from 100% to 600%, persisted per provider.
- Defaulted every provider to 100%.
- Used the Web Audio path only where normal HTML5/MSE playback can safely be captured; DRM capture remained separate.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.44 — DRM Volume Booster Toggle

- Added a native titlebar volume icon to toggle the current provider's booster.
- Added a `tabCapture → offscreen AudioContext/Gain` path for DRM-capable provider boosting.
- Suspended capture during provider switches and preserved configured values.
- Added the `Ctrl+Shift+8` toggle shortcut.

**Native helper:** Reinstall the native titlebar helper.

## 0.10.45 — Footer & Focus Fix

- Corrected the footer spacing introduced by the expanded Settings/Now Playing workspace.
- Made Dashboard/Now Playing activation reliably minimize/park Discord instead of allowing it to resurface through focus/Z-order races.

## 0.10.46 — Discord Parking & Settings Copy Cleanup

- Parked minimized Discord outside the visible desktop rather than leaving a visible edge/seam.
- Restored Discord into the right pane on reactivation.
- Cleaned internal implementation-comment copy from the Settings UI.

**Native helper:** Reinstall/update the Discord helper.

## 0.10.47 — Prime Essentials

- Integrated the useful Prime Video Enhancer behaviors directly into Stream Shell.
- Added Prime ultrawide UI cleanup plus Hide X-Ray and Hide Overlay controls.
- Split Auto Skip into Intro, Recap and Promo controls.
- Added Prime subtitle scaling/color/font controls.
- Renamed the provider runtime from `prime-ui-fix.js` to `prime-enhancements.js`.

## 0.10.48 — Playback, Automation & TMDB

- Expanded unified playback/settings behavior across all five providers.
- Added provider automation/subtitle controls including Netflix skip/still-watching and Crunchyroll skip/navigation behavior.
- Added YouTube Keep Playing, Loop and Windowed-related settings.
- Added TMDB rating information to Now Playing.

## 0.10.49 — Now Playing Layout + Anarchy Mode

- Reworked Now Playing so playback status sits above artwork/TMDB information.
- Added Playback Anarchy with smooth random speed drift roughly from 0.55× to 1.9×.
- Added Subtitle Anarchy with rapid neon color changes and smooth size drift.
- Kept Anarchy disabled by default.

## 0.10.50 — Now Playing / Anarchy Center

- Returned Now Playing to roughly 116 px after the previous layout experiment.
- Placed status in the upper-right and TMDB information in the lower-right.
- Moved Anarchy controls into a dedicated centralized settings section rather than scattering them through Playback/Subtitle groups.

## 0.10.51 — Audio, Sleep, RYD, Crunchyroll & Settings Export

- Added YouTube Return YouTube Dislike ratio display.
- Added per-provider Audio modes: Normal, Dialogue and Night.
- Added a Sleep Timer.
- Added Crunchyroll spoiler protection and an experimental quality control.
- Added Settings export/import.

**Recovered SHA-256:** `e1ad9ba747259bc8aa0ce8d51cd4fe78a10c9614bbf6c5e9a809147128a32856`

## 0.10.52 — RYD / Netflix / Quality Cleanup

- Fixed YouTube RYD ratio parsing.
- Cleaned up the Netflix Automation settings layout.
- Removed the nonfunctional Crunchyroll experimental Quality feature.

**Recovered SHA-256:** `b70f8ae803e91267d1a88b04d91c73b8494ae6300b0f00177b1a0578b7598506`

## 0.10.53 — RYD + Crunchyroll Dimming Fix

- Read YouTube dislike data from the active action-container context instead of stale/global elements.
- Removed the earlier ratio-bar calculation path.
- Synchronized Crunchyroll dimming/cleanup across frames and both current/legacy player layouts.

## 0.10.54 — RYD Hotfix + Crunchyroll Cleanup

- Removed the Crunchyroll player-dimming feature after it proved more harmful than useful.
- Reused the Auto-Liker's active YouTube button detection for RYD.
- Fixed the `Number(null) === 0` path so missing data is not shown as a fake 0/100 ratio.

**Recovered SHA-256:** `87ef1fef7b9eab0f3cb0cc4c85685345f117f92ba750b9d2b5b0904835d0c1c1`

## 0.10.55 — RYD Tooltip Hotfix

- Made `#ryd-dislike-tooltip` the primary RYD data source.
- Parsed the tooltip's Likes / Dislikes values into an exact ratio.
- Kept `#ryd-bar` percentage as a fallback.

**Recovered SHA-256:** `78aa67a0456cb4575082d54769368f1a09f11a8846a5eff52a7d304c6b6c1152`

## 0.10.56 — RYD Windowed Fullscreen Fix

- Stopped fully removing the metadata/action column in YouTube Windowed mode.
- Parked the required column offscreen so RYD can continue rendering/hydrating without being visible/clickable.
- Cached the same-video ratio to reduce repeated work.

## 0.10.57 — YouTube Loop Controls

- Added a master YouTube Loop toggle plus separate Regular Videos and Shorts toggles.
- Returned to YouTube's native behavior when the master toggle is off.
- Recovered defaults: regular videos OFF, Shorts ON.

## 0.10.58 — UI Consistency

- Standardized Watchlist and Settings import/export placement.
- Used Import on the left and Export on the right with compact icon controls.
- Made the Settings close control frameless to match the surrounding UI.

## 0.10.59 — Anarchy Color Overdrive

- Made Anarchy toggles/header cycle random neon colors roughly every 200 ms while enabled.
- Expanded Subtitle Anarchy to a 32-color neon pool.
- Kept the chaos cosmetic and reversible when Anarchy is disabled.

**Recovered SHA-256:** `67dfa7e8cd3ddf4a09c3044c37251367d447bacd87ab4735a03a90d4c482ec58`

## 0.10.60 — Settings Search & Diagnostics

- Added Settings Search at the top of every provider settings sidebar.
- Added the Diagnostics overlay with live state, Refresh and JSON Download/Export.
- Placed Diagnostics alongside Settings controls with X/Esc close behavior.
- Exposed helper/provider/playback/audio/timer/settings state for troubleshooting.

**Recovered SHA-256:** `724b37e48d76fda4d8fc39145323484833593ae0e4bea609b45e1654ac80e793`

## 0.10.61 — Diagnostics Overlay Polish

- Changed Diagnostics to expand leftward from the Settings controls with matching borders.
- Kept the Diagnostics header sharp while only lightly blurring/dimming the settings workspace behind it.
- Reduced the heavy black overlay from the first Diagnostics implementation.

## 0.10.62 — Diagnostics Deep Dive

- Added browser / viewport / screen environment details.
- Added native titlebar mode plus Settings/Volume helper state.
- Added counts for browser/provider windows and a health state for every provider.
- Added content-script response checks plus video / iframe / canvas / resolution / readyState / playback-rate / progress snapshots.
- Added YouTube RYD-tooltip presence and active-provider Windowed state.
- Added offscreen-audio-document state in addition to capture state.
- Expanded the JSON export with provider-window state, player/content snapshots, manifest permissions, browser environment and the full current Stream Shell settings configuration.
- Kept titles, URLs, Watch History and TMDB credentials out of Diagnostics export.

**Recovered SHA-256:** `4d7d9e02fcf2014b5584a7db3a415c772040d3291cea57d4d2b831a62a160980`

## 0.10.63 — Diagnostics Content Sizing Fix

- Let Diagnostics cards use their real content height instead of compressing three rows into the fixed panel height.
- Changed grid rows to `max-content` and stopped small cards stretching to match the tallest card.
- Made the Diagnostics content region scroll when the cards exceed the available height.
- Kept header/footer fixed and retained responsive 3 → 2 → 1 column behavior.

**Recovered SHA-256:** `6bd37d2d0a64116ebae11cb1cef1c5f60fe8458363f5c59a8fa17626fb43cdc0`

## 0.11.0 — Provider API v1 + Global Continue Watching

- Introduced Provider API v1 as the common shell-facing layer for identity, watch context, media snapshots, playback controls, resume, capabilities and self-test.
- Added provider-agnostic Continue Watching storing provider, URL/media identity, timestamp, duration, title and artwork.
- Automatically removes completed Continue entries at the recovered default 95% threshold.
- Added a Provider Capability Matrix and launch self-test to Diagnostics.
- Updated Settings/Watchlist export/import to v3.
- Added `TODO_RULED_OUT.txt` to record intentionally rejected feature directions.

**Recovered SHA-256:** `5b6c147c6c151813d449c461d4e4f09ab43fc3b2659b9f1c1e43fab92d9fb26e`

## 0.11.1 — YouTube Panorama / Theme Marker Fix

- Restored the missing left-side YouTube panorama/theme background.
- Added/strengthened the CSS fallback for the YouTube provider background.
- Made the YouTube theme marker (`data-stream-shell-youtube-theme`) consistent across runtime/theme code.

**Recovered SHA-256:** `19b4363b99cfd1d90685834895dab5d829698489af5e577927b05f577c7d3947`

## 0.11.2 — Dedicated YouTube Adapter

- Added the adapter registry and moved YouTube onto a dedicated provider adapter.
- Delegated YouTube identity/watch context, player lookup, Windowed mode, RYD, quality and utility features through the adapter.
- Added adapter-aware Diagnostics and self-test coverage.

**Recovered SHA-256:** `fb434e9dce778e4c5ff1f28b8831c84cb2a830daf7e6eee15165f1dcafd05ecb`

## 0.11.3 — Dedicated Netflix Adapter

- Moved Netflix metadata, wallpaper/theme, Continue Prompt, Skip Intro, Skip Recap and Next Episode behavior into a dedicated adapter.
- Added Netflix SPA/navigation handling inside the adapter.
- Changed Diagnostics/media snapshots to use the adapter path rather than separate Netflix-specific shell code.

**Recovered SHA-256:** `9edf53f7864ef374ab2780bd76ab3c8387e39d5c12e4a5943835077c494936e7`

## 0.11.4 — Dedicated Prime Adapter

- Moved Prime UI fix, X-Ray/overlay hiding, subtitle styling and Intro/Recap/Promo skipping into a dedicated provider adapter.
- Added Prime adapter Diagnostics/self-test coverage.
- Changed media snapshots and provider capabilities to flow through the new adapter.

## 0.11.5 — Disney+ & Crunchyroll Adapters

- Added the dedicated Disney+ adapter with watch-route, subtitle and navigation support.
- Migrated Crunchyroll SPA navigation, Windowed mode, player targeting, skip/timing/seek and metadata into its dedicated adapter.
- Reached the intended all-five-provider dedicated-adapter architecture.

**Recovered SHA-256:** `aa556744cf4737fcb34b78a1d25f83b6382f254e1a2f1a27cbce84181cce5c84`

## 0.11.6 — Managed Marker & Crunchyroll Metadata Fix

- Added a lightweight managed-marker guard so SPA/provider changes can restore Stream Shell's root marker when a site removes it.
- Applied the guard to all providers.
- Added Crunchyroll title fallback order: Series DOM → JSON-LD → `og:title` → `twitter:title` → meta title → `document.title`.
- Exposed Crunchyroll `titleMetadata` detail in Diagnostics.

**Recovered SHA-256:** `994d9cbb8badaf0d7fb1abc66e8c407cf1cd182c99c1658e0e9596c07b660171`

## 0.11.7 — Provider-Specific Continue Resume

- Normalized YouTube saved links to clean `/watch?v=...` URLs, preserving playlist/index while removing `t`, `start` and `time_continue` noise.
- Added stabilized multi-check YouTube seeking so the target timestamp survives player initialization.
- Normalized Netflix entries to canonical `/watch/<id>` links with a pending resume seek.
- Added Prime's detail-page bootstrap: wait for a usable Resume/Play control, click it, wait for the real player, then apply the timestamp.
- Kept Crunchyroll on its already-working direct resume path; Disney remained unverified.
- Added resume strategy/pending target information to Diagnostics.

**Recovered SHA-256:** `bf7a050118dd0e7b755fe03909139b5fe0e39e860a792e527032d44daa181afc`

## 0.11.8 — Netflix MAIN-World Player Bridge

- Stopped writing `video.currentTime` directly on Netflix after the O7375/DRM failures.
- Added an isolated-content-script → `window.postMessage` → MAIN-world bridge into Netflix's internal player API.
- Routed Netflix seek/resume, play, pause, playback rate and volume through the bridge.
- Added Diagnostics bridge state (`ready` / `waiting`) and the `main-world-netflix-player-api` command path.

## 0.11.9 — Provider API Refactor / Cleanup

- Centralized resume/media identity writer+reader logic in shared `resume-utils.js` so Background and Common cannot drift apart.
- Split the oversized Provider API into core, self-test, resume and start source files.
- Removed old generic provider-capability fallbacks.
- Removed dead YouTube parsers, unused provider state, dead Settings rendering and stale Dashboard DOM references.
- Re-ran the existing provider/resume harnesses after the cleanup.

## 0.11.10 — Editable Continue Completion Threshold

- Turned `completed at 95%` into an inline numeric input instead of a separate popup.
- Allowed values from 1–100 and stored the threshold as a normal Stream Shell setting.
- Made Continue empty-state/copy update from the configured percentage.
- Explicitly ruled out Watchlist Rules/Archive as unnecessary extra systems.

## 0.11.11 — Completion Threshold Editing Fix

- Allowed the Continue completion input to be temporarily empty while the user is editing it.
- Committed on Enter/blur and restored the previous value on Escape.
- Made an empty blur fall back safely instead of trapping the field in an invalid state.

## 0.11.12 — Diagnostics Flight Recorder

- Added a 200-event session ringbuffer in `chrome.storage.session`, surviving MV3 service-worker restarts without becoming permanent history.
- Added an Event Timeline to Diagnostics; UI shows the recent subset while JSON export contains the full ringbuffer.
- Recorded provider open/close/activate, adapter/API start, SPA navigation, watch-context changes, video appear/disappear and the full resume chain.
- Recorded Prime resume control, Netflix MAIN-world bridge command/result/error, provider skip events, Settings changes and self-test transitions.
- Kept titles and URLs out of the recorder.
- Updated `TODO_RULED_OUT.txt` and Settings export version.

**Recovered SHA-256:** `1ae47a0e5358395843233e74ae8f74b9b7568cdcafa1d5eca490f1b9aafca465`

## 0.11.13 — Diagnostics UI Reorganization

- Reorganized Diagnostics into `Overview → Active Provider → Playback / Resume → Provider Features → Event Timeline → Environment / Helpers → Raw / Export`.
- Moved Resume out of the overloaded Active Provider area.
- Grouped YouTube/Netflix-specific runtime state under Provider Features.
- Kept Capability Matrix, Flight Recorder and export metadata intact.
- Changed Diagnostics/UI only; Background, Common Runtime and provider adapters stayed unchanged.

**Recovered SHA-256:** `f0be2d21f3d3fd2435f8a2fe3d2b6492053b2723e62a6ba46c5df052dc18ef19`

## 0.11.14 — Self-Heal / Repair

- Added targeted Diagnostics repair actions instead of a generic reload-everything button.
- Added cancellation/cleanup for stuck Pending Resume state.
- Added Netflix bridge recovery/reinitialization.
- Added provider state/marker/content resync paths before escalating to provider-only reload.
- Bumped Diagnostics schema to v4.

**Recovered SHA-256:** `5ddca2131ac023e5feccfc504dff53ef6ac698c793a7af28fa830b4e175569b2`

## 0.11.15 — Per-Provider Safe Mode

- Added Safe Mode independently for all five providers.
- Safe Mode keeps Provider API, Resume, Now Playing, Diagnostics, Audio, Sleep Timer and ordinary playback available.
- Disables Stream Shell's invasive provider DOM/UI modifications so provider-site failures can be isolated from extension failures.
- Bumped Diagnostics schema to v5 and added safe-mode test coverage.

**Recovered SHA-256:** `a18bd41c84704818a46c1df321d2ac34d2581113a2442f80003e3bc986ec43d9`

## 0.11.16 — Resource Governor v2

- Added adaptive throttling for Stream Shell's own provider observers, polling loops and DOM checks.
- Used provider visibility/activity/minimized/watch-context/playing state to decide how much work should run.
- Parked heavy provider observers when a provider is hidden and paused instead of closing the provider tab/window.
- Exposed governor state through Diagnostics (schema v6).

**Recovered SHA-256:** `97a2459363ff9d2a47246fffc02617fd2bad6a347d29ee6ee47a4c84206af39d`

## 0.11.17 — Stale-Link Resolver

- Added a Media Identity → dedicated adapter → current URL → resume resolution path for dead Watchlist/Continue links.
- Added Prime-specific recovery through current `/detail/`/DOM identity.
- Added canonical reconstruction paths for YouTube, Netflix and Crunchyroll.
- Kept Disney on a conservative fallback because its live behavior was still unverified.

**Recovered SHA-256:** `275b73cbb634928d6b3b7add503ad7e0421037ed2443320ea539fe316a5852b6`

## 0.11.18 — DVD Anarchy Edition

- Added a per-provider DVD Anarchy toggle.
- Shows the bouncing DVD logo only in the currently active left provider window.
- Uses smooth random speed drift around 105–760 px/s and changes neon color on each wall collision.
- Sleeps completely when the provider is hidden/minimized; Safe Mode suppresses it without changing the stored toggle.
- Uses a pointer-transparent Shadow Root so the overlay does not intercept provider UI.
- Cleaned the supplied DVD-logo image into a transparent PNG without extra metadata chunks.

**Recovered SHA-256:** `41369f2e92457d367e50745dc109e40d7c8ebc584acef39aeb4fe7f78e9eba65`

## 0.11.19 — Amazon Manifest Hotfix

- Expanded the relevant Amazon web-accessible-resource/match origin from the narrow `/gp/video/*` path to the full `*.amazon.de/*` origin.
- Kept the 0.11.18 runtime behavior otherwise unchanged.

**Recovered SHA-256:** `f800545721e7231d7b13bc35e4acf9e49a9d55f1bd4abccb48672da8e3d5a632`

## 0.12.0 — Refactor / Cleanup

- Split Settings Center into multiple canonical source files.
- Split playback utilities into Core / Anarchy / Runtime responsibilities.
- Split YouTube utilities into smaller focused source units.
- Split routing/background helpers and removed the dead `common/src/provider-api.js` path.
- Deduplicated redundant playback-rate writes.
- Made Settings export report the manifest version dynamically rather than a hard-coded version.
- Restored the intended neon Anarchy visual state.
- Rebuilt/validated generated bundles after the structural cleanup.

**Recovered SHA-256:** `fd10dc7c41b7855d0d56c450950489642d62e49379148d9c678d8a36d95017ae`

## 0.12.1 — Diagnostics Performance Pass

- Removed heavy Diagnostics `backdrop-filter` / `clip-path` paint work.
- Stopped hidden Settings DOM from continuing to cost paint/layout work behind Diagnostics.
- Added `content-visibility`/containment where safe.
- Limited live panel probing to the active provider while keeping full five-provider probing for explicit JSON export.
- Kept the UI timeline smaller than the exported recorder history to reduce render cost.

**Recovered SHA-256:** `6a2a918d65ef1a0de3f1301baf80a50a831cdb7228f752749e37e1c9f4a4e194`

## 0.12.2 — Crunchyroll Subtitle Fix

- Fixed the Subtitle-Anarchy `active` ReferenceError.
- Expanded subtitle renderer targeting across Vilos, Bitmovin/DOM overlays, `video::cue`, Shadow Roots and child frames.
- Fixed Custom Subtitle Size behavior and verified Anarchy no longer throws.
- Kept unrelated bundles byte-identical to 0.12.1.

**Recovered SHA-256:** `90abd819f4cce0740e81f1ec33dfb8554de552b601a532ab14d352b20b125fd7`

## 0.12.3 — Diagnostics Density + Crunchyroll Subtitle Cleanup

- Compacted the Diagnostics layout so information density improved without dropping data.
- Removed Crunchyroll Custom Subtitle Settings and Subtitle Anarchy.
- Removed Crunchyroll subtitle adapter-state/capability entries that no longer represented useful behavior.
- Removed the complete Crunchyroll all-frames subtitle worker/CSS path after confirming normal subtitles are effectively hard-rendered for Stream Shell's purposes.
- Left YouTube, Netflix, Prime and Disney subtitle features unchanged.

## 0.13.0 — Display Profiles

- Added display-profile detection for `wide` and `compact`.
- Added the global Display override: Auto / Wide / Compact.
- Added Diagnostics schema v9 fields for detected/applied profile, target display bounds, work area, DPI and planned geometry.
- Kept 32:9 behavior unchanged while introducing detection for the 16:10 Compact path.
- When both laptop and docked ultrawide are present, the ultrawide target wins in Auto.
- This release was detection/planning only; it did not yet turn Compact into a true single-surface shell.

## 0.13.1 — Display Geometry Hotfix

- Positioned Stream Shell windows relative to the selected target display's bounds/work area instead of assuming desktop origin `(0,0)`.
- Added support for non-zero and negative monitor origins.
- Added a temporary Compact staging geometry that fits the dual-pane shell into the selected display.
- Extended Diagnostics with the actually applied geometry.

## 0.13.2 — Native Titlebar DPI / Multi-Monitor Hotfix

- Changed the native titlebar helper to derive left/right geometry from the selected monitor rather than absolute Chromium coordinates.
- Made the titlebar DPI/geometry path monitor-relative for mixed-DPI and docked setups.
- Resynchronized the already-running native helper when display/docking geometry changes.

**Native helper:** Reinstall the native titlebar helper.

## 0.13.3 — YouTube Home Promo Cleanup

- Added the default-on `Hide Home Promotions` cleanup setting.
- Hid YouTube featured/statement/promo banners such as `ytd-statement-banner-renderer` while leaving the normal Home grid intact.
- Kept Display / Window / Native Titlebar behavior from 0.13.2 unchanged.

**Recovered SHA-256:** `fb76e0003b124331fc0533e552ed3777c78584689c54cdb67adccb6f58167afd`

## 0.14.0 — True Compact Single-Surface Shell

- Turned Compact into a real single-surface mode instead of a scaled two-pane Wide shell.
- Made Dashboard or the current Provider occupy the target display Work Area.
- Removed Landing as a separate visible Compact surface.
- Brought Stream Shell branding, provider selection, Watchlist/Search, Now Playing and Subscriptions into the Compact Dashboard.
- Kept Settings/Diagnostics as overlays on that one surface.
- Added Reload to Compact native chrome.
- Used logical Work Area sizing to behave correctly on 200% laptop scaling.

## 0.14.1 — Compact State & Layout Fix

- Enforced Dashboard-or-Provider exclusivity in Compact so two full-size shell HWNDs cannot compete at once.
- Stabilized Dashboard/provider switching and native-titlebar target selection.
- Isolated Compact Home code from Wide again so the 32:9 runtime remains unchanged.
- Reworked Compact into five vertical provider buttons with Watchlist/Search aligned to the provider-stack height.
- Added the six-column compact subscription status/date table.
- Restored the provider playback indicator in the Compact controls.
- Made Settings, Reload and Volume react immediately again.

## 0.14.2 — Native Titlebar Hotpath Performance

- Optimized the native titlebar window-enumeration hot path.
- Checked geometry before more expensive process validation and stopped enumeration after the first valid HWND match.
- Preserved mixed-DPI/multi-monitor behavior while removing the titlebar-induced lag.
- Restored Wide responsiveness after the 0.13.2 multi-monitor changes.

## 0.14.3 — Compact Layout Rhythm

- Kept Watchlist/Search/Continue/Recent/Direct/Subscriptions on one canonical `landing/src/*` implementation shared by Wide and Compact bundles.
- Scaled Compact geometry from Wide with 200% display scaling in mind (outer spacing, provider row height, logo size and internal controls).
- Made all five provider buttons equal-size and vertically stacked.
- Aligned Watchlist/Search to begin at YouTube and end at Crunchyroll.
- Kept Subscriptions as a bounded six-column table and reserved the upper-right for the provider wordmark.
- Replaced the text Reload glyph with a dedicated Compact reload icon asset.
- Kept generated runtimes and the Wide CSS region byte-identical to 0.14.2.

**Native helper:** Reinstall the native titlebar helper.

**Recovered SHA-256:** `d8d7553c61da53c112a53c96874f01fb21c4c86c22ab5ac0f08d40b56720736a`

## 0.14.4 — Compact Layout Polish

- Moved the Compact main content block lower and gave it more vertical room.
- Increased provider button/control sizing and spacing.
- Expanded Subscriptions visually across the Compact width with larger typography.
- Corrected playback/availability indicator placement.
- Improved Settings header spacing around provider controls/Diagnostics.
- Forced the Compact Diagnostics cockpit grid to the intended 4/3/3/2 density instead of collapsing under generic media queries.
- Kept Wide and generated runtime logic unchanged.

## 0.14.5 — Compact Titlebar & Dashboard Integration

- Set Compact titlebar order to `Dashboard → Settings → Reload → Volume | YouTube → Netflix → Prime → Disney+ → Crunchyroll | Kill`.
- Removed Discord from Compact titlebar only; Wide remains unchanged.
- Returned Reload to the Wide-style `↻` glyph and removed the temporary reload PNG.
- Made Compact titlebar/backdrop owned non-topmost windows of the active shell HWND.
- Moved clock/date beside the Compact brand and kept provider wordmark space free.
- Expanded provider/media spacing, media-panel height and inline Watchlist metadata.
- Restored the Now Playing provider dot to the top-right and moved availability marking away from it.
- Expanded Subscriptions and hardened the Compact Diagnostics grid.

**Native helper:** Reinstall the native titlebar helper.

**Recovered SHA-256:** `9972a849e949156c4c72a2fca58bb096cf9eeebabf4ab08ede432aa07958dc9d`

## 0.14.6 — Compact Integration Fix

- Doubled Compact branding size and placed clock/date beside it.
- Adjusted Compact titlebar Z-order and Reload behavior after the first integration pass.
- Added stable Dashboard-anchor ownership for Compact taskbar/Alt+Tab grouping.
- Changed Compact subscription validation to use a small active-but-unfocused helper window instead of a minimized surface so browser-side validation can actually run.

## 0.14.7 — Shared Grouping Path

- Removed clock/date from Compact again.
- Removed the separate Compact-only Alt+Tab/owner implementation and returned Wide/Compact to one shared ownership path with profile-specific anchors.
- Stopped reparenting the titlebar on every provider switch.
- Used the Segoe UI Symbol `↻` Reload treatment.
- Used TOPMOST for Compact titlebar visibility in this iteration.

> The TOPMOST choice fixed self-occlusion but made Compact chrome stick over unrelated apps; 0.14.8/0.14.9 explored alternatives.

## 0.14.8 — Compact NOTOPMOST Experiment

- Changed Compact titlebar insertion from TOPMOST to NOTOPMOST so other applications could cover it normally.
- Kept the rest of the Compact/Wide state path unchanged.

> This made the titlebar fall behind Stream Shell itself; superseded by 0.14.9.

## 0.14.9 — Compact HWND_TOP Experiment

- Moved Compact titlebar/backdrop to `HWND_TOP` in the normal Z-order.
- Avoided continuously reasserting Z-order every 500 ms.
- Kept Wide unchanged.

**Native helper:** Reinstall the native titlebar helper.

**Recovered SHA-256:** `16348e93264a72ab19f1e6ddd1d710b4a0de7cdf2775ba7716c9da4b48114c66`

> The bar was initially correct but could fall behind Opera after a provider switch because visibility stayed true while Z-order changed.

## 0.14.10 — Compact Z-Order Reassert

- Added an actual Z-order relationship check instead of treating `IsWindowVisible()` as proof that the titlebar is above the shell.
- Reasserted `HWND_TOP` only when the active Compact titlebar has fallen behind the current Stream Shell HWND.
- Added foreground-root protection so the repair does not promote Stream Shell chrome over unrelated applications.
- Avoided permanent TOPMOST and avoided unconditional 500 ms `SetWindowPos` churn.

## 0.14.11 — Reload Glyph Encoding Fix

- Changed the native C# Reload label from a literal `↻` to the explicit `\u21BB` escape.
- Fixed mojibake/encoding issues without changing the Compact behavior introduced by 0.14.10.

**Native helper:** Reinstall the native titlebar helper.

**Recovered SHA-256:** `7568904d66ae326de9582cb6caf966f02a03507a22c75a6f4e9bb199d67dda57`

## 0.14.12 — Compact Foreground Authority

- Returned Compact chrome to TOPMOST positioning like Wide, but made native Win32 foreground state authoritative for whether it is shown.
- Prevented stale Chromium `visibilityMode=none` messages from evicting a still-known Compact shell HWND.
- When focus leaves Stream Shell, hides/demotes the Compact chrome through NOTOPMOST rather than leaving it over other apps.
- Kept the existing claim/grouping architecture.

## 0.14.13 — Native Compile Fix

- Fixed a C# local-variable shadowing compile error by renaming the initial `leftTarget` temporary.
- Made no behavior changes to the 0.14.12 Compact foreground/titlebar logic.

## 0.14.14 — Native Installer Hardening

- Resolved the extension ID before elevation.
- Made the elevated install stage synchronous (`-Wait`) so success/failure cannot disappear behind the calling shell.
- Kept the installer/error window available long enough to read failures and strengthened persistent logging.
- Made no native titlebar logic change.

## 0.14.15 — Compact HWND Ownership Hardening

- Added explicit Compact HWND ownership/title matching instead of relying on loose geometry alone.
- Hardened Dashboard ↔ Provider exclusivity so only the intended Compact shell surface is treated as active.
- Reduced accidental adoption of ordinary Opera windows into Compact titlebar/grouping state.

## 0.14.16 — Compact Claim Retry Hardening

- Added Compact HWND claim retries while a new provider window/title is still loading.
- Added `tabs.onUpdated` retry support and an explicit claim-accepted path.
- Aborted outstanding claims when normal Opera takes focus rather than continuing to adopt by stale geometry.
- Added AppUserModelID retry handling for newly created Compact windows.
- Kept 32:9/Wide behavior unchanged.

## 0.15.0 — Titlebar Hardening

- Introduced explicit trusted HWND claims for Wide and Compact instead of broad implicit ownership.
- Added a 500 ms native foreground safety/reconciliation loop.
- Hid and demoted custom chrome to NOTOPMOST when an external foreground window overlaps the shell area.
- Introduced Native Protocol v2 hello/ack between extension and titlebar host.
- Added roughly 1.5-second heartbeat/reconciliation and a ~6.5-second fail-closed timeout.
- Expanded diagnostics around titlebar trust/claim state.
- Kept Display Auto/Wide/Compact switching behavior unchanged.

**Native helper:** Reinstall the native titlebar helper.

## 0.15.1 — Titlebar Hardening Compilefix

- Removed the unused `compactVisibilityDiagnosticKey` local that caused the native build to fail under warnings-as-errors.
- Changed no 0.15.0 hardening behavior.

**Native helper:** Reinstall the native titlebar helper after rebuilding.

## 0.15.2 — Spatial Foreground Hardening

- Made Wide titlebar visibility spatial instead of globally foreground-only.
- Allowed a foreign app on the opposite 1920px half to coexist without hiding the left Stream Shell titlebar.
- Still hid/demoted chrome when a foreign window actually overlaps the left titlebar band.
- Left Compact claims, Protocol v2, heartbeat and reconciliation unchanged.

## 0.15.3 — Wide Z-Order Occlusion Fix

- Checked relevant windows above the left Stream Shell HWND, not only the current foreground window.
- Prevented Wide titlebar chrome from resurfacing when focus moves but another window still sits above the left shell area.
- Kept Compact behavior unchanged.

## 0.15.4 — Wide / Compact Background Assets

- Switched provider artwork references to explicit `*_wide.png` and `*_compact.png` assets.
- Wired the profile-specific artwork through Dashboard, Landing and YouTube/Netflix theme paths.
- Kept the release ZIP code-only; local background PNGs were not bundled in that historical build.
- Left the native helper unchanged.

## 0.15.5 — General Settings Tab

- Added the global General settings tab.
- Moved Display mode (`Auto | Wide | Compact`) out of provider-specific sidebars and into General.
- Removed duplicate Display entries from provider search/sidebar results.
- Corrected Display help text while keeping the existing storage key/behavior.
- Kept display/window/titlebar logic and the native helper byte-identical to 0.15.4.

## 0.15.6 — Native Lifecycle / Fullscreen Repair

- Added a periodic drift audit for native titlebar/Alt+Tab ownership (roughly every five seconds).
- Repaired cases where Stream Shell windows could become ungrouped or lose titlebar ownership over time.
- Temporarily removed a Wide fullscreen provider from the owner graph so true fullscreen can behave like a normal foreground window.
- Restored ownership after leaving fullscreen.
- Kept Compact, Netflix DOM and background code unchanged.

**Native helper:** Reinstall the native titlebar helper.

## 0.15.7 — YouTube Translated-Audio Survey Cleanup

- Added a deliberately narrow YouTube cleanup for only the `How satisfied are you with the translated audio …` survey.
- Did not add a generic survey remover or auto-rating behavior.
- Kept a conservative wrapper fallback for small DOM variations.
- Kept Native Helper / fullscreen / taskbar / titlebar code byte-identical to 0.15.6.

## 0.16.0 — Twitch Auxiliary Workflow

- Added Twitch as an auxiliary Stream Shell workflow rather than a sixth full streaming provider.
- Added a Twitch split-button/control next to Discord.
- Added a persistent covered Twitch window with Auto-claim Channel Points/Drops, Prevent Raids, Processing Mode and Twitch Volume controls.
- Deliberately skipped unnecessary provider-style features such as playback-speed bloat.
- Introduced Native Protocol v3 for the expanded shell/native integration.

**Native helper:** Reinstall the native titlebar helper.

## 0.16.1 — Twitch Window & Auto-Mute Fixes

- Replaced the Twitch visual with a transparent official Glitch asset.
- Consolidated stray/duplicate Twitch windows.
- Added browser/tab-level Auto-mute enabled by default.
- Set managed Twitch tabs `autoDiscardable:false` so the background workflow stays alive.
- Kept the 0.16.0 native helper byte-identical.

## 0.16.2 — Twitch Popup / Drops Worker / Titlebar

- Separated one visible Twitch popup from a persistent minimized Drops worker refreshed in place.
- Intercepted Twitch navigation so the visible experience stays inside the intended managed surface.
- Fixed Twitch SVG/UI sizing.
- Added Twitch to the native titlebar beside Discord and added Twitch-purple Settings styling.

**Native helper:** Reinstall the native titlebar helper.

## 0.16.3 — Twitch Single-Window Simplification

- Switched to the exact uploaded Twitch SVG treatment.
- Returned to a single-window / single-tab Twitch model.
- Retired the separate inventory worker/refresh alarm.
- Added resume/show lifecycle handling and remembered the last normal Twitch URL when visiting Drops.
- Kept channel-point/drop auto-claim behavior.

## 0.16.4 — Twitch Native Icon Installer Fix

- Updated the native installer to copy `twitch.png` into the titlebar icon set.
- Made no Twitch lifecycle/runtime change.

**Native helper:** Reinstall the native titlebar helper.

## 0.16.5 — Twitch Native Icon Polish

- Changed the native Twitch icon to a monochrome treatment by default.
- Adjusted native draw sizing from roughly 17×20 to 20×23 to better match the neighboring Discord/titlebar icons.
- Left the Landing SVG/runtime unchanged.

**Native helper:** Reinstall the native titlebar helper.

## 0.16.6 — Twitch Native Icon Normalization

- Normalized `twitch.png` onto a 72×72 transparent canvas.
- Used a 20×20 native draw box with a visually smaller ~16×18 glyph for consistent perceived size.
- Kept Twitch window/Drops/claim lifecycle unchanged.

**Native helper:** Reinstall the native titlebar helper.

## 0.16.7 — YouTube Shorts Heart → Thumb Up

- Replaced the Shorts heart-like Like icon with a custom thumbs-up visual.
- Used outline state when unliked and filled state when liked.
- Kept YouTube's real button, click handling, counts and like state authoritative.
- Kept the feature independent of RYD and left normal videos untouched.
- Safe Mode restores YouTube's original icon.
- Kept Native/Twitch/titlebar code unchanged from 0.16.6.

## 0.16.8 — Shorts Thumb Geometry Fix

- Mirrored the old Shorts thumb-down geometry vertically to make the custom thumb-up match YouTube's heavier/wider icon style.
- Updated outline/filled geometry only.
- Kept Native, Twitch and Window Management unchanged.

## 0.16.9 — Global Anarchy Settings

- Moved Anarchy controls into General with order `Display → Anarchy → Twitch`.
- Made Playback Anarchy and DVD Anarchy global across YouTube, Netflix, Prime, Disney+ and Crunchyroll.
- Made Subtitle Anarchy global across YouTube, Netflix, Prime and Disney+, excluding Crunchyroll.
- Kept Safe Mode provider-local so it can suppress Anarchy on one provider.
- Stopped reading old provider-specific Anarchy keys.
- Also corrected the Shorts thumb orientation with the final 180° treatment.

## 0.16.10 — YouTube RYD Hydration / Performance Fix

- Added a short invisible YouTube `#columns` viewport warmup for new `/watch` videos so Return YouTube Dislike can hydrate in Windowed Fullscreen.
- Checked after roughly 1.8 seconds and parked the warmed metadata column offscreen by about five seconds.
- Kept the actual RYD parser unchanged.
- Throttled the translated-audio survey scan to at most once per ~1.2 seconds and removed the full-DOM fallback.
- Restricted Shorts thumb cleanup/synchronization to Shorts instead of doing work on normal `/watch` pages.
- Kept Native/Twitch/window management byte-identical to 0.16.9.

## 0.17.0 — YouTube Runtime Refactor

- Removed the global YouTube `MutationObserver` over `document.documentElement`.
- Replaced it with small targeted observers for popup, player, guide and active Shorts like state.
- Reworked SPA navigation around bounded settle passes instead of rerunning broad feature scans after arbitrary DOM mutations.
- Made the Resource Governor park YouTube DOM work while hidden/paused.
- Cached Upload Date targets and bounded expensive inline-script fallback work per video.
- Cached `More from YouTube` cleanup targets and split translated-audio survey handling from Continue Watching.
- Scoped Shorts thumb observation to the actual active Like button.
- Added a fast active-video path for Shorts / `#movie_player` and reused it for Auto Like.
- Deferred subscribed-channel DOM reads until the actual Auto-Like threshold.
- Cached static Now Playing metadata for the same video while leaving playback/RYD dynamic.
- Bound Windowed-Fullscreen pointermove only while Windowed mode is active and made Quality retries generation-aware.
- Preserved the 0.16.10 RYD hydration behavior during this release.

**Recovered SHA-256:** `886993a36d86338a2496279ff451959fd2ea1e7180036be3d9fe5f63fbbb9c86`

## 0.17.1 — Provider-Wide Performance Audit

- Reduced the global bootstrap marker observer to the root attributes it actually protects.
- Made Twitch's observer trigger heavy Bonus/Drops/Raid scans only for relevant DOM changes, retaining a fallback.
- Coalesced Netflix and Prime mutation-triggered work.
- Throttled Netflix's expensive semantic button scan and `document.body.innerText` title fallback.
- Optimized the generic video lookup to return a single `<video>` directly before doing geometry scans.
- Changed Dashboard clock updates to minute granularity and parked Now Playing progress work while hidden.
- Paused Landing native-Discord polling while Landing is hidden and performed an immediate catch-up on return.
- Kept the freshly refactored 0.17.0 YouTube source unchanged.

**Recovered SHA-256:** `a20c0917bdf59110c973743d5f046b632a1412dd7362b0bc3caa329ebefff0cb`

## 0.17.2 — RYD Recovery Window

- Added a bounded ~15-second recovery window for missing RYD ratio after YouTube video navigation.
- Used targeted checkpoints/layout geometry rather than a permanent global observer.
- Limited recovery to at most three attempts per video and stopped immediately when the ratio becomes available.
- Allowed Now Playing polling to trigger the bounded recovery path when appropriate.

**Recovered SHA-256:** `9fd4544835b8f4c5e2e60a682b9d6c1c24c6a9d6864a7d115527020016e6c98a`

## 0.17.3 — Invisible Theater Pulse

- Added an invisible roughly 2.6-second YouTube Theater-mode pulse when RYD is missing in Windowed Fullscreen.
- Kept the visible player fullscreen while temporarily letting the metadata/action column lay out enough for RYD.
- Limited the pulse to at most three attempts per video and only while the ratio is missing.

**Recovered SHA-256:** `676634c3ab464dead7ea917036b58ce10623900d4b668326fd06798a92a221ed`

## 0.17.4 — RYD Recovery Rollback

- Returned to the 0.17.1 baseline and removed the RYD hydration-prime / 0.17.2 / 0.17.3 recovery experiments.
- Restored the Windowed/RYD path to the simpler 0.16.9-style behavior.

**Recovered SHA-256:** `bf40959ef52980565a4da35f991a802f0e69ab486cf3214408cb42fe50a463c7`

## 0.17.5 — RYD Windowed Layout Fix

- Found the real RYD blocker: `opacity: 0` on YouTube `#columns` prevented RYD from hydrating.
- Removed `opacity: 0` while keeping the metadata column parked at `left: -100000px` and non-interactive.
- Changed only YouTube Windowed CSS plus manifest version.

**Recovered SHA-256:** `d90322f640fa499f015cb5f0f6e76c60f4998fba6e7e342351b38b9a48687ae9`

## 0.17.6 — YouTube SPA Title Cache Fix

- Invalidated YouTube's cached static title/metadata on `yt-navigate-finish`.
- Fixed stale video titles after YouTube SPA navigation without requiring a reload.
- Rebuilt the Common runtime after the adapter fix.

**Recovered SHA-256:** `8b1603d1b6fa207d402c640a57f4e01f4a3c83f3086cfadea9b3d6f98db7f1e1`

## 0.17.7 — Watchlist Restore + Shorts Like Timing

- Fixed Watchlist panel/tab restoration so reopening Watchlist returns to the previously selected subview instead of jumping back to Official first.
- Improved delayed Shorts Heart→Thumb Up replacement by observing the active Shorts renderer instead of relying only on immediate page state.

**Recovered SHA-256:** `e03c8134d7ffe87de4a970d6822194229dfbe7e0a4fb4598e416ecc99d03719b`

## 0.17.8 — Late Shorts Discovery Fix

- Added a temporary discovery observer for cases where YouTube reaches Shorts late after Home/Watch navigation.
- Ensured the custom Shorts Like icon can attach when the active renderer appears after the initial navigation event.
- Rebuilt Common runtime and bumped manifest only around the Shorts icon path.

**Recovered SHA-256:** `d72e23fe8f85bc17e482d6ab2a4e695b74055df63f285e406a10e178bc44ff75`

## 0.17.9 — Robust Shorts Renderer Resolution

- Replaced the 0.17.8 late-discovery workaround with a shared active-renderer resolver.
- Fixed Shorts Like-icon detection after pause/resume and other DOM state changes.
- Reduced dependence on one-time navigation timing.

**Recovered SHA-256:** `99deb1e59b3e09d5f1af8526c45b14e39e86e6951a3c614713c21e9ea68bee15`

## 0.17.10 — Fullscreen Volume Booster Bridge

- Added a fullscreen bridge around the tabCapture-based Volume Booster.
- Suspended booster capture before native fullscreen transitions that would otherwise fail/conflict.
- Reattached the capture/audio chain after leaving fullscreen.
- Preserved the configured provider booster level across the transition.

**Recovered SHA-256:** `df25ccd58e0cf090bd83acf4f29b9b33efce113773328ae7c90455fe75e01f8b`

## 0.17.11 — Amazon Match-Origin Hotfix

- Fixed Opera/Chromium manifest validation for `match_origin_as_fallback` by widening the Amazon content-script match from `*://*.amazon.de/gp/video/*` to `*://*.amazon.de/*`.
- Changed only `manifest.json`.

**Recovered SHA-256:** `b4833ebf40ce74b2b91444a1cd1e32af4b704d0958fc1c1416ca1a37cd27846a`

## 0.17.12 — YouTube Playlist / Autoplay Title Tracking

- Stopped accepting/caching stale YouTube titles after playlist advance or autoplay.
- Accepted a title only when it can be tied to the current `v=` video ID through the player link or current `ytd-watch-flexy` state.
- Invalidated stale title state instead of carrying it into the next video.
- Fixed Continue Watching entries inheriting the previous video's title.
- Changed the YouTube Now Playing provider logic, rebuilt `common/shell.js` and bumped the manifest.

**Recovered SHA-256:** `35e5dc2e7c0e6331833323f153ee439c2a85b26cf68544739ca9980849434b14`

## 0.18.0 — Compact Performance and Fullscreen Pass

- Added a default-on YouTube Cleanup option for Playables.
- Made Compact true fullscreen hide the native Stream Shell titlebar/backdrop and restore it on exit.
- Moved the native titlebar protocol to v4.
- Reduced repeated Compact native reconciliation / Alt+Tab presentation work while retaining foreground safety checks.
- Parallelized independent Compact Home media-helper loading.
- Created the remembered warm provider minimized and below the virtual desktop so it no longer flashes maximized during startup.

**Native helper:** Reinstall the native titlebar helper (protocol v4).

**Recovered SHA-256:** `ebc13ff477fd81c11bb11f864789559804a01a1b460f97e3c01d5ef1de9a8ca5`

## 0.18.1 — 16:9 Compact Target

- Added 16:9 as a first-class Compact display target without introducing a third UI/runtime mode.
- Kept the same Compact single-surface layout/titlebar behavior used by 16:10.
- Set Auto target priority to `32:9 → 16:9 → 16:10`.
- Made forced Compact choose 16:9 ahead of 16:10 when both are available.
- Extended Diagnostics to identify `compact-16:9`, `compact-16:10` and `wide-32:9` targets.

## 0.18.2 — 16:9 Layout Polish + Visible-Work-Area Titlebar Clamp

- Widened/tallened 16:9 provider buttons and increased provider/button typography.
- Kept the larger gap between the provider stack and the Watchlist/Search media area.
- Scaled the media section to continue ending at the Crunchyroll row.
- Increased the provider wordmark while keeping the Stream Shell brand initially unchanged.
- Clamped native Compact titlebar geometry to the actually visible work area so maximized Chromium invisible resize borders no longer cut the titlebar edge.

**Native helper:** Reinstall the native titlebar helper.

## 0.18.3 — 16:9 Fill + Compact Occlusion Behavior

- Used more of the 16:9 viewport with larger outer gutters, section spacing and taller primary/subscription areas.
- Increased the Stream Shell brand size so it balances the provider wordmark.
- Increased Watchlist/Search/media-panel typography including the empty-state message.
- Fixed `Subscriptions` / `Updated` header clipping after the typography increase.
- Changed Compact 16:9 and 16:10 titlebar behavior to match Wide: Alt-Tab no longer hides it solely because focus changed; it stays visible until another window actually occludes the titlebar band.

**Native helper:** Reinstall the native titlebar helper.

## 0.18.4 — Compact Edge Balance + Bottom-Space Pass

- Made the right outer gutter match the left gutter on both Compact 16:9 and 16:10.
- Expanded the 16:9 Subscriptions panel to use more of the lower viewport instead of leaving dead space.
- Increased internal subscription spacing and slightly rebalanced 16:9 outer/provider-media spacing.

## 0.18.5 — 16:9 Readability + Release-Notes Folder

- Increased 16:9 Watchlist/Search panel typography, tabs, sorting controls and availability subtitle text.
- Increased the Watchlist empty-state typography and media-item title size.
- Increased Subscriptions header/provider/status/date typography and provider icon size.
- Moved per-version release-note Markdown files under `release-notes/` instead of accumulating them in the repository root.

## 0.18.6 — 16:9 Subscription Refinement

- Further enlarged subscription provider icons and provider names.
- Increased ACTIVE / ENDING / UNKNOWN status capsule height/padding to fit the larger labels comfortably.
- Increased renewal-date / source typography.
- Replaced the inherited provider dividers with dedicated vertically centered separators that remain aligned with the taller subscription rows.


## 0.18.7 — YouTube Compact Titlebar / Focus Repair

- Normalized Compact YouTube titlebar sizing to the same 34-logical-pixel Opera caption baseline used by the other providers.
- Compensated YouTube's fixed masthead/page layout for the native helper's 8-logical-pixel caption overhang.
- Ignored transient unclaimed Opera helper/tool HWNDs during YouTube Compact occlusion checks while preserving real normal-Opera and foreign-window occlusion behavior.
- Added a YouTube-only second fullscreen-state confirmation after cross-window focus changes.
- Fixed Compact 16:9 subscription row sizing and removed the Compact-only Now Playing/minimized-provider snapshot path.
- Kept Compact true-fullscreen chrome suppressed across focus loss and reconciled stale fullscreen state against the live provider document.

**Native helper:** Reinstall `native/install-titlebar-helper.cmd` after updating.

## 0.18.8 — Display-Target Settings + Compact Occlusion Fix

- Added independent 32:9, 16:9 and 16:10 values for Windowed Fullscreen behavior.
- Added target-specific YouTube Fullscreen Quick Actions plus YouTube/Crunchyroll double-click Windowed Fullscreen preferences.
- Kept unrelated provider settings shared rather than cloning the entire Settings model per display target.
- Switched Compact monitor-edge occlusion checks to DWM visible frame bounds so Chromium's invisible maximized resize frame no longer hides unobstructed titlebar chrome when focus moves to an adjacent monitor.

**Native helper:** Reinstall `native/install-titlebar-helper.cmd` if updating from a build that predates the Compact monitor-edge occlusion fix.
