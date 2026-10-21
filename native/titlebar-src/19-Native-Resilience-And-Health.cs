using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

internal static partial class StreamShellTitlebarHost
{
    // The Win32 host is singleton by design: WndProc and the native reader
    // share one window/state table. The mutable health tracker, however, is a
    // normal instance rather than another collection of global static counters.
    private static readonly NativeRuntimeHealth NativeHealth = new NativeRuntimeHealth();

    private sealed class NativeRuntimeHealth
    {
        private readonly object gate = new object();
        private readonly System.Collections.Generic.Dictionary<string, int> lastFaultTicks =
            new System.Collections.Generic.Dictionary<string, int>(StringComparer.Ordinal);
        private int callbackFailures;
        private int commandFailures;
        private int fullCoverIdlePasses;
        private int slowSyncs;

        public void MarkFullCoverIdle() { Interlocked.Increment(ref fullCoverIdlePasses); }
        public void MarkSlowSync() { Interlocked.Increment(ref slowSyncs); }
        public int CallbackFailures { get { return Interlocked.CompareExchange(ref callbackFailures, 0, 0); } }
        public int CommandFailures { get { return Interlocked.CompareExchange(ref commandFailures, 0, 0); } }
        public int FullCoverIdlePasses { get { return Interlocked.CompareExchange(ref fullCoverIdlePasses, 0, 0); } }
        public int SlowSyncs { get { return Interlocked.CompareExchange(ref slowSyncs, 0, 0); } }

        public bool ShouldLogFault(string context)
        {
            int now = Environment.TickCount;
            lock (gate)
            {
                int previous;
                if (lastFaultTicks.TryGetValue(context, out previous) &&
                    unchecked((uint)(now - previous)) < 5000) return false;
                lastFaultTicks[context] = now;
                return true;
            }
        }
        public void RecordFault(string context)
        {
            if (context == "native-reader" || context == "native-message")
                Interlocked.Increment(ref commandFailures);
            else
                Interlocked.Increment(ref callbackFailures);
        }
    }

    private static void LogNativeFailure(string context, Exception ex)
    {
        NativeHealth.RecordFault(context);
        if (NativeHealth.ShouldLogFault(context))
            LogDiagnostic(context + ": " + ex.GetType().Name + ": " + ex.Message);
    }

    private static void SafeSyncOverlays()
    {
        Stopwatch watch = Stopwatch.StartNew();
        try
        {
            SyncOverlays();
        }
        catch (Exception ex)
        {
            // Never propagate managed exceptions through an unmanaged WndProc.
            // Leave the host alive and retry at the next normal timer tick.
            LogNativeFailure("overlay-sync", ex);
            try
            {
                HideChromeBackdrop();
                HideRightChrome();
                HideOverlay(leftOverlay, true);
            }
            catch (Exception hide) { LogNativeFailure("overlay-fail-closed", hide); }
        }
        finally
        {
            watch.Stop();
            if (watch.ElapsedMilliseconds >= 2000)
            {
                NativeHealth.MarkSlowSync();
                if (NativeHealth.ShouldLogFault("overlay-slow"))
                    LogDiagnostic("overlay-sync slow ms=" + watch.ElapsedMilliseconds);
            }
        }
    }

    private static IntPtr SendOperaWindowMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return IntPtr.Zero;
        IntPtr result;
        IntPtr completed = SendMessageTimeoutPtr(hWnd, message, wParam, lParam,
            SMTO_ABORTIFHUNG | SMTO_BLOCK, EXTERNAL_WINDOW_MESSAGE_TIMEOUT_MS, out result);
        if (completed == IntPtr.Zero && NativeHealth.ShouldLogFault("opera-win32-timeout"))
            LogDiagnostic("opera window message timed out hwnd=0x" + hWnd.ToInt64().ToString("X") + " msg=" + message);
        return completed == IntPtr.Zero ? IntPtr.Zero : result;
    }

    private static bool SetOperaWindowCaption(IntPtr hWnd, string caption)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return false;
        IntPtr result;
        IntPtr completed = SendMessageTimeoutText(hWnd, WM_SETTEXT, IntPtr.Zero,
            caption ?? String.Empty, SMTO_ABORTIFHUNG | SMTO_BLOCK,
            EXTERNAL_WINDOW_MESSAGE_TIMEOUT_MS, out result);
        if (completed == IntPtr.Zero && NativeHealth.ShouldLogFault("opera-caption-timeout"))
            LogDiagnostic("opera caption message timed out hwnd=0x" + hWnd.ToInt64().ToString("X"));
        return completed != IntPtr.Zero;
    }

    private static bool IsForeignFullscreenCoveringShell()
    {
        if (!initialized || shuttingDown) return false;
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground) || IsIconic(foreground)) return false;
        IntPtr root = GetAncestor(foreground, GA_ROOT);
        if (root != IntPtr.Zero) foreground = root;
        // Never apply background fast path to any Opera instance or shell overlay.
        if (IsHelperChromeWindow(foreground) || IsOperaProcess(GetProcessName(foreground))) return false;
        RECT rect;
        if (!GetWindowRect(foreground, out rect)) return false;
        PaneBounds left; PaneBounds right;
        lock (StateLock)
        {
            left = leftPane; right = rightPane;
        }
        // Covers the combined logical target panes within an 8-pixel tolerance.
        int minX = Math.Min(left.Left, right.Left);
        int minY = Math.Min(left.Top, right.Top);
        int maxX = Math.Max(left.Left + left.Width, right.Left + right.Width);
        int maxY = Math.Max(left.Top + left.Height, right.Top + right.Height);
        return left.Width > 0 && right.Width > 0 &&
            rect.Left <= minX + 8 && rect.Top <= minY + 8 &&
            rect.Right >= maxX - 8 && rect.Bottom >= maxY - 8;
    }
}
