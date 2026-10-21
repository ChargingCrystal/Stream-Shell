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

// Original v0.20.12 source: lines 3698-3916.
internal static partial class StreamShellTitlebarHost
{
    private static void SyncOverlays()
    {
        if (!initialized || shuttingDown)
        {
            HideChromeBackdrop();
            HideRightChrome();
            HideOverlay(leftOverlay, true);
            return;
        }

        // When WuWa (or another foreign fullscreen app) covers BOTH panes,
        // don't query and mutate all background Opera taskbar/Alt-Tab HWNDs on
        // every tick. No parking/unparking is performed by this fast path.
        // Pending claims must still be given an opportunity to finish.
        if (!HasPendingSurfaceClaim() && IsForeignFullscreenCoveringShell())
        {
            lastEffectiveVisibility = "none";
            HideChromeBackdrop();
            HideRightChrome();
            HideOverlay(leftOverlay, true);
            NativeHealth.MarkFullCoverIdle();
            return;
        }

        PruneStaleSurfaceState();

        PaneBounds left;
        PaneBounds right;
        string currentVisibility;
        string currentRightMode;
        string currentLeftMode;
        string currentLayoutProfile;
        bool currentFullscreenActive;
        lock (StateLock)
        {
            left = new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
            right = new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height);
            currentVisibility = visibilityMode;
            currentRightMode = rightMode;
            currentLeftMode = leftMode;
            currentLayoutProfile = layoutProfile;
            currentFullscreenActive = fullscreenActive;
        }

        bool compactLayout = String.Equals(currentLayoutProfile, "compact", StringComparison.OrdinalIgnoreCase);

        if (IsHeartbeatFresh())
        {
            TryCompleteSurfaceClaims(
                left,
                right,
                currentVisibility,
                currentLeftMode,
                currentRightMode,
                currentLayoutProfile
            );
        }
        else if (HasPendingSurfaceClaim())
        {
            /* A stale extension lease may never complete a delayed HWND claim. */
            ClearPendingSurfaceClaims();
        }

        TargetInfo leftTarget = compactLayout
            ? FindCompactSurfaceTarget(left, currentLeftMode)
            : FindWideSurfaceTarget(left, "left", currentLeftMode);

