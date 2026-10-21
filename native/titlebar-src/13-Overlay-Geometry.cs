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

// Original v0.20.12 source: lines 6444-6962.
internal static partial class StreamShellTitlebarHost
{
    private static void PositionChromeBackdrop(TargetInfo target)
    {
        if (leftChromeOverlay == IntPtr.Zero || target == null)
        {
            HideChromeBackdrop();
            return;
        }

        int dpi = target.Dpi;
        bool compactLayout;
        lock (StateLock)
        {
            compactLayout = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        }

        RECT placementRect = GetVisibleChromePlacementRect(target, compactLayout);
        int width = Math.Max(1, placementRect.Right - placementRect.Left);
        int height = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int x = placementRect.Left;
        int y = placementRect.Top;

        // Compact now uses the same TOPMOST placement strategy as Wide while
        // it is allowed to exist. The important difference is lifecycle, not
        // z-band: Compact eligibility is decided from the real Win32 foreground
        // target in SyncOverlays(), so an unrelated application causes this
        // window to be hidden/demoted instead of leaving a TOPMOST helper over
        // the desktop. This avoids the normal-z dead state seen in 0.14.8-.11.
        bool ownershipChanged = false;

        bool visible = IsWindowVisible(leftChromeOverlay);
        bool placementChanged =
            chromeLastX != x || chromeLastY != y ||
            chromeLastWidth != width || chromeLastHeight != height ||
            chromeLastTarget != target.Handle;
        bool compactZOrderRepair =
            compactLayout &&
            NeedsCompactZOrderRepair(leftChromeOverlay, target, IntPtr.Zero);

        if (!visible || placementChanged || ownershipChanged || compactZOrderRepair)
        {
            bool positioned = SetWindowPos(
                leftChromeOverlay,
                HWND_TOPMOST,
                x,
                y,
                width,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();

            ShowWindow(leftChromeOverlay, SW_SHOWNOACTIVATE);

            chromeLastX = x;
            chromeLastY = y;
            chromeLastWidth = width;
            chromeLastHeight = height;
            chromeLastTarget = target.Handle;

            if (!chromePositionLogged)
            {
                chromePositionLogged = true;
                LogDiagnostic(
                    "provider chrome show: ok=" + positioned +
                    " err=" + positionError +
                    " rect=" + x + "," + y + " " + width + "x" + height +
                    " target=0x" + target.Handle.ToInt64().ToString("X")
                );
            }
        }

        if (placementChanged)
        {
            InvalidateRect(leftChromeOverlay, IntPtr.Zero, false);
        }
    }

    private static void HideChromeBackdrop()
    {
        if (leftChromeOverlay == IntPtr.Zero)
        {
            return;
        }

        if (IsWindowVisible(leftChromeOverlay))
        {
            ShowWindow(leftChromeOverlay, SW_HIDE);
            SetWindowPos(
                leftChromeOverlay,
                HWND_NOTOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
            );
        }

        chromeLastTarget = IntPtr.Zero;
    }


    private static bool ShouldShowRightChrome(TargetInfo target, string currentRightMode)
    {
        bool browserSurface =
            String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase);

        return
            target != null &&
            target.Handle != IntPtr.Zero &&
            browserSurface &&
            IsTrustedShellTarget(target);
    }

    /*
     * The right chrome belongs to Dashboard, not to the desktop. Making these
     * helper windows owned by the proven Dashboard HWND lets Windows keep them
     * above Dashboard while naturally allowing unrelated windows to cover the
     * whole Dashboard + chrome pair. No foreground or geometry occlusion guess
     * is needed, and the provider colour still comes from leftMode.
     */

