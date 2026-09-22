# Stream Shell 0.9.39

## Dashboard Chrome Exposure Fix

- Decoupled right-side Dashboard chrome visibility from the left shell `visibilityMode`.
- Kept Dashboard chrome visible when the left side changes or normal Opera is used there.
- Added real foreign-window overlap checks for the right titlebar zone.
- Hid Dashboard chrome only when another window actually covers the right caption area, then restored it automatically.
- Left 0.9.38 taskbar grouping, navigation alignment and provider colors unchanged.

**Native helper:** Reinstall the native titlebar helper.

_Recovered from the original Stream Shell development chats / release messages._
