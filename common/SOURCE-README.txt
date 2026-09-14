Stream Shell common content-script source layout
===============================================

Runtime rule
------------
Opera loads common/shell.js only. Do not add the files in common/src to manifest.json.

Development rule
----------------
Edit the feature files in common/src, then run build-shell.ps1. The script concatenates the source files byte-for-byte in the required order and writes shell.js.

This deliberately avoids ES modules, extra content-script entries, bundlers and declaration/hoisting changes in the runtime.

Source order
------------
- bootstrap-state.js                  provider definitions and managed-window bootstrap helpers
- ../shared/resume-utils.js           shared provider resume URL canonicalization, stable media identity + deterministic stale-link reconstruction (also used by background)
- now-playing-base.js                 provider detection and generic title helpers
- now-playing-netflix.js              Netflix title extraction/cleanup
- now-playing-playback.js             video selection and playback snapshot
- now-playing-providers.js            watch-context/provider metadata and artwork extraction
- provider-api-core.js                provider adapter contract, registry, capabilities and generic playback primitives
- provider-safe-mode.js               per-provider isolation state and restoration of provider DOM/UI features
- provider-resource-governor.js       adaptive pacing for Stream Shell loops/observers based on provider/window/playback state
- provider-api-self-test.js           Provider API contract validation and lazy self-test reporting
- provider-api-resume.js              Continue Watching persistence and provider-specific pending resume orchestration
- provider-api-start.js               Provider API event wiring and startup hooks
- now-playing-tracker.js              now-playing publication/storage lifecycle
- windowed-player-core.js             shared windowed-player state, keys and root markers
- windowed-player-youtube.js          YouTube theater mode, masthead behavior and Extras marker
- windowed-player-crunchyroll.js      Crunchyroll SPA route watcher for persisted windowed mode
- windowed-player-sync.js             generic root-marker sync plus YouTube activation side effects
- playback-utilities-core.js          playback/subtitle defaults and common normalization helpers
- playback-anarchy.js                 playback, subtitle and DVD Anarchy state/timers/overlay
- playback-utilities.js               subtitle marker sync, efficient configured-rate sync, gestures, sleep-timer hooks and utility startup
- provider-adapter-disney.js          Disney+ Provider API implementation, title/watch-route and subtitle marker state
- netflix-enhancements.js             Netflix skip/next/still-watching automation
- provider-adapter-netflix.js         Netflix Provider API implementation + MAIN-world bridge client
- crunchyroll-enhancements.js         Crunchyroll settings/lifecycle layer delegating provider-specific behavior
- provider-adapter-crunchyroll.js     Crunchyroll Provider API implementation, windowed mode, skip events and diagnostics
- prime-enhancements.js               Prime settings/scheduling layer; DOM work delegates to the adapter
- provider-adapter-prime.js           Prime Provider API implementation, UI markers, subtitles and skip controls
- youtube-utilities-base.js           YouTube settings, theme, cleanup/autoplay and player discovery
- youtube-quality.js                  preferred-quality application/scheduling
- youtube-upload-date.js              upload-date extraction, formatting and rendering
- youtube-auto-like.js                Auto Like state and execution
- youtube-shorts-like-icon.js         Shorts-only visual Like icon swap (heart -> rotated old/native thumb-down geometry; YouTube retains state/click/count ownership)
- youtube-loop-keep-playing.js        loop override, Keep Playing and provider DOM scheduling/navigation
- youtube-utilities-start.js          YouTube utility storage/bootstrap listeners
- provider-adapter-youtube.js         YouTube Provider API implementation and provider-specific runtime contract
- provider-repair.js                  targeted in-page repair actions and repair recommendation state
- provider-diagnostics.js             privacy-conscious provider/player health snapshots for Dashboard diagnostics
- windowed-player-start.js            windowed-player storage/bootstrap and navigation listeners
- start.js                            managed-window startup entry point

Notes
-----
0.12.0 removed the dead pre-split common/src/provider-api.js copy and split the two largest mixed-responsibility sources (playback utilities and YouTube utilities) into focused chunks. Runtime remains one common/shell.js bundle.

Crunchyroll no longer performs player-host discovery or retry polling: its CSS is scoped directly by the root windowed-player marker, so only SPA route changes need a watcher.

Resume URL canonicalization and media identity are intentionally shared with the service worker through shared/resume-utils.js so Continue Watching cannot drift between write-side and open-side logic. The completion threshold is persisted in local storage and loaded before provider tracking starts. Stale-link reconstruction uses the dedicated adapter first; the shared resolver is only the service-worker fallback when a provider content script is not ready yet.