        bool rightBrowserSurface =
            String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase);

        TargetInfo rightTarget = !compactLayout && rightBrowserSurface
            ? FindWideSurfaceTarget(right, "right", currentRightMode)
            : null;

        TargetInfo twitchTopLeft = null;
        TargetInfo twitchTopRight = null;
        if (!compactLayout && String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            twitchTopLeft = TryBuildTrustedOperaTarget(GetWideTwitchClusterHandle("a"));
            twitchTopRight = TryBuildTrustedOperaTarget(GetWideTwitchClusterHandle("b"));
            // Never attach the Twitch titlebar chrome to C/D just because one
            // of the upper two claims has not completed yet.
            rightTarget = twitchTopLeft ?? twitchTopRight;
        }

        /*
         * Explorer/taskbar identity is never an HWND discovery mechanism now.
         * Only successful extension claims register shell HWNDs. This routine
         * merely repairs identities and keeps observed normal Opera separate.
         */
        SyncTaskbarIntegration(currentVisibility, compactLayout, leftTarget);

        string effectiveVisibility = ComputeNativeEffectiveVisibility(
            compactLayout,
            leftTarget,
            currentRightMode,
            right
        );
        lastEffectiveVisibility = effectiveVisibility;

        string visibilityKey =
            currentLayoutProfile + "|" +
            (currentVisibility ?? "none") + ">" + effectiveVisibility + "|" +
            (leftTarget != null ? leftTarget.Handle.ToInt64().ToString("X") : "0") + "|" +
            GetForegroundWindow().ToInt64().ToString("X");

        if (!String.Equals(nativeVisibilityDiagnosticKey, visibilityKey, StringComparison.Ordinal))
        {
            nativeVisibilityDiagnosticKey = visibilityKey;
            LogDiagnostic(
                "visibility layout=" + currentLayoutProfile +
                " browser=" + (currentVisibility ?? "none") +
                " native=" + effectiveVisibility +
                " heartbeat=" + (IsHeartbeatFresh() ? "fresh" : "stale") +
                " leftTarget=" + DescribeTarget(leftTarget) +
                " foreground=" + DescribeWindow(GetForegroundWindow())
            );
        }

        bool explicitShellFullscreen =
            currentFullscreenActive &&
            leftTarget != null &&
            IsTrustedShellTarget(leftTarget) &&
            (
                compactLayout ||
                (
                    String.Equals(effectiveVisibility, "shell", StringComparison.OrdinalIgnoreCase) &&
                    IsCompactForegroundTarget(leftTarget)
                )
            );

        bool spanningShellFullscreen =
            explicitShellFullscreen ||
            (compactLayout
                ? ShouldSuppressChromeForCompactForeground(leftTarget, left)
                : ShouldSuppressChromeForSpanningForeground(effectiveVisibility, left, right));

        if (spanningShellFullscreen)
        {
            SuspendAltTabOwnershipForSpanningFullscreen();
        }
        else
        {
            SyncAltTabIntegration(effectiveVisibility, leftTarget, rightTarget, currentRightMode, left, right);
        }

        // Alt+Tab ownership can itself change sibling HWND z-order. Audit only
        // AFTER owner reconciliation; doing it earlier would be immediately
        // undone by the same native tick.
        // Twitch A-D only: preserve 0.19.24's proven recovery while Twitch
        // is selected. Dashboard restoration is event-driven, never polled.
        if (!compactLayout && !spanningShellFullscreen && IsHeartbeatFresh() &&
            String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            RepairWideTwitchClusterZOrder();
        }

        SyncWindowChromeTheme(effectiveVisibility);

        // True fullscreen hides our own custom chrome only. Compact treats the
        // explicit provider Fullscreen API signal as authoritative even after
        // focus moves to another application. Wide keeps its established
        // foreground/geometry behavior unchanged. The provider HWND itself is
        // never resized or restyled here.
        if (spanningShellFullscreen)
        {
            HideChromeBackdrop();
            HideRightChrome();
            HideOverlay(leftOverlay, true);
            return;
        }

        if (!firstSyncLogged)
        {
            firstSyncLogged = true;
            IntPtr firstForeground = GetForegroundWindow();
            LogDiagnostic(
                "first sync: left=" + DescribeTarget(leftTarget) +
                "; right=" + DescribeTarget(rightTarget) +
                "; foreground=" + DescribeWindow(firstForeground) +
                "; browserVisibility=" + currentVisibility +
                "; nativeVisibility=" + effectiveVisibility
            );
        }

        /*
         * Compact remains strict foreground-only. Wide is split-screen by design:
         * an unrelated foreground window on the opposite pane must not expose
         * Opera's stock titlebar on the still-visible Stream Shell pane. Wide
         * therefore keeps its TOPMOST chrome only while the foreign foreground
         * does not meaningfully overlap the left titlebar band.
         */
        bool showLeftChrome = compactLayout
            ? (!String.Equals(effectiveVisibility, "none", StringComparison.OrdinalIgnoreCase) &&
               IsTrustedShellTarget(leftTarget))
            : CanKeepWideLeftChromeWithForeignForeground(leftTarget);

        if (!showLeftChrome)
        {
            HideChromeBackdrop();
            HideOverlay(leftOverlay, true);
        }
        else
        {
            PositionChromeBackdrop(leftTarget);
            PositionOverlay(leftOverlay, leftTarget, true);
        }

        /* Right Dashboard chrome is HWND-owned/non-TOPMOST and therefore keeps
         * the established side-by-side behavior while unrelated windows cover it
         * naturally through the owner z-order. */
        if (!compactLayout && ShouldShowRightChrome(rightTarget, currentRightMode))
        {
            PositionRightChrome(rightTarget);
            if (String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase) &&
                twitchTopLeft != null && twitchTopRight != null &&
                ShouldShowRightChrome(twitchTopRight, currentRightMode))
            {
                PositionRightSplitChrome(twitchTopRight);
            }
            else
            {
                HideRightSplitChrome();
            }
        }
        else
        {
            HideRightChrome();
        }
    }


}
