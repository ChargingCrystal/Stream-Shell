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

// Original v0.20.12 source: lines 4523-5113.
internal static partial class StreamShellTitlebarHost
{
    private static void SyncAltTabIntegration(
        string currentVisibility,
        TargetInfo leftTarget,
        TargetInfo rightTarget,
        string currentRightMode,
        PaneBounds leftPaneBounds,
        PaneBounds rightPaneBounds
    )
    {
        /*
         * Both layouts share the same owner-graph machinery, but their
         * representatives differ: Wide keeps Landing stable, while Compact
         * follows the explicitly claimed current Dashboard/provider surface.
         */
        bool compactLayout =
            String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        string profileKey = compactLayout ? "compact" : "wide";
        string mode;
        lock (StateLock) { mode = leftMode; }

        if (!String.Equals(altTabLayoutProfile, profileKey, StringComparison.OrdinalIgnoreCase))
        {
            ResetAltTabOwnership();
            altTabLayoutProfile = profileKey;
        }

        /*
         * Compact follows the intended visible surface. Dashboard is only the
         * Home surface, never a permanent task-switcher anchor. Once a provider
         * has been explicitly claimed, it becomes the representative while that
         * provider is leftMode; switching Home re-roots to Dashboard.
         */
        if (compactLayout)
        {
            IntPtr desiredRepresentative = GetCompactSurfaceHandle(mode);
            if (desiredRepresentative != IntPtr.Zero &&
                IsWindow(desiredRepresentative) &&
                desiredRepresentative != altTabRepresentative)
            {
                if (altTabRepresentative != IntPtr.Zero && IsWindow(altTabRepresentative))
                {
                    RegisterAltTabManagedWindow(altTabRepresentative);
                }

                RegisterAltTabManagedWindow(desiredRepresentative);
                SetAltTabOwner(desiredRepresentative, IntPtr.Zero);
                altTabRepresentative = desiredRepresentative;
                altTabLastMode = null;

                LogDiagnostic(
                    "compact alt-tab representative mode=" + mode +
                    " hwnd=0x" + desiredRepresentative.ToInt64().ToString("X")
                );
            }
        }

        if (altTabRepresentative == IntPtr.Zero || !IsWindow(altTabRepresentative))
        {
            bool shellContext =
                String.Equals(currentVisibility, "shell", StringComparison.OrdinalIgnoreCase) ||
                (!compactLayout && String.Equals(currentVisibility, "discord", StringComparison.OrdinalIgnoreCase));

            if (!shellContext)
            {
                return;
            }

            IntPtr candidate = compactLayout
                ? GetCompactSurfaceHandle(mode)
                : GetWideSurfaceHandle("left", "landing");

            if (!compactLayout && candidate == IntPtr.Zero && leftTarget != null)
            {
                candidate = leftTarget.Handle;
            }

            if (candidate == IntPtr.Zero || !IsWindow(candidate))
            {
                return;
            }

            RegisterAltTabManagedWindow(candidate);
            SetAltTabOwner(candidate, IntPtr.Zero);
            altTabRepresentative = candidate;
            altTabLastMode = null;

            LogDiagnostic(
                (compactLayout ? "compact" : "wide") +
                " alt-tab anchor=0x" + candidate.ToInt64().ToString("X") +
                " visibility=" + (currentVisibility ?? "none")
            );
        }

        IntPtr representative = altTabRepresentative;
        if (representative == IntPtr.Zero || !IsWindow(representative))
        {
            return;
        }

        // TaskbarShellWindows contains only Opera HWNDs proven by the
        // extension/native foreground handshake to belong to Stream Shell.
        List<IntPtr> shellWindows;
        lock (TaskbarShellWindows)
        {
            shellWindows = new List<IntPtr>(TaskbarShellWindows);
        }

        foreach (IntPtr hWnd in shellWindows)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                continue;
            }
            RegisterAltTabManagedWindow(hWnd);
        }

        // Discord is a Wide-only companion surface. Compact deliberately has
        // no Discord titlebar action and therefore never adopts its HWND.
        if (!compactLayout &&
            String.Equals(currentRightMode, "discord", StringComparison.OrdinalIgnoreCase))
        {
            TargetInfo discordTarget = FindPaneTarget(rightPaneBounds, true);
            if (discordTarget != null && discordTarget.Handle != IntPtr.Zero)
            {
                RegisterAltTabManagedWindow(discordTarget.Handle);
            }
        }

        List<IntPtr> managed;
        lock (AltTabManagedWindows)
        {
            managed = new List<IntPtr>(AltTabManagedWindows);
        }

        IntPtr persistentTwitchUtility = compactLayout
            ? IntPtr.Zero
            : GetWideSurfaceHandle("right", "twitch");

        foreach (IntPtr hWnd in managed)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                lock (AltTabManagedWindows)
                {
                    AltTabManagedWindows.Remove(hWnd);
                }
                continue;
            }

            if (hWnd == representative)
            {
                SetAltTabOwner(hWnd, IntPtr.Zero);
            }
            else
            {
                SetAltTabOwner(hWnd, representative);

                /* Twitch is an auxiliary keep-alive surface. The extension
                 * owns the user setting that may explicitly minimize it; native
                 * reconciliation must never park a proven Twitch HWND merely
                 * because Dashboard/Discord is currently in front. */
                if (hWnd != persistentTwitchUtility && !IsWideTwitchSurfaceHandle(hWnd))
                {
                    ParkMinimizedManagedOperaWindow(hWnd);
                }
            }
        }

        // Chromium can rewrite the caption/icon after navigation, but forcing
        // SetWindowText + WM_SETICON every 500 ms is needlessly expensive on
        // Compact. Reassert immediately when representative/mode changes and
        // keep a slow audit for Chromium drift afterwards.
        int presentationTick = Environment.TickCount;
        uint presentationAge = unchecked((uint)(presentationTick - altTabLastPresentationTick));
        bool presentationChanged =
            representative != altTabLastPresentationHandle ||
            !String.Equals(altTabLastMode, mode, StringComparison.OrdinalIgnoreCase);

        if (presentationChanged || presentationAge >= 5000)
        {
            ApplyAltTabPresentation(representative, mode);
            altTabLastPresentationHandle = representative;
            altTabLastPresentationTick = presentationTick;
        }
        altTabLastMode = mode;
    }


    private static void SuspendAltTabOwnershipForSpanningFullscreen()
    {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground))
        {
            return;
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        IntPtr fullscreenWindow = root != IntPtr.Zero ? root : foreground;
        if (!IsExplicitShellSurfaceHandle(fullscreenWindow))
        {
            return;
        }

        RegisterAltTabManagedWindow(fullscreenWindow);

        /*
         * Wide normally collapses all shell windows under Landing. True browser
         * fullscreen is the one state where that owner graph is counterproductive:
         * Windows may reorder sibling/owner surfaces during Chromium's fullscreen
         * style transition and place Landing/Dashboard above the video. Temporarily
         * detach only the fullscreen provider. The normal reconcile pass restores
         * its Landing owner automatically as soon as the window leaves fullscreen.
         */
        SetAltTabOwner(fullscreenWindow, IntPtr.Zero);
        SetWindowPos(
            fullscreenWindow,
            HWND_TOP,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
    }


    private static void ResetAltTabOwnership()
    {
        List<IntPtr> managed;
        lock (AltTabManagedWindows)
        {
            if (AltTabManagedWindows.Count == 0 && altTabRepresentative == IntPtr.Zero)
            {
                return;
            }
            managed = new List<IntPtr>(AltTabManagedWindows);
        }

        foreach (IntPtr hWnd in managed)
        {
            RestoreAltTabWindow(hWnd);
        }

        if (altTabRepresentative != IntPtr.Zero)
        {
            RestoreAltTabWindow(altTabRepresentative);
        }

        altTabRepresentative = IntPtr.Zero;
        altTabLastMode = null;
        altTabLastPresentationHandle = IntPtr.Zero;
    }


    private static IntPtr FindLandingAltTabAnchor(PaneBounds pane)
    {
        IntPtr found = IntPtr.Zero;

        try
        {
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
            {
                if (found != IntPtr.Zero || hWnd == IntPtr.Zero || !IsWindow(hWnd) ||
                    !IsWindowVisible(hWnd) || IsIconic(hWnd))
                {
                    return found == IntPtr.Zero;
                }

                if (!IsOperaProcess(GetProcessName(hWnd)))
                {
                    return true;
                }

                RECT rect;
                if (!GetWindowRect(hWnd, out rect))
                {
                    return true;
                }

                double geometryScore;
                if (!TryGetPaneGeometryScore(hWnd, rect, pane, out geometryScore))
                {
                    return true;
                }

                string title = GetWindowTitle(hWnd);
                if (!String.IsNullOrWhiteSpace(title) &&
                    title.StartsWith("Stream Shell", StringComparison.OrdinalIgnoreCase))
                {
                    found = hWnd;
                    return false;
                }

                return true;
            }, IntPtr.Zero);
        }
        catch { }

        return found;
    }

    private static void RegisterAltTabManagedWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        bool isNew;
        lock (AltTabManagedWindows)
        {
            isNew = AltTabManagedWindows.Add(hWnd);
        }

        if (!isNew)
        {
            return;
        }

        lock (OriginalAltTabOwners)
        {
            if (!OriginalAltTabOwners.ContainsKey(hWnd))
            {
                OriginalAltTabOwners[hWnd] = GetWindow(hWnd, GW_OWNER);
            }
        }

        RememberAltTabPresentation(hWnd);

        LogDiagnostic(
            "alt-tab managed hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " owner=0x" + GetWindow(hWnd, GW_OWNER).ToInt64().ToString("X") +
            " process=" + GetProcessName(hWnd)
        );
    }

    private static void ParkMinimizedManagedOperaWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd) || !IsIconic(hWnd))
        {
            return;
        }

        if (!IsOperaProcess(GetProcessName(hWnd)))
        {
            return;
        }

        int virtualLeft = GetSystemMetrics(SM_XVIRTUALSCREEN);
        int virtualTop = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int virtualHeight = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
        int virtualBottom = virtualTop + virtualHeight;

        RECT rect;
        if (GetWindowRect(hWnd, out rect) &&
            rect.Right < virtualLeft &&
            rect.Top > virtualBottom)
        {
            return;
        }

        // Owned minimized Chromium popups can surface as old-style grey
        // desktop icons. Keep their minimized HWNDs alive for the existing
        // provider restore flow, but park only that iconic representation
        // outside the virtual desktop. Provider restore always reapplies LEFT
        // bounds, so no provider lifecycle or Alt+Tab behaviour changes here.
        int parkedX = virtualLeft - 640;
        int parkedY = virtualBottom + 240;

        SetWindowPos(
            hWnd,
            IntPtr.Zero,
            parkedX,
            parkedY,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
    }

    private static void SetAltTabOwner(IntPtr hWnd, IntPtr owner)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd) || hWnd == owner)
        {
            return;
        }

        IntPtr current = GetWindow(hWnd, GW_OWNER);
        if (current == owner)
        {
            return;
        }

        SetOwner(hWnd, owner);
        IntPtr applied = GetWindow(hWnd, GW_OWNER);

        LogDiagnostic(
            "alt-tab owner hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " owner=0x" + applied.ToInt64().ToString("X")
        );
    }

    private static void RememberAltTabPresentation(IntPtr hWnd)
    {
        lock (OriginalAltTabPresentations)
        {
            if (OriginalAltTabPresentations.ContainsKey(hWnd))
            {
                return;
            }

            string title = GetWindowTitle(hWnd);
            IntPtr bigIcon = SendOperaWindowMessage(hWnd, WM_GETICON, new IntPtr(ICON_BIG), IntPtr.Zero);
            IntPtr smallIcon = SendOperaWindowMessage(hWnd, WM_GETICON, new IntPtr(ICON_SMALL2), IntPtr.Zero);
            if (smallIcon == IntPtr.Zero)
            {
                smallIcon = SendOperaWindowMessage(hWnd, WM_GETICON, new IntPtr(ICON_SMALL), IntPtr.Zero);
            }

            OriginalAltTabPresentations[hWnd] =
                new OriginalAltTabPresentation(title, bigIcon, smallIcon);
        }
    }

    private static string GetWindowTitle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return String.Empty;
        }

        int length = Math.Max(0, GetWindowTextLength(hWnd));
        StringBuilder buffer = new StringBuilder(Math.Max(2, length + 2));
        GetWindowText(hWnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static string GetAltTabTitle(string mode)
    {
        switch ((mode ?? String.Empty).ToLowerInvariant())
        {
            case "youtube": return "Stream Shell \u2014 YouTube";
            case "netflix": return "Stream Shell \u2014 Netflix";
            case "prime": return "Stream Shell \u2014 Prime Video";
            case "disney": return "Stream Shell \u2014 Disney+";
            case "crunchyroll": return "Stream Shell \u2014 Crunchyroll";
            default: return "Stream Shell";
        }
    }

    private static void ApplyAltTabPresentation(IntPtr hWnd, string mode)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        RememberAltTabPresentation(hWnd);

        string title = GetAltTabTitle(mode);
        try { SetOperaWindowCaption(hWnd, title); } catch (Exception ex) { LogNativeFailure("alt-tab-caption", ex); }

        Icon icon = null;
        if (!String.IsNullOrWhiteSpace(mode))
        {
            AltTabIcons.TryGetValue(mode, out icon);
        }
        if (icon == null)
        {
            AltTabIcons.TryGetValue("stream-shell", out icon);
        }

        if (icon != null)
        {
            try
            {
                SendOperaWindowMessage(hWnd, WM_SETICON, new IntPtr(ICON_BIG), icon.Handle);
                SendOperaWindowMessage(hWnd, WM_SETICON, new IntPtr(ICON_SMALL), icon.Handle);
            }
            catch { }
        }
    }

    private static void RestoreAltTabPresentation(IntPtr hWnd)
    {
        OriginalAltTabPresentation original;
        lock (OriginalAltTabPresentations)
        {
            if (!OriginalAltTabPresentations.TryGetValue(hWnd, out original))
            {
                return;
            }
        }

        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        try { SetOperaWindowCaption(hWnd, original.Title ?? String.Empty); } catch (Exception ex) { LogNativeFailure("alt-tab-caption-restore", ex); }
        try
        {
            SendOperaWindowMessage(hWnd, WM_SETICON, new IntPtr(ICON_BIG), original.BigIcon);
            SendOperaWindowMessage(hWnd, WM_SETICON, new IntPtr(ICON_SMALL), original.SmallIcon);
        }
        catch { }
    }

    private static void RestoreAltTabWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return;
        }

        RestoreAltTabPresentation(hWnd);

        IntPtr originalOwner = IntPtr.Zero;
        lock (OriginalAltTabOwners)
        {
            OriginalAltTabOwners.TryGetValue(hWnd, out originalOwner);
        }

        if (IsWindow(hWnd))
        {
            SetAltTabOwner(hWnd, originalOwner);
        }

        lock (AltTabManagedWindows)
        {
            AltTabManagedWindows.Remove(hWnd);
        }

        if (altTabRepresentative == hWnd)
        {
            altTabRepresentative = IntPtr.Zero;
            altTabLastMode = null;
        }
    }

    private static void DisposeAltTabIntegration()
    {
        List<IntPtr> windows;
        lock (AltTabManagedWindows)
        {
            windows = new List<IntPtr>(AltTabManagedWindows);
        }

        // Restore members first and the representative last. This avoids
        // temporarily leaving owned windows attached to a root whose native
        // presentation has already been dismantled.
        foreach (IntPtr hWnd in windows)
        {
            if (hWnd == altTabRepresentative)
            {
                continue;
            }
            RestoreAltTabWindow(hWnd);
        }

        if (altTabRepresentative != IntPtr.Zero)
        {
            RestoreAltTabWindow(altTabRepresentative);
        }

        foreach (Icon icon in AltTabIcons.Values)
        {
            try { icon.Dispose(); } catch { }
        }
        AltTabIcons.Clear();
        altTabLayoutProfile = null;

        lock (OriginalAltTabOwners)
        {
            OriginalAltTabOwners.Clear();
        }
        lock (OriginalAltTabPresentations)
        {
            OriginalAltTabPresentations.Clear();
        }
        lock (AltTabManagedWindows)
        {
            AltTabManagedWindows.Clear();
        }

        altTabRepresentative = IntPtr.Zero;
        altTabLastMode = null;
    }

}
