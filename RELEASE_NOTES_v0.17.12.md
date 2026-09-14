# Stream Shell 0.17.12 — first public GitHub release

This is the first public repository/release snapshot of Stream Shell.

The extension is feature-complete for my current personal workflow, but it remains a best-effort personal project rather than a supported commercial product. It is primarily developed on Windows + Opera GX around a Wide/Compact streaming setup.

Recent work before this release focused heavily on YouTube runtime performance and correctness, including targeted observers instead of global DOM watching, Shorts lifecycle handling, RYD compatibility, Now Playing cache invalidation and playlist/autoplay title correctness. The Volume Booster also includes a fullscreen bridge for Chromium's tab-capture/fullscreen interaction.

### Installation

Load the repository/release folder unpacked from `opera://extensions` with Developer mode enabled.

Optional pieces:
- provide your own provider artwork under `assets/backgrounds/`;
- add a TMDB Read Access Token from Stream Shell for metadata/availability;
- install Return YouTube Dislike if you want the ratio integration;
- install the native Windows helpers only if you want titlebar/Discord desktop integration.

### License

Source-available for non-commercial use under PolyForm Noncommercial 1.0.0. Required copyright/original-author notices identify Sven Rieseler as the original author.
