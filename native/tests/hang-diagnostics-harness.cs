// Compiled only by test-hang-diagnostics.ps1, never shipped in the installed host.
internal static partial class StreamShellTitlebarHost
{
    private static void DiagnosticAssert(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }

    private static void RunTimingTests()
    {
        DiagnosticAssert(PerformanceAge(1000, 1063) == 0, "concurrent future timestamp underflow");
        DiagnosticAssert(PerformanceAge(-2147483640, 2147483640) == 16, "signed TickCount boundary");
        DiagnosticAssert(PerformanceAge(10, -10) == 20, "full TickCount rollover");
        PerformanceProgress future = new PerformanceProgress(1000,
            new PerformanceHeartbeatStamp(1032, "", 1, 25), 1047, 1063, true);
        DiagnosticAssert(future.Reason == "none", "future samples must not request dumps");
        PerformanceProgress late = new PerformanceProgress(20000,
            new PerformanceHeartbeatStamp(19900, "", 2, 16000), 19900, 19990, true);
        DiagnosticAssert(late.ProcessedAge == 100 && late.SenderAge == 16100 &&
            late.Reason == "heartbeat-transport-delay", "late arrival must not renew diagnostic health");
        PerformanceProgress clockJump = new PerformanceProgress(20000,
            new PerformanceHeartbeatStamp(19900, "", 2, 3600000), 19900, 19990, false);
        DiagnosticAssert(clockJump.Reason == "none", "clock discontinuity must not trigger transport dump");
        PerformanceIncidentGate gate = new PerformanceIncidentGate();
        DiagnosticAssert(!gate.Observe(true, 5000) && gate.Observe(true, 5000), "two-sample capture confirmation");
        DiagnosticAssert(!gate.Observe(true, 5000), "one capture per episode");
        gate.Observe(false, 5000);
        DiagnosticAssert(gate.Active, "one healthy sample must not flap recovery");
        gate.Observe(false, 5000);
        DiagnosticAssert(!gate.Active, "two healthy samples close episode");
        DiagnosticAssert(!gate.Observe(true, 60000) && !gate.Observe(true, 5000) &&
            gate.Observe(true, 5000), "sleep resets confirmation");
        DateTime utc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        DiagnosticAssert(!PerformanceClockChanged(5000, 0, utc.AddSeconds(5), utc) &&
            PerformanceClockChanged(5000, 0, utc.AddHours(1), utc), "clock discontinuity detection");
    }

