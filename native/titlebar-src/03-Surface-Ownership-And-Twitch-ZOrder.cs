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

// Original v0.20.12 source: lines 2063-2672.
internal static partial class StreamShellTitlebarHost
{
    private static bool ShouldSuppressChromeForSpanningForeground(
        string currentVisibility,
        PaneBounds left,
        PaneBounds right
    )
    {
        // Chromium true-fullscreen expands the active provider HWND across the
        // complete 32:9 monitor. Stream Shell's custom titlebar overlays are
        // TOPMOST, so hide only those overlays while the provider spans both
        // panes. No taskbar identity, ownership or window style is modified.
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground) ||
            !IsWindowVisible(foreground) || IsIconic(foreground) ||
            !IsOperaProcess(GetProcessName(foreground)))
        {
            return false;
        }

        bool knownShellWindow;
        lock (TaskbarShellWindows)
        {
            knownShellWindow = TaskbarShellWindows.Contains(foreground);
        }
        if (!knownShellWindow)
        {
            lock (AltTabManagedWindows)
            {
                knownShellWindow = AltTabManagedWindows.Contains(foreground);
            }
        }

        if (!knownShellWindow &&
            !String.Equals(currentVisibility, "shell", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        RECT rect;
        if (!GetWindowRect(foreground, out rect))
        {
            return false;
        }

        int shellLeft = Math.Min(left.Left, right.Left);
        int shellTop = Math.Min(left.Top, right.Top);
        int shellRight = Math.Max(left.Left + left.Width, right.Left + right.Width);
        int shellBottom = Math.Max(left.Top + left.Height, right.Top + right.Height);
        int shellWidth = Math.Max(1, shellRight - shellLeft);
        int shellHeight = Math.Max(1, shellBottom - shellTop);
        int tolerance = Math.Max(4, Scale(8, GetTargetDpi(foreground)));

        int width = Math.Max(0, rect.Right - rect.Left);
        int height = Math.Max(0, rect.Bottom - rect.Top);

        return
            rect.Left <= shellLeft + tolerance &&
            rect.Top <= shellTop + tolerance &&
            rect.Right >= shellRight - tolerance &&
            rect.Bottom >= shellBottom - tolerance &&
            width >= shellWidth - (tolerance * 2) &&
            height >= shellHeight - (tolerance * 2);
    }


    private static bool ShouldSuppressChromeForCompactForeground(
        TargetInfo target,
        PaneBounds pane
    )
    {
        if (target == null || target.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(target) || !IsCompactForegroundTarget(target))
        {
            return false;
        }

        RECT rect;
        if (!GetWindowRect(target.Handle, out rect))
        {
            return false;
        }

        IntPtr monitor = MonitorFromWindow(target.Handle, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
        {
            return false;
        }

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info))
        {
            return false;
        }

        int tolerance = Math.Max(4, Scale(8, target.Dpi));
        bool fillsMonitor =
            rect.Left <= info.rcMonitor.Left + tolerance &&
            rect.Top <= info.rcMonitor.Top + tolerance &&
            rect.Right >= info.rcMonitor.Right - tolerance &&
            rect.Bottom >= info.rcMonitor.Bottom - tolerance;

        if (!fillsMonitor)
        {
            return false;
        }

        int paneRight = pane.Left + pane.Width;
        int paneBottom = pane.Top + pane.Height;

        // Normal Compact deliberately fills the work area. Treat geometry as
        // fullscreen only when Chromium expands beyond that normal surface into
        // the monitor area (typically over the taskbar). If work area == monitor,
        // the explicit Fullscreen API signal remains the authoritative path.
        return
            rect.Left < pane.Left - tolerance ||
            rect.Top < pane.Top - tolerance ||
            rect.Right > paneRight + tolerance ||
            rect.Bottom > paneBottom + tolerance;
    }


    private static bool IsWindowAboveInZOrder(IntPtr candidate, IntPtr target)
    {
        if (candidate == IntPtr.Zero || target == IntPtr.Zero || candidate == target ||
            !IsWindow(candidate) || !IsWindow(target))
        {
            return false;
        }

        IntPtr cursor = candidate;
        for (int guard = 0; guard < 512 && cursor != IntPtr.Zero; guard++)
        {
            cursor = GetWindow(cursor, GW_HWNDNEXT);
            if (cursor == target)
            {
                return true;
            }
        }

        return false;
    }

    private static string GetWideSurfaceKey(string side, string mode)
    {
        return (side ?? String.Empty).ToLowerInvariant() + "|" + (mode ?? String.Empty).ToLowerInvariant();
    }

    private static IntPtr GetCompactSurfaceHandle(string mode)
    {
        if (String.IsNullOrWhiteSpace(mode))
        {
            return IntPtr.Zero;
        }

        lock (StateLock)
        {
            IntPtr hWnd;
            if (!CompactSurfaceWindows.TryGetValue(mode, out hWnd))
            {
                return IntPtr.Zero;
            }

            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                CompactSurfaceWindows.Remove(mode);
                return IntPtr.Zero;
            }

            return hWnd;
        }
    }

    private static IntPtr GetWideSurfaceHandle(string side, string mode)
    {
        if (String.IsNullOrWhiteSpace(side) || String.IsNullOrWhiteSpace(mode))
        {
            return IntPtr.Zero;
        }

        string key = GetWideSurfaceKey(side, mode);
        lock (StateLock)
        {
            IntPtr hWnd;
            if (!WideSurfaceWindows.TryGetValue(key, out hWnd))
            {
                return IntPtr.Zero;
            }

            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                WideSurfaceWindows.Remove(key);
                return IntPtr.Zero;
            }

            return hWnd;
        }
    }

    private static IntPtr GetWideTwitchClusterHandle(string member)
    {
        if (String.IsNullOrWhiteSpace(member)) return IntPtr.Zero;
        lock (StateLock)
        {
            IntPtr hWnd;
            if (!WideTwitchClusterWindows.TryGetValue(member, out hWnd)) return IntPtr.Zero;
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                WideTwitchClusterWindows.Remove(member);
                WideTwitchClaimBrowserWindowIds.Remove(member);
                return IntPtr.Zero;
            }
            return hWnd;
        }
    }

    private static void RaiseWideTwitchClusterOnce(string selectedMember)
    {
        // HWND claims and focus/wake callbacks can arrive long after the user
        // switched the right pane back to Dashboard or Discord. Those events
        // may update the identity map, but must NEVER raise the Twitch cluster
        // above the surface currently selected in the right titlebar.
        lock (StateLock)
        {
            if (!String.Equals(layoutProfile, "wide", StringComparison.OrdinalIgnoreCase) ||
                !String.Equals(rightMode, "twitch", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        string selected = (selectedMember ?? String.Empty).Trim().ToLowerInvariant();

        string fullscreenMember;
        lock (StateLock)
        {
            fullscreenMember = twitchPaneFullscreenMember ?? String.Empty;
        }
        if (!String.IsNullOrWhiteSpace(fullscreenMember))
        {
            IntPtr fullscreenHandle = GetWideTwitchClusterHandle(fullscreenMember);
            if (fullscreenHandle != IntPtr.Zero && IsWindow(fullscreenHandle) && IsWindowVisible(fullscreenHandle) && !IsIconic(fullscreenHandle))
            {
                SetWindowPos(
                    fullscreenHandle,
                    HWND_TOP,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
                );
                return;
            }
            lock (StateLock)
            {
                if (String.Equals(twitchPaneFullscreenMember, fullscreenMember, StringComparison.OrdinalIgnoreCase))
                {
                    twitchPaneFullscreenMember = String.Empty;
                }
            }
        }

        /* C/D are born one stock-caption height underneath A/B. Always restore
         * lower members first and upper members second so A/B cover only that
         * overlap strip. SWP_NOACTIVATE keeps a clicked C/D window focused even
         * though its caption remains visually tucked behind the upper row. */
        List<string> order = new List<string>();

        if (String.Equals(selected, "c", StringComparison.OrdinalIgnoreCase))
        {
            order.Add("d");
            order.Add("c");
        }
        else if (String.Equals(selected, "d", StringComparison.OrdinalIgnoreCase))
        {
            order.Add("c");
            order.Add("d");
        }
        else
        {
            order.Add("c");
            order.Add("d");
        }

        if (String.Equals(selected, "a", StringComparison.OrdinalIgnoreCase))
        {
            order.Add("b");
            order.Add("a");
        }
        else if (String.Equals(selected, "b", StringComparison.OrdinalIgnoreCase))
        {
            order.Add("a");
            order.Add("b");
        }
        else
        {
            order.Add("a");
            order.Add("b");
        }

        order.Add("chat");

        foreach (string member in order)
        {
            IntPtr hWnd = GetWideTwitchClusterHandle(member);
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsIconic(hWnd)) continue;
            SetWindowPos(
                hWnd,
                HWND_TOP,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
            );
        }
    }

    /* Do not continuously shuffle all four Opera HWNDs. A narrow 1 Hz audit
     * repairs the two cases Windows can undo without any browser navigation:
     * Dashboard overtakes one Twitch member, or the bottom row overtakes the
     * top row along the shared caption overlap. Only do this while an already
     * claimed Stream Shell window owns foreground; never lift Twitch above an
     * unrelated app that the user deliberately brought forward. */
    private static void RepairWideTwitchClusterZOrder()
    {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero) return;
        IntPtr foregroundRoot = GetAncestor(foreground, GA_ROOT);
        if (foregroundRoot == IntPtr.Zero) foregroundRoot = foreground;
        if (!IsExplicitShellSurfaceHandle(foregroundRoot)) return;

        IntPtr dashboard = GetWideSurfaceHandle("right", "dashboard");
        IntPtr a = GetWideTwitchClusterHandle("a");
        IntPtr b = GetWideTwitchClusterHandle("b");
        IntPtr c = GetWideTwitchClusterHandle("c");
        IntPtr d = GetWideTwitchClusterHandle("d");
        IntPtr[] members = { a, b, c, d };
        bool repair = false;
        foreach (IntPtr member in members)
        {
            if (member == IntPtr.Zero || !IsWindowVisible(member) || IsIconic(member)) continue;
            if (dashboard != IntPtr.Zero && IsWindowVisible(dashboard) &&
                !IsIconic(dashboard) && IsWindowAboveInZOrder(dashboard, member))
            {
                repair = true;
                break;
            }
        }

        if (!repair)
        {
            // C/D overlap A/B by 20 px; their captions must remain underneath.
            repair = (a != IntPtr.Zero && c != IntPtr.Zero && IsWindowAboveInZOrder(c, a)) ||
                (b != IntPtr.Zero && d != IntPtr.Zero && IsWindowAboveInZOrder(d, b));
        }
        if (!repair) return;

        RaiseWideTwitchClusterOnce(String.Empty);
        LogDiagnostic("twitch cluster z-order repaired (dashboard/row drift)");
    }

    /* A LEFT provider focus can lift Chromium's existing owned Twitch popups
     * above the right Dashboard. Restore the explicitly selected right pane
     * only when extension navigation asks us to, and never steal foreground.
     * No 1 Hz Dashboard/Twitch tug-of-war (regression in 0.19.25). */
    private static void ReassertWideRightPaneOnce(string requestedMode)
    {
        if (!String.Equals(requestedMode, "dashboard", StringComparison.OrdinalIgnoreCase) &&
            !String.Equals(requestedMode, "twitch", StringComparison.OrdinalIgnoreCase))
            return;

        lock (StateLock)
        {
            if (!String.Equals(layoutProfile, "wide", StringComparison.OrdinalIgnoreCase) ||
                !String.Equals(rightMode, requestedMode, StringComparison.OrdinalIgnoreCase))
                return;
        }

        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero) return;
        IntPtr foregroundRoot = GetAncestor(foreground, GA_ROOT);
        if (foregroundRoot == IntPtr.Zero) foregroundRoot = foreground;
        if (!IsExplicitShellSurfaceHandle(foregroundRoot)) return;

        if (String.Equals(requestedMode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            RaiseWideTwitchClusterOnce(String.Empty);
            return;
        }

        IntPtr dashboard = GetWideSurfaceHandle("right", "dashboard");
        if (dashboard == IntPtr.Zero || !IsWindowVisible(dashboard) || IsIconic(dashboard))
        {
            LogDiagnostic("right-pane reassert: Dashboard HWND unavailable");
            return;
        }

        // Only the explicitly selected right surface is lifted; SWP_NOACTIVATE
        // leaves keyboard and mouse focus on the newly opened LEFT provider.
        bool positioned = SetWindowPos(
            dashboard, HWND_TOP, 0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
        if (!positioned)
            LogDiagnostic("right-pane reassert: Dashboard SetWindowPos failed");
    }

    private static void SetWideTwitchPaneFullscreen(string member, bool enabled, PaneBounds pane)
    {
        string normalized = (member ?? String.Empty).Trim().ToLowerInvariant();
        if (String.IsNullOrWhiteSpace(normalized)) return;

        IntPtr hWnd = GetWideTwitchClusterHandle(normalized);
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return;

        /* Geometry is deliberately NOT changed here. 0.19.10/0.19.11 used
         * SetWindowPos to overscan the Opera HWND after Chromium had already
         * committed a chrome.windows geometry. Opera GX could then paint one
         * rectangle while hit-testing/compositing another, producing a caption-
         * height input offset and, for Page slots, a permanently black surface
         * after returning to the grid.
         *
         * From protocol v6 onward Chromium owns the overscan and restore rects.
         * Native only tracks which cluster member must remain above its siblings. */
        lock (StateLock)
        {
            if (enabled)
            {
                twitchPaneFullscreenMember = normalized;
            }
            else if (String.Equals(twitchPaneFullscreenMember, normalized, StringComparison.OrdinalIgnoreCase))
            {
                twitchPaneFullscreenMember = String.Empty;
            }
        }

        RaiseWideTwitchClusterOnce(normalized);
        LogDiagnostic(
            "twitch pane fullscreen " + (enabled ? "enabled" : "disabled") +
            " member=" + normalized +
            " browser-owned-geometry=true" +
            " pane=" + pane.Left + "," + pane.Top + " " + pane.Width + "x" + pane.Height
        );

        if (controllerWindow != IntPtr.Zero)
        {
            PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
        }
    }

    private static bool IsWideTwitchSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return false;
        if (GetWideSurfaceHandle("right", "twitch") == hWnd) return true;
        lock (StateLock)
        {
            foreach (IntPtr known in WideTwitchClusterWindows.Values)
            {
                if (known == hWnd) return true;
            }
        }
        return false;
    }

    private static List<TargetInfo> GetWideTwitchClusterTargets()
    {
        List<KeyValuePair<string, IntPtr>> entries;
        lock (StateLock)
        {
            entries = new List<KeyValuePair<string, IntPtr>>(WideTwitchClusterWindows);
        }
        entries.Sort(delegate(KeyValuePair<string, IntPtr> a, KeyValuePair<string, IntPtr> b)
        {
            return StringComparer.OrdinalIgnoreCase.Compare(a.Key, b.Key);
        });

        List<TargetInfo> targets = new List<TargetInfo>();
        HashSet<IntPtr> seen = new HashSet<IntPtr>();
        foreach (KeyValuePair<string, IntPtr> pair in entries)
        {
            if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value) || IsIconic(pair.Value) || seen.Contains(pair.Value)) continue;
            TargetInfo target = TryBuildTrustedOperaTarget(pair.Value);
            if (target != null)
            {
                seen.Add(pair.Value);
                targets.Add(target);
            }
        }
        return targets;
    }

    private static bool IsCompactKnownSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in CompactSurfaceWindows.Values)
            {
                if (known == hWnd)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsWideKnownSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in WideSurfaceWindows.Values)
            {
                if (known == hWnd)
                {
                    return true;
                }
            }
            foreach (IntPtr known in WideTwitchClusterWindows.Values)
            {
                if (known == hWnd)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsExplicitShellSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;
        return IsCompactKnownSurfaceHandle(candidate) || IsWideKnownSurfaceHandle(candidate);
    }

    private static bool IsHandleReferencedBySurfaceMaps(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in CompactSurfaceWindows.Values)
            {
                if (known == hWnd) return true;
            }
            foreach (IntPtr known in WideSurfaceWindows.Values)
            {
                if (known == hWnd) return true;
            }
            foreach (IntPtr known in WideTwitchClusterWindows.Values)
            {
                if (known == hWnd) return true;
            }
        }
        return false;
    }

    private static TargetInfo FindCompactSurfaceTarget(PaneBounds pane, string mode)
    {
        IntPtr hWnd = GetCompactSurfaceHandle(mode);
        if (hWnd == IntPtr.Zero || IsIconic(hWnd))
        {
            return null;
        }

        /* The initial Compact claim already proved geometry/title/foreground.
         * After that, keep the exact mapped HWND authoritative just like Wide.
         * This avoids repeating pane-scoring work on every 500 ms native tick. */
        return TryBuildTrustedOperaTarget(hWnd);
    }

    private static TargetInfo FindWideSurfaceTarget(PaneBounds pane, string side, string mode)
    {
        IntPtr hWnd = GetWideSurfaceHandle(side, mode);
        if (hWnd == IntPtr.Zero || IsIconic(hWnd))
        {
            return null;
        }

        /*
         * Pane geometry is part of the initial Wide claim proof, not a lease on
         * the HWND afterwards. Chromium can temporarily resize the same trusted
         * top-level window for true fullscreen and may restore it a few pixels
         * differently afterwards. Keep the explicit mapping authoritative once
         * established and derive chrome from the mapped HWND's real rectangle.
         */
        return TryBuildTrustedOperaTarget(hWnd);
    }

}
