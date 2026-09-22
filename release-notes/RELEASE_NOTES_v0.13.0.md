# Stream Shell 0.13.0

## Display Profiles

- Added display-profile detection for `wide` and `compact`.
- Added the global Display override: Auto / Wide / Compact.
- Added Diagnostics schema v9 fields for detected/applied profile, target display bounds, work area, DPI and planned geometry.
- Kept 32:9 behavior unchanged while introducing detection for the 16:10 Compact path.
- When both laptop and docked ultrawide are present, the ultrawide target wins in Auto.
- This release was detection/planning only; it did not yet turn Compact into a true single-surface shell.

_Recovered from the original Stream Shell development chats / release messages._
