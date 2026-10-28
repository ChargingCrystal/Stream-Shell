// Optional native messaging host for Mangayomi: left pane only, no Discord/Twitch coupling.
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32;

internal static class StreamShellMangayomiHost
{
    const int SW_RESTORE = 9, SW_MINIMIZE = 6, SW_SHOW = 5, SW_HIDE = 0;
    const uint SWP_SHOWWINDOW = 0x0040;
    const uint SWP_NOMOVE = 0x0002, SWP_NOSIZE = 0x0001, SWP_NOACTIVATE = 0x0010;
    const uint SWP_HIDEWINDOW = 0x0080;
    static readonly IntPtr HWND_TOP = IntPtr.Zero;

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }
    delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder buffer, int max);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int action);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y,
        int width, int height, uint flags);

    static string ReadMessage()
    {
        using (var stdin = Console.OpenStandardInput())
        {
            byte[] header = new byte[4];
            if (stdin.Read(header, 0, 4) != 4) return "";
            uint size = BitConverter.ToUInt32(header, 0);
            if (size < 2 || size > 65536) return "";
            byte[] payload = new byte[size];
            int read = 0;
            while (read < payload.Length)
            {
                int n = stdin.Read(payload, read, payload.Length - read);
                if (n <= 0) return "";
                read += n;
            }
            return Encoding.UTF8.GetString(payload);
        }
    }

    static string GetString(string json, string key)
    {
        var match = Regex.Match(json, "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"");
        return match.Success ? Regex.Unescape(match.Groups[1].Value) : "";
    }
    static int GetInt(string json, string key, int fallback)
    {
        var match = Regex.Match(json, "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*(-?\\d+)");
        int value;
        return match.Success && int.TryParse(match.Groups[1].Value, out value) ? value : fallback;
    }
    static string Quote(string value)
    {
        return "\"" + (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"")
            .Replace("\r", " ").Replace("\n", " ") + "\"";
    }
    static void Reply(bool ok, bool running, bool visible, string error, string searchResultsJson = null)
    {
        string json = "{\"ok\":" + (ok ? "true" : "false") + ",\"running\":" +
            (running ? "true" : "false") + ",\"visible\":" + (visible ? "true" : "false") +
            ",\"error\":" + (error == null ? "null" : Quote(error)) +
            (searchResultsJson == null ? "" : ",\"searchResultsJson\":" + Quote(searchResultsJson)) + "}";
        byte[] buffer = Encoding.UTF8.GetBytes(json);
        using (var stdout = Console.OpenStandardOutput())
        {
            byte[] size = BitConverter.GetBytes(buffer.Length);
            stdout.Write(size, 0, size.Length);
            stdout.Write(buffer, 0, buffer.Length);
            stdout.Flush();
        }
    }

    // Process.MainWindowHandle can become zero for a hidden Flutter window.
    // Enumerate this process's TOP-LEVEL Win32 HWNDs so the next `show` resumes
    // the SAME Mangayomi process instead of spawning a second instance.
    static IntPtr FindMainWindow(Process process)
    {
        if (process == null || process.HasExited) return IntPtr.Zero;
        process.Refresh();
        IntPtr direct = process.MainWindowHandle;
        if (direct != IntPtr.Zero) return direct;

        IntPtr best = IntPtr.Zero;
        long bestScore = -1;
        uint expectedPid = (uint)process.Id;
        EnumWindows(delegate(IntPtr hwnd, IntPtr unused)
        {
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid != expectedPid) return true;
            RECT rect;
            if (!GetWindowRect(hwnd, out rect)) return true;
            long width = (long)rect.Right - rect.Left;
            long height = (long)rect.Bottom - rect.Top;
            if (width < 320 || height < 240) return true;
            StringBuilder cls = new StringBuilder(256);
            GetClassName(hwnd, cls, cls.Capacity);
            string className = cls.ToString();
            // The normal Windows Flutter runner uses FLUTTER_RUNNER_WIN32_WINDOW.
            // Reject unrelated process helper/dialog windows.
            if (className.IndexOf("FLUTTER", StringComparison.OrdinalIgnoreCase) < 0)
                return true;
            long score = Math.Min(width * height, 100000000L);
            if (IsWindowVisible(hwnd)) score += 100000000L;
            if (score > bestScore) { best = hwnd; bestScore = score; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    // Only use the explicitly configured fork for bridge operations. Windows
    // may have an unpatched stock Mangayomi running under the same process name.
    static Process FindApp(string expectedExe = null, bool requireWindow = true)
    {
        foreach (var process in Process.GetProcessesByName("Mangayomi"))
        {
            try
            {
                if (process.HasExited) { process.Dispose(); continue; }
                if (!String.IsNullOrEmpty(expectedExe) &&
                    !String.Equals(Path.GetFullPath(process.MainModule.FileName),
                        Path.GetFullPath(expectedExe), StringComparison.OrdinalIgnoreCase))
                { process.Dispose(); continue; }
                if (!requireWindow || FindMainWindow(process) != IntPtr.Zero) return process;
            }
            catch { }
            process.Dispose();
        }
        return null;
    }
    static string ConfiguredForkExe(string explicitPath)
    {
        if (String.IsNullOrWhiteSpace(explicitPath)) return null;
        try
        {
            if (!Path.IsPathRooted(explicitPath)) return null;
            string resolved = Path.GetFullPath(explicitPath);
            return Path.GetFileName(resolved).Equals("mangayomi.exe", StringComparison.OrdinalIgnoreCase)
                && File.Exists(resolved) ? resolved : null;
        }
        catch { return null; }
    }
    static bool LocalBridgeEnabled()
    {
        try
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\StreamShell\MangayomiBridge"))
            {
                if (key == null || !Object.Equals(key.GetValue("DirectSearchEnabled"), 1)) return false;
            }
            string marker = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "StreamShell", "mangayomi-bridge.enabled");
            return File.Exists(marker);
        }
        catch { return false; }
    }
    // A stale descriptor can survive an abnormal process exit. Check its PID
    // against the actual patched fork before connecting to the loopback server.
    static bool BridgeDescriptorMatches(Process expected)
    {
        if (expected == null) return false;
        try
        {
            expected.Refresh();
            if (expected.HasExited) return false;
            string descriptorPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "StreamShell", "mangayomi-bridge.json");
            if (!File.Exists(descriptorPath)) return false;
            string data = File.ReadAllText(descriptorPath, Encoding.UTF8);
            return GetInt(data, "pid", 0) == expected.Id &&
                GetInt(data, "port", 0) > 1023 &&
                Regex.IsMatch(GetString(data, "token"), "^[A-Za-z0-9_-]{42,64}={0,2}$");
        }
        catch { return false; }
    }
    static void WaitForBridge(Process expected, int timeoutMs)
    {
        Stopwatch watch = Stopwatch.StartNew();
        while (watch.ElapsedMilliseconds < timeoutMs)
        {
            if (expected == null) throw new Exception("Patched Mangayomi process could not be started.");
            expected.Refresh();
            if (expected.HasExited)
                throw new Exception("The patched Mangayomi process exited during startup (exit code " + expected.ExitCode + ").");
            if (BridgeDescriptorMatches(expected)) return;
            Thread.Sleep(250);
        }
        throw new Exception("The patched Mangayomi process started but its search bridge did not become ready within " +
            (timeoutMs / 1000) + " seconds. Check the app startup and its bridge activation.");
    }
    static void HideStartedFork(Process process)
    {
        try
        {
            IntPtr hwnd = FindMainWindow(process);
            if (hwnd != IntPtr.Zero) ShowWindow(hwnd, SW_HIDE);
        }
        catch { }
    }
    static string ResolveExe(string explicitPath)
    {
        var paths = new [] {
            explicitPath,
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Mangayomi", "Mangayomi.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Mangayomi", "Mangayomi.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Mangayomi", "Mangayomi.exe")
        };
        foreach (string candidate in paths)
        {
            try
            {
                if (String.IsNullOrWhiteSpace(candidate) || !Path.IsPathRooted(candidate)) continue;
                string absolute = Path.GetFullPath(candidate);
                if (Path.GetFileName(absolute).Equals("Mangayomi.exe", StringComparison.OrdinalIgnoreCase)
                    && File.Exists(absolute)) return absolute;
            }
            catch { }
        }
        return null;
    }
    // A URI must never be ShellExecute'd unless Windows has an actual handler.
    // The stock Mangayomi executable does not expose Global Search via URI,
    // even if it happens to register its standard mangayomi:// scheme.
    // Enable only after intentionally installing the patched Windows build.
    static bool CanDispatchDirectSearch(Process process, string configuredExe)
    {
        try
        {
            using (RegistryKey capability = Registry.CurrentUser.OpenSubKey(@"Software\StreamShell\MangayomiBridge"))
            {
                if (capability == null || !Object.Equals(capability.GetValue("DirectSearchEnabled"), 1))
                    return false;
            }
            string runningExe = null;
            try { runningExe = process.MainModule.FileName; }
            catch { }
            if (String.IsNullOrEmpty(runningExe)) runningExe = ResolveExe(configuredExe);
            if (String.IsNullOrEmpty(runningExe) || !File.Exists(runningExe)) return false;
            using (RegistryKey handler = Registry.CurrentUser.OpenSubKey(@"Software\Classes\mangayomi"))
            {
                // Absent handler is the cause of Windows' "Get an app" Store dialog.
                if (handler == null || handler.GetValue("URL Protocol") == null) return false;
                using (RegistryKey command = handler.OpenSubKey(@"shell\open\command"))
                {
                    string launch = command == null ? null : command.GetValue(null) as string;
                    if (String.IsNullOrWhiteSpace(launch) || launch.IndexOf("%1", StringComparison.OrdinalIgnoreCase) < 0) return false;
                    // Mangayomi registers the executable in double quotes.
                    // Never dispatch a URI to another app claiming the scheme.
                    string expected = "\"" + Path.GetFullPath(runningExe).TrimEnd('\\') + "\"";
                    return launch.StartsWith(expected + " ", StringComparison.OrdinalIgnoreCase)
                        || String.Equals(launch, expected, StringComparison.OrdinalIgnoreCase);
                }
            }
        }
        catch { return false; }
    }

    // Local search bridge is created by the optional Mangayomi fork, only
    // after explicit user opt-in. It is never available to arbitrary web pages.
    static string QueryBridge(string body, string route, int timeoutMs, Process expected)
    {
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string discovery = Path.Combine(local, "StreamShell", "mangayomi-bridge.json");
        if (!File.Exists(discovery)) throw new Exception("MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Search bridge not active.");
        FileInfo file = new FileInfo(discovery);
        if (file.Length < 40 || file.Length > 1024)
            throw new Exception("MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Invalid bridge descriptor.");
        if (!BridgeDescriptorMatches(expected))
            throw new Exception("MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Bridge descriptor does not belong to the running patched fork.");
        string descriptor = File.ReadAllText(discovery, Encoding.UTF8);
        string token = GetString(descriptor, "token");
        int port = GetInt(descriptor, "port", 0);
        if (!Regex.IsMatch(token, "^[A-Za-z0-9_-]{42,64}={0,2}$") || port < 1024 || port > 65535)
            throw new Exception("MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Invalid bridge credentials.");
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + route);
        request.Method = "POST";
        request.ContentType = "application/json";
        request.Headers[HttpRequestHeader.Authorization] = "Bearer " + token;
        request.ContentLength = bytes.Length;
        request.Timeout = timeoutMs;
        request.ReadWriteTimeout = timeoutMs;
        request.Proxy = null;
        using (Stream stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        {
            if (response.StatusCode != HttpStatusCode.OK)
                throw new Exception("Search bridge returned HTTP " + (int)response.StatusCode);
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
            {
                char[] chars = new char[450000];
                int offset = 0, count;
                while (offset < chars.Length && (count = reader.Read(chars, offset, chars.Length - offset)) > 0)
                    offset += count;
                if (offset == chars.Length) throw new Exception("Search response exceeds size limit.");
                string json = new string(chars, 0, offset);
                // Forward opaque JSON as a correctly escaped native-messaging string.
                if (json.IndexOf("\"ok\":true", StringComparison.Ordinal) < 0)
                    throw new Exception("Search bridge returned an error.");
                return json;
            }
        }
    }

    static string QueryInstalledSources(string query, string itemType, Process expected)
    {
        return QueryBridge("{\"query\":" + Quote(query) + ",\"itemType\":" + Quote(itemType) + "}", "/v1/search", 125000, expected);
    }
    static void OpenInstalledResult(string resultId, Process expected)
    {
        if (!Regex.IsMatch(resultId, "^[A-Za-z0-9_-]{22,40}$"))
            throw new Exception("Invalid Mangayomi result identifier.");
        QueryBridge("{\"resultId\":" + Quote(resultId) + "}", "/v1/open", 12000, expected);
    }

    // Lookup is a backend operation. It must not require a visible window,
    // must not use the stock app and must not foreground Mangayomi.
    static void HandleLookup(string json)
    {
        string query = GetString(json, "query").Trim();
        string itemType = GetString(json, "itemType");
        if (query.Length < 1 || query.Length > 160 ||
            query.IndexOfAny(new char[] {'\r','\n','\0'}) >= 0 ||
            (itemType != "anime" && itemType != "manga" && itemType != "novel"))
        { Reply(false, false, false, "Invalid Mangayomi search query/type."); return; }

        string exe = ConfiguredForkExe(GetString(json, "executablePath"));
        if (exe == null)
        {
            Reply(false, false, false, "MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Configure the patched Mangayomi.exe in Stream Shell settings.");
            return;
        }
        if (!LocalBridgeEnabled())
        {
            Reply(false, false, false, "MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: Bridge is not activated for this user.");
            return;
        }
        Process process = null;
        bool launched = false;
        try
        {
            process = FindApp(exe, false);
            if (process == null)
            {
                // Launch exactly the configured fork, never the stock app.
                // The first lookup should work without the user manually opening Mangayomi.
                process = Process.Start(new ProcessStartInfo(exe) {
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(exe),
                    WindowStyle = ProcessWindowStyle.Minimized
                });
                launched = true;
            }
            WaitForBridge(process, 40000);
            string resultsJson = QueryInstalledSources(query, itemType, process);
            Reply(true, true, false, null, resultsJson);
        }
        catch (Exception error)
        {
            Reply(false, process != null && !process.HasExited, false,
                "MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: " + error.Message);
        }
        finally
        {
            // Keep an auto-launched app in the background until the user
            // explicitly selects a result or switches to Mangayomi.
            if (launched) HideStartedFork(process);
            if (process != null) process.Dispose();
        }
    }

    // Only selected results may foreground the patched fork. The result ID
    // is resolved server-side against the last completed source search.
    static void HandleOpenResult(string json)
    {
        string exe = ConfiguredForkExe(GetString(json, "executablePath"));
        if (exe == null || !LocalBridgeEnabled())
        { Reply(false, false, false, "Mangayomi patched fork/bridge is not configured."); return; }
        Process process = FindApp(exe, false);
        if (process == null)
        { Reply(false, false, false, "Mangayomi result expired: the patched fork is not running. Search again."); return; }
        try
        {
            OpenInstalledResult(GetString(json, "resultId"), process);
            IntPtr hwnd = FindMainWindow(process);
            if (hwnd == IntPtr.Zero)
            { Reply(false, true, false, "Result opened but Mangayomi window is not ready."); return; }
            int resultLeft = GetInt(json, "left", 0), resultTop = GetInt(json, "top", 0);
            int resultWidth = Math.Max(640, Math.Min(8000, GetInt(json, "width", 1920)));
            int resultHeight = Math.Max(480, Math.Min(4500, GetInt(json, "height", 1080)));
            ShowWindow(hwnd, SW_SHOW);
            ShowWindow(hwnd, SW_RESTORE);
            bool resultPositioned = SetWindowPos(hwnd, HWND_TOP, resultLeft, resultTop, resultWidth, resultHeight, SWP_SHOWWINDOW);
            if (resultPositioned) SetForegroundWindow(hwnd);
            Reply(resultPositioned, true, resultPositioned, resultPositioned ? null : "Could not position selected result.");
        }
        catch (Exception error)
        {
            Reply(false, true, false, "Mangayomi result could not be opened: " + error.Message);
        }
        finally { process.Dispose(); }
    }

    // Explicit user-requested hard stop. Never use the default/stock app or a
    // process-name-only match: only an EXE path configured by Stream Shell.
    static void HandleKill(string json)
    {
        string killExe = ConfiguredForkExe(GetString(json, "executablePath"));
        if (killExe == null)
        { Reply(false, false, false, "Configure a valid Mangayomi.exe path before using Kill."); return; }
        try
        {
            foreach (Process killProcess in Process.GetProcessesByName("Mangayomi"))
            {
                try
                {
                    if (killProcess.HasExited) continue;
                    if (!String.Equals(Path.GetFullPath(killProcess.MainModule.FileName),
                        killExe, StringComparison.OrdinalIgnoreCase)) continue;
                    // taskkill /T includes children created by this specific app.
                    // PID is numeric and never comes from the browser message.
                    using (Process stopTree = Process.Start(new ProcessStartInfo(
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "taskkill.exe"),
                        "/PID " + killProcess.Id.ToString() + " /T /F") {
                        UseShellExecute = false, CreateNoWindow = true,
                        RedirectStandardOutput = true, RedirectStandardError = true
                    }))
                    {
                        stopTree.StandardOutput.ReadToEnd();
                        stopTree.StandardError.ReadToEnd();
                        stopTree.WaitForExit(5000);
                    }
                    if (!killProcess.HasExited)
                    {
                        killProcess.Kill();
                        killProcess.WaitForExit(5000);
                    }
                    if (!killProcess.HasExited)
                        throw new InvalidOperationException("Mangayomi PID " + killProcess.Id + " is still running.");
                }
                finally { killProcess.Dispose(); }
            }
            // Recheck, including instances that were not associated with a HWND.
            using (Process leftover = FindApp(killExe, false))
            {
                if (leftover != null)
                { Reply(false, true, false, "Mangayomi process remains after Kill."); return; }
            }
            Reply(true, false, false, null);
        }
        catch (Exception killError)
        {
            Reply(false, true, false, "Mangayomi Kill failed: " + killError.Message);
        }
    }

    static void Main()
    {
        try
        {
            string json = ReadMessage();
            string action = GetString(json, "action");
            if (String.IsNullOrEmpty(json) || (action != "show" && action != "hide" && action != "status" && action != "raise" && action != "search" && action != "lookup" && action != "open-result" && action != "kill"))
            {
                Reply(false, false, false, "Unsupported Mangayomi native command.");
                return;
            }
            if (action == "kill") { HandleKill(json); return; }
            if (action == "lookup") { HandleLookup(json); return; }
            if (action == "open-result") { HandleOpenResult(json); return; }
            string requestedExe = GetString(json, "executablePath");
            // For interactive show/hide, prefer the configured installation over
            // another Mangayomi process with the same executable name.
            string preferredExe = ConfiguredForkExe(requestedExe);
            Process process = preferredExe == null ? FindApp() : FindApp(preferredExe);
            if ((action == "show" || action == "search" || action == "lookup") && process == null)
            {
                string exe = ResolveExe(GetString(json, "executablePath"));
                if (exe == null)
                {
                    Reply(false, false, false, "Mangayomi.exe not found. Set its path in Dashboard > Settings > General > Providers.");
                    return;
                }
                Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe) });
                for (int i = 0; i < 70 && process == null; i++)
                {
                    Thread.Sleep(100);
                    process = preferredExe == null ? FindApp() : FindApp(preferredExe);
                }
            }
            if (process == null)
            {
                Reply(action != "show" && action != "search" && action != "lookup", false, false, (action == "show" || action == "search" || action == "lookup") ? "Mangayomi main window unavailable." : null);
                return;
            }
            IntPtr hwnd = FindMainWindow(process);
            if (hwnd == IntPtr.Zero)
            {
                Reply(false, true, false, "Mangayomi window could not be identified.");
                return;
            }
            if (action == "hide")
            {
                // An owned Flutter HWND may be restored during the Landing
                // owner-graph transition after SW_MINIMIZE. Hide the actual
                // window instead, without closing its process or stealing
                // focus from the outgoing provider. Owner release is performed
                // by the TitlebarHost's next leftMode reconciliation.
                ShowWindow(hwnd, SW_HIDE);
                if (IsWindowVisible(hwnd))
                {
                    SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_HIDEWINDOW);
                }
                bool hidden = !IsWindowVisible(hwnd);
                Reply(hidden, true, false, hidden ? null : "Mangayomi window stayed visible after hide.");
                return;
            }
            if (action == "status")
            {
                Reply(true, true, IsWindowVisible(hwnd) && !IsIconic(hwnd), null);
                return;
            }
            if (action == "raise")
            {
                // NEVER restore, activate or start the app on a passive focus repair.
                // The JS caller guards this to Wide LEFT Mangayomi + RIGHT Dashboard.
                if (!IsWindowVisible(hwnd) || IsIconic(hwnd))
                {
                    Reply(false, true, false, "Mangayomi is not currently visible.");
                    return;
                }
                bool raised = SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                Reply(raised, true, true, raised ? null : "Could not passively raise Mangayomi.");
                return;
            }
            // Experimental opt-in: only the patched Mangayomi build handles
            // mangayomi://global-search. The stock app will ignore this URI.
            // Never accept caller-supplied schemes/URLs/arguments.
            string searchUri = null;
            if (action == "search")
            {
                if (!CanDispatchDirectSearch(process, GetString(json, "executablePath")))
                {
                    // Safe fallback: the JS caller has already copied the title
                    // and shown Mangayomi. Do not invoke Windows ShellExecute.
                    Reply(false, true, IsWindowVisible(hwnd),
                        "MANGAYOMI_DIRECT_SEARCH_UNAVAILABLE: A patched Mangayomi build and its verified protocol registration are required. Use the clipboard handoff.");
                    return;
                }
                string title = GetString(json, "query").Trim();
                string mediaType = GetString(json, "itemType");
                if (title.Length < 1 || title.Length > 200 ||
                    title.IndexOfAny(new char[]{'\r','\n','\0'}) >= 0 ||
                    (mediaType != "anime" && mediaType != "manga" && mediaType != "novel"))
                {
                    Reply(false, true, IsWindowVisible(hwnd), "Invalid Mangayomi search query/type.");
                    return;
                }
                searchUri = "mangayomi://global-search?type=" + mediaType +
                    "&query=" + Uri.EscapeDataString(title) +
                    "&requestId=" + DateTime.UtcNow.Ticks.ToString();
            }
            int left = GetInt(json, "left", 0), top = GetInt(json, "top", 0);
            int width = Math.Max(640, Math.Min(8000, GetInt(json, "width", 1920)));
            int height = Math.Max(480, Math.Min(4500, GetInt(json, "height", 1080)));
            ShowWindow(hwnd, SW_SHOW);
            ShowWindow(hwnd, SW_RESTORE);
            bool positioned = SetWindowPos(hwnd, HWND_TOP, left, top, width, height, SWP_SHOWWINDOW);
            SetForegroundWindow(hwnd);
            if (positioned && searchUri != null)
            {
                try
                {
                    // Windows-protocol registration belongs to Mangayomi.
                    // Shell launch only confirms dispatch, not search execution.
                    Process.Start(new ProcessStartInfo(searchUri) { UseShellExecute = true });
                }
                catch (Exception error)
                {
                    Reply(false, true, true, "Could not dispatch Mangayomi deep link: " + error.Message);
                    return;
                }
            }
            Reply(positioned, true, true, positioned ? null : "Could not position Mangayomi main window.");
        }
        catch (Exception error)
        {
            Reply(false, false, false, error.Message);
        }
    }
}
