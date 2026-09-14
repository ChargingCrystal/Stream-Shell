using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

internal static class StreamShellDiscordHost
{
    private const int SW_SHOW = 5;
    private const int SW_RESTORE = 9;
    private const int SW_MINIMIZE = 6;
    private const int GWL_EXSTYLE = -20;
    private const uint WS_EX_TOOLWINDOW = 0x00000080;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SWP_NOSENDCHANGING = 0x0400;
    private const int SM_XVIRTUALSCREEN = 76;
    private const int SM_YVIRTUALSCREEN = 77;
    private const int SM_CYVIRTUALSCREEN = 79;
    private static readonly IntPtr HWND_TOP = IntPtr.Zero;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WINDOWPLACEMENT
    {
        public int length;
        public int flags;
        public int showCmd;
        public POINT ptMinPosition;
        public POINT ptMaxPosition;
        public RECT rcNormalPosition;
    }

    private sealed class WindowCandidate
    {
        public IntPtr Handle;
        public int Score;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X,
        int Y,
        int cx,
        int cy,
        uint uFlags
    );

    public static int Main()
    {
        try
        {
            string json = ReadMessage();
            if (String.IsNullOrWhiteSpace(json))
            {
                WriteResponse(false, false, false, null, "Empty native message.");
                return 1;
            }

            string action = GetJsonString(json, "action") ?? String.Empty;
            string preferredPath = GetJsonString(json, "executablePath");

            if (action.Equals("show", StringComparison.OrdinalIgnoreCase))
            {
                int left = GetJsonInt(json, "left", 1920);
                int top = GetJsonInt(json, "top", 0);
                int width = GetJsonInt(json, "width", 1920);
                int height = GetJsonInt(json, "height", 1080);

                string resolvedPath;
                IntPtr window = FindDiscordMainWindow(out resolvedPath);

                /*
                 * Normal Stream Shell switching leaves Discord alive and
                 * unminimized underneath Dashboard. In that common case we can
                 * simply bring the same real BrowserWindow back to the front.
                 */
                if (window != IntPtr.Zero && !IsIconic(window))
                {
                    bool visible = RestoreAndPosition(window, left, top, width, height);
                    WriteResponse(visible, IsStableDiscordRunning(), visible, resolvedPath, visible ? null : "Stable Discord main window could not be focused.");
                    return visible ? 0 : 4;
                }

                /*
                 * If the user manually minimized/closed Discord to tray, ask
                 * Discord's normal Squirrel launcher to activate the existing
                 * single instance. This is safer than restoring an arbitrary
                 * Electron HWND. Afterwards we reacquire the real main window.
                 */
                string executable = ResolveStableDiscordExecutable(preferredPath);
                if (String.IsNullOrWhiteSpace(resolvedPath))
                {
                    resolvedPath = executable;
                }

                if (window != IntPtr.Zero)
                {
                    ShowWindow(window, SW_SHOW);
                    ShowWindow(window, SW_RESTORE);
                }

                RequestDiscordActivation(executable);

                for (int i = 0; i < 60; i++)
                {
                    Thread.Sleep(100);
                    string currentPath;
                    IntPtr current = FindDiscordMainWindow(out currentPath);
                    if (!String.IsNullOrWhiteSpace(currentPath))
                    {
                        resolvedPath = currentPath;
                    }

                    if (current == IntPtr.Zero)
                    {
                        continue;
                    }

                    ShowWindow(current, SW_SHOW);
                    ShowWindow(current, SW_RESTORE);

                    if (RestoreAndPosition(current, left, top, width, height))
                    {
                        WriteResponse(true, true, true, resolvedPath, null);
                        return 0;
                    }
                }

                WriteResponse(false, IsStableDiscordRunning(), false, resolvedPath, "Stable Discord main window was not found or restored.");
                return 2;
            }

            if (action.Equals("hide", StringComparison.OrdinalIgnoreCase))
            {
                string resolvedPath;
                IntPtr window = FindDiscordMainWindow(out resolvedPath);

                if (window != IntPtr.Zero)
                {
                    ShowWindow(window, SW_MINIMIZE);
                    Thread.Sleep(50);
                    ParkMinimizedDiscordWindow(window);
                }

                WriteResponse(true, IsStableDiscordRunning(), false, resolvedPath, null);
                return 0;
            }

            if (action.Equals("status", StringComparison.OrdinalIgnoreCase))
            {
                string resolvedPath;
                IntPtr window = FindDiscordMainWindow(out resolvedPath);
                bool visible = IsUsableVisibleMainWindow(window);
                WriteResponse(true, IsStableDiscordRunning(), visible, resolvedPath, null);
                return 0;
            }

            if (action.Equals("foreground", StringComparison.OrdinalIgnoreCase))
            {
                IntPtr window = GetForegroundWindow();
                RECT rect;

                if (window == IntPtr.Zero || !GetWindowRect(window, out rect))
                {
                    WriteForegroundResponse(true, false, 0, 0, 0, 0, null);
                    return 0;
                }

                WriteForegroundResponse(
                    true,
                    true,
                    rect.Left,
                    rect.Top,
                    Math.Max(0, rect.Right - rect.Left),
                    Math.Max(0, rect.Bottom - rect.Top),
                    null
                );
                return 0;
            }

            WriteResponse(false, IsStableDiscordRunning(), false, null, "Unknown action.");
            return 3;
        }
        catch (Exception ex)
        {
            WriteResponse(false, false, false, null, ex.Message);
            return 10;
        }
    }

