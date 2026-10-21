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

// Original v0.20.12 source: lines 6029-6443.
internal static partial class StreamShellTitlebarHost
{
    private static PaneBounds GetShellPaneLayoutBounds()
    {
        lock (StateLock)
        {
            int left = Math.Min(leftPane.Left, rightPane.Left);
            int top = Math.Min(leftPane.Top, rightPane.Top);
            int right = Math.Max(leftPane.Left + leftPane.Width, rightPane.Left + rightPane.Width);
            int bottom = Math.Max(leftPane.Top + leftPane.Height, rightPane.Top + rightPane.Height);

            return new PaneBounds(
                left,
                top,
                Math.Max(1, right - left),
                Math.Max(1, bottom - top)
            );
        }
    }

    private static double RectAspect(RECT rect)
    {
        int width = Math.Max(1, rect.Right - rect.Left);
        int height = Math.Max(1, rect.Bottom - rect.Top);
        return width / (double)height;
    }

    private static bool TryGetMonitorReferenceRect(IntPtr hWnd, PaneBounds shell, out RECT reference)
    {
        reference = new RECT();

        IntPtr monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
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

        double shellAspect = Math.Max(1, shell.Width) / (double)Math.Max(1, shell.Height);
        double monitorDistance = Math.Abs(RectAspect(info.rcMonitor) - shellAspect);
        double workDistance = Math.Abs(RectAspect(info.rcWork) - shellAspect);

        // Wide uses the complete display bounds while Compact staging uses the
        // work area. Pick whichever native monitor rectangle has the same
        // shape as the logical shell layout Chromium supplied.
        reference = workDistance + 0.01 < monitorDistance
            ? info.rcWork
            : info.rcMonitor;

        return
            reference.Right > reference.Left &&
            reference.Bottom > reference.Top;
    }

    private static bool TryGetPaneGeometryScore(IntPtr hWnd, RECT rect, PaneBounds pane, out double score)
    {
        score = Double.MaxValue;
        PaneBounds shell = GetShellPaneLayoutBounds();

        RECT monitorRect;
        if (TryGetMonitorReferenceRect(hWnd, shell, out monitorRect))
        {
            double shellAspect = Math.Max(1, shell.Width) / (double)Math.Max(1, shell.Height);
            double monitorAspect = RectAspect(monitorRect);
            double aspectDelta = Math.Abs(monitorAspect - shellAspect) / Math.Max(0.01, shellAspect);

            // A pane can only belong to the display represented by the logical
            // shell layout. This rejects Opera windows on the other monitor in
            // mixed-DPI laptop+dock setups before position scoring.
            if (aspectDelta > 0.18)
            {
                return false;
            }

            double shellWidth = Math.Max(1, shell.Width);
            double shellHeight = Math.Max(1, shell.Height);
            double monitorWidth = Math.Max(1, monitorRect.Right - monitorRect.Left);
            double monitorHeight = Math.Max(1, monitorRect.Bottom - monitorRect.Top);

            double expectedLeft = (pane.Left - shell.Left) / shellWidth;
            double expectedTop = (pane.Top - shell.Top) / shellHeight;
            double expectedWidth = pane.Width / shellWidth;
            double expectedHeight = pane.Height / shellHeight;

            double actualLeft = (rect.Left - monitorRect.Left) / monitorWidth;
            double actualTop = (rect.Top - monitorRect.Top) / monitorHeight;
            double actualWidth = Math.Max(0, rect.Right - rect.Left) / monitorWidth;
            double actualHeight = Math.Max(0, rect.Bottom - rect.Top) / monitorHeight;

            double leftDelta = Math.Abs(actualLeft - expectedLeft);
            double topDelta = Math.Abs(actualTop - expectedTop);
            double widthDelta = Math.Abs(actualWidth - expectedWidth);
            double heightDelta = Math.Abs(actualHeight - expectedHeight);

            if (
                leftDelta > 0.14 ||
                topDelta > 0.12 ||
                widthDelta > 0.18 ||
                heightDelta > 0.18
            )
            {
                return false;
            }

            score =
                (leftDelta * 4.0) +
                (topDelta * 3.0) +
                (widthDelta * 2.0) +
                (heightDelta * 2.0) +
                aspectDelta;

            return true;
        }

        // Defensive fallback for old Windows/API failure: retain the original
        // same-coordinate-space heuristic rather than disabling the helper.
        int width = Math.Max(0, rect.Right - rect.Left);
        int height = Math.Max(0, rect.Bottom - rect.Top);
        if (width < pane.Width * 0.65 || height < pane.Height * 0.60)
        {
            return false;
        }

        int xTolerance = Math.Max(260, pane.Width / 5);
        int yTolerance = 180;
        int xDelta = Math.Abs(rect.Left - pane.Left);
        int yDelta = Math.Abs(rect.Top - pane.Top);
        if (xDelta > xTolerance || yDelta > yTolerance)
        {
            return false;
        }

        score =
            xDelta / (double)Math.Max(1, xTolerance) +
            yDelta / (double)Math.Max(1, yTolerance);
        return true;
    }

