# Changelog

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
