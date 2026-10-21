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

// Original v0.20.12 source: lines 7050-7170.
internal static partial class StreamShellTitlebarHost
{
    private static void ReadLoop()
    {
        try
        {
            while (!shuttingDown)
            {
                string json = ReadMessage();
                if (json == null)
                {
                    break;
                }

                try
                {
                    HandleNativeMessage(json);
                }
                catch (Exception ex)
                {
                    // A malformed or failing single message must not tear down
                    // the native port and orphan all claimed browser surfaces.
                    LogNativeFailure("native-message", ex);
                    // Do not parse the same malformed input again in the
                    // exception handler: that could raise and exit ReadLoop.
                    WriteJson("{\"event\":\"native-command-error\"}");
                }
            }
        }
        catch (Exception ex)
        {
            // EOF/disconnect is expected, but exceptions are essential evidence.
            LogNativeFailure("native-reader", ex);
        }
        finally
        {
            if (!shuttingDown && controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            else if (!shuttingDown)
            {
                PostThreadMessage(mainThreadId, WM_QUIT, UIntPtr.Zero, IntPtr.Zero);
            }
        }
    }

    private static void SendNativeStatus()
    {
        string profile;
        string nativeTwitchTarget;
        string browserVisibility;
        string compactMap;
        string wideMap;
        string pendingKeys;
        string twitchClusterMap;
        int compactCount;
        int wideCount;
        int twitchClusterCount;
        int pendingCount;
        int heartbeatTick;
        bool compatible;
        bool nativeFullscreenActive;
        lock (StateLock)
        {
            profile = layoutProfile;
            nativeTwitchTarget = twitchTarget;
            browserVisibility = visibilityMode;
            compactCount = CompactSurfaceWindows.Count;
            wideCount = WideSurfaceWindows.Count;
            twitchClusterCount = WideTwitchClusterWindows.Count;
            pendingCount = PendingSurfaceClaims.Count;
            heartbeatTick = lastHeartbeatTick;
            compatible = protocolCompatible;
            nativeFullscreenActive = fullscreenActive;

            List<string> compactEntries = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in CompactSurfaceWindows)
            {
                compactEntries.Add(pair.Key + "=0x" + pair.Value.ToInt64().ToString("X"));
            }
            compactMap = String.Join(";", compactEntries.ToArray());

            List<string> wideEntries = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideSurfaceWindows)
            {
                wideEntries.Add(pair.Key + "=0x" + pair.Value.ToInt64().ToString("X"));
            }
            wideMap = String.Join(";", wideEntries.ToArray());

            List<string> twitchClusterEntries = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideTwitchClusterWindows)
            {
                twitchClusterEntries.Add(pair.Key + "=0x" + pair.Value.ToInt64().ToString("X"));
            }
            twitchClusterMap = String.Join(";", twitchClusterEntries.ToArray());

            List<string> claimEntries = new List<string>();
            foreach (string claimKey in PendingSurfaceClaims.Keys)
            {
                claimEntries.Add(claimKey);
            }
            pendingKeys = String.Join(";", claimEntries.ToArray());
        }

        int shellCount;
        lock (TaskbarShellWindows)
        {
            shellCount = TaskbarShellWindows.Count;
        }

        uint heartbeatAgeMs = unchecked((uint)(Environment.TickCount - heartbeatTick));

        WriteJson(
            "{\"event\":\"status\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
            ",\"protocolCompatible\":" + (compatible ? "true" : "false") +
            ",\"layoutProfile\":\"" + JsonEscape(profile ?? "unknown") +
            "\",\"twitchTarget\":\"" + JsonEscape(nativeTwitchTarget ?? "resume") +
            "\",\"browserVisibility\":\"" + JsonEscape(browserVisibility ?? "none") +
            "\",\"effectiveVisibility\":\"" + JsonEscape(lastEffectiveVisibility ?? "none") +
            "\",\"fullscreenActive\":" + (nativeFullscreenActive ? "true" : "false") +
            ",\"heartbeatFresh\":" + (IsHeartbeatFresh() ? "true" : "false") +
            ",\"heartbeatAgeMs\":" + heartbeatAgeMs +
            ",\"callbackFailures\":" + NativeHealth.CallbackFailures +
            ",\"commandFailures\":" + NativeHealth.CommandFailures +
            ",\"fullscreenIdleSkips\":" + NativeHealth.FullCoverIdlePasses +
            ",\"slowOverlaySyncs\":" + NativeHealth.SlowSyncs +
            ",\"compactSurfaces\":" + compactCount +
            ",\"compactSurfaceMap\":\"" + JsonEscape(compactMap) +
            "\",\"wideSurfaces\":" + wideCount +
            ",\"wideSurfaceMap\":\"" + JsonEscape(wideMap) +
            "\",\"twitchClusterMembers\":" + twitchClusterCount +
            ",\"twitchClusterMap\":\"" + JsonEscape(twitchClusterMap) +
            "\",\"shellWindows\":" + shellCount +
            ",\"pendingClaims\":" + pendingCount +
            ",\"pendingClaimKeys\":\"" + JsonEscape(pendingKeys) +
            "\",\"foreground\":\"" + JsonEscape(DescribeWindow(GetForegroundWindow())) + "\"}"
        );
    }


}
