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
