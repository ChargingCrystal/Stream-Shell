# Stream Shell 0.15.6

## Native Lifecycle / Fullscreen Repair

- Added a periodic drift audit for native titlebar/Alt+Tab ownership (roughly every five seconds).
- Repaired cases where Stream Shell windows could become ungrouped or lose titlebar ownership over time.
- Temporarily removed a Wide fullscreen provider from the owner graph so true fullscreen can behave like a normal foreground window.
- Restored ownership after leaving fullscreen.
- Kept Compact, Netflix DOM and background code unchanged.

**Native helper:** Reinstall the native titlebar helper.

_Recovered from the original Stream Shell development chats / release messages._
