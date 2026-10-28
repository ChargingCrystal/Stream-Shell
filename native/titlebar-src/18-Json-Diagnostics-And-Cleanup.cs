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

// Original v0.20.12 source: lines 7762-7924.
internal static partial class StreamShellTitlebarHost
{
    private static string GetJsonString(string json, string property)
    {
        Match match = Regex.Match(
            json,
            "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"",
            RegexOptions.IgnoreCase
        );

        if (!match.Success)
        {
            return null;
        }

        string value = match.Groups[1].Value;
        value = value.Replace("\\\\", "\\");
        value = value.Replace("\\\"", "\"");
        value = value.Replace("\\n", "\n");
        value = value.Replace("\\r", "\r");
        value = value.Replace("\\t", "\t");
        return value;
    }

    private static bool GetJsonBool(string json, string property, bool fallback)
    {
        Match match = Regex.Match(
            json,
            "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*(true|false)",
            RegexOptions.IgnoreCase
        );

        if (!match.Success)
        {
            return fallback;
        }

        return String.Equals(match.Groups[1].Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    private static int GetJsonInt(string json, string property, int fallback)
    {
        Match match = Regex.Match(
            json,
            "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*(-?\\d+)",
            RegexOptions.IgnoreCase
        );

        int value;
        return match.Success && Int32.TryParse(match.Groups[1].Value, out value) ? value : fallback;
    }

    private static string JsonEscape(string value)
    {
        return (value ?? String.Empty)
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private static string DescribeWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return "none";
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr geometryHandle = root != IntPtr.Zero ? root : hWnd;
        RECT rect;
        string rectText = GetWindowRect(geometryHandle, out rect)
            ? rect.Left + "," + rect.Top + " " +
              Math.Max(0, rect.Right - rect.Left) + "x" + Math.Max(0, rect.Bottom - rect.Top)
            : "unavailable";

        return GetProcessName(geometryHandle) +
            " hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " root=0x" + geometryHandle.ToInt64().ToString("X") +
            " rect=" + rectText;
    }

    private static string DescribeTarget(TargetInfo target)
    {
        if (target == null)
        {
            return "none";
        }

        return target.ProcessName +
            " hwnd=0x" + target.Handle.ToInt64().ToString("X") +
            " rect=" + target.Rect.Left + "," + target.Rect.Top +
            " " + (target.Rect.Right - target.Rect.Left) + "x" + (target.Rect.Bottom - target.Rect.Top) +
            " title=" + target.TitlebarHeight +
            " captionLeft=" + target.CaptionLeft;
    }

    private static void ResetDiagnosticLog()
    {
        try
        {
            File.WriteAllText(
                DiagnosticLogPath,
                "Stream Shell titlebar helper " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + Environment.NewLine
            );
        }
        catch
        {
        }
    }

    private static void LogDiagnostic(string message)
    {
        try
        {
            File.AppendAllText(
                DiagnosticLogPath,
                DateTime.Now.ToString("HH:mm:ss.fff") + "  " + message + Environment.NewLine
            );
        }
        catch
        {
        }
    }

    // Durable, low-volume performance black box. Not reset when the native
    // host restarts; incidents survive Opera crashes and session boundaries.
    private static readonly object PerformanceFileLock = new object();
    private static readonly string PerformanceLogDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "StreamShell", "Logs"
    );
    private static System.Threading.Timer PerformanceHeartbeatTimer;
    private static int PerformanceLastHeartbeatTick = Environment.TickCount;
    private static int PerformanceGapAlreadyLogged = 0;

    private static void WritePerformanceIncident(string origin, string kind, int durationMs, bool visible)
    {
        try
        {
            // Fixed allowed values only: no browsing history, titles, URLs,
            // access tokens or extension payloads are ever written here.
            string source = origin == "landing" || origin == "dashboard" ||
                origin == "background" ? origin : "native";
            string category = kind == "renderer-timer-gap" ||
                kind == "renderer-long-task" ||
                kind == "background-timer-gap" ||
                kind == "native-heartbeat-gap" ||
                kind == "native-overlay-stall" ||
                kind == "native-start" ? kind : "unknown";
            int safeMs = Math.Max(0, Math.Min(86400000, durationMs));
            lock (PerformanceFileLock)
            {
                Directory.CreateDirectory(PerformanceLogDirectory);
                string path = Path.Combine(PerformanceLogDirectory,
                    "performance-" + DateTime.Now.ToString("yyyy-MM-dd") + ".jsonl");
                // 4 MiB/day cap; rotate rather than indefinitely growing one file.
                if (File.Exists(path) && new FileInfo(path).Length >= 4 * 1024 * 1024)
                {
                    string old = path + ".1";
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(path, old);
                }
                string line = "{\"at\":\"" + DateTime.UtcNow.ToString("o") +
                    "\",\"source\":\"" + source +
                    "\",\"kind\":\"" + category +
                    "\",\"durationMs\":" + safeMs.ToString() +
                    ",\"visible\":" + (visible ? "true" : "false") +
                    ",\"nativePid\":" + Process.GetCurrentProcess().Id.ToString() + "}";
                File.AppendAllText(path, line + Environment.NewLine, new UTF8Encoding(false));
            }
        }
        catch (Exception ex)
        {
            // Logging is best-effort; NEVER break the native messaging port.
            if (NativeHealth.ShouldLogFault("performance-file"))
                LogDiagnostic("performance-file: " + ex.GetType().Name);
        }
    }

    private static void StartPerformanceHeartbeatWatchdog()
    {
        Interlocked.Exchange(ref PerformanceLastHeartbeatTick, Environment.TickCount);
        WritePerformanceIncident("native", "native-start", 0, false);
        PerformanceHeartbeatTimer = new System.Threading.Timer(delegate(object state)
        {
            int then = Interlocked.CompareExchange(ref PerformanceLastHeartbeatTick, 0, 0);
            uint gap = unchecked((uint)(Environment.TickCount - then));
            if (gap >= 30000 && Interlocked.CompareExchange(ref PerformanceGapAlreadyLogged, 1, 0) == 0)
                WritePerformanceIncident("native", "native-heartbeat-gap",
                    (int)Math.Min(gap, 86400000u), false);
        }, null, 15000, 15000);
        // Prune old daily files at startup only, not on the hot path.
        try
        {
            foreach (string path in Directory.GetFiles(PerformanceLogDirectory, "performance-*.jsonl*"))
            {
                if (File.GetLastWriteTimeUtc(path) < DateTime.UtcNow.AddDays(-14))
                    File.Delete(path);
            }
        }
        catch { }
    }

    private static void MarkPerformanceHeartbeat()
    {
        Interlocked.Exchange(ref PerformanceLastHeartbeatTick, Environment.TickCount);
        Interlocked.Exchange(ref PerformanceGapAlreadyLogged, 0);
    }

    private static void CleanupWindows()
    {
        lock (StateLock)
        {
            PendingSurfaceClaims.Clear();
            CompactSurfaceWindows.Clear();
            WideSurfaceWindows.Clear();
            WideTwitchClusterWindows.Clear();
            WideTwitchClaimBrowserWindowIds.Clear();
            protocolCompatible = false;
        }

        CleanupOverlay(ref leftChromeOverlay);
        CleanupOverlay(ref rightChromeOverlay);
        CleanupOverlay(ref rightCaptionBlockerOverlay);
        CleanupOverlay(ref rightSplitChromeOverlay);
        CleanupOverlay(ref rightSplitCaptionBlockerOverlay);
        CleanupOverlay(ref leftOverlay);
        CleanupOverlay(ref rightOverlay);
        ResetWindowChromeThemes();
        DisposeAltTabIntegration();
        DisposeTaskbarIntegration();
        DisposeButtonIcons();

        if (controllerWindow != IntPtr.Zero)
        {
            try { DestroyWindow(controllerWindow); } catch { }
            controllerWindow = IntPtr.Zero;
        }
    }

    private static void CleanupOverlay(ref IntPtr overlay)
    {
        if (overlay != IntPtr.Zero)
        {
            try { ShowWindow(overlay, SW_HIDE); } catch { }
            try { DestroyWindow(overlay); } catch { }
            overlay = IntPtr.Zero;
        }
    }
}
