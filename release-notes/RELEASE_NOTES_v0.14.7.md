# Stream Shell 0.14.7

## Shared Grouping Path

- Removed clock/date from Compact again.
- Removed the separate Compact-only Alt+Tab/owner implementation and returned Wide/Compact to one shared ownership path with profile-specific anchors.
- Stopped reparenting the titlebar on every provider switch.
- Used the Segoe UI Symbol `↻` Reload treatment.
- Used TOPMOST for Compact titlebar visibility in this iteration.

> Historical note: The TOPMOST choice fixed self-occlusion but made Compact chrome stick over unrelated apps; 0.14.8/0.14.9 explored alternatives.

_Recovered from the original Stream Shell development chats / release messages._
