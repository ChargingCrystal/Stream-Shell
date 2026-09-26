# Changelog

## Unreleased

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
