Stream Shell Native Titlebar Host
=================================

Purpose
-------
Optional Native Messaging host for the custom Stream Shell titlebar,
provider-aware taskbar/Alt+Tab identity and Stream Shell window grouping.
The Windows media player remains independent.

Install
-------
1. Double-click native\install-titlebar-helper.cmd.
2. Allow the administrator prompt.
3. Reload Stream Shell once in opera://extensions.

The extension itself remains the only Stream Shell launcher. There is no
Start-menu/taskbar launcher or pending-launch mechanism.

Diagnostics
-----------
Install: %LOCALAPPDATA%\StreamShell\TitlebarHost\install.log
Runtime: %LOCALAPPDATA%\StreamShell\TitlebarHost\titlebar.log

Uninstall
---------
Run native\uninstall-titlebar-helper.ps1.

The Discord native helper is separate and is not modified here.

0.10.44: A provider volume-booster button now sits between Landing and YouTube.
Its active tint mirrors the live tab-capture state. Clicking it again stops the
capture and returns the provider to normal tab audio. The helper bridges the
native titlebar click through Stream Shell's browser command so Chromium can
grant the active-tab/tab-capture permission required to start capture. The
registered command defaults to Ctrl+Shift+8 and the helper reads the currently
assigned shortcut from the extension at startup. If the command has been
unassigned or remapped, check opera://extensions/shortcuts. Re-run
install-titlebar-helper.cmd after updating because both the native host and its
icon assets changed.

0.13.2: Display-profile layouts can live on mixed-DPI laptop/dock monitors.
Re-run install-titlebar-helper.cmd after updating to 0.13.2; the native host now
matches panes relative to the target monitor/work area instead of comparing
Chromium logical coordinates directly with Win32 physical coordinates.

0.14.0 Compact toolbar
----------------------
Compact receives one full-width Stream Shell chrome target instead of Wide's left/right chrome pair. Its toolbar is Dashboard, Volume, Reload, providers, Settings, Discord and Kill; Landing and the duplicate Dashboard action are Wide-only. The extension sends layoutProfile with every native init/state update. Re-run install-titlebar-helper.cmd after upgrading because StreamShellTitlebarHost.cs changed.

0.14.1 Compact stability note
-----------------------------
Compact no longer reuses Wide's permanent-Landing Alt+Tab owner graph. Only one full-surface Opera shell window is visible at a time and the common Stream Shell taskbar identity provides grouping. This prevents identical Dashboard/provider HWND geometry from causing owner/z-order churn. Reinstall the titlebar helper after updating because StreamShellTitlebarHost.cs changed.


0.14.2 performance regression fix
---------------------------------
0.13.2 introduced monitor-relative HWND matching for mixed-DPI laptop/dock layouts, but the first implementation also moved process-name inspection ahead of geometry filtering and continued EnumWindows after a valid target to compute a best score. Because SyncOverlays runs on the native 500 ms timer, that turned titlebar discovery into a permanent desktop-wide hot path. 0.14.2 retains monitor-relative matching while restoring 0.13.1 discovery semantics: cheap geometry first, process inspection only for plausible windows, and stop immediately on the first valid shell target.

0.14.3 Compact spacing / reload icon
------------------------------------
Compact uses the same physical UI rhythm as Wide on the 200%-scaled 2880x1800 laptop panel: Wide pixel measurements are halved in Compact logical CSS pixels. The Compact native Reload action now uses a dedicated reload.png icon matching the circular-arrow language of the existing Wide Dashboard Reload control instead of relying on a font glyph. Reinstall the titlebar helper after updating because the helper source/icon payload changed.

0.14.7
Compact and Wide intentionally share one owner/task-switcher graph and the same
visual overlay z-order model. Only the permanent home anchor differs: Landing
for Wide, Dashboard for Compact. Do not add provider-switch-specific ownership
changes to Compact.

