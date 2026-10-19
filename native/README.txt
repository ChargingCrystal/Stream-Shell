STREAM SHELL - DISCORD DESKTOP BRIDGE (v0.20.0)
================================================

The Discord Native Messaging helper is SEPARATE from the Stream Shell native
titlebar helper. It manages the stable desktop Discord window on the right
side of the Wide shell, without relaunching it for each Dashboard switch.
Discord PTB, Canary and Vesktop are not supported by this helper.

Install
-------
1. Load the unpacked Stream Shell extension in Opera GX.
2. Run native\install-discord-helper.ps1 (admin permission may be requested).
3. If the installer cannot find the extension ID, copy it from
   opera://extensions when prompted.
4. Reload the Stream Shell extension.

Uninstall: native\uninstall-discord-helper.ps1

The helper discovers stable Discord under %LOCALAPPDATA%\Discord\app-*\Discord.exe.
It shows/restores Discord on Wide's right pane. Switching to Dashboard hides
Discord without terminating it, avoiding Electron minimize-to-tray problems.
The native titlebar has its own installer (native\install-titlebar-helper.cmd).

Historical change notes (old versions; current behavior described above)
-----------------------------------------------------------------------
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
