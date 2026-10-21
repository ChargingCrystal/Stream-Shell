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

// Original v0.20.12 source: lines 856-1282.
internal static partial class StreamShellTitlebarHost
{
    public static int Main(string[] args)
    {
        if (
            args != null &&
            args.Length >= 2 &&
            String.Equals(args[0], "--action", StringComparison.OrdinalIgnoreCase)
        )
        {
            return SendControlActionClient(args[1]);
        }

        if (
            args != null &&
            args.Length >= 1 &&
            String.Equals(args[0], "--status", StringComparison.OrdinalIgnoreCase)
        )
        {
            return SendControlStatusClient();
        }

        try
        {
            ResetDiagnosticLog();
            LogDiagnostic("host start");
            try { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); } catch { }
            LoadButtonIcons();
            InitializeTaskbarIntegration();

            // IMPORTANT: Do not enumerate every Opera window here.
            // The 0.9.33 stale-identity sweep could spend many seconds inside
            // SHGetPropertyStoreForWindow before the Native Messaging read loop
            // had even started. Chromium/Opera can disconnect the native port
            // during that stall, which removes both the titlebar toolbar and
            // all taskbar registration for the session.
            mainThreadId = GetCurrentThreadId();
            RegisterWindowClasses();

            controllerWindow = CreateWindowEx(
                0,
                "StreamShellTitlebarController",
                "Stream Shell Titlebar Controller",
                0,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                IntPtr.Zero,
                GetModuleHandle(null),
                IntPtr.Zero
            );

            if (controllerWindow == IntPtr.Zero)
            {
                return 2;
            }

            leftChromeOverlay = CreateChromeBackdropWindow("Stream Shell Provider Chrome Left");
            rightChromeOverlay = CreateChromeBackdropWindow("Stream Shell Provider Chrome Right");
            rightCaptionBlockerOverlay = CreateOverlayWindow("Stream Shell Right Caption Blocker");
            rightSplitChromeOverlay = CreateChromeBackdropWindow("Stream Shell Twitch Split Chrome B");
            rightSplitCaptionBlockerOverlay = CreateOverlayWindow("Stream Shell Twitch Split Caption Blocker B");
            leftOverlay = CreateOverlayWindow("Stream Shell Left Toolbar");
            rightOverlay = IntPtr.Zero;

            if (leftOverlay == IntPtr.Zero)
            {
                LogDiagnostic("left overlay creation failed");
                return 3;
            }

            if (leftChromeOverlay == IntPtr.Zero)
            {
                LogDiagnostic("provider chrome backdrop creation failed; toolbar-only fallback");
            }

            LogDiagnostic(
                "left overlay window created; provider chrome left=" +
                (leftChromeOverlay != IntPtr.Zero ? "ready" : "unavailable") +
                "; provider chrome right=" +
                (rightChromeOverlay != IntPtr.Zero ? "ready" : "unavailable") +
                "; right caption blocker=" +
                (rightCaptionBlockerOverlay != IntPtr.Zero ? "ready" : "unavailable") +
                "; right toolbar disabled"
            );

            Thread reader = new Thread(ReadLoop);
            reader.IsBackground = true;
            reader.Name = "StreamShellTitlebarNativeReader";
            reader.Start();

            Thread controlBridge = new Thread(ControlBridgeLoop);
            controlBridge.IsBackground = true;
            controlBridge.Name = "StreamShellControlBridge";
            controlBridge.Start();

            /* WM_APP_SYNC handles real state changes immediately. The timer is
             * only a drift/audit fallback, so 1 s is enough and halves the
             * long-session HWND/overlay reconciliation churn. */
            SetTimer(controllerWindow, new UIntPtr(1), 1000, IntPtr.Zero);

            MSG msg;
            while (!shuttingDown && GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            shuttingDown = true;
            CleanupWindows();
            return 0;
        }
        catch (Exception ex)
        {
            LogNativeFailure("host-fatal", ex);
            try { CleanupWindows(); }
            catch (Exception cleanup) { LogNativeFailure("host-cleanup", cleanup); }
            return 10;
        }
    }