0.14.8 Compact z-order hotfix
----------------------------
Compact keeps the shared Wide visibility/owner graph but never enters the Win32 TOPMOST band. Its passive backdrop and interactive toolbar are shown with HWND_NOTOPMOST, which places them at the top of the normal z-order while allowing unrelated applications to cover Stream Shell naturally. Wide keeps the established TOPMOST titlebar behavior unchanged. Re-run install-titlebar-helper.cmd after upgrading because StreamShellTitlebarHost.cs changed.

0.14.9 Compact z-order: titlebar backdrop/buttons use HWND_TOP (normal band) on show, never HWND_TOPMOST/HWND_NOTOPMOST. This keeps them above the active Stream Shell surface while allowing unrelated foreground windows to cover the complete shell.

0.14.10 Compact z-order lifecycle repair
-----------------------------------------
Compact no longer treats IsWindowVisible() as proof that the titlebar is actually above the active Opera surface. Provider/focus switches can raise an Opera HWND while the helper windows remain technically visible behind it. While Compact Stream Shell is the real Win32 foreground target, the helper now verifies the z-order relation and reasserts HWND_TOP only when the backdrop/buttons have fallen behind that exact shell HWND. The interactive button layer is also kept above the passive backdrop. When an unrelated application is foreground, Compact chrome is hidden instead of being reasserted. Wide retains its existing TOPMOST path unchanged.


0.14.11 Compact reload encoding fix
-----------------------------------
Compact Reload keeps the U+21BB circular-arrow glyph, but the C# source now expresses it as the ASCII-only escape \\u21BB instead of embedding the literal Unicode character. This prevents PowerShell/Add-Type or legacy Windows text decoding from turning the glyph into mojibake such as a-circumflex/dagger/guillemet characters. No titlebar lifecycle, z-order, grouping or Wide behavior changed. Re-run install-titlebar-helper.cmd after upgrading because StreamShellTitlebarHost.cs changed.

0.14.12 Compact foreground authority
------------------------------------
Compact now uses the same HWND_TOPMOST placement as Wide while its chrome is visible, but it deliberately does not reuse Wide's browser-focus eligibility rule. Once a Compact HWND has been identified as Stream Shell, the helper uses the real Win32 foreground HWND/root as the authority. This prevents a transient chrome.windows "none" from both hiding the toolbar and demoting the active Compact window out of the known shell set. When another application is foreground, Compact chrome is hidden and removed from TOPMOST immediately. Wide behavior is unchanged. Re-run install-titlebar-helper.cmd after upgrading because StreamShellTitlebarHost.cs changed.


0.14.13 helper compile fix
- Renamed the nested initial left-pane target variable to avoid shadowing SyncTaskbarIntegration's leftTarget parameter.
- Compact visibility/topmost behavior remains identical to 0.14.12.

0.14.14 installer fail-visible hardening
----------------------------------------
The titlebar installer now resolves/prompts for the extension ID before elevation and waits synchronously for the elevated PowerShell process. The original CMD window remains open throughout the install and pauses before closing on both success and failure. Any elevated exception is persisted in %LOCALAPPDATA%\StreamShell\TitlebarHost\install-error.txt and printed by the CMD on failure, so a post-ID compile/registry/UAC failure can no longer vanish with the console window. StreamShellTitlebarHost.cs behavior is unchanged from 0.14.13.


0.14.15 Compact explicit HWND ownership
---------------------------------------
Compact no longer uses geometry or generic Opera foreground state to discover
new Stream Shell HWNDs. The extension explicitly claims the managed
chrome.windows popup it has just focused. The claim must carry a non-empty
active-tab title fingerprint matching the native Opera caption, and the helper
requires the same native foreground HWND to remain stable before accepting it. Only claimed
Dashboard/provider HWNDs can receive Compact titlebar chrome.

The Compact Alt+Tab representative now follows leftMode. Dashboard is minimized while a provider is active and restored only for Home,
so it is not a permanent task-switcher owner. If Windows
unexpectedly surfaces Dashboard while a provider is still the intended Compact
surface, the extension restores that provider instead of changing leftMode to
Dashboard. Wide behavior is unchanged. Re-run install-titlebar-helper.cmd after
upgrading because StreamShellTitlebarHost.cs changed.

