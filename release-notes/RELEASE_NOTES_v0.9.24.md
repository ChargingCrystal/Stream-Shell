# Stream Shell 0.9.24

## Titlebar Process-Family Fix

- Changed foreground matching from strict process-ID identity to the Opera/Discord process family plus expected geometry.
- Reduced false negatives caused by Chromium spawning/activating sibling processes or windows.
- Required a full helper restart after install so the new native logic actually took effect.

_Recovered from the original Stream Shell development chats / release messages._
