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

// Original v0.20.12 source: lines 7171-7426.
internal static partial class StreamShellTitlebarHost
{
    private static void HandleNativeMessage(string json)
    {
        string type = GetJsonString(json, "type") ?? String.Empty;

        if (type.Equals("shutdown", StringComparison.OrdinalIgnoreCase))
        {
            shuttingDown = true;
            if (controllerWindow != IntPtr.Zero)
                PostMessage(controllerWindow, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            return;
        }

        int protocolVersion = GetJsonInt(json, "protocolVersion", 0);
        if (protocolVersion != TITLEBAR_PROTOCOL_VERSION)
        {
            lock (StateLock)
            {
                protocolCompatible = false;
            }
            LogDiagnostic(
                "protocol mismatch expected=" + TITLEBAR_PROTOCOL_VERSION +
                " received=" + protocolVersion +
                " type=" + type
            );
            ClearPendingSurfaceClaims();
            WriteJson(
                "{\"event\":\"protocol-mismatch\",\"expected\":" + TITLEBAR_PROTOCOL_VERSION +
                ",\"received\":" + protocolVersion + "}"
            );
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        lock (StateLock)
        {
            protocolCompatible = true;
        }
        TouchHeartbeat();

        switch (type.ToLowerInvariant())
        {
        case "hello":
        {
            WriteJson(
                "{\"event\":\"hello-ack\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION + "}"
            );
            return;
        }

        case "heartbeat":
        {
            SendNativeStatus();
            return;
        }

        case "init":
        {
            lock (StateLock)
            {
                leftPane = new PaneBounds(
                    GetJsonInt(json, "left", 0),
                    GetJsonInt(json, "top", 0),
                    GetJsonInt(json, "width", 1920),
                    GetJsonInt(json, "height", 1080)
                );

                rightPane = new PaneBounds(
                    GetJsonInt(json, "rightLeft", 1920),
                    GetJsonInt(json, "rightTop", 0),
                    GetJsonInt(json, "rightWidth", 1920),
                    GetJsonInt(json, "rightHeight", 1080)
                );

                layoutProfile = GetJsonString(json, "layoutProfile") ?? "wide";
                leftMode = GetJsonString(json, "leftMode") ?? "landing";
                rightMode = GetJsonString(json, "rightMode") ?? "dashboard";
                twitchTarget = GetJsonString(json, "twitchTarget") ?? "resume";
                visibilityMode = GetJsonString(json, "visibilityMode") ?? "none";
                settingsOpen = GetJsonBool(json, "settingsOpen", false);
                volumeActive = GetJsonBool(json, "volumeActive", false);
                fullscreenActive = GetJsonBool(json, "fullscreenActive", false);
                volumeShortcut = GetJsonString(json, "volumeShortcut") ?? "";
                initialized = true;
            }

            LogDiagnostic(
                "init received protocol=" + TITLEBAR_PROTOCOL_VERSION +
                " layout=" + layoutProfile +
                ", leftMode=" + leftMode +
                ", rightMode=" + rightMode +
                ", twitchTarget=" + twitchTarget +
                ", visibility=" + visibilityMode
            );

            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }

            WriteJson(
                "{\"event\":\"ready\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION + "}"
            );
            SendNativeStatus();
            return;
        }

        case "provider-buttons":
        {
            int generation = GetJsonInt(json, "generation", 0);
            int count;
            int skippedIcons;
            bool accepted = TryApplyProviderConfig(GetJsonString(json, "payloadB64"), generation, out count, out skippedIcons);
            WriteJson("{\"event\":\"provider-buttons-ack\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
                ",\"generation\":" + generation + ",\"accepted\":" + (accepted ? "true" : "false") +
                ",\"count\":" + count + ",\"skippedIcons\":" + skippedIcons + "}");
            if (accepted && controllerWindow != IntPtr.Zero)
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            if (accepted && leftOverlay != IntPtr.Zero) InvalidateRect(leftOverlay, IntPtr.Zero, false);
            if (accepted && leftChromeOverlay != IntPtr.Zero) InvalidateRect(leftChromeOverlay, IntPtr.Zero, false);
            if (accepted && rightChromeOverlay != IntPtr.Zero) InvalidateRect(rightChromeOverlay, IntPtr.Zero, false);
            return;
        }

        case "set-twitch-pane-fullscreen":
        {
            string member = GetJsonString(json, "member") ?? String.Empty;
            bool enabled = GetJsonBool(json, "enabled", false);
            PaneBounds pane = new PaneBounds(
                GetJsonInt(json, "left", rightPane.Left),
                GetJsonInt(json, "top", rightPane.Top),
                GetJsonInt(json, "width", rightPane.Width),
                GetJsonInt(json, "height", rightPane.Height)
            );
            SetWideTwitchPaneFullscreen(member, enabled, pane);
            return;
        }

        case "reassert-right-pane":
        {
            string selectedMode = GetJsonString(json, "rightMode") ?? String.Empty;
            ReassertWideRightPaneOnce(selectedMode);
            return;
        }

        case "raise-twitch-cluster":
        {
            string selectedMember = GetJsonString(json, "selectedMember") ?? "a";
            RaiseWideTwitchClusterOnce(selectedMember);
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        case "claim-cancel":
        {
            ClearPendingSurfaceClaims();
            return;
        }

        case "claim":
        {
            string claimProfile = GetJsonString(json, "layoutProfile") ?? String.Empty;
            string claimSide = GetJsonString(json, "side") ?? String.Empty;
            string claimMode = GetJsonString(json, "mode") ?? String.Empty;
            string claimMember = GetJsonString(json, "member") ?? String.Empty;
            string titleHint = GetJsonString(json, "titleHint") ?? String.Empty;
            bool hasPaneOverride = !String.IsNullOrWhiteSpace(claimMember);
            PaneBounds claimPane = new PaneBounds(
                GetJsonInt(json, "left", 0),
                GetJsonInt(json, "top", 0),
                GetJsonInt(json, "width", 0),
                GetJsonInt(json, "height", 0)
            );

            QueueSurfaceClaim(
                claimProfile, claimSide, claimMode, claimMember, titleHint, hasPaneOverride, claimPane,
                GetJsonBool(json, "forceRebind", false), GetJsonInt(json, "browserWindowId", 0)
            );
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        case "state":
        {
            lock (StateLock)
            {
                string nextLayoutProfile = GetJsonString(json, "layoutProfile");
                string nextLeft = GetJsonString(json, "leftMode");
                string nextRight = GetJsonString(json, "rightMode");
                string nextTwitchTarget = GetJsonString(json, "twitchTarget");
                string nextVisibility = GetJsonString(json, "visibilityMode");

                if (!String.IsNullOrWhiteSpace(nextLayoutProfile)) layoutProfile = nextLayoutProfile;
                if (!String.IsNullOrWhiteSpace(nextLeft)) leftMode = nextLeft;
                if (!String.IsNullOrWhiteSpace(nextRight)) rightMode = nextRight;
                if (!String.IsNullOrWhiteSpace(nextTwitchTarget)) twitchTarget = nextTwitchTarget;
                if (!String.IsNullOrWhiteSpace(nextVisibility)) visibilityMode = nextVisibility;
                settingsOpen = GetJsonBool(json, "settingsOpen", settingsOpen);
                volumeActive = GetJsonBool(json, "volumeActive", volumeActive);
                fullscreenActive = GetJsonBool(json, "fullscreenActive", fullscreenActive);

                // Display-profile geometry can change while the native host
                // remains connected (for example after docking and reopening
                // Stream Shell). Keep pane discovery synchronized with the
                // extension instead of requiring a native-host restart.
                leftPane = new PaneBounds(
                    GetJsonInt(json, "left", leftPane.Left),
                    GetJsonInt(json, "top", leftPane.Top),
                    GetJsonInt(json, "width", leftPane.Width),
                    GetJsonInt(json, "height", leftPane.Height)
                );

                rightPane = new PaneBounds(
                    GetJsonInt(json, "rightLeft", rightPane.Left),
                    GetJsonInt(json, "rightTop", rightPane.Top),
                    GetJsonInt(json, "rightWidth", rightPane.Width),
                    GetJsonInt(json, "rightHeight", rightPane.Height)
                );
            }

            if (leftChromeOverlay != IntPtr.Zero) InvalidateRect(leftChromeOverlay, IntPtr.Zero, false);
            if (rightChromeOverlay != IntPtr.Zero) InvalidateRect(rightChromeOverlay, IntPtr.Zero, false);
            if (rightCaptionBlockerOverlay != IntPtr.Zero) InvalidateRect(rightCaptionBlockerOverlay, IntPtr.Zero, false);
            if (rightSplitChromeOverlay != IntPtr.Zero) InvalidateRect(rightSplitChromeOverlay, IntPtr.Zero, false);
            if (rightSplitCaptionBlockerOverlay != IntPtr.Zero) InvalidateRect(rightSplitCaptionBlockerOverlay, IntPtr.Zero, false);
            if (leftOverlay != IntPtr.Zero) InvalidateRect(leftOverlay, IntPtr.Zero, false);
            if (rightOverlay != IntPtr.Zero) InvalidateRect(rightOverlay, IntPtr.Zero, false);
            if (controllerWindow != IntPtr.Zero) PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            return;
        }

        case "focus":
        {
            string side = GetJsonString(json, "side") ?? String.Empty;
            if (side.Equals("left", StringComparison.OrdinalIgnoreCase) || side.Equals("right", StringComparison.OrdinalIgnoreCase))
            {
                lock (StateLock)
                {
                    pendingFocusSide = side.ToLowerInvariant();
                }

                if (controllerWindow != IntPtr.Zero) PostMessage(controllerWindow, WM_APP_FOCUS, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

            default:
                // Unknown commands are ignored for forward protocol compatibility.
                return;
        }
    }

}