0.14.16 Compact newborn-window onboarding
-----------------------------------------
Fresh Compact Dashboard/provider popups can receive focus before Chromium has
published the first real tab title and before Explorer exposes a writable
window property store. The extension now retries the explicit title-matched
HWND claim on short bounded timers and active-tab title/load updates. The
native host acknowledges an accepted claim so those probes stop immediately,
and normal Opera focus cancels any pending Compact claim. If the first Stream
Shell AppUserModelID write fails on a newborn HWND, the helper retries that
specific already-claimed shell HWND for a bounded number of native sync passes.
No geometry or URL fallback was reintroduced; Wide behavior is unchanged.
Re-run install-titlebar-helper.cmd after upgrading because
StreamShellTitlebarHost.cs changed.

0.15.3 Titlebar trust / reconciliation hardening
------------------------------------------------
0.14.16 is the behavioral baseline. 0.15.3 hardens the native boundary without
adding a new visible Stream Shell feature. Both Compact and Wide browser HWNDs
now enter native trust only through an explicit extension claim containing the
layout profile, side/mode intent and a non-empty active-tab title fingerprint.
Wide pane geometry remains a validation aid for that explicit claim; geometry,
Opera process identity, browser focus and taskbar observation can no longer
promote an arbitrary Opera HWND into Stream Shell by themselves.

The native helper is authoritative for TOPMOST lifetime. Every 500 ms it
reconciles the real GetForegroundWindow()/GA_ROOT against the explicitly mapped
Stream Shell surfaces. Compact remains strict foreground-only. Wide additionally
tracks the real top-level Z order above the registered left shell HWND: unrelated
windows confined to the other 32:9 pane do not hide Stream Shell chrome, while
any foreign window that still sits above and meaningfully overlaps the left
titlebar band keeps the custom chrome hidden even after focus moves elsewhere.
Launching a fullscreen game or moving another app across the left shell pane is
therefore safe even if a Chromium focus message is lost or stale.

Extension/helper communication is protocol v3. A hello/hello-ack handshake is
required before init/state messages are accepted. The extension sends a 1.5 s
heartbeat/reconciliation pulse; native visibility fails closed after 6.5 s
without a compatible pulse. New and existing shell surfaces are re-announced
idempotently, and concurrent Wide left/right onboarding retries no longer
cancel each other. Taskbar AppUserModelID observation is repair-only; it is not
an HWND discovery path.

Native status diagnostics now expose protocol compatibility, heartbeat age,
browser vs native-effective visibility, foreground HWND details, Compact/Wide
surface-to-HWND maps and pending claim keys. Re-run install-titlebar-helper.cmd
after upgrading because StreamShellTitlebarHost.cs and the native protocol
changed.

0.15.6 Wide lifecycle repair / true fullscreen
-----------------------------------------------
A successful Wide HWND claim now remains authoritative for that exact living
Opera top-level window even while Chromium temporarily changes its bounds for
true fullscreen. Pane geometry still validates the initial explicit claim but
is no longer a continuing requirement that can make trusted chrome disappear
after a fullscreen/restore transition.

Claim renewals also verify the actual window AppUserModelID. If Chromium or
Explorer rewrites a claimed popup back to Opera identity later in its lifetime,
the helper repairs Stream Shell grouping and invalidates the cached DWM theme so
the next sync reapplies provider chrome. This is repair-only for already claimed
HWNDs and does not create a new discovery path.

While a trusted Wide provider truly spans both shell panes, the helper temporarily
detaches only that fullscreen HWND from Landing's Alt+Tab owner graph and raises
it within the normal z-order. Landing and Dashboard therefore cannot cover the
video during Chromium's fullscreen style transition. Normal ownership is
re-established automatically when fullscreen ends. Re-run
install-titlebar-helper.cmd after upgrading because StreamShellTitlebarHost.cs
changed.
