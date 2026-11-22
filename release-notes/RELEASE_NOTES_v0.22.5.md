# Stream Shell 0.22.5 — YouTube Music

Author: Sven Rieseler

Apply over 0.22.4. Reload the extension in opera:extensions, run
native/install-titlebar-helper.cmd to rebuild/install the updated native
button definitions, then fully restart Opera GX.

Settings > General > Providers: enable YouTube Music and select Dashboard
and/or Titlebar independently. Music is off by default, including upgrades.
Both YouTube and Music pinned: one dashboard card with two independent 60/40
click targets. The pair occupies YouTube's position and counts as one of seven
slots. Either alone gets a full card. The native titlebar uses separate presets.

Supply your artwork at these paths (no artwork bundled):
- assets/providers/icons/youtube-music.svg
- assets/providers/wordmarks/youtube-music.svg
- assets/backgrounds/youtube-music_wide.png
- assets/backgrounds/youtube-music_compact.png
- native/titlebar-icons/youtube-music.png

Missing artwork uses text/neutral surfaces. Re-run the native installer after
adding the native PNG. Reload the dashboard after adding dashboard assets.

Music opens https://music.youtube.com/ as a dedicated provider window.
YouTube video-only scripts are excluded from Music. A Music-specific playback,
metadata or cleanup adapter is not part of this navigation integration.
Twitch recovery and native hang diagnostics from 0.22.4 remain unchanged.

Validation: registry migration, paired and standalone dashboard controls,
provider grid layouts, native button protocol/artwork tests, JavaScript syntax.
Native Windows compilation and live Opera visual validation were not available
in this environment.
