# Stream Shell 0.9.34

## Native Startup Fix

- Removed the blocking multi-second startup cleanup/sweep that delayed the native host.
- Separated AppUserModelID cleanup from the taskbar API so one unavailable COM path could not block the whole host.
- Kept ownership limited to known Stream Shell windows.

_Recovered from the original Stream Shell development chats / release messages._