    private static void ParkMinimizedDiscordWindow(IntPtr window)
    {
        if (window == IntPtr.Zero || !IsIconic(window))
        {
            return;
        }

        int virtualLeft = GetSystemMetrics(SM_XVIRTUALSCREEN);
        int virtualTop = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int virtualHeight = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
        int virtualBottom = virtualTop + virtualHeight;

        RECT rect;
        if (GetWindowRect(window, out rect) &&
            rect.Right < virtualLeft &&
            rect.Top > virtualBottom)
        {
            return;
        }

        // A minimized Electron/Chromium HWND can surface as a small legacy
        // desktop tile. Keep Discord minimized, but move only that iconic
        // representation outside the virtual desktop. RestoreAndPosition()
        // reapplies the normal right-pane bounds when Discord is shown again.
        SetWindowPos(
            window,
            IntPtr.Zero,
            virtualLeft - 640,
            virtualBottom + 240,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
    }

    private static bool RestoreAndPosition(IntPtr window, int left, int top, int width, int height)
    {
        if (window == IntPtr.Zero)
        {
            return false;
        }

        ShowWindow(window, SW_SHOW);
        ShowWindow(window, SW_RESTORE);
        Thread.Sleep(50);
        SetWindowPos(window, HWND_TOP, left, top, width, height, SWP_SHOWWINDOW);
        SetForegroundWindow(window);
        Thread.Sleep(80);

        return IsUsableVisibleMainWindow(window);
    }

    private static void RequestDiscordActivation(string executable)
    {
        string root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Discord"
        );

        string updater = Path.Combine(root, "Update.exe");

        try
        {
            if (File.Exists(updater))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = updater,
                    Arguments = "--processStart Discord.exe",
                    WorkingDirectory = root,
                    UseShellExecute = true
                });
                return;
            }
        }
        catch
        {
        }

        try
        {
            if (!String.IsNullOrWhiteSpace(executable) && File.Exists(executable))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = executable,
                    WorkingDirectory = Path.GetDirectoryName(executable),
                    UseShellExecute = true
                });
            }
        }
        catch
        {
        }
    }

    private static IntPtr FindDiscordMainWindow(out string resolvedPath)
    {
        resolvedPath = null;
        HashSet<int> processIds = new HashSet<int>();

        foreach (Process process in Process.GetProcessesByName("Discord"))
        {
            try
            {
                string path = process.MainModule.FileName;
                if (!IsStableDiscordPath(path))
                {
                    continue;
                }

                resolvedPath = path;
                processIds.Add(process.Id);
            }
            catch
            {
            }
            finally
            {
                process.Dispose();
            }
        }

        if (processIds.Count == 0)
        {
            return IntPtr.Zero;
        }

        WindowCandidate best = null;

        EnumWindows(
            delegate(IntPtr hWnd, IntPtr lParam)
            {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);

                if (!processIds.Contains((int)pid))
                {
                    return true;
                }

                int score = ScoreDiscordMainWindow(hWnd);
                if (score < 0)
                {
                    return true;
                }

                if (best == null || score > best.Score)
                {
                    best = new WindowCandidate
                    {
                        Handle = hWnd,
                        Score = score
                    };
                }

                return true;
            },
            IntPtr.Zero
        );

        return best != null && best.Score >= 900
            ? best.Handle
            : IntPtr.Zero;
    }

    private static int ScoreDiscordMainWindow(IntPtr hWnd)
    {
        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
        if ((((uint)exStyle) & WS_EX_TOOLWINDOW) != 0)
        {
            return -1;
        }

        string className = ReadClassName(hWnd);
        if (!className.StartsWith("Chrome_WidgetWin_", StringComparison.OrdinalIgnoreCase))
        {
            return -1;
        }

        RECT normalRect;
        if (!TryGetNormalRect(hWnd, out normalRect))
        {
            return -1;
        }

        int width = Math.Max(0, normalRect.Right - normalRect.Left);
        int height = Math.Max(0, normalRect.Bottom - normalRect.Top);

        /*
         * Electron utility/IME/GPU HWNDs are tiny. Discord's real desktop
         * BrowserWindow is comfortably larger even when currently minimized.
         */
        if (width < 600 || height < 400)
        {
            return -1;
        }

        string title = ReadWindowText(hWnd);
        int score = 1000;

        if (title.Equals("Discord", StringComparison.OrdinalIgnoreCase))
        {
            score += 1000;
        }
        else if (title.IndexOf("Discord", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            score += 800;
        }
        else if (!String.IsNullOrWhiteSpace(title))
        {
            score += 100;
        }

        if (IsWindowVisible(hWnd))
        {
            score += 100;
        }

        if (!IsIconic(hWnd))
        {
            score += 50;
        }

        if (width >= 1000 && height >= 600)
        {
            score += 100;
        }

        return score;
    }

    private static bool TryGetNormalRect(IntPtr hWnd, out RECT rect)
    {
        WINDOWPLACEMENT placement = new WINDOWPLACEMENT();
        placement.length = Marshal.SizeOf(typeof(WINDOWPLACEMENT));

        if (GetWindowPlacement(hWnd, ref placement))
        {
            rect = placement.rcNormalPosition;
            int width = rect.Right - rect.Left;
            int height = rect.Bottom - rect.Top;

            if (width > 0 && height > 0)
            {
                return true;
            }
        }

        return GetWindowRect(hWnd, out rect);
    }

    private static bool IsUsableVisibleMainWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindowVisible(hWnd) || IsIconic(hWnd))
        {
            return false;
        }

        return ScoreDiscordMainWindow(hWnd) >= 900;
    }

    private static string ReadWindowText(IntPtr hWnd)
    {
        StringBuilder buffer = new StringBuilder(512);
        GetWindowText(hWnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static string ReadClassName(IntPtr hWnd)
    {
        StringBuilder buffer = new StringBuilder(256);
        GetClassName(hWnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static bool IsStableDiscordRunning()
    {
        foreach (Process process in Process.GetProcessesByName("Discord"))
        {
            try
            {
                if (IsStableDiscordPath(process.MainModule.FileName))
                {
                    return true;
                }
            }
            catch
            {
            }
            finally
            {
                process.Dispose();
            }
        }

        return false;
    }

    private static bool IsStableDiscordPath(string path)
    {
        if (String.IsNullOrWhiteSpace(path))
        {
            return false;
        }

        string stableRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Discord"
        );

        string normalizedRoot = Path.GetFullPath(stableRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;

        string normalizedPath;
        try
        {
            normalizedPath = Path.GetFullPath(path);
        }
        catch
        {
            return false;
        }

        return normalizedPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase)
            && Path.GetFileName(normalizedPath).Equals("Discord.exe", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveStableDiscordExecutable(string preferredPath)
    {
        if (!String.IsNullOrWhiteSpace(preferredPath) && File.Exists(preferredPath) && IsStableDiscordPath(preferredPath))
        {
            return Path.GetFullPath(preferredPath);
        }

        string root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Discord"
        );

        if (!Directory.Exists(root))
        {
            return null;
        }

        try
        {
            return Directory.GetDirectories(root, "app-*")
                .Select(dir => new
                {
                    Directory = dir,
                    Exe = Path.Combine(dir, "Discord.exe"),
                    Version = ParseVersion(Path.GetFileName(dir).Substring(4))
                })
                .Where(item => File.Exists(item.Exe))
                .OrderByDescending(item => item.Version)
                .ThenByDescending(item => item.Directory, StringComparer.OrdinalIgnoreCase)
                .Select(item => item.Exe)
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    private static Version ParseVersion(string value)
    {
        Version version;
        return Version.TryParse(value, out version) ? version : new Version(0, 0, 0, 0);
    }

    private static string ReadMessage()
    {
        Stream input = Console.OpenStandardInput();
        byte[] lengthBytes = new byte[4];
        int read = input.Read(lengthBytes, 0, 4);
        if (read != 4)
        {
            return null;
        }

        int length = BitConverter.ToInt32(lengthBytes, 0);
        if (length <= 0 || length > 1024 * 1024)
        {
            return null;
        }

        byte[] payload = new byte[length];
        int offset = 0;

        while (offset < length)
        {
            int count = input.Read(payload, offset, length - offset);
            if (count <= 0)
            {
                break;
            }

            offset += count;
        }

        return offset == length ? Encoding.UTF8.GetString(payload) : null;
    }

    private static void WriteResponse(bool ok, bool running, bool visible, string path, string error)
    {
        string json = "{"
            + "\"ok\":" + (ok ? "true" : "false") + ","
            + "\"running\":" + (running ? "true" : "false") + ","
            + "\"visible\":" + (visible ? "true" : "false") + ","
            + "\"path\":" + JsonString(path) + ","
            + "\"error\":" + JsonString(error)
            + "}";

        WriteMessage(json);
    }

    private static void WriteForegroundResponse(bool ok, bool hasWindow, int left, int top, int width, int height, string error)
    {
        string json = "{"
            + "\"ok\":" + (ok ? "true" : "false") + ","
            + "\"hasWindow\":" + (hasWindow ? "true" : "false") + ","
            + "\"left\":" + left + ","
            + "\"top\":" + top + ","
            + "\"width\":" + width + ","
            + "\"height\":" + height + ","
            + "\"error\":" + JsonString(error)
            + "}";

        WriteMessage(json);
    }

    private static void WriteMessage(string json)
    {
        byte[] payload = Encoding.UTF8.GetBytes(json);
        Stream output = Console.OpenStandardOutput();
        byte[] length = BitConverter.GetBytes(payload.Length);
        output.Write(length, 0, length.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    private static string GetJsonString(string json, string key)
    {
        Match match = Regex.Match(
            json,
            "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"",
            RegexOptions.IgnoreCase
        );

        if (!match.Success)
        {
            return null;
        }

        return Regex.Unescape(match.Groups[1].Value);
    }

    private static int GetJsonInt(string json, string key, int fallback)
    {
        Match match = Regex.Match(
            json,
            "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*(-?\\d+)",
            RegexOptions.IgnoreCase
        );

        int value;
        return match.Success && Int32.TryParse(match.Groups[1].Value, out value)
            ? value
            : fallback;
    }

    private static string JsonString(string value)
    {
        if (value == null)
        {
            return "null";
        }

        return "\"" + value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("\t", "\\t")
            + "\"";
    }
}