    private static void PositionRightChrome(TargetInfo target)
    {
        if (rightChromeOverlay == IntPtr.Zero || rightCaptionBlockerOverlay == IntPtr.Zero || target == null)
        {
            HideRightChrome();
            return;
        }

        bool ownerChanged = rightChromeLastTarget != target.Handle;
        if (ownerChanged)
        {
            SetOwner(rightChromeOverlay, target.Handle);
            SetOwner(rightCaptionBlockerOverlay, target.Handle);
        }

        int dpi = target.Dpi;
        int width = Math.Max(1, target.Rect.Right - target.Rect.Left);
        int height = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int x = target.Rect.Left;
        int y = target.Rect.Top;

        bool chromeVisible = IsWindowVisible(rightChromeOverlay);
        bool chromeChanged =
            rightChromeLastX != x || rightChromeLastY != y ||
            rightChromeLastWidth != width || rightChromeLastHeight != height ||
            rightChromeLastTarget != target.Handle;

        if (!chromeVisible || chromeChanged)
        {
            bool positioned = SetWindowPos(
                rightChromeOverlay,
                IntPtr.Zero,
                x,
                y,
                width,
                height,
                SWP_NOZORDER | SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();
            ShowWindow(rightChromeOverlay, SW_SHOWNOACTIVATE);

            rightChromeLastX = x;
            rightChromeLastY = y;
            rightChromeLastWidth = width;
            rightChromeLastHeight = height;
            rightChromeLastTarget = target.Handle;

            if (!rightChromePositionLogged)
            {
                rightChromePositionLogged = true;
                LogDiagnostic(
                    "right provider chrome show: ok=" + positioned +
                    " err=" + positionError +
                    " rect=" + x + "," + y + " " + width + "x" + height +
                    " target=0x" + target.Handle.ToInt64().ToString("X")
                );
            }
        }

        int blockerX = target.CaptionLeft;
        int blockerWidth = Math.Max(Scale(96, dpi), target.Rect.Right - target.CaptionLeft);
        bool blockerVisible = IsWindowVisible(rightCaptionBlockerOverlay);
        bool blockerChanged =
            rightBlockerLastX != blockerX || rightBlockerLastY != y ||
            rightBlockerLastWidth != blockerWidth || rightBlockerLastHeight != height ||
            rightBlockerLastTarget != target.Handle;

        if (!blockerVisible || blockerChanged)
        {
            SetWindowPos(
                rightCaptionBlockerOverlay,
                IntPtr.Zero,
                blockerX,
                y,
                blockerWidth,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            ShowWindow(rightCaptionBlockerOverlay, SW_SHOWNOACTIVATE);

            rightBlockerLastX = blockerX;
            rightBlockerLastY = y;
            rightBlockerLastWidth = blockerWidth;
            rightBlockerLastHeight = height;
            rightBlockerLastTarget = target.Handle;
        }

        if (chromeChanged)
        {
            InvalidateRect(rightChromeOverlay, IntPtr.Zero, false);
        }
        if (blockerChanged)
        {
            InvalidateRect(rightCaptionBlockerOverlay, IntPtr.Zero, false);
        }
    }

    private static void PositionRightSplitChrome(TargetInfo target)
    {
        if (rightSplitChromeOverlay == IntPtr.Zero || rightSplitCaptionBlockerOverlay == IntPtr.Zero || target == null)
        {
            HideRightSplitChrome();
            return;
        }

        bool ownerChanged = rightSplitChromeLastTarget != target.Handle;
        if (ownerChanged)
        {
            SetOwner(rightSplitChromeOverlay, target.Handle);
            SetOwner(rightSplitCaptionBlockerOverlay, target.Handle);
        }

        int dpi = target.Dpi;
        int width = Math.Max(1, target.Rect.Right - target.Rect.Left);
        int height = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int x = target.Rect.Left;
        int y = target.Rect.Top;

        bool chromeVisible = IsWindowVisible(rightSplitChromeOverlay);
        bool chromeChanged =
            rightSplitChromeLastX != x || rightSplitChromeLastY != y ||
            rightSplitChromeLastWidth != width || rightSplitChromeLastHeight != height ||
            rightSplitChromeLastTarget != target.Handle;

        if (!chromeVisible || chromeChanged)
        {
            bool positioned = SetWindowPos(
                rightSplitChromeOverlay, IntPtr.Zero, x, y, width, height,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();
            ShowWindow(rightSplitChromeOverlay, SW_SHOWNOACTIVATE);
            rightSplitChromeLastX = x;
            rightSplitChromeLastY = y;
            rightSplitChromeLastWidth = width;
            rightSplitChromeLastHeight = height;
            rightSplitChromeLastTarget = target.Handle;

            if (!rightSplitChromePositionLogged)
            {
                rightSplitChromePositionLogged = true;
                LogDiagnostic(
                    "right split chrome show: ok=" + positioned +
                    " err=" + positionError +
                    " rect=" + x + "," + y + " " + width + "x" + height +
                    " target=0x" + target.Handle.ToInt64().ToString("X")
                );
            }
        }

        int blockerX = target.CaptionLeft;
        int blockerWidth = Math.Max(Scale(96, dpi), target.Rect.Right - target.CaptionLeft);
        bool blockerVisible = IsWindowVisible(rightSplitCaptionBlockerOverlay);
        bool blockerChanged =
            rightSplitBlockerLastX != blockerX || rightSplitBlockerLastY != y ||
            rightSplitBlockerLastWidth != blockerWidth || rightSplitBlockerLastHeight != height ||
            rightSplitBlockerLastTarget != target.Handle;

        if (!blockerVisible || blockerChanged)
        {
            SetWindowPos(
                rightSplitCaptionBlockerOverlay, IntPtr.Zero, blockerX, y, blockerWidth, height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            ShowWindow(rightSplitCaptionBlockerOverlay, SW_SHOWNOACTIVATE);
            rightSplitBlockerLastX = blockerX;
            rightSplitBlockerLastY = y;
            rightSplitBlockerLastWidth = blockerWidth;
            rightSplitBlockerLastHeight = height;
            rightSplitBlockerLastTarget = target.Handle;
        }

        if (chromeChanged) InvalidateRect(rightSplitChromeOverlay, IntPtr.Zero, false);
        if (blockerChanged) InvalidateRect(rightSplitCaptionBlockerOverlay, IntPtr.Zero, false);
    }

    private static void HideRightSplitChrome()
    {
        IntPtr[] windows = new IntPtr[] { rightSplitChromeOverlay, rightSplitCaptionBlockerOverlay };
        for (int i = 0; i < windows.Length; i++)
        {
            IntPtr hWnd = windows[i];
            if (hWnd == IntPtr.Zero) continue;
            if (IsWindowVisible(hWnd))
            {
                ShowWindow(hWnd, SW_HIDE);
                SetWindowPos(
                    hWnd, HWND_NOTOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                );
            }
        }
        rightSplitChromeLastTarget = IntPtr.Zero;
        rightSplitBlockerLastTarget = IntPtr.Zero;
    }

    private static void HideRightChrome()
    {
        HideRightSplitChrome();
        IntPtr[] windows = new IntPtr[] { rightChromeOverlay, rightCaptionBlockerOverlay };
        for (int i = 0; i < windows.Length; i++)
        {
            IntPtr hWnd = windows[i];
            if (hWnd == IntPtr.Zero) continue;
            if (IsWindowVisible(hWnd))
            {
                ShowWindow(hWnd, SW_HIDE);
                SetWindowPos(
                    hWnd,
                    HWND_NOTOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                );
            }
        }

        rightChromeLastTarget = IntPtr.Zero;
        rightBlockerLastTarget = IntPtr.Zero;
    }

    private static void PositionOverlay(IntPtr overlay, TargetInfo target, bool isLeft)
    {
        if (overlay == IntPtr.Zero || target == null)
        {
            HideOverlay(overlay, isLeft);
            if (isLeft) leftOwner = IntPtr.Zero; else rightOwner = IntPtr.Zero;
            return;
        }

        int dpi = target.Dpi;
        bool compactLayout;
        lock (StateLock)
        {
            compactLayout = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        }
        RECT placementRect = GetVisibleChromePlacementRect(target, compactLayout);

        int gap = Scale(8, dpi);
        bool compactDiscord = false;
        if (!isLeft)
        {
            lock (StateLock)
            {
                compactDiscord = String.Equals(rightMode, "discord", StringComparison.OrdinalIgnoreCase);
            }
        }
        int navWidth = isLeft ? GetLeftOverlayWidth(dpi) : 0;
        int width = isLeft ? navWidth : Scale(compactDiscord ? 44 : 92, dpi);
        int height = isLeft
            ? Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi))
            : Math.Min(Scale(24, dpi), Math.Max(Scale(20, dpi), target.TitlebarHeight - Scale(8, dpi)));
        // The Stream Shell nav now owns the far-right edge of the left caption.
        // This intentionally sits over Opera's native caption buttons so they
        // are visually and interactively replaced by Stream Shell navigation.
        int x = isLeft ? placementRect.Right - navWidth : target.CaptionLeft - gap - width;
        int y = isLeft
            ? placementRect.Top
            : placementRect.Top + Math.Max(Scale(2, dpi), (target.TitlebarHeight - height) / 2) + Scale(4, dpi);

        if (x < placementRect.Left + Scale(160, dpi))
        {
            HideOverlay(overlay, isLeft);
            return;
        }

        if (isLeft) leftOwner = target.Handle; else rightOwner = target.Handle;

        bool ownershipChanged = false;

        bool visible = IsWindowVisible(overlay);
        bool placementChanged;
        if (isLeft)
        {
            placementChanged =
                leftLastX != x || leftLastY != y ||
                leftLastWidth != width || leftLastHeight != height ||
                leftLastTarget != target.Handle;
        }
        else
        {
            placementChanged =
                rightLastX != x || rightLastY != y ||
                rightLastWidth != width || rightLastHeight != height ||
                rightLastTarget != target.Handle;
        }

        /*
         * Wide and Compact use the same TOPMOST placement while visible.
         * Compact's protection against leaking over unrelated applications is
         * handled by its Win32-foreground lifecycle gate in SyncOverlays(), not
         * by trying to balance the toolbar inside the normal z-order band.
         */
        bool compactZOrderRepair =
            compactLayout &&
            NeedsCompactZOrderRepair(
                overlay,
                target,
                isLeft ? leftChromeOverlay : IntPtr.Zero
            );

        if (!visible || placementChanged || ownershipChanged || compactZOrderRepair)
        {
            IntPtr insertAfter = HWND_TOPMOST;

            bool positioned = SetWindowPos(
                overlay,
                insertAfter,
                x,
                y,
                width,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();

            ShowWindow(overlay, SW_SHOWNOACTIVATE);

            if (isLeft)
            {
                leftLastX = x; leftLastY = y; leftLastWidth = width; leftLastHeight = height; leftLastTarget = target.Handle;
            }
            else
            {
                rightLastX = x; rightLastY = y; rightLastWidth = width; rightLastHeight = height; rightLastTarget = target.Handle;
            }

            bool shouldLog = isLeft ? !leftPositionLogged : !rightPositionLogged;
            if (shouldLog)
            {
                if (isLeft) leftPositionLogged = true; else rightPositionLogged = true;

                RECT overlayRect;
                string rectText = GetWindowRect(overlay, out overlayRect)
                    ? overlayRect.Left + "," + overlayRect.Top + " " +
                      Math.Max(0, overlayRect.Right - overlayRect.Left) + "x" +
                      Math.Max(0, overlayRect.Bottom - overlayRect.Top)
                    : "unavailable";

                LogDiagnostic(
                    (isLeft ? "left" : "right") +
                    " overlay show: ok=" + positioned +
                    " err=" + positionError +
                    " visible=" + IsWindowVisible(overlay) +
                    " rect=" + rectText
                );
            }
        }

        if (placementChanged)
        {
            InvalidateRect(overlay, IntPtr.Zero, false);
        }
    }

    private static void HideOverlay(IntPtr overlay, bool isLeft)
    {
        if (overlay == IntPtr.Zero)
        {
            return;
        }

        if (IsWindowVisible(overlay))
        {
            ShowWindow(overlay, SW_HIDE);
            SetWindowPos(
                overlay,
                HWND_NOTOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
            );
        }

        if (isLeft)
        {
            leftLastX = Int32.MinValue;
            leftLastY = Int32.MinValue;
            leftLastWidth = Int32.MinValue;
            leftLastHeight = Int32.MinValue;
            leftLastTarget = IntPtr.Zero;
        }
        else
        {
            rightLastX = Int32.MinValue;
            rightLastY = Int32.MinValue;
            rightLastWidth = Int32.MinValue;
            rightLastHeight = Int32.MinValue;
            rightLastTarget = IntPtr.Zero;
        }
    }

}