    private static void RegisterWindowClasses()
    {
        IntPtr hInstance = GetModuleHandle(null);
        IntPtr proc = Marshal.GetFunctionPointerForDelegate(WindowProcDelegate);

        WNDCLASSEX controller = new WNDCLASSEX();
        controller.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEX));
        controller.lpfnWndProc = proc;
        controller.hInstance = hInstance;
        controller.hCursor = LoadCursor(IntPtr.Zero, new IntPtr(IDC_ARROW));
        controller.lpszClassName = "StreamShellTitlebarController";
        RegisterClassEx(ref controller);

        WNDCLASSEX overlay = new WNDCLASSEX();
        overlay.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEX));
        overlay.lpfnWndProc = proc;
        overlay.hInstance = hInstance;
        overlay.hCursor = LoadCursor(IntPtr.Zero, new IntPtr(IDC_ARROW));
        overlay.lpszClassName = "StreamShellTitlebarOverlay";
        RegisterClassEx(ref overlay);
    }

    private static IntPtr CreateOverlayWindow(string name)
    {
        return CreateWindowEx(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            "StreamShellTitlebarOverlay",
            name,
            WS_POPUP,
            0,
            0,
            1,
            1,
            IntPtr.Zero,
            IntPtr.Zero,
            GetModuleHandle(null),
            IntPtr.Zero
        );
    }

    private static IntPtr CreateChromeBackdropWindow(string name)
    {
        /*
         * This window is intentionally input-transparent. It paints over
         * Opera GX's client-drawn purple caption strip while leaving all mouse
         * interaction (dragging, resize borders, native caption buttons) to
         * Opera underneath. The actual Stream Shell buttons remain a separate
         * interactive overlay above this backdrop.
         */
        return CreateWindowEx(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
            "StreamShellTitlebarOverlay",
            name,
            WS_POPUP,
            0,
            0,
            1,
            1,
            IntPtr.Zero,
            IntPtr.Zero,
            GetModuleHandle(null),
            IntPtr.Zero
        );
    }

    // This is a managed callback invoked through unmanaged User32. No managed
    // exception may escape this boundary or the CLR can terminate the helper.
    private static IntPtr WindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            return WindowProcCore(hWnd, msg, wParam, lParam);
        }
        catch (Exception ex)
        {
            LogNativeFailure("wndproc-" + msg.ToString("X"), ex);
            if (msg == WM_PAINT)
            {
                try
                {
                    PAINTSTRUCT paint;
                    IntPtr hdc = BeginPaint(hWnd, out paint);
                    if (hdc != IntPtr.Zero) EndPaint(hWnd, ref paint);
                }
                catch { }
            }
            if (hWnd == controllerWindow && (msg == WM_CLOSE || msg == WM_DESTROY))
            {
                shuttingDown = true;
                PostQuitMessage(0);
            }
            return IntPtr.Zero;
        }
    }

    private static IntPtr WindowProcCore(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (hWnd == controllerWindow)
        {
            if (msg == WM_TIMER || msg == WM_APP_SYNC)
            {
                SafeSyncOverlays();
                return IntPtr.Zero;
            }

            if (msg == WM_APP_FOCUS)
            {
                try { FocusRequestedPane(); }
                catch (Exception ex) { LogNativeFailure("window-focus", ex); }
                return IntPtr.Zero;
            }

            if (msg == WM_CLOSE)
            {
                shuttingDown = true;
                KillTimer(hWnd, new UIntPtr(1));
                DestroyWindow(hWnd);
                return IntPtr.Zero;
            }

            if (msg == WM_DESTROY)
            {
                shuttingDown = true;
                controllerWindow = IntPtr.Zero;
                CleanupOverlay(ref leftChromeOverlay);
                CleanupOverlay(ref rightChromeOverlay);
                CleanupOverlay(ref rightCaptionBlockerOverlay);
                CleanupOverlay(ref rightSplitChromeOverlay);
                CleanupOverlay(ref rightSplitCaptionBlockerOverlay);
                CleanupOverlay(ref leftOverlay);
                CleanupOverlay(ref rightOverlay);
                PostQuitMessage(0);
                return IntPtr.Zero;
            }

            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        if (hWnd == leftChromeOverlay || hWnd == rightChromeOverlay || hWnd == rightSplitChromeOverlay)
        {
            bool leftChrome = hWnd == leftChromeOverlay;

            if (msg == WM_MOUSEACTIVATE)
            {
                return new IntPtr(MA_NOACTIVATE);
            }

            if (msg == WM_ERASEBKGND)
            {
                return new IntPtr(1);
            }

            if (msg == WM_PAINT)
            {
                try
                {
                    PaintChromeBackdrop(hWnd, leftChrome);
                }
                catch (Exception ex)
                {
                    LogDiagnostic((leftChrome ? "left" : "right") + " provider chrome paint failed: " + ex.GetType().Name + ": " + ex.Message);
                    PAINTSTRUCT failedPaint;
                    IntPtr failedHdc = BeginPaint(hWnd, out failedPaint);
                    if (failedHdc != IntPtr.Zero) EndPaint(hWnd, ref failedPaint);
                }
                return IntPtr.Zero;
            }

            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        if (hWnd == rightCaptionBlockerOverlay || hWnd == rightSplitCaptionBlockerOverlay)
        {
            if (msg == WM_MOUSEACTIVATE)
            {
                return new IntPtr(MA_NOACTIVATE);
            }

            if (msg == WM_ERASEBKGND)
            {
                return new IntPtr(1);
            }

            if (msg == WM_LBUTTONUP || msg == WM_MOUSEMOVE || msg == WM_MOUSELEAVE)
            {
                return IntPtr.Zero;
            }

            if (msg == WM_PAINT)
            {
                try
                {
                    PaintRightCaptionBlocker(hWnd);
                }
                catch (Exception ex)
                {
                    LogDiagnostic("right caption blocker paint failed: " + ex.GetType().Name + ": " + ex.Message);
                    PAINTSTRUCT failedPaint;
                    IntPtr failedHdc = BeginPaint(hWnd, out failedPaint);
                    if (failedHdc != IntPtr.Zero) EndPaint(hWnd, ref failedPaint);
                }
                return IntPtr.Zero;
            }

            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        bool isLeft = hWnd == leftOverlay;
        if (!isLeft && hWnd != rightOverlay)
        {
            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        if (msg == WM_MOUSEACTIVATE)
        {
            return new IntPtr(MA_NOACTIVATE);
        }

        if (msg == WM_ERASEBKGND)
        {
            return new IntPtr(1);
        }

        if (msg == WM_MOUSEMOVE)
        {
            try
            {
            int x = SignedLowWord(lParam.ToInt64());
            int y = SignedHighWord(lParam.ToInt64());
            int hover = HitTestButton(hWnd, isLeft, x, y);

            if (isLeft)
            {
                if (leftHover != hover)
                {
                    leftHover = hover;
                    InvalidateRect(hWnd, IntPtr.Zero, false);
                }

                if (!leftTracking)
                {
                    BeginMouseLeaveTracking(hWnd);
                    leftTracking = true;
                }
            }
            else
            {
                if (rightHover != hover)
                {
                    rightHover = hover;
                    InvalidateRect(hWnd, IntPtr.Zero, false);
                }

                if (!rightTracking)
                {
                    BeginMouseLeaveTracking(hWnd);
                    rightTracking = true;
                }
            }

            }
            catch (Exception ex) { LogNativeFailure("window-mousemove", ex); }
            return IntPtr.Zero;
        }

        if (msg == WM_MOUSELEAVE)
        {
            if (isLeft)
            {
                leftHover = -1;
                leftTracking = false;
            }
            else
            {
                rightHover = -1;
                rightTracking = false;
            }

            InvalidateRect(hWnd, IntPtr.Zero, false);
            return IntPtr.Zero;
        }

        if (msg == WM_LBUTTONUP)
        {
            try
            {
            int x = SignedLowWord(lParam.ToInt64());
            int y = SignedHighWord(lParam.ToInt64());

            int index = HitTestButton(hWnd, isLeft, x, y);
            ButtonDef[] buttons = GetOverlayButtons(isLeft);

            if (index >= 0 && index < buttons.Length)
            {
                string action = buttons[index].Action;
                switch ((action ?? String.Empty).ToLowerInvariant())
                {
                    case "volume":
                        TriggerVolumeShortcut();
                        break;
                    case "volume-right":
                        TriggerTwitchVolumeShortcut();
                        break;
                    case "provider-overflow":
                        if (isLeft) ShowProviderOverflowMenu(hWnd);
                        else SendAction(action);
                        break;
                    default:
                        SendAction(action);
                        break;
                }
            }
            }
            catch (Exception ex) { LogNativeFailure("window-button", ex); }
            return IntPtr.Zero;
        }

        if (msg == WM_PAINT)
        {
            try
            {
                PaintOverlay(hWnd, isLeft);
            }
            catch (Exception ex)
            {
                LogDiagnostic((isLeft ? "left" : "right") + " paint failed: " + ex.GetType().Name + ": " + ex.Message);
                PAINTSTRUCT failedPaint;
                IntPtr failedHdc = BeginPaint(hWnd, out failedPaint);
                if (failedHdc != IntPtr.Zero) EndPaint(hWnd, ref failedPaint);
            }
            return IntPtr.Zero;
        }

        return DefWindowProc(hWnd, msg, wParam, lParam);
    }

    private static void BeginMouseLeaveTracking(IntPtr hWnd)
    {
        TRACKMOUSEEVENT track = new TRACKMOUSEEVENT();
        track.cbSize = (uint)Marshal.SizeOf(typeof(TRACKMOUSEEVENT));
        track.dwFlags = TME_LEAVE;
        track.hwndTrack = hWnd;
        track.dwHoverTime = 0;
        TrackMouseEvent(ref track);
    }

}