    private static TargetInfo TryBuildTrustedOperaTarget(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || hWnd == leftOverlay || hWnd == rightOverlay ||
            hWnd == leftChromeOverlay || hWnd == rightChromeOverlay || hWnd == rightCaptionBlockerOverlay ||
            hWnd == rightSplitChromeOverlay || hWnd == rightSplitCaptionBlockerOverlay ||
            hWnd == controllerWindow || !IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsIconic(hWnd))
        {
            return null;
        }

        string processName = GetProcessName(hWnd);
        if (!IsOperaProcess(processName))
        {
            return null;
        }

        RECT rect;
        if (!GetWindowRect(hWnd, out rect))
        {
            return null;
        }

        int dpi = GetTargetDpi(hWnd);
        int titlebarHeight;
        int captionLeft;
        if (!TryGetTitlebarMetrics(hWnd, rect, processName, dpi, out titlebarHeight, out captionLeft))
        {
            return null;
        }

        TargetInfo target = new TargetInfo();
        target.Handle = hWnd;
        target.ProcessName = processName;
        target.Rect = rect;
        target.Dpi = dpi;
        target.TitlebarHeight = titlebarHeight;
        target.CaptionLeft = captionLeft;
        return target;
    }


    private static TargetInfo TryBuildPaneTarget(IntPtr hWnd, PaneBounds pane, bool wantDiscord)
    {
        if (hWnd == IntPtr.Zero || hWnd == leftOverlay || hWnd == rightOverlay ||
            hWnd == leftChromeOverlay || hWnd == rightChromeOverlay || hWnd == rightCaptionBlockerOverlay ||
            hWnd == rightSplitChromeOverlay || hWnd == rightSplitCaptionBlockerOverlay ||
            hWnd == controllerWindow || !IsWindowVisible(hWnd) || IsIconic(hWnd))
        {
            return null;
        }

        RECT rect;
        if (!GetWindowRect(hWnd, out rect))
        {
            return null;
        }

        double geometryScore;
        if (!TryGetPaneGeometryScore(hWnd, rect, pane, out geometryScore))
        {
            return null;
        }

        string processName = GetProcessName(hWnd);
        bool opera = IsOperaProcess(processName);
        bool discord = String.Equals(processName, "Discord", StringComparison.OrdinalIgnoreCase);
        if (wantDiscord ? !discord : !opera)
        {
            return null;
        }

        int titlebarHeight;
        int captionLeft;
        int dpi = GetTargetDpi(hWnd);
        if (!TryGetTitlebarMetrics(hWnd, rect, processName, dpi, out titlebarHeight, out captionLeft))
        {
            return null;
        }

        TargetInfo candidate = new TargetInfo();
        candidate.Handle = hWnd;
        candidate.ProcessName = processName;
        candidate.Rect = rect;
        candidate.Dpi = dpi;
        candidate.TitlebarHeight = titlebarHeight;
        candidate.CaptionLeft = captionLeft;
        return candidate;
    }


    private static TargetInfo FindPaneTarget(PaneBounds pane, bool wantDiscord)
    {
        /*
         * Compact deliberately keeps Dashboard alive underneath its provider
         * as a stable owner/grouping anchor. Both can therefore share exactly
         * the same bounds. Prefer the foreground HWND first so discovery is
         * deterministic and O(1) in the normal shell path; only fall back to
         * the proven cheap-first EnumWindows scan when foreground is not the
         * requested pane.
         */
        TargetInfo foregroundTarget =
            TryBuildPaneTarget(GetForegroundWindow(), pane, wantDiscord);
        if (foregroundTarget != null)
        {
            return foregroundTarget;
        }

        TargetInfo found = null;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            TargetInfo candidate = TryBuildPaneTarget(hWnd, pane, wantDiscord);
            if (candidate == null)
            {
                return true;
            }

            found = candidate;
            return false;
        }, IntPtr.Zero);

        return found;
    }


    private static bool TryGetTitlebarMetrics(IntPtr hWnd, RECT windowRect, string processName, int dpi, out int titlebarHeight, out int captionLeft)
    {
        titlebarHeight = 0;
        captionLeft = 0;

        RECT client;
        POINT clientOrigin = new POINT(0, 0);
        if (GetClientRect(hWnd, out client) && ClientToScreen(hWnd, ref clientOrigin))
        {
            titlebarHeight = clientOrigin.Y - windowRect.Top;
        }

        int style = GetWindowLong(hWnd, GWL_STYLE);
        bool hasCaption = (((uint)style & WS_CAPTION) == WS_CAPTION);
        bool isDiscord = String.Equals(processName, "Discord", StringComparison.OrdinalIgnoreCase);
        bool isOpera = IsOperaProcess(processName);

        bool normalizeCompactYouTubeTitlebar = false;
        lock (StateLock)
        {
            normalizeCompactYouTubeTitlebar =
                isOpera &&
                String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase) &&
                String.Equals(leftMode, "youtube", StringComparison.OrdinalIgnoreCase);
        }

        /*
         * YouTube/Opera occasionally reports a smaller client-to-window offset
         * than the other managed providers. The custom bar must not inherit
         * that provider-specific collapse or its geometry and hit targets drift.
         */
        if (
            normalizeCompactYouTubeTitlebar &&
            titlebarHeight < Scale(34, dpi)
        )
        {
            titlebarHeight = Scale(34, dpi);
        }

        if (titlebarHeight < Scale(8, dpi))
        {
            /*
             * Chromium/Opera can draw the visible browser chrome inside the
             * client area. In that case ClientToScreen reports effectively
             * zero non-client height even though the user can plainly see the
             * ~34 px Opera title strip. 0.9.18 treated this as fullscreen and
             * therefore hid every overlay. Opera is already constrained by
             * FindPaneTarget to a large Stream Shell pane, so use the visible
             * chrome height as a fallback here.
             */
            if (isDiscord || hasCaption || isOpera)
            {
                titlebarHeight = Scale(34, dpi);
            }
            else
            {
                return false;
            }
        }

        if (titlebarHeight > Scale(90, dpi))
        {
            return false;
        }

        RECT captionBounds;
        bool haveCaptionBounds = false;
        try
        {
            int hr = DwmGetWindowAttribute(
                hWnd,
                DWMWA_CAPTION_BUTTON_BOUNDS,
                out captionBounds,
                Marshal.SizeOf(typeof(RECT))
            );

            int windowWidth = Math.Max(0, windowRect.Right - windowRect.Left);
            if (hr == 0 && captionBounds.Right > captionBounds.Left && captionBounds.Left > windowWidth / 2 && captionBounds.Left < windowWidth)
            {
                captionLeft = windowRect.Left + captionBounds.Left;
                haveCaptionBounds = true;
            }
        }
        catch
        {
        }

        if (!haveCaptionBounds)
        {
            captionLeft = windowRect.Right - Scale(144, dpi);
        }

        return true;
    }

    private static bool IsTrustedShellTarget(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero)
        {
            return false;
        }

        lock (TaskbarShellWindows)
        {
            return TaskbarShellWindows.Contains(target.Handle);
        }
    }

    private static RECT GetVisibleChromePlacementRect(TargetInfo target, bool compactLayout)
    {
        RECT rect = target != null ? target.Rect : new RECT();
        if (!compactLayout || target == null || target.Handle == IntPtr.Zero)
        {
            return rect;
        }

        IntPtr monitor = MonitorFromWindow(target.Handle, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
        {
            return rect;
        }

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info))
        {
            return rect;
        }

        /*
         * Maximized Chromium windows can report the invisible resize frame a
         * few pixels beyond the monitor work area. Using that raw rect for our
         * TOPMOST chrome shifts STREAM SHELL and the far-right button partly
         * off-screen. Compact never needs that invisible frame: fullscreen is
         * suppressed before chrome placement, so clamp normal chrome to rcWork.
         */
        rect.Left = Math.Max(rect.Left, info.rcWork.Left);
        rect.Top = Math.Max(rect.Top, info.rcWork.Top);
        rect.Right = Math.Min(rect.Right, info.rcWork.Right);
        rect.Bottom = Math.Min(rect.Bottom, info.rcWork.Bottom);

        if (rect.Right <= rect.Left || rect.Bottom <= rect.Top)
        {
            return target.Rect;
        }

        return rect;
    }

}
