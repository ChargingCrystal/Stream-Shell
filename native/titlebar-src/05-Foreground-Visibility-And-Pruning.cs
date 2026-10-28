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

// Original v0.20.12 source: lines 3159-3697.
internal static partial class StreamShellTitlebarHost
{
    private static bool IsCompactForegroundTarget(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero || !IsWindow(target.Handle))
        {
            return false;
        }

        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground))
        {
            return false;
        }

        if (foreground == target.Handle)
        {
            return true;
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        return root != IntPtr.Zero && root == target.Handle;
    }

    private static bool NeedsCompactZOrderRepair(IntPtr overlay, TargetInfo target, IntPtr mustAlsoBeAbove)
    {
        if (overlay == IntPtr.Zero || target == null || target.Handle == IntPtr.Zero ||
            !IsWindow(overlay) || !IsWindowVisible(overlay) || !IsCompactForegroundTarget(target))
        {
            return false;
        }

        if (!IsWindowAboveInZOrder(overlay, target.Handle))
        {
            return true;
        }

        return
            mustAlsoBeAbove != IntPtr.Zero &&
            IsWindow(mustAlsoBeAbove) &&
            IsWindowVisible(mustAlsoBeAbove) &&
            !IsWindowAboveInZOrder(overlay, mustAlsoBeAbove);
    }


    private static void TouchHeartbeat()
    {
        lock (StateLock)
        {
            lastHeartbeatTick = Environment.TickCount;
        }
    }

    private static bool IsHeartbeatFresh()
    {
        int tick;
        bool compatible;
        lock (StateLock)
        {
            tick = lastHeartbeatTick;
            compatible = protocolCompatible;
        }

        uint elapsed = unchecked((uint)(Environment.TickCount - tick));
        return compatible && elapsed <= HEARTBEAT_TIMEOUT_MS;
    }

    private static string ComputeNativeEffectiveVisibility(
        bool compactLayout,
        TargetInfo leftTarget,
        string currentRightMode,
        PaneBounds right
    )
    {
        if (!IsHeartbeatFresh())
        {
            return "none";
        }

        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground) || IsIconic(foreground))
        {
            return "none";
        }

        if (compactLayout)
        {
            return
                leftTarget != null &&
                IsCompactKnownSurfaceHandle(leftTarget.Handle) &&
                (IsCompactForegroundTarget(leftTarget) ||
                 CanKeepCompactChromeWithForeignForeground(leftTarget))
                    ? "shell"
                    : "none";
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        IntPtr foregroundRoot = root != IntPtr.Zero ? root : foreground;
        if (IsWideKnownSurfaceHandle(foregroundRoot))
        {
            return "shell";
        }

        if (String.Equals(currentRightMode, "discord", StringComparison.OrdinalIgnoreCase))
        {
            TargetInfo discordTarget = TryBuildPaneTarget(foregroundRoot, right, true);
            if (discordTarget != null && discordTarget.Handle != IntPtr.Zero)
            {
                return "discord";
            }
        }

        return "none";
    }

    private static bool IsHelperChromeWindow(IntPtr hWnd)
    {
        return
            hWnd == controllerWindow ||
            hWnd == leftChromeOverlay ||
            hWnd == rightChromeOverlay ||
            hWnd == rightCaptionBlockerOverlay ||
            hWnd == rightSplitChromeOverlay ||
            hWnd == rightSplitCaptionBlockerOverlay ||
            hWnd == leftOverlay ||
            hWnd == rightOverlay ||
            hWnd == leftOwner ||
            hWnd == rightOwner;
    }

    private static bool MeaningfullyOverlapsWideLeftChrome(IntPtr hWnd, TargetInfo leftTarget)
    {
        if (hWnd == IntPtr.Zero || leftTarget == null || hWnd == leftTarget.Handle ||
            IsHelperChromeWindow(hWnd) || !IsWindow(hWnd) || !IsWindowVisible(hWnd) ||
            IsIconic(hWnd) || IsExplicitShellSurfaceHandle(hWnd))
        {
            return false;
        }

        RECT foreignRect;
        if (!GetWindowRect(hWnd, out foreignRect))
        {
            return false;
        }

        int dpi = leftTarget.Dpi;
        int chromeHeight = Math.Max(Scale(28, dpi), leftTarget.TitlebarHeight + Scale(8, dpi));
        int chromeLeft = leftTarget.Rect.Left;
        int chromeTop = leftTarget.Rect.Top;
        int chromeRight = leftTarget.Rect.Right;
        int chromeBottom = Math.Min(leftTarget.Rect.Bottom, chromeTop + chromeHeight);

        int overlapLeft = Math.Max(chromeLeft, foreignRect.Left);
        int overlapTop = Math.Max(chromeTop, foreignRect.Top);
        int overlapRight = Math.Min(chromeRight, foreignRect.Right);
        int overlapBottom = Math.Min(chromeBottom, foreignRect.Bottom);
        int overlapWidth = Math.Max(0, overlapRight - overlapLeft);
        int overlapHeight = Math.Max(0, overlapBottom - overlapTop);

        int horizontalTolerance = Math.Max(8, Scale(16, dpi));
        int verticalTolerance = Math.Max(4, Scale(6, dpi));
        return
            overlapWidth > horizontalTolerance &&
            overlapHeight > verticalTolerance;
    }

    private static bool IsSelectedMangayomiLeftWindow(IntPtr hWnd, TargetInfo anchor)
    {
        if (anchor == null || hWnd == IntPtr.Zero)
            return false;

        // Only the application window in the LEFT pane is exempt. A Mangayomi
        // window moved to another monitor, or a different foreign program, must
        // not allow a TOPMOST Stream Shell bar to leak over desktop windows.
        RECT windowRect;
        if (!GetWindowRect(hWnd, out windowRect)) return false;
        int paneWidth = Math.Max(1, anchor.Rect.Right - anchor.Rect.Left);
        int paneHeight = Math.Max(1, anchor.Rect.Bottom - anchor.Rect.Top);
        int overlapWidth = Math.Max(0, Math.Min(windowRect.Right, anchor.Rect.Right) -
            Math.Max(windowRect.Left, anchor.Rect.Left));
        int overlapHeight = Math.Max(0, Math.Min(windowRect.Bottom, anchor.Rect.Bottom) -
            Math.Max(windowRect.Top, anchor.Rect.Top));
        int edgeTolerance = Math.Max(24, Scale(36, anchor.Dpi));
        bool containedInLeftPane =
            windowRect.Left >= anchor.Rect.Left - edgeTolerance &&
            windowRect.Top >= anchor.Rect.Top - edgeTolerance &&
            windowRect.Right <= anchor.Rect.Right + edgeTolerance &&
            windowRect.Bottom <= anchor.Rect.Bottom + edgeTolerance;
        // Check geometry before querying a foreign process; enumeration hits
        // many irrelevant desktop windows on every native refresh tick.
        return containedInLeftPane &&
            overlapWidth >= paneWidth * 85 / 100 &&
            overlapHeight >= paneHeight * 80 / 100 &&
            String.Equals(GetProcessName(hWnd), "Mangayomi", StringComparison.OrdinalIgnoreCase);
    }

    private static int mangayomiWideChromeRepairs = 0;

    // A native Flutter window may enter a higher Z-band *after* our chrome was
    // positioned. Wide used to repair only on visibility/geometry changes, so
    // Mangayomi could keep covering the toolbar until another provider forced
    // a re-layout. This is the one deliberately scoped native-app exception.
    private static IntPtr FindSelectedMangayomiOccluder(TargetInfo leftTarget)
    {
        if (leftTarget == null || leftTarget.Handle == IntPtr.Zero ||
            !IsWindow(leftTarget.Handle) || !IsHeartbeatFresh())
            return IntPtr.Zero;

        lock (StateLock)
        {
            if (!String.Equals(leftMode, "mangayomi", StringComparison.OrdinalIgnoreCase) ||
                !String.Equals(layoutProfile, "wide", StringComparison.OrdinalIgnoreCase))
                return IntPtr.Zero;
        }

        IntPtr match = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            if (IsWindowVisible(hWnd) && !IsIconic(hWnd) &&
                IsSelectedMangayomiLeftWindow(hWnd, leftTarget) &&
                IsWindowAboveInZOrder(hWnd, leftTarget.Handle))
            {
                match = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return match;
    }

    private static bool NeedsMangayomiWideChromeZOrderRepair(
        IntPtr chromeWindow, TargetInfo leftTarget, IntPtr alsoAbove)
    {
        if (chromeWindow == IntPtr.Zero || !IsWindow(chromeWindow) ||
            !IsWindowVisible(chromeWindow))
            return false;

        IntPtr mangayomi = FindSelectedMangayomiOccluder(leftTarget);
        if (mangayomi == IntPtr.Zero) return false;

        // Keep the left caption backdrop, buttons and Mangayomi in a stable
        // order without applying any TOPMOST exception to Discord or others.
        return !IsWindowAboveInZOrder(chromeWindow, mangayomi) ||
            (alsoAbove != IntPtr.Zero && IsWindow(alsoAbove) &&
             IsWindowVisible(alsoAbove) &&
             !IsWindowAboveInZOrder(chromeWindow, alsoAbove));
    }

    private static bool HasForeignWindowAboveWideLeftChrome(TargetInfo leftTarget, bool allowMangayomi)
    {
        if (leftTarget == null || leftTarget.Handle == IntPtr.Zero || !IsWindow(leftTarget.Handle))
        {
            return true;
        }

        bool occluded = false;

        /*
         * Deliberately consider more than GetForegroundWindow(): a foreign
         * window can remain above the left pane after focus moves to a second
         * foreign window on the right pane. Looking only at the new foreground
         * would then resurrect our TOPMOST titlebar over the still-covered left
         * window. IsWindowAboveInZOrder() makes the requirement explicit instead
         * of relying on the enumeration callback order.
         */
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            if (!IsWindowAboveInZOrder(hWnd, leftTarget.Handle))
            {
                return true;
            }

            if (MeaningfullyOverlapsWideLeftChrome(hWnd, leftTarget) &&
                !(allowMangayomi && IsSelectedMangayomiLeftWindow(hWnd, leftTarget)))
            {
                occluded = true;
                return false;
            }

            return true;
        }, IntPtr.Zero);

        return occluded;
    }

    private static bool CanKeepWideLeftChromeWithForeignForeground(
        TargetInfo leftTarget
    )
    {
        if (leftTarget == null || leftTarget.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(leftTarget) || !IsHeartbeatFresh() ||
            !IsWindow(leftTarget.Handle) || !IsWindowVisible(leftTarget.Handle) ||
            IsIconic(leftTarget.Handle))
        {
            return false;
        }

        /*
         * Wide is intentionally not foreground-only: Stream Shell may remain
         * visible on one 32:9 pane while another app owns focus on the other.
         * The safety decision therefore follows actual Z-order occlusion of the
         * left titlebar band, not merely the current foreground HWND. This keeps
         * the custom chrome while the opposite pane is in use, but prevents a
         * stale TOPMOST bar from resurfacing over any foreign window that still
         * sits above Stream Shell on the left.
         */
        bool allowMangayomi;
        lock (StateLock)
        {
            allowMangayomi = String.Equals(leftMode, "mangayomi", StringComparison.OrdinalIgnoreCase) &&
                String.Equals(layoutProfile, "wide", StringComparison.OrdinalIgnoreCase);
        }
        return !HasForeignWindowAboveWideLeftChrome(leftTarget, allowMangayomi);
    }

    private static bool IsKnownNormalOperaWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;

        lock (TaskbarNormalOperaWindows)
        {
            return TaskbarNormalOperaWindows.Contains(candidate);
        }
    }

    private static bool ShouldIgnoreYouTubeCompactOperaOccluder(
        IntPtr hWnd,
        TargetInfo target
    )
    {
        if (
            hWnd == IntPtr.Zero ||
            target == null ||
            !IsWindow(hWnd)
        )
        {
            return false;
        }

        string currentMode;
        lock (StateLock)
        {
            currentMode = leftMode;
        }

        if (!String.Equals(currentMode, "youtube", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;

        if (
            candidate == target.Handle ||
            IsExplicitShellSurfaceHandle(candidate) ||
            !IsOperaProcess(GetProcessName(candidate))
        )
        {
            return false;
        }

        /*
         * YouTube can leave transient Opera-owned helper/tool HWNDs above the
         * provider surface when focus moves away. They are not real browser
         * windows and must not make Compact chrome disappear. A real Opera
         * browser still counts when it is the actual foreground root or when
         * it has previously been registered as a normal Opera window.
         */
        IntPtr foreground = GetForegroundWindow();
        IntPtr foregroundRoot =
            foreground != IntPtr.Zero
                ? GetAncestor(foreground, GA_ROOT)
                : IntPtr.Zero;
        IntPtr effectiveForeground =
            foregroundRoot != IntPtr.Zero
                ? foregroundRoot
                : foreground;

        if (candidate == effectiveForeground)
        {
            return false;
        }

        if (IsKnownNormalOperaWindow(candidate))
        {
            return false;
        }

        return true;
    }


    private static bool TryGetVisibleFrameRect(IntPtr hWnd, out RECT rect)
    {
        rect = new RECT();

        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        try
        {
            int hr = DwmGetWindowAttribute(
                hWnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                out rect,
                Marshal.SizeOf(typeof(RECT))
            );

            if (
                hr == 0 &&
                rect.Right > rect.Left &&
                rect.Bottom > rect.Top
            )
            {
                return true;
            }
        }
        catch
        {
        }

        return GetWindowRect(hWnd, out rect);
    }


    private static bool MeaningfullyOverlapsCompactChrome(
        IntPtr hWnd,
        TargetInfo target
    )
    {
        if (hWnd == IntPtr.Zero || target == null || hWnd == target.Handle ||
            IsHelperChromeWindow(hWnd) || !IsWindow(hWnd) || !IsWindowVisible(hWnd) ||
            IsIconic(hWnd) || IsExplicitShellSurfaceHandle(hWnd))
        {
            return false;
        }

        RECT foreignRect;
        RECT targetRect;
        if (
            !TryGetVisibleFrameRect(hWnd, out foreignRect) ||
            !TryGetVisibleFrameRect(target.Handle, out targetRect)
        )
        {
            return false;
        }

        /*
         * Compact surfaces are maximized to one monitor. GetWindowRect() also
         * includes Chromium's invisible resize frame, which can protrude onto
         * an adjacent monitor. When a window there gains focus, two invisible
         * frames can look like a real titlebar overlap and incorrectly hide our
         * chrome. Wide panes do not hit this monitor-edge case, so keep their
         * proven path unchanged and use DWM's visible frame bounds here.
         */
        int dpi = target.Dpi;
        int chromeHeight = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int chromeLeft = targetRect.Left;
        int chromeTop = targetRect.Top;
        int chromeRight = targetRect.Right;
        int chromeBottom = Math.Min(targetRect.Bottom, chromeTop + chromeHeight);

        int overlapLeft = Math.Max(chromeLeft, foreignRect.Left);
        int overlapTop = Math.Max(chromeTop, foreignRect.Top);
        int overlapRight = Math.Min(chromeRight, foreignRect.Right);
        int overlapBottom = Math.Min(chromeBottom, foreignRect.Bottom);
        int overlapWidth = Math.Max(0, overlapRight - overlapLeft);
        int overlapHeight = Math.Max(0, overlapBottom - overlapTop);

        int horizontalTolerance = Math.Max(8, Scale(16, dpi));
        int verticalTolerance = Math.Max(4, Scale(6, dpi));
        return
            overlapWidth > horizontalTolerance &&
            overlapHeight > verticalTolerance;
    }


    private static bool HasForeignWindowAboveCompactChrome(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero || !IsWindow(target.Handle))
        {
            return true;
        }

        bool occluded = false;

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            if (!IsWindowAboveInZOrder(hWnd, target.Handle))
            {
                return true;
            }

            if (ShouldIgnoreYouTubeCompactOperaOccluder(hWnd, target))
            {
                return true;
            }

            if (MeaningfullyOverlapsCompactChrome(hWnd, target))
            {
                occluded = true;
                return false;
            }

            return true;
        }, IntPtr.Zero);

        return occluded;
    }

    private static bool CanKeepCompactChromeWithForeignForeground(
        TargetInfo target
    )
    {
        if (target == null || target.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(target) || !IsHeartbeatFresh() ||
            !IsWindow(target.Handle) || !IsWindowVisible(target.Handle) ||
            IsIconic(target.Handle))
        {
            return false;
        }

        /*
         * Compact on 16:10/16:9 should keep the custom titlebar visible when
         * Stream Shell remains visible but another application temporarily owns
         * focus elsewhere. Match Wide's behavior by following actual occlusion
         * of the top titlebar band instead of the foreground HWND alone.
         */
        return !HasForeignWindowAboveCompactChrome(target);
    }


    private static void PruneStaleSurfaceState()
    {
        List<IntPtr> staleShellHandles = new List<IntPtr>();

        lock (StateLock)
        {
            List<string> compactKeys = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in CompactSurfaceWindows)
            {
                if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value)) compactKeys.Add(pair.Key);
            }
            foreach (string key in compactKeys) CompactSurfaceWindows.Remove(key);

            List<string> wideKeys = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideSurfaceWindows)
            {
                if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value)) wideKeys.Add(pair.Key);
            }
            foreach (string key in wideKeys) WideSurfaceWindows.Remove(key);

            List<string> twitchClusterKeys = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideTwitchClusterWindows)
            {
                if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value)) twitchClusterKeys.Add(pair.Key);
            }
            foreach (string key in twitchClusterKeys)
            {
                WideTwitchClusterWindows.Remove(key);
                WideTwitchClaimBrowserWindowIds.Remove(key);
            }

            string twitchKey = GetWideSurfaceKey("right", "twitch");
            IntPtr twitchPrimary;
            if ((!WideSurfaceWindows.TryGetValue(twitchKey, out twitchPrimary) || twitchPrimary == IntPtr.Zero || !IsWindow(twitchPrimary)) &&
                WideTwitchClusterWindows.Count > 0)
            {
                foreach (KeyValuePair<string, IntPtr> pair in WideTwitchClusterWindows)
                {
                    if (pair.Value != IntPtr.Zero && IsWindow(pair.Value))
                    {
                        WideSurfaceWindows[twitchKey] = pair.Value;
                        break;
                    }
                }
            }
        }

        lock (TaskbarShellWindows)
        {
            foreach (IntPtr hWnd in TaskbarShellWindows)
            {
                if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) staleShellHandles.Add(hWnd);
            }
            foreach (IntPtr hWnd in staleShellHandles) TaskbarShellWindows.Remove(hWnd);
        }

        if (staleShellHandles.Count > 0)
        {
            lock (PendingTaskbarShellIdentityRetries)
            {
                foreach (IntPtr hWnd in staleShellHandles) PendingTaskbarShellIdentityRetries.Remove(hWnd);
            }
            lock (TaskbarNormalOperaWindows)
            {
                foreach (IntPtr hWnd in staleShellHandles) TaskbarNormalOperaWindows.Remove(hWnd);
            }
        }

        List<IntPtr> shellSnapshot;
        lock (TaskbarShellWindows)
        {
            shellSnapshot = new List<IntPtr>(TaskbarShellWindows);
        }

        List<IntPtr> orphans = new List<IntPtr>();
        foreach (IntPtr hWnd in shellSnapshot)
        {
            if (hWnd != IntPtr.Zero && IsWindow(hWnd) && !IsHandleReferencedBySurfaceMaps(hWnd))
            {
                orphans.Add(hWnd);
            }
        }
        foreach (IntPtr hWnd in orphans)
        {
            UnregisterShellWindowIfUnreferenced(hWnd, "reconcile-orphan");
        }
    }


}