    public static int RunDiagnosticsTests()
    {
        DiagnosticAssert(PerformanceLogDirectory.Contains("StreamShellDiagnosticsTest"), "isolated test logs required");
        DiagnosticAssert(PerformanceAge(Int32.MinValue + 8, Int32.MaxValue - 8) == 17, "tick wraparound");
        RunTimingTests();
        DiagnosticAssert(PerformanceCommandName("https://private.invalid/token") == "unknown", "command redaction");
        BeginPerformanceCommand("{\"type\":\"heartbeat\",\"sequence\":37,\"sentAtUtc\":\"2026-10-29T12:00:00.000Z\"}");
        DiagnosticAssert(PerformanceCurrentCommand.Name == "heartbeat", "current command");
        DiagnosticAssert(PerformanceHeartbeat.Sequence == 37, "heartbeat correlation");
        DiagnosticAssert(PerformanceHeartbeat.SentAtUtc.StartsWith("2026-10-29T12:00:00"), "sender timestamp");
        EndPerformanceCommand();
        DiagnosticAssert(PerformanceCurrentCommand.Name == "none" && PerformanceLastCommand.Name == "heartbeat", "command completion");
        BeginPerformanceCommand("{\"type\":\"heartbeat\",\"sentAtUtc\":\"secret-path\"}");
        DiagnosticAssert(PerformanceHeartbeat.SentAtUtc == "", "invalid timestamp redaction");
        EndPerformanceCommand();
        DiagnosticAssert(RunPerformanceDumpWorker(new string[] { "--diagnostic-dump", "1", "1", "../escape.dmp" }) == 20,
            "dump path traversal rejected");
        using (Process self = Process.GetCurrentProcess())
            DiagnosticAssert(RunPerformanceDumpWorker(new string[] { "--diagnostic-dump", self.Id.ToString(), "1", "20261029-120000-000-1.dmp" }) == 21,
                "reused PID rejected");

        PerformanceHeartbeat = new PerformanceHeartbeatStamp(Environment.TickCount, "", 0, -1);
        ManualResetEvent held = new ManualResetEvent(false);
        ManualResetEvent release = new ManualResetEvent(false);
        Thread owner = new Thread(delegate()
        {
            lock (StateLock) { held.Set(); release.WaitOne(); }
        });
        owner.IsBackground = true;
        owner.Start();
        DiagnosticAssert(held.WaitOne(2000), "contention setup");
        try
        {
            Stopwatch watch = Stopwatch.StartNew();
            string snapshot = BuildPerformanceSnapshot();
            DiagnosticAssert(watch.ElapsedMilliseconds < 3000, "recorder waited on StateLock");
            DiagnosticAssert(snapshot.Contains("\"stateAvailable\":false"), "contention explicitly reported");
            DiagnosticAssert(snapshot.Contains("\"windows\":[") && snapshot.Contains("\"processes\":["), "snapshot evidence");
            AppendPerformanceRecord("\"kind\":\"test-contention\"," + snapshot);
            PerformanceLastHeartbeatTick = unchecked(Environment.TickCount - 35000);
            PerformanceUiTick = Environment.TickCount;
            StartPerformanceHeartbeatWatchdog();
            // A real watchdog sample must persist while the application lock stays held.
            Stopwatch deadline = Stopwatch.StartNew();
            bool recorded = false;
            while (deadline.ElapsedMilliseconds < 8000)
            {
                foreach (string file in Directory.GetFiles(PerformanceLogDirectory, "performance-*.jsonl"))
                    if (File.ReadAllText(file).Contains("\"kind\":\"native-heartbeat-gap\"")) recorded = true;
                if (recorded) break;
                Thread.Sleep(100);
            }
            DiagnosticAssert(recorded, "independent watchdog did not record a blocked-state gap");
            MarkPerformanceHeartbeat();
            PerformanceHeartbeat = new PerformanceHeartbeatStamp(Environment.TickCount, "", 0, -1);
            PerformanceUiTick = Environment.TickCount;
        }
        finally { release.Set(); owner.Join(2000); }
        try
        {
            Stopwatch deadline = Stopwatch.StartNew();
            bool recovered = false;
            while (deadline.ElapsedMilliseconds < 13000)
            {
                foreach (string file in Directory.GetFiles(PerformanceLogDirectory, "performance-*.jsonl"))
                    if (File.ReadAllText(file).Contains("\"kind\":\"native-recovered\"")) recovered = true;
                if (recovered) break;
                Thread.Sleep(100);
            }
            DiagnosticAssert(recovered, "heartbeat recovery not recorded");
        }
        finally { PerformanceStop.Set(); PerformanceWatchdogThread.Join(2000); }

        Directory.CreateDirectory(PerformanceDumpDirectory);
        for (int i = 0; i < 7; i++) File.WriteAllText(Path.Combine(PerformanceDumpDirectory, "old-" + i + ".dmp"), "test");
        string expired = Path.Combine(PerformanceDumpDirectory, "expired.attempt");
        File.WriteAllText(expired, "");
        File.SetLastWriteTimeUtc(expired, DateTime.UtcNow.AddDays(-4));
        PrunePerformanceFiles();
        DiagnosticAssert(Directory.GetFiles(PerformanceDumpDirectory, "*.dmp").Length == 3, "dump retention bound");
        DiagnosticAssert(!File.Exists(expired), "expired attempt pruning");
        foreach (string file in Directory.GetFiles(PerformanceDumpDirectory, "*.dmp")) File.Delete(file);

        // Only the test process is dumped. No Opera/window setup or installation.
        PerformanceStop.Reset();
        using (Process self = Process.GetCurrentProcess()) CapturePerformanceProcess(new PerformanceTarget(self), "capture-test");
        PerformanceStop.Set();
        string[] dumps = Directory.GetFiles(PerformanceDumpDirectory, "*.dmp");
        DiagnosticAssert(dumps.Length == 1, "separate worker did not save test minidump");
        byte[] bytes = File.ReadAllBytes(dumps[0]);
        DiagnosticAssert(bytes.Length > 4 && bytes.Length <= PerformanceDumpMaxBytes &&
            bytes[0] == 'M' && bytes[1] == 'D' && bytes[2] == 'M' && bytes[3] == 'P', "valid bounded minidump");
        Console.WriteLine("PASS diagnostics: contention, live watchdog/recovery, redaction, retention, worker validation and real self minidump");
        return 0;
    }
}

internal static class NativeDiagnosticsTestProgram
{
    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--diagnostic-dump")
            return StreamShellTitlebarHost.HostMain(args);
        try { return StreamShellTitlebarHost.RunDiagnosticsTests(); }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }
}
