using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

internal static class StreamShellFinanceHost
{
    private const int MaxNativeMessageBytes = 1024 * 1024;
    private const int WorkerTimeoutMs = 5000;
    private const int LedgerRecordLength = 24;

    public static int Main(string[] args)
    {
        try
        {
            string request = ReadNativeMessage();
            if (request == null)
            {
                return 1;
            }

            string action = GetJsonString(request, "action") ?? String.Empty;
            if (!String.Equals(action, "reconcile", StringComparison.OrdinalIgnoreCase))
            {
                WriteError("Unsupported finance action.");
                return 2;
            }

            string recordsBase64 = GetJsonString(request, "recordsBase64") ?? String.Empty;
            if (String.IsNullOrWhiteSpace(recordsBase64))
            {
                WriteError("Missing fixed-record ledger payload.");
                return 3;
            }

            byte[] ledgerBytes;
            try
            {
                ledgerBytes = Convert.FromBase64String(recordsBase64);
            }
            catch
            {
                WriteError("Invalid base64 ledger payload.");
                return 4;
            }

            string ledger = new UTF8Encoding(false, true).GetString(ledgerBytes);
            ValidateLedger(ledger);

            string workerPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "StreamShellFinanceCobol.exe"
            );

            if (!File.Exists(workerPath))
            {
                WriteError("COBOL reconciliation worker is not installed.");
                return 5;
            }

            string token = Guid.NewGuid().ToString("N");
            string inputPath = Path.Combine(Path.GetTempPath(), "stream-shell-finance-" + token + ".ledger");
            string outputPath = Path.Combine(Path.GetTempPath(), "stream-shell-finance-" + token + ".report");

            try
            {
                File.WriteAllText(inputPath, NormalizeLedger(ledger), new UTF8Encoding(false));

                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = workerPath,
                    Arguments = QuoteArgument(inputPath) + " " + QuoteArgument(outputPath),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                };

                ApplyCobolRuntimeEnvironment(startInfo);

                using (Process process = Process.Start(startInfo))
                {
                    if (process == null)
                    {
                        throw new InvalidOperationException("COBOL worker did not start.");
                    }

                    if (!process.WaitForExit(WorkerTimeoutMs))
                    {
                        try { process.Kill(); } catch { }
                        throw new TimeoutException("COBOL reconciliation timed out.");
                    }

                    string stdout = process.StandardOutput.ReadToEnd();
                    string stderr = process.StandardError.ReadToEnd();

                    if (process.ExitCode != 0)
                    {
                        string detail = String.IsNullOrWhiteSpace(stderr)
                            ? (String.IsNullOrWhiteSpace(stdout) ? "No worker diagnostics." : stdout.Trim())
                            : stderr.Trim();

                        if (process.ExitCode == unchecked((int)0xC0000135))
                        {
                            detail = "Windows could not load a required COBOL/MinGW runtime DLL (0xC0000135). " +
                                "Re-run the COBOL finance installer from the current Stream Shell checkout so the runtime path is recorded.";
                        }

                        throw new InvalidOperationException(
                            "COBOL reconciliation failed with exit code " + process.ExitCode + ": " + detail
                        );
                    }
                }

                if (!File.Exists(outputPath))
                {
                    throw new InvalidOperationException("COBOL worker produced no report.");
                }

                string report = File.ReadAllText(outputPath, Encoding.UTF8);
                if (report.IndexOf("STATUS=OK", StringComparison.OrdinalIgnoreCase) < 0)
                {
                    throw new InvalidOperationException("COBOL report did not pass reconciliation status.");
                }

                string reportBase64 = Convert.ToBase64String(new UTF8Encoding(false).GetBytes(report));
                WriteNativeMessage(
                    "{\"ok\":true,\"reportBase64\":\"" + JsonEscape(reportBase64) + "\"}"
                );
                return 0;
            }
            finally
            {
                TryDelete(inputPath);
                TryDelete(outputPath);
            }
        }
        catch (Exception error)
        {
            WriteError(error.Message);
            return 10;
        }
    }

    private static void ApplyCobolRuntimeEnvironment(ProcessStartInfo startInfo)
    {
        string runtimePathFile = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "cobol-runtime-path.txt"
        );

        if (!File.Exists(runtimePathFile))
        {
            return;
        }

        string runtimeBin = File.ReadAllText(runtimePathFile, Encoding.ASCII).Trim();
        if (String.IsNullOrWhiteSpace(runtimeBin) || !Directory.Exists(runtimeBin))
        {
            return;
        }

        string inheritedPath = startInfo.EnvironmentVariables["PATH"];
        if (String.IsNullOrWhiteSpace(inheritedPath))
        {
            inheritedPath = Environment.GetEnvironmentVariable("PATH") ?? String.Empty;
        }

        startInfo.EnvironmentVariables["PATH"] = String.IsNullOrWhiteSpace(inheritedPath)
            ? runtimeBin
            : runtimeBin + ";" + inheritedPath;

        string runtimePrefix = Directory.GetParent(runtimeBin) != null
            ? Directory.GetParent(runtimeBin).FullName
            : String.Empty;

        if (!String.IsNullOrWhiteSpace(runtimePrefix))
        {
            string configDir = Path.Combine(runtimePrefix, "share", "gnucobol", "config");
            string copyDir = Path.Combine(runtimePrefix, "share", "gnucobol", "copy");
            string libraryDir = Path.Combine(runtimePrefix, "lib", "gnucobol");

            if (Directory.Exists(configDir))
            {
                startInfo.EnvironmentVariables["COB_CONFIG_DIR"] = configDir;
            }

            if (Directory.Exists(copyDir))
            {
                startInfo.EnvironmentVariables["COB_COPY_DIR"] = copyDir;
            }

            if (Directory.Exists(libraryDir))
            {
                startInfo.EnvironmentVariables["COB_LIBRARY_PATH"] = libraryDir;
            }
        }
    }

    private static void ValidateLedger(string ledger)
    {
        string normalized = NormalizeLedger(ledger);
        string[] records = normalized.Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries);

        if (records.Length == 0 || records.Length > 32)
        {
            throw new InvalidDataException("Unexpected COBOL ledger record count.");
        }

        foreach (string record in records)
        {
            if (record.Length != LedgerRecordLength)
            {
                throw new InvalidDataException("COBOL ledger record width must be exactly 24 characters.");
            }

            for (int i = 14; i < 23; i++)
            {
                if (record[i] < '0' || record[i] > '9')
                {
                    throw new InvalidDataException("COBOL ledger amount field is not numeric.");
                }
            }

            if ("AEIU".IndexOf(record[12]) < 0)
            {
                throw new InvalidDataException("COBOL ledger contains an invalid subscription status.");
            }

            if ("MY".IndexOf(record[13]) < 0)
            {
                throw new InvalidDataException("COBOL ledger contains an invalid billing cadence.");
            }

            if ("DGO".IndexOf(record[23]) < 0)
            {
                throw new InvalidDataException("COBOL ledger contains an invalid billing source.");
            }
        }
    }

    private static string NormalizeLedger(string ledger)
    {
        return (ledger ?? String.Empty)
            .Replace("\r\n", "\n")
            .Replace("\r", "\n");
    }

    private static string QuoteArgument(string value)
    {
        return "\"" + (value ?? String.Empty).Replace("\"", "\\\"") + "\"";
    }

    private static void TryDelete(string path)
    {
        if (String.IsNullOrWhiteSpace(path))
        {
            return;
        }

        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
        }
    }

    private static string ReadNativeMessage()
    {
        Stream input = Console.OpenStandardInput();
        byte[] lengthBytes = ReadExactly(input, 4);
        if (lengthBytes == null)
        {
            return null;
        }

        int length = BitConverter.ToInt32(lengthBytes, 0);
        if (length <= 0 || length > MaxNativeMessageBytes)
        {
            throw new InvalidDataException("Invalid native message length.");
        }

        byte[] payload = ReadExactly(input, length);
        if (payload == null)
        {
            throw new EndOfStreamException("Native message payload ended early.");
        }

        return Encoding.UTF8.GetString(payload);
    }

    private static byte[] ReadExactly(Stream stream, int count)
    {
        byte[] buffer = new byte[count];
        int offset = 0;

        while (offset < count)
        {
            int read = stream.Read(buffer, offset, count - offset);
            if (read <= 0)
            {
                return null;
            }
            offset += read;
        }

        return buffer;
    }

    private static void WriteError(string message)
    {
        WriteNativeMessage(
            "{\"ok\":false,\"error\":\"" + JsonEscape(message) + "\"}"
        );
    }

    private static void WriteNativeMessage(string json)
    {
        byte[] payload = new UTF8Encoding(false).GetBytes(json);
        byte[] length = BitConverter.GetBytes(payload.Length);
        Stream output = Console.OpenStandardOutput();
        output.Write(length, 0, length.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    private static string GetJsonString(string json, string property)
    {
        Match match = Regex.Match(
            json ?? String.Empty,
            "\\\"" + Regex.Escape(property) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"",
            RegexOptions.IgnoreCase
        );

        if (!match.Success)
        {
            return null;
        }

        string value = match.Groups[1].Value;
        value = value.Replace("\\/", "/");
        value = value.Replace("\\\\", "\\");
        value = value.Replace("\\\"", "\"");
        value = value.Replace("\\n", "\n");
        value = value.Replace("\\r", "\r");
        value = value.Replace("\\t", "\t");
        return value;
    }

    private static string JsonEscape(string value)
    {
        return (value ?? String.Empty)
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("\t", "\\t");
    }
}
