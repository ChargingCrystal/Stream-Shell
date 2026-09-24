# Stream Shell 0.18.8

## Display-Target Settings + Compact Occlusion Fix

- Split Windowed Fullscreen behavior into independent 32:9, 16:9 and 16:10 target settings instead of sharing one value across all layouts.
- Added target-specific YouTube Fullscreen Quick Actions and YouTube/Crunchyroll double-click Windowed Fullscreen preferences.
- Kept unrelated provider settings shared so display targeting does not duplicate the entire Settings model.
- Fixed Compact titlebar occlusion checks at monitor edges by using DWM visible frame bounds instead of Chromium's invisible maximized resize frames.
- Focusing a window on an adjacent monitor now keeps unobstructed Compact Stream Shell chrome visible while true provider fullscreen remains suppressed.

**Native helper:** Reinstall `native/install-titlebar-helper.cmd` if updating from 0.18.7 before the Compact occlusion hotfix.
