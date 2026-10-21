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

// Original v0.20.12 source: lines 7427-7761.
internal static partial class StreamShellTitlebarHost
{
    private static bool TryNormalizeControlAction(string action, out string normalized)
    {
        normalized = String.IsNullOrWhiteSpace(action)
            ? String.Empty
            : action.Trim().ToLowerInvariant();

        return ControlBridgeActions.Contains(normalized);
    }

    private static int SendControlStatusClient()
    {
        try
        {
            using (NamedPipeClientStream pipe = new NamedPipeClientStream(
                ".",
                CONTROL_PIPE_NAME,
                PipeDirection.InOut,
                PipeOptions.None
            ))
            {
                pipe.Connect(900);

                using (StreamReader reader = new StreamReader(
                    pipe,
                    new UTF8Encoding(false),
                    false,
                    1024,
                    true
                ))
                using (StreamWriter writer = new StreamWriter(
                    pipe,
                    new UTF8Encoding(false),
                    1024,
                    true
                ))
                {
                    writer.AutoFlush = true;
                    writer.WriteLine("__status__");

                    string response = reader.ReadLine();
                    if (String.IsNullOrWhiteSpace(response))
                    {
                        Console.WriteLine("ERR empty-response");
                        return 5;
                    }

                    Console.WriteLine(response);
                    return response.StartsWith("OK status ", StringComparison.OrdinalIgnoreCase)
                        ? 0
                        : 6;
                }
            }
        }
        catch (TimeoutException)
        {
            Console.WriteLine("ERR bridge-unavailable");
            return 4;
        }
        catch (IOException)
        {
            Console.WriteLine("ERR bridge-unavailable");
            return 4;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERR " + ex.GetType().Name);
            return 10;
        }
    }

    private static int SendControlActionClient(string action)
    {
        string normalized;
        if (!TryNormalizeControlAction(action, out normalized))
        {
            Console.WriteLine("ERR invalid-action");
            return 2;
        }

        try
        {
            using (NamedPipeClientStream pipe = new NamedPipeClientStream(
                ".",
                CONTROL_PIPE_NAME,
                PipeDirection.InOut,
                PipeOptions.None
            ))
            {
                pipe.Connect(900);

                using (StreamReader reader = new StreamReader(
                    pipe,
                    new UTF8Encoding(false),
                    false,
                    1024,
                    true
                ))
                using (StreamWriter writer = new StreamWriter(
                    pipe,
                    new UTF8Encoding(false),
                    1024,
                    true
                ))
                {
                    writer.AutoFlush = true;
                    writer.WriteLine(normalized);

                    string response = reader.ReadLine();
                    if (String.IsNullOrWhiteSpace(response))
                    {
                        Console.WriteLine("ERR empty-response");
                        return 5;
                    }

                    Console.WriteLine(response);
                    return response.StartsWith("OK ", StringComparison.OrdinalIgnoreCase)
                        ? 0
                        : 6;
                }
            }
        }
        catch (TimeoutException)
        {
            Console.WriteLine("ERR bridge-unavailable");
            return 4;
        }
        catch (IOException)
        {
            Console.WriteLine("ERR bridge-unavailable");
            return 4;
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERR " + ex.GetType().Name);
            return 10;
        }
    }

