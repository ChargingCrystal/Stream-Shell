# Stream Shell 0.22.4 — Twitch recovery bounds

Author: Sven Rieseler

Apply over 0.22.3. Extract into the existing Stream Shell folder, overwrite,
reload the extension in opera:extensions, then restart Opera GX completely
so existing Twitch pages receive the new content scripts. No native host
reinstallation required; native diagnostics remain at 0.22.3.

- Only one outstanding automatic play() request per Twitch document.
- At most three recovery attempts until actual playback (playing event).
- Stop recovery on ended, emptied, error and a Raid Guard opt-out click.
- Prevent overlapping Marbles autojoin submissions.
- Expose recovery attempt/pending/stop state in existing Twitch diagnostics.

The 13:51 local-time incident again shows delayed native heartbeats (up to
20.859 s), while native UI samples remain responsive. The browser main thread
is at ntdll.dll+0xa0f04 in the new dump, unlike the previous capture. Neither
the logs nor these stack snapshots establish a Twitch stream-end/raid cause.
These changes fix verified retry/concurrency gaps, not a proven browser root
cause. Hourly stream refresh behavior is unchanged.

Validation: targeted Node VM tests cover unresolved play promises, retry cap,
media terminal events, raid opt-out, actual playback recovery and overlapping
Marbles submissions. Actual Opera/Windows behavior has not been reproduced here.
