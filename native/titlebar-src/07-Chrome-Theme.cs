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

// Original v0.20.12 source: lines 3917-4161.
internal static partial class StreamShellTitlebarHost
{
    private static byte ThemeChannel(int component, int floor, double intensity)
    {
        return (byte)Math.Max(0, Math.Min(255, floor + (int)Math.Round(component * intensity)));
    }

    private static uint DarkThemeColor(int red, int green, int blue, int floorR, int floorG, int floorB, double intensity)
    {
        return Rgb(ThemeChannel(red, floorR, intensity), ThemeChannel(green, floorG, intensity),
            ThemeChannel(blue, floorB, intensity));
    }

    private static ChromeTheme CustomChromeTheme(string color)
    {
        int r = Convert.ToInt32(color.Substring(1, 2), 16);
        int g = Convert.ToInt32(color.Substring(3, 2), 16);
        int b = Convert.ToInt32(color.Substring(5, 2), 16);
        return new ChromeTheme(
            DarkThemeColor(r, g, b, 7, 6, 10, 0.13),
            DarkThemeColor(r, g, b, 12, 10, 15, 0.20),
            DarkThemeColor(r, g, b, 20, 15, 24, 0.32),
            DarkThemeColor(r, g, b, 31, 27, 36, 0.32),
            DarkThemeColor(r, g, b, 7, 6, 10, 0.13),
            DarkThemeColor(r, g, b, 22, 18, 28, 0.27)
        );
    }

    private static ChromeTheme GetChromeTheme(string mode)
    {
        // User colors tint the actual Titlebar/DWM palette, not merely icons.
        // Existing five built-in palettes are preserved when no override exists.
        lock (StateLock)
        {
            foreach (ButtonDef button in DynamicProviderButtons)
            {
                if (String.Equals(button.Action, mode, StringComparison.OrdinalIgnoreCase)
                    && !String.IsNullOrEmpty(button.AccentColor))
                    return CustomChromeTheme(button.AccentColor);
            }
        }
        if (String.Equals(mode, "youtube", StringComparison.OrdinalIgnoreCase))
        {
            return new ChromeTheme(
                Rgb(31, 2, 9),
                Rgb(46, 5, 14),
                Rgb(78, 6, 22),
                Rgb(99, 31, 45),
                Rgb(31, 2, 9),
                Rgb(74, 9, 24)
            );
        }

        if (String.Equals(mode, "netflix", StringComparison.OrdinalIgnoreCase))
        {
            return new ChromeTheme(
                Rgb(27, 2, 5),
                Rgb(42, 5, 9),
                Rgb(70, 7, 13),
                Rgb(92, 29, 35),
                Rgb(27, 2, 5),
                Rgb(69, 8, 14)
            );
        }

        if (String.Equals(mode, "prime", StringComparison.OrdinalIgnoreCase))
        {
            return new ChromeTheme(
                Rgb(2, 19, 29),
                Rgb(4, 31, 45),
                Rgb(5, 50, 69),
                Rgb(34, 78, 96),
                Rgb(2, 19, 29),
                Rgb(7, 63, 88)
            );
        }

        if (String.Equals(mode, "disney", StringComparison.OrdinalIgnoreCase))
        {
            return new ChromeTheme(
                Rgb(7, 11, 31),
                Rgb(12, 18, 48),
                Rgb(21, 29, 72),
                Rgb(48, 55, 102),
                Rgb(7, 11, 31),
                Rgb(30, 40, 94)
            );
        }

        if (String.Equals(mode, "crunchyroll", StringComparison.OrdinalIgnoreCase))
        {
            return new ChromeTheme(
                Rgb(32, 12, 2),
                Rgb(48, 20, 5),
                Rgb(73, 31, 8),
                Rgb(104, 58, 31),
                Rgb(32, 12, 2),
                Rgb(89, 37, 9)
            );
        }

        // Landing / generic Stream Shell chrome keeps the original purple.
        return new ChromeTheme(
            Rgb(12, 2, 18),
            Rgb(28, 13, 35),
            Rgb(48, 12, 61),
            Rgb(72, 57, 80),
            Rgb(24, 11, 29),
            Rgb(55, 31, 63)
        );
    }

