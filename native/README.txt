STREAM SHELL - DISCORD DESKTOP BRIDGE

Purpose
-------
The browser extension cannot directly move native Windows applications.
This small local Native Messaging host lets Stream Shell show/minimize the
stable Discord desktop client and place it on the right 1920x1080 half.

Discord executable resolution
-----------------------------
The helper resolves the stable Discord client dynamically from
%LOCALAPPDATA%\Discord\app-*\Discord.exe.

Only the stable Discord tree under %LOCALAPPDATA%\Discord is accepted.
Discord PTB, Discord Canary and Vesktop are deliberately ignored.

Install
-------
1. Load/reload Stream Shell in Opera.
2. Right-click install-discord-helper.ps1 and run it with PowerShell.
   The script requests elevation because Opera documents the Windows native
   messaging registration under HKLM.
3. The installer tries to detect the Stream Shell extension ID from Opera's
   Preferences. If that fails, copy the ID from opera://extensions when asked.
4. Reload Stream Shell once more.

Uninstall
---------
Run uninstall-discord-helper.ps1.

Behavior
--------
- Discord button inactive: neutral translucent glass.
- Discord button active: Discord blurple tint.
- Clicking Discord restores/reuses the stable Discord window and places it at
  X=1920, Y=0, W=1920, H=1080.
- Returning to Dashboard hides Discord without terminating it. This avoids Discord/Electron's minimize-to-tray transition and makes the next restore deterministic.


0.9.0 note:
The native helper also reports the foreground Windows window bounds so the Dashboard can tell whether the Landing page is actually covered by another application. Re-run install-discord-helper.ps1 after updating from 0.8.x to enable this exact external-window detection. Without the helper update, Stream Shell safely assumes Landing is covered whenever Opera loses focus.

0.9.7 note:
Discord/Electron can keep several auxiliary top-level windows alive while the
real client window is hidden in the tray. The helper now identifies the real
Discord browser window by title/class/size and ignores tiny utility HWNDs.
Re-run install-discord-helper.ps1 after updating to 0.9.7 because the native
host executable changed.


0.9.8 note:
The native host is now compiled as a windowless Windows application. Chromium
starts a fresh native host for sendNativeMessage calls, so the old console build
could briefly create/focus a helper window during show/status polling. Stream
Shell-initiated Dashboard switches now use SW_HIDE instead of SW_MINIMIZE so the
real Discord main HWND stays available for the next restore. Re-run
install-discord-helper.ps1 after updating to 0.9.8.

0.10.46:
The Discord helper now parks Discord's minimized HWND outside the virtual desktop, matching Stream Shell's provider-window behavior. Re-run install-discord-helper.ps1 after updating.

0.10.47:
- Prime Video Enhancer essentials moved into Stream Shell settings.
- Prime now includes X-Ray / dark-overlay cleanup, independent intro/recap/promo auto-skip, and subtitle size/color/font controls.
- Defaults mirror the previous local setup: X-Ray + dark overlay hidden, promo skip on, subtitles at 0.5x / white / Prime default font.
