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
    // Independent of the native reader, UI thread, StateLock and stdout.
    // The recorder never waits for a browser response or a host state lock.
    private static int PerformanceLastHeartbeatTick = Environment.TickCount;
    private static int PerformanceOutputWaiters;
    private static int PerformanceOutputFailures;
    private static int PerformanceOutputTick;
    private static int PerformanceOutputActive;
    private static int PerformanceUiTick = Environment.TickCount;
    private static volatile string PerformanceUiPhase = "starting";
    private static volatile string PerformanceVisibilityReason = "starting";
    private static volatile string PerformanceReaderState = "starting";
    private static volatile PerformanceCommand PerformanceCurrentCommand = new PerformanceCommand("none", 0, 0);
    private static volatile PerformanceCommand PerformanceLastCommand = new PerformanceCommand("none", 0, 0);
    private static volatile PerformanceHeartbeatStamp PerformanceHeartbeat =
        new PerformanceHeartbeatStamp(Environment.TickCount, "", 0, -1);
    private static int PerformanceClockResetTick;
    private static int PerformanceClockWasReset;
    private static readonly ManualResetEvent PerformanceStop = new ManualResetEvent(false);
    private static readonly Queue<string> PerformanceHistory = new Queue<string>(); // watchdog thread only
    private static int PerformanceCaptureActive;
    private static int PerformanceLastCaptureTick;
    private static volatile bool PerformanceCaptureAttempted;
    private static PerformanceTarget[] PerformanceBrowserTargets = new PerformanceTarget[0]; // watchdog thread only

    private static Thread PerformanceWatchdogThread;

    private sealed class PerformanceTarget
    {
        internal readonly int Pid;
        internal readonly long Started;
        internal PerformanceTarget(Process process)
        { Pid = process.Id; Started = process.StartTime.ToUniversalTime().Ticks; }
    }

    private sealed class PerformanceCommand
    {
        internal readonly string Name;
        internal readonly int Started;
        internal readonly int Completed;
        internal PerformanceCommand(string name, int started, int completed)
        { Name = name; Started = started; Completed = completed; }
    }

    // Signed modular difference preserves ordinary TickCount wraparound. A newer
    // concurrent timestamp must never become a 49-day unsigned "stall".
    // Intervals beyond 24.8 days are intentionally not diagnostic evidence.
    private static uint PerformanceAge(int now, int then)
    {
        int elapsed = unchecked(now - then);
        return elapsed < 0 ? 0u : (uint)elapsed;
    }

    private sealed class PerformanceHeartbeatStamp
    {
        internal readonly int ReceivedTick;
        internal readonly string SentAtUtc;
        internal readonly int Sequence;
        internal readonly long TransitMs;
        internal PerformanceHeartbeatStamp(int receivedTick, string sentAtUtc, int sequence, long transitMs)
        { ReceivedTick = receivedTick; SentAtUtc = sentAtUtc; Sequence = sequence; TransitMs = transitMs; }
    }

    private sealed class PerformanceProgress
    {
        internal readonly int Now;
        internal readonly PerformanceHeartbeatStamp Heartbeat;
        internal readonly uint ReceivedAge, ProcessedAge, UiAge;
        internal readonly bool ClockStable;
        internal PerformanceProgress(int now, PerformanceHeartbeatStamp heartbeat, int processed, int ui, bool clockStable)
        {
            Now = now; Heartbeat = heartbeat; ClockStable = clockStable;
            ReceivedAge = PerformanceAge(now, heartbeat.ReceivedTick);
            ProcessedAge = PerformanceAge(now, processed);
            UiAge = PerformanceAge(now, ui);
        }
        internal long SenderAge { get { return ClockStable && Heartbeat.TransitMs >= 0
            ? Heartbeat.TransitMs + ReceivedAge : -1; } }
        internal string Reason { get {
            if (ProcessedAge >= 30000) return "heartbeat-gap";
            if (UiAge >= 30000) return "ui-gap";
            // A late queued message must not renew diagnostic health. This is
            // evidence of pipeline lag, not a claim that the reader caused it.
            if (ClockStable && Heartbeat.TransitMs >= 5000 && SenderAge >= 15000)
                return "heartbeat-transport-delay";
            return "none";
        } }
        internal long Duration { get { return Reason == "ui-gap" ? UiAge :
            (Reason == "heartbeat-transport-delay" ? SenderAge : ProcessedAge); } }
        internal string Fields { get { return
            "\"heartbeatReceivedAgeMs\":" + ReceivedAge +
            ",\"heartbeatProcessedAgeMs\":" + ProcessedAge +
            ",\"heartbeatSequence\":" + Heartbeat.Sequence +
            ",\"heartbeatSentAtUtc\":\"" + Heartbeat.SentAtUtc + "\"" +
            ",\"heartbeatTransitMs\":" + (Heartbeat.TransitMs < 0 ? "null" : Heartbeat.TransitMs.ToString()) +
            ",\"heartbeatSenderAgeMs\":" + (SenderAge < 0 ? "null" : SenderAge.ToString()) +
            ",\"clockStable\":" + (ClockStable ? "true" : "false") +
            ",\"uiAgeMs\":" + UiAge + ",\"stallReason\":\"" + Reason + "\"";
        } }
    }

    private static PerformanceProgress ReadPerformanceProgress()
    {
        // Copy timestamps FIRST, read the clock LAST. Detection and JSON use
        // this same immutable observation rather than re-reading live fields.
        PerformanceHeartbeatStamp heartbeat = PerformanceHeartbeat;
        int processed = Interlocked.CompareExchange(ref PerformanceLastHeartbeatTick, 0, 0);
        int ui = Interlocked.CompareExchange(ref PerformanceUiTick, 0, 0);
        int reset = Interlocked.CompareExchange(ref PerformanceClockResetTick, 0, 0);
        int resetSeen = Interlocked.CompareExchange(ref PerformanceClockWasReset, 0, 0);
        int now = Environment.TickCount;
        return new PerformanceProgress(now, heartbeat, processed, ui,
            resetSeen == 0 || PerformanceAge(now, reset) >= 60000);
    }

    private static bool PerformanceClockChanged(int now, int previousTick, DateTime utc, DateTime previousUtc)
    {
        return Math.Abs((utc - previousUtc).TotalMilliseconds - PerformanceAge(now, previousTick)) > 2000;
    }

    private sealed class PerformanceIncidentGate
    {
        internal bool Active;
        private int evidenceSamples;
        private int healthySamples;
        private bool requested;
        // Return one capture request per episode; two timely observations are
        // required. Two healthy samples close an episode, avoiding flapping.
        internal bool Observe(bool stalled, uint watchdogGap)
        {
            if (!stalled)
            {
                evidenceSamples = 0;
                if (++healthySamples >= 2) { Active = false; requested = false; }
                return false;
            }
            Active = true; healthySamples = 0;
            evidenceSamples = watchdogGap < 15000 ? Math.Min(2, evidenceSamples + 1) : 0;
            if (evidenceSamples < 2 || requested) return false;
            requested = true;
            return true;
        }
    }

    private static string PerformanceCommandName(string name)
    {
        switch (name)
        {
            case "shutdown": case "hello": case "performance-event": case "heartbeat":
            case "init": case "provider-buttons": case "set-twitch-pane-fullscreen":
            case "reassert-right-pane": case "raise-twitch-cluster": case "claim-cancel":
            case "claim": case "state": case "focus": return name;
            default: return "unknown";
        }
    }

    private static void BeginPerformanceCommand(string json)
    {
        string name = PerformanceCommandName((GetJsonString(json, "type") ?? "").ToLowerInvariant());
        int now = Environment.TickCount;
        PerformanceCurrentCommand = new PerformanceCommand(name, now, 0);
        PerformanceReaderState = "handling";
        if (name == "heartbeat")
        {
            DateTime receivedUtc = DateTime.UtcNow;
            DateTime sent;
            string value = GetJsonString(json, "sentAtUtc");
            bool valid = DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out sent);
            long transit = valid ? (long)(receivedUtc - sent).TotalMilliseconds : -1;
            if (transit < 0 || transit > 86400000) transit = -1;
            PerformanceHeartbeat = new PerformanceHeartbeatStamp(now, valid ? sent.ToString("o") : "",
                GetJsonInt(json, "sequence", 0), transit);
        }
    }

    private static void EndPerformanceCommand()
    {
        PerformanceCommand command = PerformanceCurrentCommand;
        PerformanceLastCommand = new PerformanceCommand(command.Name, command.Started, Environment.TickCount);
        PerformanceCurrentCommand = new PerformanceCommand("none", 0, 0);
        PerformanceReaderState = "waiting-input";
    }

    private static void WritePerformanceIncident(string origin, string kind, int durationMs, bool visible)
    {
        string source = origin == "landing" || origin == "dashboard" || origin == "background" ? origin : "native";
        string category = kind == "renderer-timer-gap" || kind == "renderer-long-task" ||
            kind == "background-timer-gap" || kind == "native-heartbeat-gap" ||
            kind == "native-overlay-stall" || kind == "native-start" ? kind : "unknown";
        AppendPerformanceRecord("\"source\":\"" + source + "\",\"kind\":\"" + category +
            "\",\"durationMs\":" + Math.Max(0, Math.Min(86400000, durationMs)) +
            ",\"visible\":" + (visible ? "true" : "false"));
    }

    // Callers supply only locally constructed fixed keys / sanitized values.
    private static void AppendPerformanceRecord(string fields)
    {
        try
        {
            lock (PerformanceFileLock)
            {
                Directory.CreateDirectory(PerformanceLogDirectory);
                string path = Path.Combine(PerformanceLogDirectory,
                    "performance-" + DateTime.Now.ToString("yyyy-MM-dd") + ".jsonl");
                if (File.Exists(path) && new FileInfo(path).Length >= 4 * 1024 * 1024)
                {
                    string old = path + ".1";
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(path, old);
                }
                string line = "{\"at\":\"" + DateTime.UtcNow.ToString("o") +
                    "\",\"schema\":3,\"hostVersion\":\"0.22.3\",\"nativePid\":" +
                    Process.GetCurrentProcess().Id + "," + fields + "}";
                File.AppendAllText(path, line + Environment.NewLine, new UTF8Encoding(false));
            }
        }
        catch { /* Never write to stdout or disturb the application for logging. */ }
    }

    [DllImport("user32.dll")]
    private static extern bool IsHungAppWindow(IntPtr hWnd);

    private static string PerformanceWindow(string role, IntPtr handle, List<int> browserPids)
    {
        uint pid = 0;
        bool exists = handle != IntPtr.Zero && IsWindow(handle);
        if (exists) GetWindowThreadProcessId(handle, out pid);
        if (pid > 0 && browserPids != null && !browserPids.Contains((int)pid))
        {
            try
            {
                using (Process process = Process.GetProcessById((int)pid))
                    if (IsOperaProcess(process.ProcessName)) browserPids.Add((int)pid);
            }
            catch { }
        }
        // No GetWindowText, WM_NULL, SendMessage or Process.Responding probes.
        return "{\"role\":\"" + role + "\",\"hwnd\":\"" + handle.ToInt64().ToString("X") +
            "\",\"pid\":" + pid + ",\"exists\":" + (exists ? "true" : "false") +
            ",\"visible\":" + (exists && IsWindowVisible(handle) ? "true" : "false") +
            ",\"hung\":" + (exists && IsHungAppWindow(handle) ? "true" : "false") + "}";
    }

    private static string PerformanceProcess(Process process, string role)
    {
        try
        {
            return "{\"pid\":" + process.Id + ",\"role\":\"" + role +
                "\",\"startUtc\":\"" + process.StartTime.ToUniversalTime().ToString("o") +
                "\",\"cpuMs\":" + (long)process.TotalProcessorTime.TotalMilliseconds +
                ",\"workingSetBytes\":" + process.WorkingSet64 +
                ",\"privateBytes\":" + process.PrivateMemorySize64 +
                ",\"threads\":" + process.Threads.Count + ",\"handles\":" + process.HandleCount + "}";
        }
        catch { return "{\"pid\":" + process.Id + ",\"unavailable\":true}"; }
    }

    private static string BuildPerformanceSnapshot()
    {
        PerformanceProgress ignored;
        return BuildPerformanceSnapshot(out ignored);
    }

    private static string BuildPerformanceSnapshot(out PerformanceProgress progress)
    {
        List<IntPtr> handles = new List<IntPtr>();
        string profile = "unknown";
        bool compatible = false;
        int leaseTick = 0;
        // Zero timeout is deliberate: StateLock may be the very deadlock being diagnosed.
        bool stateAvailable = Monitor.TryEnter(StateLock);
        if (stateAvailable)
        {
            try
            {
                profile = layoutProfile == "wide" || layoutProfile == "compact" ? layoutProfile : "unknown";
                compatible = protocolCompatible;
                leaseTick = lastHeartbeatTick;
                foreach (IntPtr h in CompactSurfaceWindows.Values) if (!handles.Contains(h)) handles.Add(h);
                foreach (IntPtr h in WideSurfaceWindows.Values) if (!handles.Contains(h)) handles.Add(h);
                foreach (IntPtr h in WideTwitchClusterWindows.Values) if (!handles.Contains(h)) handles.Add(h);
            }
            finally { Monitor.Exit(StateLock); }
        }
        List<int> browserPids = new List<int>();
        List<string> windows = new List<string>();
        windows.Add(PerformanceWindow("left-toolbar", leftOverlay, null));
        windows.Add(PerformanceWindow("left-chrome", leftChromeOverlay, null));
        windows.Add(PerformanceWindow("right-chrome", rightChromeOverlay, null));
        windows.Add(PerformanceWindow("right-split-chrome", rightSplitChromeOverlay, null));
        foreach (IntPtr handle in handles)
        {
            if (windows.Count >= 36) break;
            windows.Add(PerformanceWindow("claimed", handle, browserPids));
        }
        // Retain the last known claimed PIDs if StateLock is currently unavailable.
        if (stateAvailable)
        {
            List<PerformanceTarget> targets = new List<PerformanceTarget>();
            foreach (int pid in browserPids)
            {
                try { using (Process process = Process.GetProcessById(pid)) targets.Add(new PerformanceTarget(process)); }
                catch { }
            }
            PerformanceBrowserTargets = targets.ToArray();
        }
        List<string> processes = new List<string>();
        using (Process self = Process.GetCurrentProcess()) processes.Add(PerformanceProcess(self, "host"));
        Process[] opera = Process.GetProcessesByName("opera");
        foreach (Process process in opera)
        {
            using (process)
            {
                if (processes.Count <= 64) processes.Add(PerformanceProcess(process, "opera"));
            }
        }
        PerformanceCommand command = PerformanceCurrentCommand;
        PerformanceCommand last = PerformanceLastCommand;
        int outputActive = Interlocked.CompareExchange(ref PerformanceOutputActive, 0, 0);
        int outputTick = Interlocked.CompareExchange(ref PerformanceOutputTick, 0, 0);
        progress = ReadPerformanceProgress();
        int now = progress.Now;
        return "\"sampleAt\":\"" + DateTime.UtcNow.ToString("o") +
            "\",\"uptimeMs\":" + unchecked((uint)now) +
            "," + progress.Fields +
            ",\"reader\":\"" + PerformanceReaderState +
            "\",\"command\":\"" + command.Name + "\",\"commandAgeMs\":" +
            (command.Name == "none" ? 0u : PerformanceAge(now, command.Started)) +
            ",\"lastCommand\":\"" + last.Name + "\",\"lastCommandDurationMs\":" + PerformanceAge(last.Completed, last.Started) +
            ",\"lastCommandAgeMs\":" + (last.Name == "none" ? 0u : PerformanceAge(now, last.Completed)) +
            ",\"outputFailures\":" + Interlocked.CompareExchange(ref PerformanceOutputFailures, 0, 0) +
            ",\"outputWaiters\":" + Interlocked.CompareExchange(ref PerformanceOutputWaiters, 0, 0) +
            ",\"outputActive\":" + outputActive +
            ",\"outputAgeMs\":" + (outputActive == 0 ? 0u : PerformanceAge(now, outputTick)) +
            ",\"uiPhase\":\"" + PerformanceUiPhase + "\",\"visibilityReason\":\"" + PerformanceVisibilityReason +
            "\",\"stateAvailable\":" + (stateAvailable ? "true" : "false") +
            ",\"layout\":\"" + profile + "\",\"leaseAgeMs\":" + (stateAvailable ? PerformanceAge(now, leaseTick).ToString() : "null") +
            ",\"protocolCompatible\":" + (stateAvailable ? (compatible ? "true" : "false") : "null") +
            ",\"operaProcessCount\":" + opera.Length + ",\"processesTruncated\":" + (opera.Length > 64 ? "true" : "false") +
            ",\"windows\":[" + String.Join(",", windows.ToArray()) +
            "],\"processes\":[" + String.Join(",", processes.ToArray()) + "]";
    }

    private static void StartPerformanceHeartbeatWatchdog()
    {
        WritePerformanceIncident("native", "native-start", 0, false);
        PrunePerformanceFiles();
        Thread watchdog = new Thread(delegate()
        {
            int previousTick = Environment.TickCount;
            int lastWritten = previousTick;
            DateTime previousUtc = DateTime.UtcNow;
            PerformanceIncidentGate gate = new PerformanceIncidentGate();
            string previousVisibility = "";
            while (!PerformanceStop.WaitOne(5000))
            {
                try
                {
                    int now = Environment.TickCount;
                    DateTime utc = DateTime.UtcNow;
                    uint schedulerGap = PerformanceAge(now, previousTick);
                    if (PerformanceClockChanged(now, previousTick, utc, previousUtc))
                    {
                        Interlocked.Exchange(ref PerformanceClockResetTick, now);
                        Interlocked.Exchange(ref PerformanceClockWasReset, 1);
                        AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-clock-discontinuity\"");
                    }
                    previousTick = now; previousUtc = utc;
                    PerformanceProgress progress;
                    string snapshot = BuildPerformanceSnapshot(out progress);
                    now = progress.Now;
                    bool stalled = progress.Reason != "none";
                    bool wasActive = gate.Active;
                    bool capture = gate.Observe(stalled, schedulerGap);
                    bool firstGap = gate.Active && !wasActive;
                    if (!gate.Active && wasActive)
                        AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-recovered\"," + snapshot);
                    if (firstGap)
                    {
                        foreach (string prior in PerformanceHistory)
                            AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-pre-gap\"," + prior);
                    }
                    if (firstGap || PerformanceAge(now, lastWritten) >= (gate.Active ? 5000u : 60000u) ||
                        previousVisibility != PerformanceVisibilityReason)
                    {
                        AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"" +
                            (firstGap ? "native-" + progress.Reason : "native-snapshot") +
                            "\",\"watchdogGapMs\":" + schedulerGap + ",\"durationMs\":" + progress.Duration + "," + snapshot);
                        previousVisibility = PerformanceVisibilityReason;
                        lastWritten = now;
                    }
                    PerformanceHistory.Enqueue(snapshot);
                    while (PerformanceHistory.Count > 12) PerformanceHistory.Dequeue();
                    if (capture) TryStartPerformanceCapture(now, PerformanceBrowserTargets, snapshot, progress.Reason);
                }
                catch (Exception ex)
                {
                    // Exception class only; no paths, payloads or message text.
                    AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-recorder-error\",\"error\":\"" +
                        JsonEscape(ex.GetType().Name) + "\"");
                }
            }
        });
        watchdog.IsBackground = true;
        watchdog.Name = "StreamShellIndependentRecorder";
        PerformanceWatchdogThread = watchdog;
        watchdog.Start();
    }

    private static void MarkPerformanceHeartbeat()
    {
        Interlocked.Exchange(ref PerformanceLastHeartbeatTick, Environment.TickCount);
        // Recovery is recorded by the watchdog, not reset silently by the reader.
    }

    private static void PerformanceLifecycle(string reason)
    {
        PerformanceVisibilityReason = reason; // Internal fixed strings only.
        AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-lifecycle\",\"reason\":\"" + reason + "\"");
    }

    private static readonly string PerformanceDumpDirectory = Path.Combine(PerformanceLogDirectory, "HangDumps");
    private const long PerformanceDumpMaxBytes = 64L * 1024 * 1024;

    private static void PrunePerformanceFiles()
    {
        try
        {
            Directory.CreateDirectory(PerformanceLogDirectory);
            foreach (string path in Directory.GetFiles(PerformanceLogDirectory, "performance-*.jsonl*"))
                if (File.GetLastWriteTimeUtc(path) < DateTime.UtcNow.AddDays(-14)) File.Delete(path);
            Directory.CreateDirectory(PerformanceDumpDirectory);
            foreach (string path in Directory.GetFiles(PerformanceDumpDirectory))
                if ((path.EndsWith(".dmp", StringComparison.OrdinalIgnoreCase) ||
                     path.EndsWith(".attempt", StringComparison.OrdinalIgnoreCase) ||
                     (Path.GetFileName(path).StartsWith("capture-", StringComparison.Ordinal) && path.EndsWith(".jsonl", StringComparison.OrdinalIgnoreCase))) &&
                    File.GetLastWriteTimeUtc(path) < DateTime.UtcNow.AddDays(-3)) File.Delete(path);
            string[] dumps = Directory.GetFiles(PerformanceDumpDirectory, "*.dmp");
            Array.Sort(dumps, StringComparer.Ordinal);
            for (int i = 0; i < dumps.Length - 3; i++) File.Delete(dumps[i]);
        }
        catch { }
    }

    private static void TryStartPerformanceCapture(int now, PerformanceTarget[] browserTargets, string snapshot, string reason)
    {
        if (PerformanceCaptureAttempted && PerformanceAge(now, PerformanceLastCaptureTick) < 600000) return;
        if (Interlocked.CompareExchange(ref PerformanceCaptureActive, 1, 0) != 0) return;
        // Capture runs separately so even a hung dump helper cannot stop the recorder.
        Thread capture = new Thread(delegate()
        {
            try
            {
                // Check again immediately before consuming quota. An already
                // recovered episode should not produce an unrelated dump.
                PerformanceProgress current = ReadPerformanceProgress();
                if (current.Reason == "none")
                {
                    AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-dump-skipped-recovered\"," + current.Fields);
                    return;
                }
                Directory.CreateDirectory(PerformanceDumpDirectory);
                string day = DateTime.UtcNow.ToString("yyyyMMdd");
                // Two batches/day across native restarts, not merely per-process.
                string marker = null;
                for (int slot = 0; slot < 2; slot++)
                {
                    string candidate = Path.Combine(PerformanceDumpDirectory, "v3-" + day + "-" + slot + ".attempt");
                    try { using (FileStream f = new FileStream(candidate, FileMode.CreateNew, FileAccess.Write)) { } marker = candidate; break; }
                    catch (IOException) { }
                }
                if (marker == null)
                {
                    AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-dump-limit\"");
                    return;
                }
                PerformanceLastCaptureTick = Environment.TickCount;
                PerformanceCaptureAttempted = true;
                PrunePerformanceFiles();
                string incident = "capture-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
                string evidence = "\"incidentId\":\"" + incident + "\",\"trigger\":\"" + reason + "\",\"triggerSnapshot\":{" + snapshot + "}";
                File.WriteAllText(Path.Combine(PerformanceDumpDirectory, incident + ".jsonl"),
                    "{\"schema\":3,\"hostVersion\":\"0.22.3\"," + evidence + "}" + Environment.NewLine, new UTF8Encoding(false));
                AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-dump-start\"," + evidence);
                List<PerformanceTarget> targets = new List<PerformanceTarget>();
                // Identity was sampled with the claimed HWND, before any possible PID reuse.
                foreach (PerformanceTarget target in browserTargets) if (targets.Count < 2) targets.Add(target);
                using (Process self = Process.GetCurrentProcess()) targets.Add(new PerformanceTarget(self));
                foreach (PerformanceTarget target in targets)
                {
                    if (PerformanceStop.WaitOne(0)) break;
                    CapturePerformanceProcess(target, incident);
                }
            }
            catch (Exception ex)
            {
                AppendPerformanceRecord("\"source\":\"native\",\"kind\":\"native-dump-error\",\"error\":\"" + ex.GetType().Name + "\"");
            }
            finally { Interlocked.Exchange(ref PerformanceCaptureActive, 0); }
        });
        capture.IsBackground = true;
        capture.Name = "StreamShellDumpSupervisor";
        capture.Start();
    }

    private static void CapturePerformanceProcess(PerformanceTarget target, string incident)
    {
        int pid = target.Pid;
        string name = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff") + "-" + pid + ".dmp";
        string path = Path.Combine(PerformanceDumpDirectory, name);
        string result = "failed";
        int exitCode = -1;
        try
        {
            string executable;
            using (Process self = Process.GetCurrentProcess()) executable = self.MainModule.FileName;
            ProcessStartInfo info = new ProcessStartInfo(executable,
                "--diagnostic-dump " + pid + " " + target.Started + " " + name);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            // Child stdout is isolated from the Native Messaging protocol.
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            using (Process worker = Process.Start(info))
            {
                Stopwatch timer = Stopwatch.StartNew();
                while (!worker.WaitForExit(100))
                {
                    if (timer.ElapsedMilliseconds >= 10000 || PerformanceStop.WaitOne(0) ||
                        (File.Exists(path) && new FileInfo(path).Length > PerformanceDumpMaxBytes))
                    {
                        result = "aborted";
                        worker.Kill(); // Only the exact dump worker we started, never Opera / the target.
                        worker.WaitForExit(1000);
                        break;
                    }
                }
                if (worker.HasExited)
                {
                    exitCode = worker.ExitCode;
                    if (result != "aborted" && exitCode == 0 && File.Exists(path) &&
                        new FileInfo(path).Length > 0 && new FileInfo(path).Length <= PerformanceDumpMaxBytes) result = "saved";
                }
            }
        }
        catch { result = "failed"; }
        if (result != "saved") { try { File.Delete(path); } catch { } }
        string record = "\"source\":\"native\",\"kind\":\"native-dump\",\"targetPid\":" + pid +
            ",\"result\":\"" + result + "\",\"exitCode\":" + exitCode + ",\"file\":\"" + name +
            "\",\"incidentId\":\"" + incident + "\",\"completionProgress\":{" + ReadPerformanceProgress().Fields + "}";
        AppendPerformanceRecord(record);
        try
        {
            File.AppendAllText(Path.Combine(PerformanceDumpDirectory, incident + ".jsonl"),
                "{\"at\":\"" + DateTime.UtcNow.ToString("o") + "\"," + record + "}" + Environment.NewLine,
                new UTF8Encoding(false));
        }
        catch { }
    }

    [DllImport("Dbghelp.dll", SetLastError = true)]
    private static extern bool MiniDumpWriteDump(IntPtr process, uint pid, IntPtr file, uint type,
        IntPtr exception, IntPtr streams, IntPtr callback);

    [DllImport("kernel32.dll", EntryPoint = "OpenProcess", SetLastError = true)]
    private static extern IntPtr OpenPerformanceProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", EntryPoint = "CloseHandle")]
    private static extern bool ClosePerformanceHandle(IntPtr handle);

    // Executed in a separate copy of this EXE, before any native port / HWND setup.
    private static int RunPerformanceDumpWorker(string[] args)
    {
        int pid; long start;
        if (args.Length != 4 || !Int32.TryParse(args[1], out pid) || !Int64.TryParse(args[2], out start) ||
            !Regex.IsMatch(args[3], @"\A[0-9]{8}-[0-9]{6}-[0-9]{3}-[0-9]+\.dmp\z")) return 20;
        try
        {
            using (Process target = Process.GetProcessById(pid))
            using (Process self = Process.GetCurrentProcess())
            {
                if (target.StartTime.ToUniversalTime().Ticks != start) return 21; // PID reuse
                if (!IsOperaProcess(target.ProcessName) &&
                    !String.Equals(target.MainModule.FileName, self.MainModule.FileName, StringComparison.OrdinalIgnoreCase)) return 22;
                Directory.CreateDirectory(PerformanceDumpDirectory);
                string path = Path.Combine(PerformanceDumpDirectory, args[3]);
                using (FileStream file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                {
                    // Normal stacks + thread info + unloaded modules, filtered stack memory.
                    // No full memory / heap, handles, tokens or indirectly referenced pages.
                    IntPtr processHandle = OpenPerformanceProcess(0x0400 | 0x0010, false, (uint)pid);
                    if (processHandle == IntPtr.Zero) return 25;
                    try
                    {
                        bool ok = MiniDumpWriteDump(processHandle, (uint)pid, file.SafeFileHandle.DangerousGetHandle(),
                            0x1000 | 0x20 | 0x08, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
                        return ok ? 0 : 23;
                    }
                    finally { ClosePerformanceHandle(processHandle); }
                }
            }
        }
        catch { return 24; }
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