    private static void SyncWindowChromeTheme(string currentVisibility)
    {
        // Only windows that were proven to be Stream Shell by the extension's
        // focused-window state are allowed into TaskbarShellWindows. Reuse that
        // trusted set for DWM theming instead of guessing by screen geometry.
        if (!String.Equals(currentVisibility, "shell", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        string mode;
        lock (StateLock) { mode = leftMode; }

        List<IntPtr> windows;
        lock (TaskbarShellWindows)
        {
            windows = new List<IntPtr>(TaskbarShellWindows);
        }

        foreach (IntPtr hWnd in windows)
        {
            if (hWnd != IntPtr.Zero && IsWindow(hWnd))
            {
                ApplyWindowChromeTheme(hWnd, mode, "known-shell");
            }
        }
    }

    private static void ApplyWindowChromeTheme(IntPtr hWnd, string mode, string side)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        string previousMode;
        lock (WindowChromeModes)
        {
            if (WindowChromeModes.TryGetValue(hWnd, out previousMode) &&
                String.Equals(previousMode, mode, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        ChromeTheme theme = GetChromeTheme(mode);
        uint caption = theme.Caption;
        uint border = theme.Border;
        uint text = Rgb(245, 245, 247);

        try
        {
            int captionHr = DwmSetWindowAttribute(hWnd, DWMWA_CAPTION_COLOR, ref caption, sizeof(uint));
            int borderHr = DwmSetWindowAttribute(hWnd, DWMWA_BORDER_COLOR, ref border, sizeof(uint));
            int textHr = DwmSetWindowAttribute(hWnd, DWMWA_TEXT_COLOR, ref text, sizeof(uint));

            lock (WindowChromeModes)
            {
                WindowChromeModes[hWnd] = mode ?? "landing";
            }

            LogDiagnostic(
                "chrome theme " + side +
                " hwnd=0x" + hWnd.ToInt64().ToString("X") +
                " mode=" + (mode ?? "landing") +
                " captionHr=0x" + captionHr.ToString("X8") +
                " borderHr=0x" + borderHr.ToString("X8") +
                " textHr=0x" + textHr.ToString("X8")
            );
        }
        catch (Exception ex)
        {
            LogDiagnostic(
                "chrome theme exception " + side +
                " hwnd=0x" + hWnd.ToInt64().ToString("X") +
                ": " + ex.GetType().Name + ": " + ex.Message
            );
        }
    }

    private static void ResetSingleWindowChromeTheme(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        try
        {
            uint value = DWMWA_COLOR_DEFAULT;
            DwmSetWindowAttribute(hWnd, DWMWA_CAPTION_COLOR, ref value, sizeof(uint));
            value = DWMWA_COLOR_DEFAULT;
            DwmSetWindowAttribute(hWnd, DWMWA_BORDER_COLOR, ref value, sizeof(uint));
            value = DWMWA_COLOR_DEFAULT;
            DwmSetWindowAttribute(hWnd, DWMWA_TEXT_COLOR, ref value, sizeof(uint));
        }
        catch { }

        lock (WindowChromeModes)
        {
            WindowChromeModes.Remove(hWnd);
        }
    }

    private static void ResetWindowChromeThemes()
    {
        List<IntPtr> windows;
        lock (WindowChromeModes)
        {
            windows = new List<IntPtr>(WindowChromeModes.Keys);
            WindowChromeModes.Clear();
        }

        foreach (IntPtr hWnd in windows)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                continue;
            }

            try
            {
                uint value = DWMWA_COLOR_DEFAULT;
                DwmSetWindowAttribute(hWnd, DWMWA_CAPTION_COLOR, ref value, sizeof(uint));
                value = DWMWA_COLOR_DEFAULT;
                DwmSetWindowAttribute(hWnd, DWMWA_BORDER_COLOR, ref value, sizeof(uint));
                value = DWMWA_COLOR_DEFAULT;
                DwmSetWindowAttribute(hWnd, DWMWA_TEXT_COLOR, ref value, sizeof(uint));
            }
            catch
            {
            }
        }
    }

}