    private static void ControlBridgeLoop()
    {
        while (!shuttingDown)
        {
            try
            {
                using (NamedPipeServerStream pipe = new NamedPipeServerStream(
                    CONTROL_PIPE_NAME,
                    PipeDirection.InOut,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.None
                ))
                {
                    pipe.WaitForConnection();

                    using (StreamReader reader = new StreamReader(
                        pipe,
                        new UTF8Encoding(false),
                        false,
                        1024,
                        true
                    ))
                    using (StreamWriter writer = new StreamWriter(
                        pipe,
                        new UTF8Encoding(false),
                        1024,
                        true
                    ))
                    {
                        writer.AutoFlush = true;

                        string requested = reader.ReadLine();

                        bool ready;
                        string currentProfile;
                        string currentLeftMode;
                        string currentRightMode;
                        string currentTwitchTarget;
                        bool currentSettingsOpen;
                        bool currentVolumeActive;
                        bool currentFullscreenActive;
                        lock (StateLock)
                        {
                            ready = protocolCompatible && initialized;
                            currentProfile = layoutProfile ?? "unknown";
                            currentLeftMode = leftMode ?? "unknown";
                            currentRightMode = rightMode ?? "unknown";
                            currentTwitchTarget = twitchTarget ?? "resume";
                            currentSettingsOpen = settingsOpen;
                            currentVolumeActive = volumeActive;
                            currentFullscreenActive = fullscreenActive;
                        }

                        if (!ready || shuttingDown)
                        {
                            writer.WriteLine("ERR not-ready");
                            continue;
                        }

                        if (String.Equals(requested, "__status__", StringComparison.OrdinalIgnoreCase))
                        {
                            writer.WriteLine(
                                "OK status layout=" + currentProfile +
                                " left=" + currentLeftMode +
                                " right=" + currentRightMode +
                                " twitchTarget=" + currentTwitchTarget +
                                " settings=" + (currentSettingsOpen ? "1" : "0") +
                                " volume=" + (currentVolumeActive ? "1" : "0") +
                                " fullscreen=" + (currentFullscreenActive ? "1" : "0")
                            );
                            continue;
                        }

                        string action;
                        if (!TryNormalizeControlAction(requested, out action))
                        {
                            writer.WriteLine("ERR invalid-action");
                            continue;
                        }

                        bool compact = String.Equals(
                            currentProfile,
                            "compact",
                            StringComparison.OrdinalIgnoreCase
                        );

                        if (
                            compact &&
                            (
                                String.Equals(action, "discord", StringComparison.OrdinalIgnoreCase) ||
                                String.Equals(action, "twitch", StringComparison.OrdinalIgnoreCase) ||
                                String.Equals(action, "twitch-drops", StringComparison.OrdinalIgnoreCase)
                            )
                        )
                        {
                            writer.WriteLine("ERR unsupported-compact");
                            continue;
                        }

                        if (String.Equals(action, "volume", StringComparison.OrdinalIgnoreCase))
                        {
                            TriggerVolumeShortcut();
                        }
                        else
                        {
                            SendAction(action);
                        }

                        LogDiagnostic("control bridge action=" + action);
                        writer.WriteLine("OK " + action);
                    }
                }
            }
            catch (Exception ex)
            {
                if (!shuttingDown)
                {
                    LogDiagnostic("control bridge error: " + ex.GetType().Name + ": " + ex.Message);
                    Thread.Sleep(150);
                }
            }
        }
    }

    private static void SendAction(string action)
    {
        if (String.IsNullOrWhiteSpace(action) || shuttingDown)
        {
            return;
        }

        WriteJson("{\"event\":\"action\",\"action\":\"" + JsonEscape(action) + "\"}");
    }

    private static string ReadMessage()
    {
        Stream input = Console.OpenStandardInput();
        byte[] lengthBytes = ReadExactly(input, 4);
        if (lengthBytes == null)
        {
            return null;
        }

        int length = BitConverter.ToInt32(lengthBytes, 0);
        if (length <= 0 || length > 1024 * 1024)
        {
            return null;
        }

        byte[] payload = ReadExactly(input, length);
        if (payload == null)
        {
            return null;
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

    private static void WriteJson(string json)
    {
        try
        {
            byte[] payload = Encoding.UTF8.GetBytes(json);
            byte[] length = BitConverter.GetBytes(payload.Length);

            lock (OutputLock)
            {
                Stream output = Console.OpenStandardOutput();
                output.Write(length, 0, length.Length);
                output.Write(payload, 0, payload.Length);
                output.Flush();
            }
        }
        catch
        {
        }
    }

}
