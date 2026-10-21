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

// Original v0.20.12 source: lines 6963-7049.
internal static partial class StreamShellTitlebarHost
{
    private static void SetOwner(IntPtr hWnd, IntPtr owner)
    {
        if (IntPtr.Size == 8)
        {
            SetWindowLongPtr64(hWnd, GWLP_HWNDPARENT, owner);
        }
        else
        {
            SetWindowLong32(hWnd, GWLP_HWNDPARENT, owner.ToInt32());
        }
    }

    private static string GetProcessName(IntPtr hWnd)
    {
        try
        {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == 0)
            {
                return String.Empty;
            }

            using (Process process = Process.GetProcessById((int)pid))
            {
                return process.ProcessName ?? String.Empty;
            }
        }
        catch
        {
            return String.Empty;
        }
    }

    private static bool IsOperaProcess(string processName)
    {
        if (String.IsNullOrWhiteSpace(processName))
        {
            return false;
        }

        string value = processName.ToLowerInvariant();
        return value == "opera" || value == "opera_gx" || value.StartsWith("opera");
    }

    private static int GetTargetDpi(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return DEFAULT_DPI;
        }

        try
        {
            uint dpi = GetDpiForWindow(hWnd);
            if (dpi >= 72 && dpi <= 768)
            {
                return (int)dpi;
            }
        }
        catch
        {
        }

        return DEFAULT_DPI;
    }

    private static int Scale(int value, int dpi)
    {
        return Math.Max(1, (int)Math.Round(value * (dpi / 96.0)));
    }

    private static int SignedLowWord(long value)
    {
        return unchecked((short)(value & 0xFFFF));
    }

    private static int SignedHighWord(long value)
    {
        return unchecked((short)((value >> 16) & 0xFFFF));
    }

    private static uint Rgb(byte r, byte g, byte b)
    {
        return (uint)(r | (g << 8) | (b << 16));
    }

}
