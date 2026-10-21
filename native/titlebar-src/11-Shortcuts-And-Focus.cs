using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

// Original v0.20.12 source: lines 5745-6028.
internal static partial class StreamShellTitlebarHost
{
    private static byte ShortcutKeyCode(string token)
    {
        if (String.IsNullOrWhiteSpace(token))
        {
            return 0;
        }

        string value = token.Trim().ToUpperInvariant();
        if (value.Length == 1)
        {
            char c = value[0];
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))
            {
                return (byte)c;
            }
        }

        switch (value)
        {
            case "SPACE": return 0x20;
            case "HOME": return 0x24;
            case "END": return 0x23;
            case "PAGEUP": return 0x21;
            case "PAGEDOWN": return 0x22;
            case "INSERT": return 0x2D;
            case "DELETE": return 0x2E;
            case "UP": return 0x26;
            case "DOWN": return 0x28;
            case "LEFT": return 0x25;
            case "RIGHT": return 0x27;
            case "COMMA": return 0xBC;
            case "PERIOD": return 0xBE;
        }

        return 0;
    }


    private static bool DispatchShortcut(string shortcut)
    {
        if (String.IsNullOrWhiteSpace(shortcut))
        {
            return false;
        }

        bool ctrl = false;
        bool shift = false;
        bool alt = false;
        byte key = 0;

        string[] parts = shortcut.Split('+');
        foreach (string part in parts)
        {
            string token = part.Trim();
            if (token.Equals("Ctrl", StringComparison.OrdinalIgnoreCase))
            {
                ctrl = true;
                continue;
            }
            if (token.Equals("Shift", StringComparison.OrdinalIgnoreCase))
            {
                shift = true;
                continue;
            }
            if (token.Equals("Alt", StringComparison.OrdinalIgnoreCase))
            {
                alt = true;
                continue;
            }

            key = ShortcutKeyCode(token);
        }

        if (key == 0 || (!ctrl && !alt))
        {
            return false;
        }

        if (ctrl) keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        if (alt) keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        if (shift) keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);

        keybd_event(key, 0, 0, UIntPtr.Zero);
        keybd_event(key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (shift) keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        if (alt) keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        if (ctrl) keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        return true;
    }


    private static void TriggerVolumeShortcut()
    {
        string mode;
        string shortcut;
        IntPtr target;

        lock (StateLock)
        {
            mode = leftMode;
            shortcut = volumeShortcut;
            target = leftOwner;
        }

        bool providerMode =
            mode == "youtube" ||
            mode == "netflix" ||
            mode == "prime" ||
            mode == "disney" ||
            mode == "crunchyroll";

        if (!providerMode)
        {
            LogDiagnostic("volume shortcut ignored outside provider mode");
            return;
        }

        if (String.IsNullOrWhiteSpace(shortcut))
        {
            LogDiagnostic("volume shortcut unavailable: extension command is unassigned");
            return;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            PaneBounds pane;
            lock (StateLock)
            {
                pane = new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
            }

            string profile;
            lock (StateLock) { profile = layoutProfile; }
            TargetInfo found = String.Equals(profile, "compact", StringComparison.OrdinalIgnoreCase)
                ? FindCompactSurfaceTarget(pane, mode)
                : FindWideSurfaceTarget(pane, "left", mode);
            target = found != null ? found.Handle : IntPtr.Zero;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            LogDiagnostic("volume shortcut failed: no provider target");
            return;
        }

        ShowWindow(target, SW_RESTORE);
        SetForegroundWindow(target);

        // Chromium grants activeTab/tabCapture only for explicit extension
        // invocations. The titlebar itself is native UI, so bridge its real
        // click through the extension command registered in the manifest.
        Thread.Sleep(55);
        bool dispatched = DispatchShortcut(shortcut);

        LogDiagnostic(
            "volume shortcut " + (dispatched ? "dispatched" : "invalid") +
            " for " + mode + " shortcut=" + shortcut
        );
    }


    private static void TriggerTwitchVolumeShortcut()
    {
        string mode;
        string shortcut;
        IntPtr target;

        lock (StateLock)
        {
            mode = rightMode;
            shortcut = volumeShortcut;
            target = rightOwner;
        }

        if (!String.Equals(mode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            LogDiagnostic("right volume shortcut ignored outside Twitch mode");
            return;
        }

        if (String.IsNullOrWhiteSpace(shortcut))
        {
            LogDiagnostic("right volume shortcut unavailable: extension command is unassigned");
            return;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            PaneBounds pane;
            lock (StateLock)
            {
                pane = new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height);
            }

            TargetInfo found = FindWideSurfaceTarget(pane, "right", "twitch");
            target = found != null ? found.Handle : IntPtr.Zero;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            LogDiagnostic("right volume shortcut failed: no Twitch target");
            return;
        }

        ShowWindow(target, SW_RESTORE);
        SetForegroundWindow(target);
        Thread.Sleep(55);
        bool dispatched = DispatchShortcut(shortcut);

        LogDiagnostic(
            "right volume shortcut " + (dispatched ? "dispatched" : "invalid") +
            " for twitch shortcut=" + shortcut
        );
    }


    private static void FocusRequestedPane()
    {
        string side;
        PaneBounds pane;

        lock (StateLock)
        {
            side = pendingFocusSide;
            pendingFocusSide = String.Empty;
            pane = String.Equals(side, "right", StringComparison.OrdinalIgnoreCase)
                ? new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height)
                : new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
        }

        if (!String.Equals(side, "left", StringComparison.OrdinalIgnoreCase) &&
            !String.Equals(side, "right", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        /*
         * A titlebar overlay uses WS_EX_NOACTIVATE. The browser extension can
         * restore a window after the click, but Windows may reject its focus
         * request because the browser process did not receive the user's
         * input. The native toolbar did receive that click, so perform the
         * final foreground hand-off here after the extension restored the pane.
         */
        string profile;
        string currentLeftMode;
        string currentRightMode;
        lock (StateLock)
        {
            profile = layoutProfile;
            currentLeftMode = leftMode;
            currentRightMode = rightMode;
        }

        bool compact = String.Equals(profile, "compact", StringComparison.OrdinalIgnoreCase);
        TargetInfo target;
        if (compact)
        {
            target = FindCompactSurfaceTarget(pane, currentLeftMode);
        }
        else if (String.Equals(side, "right", StringComparison.OrdinalIgnoreCase))
        {
            target = String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase)
                ? FindWideSurfaceTarget(pane, "right", "dashboard")
                : null;
        }
        else
        {
            target = FindWideSurfaceTarget(pane, "left", currentLeftMode);
        }

        if (target == null || target.Handle == IntPtr.Zero)
        {
            LogDiagnostic("focus " + side + ": no Opera target");
            return;
        }

        ShowWindow(target.Handle, SW_RESTORE);
        bool focused = SetForegroundWindow(target.Handle);
        LogDiagnostic("focus " + side + ": hwnd=0x" + target.Handle.ToInt64().ToString("X") + " ok=" + focused);
        PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
    }

}
