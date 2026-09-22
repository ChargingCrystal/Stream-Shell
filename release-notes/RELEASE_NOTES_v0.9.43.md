# Stream Shell 0.9.43

## Grouping Fix

- Restored taskbar grouping to the known-good 0.9.40 model.
- Removed RelaunchCommand/DisplayName manipulation from live Opera HWNDs.
- Kept inactive providers minimized but hid their legacy gray desktop minimize boxes.
- Kept the left Stream Shell titlebar visible when foreign windows only occupy the right half.
- Created a real Start-menu Stream Shell shortcut with the Stream Shell AppUserModelID/icon.
- When Stream Shell is already running, the launcher signals the native host directly instead of creating a temporary Opera tab; cold start retains the internal fallback.

**Native helper:** Reinstall the native titlebar helper.

_Recovered from the original Stream Shell development chats / release messages._
