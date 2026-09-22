# Stream Shell 0.17.2

## RYD Recovery Window

- Added a bounded ~15-second recovery window for missing RYD ratio after YouTube video navigation.
- Used targeted checkpoints/layout geometry rather than a permanent global observer.
- Limited recovery to at most three attempts per video and stopped immediately when the ratio becomes available.
- Allowed Now Playing polling to trigger the bounded recovery path when appropriate.

**Recovered SHA-256:** `9fd4544835b8f4c5e2e60a682b9d6c1c24c6a9d6864a7d115527020016e6c98a`

_Recovered from the original Stream Shell development chats / release messages._
