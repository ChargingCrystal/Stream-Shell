using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

internal static class StreamShellTitlebarHost
{
    private const uint WS_POPUP = 0x80000000;
    private const uint WS_CAPTION = 0x00C00000;
        private const uint WS_EX_TOOLWINDOW = 0x00000080;
    private const uint WS_EX_TRANSPARENT = 0x00000020;
    private const uint WS_EX_NOACTIVATE = 0x08000000;
    private const int GWL_STYLE = -16;
    private const int GWLP_HWNDPARENT = -8;
    private const uint GW_HWNDNEXT = 2;
    private const uint GW_OWNER = 4;
    private const int WM_GETICON = 0x007F;
    private const int WM_SETICON = 0x0080;
    private const int ICON_SMALL = 0;
    private const int ICON_BIG = 1;
    private const int ICON_SMALL2 = 2;
    private const int SW_HIDE = 0;
    private const int SW_SHOWNOACTIVATE = 4;
    private const int SW_MAXIMIZE = 3;
    private const int SW_MINIMIZE = 6;
    private const int SW_RESTORE = 9;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SWP_NOSENDCHANGING = 0x0400;
    private const int SM_XVIRTUALSCREEN = 76;
    private const int SM_YVIRTUALSCREEN = 77;
    private const int SM_CYVIRTUALSCREEN = 79;
    private const uint MONITOR_DEFAULTTONEAREST = 2;
    private const int WM_PAINT = 0x000F;
    private const int WM_CLOSE = 0x0010;
    private const int WM_DESTROY = 0x0002;
    private const int WM_TIMER = 0x0113;
    private const int WM_MOUSEMOVE = 0x0200;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_MOUSELEAVE = 0x02A3;
    private const int WM_MOUSEACTIVATE = 0x0021;
    private const int WM_ERASEBKGND = 0x0014;
    private const int WM_APP_SYNC = 0x8001;
    private const int WM_APP_FOCUS = 0x8002;
    private const int MA_NOACTIVATE = 3;
    private const int HTCLIENT = 1;
    private const uint TME_LEAVE = 0x00000002;
    private const uint DT_CENTER = 0x00000001;
    private const uint DT_VCENTER = 0x00000004;
    private const uint DT_SINGLELINE = 0x00000020;
    private const int TRANSPARENT = 1;
    private const int GA_ROOT = 2;
    private const int DWMWA_CAPTION_BUTTON_BOUNDS = 5;
    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const int DWMWA_BORDER_COLOR = 34;
    private const int DWMWA_CAPTION_COLOR = 35;
    private const int DWMWA_TEXT_COLOR = 36;
    private const uint DWMWA_COLOR_DEFAULT = 0xFFFFFFFF;
    private const int DEFAULT_DPI = 96;
    private const int IDC_ARROW = 32512;
    private const uint WM_QUIT = 0x0012;
    private const byte VK_CONTROL = 0x11;
    private const byte VK_SHIFT = 0x10;
    private const byte VK_MENU = 0x12;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const ushort VT_EMPTY = 0;
    private const ushort VT_LPWSTR = 31;
    private const string STREAM_SHELL_APP_ID = "SvenRieseler.StreamShell.Desktop";
    private const int TITLEBAR_PROTOCOL_VERSION = 4;
    private const uint HEARTBEAT_TIMEOUT_MS = 6500;

    private static readonly IntPtr HWND_TOP = IntPtr.Zero;
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    private static readonly IntPtr HWND_MESSAGE = new IntPtr(-3);
    private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

    private static readonly object StateLock = new object();
    private static readonly object OutputLock = new object();
    private static readonly WndProcDelegate WindowProcDelegate = WindowProc;

    private static IntPtr controllerWindow = IntPtr.Zero;
    private static IntPtr leftChromeOverlay = IntPtr.Zero;
    private static IntPtr rightChromeOverlay = IntPtr.Zero;
    private static IntPtr rightCaptionBlockerOverlay = IntPtr.Zero;
    private static IntPtr leftOverlay = IntPtr.Zero;
    private static IntPtr rightOverlay = IntPtr.Zero;
    private static IntPtr leftOwner = IntPtr.Zero;
    private static IntPtr rightOwner = IntPtr.Zero;
    private static uint mainThreadId;
    private static bool initialized;
    private static bool shuttingDown;
    private static string layoutProfile = "wide";
    private static string leftMode = "landing";
    private static string rightMode = "dashboard";
    private static bool settingsOpen = false;
    private static bool volumeActive = false;
    private static bool fullscreenActive = false;
    private static string volumeShortcut = "Ctrl+Shift+8";
    private static string visibilityMode = "none";
    private static string pendingFocusSide = String.Empty;
    private static PaneBounds leftPane = new PaneBounds(0, 0, 1920, 1080);
    private static PaneBounds rightPane = new PaneBounds(1920, 0, 1920, 1080);
    private static int leftHover = -1;
    private static int rightHover = -1;
    private static bool leftTracking;
    private static bool rightTracking;
    private static bool firstSyncLogged;
    private static string nativeVisibilityDiagnosticKey = null;
    private static string lastEffectiveVisibility = "none";
    private static int lastHeartbeatTick = Environment.TickCount;
    private static bool protocolCompatible = false;

    /*
     * Browser HWND identity is explicit in both layouts. The extension owns the
     * chrome.windows IDs and publishes a claim containing profile/side/mode and
     * a real tab-title fingerprint. Geometry is validation only; it is never an
     * authorization path by itself.
     */
    private static readonly Dictionary<string, IntPtr> CompactSurfaceWindows =
        new Dictionary<string, IntPtr>(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<string, IntPtr> WideSurfaceWindows =
        new Dictionary<string, IntPtr>(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<string, SurfaceClaimState> PendingSurfaceClaims =
        new Dictionary<string, SurfaceClaimState>(StringComparer.OrdinalIgnoreCase);

    private static bool leftPositionLogged;
    private static bool rightPositionLogged;
    private static int leftLastX = Int32.MinValue;
    private static int leftLastY = Int32.MinValue;
    private static int leftLastWidth = Int32.MinValue;
    private static int leftLastHeight = Int32.MinValue;
    private static IntPtr leftLastTarget = IntPtr.Zero;
    private static int rightLastX = Int32.MinValue;
    private static int rightLastY = Int32.MinValue;
    private static int rightLastWidth = Int32.MinValue;
    private static int rightLastHeight = Int32.MinValue;
    private static IntPtr rightLastTarget = IntPtr.Zero;
    private static int chromeLastX = Int32.MinValue;
    private static int chromeLastY = Int32.MinValue;
    private static int chromeLastWidth = Int32.MinValue;
    private static int chromeLastHeight = Int32.MinValue;
    private static IntPtr chromeLastTarget = IntPtr.Zero;
    private static bool chromePositionLogged;
    private static int rightChromeLastX = Int32.MinValue;
    private static int rightChromeLastY = Int32.MinValue;
    private static int rightChromeLastWidth = Int32.MinValue;
    private static int rightChromeLastHeight = Int32.MinValue;
    private static IntPtr rightChromeLastTarget = IntPtr.Zero;
    private static bool rightChromePositionLogged;
    private static int rightBlockerLastX = Int32.MinValue;
    private static int rightBlockerLastY = Int32.MinValue;
    private static int rightBlockerLastWidth = Int32.MinValue;
    private static int rightBlockerLastHeight = Int32.MinValue;
    private static IntPtr rightBlockerLastTarget = IntPtr.Zero;

    // Windows taskbar identity. These are window-level properties applied only
    // to Opera HWNDs that the helper has already identified as Stream Shell
    // panes. Normal Opera windows keep Opera's own AppUserModelID.
    private static ITaskbarList3 taskbarList = null;
    private static readonly HashSet<IntPtr> TaskbarShellWindows = new HashSet<IntPtr>();
    private static readonly Dictionary<IntPtr, int> PendingTaskbarShellIdentityRetries =
        new Dictionary<IntPtr, int>();
    private static readonly Dictionary<string, Icon> TaskbarOverlayIcons =
        new Dictionary<string, Icon>(StringComparer.OrdinalIgnoreCase);
    private static string taskbarLastOverlayMode = null;
    private static string taskbarLastVisibilityMode = "none";
    private static string operaDefaultAppId = null;
    private static int normalOperaReassertPasses = 0;
    private static int lastShellIdentityAuditTick = Environment.TickCount;
    private static readonly HashSet<IntPtr> TaskbarNormalOperaWindows = new HashSet<IntPtr>();
    private static readonly Dictionary<IntPtr, OriginalTaskbarIdentity> OriginalTaskbarIdentities =
        new Dictionary<IntPtr, OriginalTaskbarIdentity>();

    // Alt+Tab integration. Wide keeps Landing as its permanent representative.
    // Compact dynamically promotes the explicitly claimed current surface
    // (Dashboard or provider) and owns only the inactive/minimized shell HWNDs.
    // Windows therefore treats Stream Shell as one task-switcher unit without
    // touching unrelated Opera windows or the Windows player.
    private static readonly Dictionary<IntPtr, IntPtr> OriginalAltTabOwners =
        new Dictionary<IntPtr, IntPtr>();
    private static readonly Dictionary<IntPtr, OriginalAltTabPresentation> OriginalAltTabPresentations =
        new Dictionary<IntPtr, OriginalAltTabPresentation>();
    private static readonly HashSet<IntPtr> AltTabManagedWindows = new HashSet<IntPtr>();
    private static readonly Dictionary<string, Icon> AltTabIcons =
        new Dictionary<string, Icon>(StringComparer.OrdinalIgnoreCase);
    private static IntPtr altTabRepresentative = IntPtr.Zero;
    private static string altTabLastMode = null;
    private static string altTabLayoutProfile = null;
    private static int altTabLastPresentationTick = Environment.TickCount;
    private static IntPtr altTabLastPresentationHandle = IntPtr.Zero;

    // Provider-tinted native chrome. Windows 11 exposes caption/border colors
    // through DWM. Opera may choose to client-draw parts of its frame, so the
    // calls are deliberately best-effort and never required for Stream Shell.
    private static readonly Dictionary<IntPtr, string> WindowChromeModes =
        new Dictionary<IntPtr, string>();

    private static readonly string DiagnosticLogPath = Path.Combine(
        AppDomain.CurrentDomain.BaseDirectory,
        "titlebar.log"
    );

    private static readonly Dictionary<string, Bitmap> ButtonIcons =
        new Dictionary<string, Bitmap>(StringComparer.OrdinalIgnoreCase);

    private sealed class SurfaceClaimState
    {
        public string LayoutProfile;
        public string Side;
        public string Mode;
        public string TitleHint;
        public IntPtr Candidate;
        public int StablePasses;
        public int Attempts;

        public SurfaceClaimState(string layoutProfile, string side, string mode, string titleHint)
        {
            LayoutProfile = layoutProfile ?? String.Empty;
            Side = side ?? String.Empty;
            Mode = mode ?? String.Empty;
            TitleHint = titleHint ?? String.Empty;
            Candidate = IntPtr.Zero;
            StablePasses = 0;
            Attempts = 0;
        }
    }

    private sealed class OriginalTaskbarIdentity
    {
        public string AppId;
        public string RelaunchIcon;

        public OriginalTaskbarIdentity(string appId, string relaunchIcon)
        {
            AppId = appId;
            RelaunchIcon = relaunchIcon;
        }
    }

    private sealed class OriginalAltTabPresentation
    {
        public string Title;
        public IntPtr BigIcon;
        public IntPtr SmallIcon;

        public OriginalAltTabPresentation(string title, IntPtr bigIcon, IntPtr smallIcon)
        {
            Title = title;
            BigIcon = bigIcon;
            SmallIcon = smallIcon;
        }
    }

    private sealed class ChromeTheme
    {
        public uint Background;
        public uint Hover;
        public uint Active;
        public uint Divider;
        public uint Caption;
        public uint Border;

        public ChromeTheme(uint background, uint hover, uint active, uint divider, uint caption, uint border)
        {
            Background = background;
            Hover = hover;
            Active = active;
            Divider = divider;
            Caption = caption;
            Border = border;
        }
    }

    private sealed class ButtonDef
    {
        public string Label;
        public string Action;
        public string IconFile;
        public int IconWidth;
        public int IconHeight;

        public ButtonDef(string label, string action)
            : this(label, action, null, 0, 0)
        {
        }

        public ButtonDef(string label, string action, string iconFile, int iconWidth, int iconHeight)
        {
            Label = label;
            Action = action;
            IconFile = iconFile;
            IconWidth = iconWidth;
            IconHeight = iconHeight;
        }
    }

    private sealed class PaneBounds
    {
        public int Left;
        public int Top;
        public int Width;
        public int Height;

        public PaneBounds(int left, int top, int width, int height)
        {
            Left = left;
            Top = top;
            Width = width;
            Height = height;
        }
    }

    private sealed class TargetInfo
    {
        public IntPtr Handle;
        public string ProcessName;
        public RECT Rect;
        public int Dpi;
        public int TitlebarHeight;
        public int CaptionLeft;
    }

    private static readonly ButtonDef[] LeftButtons = new ButtonDef[]
    {
        // Same icon language as the retired floating navbar / Stream Shell UI.
        new ButtonDef("H", "landing", "landing.png", 17, 17),
        new ButtonDef("V", "volume", "volume.png", 18, 18),
        new ButtonDef("YT", "youtube", "youtube.png", 19, 14),
        new ButtonDef("N", "netflix", "netflix.png", 12, 20),
        new ButtonDef("P", "prime", "prime.png", 18, 18),
        new ButtonDef("D+", "disney", "disney.png", 20, 20),
        new ButtonDef("CR", "crunchyroll", "crunchyroll.png", 19, 19),
        new ButtonDef("DB", "dashboard", "dashboard.png", 17, 17),
        new ButtonDef("S", "settings", "settings.png", 18, 18),
        new ButtonDef("DC", "discord", "discord.png", 20, 17),
        new ButtonDef("TW", "twitch", "twitch.png", 20, 20),
        new ButtonDef("X", "kill", "kill.png", 18, 18)
    };

    private static readonly ButtonDef[] CompactButtons = new ButtonDef[]
    {
        // Compact is one surface. Global actions first, then providers, then
        // the shell kill switch. Discord remains a Wide-only companion.
        new ButtonDef("DB", "dashboard", "dashboard.png", 17, 17),
        new ButtonDef("S", "settings", "settings.png", 18, 18),
        // Use the exact circular-arrow glyph already used by Wide Dashboard.
        new ButtonDef("\u21BB", "reload"),
        new ButtonDef("V", "volume", "volume.png", 18, 18),
        new ButtonDef("YT", "youtube", "youtube.png", 19, 14),
        new ButtonDef("N", "netflix", "netflix.png", 12, 20),
        new ButtonDef("P", "prime", "prime.png", 18, 18),
        new ButtonDef("D+", "disney", "disney.png", 20, 20),
        new ButtonDef("CR", "crunchyroll", "crunchyroll.png", 19, 19),
        new ButtonDef("X", "kill", "kill.png", 18, 18)
    };

    private static readonly ButtonDef[] RightButtons = new ButtonDef[]
    {
        new ButtonDef("DB", "dashboard"),
        new ButtonDef("DC", "discord")
    };

    private static readonly ButtonDef[] RightDiscordButtons = new ButtonDef[]
    {
        new ButtonDef("DB", "dashboard")
    };

    private static readonly ButtonDef[] RightTwitchButtons = new ButtonDef[]
    {
        new ButtonDef("DB", "dashboard"),
        new ButtonDef("V", "volume-right", "volume.png", 18, 18)
    };

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;

        public PROPERTYKEY(Guid formatId, uint propertyId)
        {
            fmtid = formatId;
            pid = propertyId;
        }
    }

    [StructLayout(LayoutKind.Explicit, Size = 16)]
    private struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointerValue;
    }

    [ComImport]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint cProps);
        [PreserveSig] int GetAt(uint iProp, out PROPERTYKEY pkey);
        [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        [PreserveSig] int Commit();
    }

    [ComImport]
    [Guid("EA1AFB91-9E28-4B86-90E9-9E9F8A5EE35A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ITaskbarList3
    {
        [PreserveSig] int HrInit();
        [PreserveSig] int AddTab(IntPtr hwnd);
        [PreserveSig] int DeleteTab(IntPtr hwnd);
        [PreserveSig] int ActivateTab(IntPtr hwnd);
        [PreserveSig] int SetActiveAlt(IntPtr hwnd);
        [PreserveSig] int MarkFullscreenWindow(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool fFullscreen);
        [PreserveSig] int SetProgressValue(IntPtr hwnd, ulong ullCompleted, ulong ullTotal);
        [PreserveSig] int SetProgressState(IntPtr hwnd, uint tbpFlags);
        [PreserveSig] int RegisterTab(IntPtr hwndTab, IntPtr hwndMDI);
        [PreserveSig] int UnregisterTab(IntPtr hwndTab);
        [PreserveSig] int SetTabOrder(IntPtr hwndTab, IntPtr hwndInsertBefore);
        [PreserveSig] int SetTabActive(IntPtr hwndTab, IntPtr hwndMDI, uint tbatFlags);
        [PreserveSig] int ThumbBarAddButtons(IntPtr hwnd, uint cButtons, IntPtr pButtons);
        [PreserveSig] int ThumbBarUpdateButtons(IntPtr hwnd, uint cButtons, IntPtr pButtons);
        [PreserveSig] int ThumbBarSetImageList(IntPtr hwnd, IntPtr himl);
        [PreserveSig] int SetOverlayIcon(IntPtr hwnd, IntPtr hIcon, [MarshalAs(UnmanagedType.LPWStr)] string pszDescription);
    }

    [ComImport]
    [Guid("56FDF344-FD6D-11D0-958A-006097C9A090")]
    private class CTaskbarList
    {
    }

    private static readonly Guid IPropertyStoreGuid =
        new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");

    private static readonly Guid AppUserModelFormatId =
        new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");

    private static readonly PROPERTYKEY PKEY_AppUserModel_RelaunchIconResource =
        new PROPERTYKEY(AppUserModelFormatId, 3);

    private static readonly PROPERTYKEY PKEY_AppUserModel_ID =
        new PROPERTYKEY(AppUserModelFormatId, 5);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;

        public POINT(int x, int y)
        {
            X = x;
            Y = y;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WNDCLASSEX
    {
        public uint cbSize;
        public uint style;
        public IntPtr lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public IntPtr hInstance;
        public IntPtr hIcon;
        public IntPtr hCursor;
        public IntPtr hbrBackground;
        public string lpszMenuName;
        public string lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PAINTSTRUCT
    {
        public IntPtr hdc;
        public bool fErase;
        public RECT rcPaint;
        public bool fRestore;
        public bool fIncUpdate;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 32)]
        public byte[] rgbReserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct TRACKMOUSEEVENT
    {
        public uint cbSize;
        public uint dwFlags;
        public IntPtr hwndTrack;
        public uint dwHoverTime;
    }

    private delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern ushort RegisterClassEx(ref WNDCLASSEX lpwcx);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr LoadCursor(IntPtr hInstance, IntPtr lpCursorName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateWindowEx(
        uint dwExStyle,
        string lpClassName,
        string lpWindowName,
        uint dwStyle,
        int x,
        int y,
        int nWidth,
        int nHeight,
        IntPtr hWndParent,
        IntPtr hMenu,
        IntPtr hInstance,
        IntPtr lpParam
    );

    [DllImport("user32.dll")]
    private static extern IntPtr DefWindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool DestroyWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SetWindowText(IntPtr hWnd, string lpString);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern bool UpdateWindow(IntPtr hWnd);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT point);

    [DllImport("user32.dll")]
    private static extern IntPtr GetAncestor(IntPtr hWnd, int gaFlags);

    [DllImport("user32.dll")]
    private static extern bool InvalidateRect(IntPtr hWnd, IntPtr lpRect, bool bErase);

    [DllImport("user32.dll")]
    private static extern bool TrackMouseEvent(ref TRACKMOUSEEVENT lpEventTrack);

    [DllImport("user32.dll")]
    private static extern IntPtr BeginPaint(IntPtr hWnd, out PAINTSTRUCT lpPaint);

    [DllImport("user32.dll")]
    private static extern bool EndPaint(IntPtr hWnd, ref PAINTSTRUCT lpPaint);

    [DllImport("user32.dll")]
    private static extern int FillRect(IntPtr hDC, ref RECT lprc, IntPtr hbr);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int DrawText(IntPtr hdc, string lpchText, int cchText, ref RECT lprc, uint format);

    [DllImport("gdi32.dll")]
    private static extern int SetBkMode(IntPtr hdc, int mode);

    [DllImport("gdi32.dll")]
    private static extern uint SetTextColor(IntPtr hdc, uint color);

    [DllImport("user32.dll")]
    private static extern IntPtr SetTimer(IntPtr hWnd, UIntPtr nIDEvent, uint uElapse, IntPtr lpTimerFunc);

    [DllImport("user32.dll")]
    private static extern bool KillTimer(IntPtr hWnd, UIntPtr uIDEvent);

    [DllImport("user32.dll")]
    private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpmsg);

    [DllImport("user32.dll")]
    private static extern void PostQuitMessage(int nExitCode);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool PostThreadMessage(uint idThread, uint Msg, UIntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hWnd);

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT pvar);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref uint pvAttribute, int cbAttribute);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateSolidBrush(uint crColor);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateFont(
        int nHeight,
        int nWidth,
        int nEscapement,
        int nOrientation,
        int fnWeight,
        uint fdwItalic,
        uint fdwUnderline,
        uint fdwStrikeOut,
        uint fdwCharSet,
        uint fdwOutputPrecision,
        uint fdwClipPrecision,
        uint fdwQuality,
        uint fdwPitchAndFamily,
        string lpszFace
    );

    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("shell32.dll", PreserveSig = true)]
    private static extern int SHGetPropertyStoreForWindow(
        IntPtr hwnd,
        ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out IPropertyStore ppv
    );

    public static int Main()
    {
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

            SetTimer(controllerWindow, new UIntPtr(1), 500, IntPtr.Zero);

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
            LogDiagnostic("fatal: " + ex.GetType().Name + ": " + ex.Message);
            CleanupWindows();
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

    private static IntPtr WindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (hWnd == controllerWindow)
        {
            if (msg == WM_TIMER || msg == WM_APP_SYNC)
            {
                SyncOverlays();
                return IntPtr.Zero;
            }

            if (msg == WM_APP_FOCUS)
            {
                FocusRequestedPane();
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
                CleanupOverlay(ref leftOverlay);
                CleanupOverlay(ref rightOverlay);
                PostQuitMessage(0);
                return IntPtr.Zero;
            }

            return DefWindowProc(hWnd, msg, wParam, lParam);
        }

        if (hWnd == leftChromeOverlay || hWnd == rightChromeOverlay)
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

        if (hWnd == rightCaptionBlockerOverlay)
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
            int x = SignedLowWord(lParam.ToInt64());
            int y = SignedHighWord(lParam.ToInt64());

            int index = HitTestButton(hWnd, isLeft, x, y);
            ButtonDef[] buttons = GetOverlayButtons(isLeft);

            if (index >= 0 && index < buttons.Length)
            {
                if (String.Equals(buttons[index].Action, "volume", StringComparison.OrdinalIgnoreCase))
                {
                    TriggerVolumeShortcut();
                }
                else if (String.Equals(buttons[index].Action, "volume-right", StringComparison.OrdinalIgnoreCase))
                {
                    TriggerTwitchVolumeShortcut();
                }
                else
                {
                    SendAction(buttons[index].Action);
                }
            }

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

    private static ButtonDef[] GetOverlayButtons(bool isLeft)
    {
        bool compact = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);

        if (isLeft)
        {
            return compact ? CompactButtons : LeftButtons;
        }

        if (compact)
        {
            return new ButtonDef[0];
        }

        lock (StateLock)
        {
            if (String.Equals(rightMode, "discord", StringComparison.OrdinalIgnoreCase))
            {
                return RightDiscordButtons;
            }

            if (String.Equals(rightMode, "twitch", StringComparison.OrdinalIgnoreCase))
            {
                return RightTwitchButtons;
            }

            return RightButtons;
        }
    }

    private static bool HasLeftDividerAfter(int buttonIndex)
    {
        if (String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase))
        {
            // Dashboard + Settings + Reload + Volume | providers | Kill
            return buttonIndex == 3 || buttonIndex == 8;
        }

        // Landing + Volume + providers | Dashboard + Settings + Discord + Twitch | Kill
        return buttonIndex == 6 || buttonIndex == 10;
    }

    private static int GetLeftButtonWidth(int dpi)
    {
        return Scale(30, dpi);
    }

    private static int GetLeftGap(int dpi)
    {
        return Scale(4, dpi);
    }

    private static int GetLeftDividerMargin(int dpi)
    {
        return Scale(7, dpi);
    }

    private static int GetLeftDividerWidth(int dpi)
    {
        return Scale(1, dpi);
    }

    private static int GetLeftOverlayWidth(int dpi)
    {
        int width = 0;
        int buttonWidth = GetLeftButtonWidth(dpi);
        int gap = GetLeftGap(dpi);
        int dividerMargin = GetLeftDividerMargin(dpi);
        int dividerWidth = GetLeftDividerWidth(dpi);

        ButtonDef[] buttons = GetOverlayButtons(true);
        for (int i = 0; i < buttons.Length; i++)
        {
            width += buttonWidth;
            if (i >= buttons.Length - 1)
            {
                continue;
            }

            width += HasLeftDividerAfter(i)
                ? dividerMargin + dividerWidth + dividerMargin
                : gap;
        }

        return width;
    }


    private static int HitTestButton(IntPtr hWnd, bool isLeft, int x, int y)
    {
        RECT client;
        if (!GetClientRect(hWnd, out client))
        {
            return -1;
        }

        int height = Math.Max(1, client.Bottom - client.Top);
        if (y < 0 || y >= height)
        {
            return -1;
        }

        int dpi = isLeft ? GetTargetDpi(leftOwner) : GetTargetDpi(rightOwner);
        ButtonDef[] buttons = GetOverlayButtons(isLeft);

        if (isLeft)
        {
            int buttonWidth = GetLeftButtonWidth(dpi);
            int gap = GetLeftGap(dpi);
            int dividerMargin = GetLeftDividerMargin(dpi);
            int dividerWidth = GetLeftDividerWidth(dpi);
            int cursor = 0;

            for (int i = 0; i < buttons.Length; i++)
            {
                int right = cursor + buttonWidth;
                if (x >= cursor && x < right)
                {
                    return i;
                }

                if (i < buttons.Length - 1)
                {
                    cursor = right + (HasLeftDividerAfter(i)
                        ? dividerMargin + dividerWidth + dividerMargin
                        : gap);
                }
            }

            return -1;
        }

        int rightGap = Scale(4, dpi);
        int count = buttons.Length;
        int width = Math.Max(1, client.Right - client.Left);
        int totalGap = rightGap * Math.Max(0, count - 1);
        int rightButtonWidth = Math.Max(1, (width - totalGap) / count);
        int rightCursor = 0;

        for (int i = 0; i < count; i++)
        {
            int right = i == count - 1 ? width : rightCursor + rightButtonWidth;
            if (x >= rightCursor && x < right)
            {
                return i;
            }
            rightCursor = right + rightGap;
        }

        return -1;
    }

    private static void PaintChromeBackdrop(IntPtr hWnd, bool isLeft)
    {
        PAINTSTRUCT ps;
        IntPtr hdc = BeginPaint(hWnd, out ps);
        if (hdc == IntPtr.Zero)
        {
            return;
        }

        try
        {
            RECT client;
            if (!GetClientRect(hWnd, out client))
            {
                return;
            }

            string mode;
            lock (StateLock) { mode = leftMode; }

            ChromeTheme theme = GetChromeTheme(mode);
            IntPtr background = CreateSolidBrush(theme.Background);
            FillRect(hdc, ref client, background);
            DeleteObject(background);

            if (isLeft)
            {
                int width = Math.Max(1, client.Right - client.Left);
                int height = Math.Max(1, client.Bottom - client.Top);
                int dpi = GetTargetDpi(chromeLastTarget);

                RECT title = new RECT();
                title.Left = Scale(12, dpi);
                title.Top = 0;
                title.Right = Math.Min(width, Scale(240, dpi));
                title.Bottom = height;

                IntPtr font = CreateFont(
                    -Scale(11, dpi), 0, 0, 0, 600,
                    0, 0, 0, 1, 0, 0, 5, 0, "Segoe UI"
                );
                IntPtr oldFont = SelectObject(hdc, font);
                SetBkMode(hdc, TRANSPARENT);
                SetTextColor(hdc, Rgb(226, 222, 230));
                DrawText(hdc, "STREAM SHELL", -1, ref title, DT_VCENTER | DT_SINGLELINE);
                SelectObject(hdc, oldFont);
                DeleteObject(font);
            }
        }
        finally
        {
            EndPaint(hWnd, ref ps);
        }
    }

    private static void PaintRightCaptionBlocker(IntPtr hWnd)
    {
        PAINTSTRUCT ps;
        IntPtr hdc = BeginPaint(hWnd, out ps);
        if (hdc == IntPtr.Zero)
        {
            return;
        }

        try
        {
            RECT client;
            if (!GetClientRect(hWnd, out client))
            {
                return;
            }

            string mode;
            lock (StateLock) { mode = leftMode; }
            ChromeTheme theme = GetChromeTheme(mode);
            IntPtr background = CreateSolidBrush(theme.Background);
            FillRect(hdc, ref client, background);
            DeleteObject(background);
        }
        finally
        {
            EndPaint(hWnd, ref ps);
        }
    }

    private static uint GetChromeAccent(string mode)
    {
        if (String.Equals(mode, "youtube", StringComparison.OrdinalIgnoreCase))
            return Rgb(255, 35, 72);
        if (String.Equals(mode, "netflix", StringComparison.OrdinalIgnoreCase))
            return Rgb(229, 9, 20);
        if (String.Equals(mode, "prime", StringComparison.OrdinalIgnoreCase))
            return Rgb(0, 168, 225);
        if (String.Equals(mode, "disney", StringComparison.OrdinalIgnoreCase))
            return Rgb(69, 116, 255);
        if (String.Equals(mode, "crunchyroll", StringComparison.OrdinalIgnoreCase))
            return Rgb(255, 101, 0);

        return Rgb(166, 84, 255);
    }

    private static void PaintOverlay(IntPtr hWnd, bool isLeft)
    {
        PAINTSTRUCT ps;
        IntPtr hdc = BeginPaint(hWnd, out ps);
        if (hdc == IntPtr.Zero)
        {
            return;
        }

        try
        {
            RECT client;
            GetClientRect(hWnd, out client);

            string currentThemeMode;
            lock (StateLock) { currentThemeMode = leftMode; }
            ChromeTheme chromeTheme = GetChromeTheme(currentThemeMode);

            IntPtr background = CreateSolidBrush(chromeTheme.Background);
            FillRect(hdc, ref client, background);
            DeleteObject(background);

            int dpi = isLeft ? GetTargetDpi(leftOwner) : GetTargetDpi(rightOwner);
            ButtonDef[] buttons = GetOverlayButtons(isLeft);
            int count = buttons.Length;
            int hover = isLeft ? leftHover : rightHover;
            int width = Math.Max(1, client.Right - client.Left);
            int height = Math.Max(1, client.Bottom - client.Top);

            Graphics graphics = null;
            try
            {
                if (isLeft)
                {
                    graphics = Graphics.FromHdc(hdc);
                    graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceOver;
                    graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
                    graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                    graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                }

                int cursor = 0;
                int fixedLeftButtonWidth = isLeft ? GetLeftButtonWidth(dpi) : 0;
                int gap = Scale(4, dpi);
                int rightButtonWidth = !isLeft
                    ? Math.Max(1, (width - gap * Math.Max(0, count - 1)) / Math.Max(1, count))
                    : 0;

                for (int i = 0; i < count; i++)
                {
                    int right = isLeft
                        ? cursor + fixedLeftButtonWidth
                        : (i == count - 1 ? width : cursor + rightButtonWidth);

                    RECT rect = new RECT();
                    rect.Left = cursor;
                    rect.Top = 0;
                    rect.Right = right;
                    rect.Bottom = height;

                    bool active = IsActionActive(buttons[i].Action);
                    bool hovered = hover == i;
                    bool isKill = String.Equals(buttons[i].Action, "kill", StringComparison.OrdinalIgnoreCase);
                    if (active || hovered)
                    {
                        uint fill = isKill && hovered
                            ? Rgb(72, 13, 24)
                            : (active ? chromeTheme.Active : chromeTheme.Hover);
                        IntPtr brush = CreateSolidBrush(fill);
                        FillRect(hdc, ref rect, brush);
                        DeleteObject(brush);
                    }

                    Bitmap icon;
                    if (
                        isLeft &&
                        buttons[i].IconFile != null &&
                        ButtonIcons.TryGetValue(buttons[i].Action, out icon) &&
                        graphics != null
                    )
                    {
                        int iconWidth = Scale(buttons[i].IconWidth, dpi);
                        int iconHeight = Scale(buttons[i].IconHeight, dpi);
                        int iconX = rect.Left + Math.Max(0, ((rect.Right - rect.Left) - iconWidth) / 2);
                        int iconY = rect.Top + Math.Max(0, ((rect.Bottom - rect.Top) - iconHeight) / 2);
                        float opacity = isKill
                            ? (hovered ? 1.0f : 0.86f)
                            : (active ? 1.0f : (hovered ? 0.92f : 0.70f));

                        using (ImageAttributes attributes = new ImageAttributes())
                        {
                            ColorMatrix matrix = new ColorMatrix();
                            matrix.Matrix00 = 1.0f;
                            matrix.Matrix11 = 1.0f;
                            matrix.Matrix22 = 1.0f;
                            matrix.Matrix33 = opacity;
                            matrix.Matrix44 = 1.0f;
                            attributes.SetColorMatrix(
                                matrix,
                                ColorMatrixFlag.Default,
                                ColorAdjustType.Bitmap
                            );

                            graphics.DrawImage(
                                icon,
                                new System.Drawing.Rectangle(iconX, iconY, iconWidth, iconHeight),
                                0,
                                0,
                                icon.Width,
                                icon.Height,
                                GraphicsUnit.Pixel,
                                attributes
                            );
                        }
                    }
                    else
                    {
                        bool reloadText =
                            String.Equals(buttons[i].Action, "reload", StringComparison.OrdinalIgnoreCase);
                        int textSize = reloadText ? 17 : 12;
                        IntPtr font = CreateFont(
                            -Scale(textSize, dpi), 0, 0, 0, reloadText ? 400 : 600,
                            0, 0, 0, 1, 0, 0, 5, 0,
                            reloadText ? "Segoe UI Symbol" : "Segoe UI"
                        );
                        IntPtr oldFont = SelectObject(hdc, font);
                        SetBkMode(hdc, TRANSPARENT);
                        SetTextColor(hdc, active ? Rgb(225, 164, 255) : Rgb(205, 200, 211));
                        DrawText(hdc, buttons[i].Label, -1, ref rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
                        SelectObject(hdc, oldFont);
                        DeleteObject(font);
                    }

                    if (isLeft && i < count - 1 && HasLeftDividerAfter(i))
                    {
                        int dividerMargin = GetLeftDividerMargin(dpi);
                        int dividerWidth = GetLeftDividerWidth(dpi);
                        int dividerHeight = Math.Min(Scale(14, dpi), Math.Max(1, height - Scale(6, dpi)));
                        int dividerX = right + dividerMargin;
                        RECT divider = new RECT();
                        divider.Left = dividerX;
                        divider.Right = dividerX + dividerWidth;
                        divider.Top = Math.Max(0, (height - dividerHeight) / 2);
                        divider.Bottom = divider.Top + dividerHeight;
                        IntPtr dividerBrush = CreateSolidBrush(chromeTheme.Divider);
                        FillRect(hdc, ref divider, dividerBrush);
                        DeleteObject(dividerBrush);

                        cursor = right + dividerMargin + dividerWidth + dividerMargin;
                    }
                    else if (i < count - 1)
                    {
                        cursor = right + gap;
                    }
                }

            }
            finally
            {
                if (graphics != null)
                {
                    graphics.Dispose();
                }
            }
        }
        finally
        {
            EndPaint(hWnd, ref ps);
        }
    }

    private static void LoadButtonIcons()
    {
        string iconRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons");

        ButtonDef[][] iconSets = new ButtonDef[][]
        {
            LeftButtons,
            CompactButtons,
            RightTwitchButtons
        };

        for (int setIndex = 0; setIndex < iconSets.Length; setIndex++)
        {
            ButtonDef[] buttons = iconSets[setIndex];
            for (int i = 0; i < buttons.Length; i++)
            {
                ButtonDef button = buttons[i];
                if (String.IsNullOrEmpty(button.IconFile) || ButtonIcons.ContainsKey(button.Action))
                {
                    continue;
                }

                string path = Path.Combine(iconRoot, button.IconFile);
                try
                {
                    if (!File.Exists(path))
                    {
                        LogDiagnostic("icon missing: " + path);
                        continue;
                    }

                    using (Image source = Image.FromFile(path))
                    {
                        ButtonIcons[button.Action] = new Bitmap(source);
                    }
                }
                catch (Exception ex)
                {
                    LogDiagnostic("icon load failed " + button.Action + ": " + ex.Message);
                }
            }
        }

        LogDiagnostic("titlebar icons loaded=" + ButtonIcons.Count);
    }

    private static void DisposeButtonIcons()
    {
        foreach (Bitmap icon in ButtonIcons.Values)
        {
            try { icon.Dispose(); } catch { }
        }
        ButtonIcons.Clear();
    }

    private static bool IsActionActive(string action)
    {
        lock (StateLock)
        {
            if (action == "landing" || action == "youtube" || action == "netflix" || action == "prime" || action == "disney" || action == "crunchyroll")
            {
                return String.Equals(leftMode, action, StringComparison.OrdinalIgnoreCase);
            }

            if (action == "dashboard")
            {
                return String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase)
                    ? String.Equals(leftMode, "dashboard", StringComparison.OrdinalIgnoreCase)
                    : String.Equals(rightMode, "dashboard", StringComparison.OrdinalIgnoreCase);
            }

            if (action == "discord" || action == "twitch")
            {
                return String.Equals(rightMode, action, StringComparison.OrdinalIgnoreCase);
            }

            if (action == "volume-right")
            {
                return volumeActive && String.Equals(rightMode, "twitch", StringComparison.OrdinalIgnoreCase);
            }

            if (action == "settings")
            {
                return settingsOpen &&
                    (
                        String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase) ||
                        String.Equals(rightMode, "dashboard", StringComparison.OrdinalIgnoreCase)
                    );
            }

            if (action == "volume")
            {
                return volumeActive &&
                    (leftMode == "youtube" || leftMode == "netflix" || leftMode == "prime" || leftMode == "disney" || leftMode == "crunchyroll");
            }
        }

        return false;
    }

    private static bool ShouldSuppressChromeForSpanningForeground(
        string currentVisibility,
        PaneBounds left,
        PaneBounds right
    )
    {
        // Chromium true-fullscreen expands the active provider HWND across the
        // complete 32:9 monitor. Stream Shell's custom titlebar overlays are
        // TOPMOST, so hide only those overlays while the provider spans both
        // panes. No taskbar identity, ownership or window style is modified.
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground) ||
            !IsWindowVisible(foreground) || IsIconic(foreground) ||
            !IsOperaProcess(GetProcessName(foreground)))
        {
            return false;
        }

        bool knownShellWindow;
        lock (TaskbarShellWindows)
        {
            knownShellWindow = TaskbarShellWindows.Contains(foreground);
        }
        if (!knownShellWindow)
        {
            lock (AltTabManagedWindows)
            {
                knownShellWindow = AltTabManagedWindows.Contains(foreground);
            }
        }

        if (!knownShellWindow &&
            !String.Equals(currentVisibility, "shell", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        RECT rect;
        if (!GetWindowRect(foreground, out rect))
        {
            return false;
        }

        int shellLeft = Math.Min(left.Left, right.Left);
        int shellTop = Math.Min(left.Top, right.Top);
        int shellRight = Math.Max(left.Left + left.Width, right.Left + right.Width);
        int shellBottom = Math.Max(left.Top + left.Height, right.Top + right.Height);
        int shellWidth = Math.Max(1, shellRight - shellLeft);
        int shellHeight = Math.Max(1, shellBottom - shellTop);
        int tolerance = Math.Max(4, Scale(8, GetTargetDpi(foreground)));

        int width = Math.Max(0, rect.Right - rect.Left);
        int height = Math.Max(0, rect.Bottom - rect.Top);

        return
            rect.Left <= shellLeft + tolerance &&
            rect.Top <= shellTop + tolerance &&
            rect.Right >= shellRight - tolerance &&
            rect.Bottom >= shellBottom - tolerance &&
            width >= shellWidth - (tolerance * 2) &&
            height >= shellHeight - (tolerance * 2);
    }


    private static bool ShouldSuppressChromeForCompactForeground(
        TargetInfo target,
        PaneBounds pane
    )
    {
        if (target == null || target.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(target) || !IsCompactForegroundTarget(target))
        {
            return false;
        }

        RECT rect;
        if (!GetWindowRect(target.Handle, out rect))
        {
            return false;
        }

        IntPtr monitor = MonitorFromWindow(target.Handle, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
        {
            return false;
        }

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info))
        {
            return false;
        }

        int tolerance = Math.Max(4, Scale(8, target.Dpi));
        bool fillsMonitor =
            rect.Left <= info.rcMonitor.Left + tolerance &&
            rect.Top <= info.rcMonitor.Top + tolerance &&
            rect.Right >= info.rcMonitor.Right - tolerance &&
            rect.Bottom >= info.rcMonitor.Bottom - tolerance;

        if (!fillsMonitor)
        {
            return false;
        }

        int paneRight = pane.Left + pane.Width;
        int paneBottom = pane.Top + pane.Height;

        // Normal Compact deliberately fills the work area. Treat geometry as
        // fullscreen only when Chromium expands beyond that normal surface into
        // the monitor area (typically over the taskbar). If work area == monitor,
        // the explicit Fullscreen API signal remains the authoritative path.
        return
            rect.Left < pane.Left - tolerance ||
            rect.Top < pane.Top - tolerance ||
            rect.Right > paneRight + tolerance ||
            rect.Bottom > paneBottom + tolerance;
    }


    private static bool IsWindowAboveInZOrder(IntPtr candidate, IntPtr target)
    {
        if (candidate == IntPtr.Zero || target == IntPtr.Zero || candidate == target ||
            !IsWindow(candidate) || !IsWindow(target))
        {
            return false;
        }

        IntPtr cursor = candidate;
        for (int guard = 0; guard < 512 && cursor != IntPtr.Zero; guard++)
        {
            cursor = GetWindow(cursor, GW_HWNDNEXT);
            if (cursor == target)
            {
                return true;
            }
        }

        return false;
    }

    private static string GetWideSurfaceKey(string side, string mode)
    {
        return (side ?? String.Empty).ToLowerInvariant() + "|" + (mode ?? String.Empty).ToLowerInvariant();
    }

    private static IntPtr GetCompactSurfaceHandle(string mode)
    {
        if (String.IsNullOrWhiteSpace(mode))
        {
            return IntPtr.Zero;
        }

        lock (StateLock)
        {
            IntPtr hWnd;
            if (!CompactSurfaceWindows.TryGetValue(mode, out hWnd))
            {
                return IntPtr.Zero;
            }

            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                CompactSurfaceWindows.Remove(mode);
                return IntPtr.Zero;
            }

            return hWnd;
        }
    }

    private static IntPtr GetWideSurfaceHandle(string side, string mode)
    {
        if (String.IsNullOrWhiteSpace(side) || String.IsNullOrWhiteSpace(mode))
        {
            return IntPtr.Zero;
        }

        string key = GetWideSurfaceKey(side, mode);
        lock (StateLock)
        {
            IntPtr hWnd;
            if (!WideSurfaceWindows.TryGetValue(key, out hWnd))
            {
                return IntPtr.Zero;
            }

            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                WideSurfaceWindows.Remove(key);
                return IntPtr.Zero;
            }

            return hWnd;
        }
    }

    private static bool IsCompactKnownSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in CompactSurfaceWindows.Values)
            {
                if (known == hWnd)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsWideKnownSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in WideSurfaceWindows.Values)
            {
                if (known == hWnd)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsExplicitShellSurfaceHandle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;
        return IsCompactKnownSurfaceHandle(candidate) || IsWideKnownSurfaceHandle(candidate);
    }

    private static bool IsHandleReferencedBySurfaceMaps(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return false;
        }

        lock (StateLock)
        {
            foreach (IntPtr known in CompactSurfaceWindows.Values)
            {
                if (known == hWnd) return true;
            }
            foreach (IntPtr known in WideSurfaceWindows.Values)
            {
                if (known == hWnd) return true;
            }
        }
        return false;
    }

    private static TargetInfo FindCompactSurfaceTarget(PaneBounds pane, string mode)
    {
        IntPtr hWnd = GetCompactSurfaceHandle(mode);
        if (hWnd == IntPtr.Zero || IsIconic(hWnd))
        {
            return null;
        }

        /* The initial Compact claim already proved geometry/title/foreground.
         * After that, keep the exact mapped HWND authoritative just like Wide.
         * This avoids repeating pane-scoring work on every 500 ms native tick. */
        return TryBuildTrustedOperaTarget(hWnd);
    }

    private static TargetInfo FindWideSurfaceTarget(PaneBounds pane, string side, string mode)
    {
        IntPtr hWnd = GetWideSurfaceHandle(side, mode);
        if (hWnd == IntPtr.Zero || IsIconic(hWnd))
        {
            return null;
        }

        /*
         * Pane geometry is part of the initial Wide claim proof, not a lease on
         * the HWND afterwards. Chromium can temporarily resize the same trusted
         * top-level window for true fullscreen and may restore it a few pixels
         * differently afterwards. Keep the explicit mapping authoritative once
         * established and derive chrome from the mapped HWND's real rectangle.
         */
        return TryBuildTrustedOperaTarget(hWnd);
    }

    private static bool HasPendingSurfaceClaim()
    {
        lock (StateLock)
        {
            return PendingSurfaceClaims.Count > 0;
        }
    }

    private static void ClearPendingSurfaceClaims()
    {
        lock (StateLock)
        {
            PendingSurfaceClaims.Clear();
        }
    }

    private static void RemovePendingSurfaceClaim(string key)
    {
        lock (StateLock)
        {
            PendingSurfaceClaims.Remove(key);
        }
    }

    private static string GetSurfaceClaimKey(string profile, string side, string mode)
    {
        return (profile ?? String.Empty).ToLowerInvariant() + "|" +
            (side ?? String.Empty).ToLowerInvariant() + "|" +
            (mode ?? String.Empty).ToLowerInvariant();
    }

    private static void QueueSurfaceClaim(string profile, string side, string mode, string titleHint)
    {
        string normalizedProfile = (profile ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedSide = (side ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedMode = (mode ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedTitleHint = (titleHint ?? String.Empty).Trim();

        if ((normalizedProfile != "wide" && normalizedProfile != "compact") ||
            (normalizedSide != "left" && normalizedSide != "right") ||
            String.IsNullOrWhiteSpace(normalizedMode) ||
            String.IsNullOrWhiteSpace(normalizedTitleHint))
        {
            return;
        }

        if (normalizedProfile == "compact" && normalizedSide != "left")
        {
            return;
        }

        string key = GetSurfaceClaimKey(normalizedProfile, normalizedSide, normalizedMode);
        bool replaced = false;
        lock (StateLock)
        {
            SurfaceClaimState existing;
            if (PendingSurfaceClaims.TryGetValue(key, out existing) &&
                String.Equals(existing.TitleHint, normalizedTitleHint, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            PendingSurfaceClaims[key] = new SurfaceClaimState(
                normalizedProfile,
                normalizedSide,
                normalizedMode,
                normalizedTitleHint
            );
            replaced = true;
        }

        if (replaced)
        {
            LogDiagnostic(
                "surface claim queued profile=" + normalizedProfile +
                " side=" + normalizedSide +
                " mode=" + normalizedMode +
                " titleHint=" + normalizedTitleHint
            );
        }
    }

    private static bool WindowTitleMatchesHint(IntPtr hWnd, string titleHint)
    {
        if (hWnd == IntPtr.Zero || String.IsNullOrWhiteSpace(titleHint))
        {
            return false;
        }

        string nativeTitle = GetWindowTitle(hWnd);
        if (String.IsNullOrWhiteSpace(nativeTitle))
        {
            return false;
        }

        return
            nativeTitle.IndexOf(titleHint, StringComparison.OrdinalIgnoreCase) >= 0 ||
            titleHint.IndexOf(nativeTitle, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private static TargetInfo FindWideClaimCandidate(PaneBounds pane, string titleHint)
    {
        IntPtr foreground = GetForegroundWindow();
        TargetInfo foregroundCandidate = TryBuildPaneTarget(foreground, pane, false);
        if (foregroundCandidate != null &&
            foregroundCandidate.Handle != IntPtr.Zero &&
            IsOperaProcess(foregroundCandidate.ProcessName) &&
            WindowTitleMatchesHint(foregroundCandidate.Handle, titleHint))
        {
            return foregroundCandidate;
        }

        TargetInfo found = null;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            TargetInfo candidate = TryBuildPaneTarget(hWnd, pane, false);
            if (candidate == null || candidate.Handle == IntPtr.Zero ||
                !IsOperaProcess(candidate.ProcessName) ||
                !WindowTitleMatchesHint(candidate.Handle, titleHint))
            {
                return true;
            }

            found = candidate;
            return false;
        }, IntPtr.Zero);

        return found;
    }

    private static IntPtr GetMappedSurfaceHandle(string profile, string side, string mode)
    {
        return String.Equals(profile, "compact", StringComparison.OrdinalIgnoreCase)
            ? GetCompactSurfaceHandle(mode)
            : GetWideSurfaceHandle(side, mode);
    }

    private static void TryCompleteSurfaceClaims(
        PaneBounds left,
        PaneBounds right,
        string currentVisibility,
        string currentLeftMode,
        string currentRightMode,
        string currentLayoutProfile
    )
    {
        List<string> keys;
        lock (StateLock)
        {
            keys = new List<string>(PendingSurfaceClaims.Keys);
        }

        foreach (string key in keys)
        {
            TryCompleteSurfaceClaim(
                key,
                left,
                right,
                currentVisibility,
                currentLeftMode,
                currentRightMode,
                currentLayoutProfile
            );
        }
    }

    private static void TryCompleteSurfaceClaim(
        string key,
        PaneBounds left,
        PaneBounds right,
        string currentVisibility,
        string currentLeftMode,
        string currentRightMode,
        string currentLayoutProfile
    )
    {
        SurfaceClaimState claim;
        lock (StateLock)
        {
            SurfaceClaimState existing;
            if (!PendingSurfaceClaims.TryGetValue(key, out existing))
            {
                return;
            }

            claim = new SurfaceClaimState(existing.LayoutProfile, existing.Side, existing.Mode, existing.TitleHint);
            claim.Candidate = existing.Candidate;
            claim.StablePasses = existing.StablePasses;
            claim.Attempts = existing.Attempts;
        }

        claim.Attempts++;

        bool stateMatches =
            String.Equals(currentLayoutProfile, claim.LayoutProfile, StringComparison.OrdinalIgnoreCase) &&
            (
                String.Equals(claim.Side, "left", StringComparison.OrdinalIgnoreCase)
                    ? String.Equals(currentLeftMode, claim.Mode, StringComparison.OrdinalIgnoreCase)
                    : String.Equals(currentRightMode, claim.Mode, StringComparison.OrdinalIgnoreCase)
            );

        if (!stateMatches)
        {
            if (claim.Attempts >= 24)
            {
                LogDiagnostic(
                    "surface claim state-timeout profile=" + claim.LayoutProfile +
                    " side=" + claim.Side +
                    " mode=" + claim.Mode +
                    " currentLayout=" + (currentLayoutProfile ?? "none") +
                    " leftMode=" + (currentLeftMode ?? "none") +
                    " rightMode=" + (currentRightMode ?? "none") +
                    " visibility=" + (currentVisibility ?? "none")
                );
                RemovePendingSurfaceClaim(key);
            }
            else
            {
                lock (StateLock)
                {
                    SurfaceClaimState current;
                    if (PendingSurfaceClaims.TryGetValue(key, out current))
                    {
                        current.Attempts = claim.Attempts;
                    }
                }
            }
            return;
        }

        PaneBounds pane = String.Equals(claim.Side, "right", StringComparison.OrdinalIgnoreCase)
            ? right
            : left;
        bool compact = String.Equals(claim.LayoutProfile, "compact", StringComparison.OrdinalIgnoreCase);

        /*
         * Idempotent renewal: once the exact HWND is mapped, a later synthetic
         * Alt+Tab caption must not invalidate the mapping simply because the
         * browser tab title no longer equals the native caption we customized.
         */
        IntPtr mapped = GetMappedSurfaceHandle(claim.LayoutProfile, claim.Side, claim.Mode);
        if (mapped != IntPtr.Zero && IsWindow(mapped))
        {
            TargetInfo mappedTarget = compact
                ? TryBuildPaneTarget(mapped, pane, false)
                : TryBuildTrustedOperaTarget(mapped);
            bool mappedEligible = mappedTarget != null &&
                (!compact || IsCompactForegroundTarget(mappedTarget));
            if (mappedEligible)
            {
                RegisterTaskbarWindow(mapped, "claim-renew-" + claim.LayoutProfile + "-" + claim.Side + "-" + claim.Mode);
                RemovePendingSurfaceClaim(key);
                WriteJson(
                    "{\"event\":\"claim-accepted\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
                    ",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
                    "\",\"side\":\"" + JsonEscape(claim.Side) +
                    "\",\"mode\":\"" + JsonEscape(claim.Mode) + "\",\"renewed\":true}"
                );
                return;
            }
        }

        TargetInfo candidate;
        if (compact)
        {
            IntPtr foreground = GetForegroundWindow();
            candidate = TryBuildPaneTarget(foreground, pane, false);
            if (candidate != null && !WindowTitleMatchesHint(candidate.Handle, claim.TitleHint))
            {
                candidate = null;
            }
        }
        else
        {
            candidate = FindWideClaimCandidate(pane, claim.TitleHint);
        }

        if (candidate == null || candidate.Handle == IntPtr.Zero || !IsOperaProcess(candidate.ProcessName))
        {
            if (claim.Attempts >= 24)
            {
                LogDiagnostic(
                    "surface claim expired profile=" + claim.LayoutProfile +
                    " side=" + claim.Side +
                    " mode=" + claim.Mode +
                    " foreground=" + DescribeWindow(GetForegroundWindow())
                );
                RemovePendingSurfaceClaim(key);
            }
            else
            {
                lock (StateLock)
                {
                    SurfaceClaimState current;
                    if (PendingSurfaceClaims.TryGetValue(key, out current))
                    {
                        current.Candidate = IntPtr.Zero;
                        current.StablePasses = 0;
                        current.Attempts = claim.Attempts;
                    }
                }
            }
            return;
        }

        if (claim.Candidate == candidate.Handle)
        {
            claim.StablePasses++;
        }
        else
        {
            claim.Candidate = candidate.Handle;
            claim.StablePasses = 1;
        }

        int requiredStablePasses = compact ? 2 : 1;
        if (claim.StablePasses < requiredStablePasses)
        {
            lock (StateLock)
            {
                SurfaceClaimState current;
                if (PendingSurfaceClaims.TryGetValue(key, out current))
                {
                    current.Candidate = claim.Candidate;
                    current.StablePasses = claim.StablePasses;
                    current.Attempts = claim.Attempts;
                }
            }
            return;
        }

        IntPtr previousHandle = IntPtr.Zero;
        lock (StateLock)
        {
            if (compact)
            {
                CompactSurfaceWindows.TryGetValue(claim.Mode, out previousHandle);
                List<string> duplicates = new List<string>();
                foreach (KeyValuePair<string, IntPtr> pair in CompactSurfaceWindows)
                {
                    if (pair.Value == candidate.Handle &&
                        !String.Equals(pair.Key, claim.Mode, StringComparison.OrdinalIgnoreCase))
                    {
                        duplicates.Add(pair.Key);
                    }
                }
                foreach (string duplicate in duplicates) CompactSurfaceWindows.Remove(duplicate);
                CompactSurfaceWindows[claim.Mode] = candidate.Handle;
            }
            else
            {
                string wideKey = GetWideSurfaceKey(claim.Side, claim.Mode);
                WideSurfaceWindows.TryGetValue(wideKey, out previousHandle);
                List<string> duplicates = new List<string>();
                foreach (KeyValuePair<string, IntPtr> pair in WideSurfaceWindows)
                {
                    if (pair.Value == candidate.Handle &&
                        !String.Equals(pair.Key, wideKey, StringComparison.OrdinalIgnoreCase))
                    {
                        duplicates.Add(pair.Key);
                    }
                }
                foreach (string duplicate in duplicates) WideSurfaceWindows.Remove(duplicate);
                WideSurfaceWindows[wideKey] = candidate.Handle;
            }
        }

        RegisterTaskbarWindow(candidate.Handle, "claim-" + claim.LayoutProfile + "-" + claim.Side + "-" + claim.Mode);

        if (previousHandle != IntPtr.Zero && previousHandle != candidate.Handle)
        {
            UnregisterShellWindowIfUnreferenced(previousHandle, "surface-replaced");
        }

        LogDiagnostic(
            "surface claim accepted profile=" + claim.LayoutProfile +
            " side=" + claim.Side +
            " mode=" + claim.Mode +
            " hwnd=0x" + candidate.Handle.ToInt64().ToString("X") +
            " nativeTitle=" + GetWindowTitle(candidate.Handle)
        );

        RemovePendingSurfaceClaim(key);
        WriteJson(
            "{\"event\":\"claim-accepted\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
            ",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
            "\",\"side\":\"" + JsonEscape(claim.Side) +
            "\",\"mode\":\"" + JsonEscape(claim.Mode) + "\"}"
        );
    }


    private static bool IsCompactForegroundTarget(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero || !IsWindow(target.Handle))
        {
            return false;
        }

        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground))
        {
            return false;
        }

        if (foreground == target.Handle)
        {
            return true;
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        return root != IntPtr.Zero && root == target.Handle;
    }

    private static bool NeedsCompactZOrderRepair(IntPtr overlay, TargetInfo target, IntPtr mustAlsoBeAbove)
    {
        if (overlay == IntPtr.Zero || target == null || target.Handle == IntPtr.Zero ||
            !IsWindow(overlay) || !IsWindowVisible(overlay) || !IsCompactForegroundTarget(target))
        {
            return false;
        }

        if (!IsWindowAboveInZOrder(overlay, target.Handle))
        {
            return true;
        }

        return
            mustAlsoBeAbove != IntPtr.Zero &&
            IsWindow(mustAlsoBeAbove) &&
            IsWindowVisible(mustAlsoBeAbove) &&
            !IsWindowAboveInZOrder(overlay, mustAlsoBeAbove);
    }


    private static void TouchHeartbeat()
    {
        lock (StateLock)
        {
            lastHeartbeatTick = Environment.TickCount;
        }
    }

    private static bool IsHeartbeatFresh()
    {
        int tick;
        bool compatible;
        lock (StateLock)
        {
            tick = lastHeartbeatTick;
            compatible = protocolCompatible;
        }

        uint elapsed = unchecked((uint)(Environment.TickCount - tick));
        return compatible && elapsed <= HEARTBEAT_TIMEOUT_MS;
    }

    private static string ComputeNativeEffectiveVisibility(
        bool compactLayout,
        TargetInfo leftTarget,
        string currentRightMode,
        PaneBounds right
    )
    {
        if (!IsHeartbeatFresh())
        {
            return "none";
        }

        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground) || IsIconic(foreground))
        {
            return "none";
        }

        if (compactLayout)
        {
            return
                leftTarget != null &&
                IsCompactKnownSurfaceHandle(leftTarget.Handle) &&
                (IsCompactForegroundTarget(leftTarget) ||
                 CanKeepCompactChromeWithForeignForeground(leftTarget))
                    ? "shell"
                    : "none";
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        IntPtr foregroundRoot = root != IntPtr.Zero ? root : foreground;
        if (IsWideKnownSurfaceHandle(foregroundRoot))
        {
            return "shell";
        }

        if (String.Equals(currentRightMode, "discord", StringComparison.OrdinalIgnoreCase))
        {
            TargetInfo discordTarget = TryBuildPaneTarget(foregroundRoot, right, true);
            if (discordTarget != null && discordTarget.Handle != IntPtr.Zero)
            {
                return "discord";
            }
        }

        return "none";
    }

    private static bool IsHelperChromeWindow(IntPtr hWnd)
    {
        return
            hWnd == controllerWindow ||
            hWnd == leftChromeOverlay ||
            hWnd == rightChromeOverlay ||
            hWnd == rightCaptionBlockerOverlay ||
            hWnd == leftOverlay ||
            hWnd == rightOverlay ||
            hWnd == leftOwner ||
            hWnd == rightOwner;
    }

    private static bool MeaningfullyOverlapsWideLeftChrome(IntPtr hWnd, TargetInfo leftTarget)
    {
        if (hWnd == IntPtr.Zero || leftTarget == null || hWnd == leftTarget.Handle ||
            IsHelperChromeWindow(hWnd) || !IsWindow(hWnd) || !IsWindowVisible(hWnd) ||
            IsIconic(hWnd) || IsExplicitShellSurfaceHandle(hWnd))
        {
            return false;
        }

        RECT foreignRect;
        if (!GetWindowRect(hWnd, out foreignRect))
        {
            return false;
        }

        int dpi = leftTarget.Dpi;
        int chromeHeight = Math.Max(Scale(28, dpi), leftTarget.TitlebarHeight + Scale(8, dpi));
        int chromeLeft = leftTarget.Rect.Left;
        int chromeTop = leftTarget.Rect.Top;
        int chromeRight = leftTarget.Rect.Right;
        int chromeBottom = Math.Min(leftTarget.Rect.Bottom, chromeTop + chromeHeight);

        int overlapLeft = Math.Max(chromeLeft, foreignRect.Left);
        int overlapTop = Math.Max(chromeTop, foreignRect.Top);
        int overlapRight = Math.Min(chromeRight, foreignRect.Right);
        int overlapBottom = Math.Min(chromeBottom, foreignRect.Bottom);
        int overlapWidth = Math.Max(0, overlapRight - overlapLeft);
        int overlapHeight = Math.Max(0, overlapBottom - overlapTop);

        int horizontalTolerance = Math.Max(8, Scale(16, dpi));
        int verticalTolerance = Math.Max(4, Scale(6, dpi));
        return
            overlapWidth > horizontalTolerance &&
            overlapHeight > verticalTolerance;
    }

    private static bool HasForeignWindowAboveWideLeftChrome(TargetInfo leftTarget)
    {
        if (leftTarget == null || leftTarget.Handle == IntPtr.Zero || !IsWindow(leftTarget.Handle))
        {
            return true;
        }

        bool occluded = false;

        /*
         * Deliberately consider more than GetForegroundWindow(): a foreign
         * window can remain above the left pane after focus moves to a second
         * foreign window on the right pane. Looking only at the new foreground
         * would then resurrect our TOPMOST titlebar over the still-covered left
         * window. IsWindowAboveInZOrder() makes the requirement explicit instead
         * of relying on the enumeration callback order.
         */
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            if (!IsWindowAboveInZOrder(hWnd, leftTarget.Handle))
            {
                return true;
            }

            if (MeaningfullyOverlapsWideLeftChrome(hWnd, leftTarget))
            {
                occluded = true;
                return false;
            }

            return true;
        }, IntPtr.Zero);

        return occluded;
    }

    private static bool CanKeepWideLeftChromeWithForeignForeground(
        TargetInfo leftTarget
    )
    {
        if (leftTarget == null || leftTarget.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(leftTarget) || !IsHeartbeatFresh() ||
            !IsWindow(leftTarget.Handle) || !IsWindowVisible(leftTarget.Handle) ||
            IsIconic(leftTarget.Handle))
        {
            return false;
        }

        /*
         * Wide is intentionally not foreground-only: Stream Shell may remain
         * visible on one 32:9 pane while another app owns focus on the other.
         * The safety decision therefore follows actual Z-order occlusion of the
         * left titlebar band, not merely the current foreground HWND. This keeps
         * the custom chrome while the opposite pane is in use, but prevents a
         * stale TOPMOST bar from resurfacing over any foreign window that still
         * sits above Stream Shell on the left.
         */
        return !HasForeignWindowAboveWideLeftChrome(leftTarget);
    }

    private static bool IsKnownNormalOperaWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;

        lock (TaskbarNormalOperaWindows)
        {
            return TaskbarNormalOperaWindows.Contains(candidate);
        }
    }

    private static bool ShouldIgnoreYouTubeCompactOperaOccluder(
        IntPtr hWnd,
        TargetInfo target
    )
    {
        if (
            hWnd == IntPtr.Zero ||
            target == null ||
            !IsWindow(hWnd)
        )
        {
            return false;
        }

        string currentMode;
        lock (StateLock)
        {
            currentMode = leftMode;
        }

        if (!String.Equals(currentMode, "youtube", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        IntPtr root = GetAncestor(hWnd, GA_ROOT);
        IntPtr candidate = root != IntPtr.Zero ? root : hWnd;

        if (
            candidate == target.Handle ||
            IsExplicitShellSurfaceHandle(candidate) ||
            !IsOperaProcess(GetProcessName(candidate))
        )
        {
            return false;
        }

        /*
         * YouTube can leave transient Opera-owned helper/tool HWNDs above the
         * provider surface when focus moves away. They are not real browser
         * windows and must not make Compact chrome disappear. A real Opera
         * browser still counts when it is the actual foreground root or when
         * it has previously been registered as a normal Opera window.
         */
        IntPtr foreground = GetForegroundWindow();
        IntPtr foregroundRoot =
            foreground != IntPtr.Zero
                ? GetAncestor(foreground, GA_ROOT)
                : IntPtr.Zero;
        IntPtr effectiveForeground =
            foregroundRoot != IntPtr.Zero
                ? foregroundRoot
                : foreground;

        if (candidate == effectiveForeground)
        {
            return false;
        }

        if (IsKnownNormalOperaWindow(candidate))
        {
            return false;
        }

        return true;
    }


    private static bool TryGetVisibleFrameRect(IntPtr hWnd, out RECT rect)
    {
        rect = new RECT();

        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        try
        {
            int hr = DwmGetWindowAttribute(
                hWnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                out rect,
                Marshal.SizeOf(typeof(RECT))
            );

            if (
                hr == 0 &&
                rect.Right > rect.Left &&
                rect.Bottom > rect.Top
            )
            {
                return true;
            }
        }
        catch
        {
        }

        return GetWindowRect(hWnd, out rect);
    }


    private static bool MeaningfullyOverlapsCompactChrome(
        IntPtr hWnd,
        TargetInfo target
    )
    {
        if (hWnd == IntPtr.Zero || target == null || hWnd == target.Handle ||
            IsHelperChromeWindow(hWnd) || !IsWindow(hWnd) || !IsWindowVisible(hWnd) ||
            IsIconic(hWnd) || IsExplicitShellSurfaceHandle(hWnd))
        {
            return false;
        }

        RECT foreignRect;
        RECT targetRect;
        if (
            !TryGetVisibleFrameRect(hWnd, out foreignRect) ||
            !TryGetVisibleFrameRect(target.Handle, out targetRect)
        )
        {
            return false;
        }

        /*
         * Compact surfaces are maximized to one monitor. GetWindowRect() also
         * includes Chromium's invisible resize frame, which can protrude onto
         * an adjacent monitor. When a window there gains focus, two invisible
         * frames can look like a real titlebar overlap and incorrectly hide our
         * chrome. Wide panes do not hit this monitor-edge case, so keep their
         * proven path unchanged and use DWM's visible frame bounds here.
         */
        int dpi = target.Dpi;
        int chromeHeight = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int chromeLeft = targetRect.Left;
        int chromeTop = targetRect.Top;
        int chromeRight = targetRect.Right;
        int chromeBottom = Math.Min(targetRect.Bottom, chromeTop + chromeHeight);

        int overlapLeft = Math.Max(chromeLeft, foreignRect.Left);
        int overlapTop = Math.Max(chromeTop, foreignRect.Top);
        int overlapRight = Math.Min(chromeRight, foreignRect.Right);
        int overlapBottom = Math.Min(chromeBottom, foreignRect.Bottom);
        int overlapWidth = Math.Max(0, overlapRight - overlapLeft);
        int overlapHeight = Math.Max(0, overlapBottom - overlapTop);

        int horizontalTolerance = Math.Max(8, Scale(16, dpi));
        int verticalTolerance = Math.Max(4, Scale(6, dpi));
        return
            overlapWidth > horizontalTolerance &&
            overlapHeight > verticalTolerance;
    }


    private static bool HasForeignWindowAboveCompactChrome(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero || !IsWindow(target.Handle))
        {
            return true;
        }

        bool occluded = false;

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            if (!IsWindowAboveInZOrder(hWnd, target.Handle))
            {
                return true;
            }

            if (ShouldIgnoreYouTubeCompactOperaOccluder(hWnd, target))
            {
                return true;
            }

            if (MeaningfullyOverlapsCompactChrome(hWnd, target))
            {
                occluded = true;
                return false;
            }

            return true;
        }, IntPtr.Zero);

        return occluded;
    }

    private static bool CanKeepCompactChromeWithForeignForeground(
        TargetInfo target
    )
    {
        if (target == null || target.Handle == IntPtr.Zero ||
            !IsTrustedShellTarget(target) || !IsHeartbeatFresh() ||
            !IsWindow(target.Handle) || !IsWindowVisible(target.Handle) ||
            IsIconic(target.Handle))
        {
            return false;
        }

        /*
         * Compact on 16:10/16:9 should keep the custom titlebar visible when
         * Stream Shell remains visible but another application temporarily owns
         * focus elsewhere. Match Wide's behavior by following actual occlusion
         * of the top titlebar band instead of the foreground HWND alone.
         */
        return !HasForeignWindowAboveCompactChrome(target);
    }


    private static void PruneStaleSurfaceState()
    {
        List<IntPtr> staleShellHandles = new List<IntPtr>();

        lock (StateLock)
        {
            List<string> compactKeys = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in CompactSurfaceWindows)
            {
                if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value)) compactKeys.Add(pair.Key);
            }
            foreach (string key in compactKeys) CompactSurfaceWindows.Remove(key);

            List<string> wideKeys = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideSurfaceWindows)
            {
                if (pair.Value == IntPtr.Zero || !IsWindow(pair.Value)) wideKeys.Add(pair.Key);
            }
            foreach (string key in wideKeys) WideSurfaceWindows.Remove(key);
        }

        lock (TaskbarShellWindows)
        {
            foreach (IntPtr hWnd in TaskbarShellWindows)
            {
                if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) staleShellHandles.Add(hWnd);
            }
            foreach (IntPtr hWnd in staleShellHandles) TaskbarShellWindows.Remove(hWnd);
        }

        if (staleShellHandles.Count > 0)
        {
            lock (PendingTaskbarShellIdentityRetries)
            {
                foreach (IntPtr hWnd in staleShellHandles) PendingTaskbarShellIdentityRetries.Remove(hWnd);
            }
            lock (TaskbarNormalOperaWindows)
            {
                foreach (IntPtr hWnd in staleShellHandles) TaskbarNormalOperaWindows.Remove(hWnd);
            }
        }

        List<IntPtr> shellSnapshot;
        lock (TaskbarShellWindows)
        {
            shellSnapshot = new List<IntPtr>(TaskbarShellWindows);
        }

        List<IntPtr> orphans = new List<IntPtr>();
        foreach (IntPtr hWnd in shellSnapshot)
        {
            if (hWnd != IntPtr.Zero && IsWindow(hWnd) && !IsHandleReferencedBySurfaceMaps(hWnd))
            {
                orphans.Add(hWnd);
            }
        }
        foreach (IntPtr hWnd in orphans)
        {
            UnregisterShellWindowIfUnreferenced(hWnd, "reconcile-orphan");
        }
    }


    private static void SyncOverlays()
    {
        if (!initialized || shuttingDown)
        {
            HideChromeBackdrop();
            HideRightChrome();
            HideOverlay(leftOverlay, true);
            return;
        }

        PruneStaleSurfaceState();

        PaneBounds left;
        PaneBounds right;
        string currentVisibility;
        string currentRightMode;
        string currentLeftMode;
        string currentLayoutProfile;
        bool currentFullscreenActive;
        lock (StateLock)
        {
            left = new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
            right = new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height);
            currentVisibility = visibilityMode;
            currentRightMode = rightMode;
            currentLeftMode = leftMode;
            currentLayoutProfile = layoutProfile;
            currentFullscreenActive = fullscreenActive;
        }

        bool compactLayout = String.Equals(currentLayoutProfile, "compact", StringComparison.OrdinalIgnoreCase);

        if (IsHeartbeatFresh())
        {
            TryCompleteSurfaceClaims(
                left,
                right,
                currentVisibility,
                currentLeftMode,
                currentRightMode,
                currentLayoutProfile
            );
        }
        else if (HasPendingSurfaceClaim())
        {
            /* A stale extension lease may never complete a delayed HWND claim. */
            ClearPendingSurfaceClaims();
        }

        TargetInfo leftTarget = compactLayout
            ? FindCompactSurfaceTarget(left, currentLeftMode)
            : FindWideSurfaceTarget(left, "left", currentLeftMode);

        bool rightBrowserSurface =
            String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase);

        TargetInfo rightTarget = !compactLayout && rightBrowserSurface
            ? FindWideSurfaceTarget(right, "right", currentRightMode)
            : null;

        /*
         * Explorer/taskbar identity is never an HWND discovery mechanism now.
         * Only successful extension claims register shell HWNDs. This routine
         * merely repairs identities and keeps observed normal Opera separate.
         */
        SyncTaskbarIntegration(currentVisibility, compactLayout, leftTarget);

        string effectiveVisibility = ComputeNativeEffectiveVisibility(
            compactLayout,
            leftTarget,
            currentRightMode,
            right
        );
        lastEffectiveVisibility = effectiveVisibility;

        string visibilityKey =
            currentLayoutProfile + "|" +
            (currentVisibility ?? "none") + ">" + effectiveVisibility + "|" +
            (leftTarget != null ? leftTarget.Handle.ToInt64().ToString("X") : "0") + "|" +
            GetForegroundWindow().ToInt64().ToString("X");

        if (!String.Equals(nativeVisibilityDiagnosticKey, visibilityKey, StringComparison.Ordinal))
        {
            nativeVisibilityDiagnosticKey = visibilityKey;
            LogDiagnostic(
                "visibility layout=" + currentLayoutProfile +
                " browser=" + (currentVisibility ?? "none") +
                " native=" + effectiveVisibility +
                " heartbeat=" + (IsHeartbeatFresh() ? "fresh" : "stale") +
                " leftTarget=" + DescribeTarget(leftTarget) +
                " foreground=" + DescribeWindow(GetForegroundWindow())
            );
        }

        bool explicitShellFullscreen =
            currentFullscreenActive &&
            leftTarget != null &&
            IsTrustedShellTarget(leftTarget) &&
            (
                compactLayout ||
                (
                    String.Equals(effectiveVisibility, "shell", StringComparison.OrdinalIgnoreCase) &&
                    IsCompactForegroundTarget(leftTarget)
                )
            );

        bool spanningShellFullscreen =
            explicitShellFullscreen ||
            (compactLayout
                ? ShouldSuppressChromeForCompactForeground(leftTarget, left)
                : ShouldSuppressChromeForSpanningForeground(effectiveVisibility, left, right));

        if (spanningShellFullscreen)
        {
            SuspendAltTabOwnershipForSpanningFullscreen();
        }
        else
        {
            SyncAltTabIntegration(effectiveVisibility, leftTarget, rightTarget, currentRightMode, left, right);
        }

        SyncWindowChromeTheme(effectiveVisibility);

        // True fullscreen hides our own custom chrome only. Compact treats the
        // explicit provider Fullscreen API signal as authoritative even after
        // focus moves to another application. Wide keeps its established
        // foreground/geometry behavior unchanged. The provider HWND itself is
        // never resized or restyled here.
        if (spanningShellFullscreen)
        {
            HideChromeBackdrop();
            HideRightChrome();
            HideOverlay(leftOverlay, true);
            return;
        }

        if (!firstSyncLogged)
        {
            firstSyncLogged = true;
            IntPtr firstForeground = GetForegroundWindow();
            LogDiagnostic(
                "first sync: left=" + DescribeTarget(leftTarget) +
                "; right=" + DescribeTarget(rightTarget) +
                "; foreground=" + DescribeWindow(firstForeground) +
                "; browserVisibility=" + currentVisibility +
                "; nativeVisibility=" + effectiveVisibility
            );
        }

        /*
         * Compact remains strict foreground-only. Wide is split-screen by design:
         * an unrelated foreground window on the opposite pane must not expose
         * Opera's stock titlebar on the still-visible Stream Shell pane. Wide
         * therefore keeps its TOPMOST chrome only while the foreign foreground
         * does not meaningfully overlap the left titlebar band.
         */
        bool showLeftChrome = compactLayout
            ? (!String.Equals(effectiveVisibility, "none", StringComparison.OrdinalIgnoreCase) &&
               IsTrustedShellTarget(leftTarget))
            : CanKeepWideLeftChromeWithForeignForeground(leftTarget);

        if (!showLeftChrome)
        {
            HideChromeBackdrop();
            HideOverlay(leftOverlay, true);
        }
        else
        {
            PositionChromeBackdrop(leftTarget);
            PositionOverlay(leftOverlay, leftTarget, true);
        }

        /* Right Dashboard chrome is HWND-owned/non-TOPMOST and therefore keeps
         * the established side-by-side behavior while unrelated windows cover it
         * naturally through the owner z-order. */
        if (!compactLayout && ShouldShowRightChrome(rightTarget, currentRightMode))
        {
            PositionRightChrome(rightTarget);
        }
        else
        {
            HideRightChrome();
        }
    }


    private static ChromeTheme GetChromeTheme(string mode)
    {
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

    private static void LoadOperaDefaultAppIdHint()
    {
        try
        {
            string path = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "opera-appid.txt"
            );

            if (!File.Exists(path))
            {
                LogDiagnostic("opera appid hint unavailable");
                return;
            }

            string value = File.ReadAllText(path, Encoding.ASCII).Trim();
            if (String.IsNullOrWhiteSpace(value) ||
                String.Equals(value, STREAM_SHELL_APP_ID, StringComparison.Ordinal))
            {
                LogDiagnostic("opera appid hint empty/invalid");
                return;
            }

            operaDefaultAppId = value;
            LogDiagnostic("opera appid hint loaded=" + operaDefaultAppId);
        }
        catch (Exception ex)
        {
            LogDiagnostic("opera appid hint read failed: " + ex.GetType().Name + ": " + ex.Message);
        }
    }

    private static void InitializeTaskbarIntegration()
    {
        LoadOperaDefaultAppIdHint();

        try
        {
            taskbarList = (ITaskbarList3)new CTaskbarList();
            int hr = taskbarList.HrInit();
            LogDiagnostic("taskbar api init hr=0x" + hr.ToString("X8"));
        }
        catch (Exception ex)
        {
            taskbarList = null;
            LogDiagnostic("taskbar api unavailable: " + ex.GetType().Name + ": " + ex.Message);
        }

        try
        {
            string root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "taskbar-icons");
            string[] providers = new string[] { "youtube", "netflix", "prime", "disney", "crunchyroll" };
            foreach (string provider in providers)
            {
                string path = Path.Combine(root, provider + ".ico");
                if (!File.Exists(path)) continue;
                TaskbarOverlayIcons[provider] = new Icon(path, 32, 32);
                AltTabIcons[provider] = new Icon(path, 32, 32);
            }

            string shellIconPath = Path.Combine(root, "stream-shell.ico");
            if (File.Exists(shellIconPath))
            {
                AltTabIcons["landing"] = new Icon(shellIconPath, 32, 32);
                AltTabIcons["stream-shell"] = new Icon(shellIconPath, 32, 32);
            }

            LogDiagnostic(
                "taskbar overlay icons loaded=" + TaskbarOverlayIcons.Count +
                "; alt-tab icons loaded=" + AltTabIcons.Count
            );
        }
        catch (Exception ex)
        {
            LogDiagnostic("taskbar icon load failed: " + ex.GetType().Name + ": " + ex.Message);
        }
    }

    private static void SyncTaskbarIntegration(
        string currentVisibility,
        bool compactLayout,
        TargetInfo leftTarget
    )
    {
        IntPtr foreground = GetForegroundWindow();
        IntPtr root = foreground != IntPtr.Zero ? GetAncestor(foreground, GA_ROOT) : IntPtr.Zero;
        IntPtr foregroundRoot = root != IntPtr.Zero ? root : foreground;
        bool foregroundOpera =
            foregroundRoot != IntPtr.Zero &&
            IsWindow(foregroundRoot) &&
            !IsIconic(foregroundRoot) &&
            IsOperaProcess(GetProcessName(foregroundRoot));

        bool shellForeground =
            foregroundOpera &&
            IsExplicitShellSurfaceHandle(foregroundRoot);

        bool normalBrowserForeground =
            foregroundOpera &&
            !shellForeground &&
            !HasPendingSurfaceClaim();

        if (normalBrowserForeground)
        {
            RegisterNormalOperaWindow(foregroundRoot, "foreground-normal-explicit-trust");
        }

        if (shellForeground && String.Equals(taskbarLastVisibilityMode, "none", StringComparison.OrdinalIgnoreCase))
        {
            normalOperaReassertPasses = Math.Max(normalOperaReassertPasses, 3);
        }

        RetryPendingTaskbarShellIdentities();
        AuditKnownTaskbarShellIdentities();

        if (normalOperaReassertPasses > 0)
        {
            ReassertKnownNormalOperaWindows(true);
            normalOperaReassertPasses--;
        }

        string currentLeftMode;
        lock (StateLock) { currentLeftMode = leftMode; }

        if (!String.Equals(taskbarLastOverlayMode, currentLeftMode, StringComparison.OrdinalIgnoreCase))
        {
            ApplyTaskbarOverlayToKnownWindows(currentLeftMode);
            taskbarLastOverlayMode = currentLeftMode;
        }

        taskbarLastVisibilityMode = shellForeground ? "shell" : "none";
    }


    private static void AuditKnownTaskbarShellIdentities()
    {
        int now = Environment.TickCount;
        uint elapsed = unchecked((uint)(now - lastShellIdentityAuditTick));
        if (elapsed < 5000)
        {
            return;
        }
        lastShellIdentityAuditTick = now;

        List<IntPtr> windows;
        lock (TaskbarShellWindows)
        {
            windows = new List<IntPtr>(TaskbarShellWindows);
        }

        foreach (IntPtr hWnd in windows)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                continue;
            }

            if (HasStreamShellTaskbarIdentity(hWnd))
            {
                continue;
            }

            lock (WindowChromeModes)
            {
                WindowChromeModes.Remove(hWnd);
            }

            bool repaired = ApplyWindowTaskbarIdentity(hWnd);
            if (!repaired)
            {
                lock (PendingTaskbarShellIdentityRetries)
                {
                    int attempts;
                    PendingTaskbarShellIdentityRetries.TryGetValue(hWnd, out attempts);
                    if (attempts < 12)
                    {
                        PendingTaskbarShellIdentityRetries[hWnd] = attempts + 1;
                    }
                }
            }

            LogDiagnostic(
                "taskbar audit repair hwnd=0x" + hWnd.ToInt64().ToString("X") +
                " repaired=" + repaired
            );
        }
    }


    private static void RegisterTaskbarWindow(IntPtr hWnd, string side)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        lock (TaskbarNormalOperaWindows)
        {
            TaskbarNormalOperaWindows.Remove(hWnd);
        }

        bool isNew;
        lock (TaskbarShellWindows)
        {
            isNew = TaskbarShellWindows.Add(hWnd);
        }

        bool shouldApplyIdentity = isNew;
        bool pendingIdentityRetry = false;
        lock (PendingTaskbarShellIdentityRetries)
        {
            if (PendingTaskbarShellIdentityRetries.ContainsKey(hWnd))
            {
                pendingIdentityRetry = true;
                shouldApplyIdentity = true;
            }
        }

        /*
         * Chromium/Explorer may rewrite a popup's window property store after
         * navigation or fullscreen transitions. A successful first claim is
         * therefore not proof that the AppUserModelID will remain intact for the
         * lifetime of the HWND. Claim renewals are already bounded by the 1.5 s
         * extension heartbeat; use them as a cheap drift detector and repair only
         * an identity that has actually changed.
         */
        bool identityDrifted = false;
        if (!shouldApplyIdentity)
        {
            identityDrifted = !HasStreamShellTaskbarIdentity(hWnd);
            shouldApplyIdentity = identityDrifted;
        }

        if (!shouldApplyIdentity)
        {
            return;
        }

        if (identityDrifted)
        {
            lock (WindowChromeModes)
            {
                WindowChromeModes.Remove(hWnd);
            }
            LogDiagnostic(
                "taskbar identity drift hwnd=0x" + hWnd.ToInt64().ToString("X") +
                " side=" + (side ?? "unknown")
            );
        }

        bool identityApplied = ApplyWindowTaskbarIdentity(hWnd);

        lock (PendingTaskbarShellIdentityRetries)
        {
            if (identityApplied)
            {
                PendingTaskbarShellIdentityRetries.Remove(hWnd);
            }
            else
            {
                int attempts;
                PendingTaskbarShellIdentityRetries.TryGetValue(hWnd, out attempts);
                if (attempts < 12)
                {
                    PendingTaskbarShellIdentityRetries[hWnd] = attempts + 1;
                }
                else
                {
                    PendingTaskbarShellIdentityRetries.Remove(hWnd);
                }
            }
        }

        LogDiagnostic(
            "taskbar register " + side +
            " hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " identity=" + identityApplied +
            " new=" + isNew +
            " retry=" + pendingIdentityRetry +
            " drift=" + identityDrifted
        );

        normalOperaReassertPasses = Math.Max(normalOperaReassertPasses, 2);

        string mode;
        lock (StateLock) { mode = leftMode; }
        ApplyTaskbarOverlay(hWnd, mode);
    }


    private static void UnregisterShellWindowIfUnreferenced(IntPtr hWnd, string reason)
    {
        if (hWnd == IntPtr.Zero || IsHandleReferencedBySurfaceMaps(hWnd))
        {
            return;
        }

        bool removed;
        lock (TaskbarShellWindows)
        {
            removed = TaskbarShellWindows.Remove(hWnd);
        }

        lock (PendingTaskbarShellIdentityRetries)
        {
            PendingTaskbarShellIdentityRetries.Remove(hWnd);
        }

        if (!removed)
        {
            return;
        }

        ResetSingleWindowChromeTheme(hWnd);
        RestoreAltTabWindow(hWnd);

        if (IsWindow(hWnd))
        {
            try
            {
                if (taskbarList != null)
                {
                    taskbarList.SetOverlayIcon(hWnd, IntPtr.Zero, "Opera GX");
                }
            }
            catch { }

            RestoreOriginalTaskbarIdentity(hWnd);
        }

        LogDiagnostic(
            "shell unregister " + (reason ?? "unknown") +
            " hwnd=0x" + hWnd.ToInt64().ToString("X")
        );
    }


    private static void RetryPendingTaskbarShellIdentities()
    {
        List<IntPtr> pending;
        lock (PendingTaskbarShellIdentityRetries)
        {
            pending = new List<IntPtr>(PendingTaskbarShellIdentityRetries.Keys);
        }

        foreach (IntPtr hWnd in pending)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                lock (PendingTaskbarShellIdentityRetries)
                {
                    PendingTaskbarShellIdentityRetries.Remove(hWnd);
                }
                continue;
            }

            RegisterTaskbarWindow(hWnd, "identity-retry");
        }
    }


    private static void SyncAltTabIntegration(
        string currentVisibility,
        TargetInfo leftTarget,
        TargetInfo rightTarget,
        string currentRightMode,
        PaneBounds leftPaneBounds,
        PaneBounds rightPaneBounds
    )
    {
        /*
         * Both layouts share the same owner-graph machinery, but their
         * representatives differ: Wide keeps Landing stable, while Compact
         * follows the explicitly claimed current Dashboard/provider surface.
         */
        bool compactLayout =
            String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        string profileKey = compactLayout ? "compact" : "wide";
        string mode;
        lock (StateLock) { mode = leftMode; }

        if (!String.Equals(altTabLayoutProfile, profileKey, StringComparison.OrdinalIgnoreCase))
        {
            ResetAltTabOwnership();
            altTabLayoutProfile = profileKey;
        }

        /*
         * Compact follows the intended visible surface. Dashboard is only the
         * Home surface, never a permanent task-switcher anchor. Once a provider
         * has been explicitly claimed, it becomes the representative while that
         * provider is leftMode; switching Home re-roots to Dashboard.
         */
        if (compactLayout)
        {
            IntPtr desiredRepresentative = GetCompactSurfaceHandle(mode);
            if (desiredRepresentative != IntPtr.Zero &&
                IsWindow(desiredRepresentative) &&
                desiredRepresentative != altTabRepresentative)
            {
                if (altTabRepresentative != IntPtr.Zero && IsWindow(altTabRepresentative))
                {
                    RegisterAltTabManagedWindow(altTabRepresentative);
                }

                RegisterAltTabManagedWindow(desiredRepresentative);
                SetAltTabOwner(desiredRepresentative, IntPtr.Zero);
                altTabRepresentative = desiredRepresentative;
                altTabLastMode = null;

                LogDiagnostic(
                    "compact alt-tab representative mode=" + mode +
                    " hwnd=0x" + desiredRepresentative.ToInt64().ToString("X")
                );
            }
        }

        if (altTabRepresentative == IntPtr.Zero || !IsWindow(altTabRepresentative))
        {
            bool shellContext =
                String.Equals(currentVisibility, "shell", StringComparison.OrdinalIgnoreCase) ||
                (!compactLayout && String.Equals(currentVisibility, "discord", StringComparison.OrdinalIgnoreCase));

            if (!shellContext)
            {
                return;
            }

            IntPtr candidate = compactLayout
                ? GetCompactSurfaceHandle(mode)
                : GetWideSurfaceHandle("left", "landing");

            if (!compactLayout && candidate == IntPtr.Zero && leftTarget != null)
            {
                candidate = leftTarget.Handle;
            }

            if (candidate == IntPtr.Zero || !IsWindow(candidate))
            {
                return;
            }

            RegisterAltTabManagedWindow(candidate);
            SetAltTabOwner(candidate, IntPtr.Zero);
            altTabRepresentative = candidate;
            altTabLastMode = null;

            LogDiagnostic(
                (compactLayout ? "compact" : "wide") +
                " alt-tab anchor=0x" + candidate.ToInt64().ToString("X") +
                " visibility=" + (currentVisibility ?? "none")
            );
        }

        IntPtr representative = altTabRepresentative;
        if (representative == IntPtr.Zero || !IsWindow(representative))
        {
            return;
        }

        // TaskbarShellWindows contains only Opera HWNDs proven by the
        // extension/native foreground handshake to belong to Stream Shell.
        List<IntPtr> shellWindows;
        lock (TaskbarShellWindows)
        {
            shellWindows = new List<IntPtr>(TaskbarShellWindows);
        }

        foreach (IntPtr hWnd in shellWindows)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                continue;
            }
            RegisterAltTabManagedWindow(hWnd);
        }

        // Discord is a Wide-only companion surface. Compact deliberately has
        // no Discord titlebar action and therefore never adopts its HWND.
        if (!compactLayout &&
            String.Equals(currentRightMode, "discord", StringComparison.OrdinalIgnoreCase))
        {
            TargetInfo discordTarget = FindPaneTarget(rightPaneBounds, true);
            if (discordTarget != null && discordTarget.Handle != IntPtr.Zero)
            {
                RegisterAltTabManagedWindow(discordTarget.Handle);
            }
        }

        List<IntPtr> managed;
        lock (AltTabManagedWindows)
        {
            managed = new List<IntPtr>(AltTabManagedWindows);
        }

        IntPtr persistentTwitchUtility = compactLayout
            ? IntPtr.Zero
            : GetWideSurfaceHandle("right", "twitch");

        foreach (IntPtr hWnd in managed)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                lock (AltTabManagedWindows)
                {
                    AltTabManagedWindows.Remove(hWnd);
                }
                continue;
            }

            if (hWnd == representative)
            {
                SetAltTabOwner(hWnd, IntPtr.Zero);
            }
            else
            {
                SetAltTabOwner(hWnd, representative);

                /* Twitch is an auxiliary keep-alive surface. The extension
                 * owns the user setting that may explicitly minimize it; native
                 * reconciliation must never park a proven Twitch HWND merely
                 * because Dashboard/Discord is currently in front. */
                if (hWnd != persistentTwitchUtility)
                {
                    ParkMinimizedManagedOperaWindow(hWnd);
                }
            }
        }

        // Chromium can rewrite the caption/icon after navigation, but forcing
        // SetWindowText + WM_SETICON every 500 ms is needlessly expensive on
        // Compact. Reassert immediately when representative/mode changes and
        // keep a slow audit for Chromium drift afterwards.
        int presentationTick = Environment.TickCount;
        uint presentationAge = unchecked((uint)(presentationTick - altTabLastPresentationTick));
        bool presentationChanged =
            representative != altTabLastPresentationHandle ||
            !String.Equals(altTabLastMode, mode, StringComparison.OrdinalIgnoreCase);

        if (presentationChanged || presentationAge >= 5000)
        {
            ApplyAltTabPresentation(representative, mode);
            altTabLastPresentationHandle = representative;
            altTabLastPresentationTick = presentationTick;
        }
        altTabLastMode = mode;
    }


    private static void SuspendAltTabOwnershipForSpanningFullscreen()
    {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || !IsWindow(foreground))
        {
            return;
        }

        IntPtr root = GetAncestor(foreground, GA_ROOT);
        IntPtr fullscreenWindow = root != IntPtr.Zero ? root : foreground;
        if (!IsExplicitShellSurfaceHandle(fullscreenWindow))
        {
            return;
        }

        RegisterAltTabManagedWindow(fullscreenWindow);

        /*
         * Wide normally collapses all shell windows under Landing. True browser
         * fullscreen is the one state where that owner graph is counterproductive:
         * Windows may reorder sibling/owner surfaces during Chromium's fullscreen
         * style transition and place Landing/Dashboard above the video. Temporarily
         * detach only the fullscreen provider. The normal reconcile pass restores
         * its Landing owner automatically as soon as the window leaves fullscreen.
         */
        SetAltTabOwner(fullscreenWindow, IntPtr.Zero);
        SetWindowPos(
            fullscreenWindow,
            HWND_TOP,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
    }


    private static void ResetAltTabOwnership()
    {
        List<IntPtr> managed;
        lock (AltTabManagedWindows)
        {
            if (AltTabManagedWindows.Count == 0 && altTabRepresentative == IntPtr.Zero)
            {
                return;
            }
            managed = new List<IntPtr>(AltTabManagedWindows);
        }

        foreach (IntPtr hWnd in managed)
        {
            RestoreAltTabWindow(hWnd);
        }

        if (altTabRepresentative != IntPtr.Zero)
        {
            RestoreAltTabWindow(altTabRepresentative);
        }

        altTabRepresentative = IntPtr.Zero;
        altTabLastMode = null;
        altTabLastPresentationHandle = IntPtr.Zero;
    }


    private static IntPtr FindLandingAltTabAnchor(PaneBounds pane)
    {
        IntPtr found = IntPtr.Zero;

        try
        {
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
            {
                if (found != IntPtr.Zero || hWnd == IntPtr.Zero || !IsWindow(hWnd) ||
                    !IsWindowVisible(hWnd) || IsIconic(hWnd))
                {
                    return found == IntPtr.Zero;
                }

                if (!IsOperaProcess(GetProcessName(hWnd)))
                {
                    return true;
                }

                RECT rect;
                if (!GetWindowRect(hWnd, out rect))
                {
                    return true;
                }

                double geometryScore;
                if (!TryGetPaneGeometryScore(hWnd, rect, pane, out geometryScore))
                {
                    return true;
                }

                string title = GetWindowTitle(hWnd);
                if (!String.IsNullOrWhiteSpace(title) &&
                    title.StartsWith("Stream Shell", StringComparison.OrdinalIgnoreCase))
                {
                    found = hWnd;
                    return false;
                }

                return true;
            }, IntPtr.Zero);
        }
        catch { }

        return found;
    }

    private static void RegisterAltTabManagedWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        bool isNew;
        lock (AltTabManagedWindows)
        {
            isNew = AltTabManagedWindows.Add(hWnd);
        }

        if (!isNew)
        {
            return;
        }

        lock (OriginalAltTabOwners)
        {
            if (!OriginalAltTabOwners.ContainsKey(hWnd))
            {
                OriginalAltTabOwners[hWnd] = GetWindow(hWnd, GW_OWNER);
            }
        }

        RememberAltTabPresentation(hWnd);

        LogDiagnostic(
            "alt-tab managed hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " owner=0x" + GetWindow(hWnd, GW_OWNER).ToInt64().ToString("X") +
            " process=" + GetProcessName(hWnd)
        );
    }

    private static void ParkMinimizedManagedOperaWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd) || !IsIconic(hWnd))
        {
            return;
        }

        if (!IsOperaProcess(GetProcessName(hWnd)))
        {
            return;
        }

        int virtualLeft = GetSystemMetrics(SM_XVIRTUALSCREEN);
        int virtualTop = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int virtualHeight = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
        int virtualBottom = virtualTop + virtualHeight;

        RECT rect;
        if (GetWindowRect(hWnd, out rect) &&
            rect.Right < virtualLeft &&
            rect.Top > virtualBottom)
        {
            return;
        }

        // Owned minimized Chromium popups can surface as old-style grey
        // desktop icons. Keep their minimized HWNDs alive for the existing
        // provider restore flow, but park only that iconic representation
        // outside the virtual desktop. Provider restore always reapplies LEFT
        // bounds, so no provider lifecycle or Alt+Tab behaviour changes here.
        int parkedX = virtualLeft - 640;
        int parkedY = virtualBottom + 240;

        SetWindowPos(
            hWnd,
            IntPtr.Zero,
            parkedX,
            parkedY,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING
        );
    }

    private static void SetAltTabOwner(IntPtr hWnd, IntPtr owner)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd) || hWnd == owner)
        {
            return;
        }

        IntPtr current = GetWindow(hWnd, GW_OWNER);
        if (current == owner)
        {
            return;
        }

        SetOwner(hWnd, owner);
        IntPtr applied = GetWindow(hWnd, GW_OWNER);

        LogDiagnostic(
            "alt-tab owner hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " owner=0x" + applied.ToInt64().ToString("X")
        );
    }

    private static void RememberAltTabPresentation(IntPtr hWnd)
    {
        lock (OriginalAltTabPresentations)
        {
            if (OriginalAltTabPresentations.ContainsKey(hWnd))
            {
                return;
            }

            string title = GetWindowTitle(hWnd);
            IntPtr bigIcon = SendMessage(hWnd, WM_GETICON, new IntPtr(ICON_BIG), IntPtr.Zero);
            IntPtr smallIcon = SendMessage(hWnd, WM_GETICON, new IntPtr(ICON_SMALL2), IntPtr.Zero);
            if (smallIcon == IntPtr.Zero)
            {
                smallIcon = SendMessage(hWnd, WM_GETICON, new IntPtr(ICON_SMALL), IntPtr.Zero);
            }

            OriginalAltTabPresentations[hWnd] =
                new OriginalAltTabPresentation(title, bigIcon, smallIcon);
        }
    }

    private static string GetWindowTitle(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return String.Empty;
        }

        int length = Math.Max(0, GetWindowTextLength(hWnd));
        StringBuilder buffer = new StringBuilder(Math.Max(2, length + 2));
        GetWindowText(hWnd, buffer, buffer.Capacity);
        return buffer.ToString();
    }

    private static string GetAltTabTitle(string mode)
    {
        if (String.Equals(mode, "youtube", StringComparison.OrdinalIgnoreCase))
            return "Stream Shell \u2014 YouTube";
        if (String.Equals(mode, "netflix", StringComparison.OrdinalIgnoreCase))
            return "Stream Shell \u2014 Netflix";
        if (String.Equals(mode, "prime", StringComparison.OrdinalIgnoreCase))
            return "Stream Shell \u2014 Prime Video";
        if (String.Equals(mode, "disney", StringComparison.OrdinalIgnoreCase))
            return "Stream Shell \u2014 Disney+";
        if (String.Equals(mode, "crunchyroll", StringComparison.OrdinalIgnoreCase))
            return "Stream Shell \u2014 Crunchyroll";
        return "Stream Shell";
    }

    private static void ApplyAltTabPresentation(IntPtr hWnd, string mode)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        RememberAltTabPresentation(hWnd);

        string title = GetAltTabTitle(mode);
        try { SetWindowText(hWnd, title); } catch { }

        Icon icon = null;
        if (!String.IsNullOrWhiteSpace(mode))
        {
            AltTabIcons.TryGetValue(mode, out icon);
        }
        if (icon == null)
        {
            AltTabIcons.TryGetValue("stream-shell", out icon);
        }

        if (icon != null)
        {
            try
            {
                SendMessage(hWnd, WM_SETICON, new IntPtr(ICON_BIG), icon.Handle);
                SendMessage(hWnd, WM_SETICON, new IntPtr(ICON_SMALL), icon.Handle);
            }
            catch { }
        }
    }

    private static void RestoreAltTabPresentation(IntPtr hWnd)
    {
        OriginalAltTabPresentation original;
        lock (OriginalAltTabPresentations)
        {
            if (!OriginalAltTabPresentations.TryGetValue(hWnd, out original))
            {
                return;
            }
        }

        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        try { SetWindowText(hWnd, original.Title ?? String.Empty); } catch { }
        try
        {
            SendMessage(hWnd, WM_SETICON, new IntPtr(ICON_BIG), original.BigIcon);
            SendMessage(hWnd, WM_SETICON, new IntPtr(ICON_SMALL), original.SmallIcon);
        }
        catch { }
    }

    private static void RestoreAltTabWindow(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero)
        {
            return;
        }

        RestoreAltTabPresentation(hWnd);

        IntPtr originalOwner = IntPtr.Zero;
        lock (OriginalAltTabOwners)
        {
            OriginalAltTabOwners.TryGetValue(hWnd, out originalOwner);
        }

        if (IsWindow(hWnd))
        {
            SetAltTabOwner(hWnd, originalOwner);
        }

        lock (AltTabManagedWindows)
        {
            AltTabManagedWindows.Remove(hWnd);
        }

        if (altTabRepresentative == hWnd)
        {
            altTabRepresentative = IntPtr.Zero;
            altTabLastMode = null;
        }
    }

    private static void DisposeAltTabIntegration()
    {
        List<IntPtr> windows;
        lock (AltTabManagedWindows)
        {
            windows = new List<IntPtr>(AltTabManagedWindows);
        }

        // Restore members first and the representative last. This avoids
        // temporarily leaving owned windows attached to a root whose native
        // presentation has already been dismantled.
        foreach (IntPtr hWnd in windows)
        {
            if (hWnd == altTabRepresentative)
            {
                continue;
            }
            RestoreAltTabWindow(hWnd);
        }

        if (altTabRepresentative != IntPtr.Zero)
        {
            RestoreAltTabWindow(altTabRepresentative);
        }

        foreach (Icon icon in AltTabIcons.Values)
        {
            try { icon.Dispose(); } catch { }
        }
        AltTabIcons.Clear();
        altTabLayoutProfile = null;

        lock (OriginalAltTabOwners)
        {
            OriginalAltTabOwners.Clear();
        }
        lock (OriginalAltTabPresentations)
        {
            OriginalAltTabPresentations.Clear();
        }
        lock (AltTabManagedWindows)
        {
            AltTabManagedWindows.Clear();
        }

        altTabRepresentative = IntPtr.Zero;
        altTabLastMode = null;
    }

    private static void CleanupStaleStreamShellTaskbarIdentities()
    {
        int cleared = 0;

        try
        {
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
            {
                if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
                {
                    return true;
                }

                if (!IsOperaProcess(GetProcessName(hWnd)))
                {
                    return true;
                }

                if (ClearWindowTaskbarIdentityIfOwned(hWnd, true))
                {
                    cleared++;

                    try
                    {
                        if (taskbarList != null)
                        {
                            taskbarList.SetOverlayIcon(hWnd, IntPtr.Zero, "Opera GX");
                        }
                    }
                    catch { }

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
                }

                return true;
            }, IntPtr.Zero);
        }
        catch (Exception ex)
        {
            LogDiagnostic("taskbar stale cleanup exception: " + ex.GetType().Name + ": " + ex.Message);
        }

        LogDiagnostic("taskbar stale cleanup cleared=" + cleared);
    }

    private static bool ClearWindowTaskbarIdentityIfOwned(IntPtr hWnd, bool log)
    {
        IPropertyStore store = null;
        try
        {
            Guid iid = IPropertyStoreGuid;
            int hr = SHGetPropertyStoreForWindow(hWnd, ref iid, out store);
            if (hr != 0 || store == null)
            {
                return false;
            }

            string currentId = GetPropertyStoreString(store, PKEY_AppUserModel_ID);
            if (!String.Equals(currentId, STREAM_SHELL_APP_ID, StringComparison.Ordinal))
            {
                return false;
            }

            int iconHr = ClearPropertyStoreValue(store, PKEY_AppUserModel_RelaunchIconResource);
            int idHr = ClearPropertyStoreValue(store, PKEY_AppUserModel_ID);
            int commitHr = store.Commit();

            if (log)
            {
                LogDiagnostic(
                    "taskbar identity cleared hwnd=0x" + hWnd.ToInt64().ToString("X") +
                    " iconHr=0x" + iconHr.ToString("X8") +
                    " idHr=0x" + idHr.ToString("X8") +
                    " commitHr=0x" + commitHr.ToString("X8")
                );
            }

            return idHr == 0 && commitHr == 0;
        }
        catch (Exception ex)
        {
            if (log)
            {
                LogDiagnostic("taskbar identity clear exception hwnd=0x" + hWnd.ToInt64().ToString("X") + ": " + ex.GetType().Name + ": " + ex.Message);
            }
            return false;
        }
        finally
        {
            if (store != null && Marshal.IsComObject(store))
            {
                try { Marshal.FinalReleaseComObject(store); } catch { }
            }
        }
    }

    private static string GetPropertyStoreString(IPropertyStore store, PROPERTYKEY key)
    {
        PROPVARIANT pv = new PROPVARIANT();
        try
        {
            int hr = store.GetValue(ref key, out pv);
            if (hr != 0 || pv.vt != VT_LPWSTR || pv.pointerValue == IntPtr.Zero)
            {
                return null;
            }

            return Marshal.PtrToStringUni(pv.pointerValue);
        }
        finally
        {
            try { PropVariantClear(ref pv); } catch { }
        }
    }

    private static int ClearPropertyStoreValue(IPropertyStore store, PROPERTYKEY key)
    {
        PROPVARIANT pv = new PROPVARIANT();
        pv.vt = VT_EMPTY;
        pv.pointerValue = IntPtr.Zero;
        return store.SetValue(ref key, ref pv);
    }

    private static bool HasStreamShellTaskbarIdentity(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IPropertyStore store = null;
        try
        {
            Guid iid = IPropertyStoreGuid;
            int hr = SHGetPropertyStoreForWindow(hWnd, ref iid, out store);
            if (hr != 0 || store == null)
            {
                return false;
            }

            string currentId = GetPropertyStoreString(store, PKEY_AppUserModel_ID);
            return String.Equals(currentId, STREAM_SHELL_APP_ID, StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
        finally
        {
            if (store != null && Marshal.IsComObject(store))
            {
                try { Marshal.FinalReleaseComObject(store); } catch { }
            }
        }
    }


    private static bool ApplyWindowTaskbarIdentity(IntPtr hWnd)
    {
        IPropertyStore store = null;
        try
        {
            Guid iid = IPropertyStoreGuid;
            int hr = SHGetPropertyStoreForWindow(hWnd, ref iid, out store);
            if (hr != 0 || store == null)
            {
                LogDiagnostic("taskbar property store failed hwnd=0x" + hWnd.ToInt64().ToString("X") + " hr=0x" + hr.ToString("X8"));
                return false;
            }

            RememberOriginalTaskbarIdentity(hWnd, store);

            string iconPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "taskbar-icons",
                "stream-shell.ico"
            ) + ",0";

            int iconHr = SetPropertyStoreString(store, PKEY_AppUserModel_RelaunchIconResource, iconPath);
            int idHr = SetPropertyStoreString(store, PKEY_AppUserModel_ID, STREAM_SHELL_APP_ID);
            int commitHr = store.Commit();

            LogDiagnostic(
                "taskbar identity hwnd=0x" + hWnd.ToInt64().ToString("X") +
                " iconHr=0x" + iconHr.ToString("X8") +
                " idHr=0x" + idHr.ToString("X8") +
                " commitHr=0x" + commitHr.ToString("X8")
            );

            return iconHr == 0 && idHr == 0 && commitHr == 0;
        }
        catch (Exception ex)
        {
            LogDiagnostic("taskbar identity exception hwnd=0x" + hWnd.ToInt64().ToString("X") + ": " + ex.GetType().Name + ": " + ex.Message);
            return false;
        }
        finally
        {
            if (store != null && Marshal.IsComObject(store))
            {
                try { Marshal.FinalReleaseComObject(store); } catch { }
            }
        }
    }

    private static void RegisterNormalOperaWindow(IntPtr hWnd, string reason)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd) ||
            !IsOperaProcess(GetProcessName(hWnd)))
        {
            return;
        }

        bool wasShell;
        lock (TaskbarShellWindows)
        {
            wasShell = TaskbarShellWindows.Remove(hWnd);
        }

        lock (PendingTaskbarShellIdentityRetries)
        {
            PendingTaskbarShellIdentityRetries.Remove(hWnd);
        }

        if (wasShell)
        {
            ResetSingleWindowChromeTheme(hWnd);
            RestoreAltTabWindow(hWnd);
        }

        lock (TaskbarNormalOperaWindows)
        {
            TaskbarNormalOperaWindows.Add(hWnd);
        }

        bool applied = ApplyNormalOperaTaskbarIdentity(hWnd, false);
        LogDiagnostic(
            "taskbar normal " + reason +
            " hwnd=0x" + hWnd.ToInt64().ToString("X") +
            " anchored=" + applied +
            " appid=" + (operaDefaultAppId ?? "unavailable")
        );
    }

    private static bool ApplyNormalOperaTaskbarIdentity(IntPtr hWnd, bool force)
    {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IPropertyStore store = null;
        try
        {
            Guid iid = IPropertyStoreGuid;
            int hr = SHGetPropertyStoreForWindow(hWnd, ref iid, out store);
            if (hr != 0 || store == null)
            {
                return false;
            }

            string currentId = GetPropertyStoreString(store, PKEY_AppUserModel_ID);

            if (String.IsNullOrWhiteSpace(operaDefaultAppId) &&
                !String.IsNullOrWhiteSpace(currentId) &&
                !String.Equals(currentId, STREAM_SHELL_APP_ID, StringComparison.Ordinal))
            {
                operaDefaultAppId = currentId;
                LogDiagnostic("opera appid learned from normal window=" + operaDefaultAppId);
            }

            RememberOriginalTaskbarIdentity(hWnd, store);

            if (String.IsNullOrWhiteSpace(operaDefaultAppId))
            {
                if (String.Equals(currentId, STREAM_SHELL_APP_ID, StringComparison.Ordinal))
                {
                    int iconHr = RestoreOriginalProperty(
                        store,
                        PKEY_AppUserModel_RelaunchIconResource,
                        GetOriginalRelaunchIcon(hWnd)
                    );
                    int idHr = RestoreOriginalProperty(
                        store,
                        PKEY_AppUserModel_ID,
                        GetOriginalAppId(hWnd)
                    );
                    int commitHr = store.Commit();
                    return iconHr == 0 && idHr == 0 && commitHr == 0;
                }

                return false;
            }

            if (!force &&
                String.Equals(currentId, operaDefaultAppId, StringComparison.Ordinal))
            {
                return true;
            }

            int restoreIconHr = RestoreOriginalProperty(
                store,
                PKEY_AppUserModel_RelaunchIconResource,
                GetOriginalRelaunchIcon(hWnd)
            );
            int idSetHr = SetPropertyStoreString(
                store,
                PKEY_AppUserModel_ID,
                operaDefaultAppId
            );
            int commit = store.Commit();

            if (force || !String.Equals(currentId, operaDefaultAppId, StringComparison.Ordinal))
            {
                LogDiagnostic(
                    "taskbar normal identity hwnd=0x" + hWnd.ToInt64().ToString("X") +
                    " force=" + force +
                    " iconHr=0x" + restoreIconHr.ToString("X8") +
                    " idHr=0x" + idSetHr.ToString("X8") +
                    " commitHr=0x" + commit.ToString("X8")
                );
            }

            return restoreIconHr == 0 && idSetHr == 0 && commit == 0;
        }
        catch (Exception ex)
        {
            LogDiagnostic(
                "taskbar normal identity exception hwnd=0x" + hWnd.ToInt64().ToString("X") +
                ": " + ex.GetType().Name + ": " + ex.Message
            );
            return false;
        }
        finally
        {
            if (store != null && Marshal.IsComObject(store))
            {
                try { Marshal.FinalReleaseComObject(store); } catch { }
            }
        }
    }

    private static void ReassertKnownNormalOperaWindows(bool force)
    {
        if (String.IsNullOrWhiteSpace(operaDefaultAppId))
        {
            return;
        }

        List<IntPtr> windows;
        lock (TaskbarNormalOperaWindows)
        {
            windows = new List<IntPtr>(TaskbarNormalOperaWindows);
        }

        foreach (IntPtr hWnd in windows)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                lock (TaskbarNormalOperaWindows)
                {
                    TaskbarNormalOperaWindows.Remove(hWnd);
                }
                continue;
            }

            ApplyNormalOperaTaskbarIdentity(hWnd, force);
        }
    }

    private static void RememberOriginalTaskbarIdentity(IntPtr hWnd, IPropertyStore store)
    {
        lock (OriginalTaskbarIdentities)
        {
            if (OriginalTaskbarIdentities.ContainsKey(hWnd))
            {
                return;
            }

            string appId = GetPropertyStoreString(store, PKEY_AppUserModel_ID);
            string icon = GetPropertyStoreString(store, PKEY_AppUserModel_RelaunchIconResource);

            if (String.Equals(appId, STREAM_SHELL_APP_ID, StringComparison.Ordinal))
            {
                appId = null;
            }

            if (!String.IsNullOrWhiteSpace(icon) &&
                icon.IndexOf("StreamShell", StringComparison.OrdinalIgnoreCase) >= 0 &&
                icon.IndexOf("stream-shell.ico", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                icon = null;
            }

            OriginalTaskbarIdentities[hWnd] =
                new OriginalTaskbarIdentity(appId, icon);
        }
    }

    private static string GetOriginalAppId(IntPtr hWnd)
    {
        lock (OriginalTaskbarIdentities)
        {
            OriginalTaskbarIdentity value;
            return OriginalTaskbarIdentities.TryGetValue(hWnd, out value)
                ? value.AppId
                : null;
        }
    }

    private static string GetOriginalRelaunchIcon(IntPtr hWnd)
    {
        lock (OriginalTaskbarIdentities)
        {
            OriginalTaskbarIdentity value;
            return OriginalTaskbarIdentities.TryGetValue(hWnd, out value)
                ? value.RelaunchIcon
                : null;
        }
    }

    private static int RestoreOriginalProperty(IPropertyStore store, PROPERTYKEY key, string value)
    {
        if (String.IsNullOrWhiteSpace(value))
        {
            return ClearPropertyStoreValue(store, key);
        }

        return SetPropertyStoreString(store, key, value);
    }

    private static bool RestoreOriginalTaskbarIdentity(IntPtr hWnd)
    {
        OriginalTaskbarIdentity original;
        lock (OriginalTaskbarIdentities)
        {
            if (!OriginalTaskbarIdentities.TryGetValue(hWnd, out original))
            {
                return false;
            }
        }

        if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return false;
        }

        IPropertyStore store = null;
        try
        {
            Guid iid = IPropertyStoreGuid;
            int hr = SHGetPropertyStoreForWindow(hWnd, ref iid, out store);
            if (hr != 0 || store == null)
            {
                return false;
            }

            int iconHr = RestoreOriginalProperty(
                store,
                PKEY_AppUserModel_RelaunchIconResource,
                original.RelaunchIcon
            );
            int idHr = RestoreOriginalProperty(
                store,
                PKEY_AppUserModel_ID,
                original.AppId
            );
            int commitHr = store.Commit();

            return iconHr == 0 && idHr == 0 && commitHr == 0;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (store != null && Marshal.IsComObject(store))
            {
                try { Marshal.FinalReleaseComObject(store); } catch { }
            }
        }
    }

    private static int SetPropertyStoreString(IPropertyStore store, PROPERTYKEY key, string value)
    {
        PROPVARIANT pv = new PROPVARIANT();
        pv.vt = VT_LPWSTR;
        pv.pointerValue = Marshal.StringToCoTaskMemUni(value ?? String.Empty);
        try
        {
            return store.SetValue(ref key, ref pv);
        }
        finally
        {
            if (pv.pointerValue != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(pv.pointerValue);
                pv.pointerValue = IntPtr.Zero;
            }
        }
    }

    private static void ApplyTaskbarOverlayToKnownWindows(string mode)
    {
        List<IntPtr> dead = new List<IntPtr>();
        lock (TaskbarShellWindows)
        {
            foreach (IntPtr hWnd in TaskbarShellWindows)
            {
                if (!IsWindow(hWnd))
                {
                    dead.Add(hWnd);
                    continue;
                }
                ApplyTaskbarOverlay(hWnd, mode);
            }

            foreach (IntPtr hWnd in dead)
            {
                TaskbarShellWindows.Remove(hWnd);
            }
        }
    }

    private static void ApplyTaskbarOverlay(IntPtr hWnd, string mode)
    {
        if (taskbarList == null || hWnd == IntPtr.Zero || !IsWindow(hWnd))
        {
            return;
        }

        try
        {
            Icon icon = null;
            string description = "Stream Shell";
            if (!String.IsNullOrWhiteSpace(mode) && TaskbarOverlayIcons.TryGetValue(mode, out icon))
            {
                description = "Stream Shell - " + mode;
            }

            int hr = taskbarList.SetOverlayIcon(
                hWnd,
                icon != null ? icon.Handle : IntPtr.Zero,
                description
            );

            LogDiagnostic(
                "taskbar overlay hwnd=0x" + hWnd.ToInt64().ToString("X") +
                " mode=" + (mode ?? "none") +
                " hr=0x" + hr.ToString("X8")
            );
        }
        catch (Exception ex)
        {
            LogDiagnostic("taskbar overlay exception: " + ex.GetType().Name + ": " + ex.Message);
        }
    }

    private static void DisposeTaskbarIntegration()
    {
        int restored = 0;

        List<IntPtr> touched;
        lock (OriginalTaskbarIdentities)
        {
            touched = new List<IntPtr>(OriginalTaskbarIdentities.Keys);
        }

        foreach (IntPtr hWnd in touched)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
            {
                continue;
            }

            if (taskbarList != null)
            {
                try { taskbarList.SetOverlayIcon(hWnd, IntPtr.Zero, "Stream Shell"); } catch { }
            }

            if (RestoreOriginalTaskbarIdentity(hWnd))
            {
                restored++;
            }
        }

        LogDiagnostic("taskbar identity restore count=" + restored);

        foreach (Icon icon in TaskbarOverlayIcons.Values)
        {
            try { icon.Dispose(); } catch { }
        }
        TaskbarOverlayIcons.Clear();

        if (taskbarList != null && Marshal.IsComObject(taskbarList))
        {
            try { Marshal.FinalReleaseComObject(taskbarList); } catch { }
        }
        taskbarList = null;

        lock (TaskbarShellWindows)
        {
            TaskbarShellWindows.Clear();
        }

        lock (PendingTaskbarShellIdentityRetries)
        {
            PendingTaskbarShellIdentityRetries.Clear();
        }

        lock (TaskbarNormalOperaWindows)
        {
            TaskbarNormalOperaWindows.Clear();
        }

        lock (OriginalTaskbarIdentities)
        {
            OriginalTaskbarIdentities.Clear();
        }
    }

    private static byte ShortcutKeyCode(string token)
    {
        if (String.IsNullOrWhiteSpace(token))
        {
            return 0;
        }

        string value = token.Trim().ToUpperInvariant();
        if (value.Length == 1)
        {
            char c = value[0];
            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))
            {
                return (byte)c;
            }
        }

        switch (value)
        {
            case "SPACE": return 0x20;
            case "HOME": return 0x24;
            case "END": return 0x23;
            case "PAGEUP": return 0x21;
            case "PAGEDOWN": return 0x22;
            case "INSERT": return 0x2D;
            case "DELETE": return 0x2E;
            case "UP": return 0x26;
            case "DOWN": return 0x28;
            case "LEFT": return 0x25;
            case "RIGHT": return 0x27;
            case "COMMA": return 0xBC;
            case "PERIOD": return 0xBE;
        }

        return 0;
    }


    private static bool DispatchShortcut(string shortcut)
    {
        if (String.IsNullOrWhiteSpace(shortcut))
        {
            return false;
        }

        bool ctrl = false;
        bool shift = false;
        bool alt = false;
        byte key = 0;

        string[] parts = shortcut.Split('+');
        foreach (string part in parts)
        {
            string token = part.Trim();
            if (token.Equals("Ctrl", StringComparison.OrdinalIgnoreCase))
            {
                ctrl = true;
                continue;
            }
            if (token.Equals("Shift", StringComparison.OrdinalIgnoreCase))
            {
                shift = true;
                continue;
            }
            if (token.Equals("Alt", StringComparison.OrdinalIgnoreCase))
            {
                alt = true;
                continue;
            }

            key = ShortcutKeyCode(token);
        }

        if (key == 0 || (!ctrl && !alt))
        {
            return false;
        }

        if (ctrl) keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        if (alt) keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        if (shift) keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);

        keybd_event(key, 0, 0, UIntPtr.Zero);
        keybd_event(key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (shift) keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        if (alt) keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        if (ctrl) keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        return true;
    }


    private static void TriggerVolumeShortcut()
    {
        string mode;
        string shortcut;
        IntPtr target;

        lock (StateLock)
        {
            mode = leftMode;
            shortcut = volumeShortcut;
            target = leftOwner;
        }

        bool providerMode =
            mode == "youtube" ||
            mode == "netflix" ||
            mode == "prime" ||
            mode == "disney" ||
            mode == "crunchyroll";

        if (!providerMode)
        {
            LogDiagnostic("volume shortcut ignored outside provider mode");
            return;
        }

        if (String.IsNullOrWhiteSpace(shortcut))
        {
            LogDiagnostic("volume shortcut unavailable: extension command is unassigned");
            return;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            PaneBounds pane;
            lock (StateLock)
            {
                pane = new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
            }

            string profile;
            lock (StateLock) { profile = layoutProfile; }
            TargetInfo found = String.Equals(profile, "compact", StringComparison.OrdinalIgnoreCase)
                ? FindCompactSurfaceTarget(pane, mode)
                : FindWideSurfaceTarget(pane, "left", mode);
            target = found != null ? found.Handle : IntPtr.Zero;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            LogDiagnostic("volume shortcut failed: no provider target");
            return;
        }

        ShowWindow(target, SW_RESTORE);
        SetForegroundWindow(target);

        // Chromium grants activeTab/tabCapture only for explicit extension
        // invocations. The titlebar itself is native UI, so bridge its real
        // click through the extension command registered in the manifest.
        Thread.Sleep(55);
        bool dispatched = DispatchShortcut(shortcut);

        LogDiagnostic(
            "volume shortcut " + (dispatched ? "dispatched" : "invalid") +
            " for " + mode + " shortcut=" + shortcut
        );
    }


    private static void TriggerTwitchVolumeShortcut()
    {
        string mode;
        string shortcut;
        IntPtr target;

        lock (StateLock)
        {
            mode = rightMode;
            shortcut = volumeShortcut;
            target = rightOwner;
        }

        if (!String.Equals(mode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            LogDiagnostic("right volume shortcut ignored outside Twitch mode");
            return;
        }

        if (String.IsNullOrWhiteSpace(shortcut))
        {
            LogDiagnostic("right volume shortcut unavailable: extension command is unassigned");
            return;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            PaneBounds pane;
            lock (StateLock)
            {
                pane = new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height);
            }

            TargetInfo found = FindWideSurfaceTarget(pane, "right", "twitch");
            target = found != null ? found.Handle : IntPtr.Zero;
        }

        if (target == IntPtr.Zero || !IsWindow(target))
        {
            LogDiagnostic("right volume shortcut failed: no Twitch target");
            return;
        }

        ShowWindow(target, SW_RESTORE);
        SetForegroundWindow(target);
        Thread.Sleep(55);
        bool dispatched = DispatchShortcut(shortcut);

        LogDiagnostic(
            "right volume shortcut " + (dispatched ? "dispatched" : "invalid") +
            " for twitch shortcut=" + shortcut
        );
    }


    private static void FocusRequestedPane()
    {
        string side;
        PaneBounds pane;

        lock (StateLock)
        {
            side = pendingFocusSide;
            pendingFocusSide = String.Empty;
            pane = String.Equals(side, "right", StringComparison.OrdinalIgnoreCase)
                ? new PaneBounds(rightPane.Left, rightPane.Top, rightPane.Width, rightPane.Height)
                : new PaneBounds(leftPane.Left, leftPane.Top, leftPane.Width, leftPane.Height);
        }

        if (!String.Equals(side, "left", StringComparison.OrdinalIgnoreCase) &&
            !String.Equals(side, "right", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        /*
         * A titlebar overlay uses WS_EX_NOACTIVATE. The browser extension can
         * restore a window after the click, but Windows may reject its focus
         * request because the browser process did not receive the user's
         * input. The native toolbar did receive that click, so perform the
         * final foreground hand-off here after the extension restored the pane.
         */
        string profile;
        string currentLeftMode;
        string currentRightMode;
        lock (StateLock)
        {
            profile = layoutProfile;
            currentLeftMode = leftMode;
            currentRightMode = rightMode;
        }

        bool compact = String.Equals(profile, "compact", StringComparison.OrdinalIgnoreCase);
        TargetInfo target;
        if (compact)
        {
            target = FindCompactSurfaceTarget(pane, currentLeftMode);
        }
        else if (String.Equals(side, "right", StringComparison.OrdinalIgnoreCase))
        {
            target = String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase)
                ? FindWideSurfaceTarget(pane, "right", "dashboard")
                : null;
        }
        else
        {
            target = FindWideSurfaceTarget(pane, "left", currentLeftMode);
        }

        if (target == null || target.Handle == IntPtr.Zero)
        {
            LogDiagnostic("focus " + side + ": no Opera target");
            return;
        }

        ShowWindow(target.Handle, SW_RESTORE);
        bool focused = SetForegroundWindow(target.Handle);
        LogDiagnostic("focus " + side + ": hwnd=0x" + target.Handle.ToInt64().ToString("X") + " ok=" + focused);
        PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
    }

    private static PaneBounds GetShellPaneLayoutBounds()
    {
        lock (StateLock)
        {
            int left = Math.Min(leftPane.Left, rightPane.Left);
            int top = Math.Min(leftPane.Top, rightPane.Top);
            int right = Math.Max(leftPane.Left + leftPane.Width, rightPane.Left + rightPane.Width);
            int bottom = Math.Max(leftPane.Top + leftPane.Height, rightPane.Top + rightPane.Height);

            return new PaneBounds(
                left,
                top,
                Math.Max(1, right - left),
                Math.Max(1, bottom - top)
            );
        }
    }

    private static double RectAspect(RECT rect)
    {
        int width = Math.Max(1, rect.Right - rect.Left);
        int height = Math.Max(1, rect.Bottom - rect.Top);
        return width / (double)height;
    }

    private static bool TryGetMonitorReferenceRect(IntPtr hWnd, PaneBounds shell, out RECT reference)
    {
        reference = new RECT();

        IntPtr monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
        {
            return false;
        }

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info))
        {
            return false;
        }

        double shellAspect = Math.Max(1, shell.Width) / (double)Math.Max(1, shell.Height);
        double monitorDistance = Math.Abs(RectAspect(info.rcMonitor) - shellAspect);
        double workDistance = Math.Abs(RectAspect(info.rcWork) - shellAspect);

        // Wide uses the complete display bounds while Compact staging uses the
        // work area. Pick whichever native monitor rectangle has the same
        // shape as the logical shell layout Chromium supplied.
        reference = workDistance + 0.01 < monitorDistance
            ? info.rcWork
            : info.rcMonitor;

        return
            reference.Right > reference.Left &&
            reference.Bottom > reference.Top;
    }

    private static bool TryGetPaneGeometryScore(IntPtr hWnd, RECT rect, PaneBounds pane, out double score)
    {
        score = Double.MaxValue;
        PaneBounds shell = GetShellPaneLayoutBounds();

        RECT monitorRect;
        if (TryGetMonitorReferenceRect(hWnd, shell, out monitorRect))
        {
            double shellAspect = Math.Max(1, shell.Width) / (double)Math.Max(1, shell.Height);
            double monitorAspect = RectAspect(monitorRect);
            double aspectDelta = Math.Abs(monitorAspect - shellAspect) / Math.Max(0.01, shellAspect);

            // A pane can only belong to the display represented by the logical
            // shell layout. This rejects Opera windows on the other monitor in
            // mixed-DPI laptop+dock setups before position scoring.
            if (aspectDelta > 0.18)
            {
                return false;
            }

            double shellWidth = Math.Max(1, shell.Width);
            double shellHeight = Math.Max(1, shell.Height);
            double monitorWidth = Math.Max(1, monitorRect.Right - monitorRect.Left);
            double monitorHeight = Math.Max(1, monitorRect.Bottom - monitorRect.Top);

            double expectedLeft = (pane.Left - shell.Left) / shellWidth;
            double expectedTop = (pane.Top - shell.Top) / shellHeight;
            double expectedWidth = pane.Width / shellWidth;
            double expectedHeight = pane.Height / shellHeight;

            double actualLeft = (rect.Left - monitorRect.Left) / monitorWidth;
            double actualTop = (rect.Top - monitorRect.Top) / monitorHeight;
            double actualWidth = Math.Max(0, rect.Right - rect.Left) / monitorWidth;
            double actualHeight = Math.Max(0, rect.Bottom - rect.Top) / monitorHeight;

            double leftDelta = Math.Abs(actualLeft - expectedLeft);
            double topDelta = Math.Abs(actualTop - expectedTop);
            double widthDelta = Math.Abs(actualWidth - expectedWidth);
            double heightDelta = Math.Abs(actualHeight - expectedHeight);

            if (
                leftDelta > 0.14 ||
                topDelta > 0.12 ||
                widthDelta > 0.18 ||
                heightDelta > 0.18
            )
            {
                return false;
            }

            score =
                (leftDelta * 4.0) +
                (topDelta * 3.0) +
                (widthDelta * 2.0) +
                (heightDelta * 2.0) +
                aspectDelta;

            return true;
        }

        // Defensive fallback for old Windows/API failure: retain the original
        // same-coordinate-space heuristic rather than disabling the helper.
        int width = Math.Max(0, rect.Right - rect.Left);
        int height = Math.Max(0, rect.Bottom - rect.Top);
        if (width < pane.Width * 0.65 || height < pane.Height * 0.60)
        {
            return false;
        }

        int xTolerance = Math.Max(260, pane.Width / 5);
        int yTolerance = 180;
        int xDelta = Math.Abs(rect.Left - pane.Left);
        int yDelta = Math.Abs(rect.Top - pane.Top);
        if (xDelta > xTolerance || yDelta > yTolerance)
        {
            return false;
        }

        score =
            xDelta / (double)Math.Max(1, xTolerance) +
            yDelta / (double)Math.Max(1, yTolerance);
        return true;
    }

    private static TargetInfo TryBuildTrustedOperaTarget(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero || hWnd == leftOverlay || hWnd == rightOverlay ||
            hWnd == leftChromeOverlay || hWnd == rightChromeOverlay || hWnd == rightCaptionBlockerOverlay ||
            hWnd == controllerWindow || !IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsIconic(hWnd))
        {
            return null;
        }

        string processName = GetProcessName(hWnd);
        if (!IsOperaProcess(processName))
        {
            return null;
        }

        RECT rect;
        if (!GetWindowRect(hWnd, out rect))
        {
            return null;
        }

        int dpi = GetTargetDpi(hWnd);
        int titlebarHeight;
        int captionLeft;
        if (!TryGetTitlebarMetrics(hWnd, rect, processName, dpi, out titlebarHeight, out captionLeft))
        {
            return null;
        }

        TargetInfo target = new TargetInfo();
        target.Handle = hWnd;
        target.ProcessName = processName;
        target.Rect = rect;
        target.Dpi = dpi;
        target.TitlebarHeight = titlebarHeight;
        target.CaptionLeft = captionLeft;
        return target;
    }


    private static TargetInfo TryBuildPaneTarget(IntPtr hWnd, PaneBounds pane, bool wantDiscord)
    {
        if (hWnd == IntPtr.Zero || hWnd == leftOverlay || hWnd == rightOverlay ||
            hWnd == leftChromeOverlay || hWnd == rightChromeOverlay || hWnd == rightCaptionBlockerOverlay ||
            hWnd == controllerWindow || !IsWindowVisible(hWnd) || IsIconic(hWnd))
        {
            return null;
        }

        RECT rect;
        if (!GetWindowRect(hWnd, out rect))
        {
            return null;
        }

        double geometryScore;
        if (!TryGetPaneGeometryScore(hWnd, rect, pane, out geometryScore))
        {
            return null;
        }

        string processName = GetProcessName(hWnd);
        bool opera = IsOperaProcess(processName);
        bool discord = String.Equals(processName, "Discord", StringComparison.OrdinalIgnoreCase);
        if (wantDiscord ? !discord : !opera)
        {
            return null;
        }

        int titlebarHeight;
        int captionLeft;
        int dpi = GetTargetDpi(hWnd);
        if (!TryGetTitlebarMetrics(hWnd, rect, processName, dpi, out titlebarHeight, out captionLeft))
        {
            return null;
        }

        TargetInfo candidate = new TargetInfo();
        candidate.Handle = hWnd;
        candidate.ProcessName = processName;
        candidate.Rect = rect;
        candidate.Dpi = dpi;
        candidate.TitlebarHeight = titlebarHeight;
        candidate.CaptionLeft = captionLeft;
        return candidate;
    }


    private static TargetInfo FindPaneTarget(PaneBounds pane, bool wantDiscord)
    {
        /*
         * Compact deliberately keeps Dashboard alive underneath its provider
         * as a stable owner/grouping anchor. Both can therefore share exactly
         * the same bounds. Prefer the foreground HWND first so discovery is
         * deterministic and O(1) in the normal shell path; only fall back to
         * the proven cheap-first EnumWindows scan when foreground is not the
         * requested pane.
         */
        TargetInfo foregroundTarget =
            TryBuildPaneTarget(GetForegroundWindow(), pane, wantDiscord);
        if (foregroundTarget != null)
        {
            return foregroundTarget;
        }

        TargetInfo found = null;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            TargetInfo candidate = TryBuildPaneTarget(hWnd, pane, wantDiscord);
            if (candidate == null)
            {
                return true;
            }

            found = candidate;
            return false;
        }, IntPtr.Zero);

        return found;
    }


    private static bool TryGetTitlebarMetrics(IntPtr hWnd, RECT windowRect, string processName, int dpi, out int titlebarHeight, out int captionLeft)
    {
        titlebarHeight = 0;
        captionLeft = 0;

        RECT client;
        POINT clientOrigin = new POINT(0, 0);
        if (GetClientRect(hWnd, out client) && ClientToScreen(hWnd, ref clientOrigin))
        {
            titlebarHeight = clientOrigin.Y - windowRect.Top;
        }

        int style = GetWindowLong(hWnd, GWL_STYLE);
        bool hasCaption = (((uint)style & WS_CAPTION) == WS_CAPTION);
        bool isDiscord = String.Equals(processName, "Discord", StringComparison.OrdinalIgnoreCase);
        bool isOpera = IsOperaProcess(processName);

        bool normalizeCompactYouTubeTitlebar = false;
        lock (StateLock)
        {
            normalizeCompactYouTubeTitlebar =
                isOpera &&
                String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase) &&
                String.Equals(leftMode, "youtube", StringComparison.OrdinalIgnoreCase);
        }

        /*
         * YouTube/Opera occasionally reports a smaller client-to-window offset
         * than the other managed providers. The custom bar must not inherit
         * that provider-specific collapse or its geometry and hit targets drift.
         */
        if (
            normalizeCompactYouTubeTitlebar &&
            titlebarHeight < Scale(34, dpi)
        )
        {
            titlebarHeight = Scale(34, dpi);
        }

        if (titlebarHeight < Scale(8, dpi))
        {
            /*
             * Chromium/Opera can draw the visible browser chrome inside the
             * client area. In that case ClientToScreen reports effectively
             * zero non-client height even though the user can plainly see the
             * ~34 px Opera title strip. 0.9.18 treated this as fullscreen and
             * therefore hid every overlay. Opera is already constrained by
             * FindPaneTarget to a large Stream Shell pane, so use the visible
             * chrome height as a fallback here.
             */
            if (isDiscord || hasCaption || isOpera)
            {
                titlebarHeight = Scale(34, dpi);
            }
            else
            {
                return false;
            }
        }

        if (titlebarHeight > Scale(90, dpi))
        {
            return false;
        }

        RECT captionBounds;
        bool haveCaptionBounds = false;
        try
        {
            int hr = DwmGetWindowAttribute(
                hWnd,
                DWMWA_CAPTION_BUTTON_BOUNDS,
                out captionBounds,
                Marshal.SizeOf(typeof(RECT))
            );

            int windowWidth = Math.Max(0, windowRect.Right - windowRect.Left);
            if (hr == 0 && captionBounds.Right > captionBounds.Left && captionBounds.Left > windowWidth / 2 && captionBounds.Left < windowWidth)
            {
                captionLeft = windowRect.Left + captionBounds.Left;
                haveCaptionBounds = true;
            }
        }
        catch
        {
        }

        if (!haveCaptionBounds)
        {
            captionLeft = windowRect.Right - Scale(144, dpi);
        }

        return true;
    }

    private static bool IsTrustedShellTarget(TargetInfo target)
    {
        if (target == null || target.Handle == IntPtr.Zero)
        {
            return false;
        }

        lock (TaskbarShellWindows)
        {
            return TaskbarShellWindows.Contains(target.Handle);
        }
    }

    private static RECT GetVisibleChromePlacementRect(TargetInfo target, bool compactLayout)
    {
        RECT rect = target != null ? target.Rect : new RECT();
        if (!compactLayout || target == null || target.Handle == IntPtr.Zero)
        {
            return rect;
        }

        IntPtr monitor = MonitorFromWindow(target.Handle, MONITOR_DEFAULTTONEAREST);
        if (monitor == IntPtr.Zero)
        {
            return rect;
        }

        MONITORINFO info = new MONITORINFO();
        info.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(monitor, ref info))
        {
            return rect;
        }

        /*
         * Maximized Chromium windows can report the invisible resize frame a
         * few pixels beyond the monitor work area. Using that raw rect for our
         * TOPMOST chrome shifts STREAM SHELL and the far-right button partly
         * off-screen. Compact never needs that invisible frame: fullscreen is
         * suppressed before chrome placement, so clamp normal chrome to rcWork.
         */
        rect.Left = Math.Max(rect.Left, info.rcWork.Left);
        rect.Top = Math.Max(rect.Top, info.rcWork.Top);
        rect.Right = Math.Min(rect.Right, info.rcWork.Right);
        rect.Bottom = Math.Min(rect.Bottom, info.rcWork.Bottom);

        if (rect.Right <= rect.Left || rect.Bottom <= rect.Top)
        {
            return target.Rect;
        }

        return rect;
    }

    private static void PositionChromeBackdrop(TargetInfo target)
    {
        if (leftChromeOverlay == IntPtr.Zero || target == null)
        {
            HideChromeBackdrop();
            return;
        }

        int dpi = target.Dpi;
        bool compactLayout;
        lock (StateLock)
        {
            compactLayout = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        }

        RECT placementRect = GetVisibleChromePlacementRect(target, compactLayout);
        int width = Math.Max(1, placementRect.Right - placementRect.Left);
        int height = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int x = placementRect.Left;
        int y = placementRect.Top;

        // Compact now uses the same TOPMOST placement strategy as Wide while
        // it is allowed to exist. The important difference is lifecycle, not
        // z-band: Compact eligibility is decided from the real Win32 foreground
        // target in SyncOverlays(), so an unrelated application causes this
        // window to be hidden/demoted instead of leaving a TOPMOST helper over
        // the desktop. This avoids the normal-z dead state seen in 0.14.8-.11.
        bool ownershipChanged = false;

        bool visible = IsWindowVisible(leftChromeOverlay);
        bool placementChanged =
            chromeLastX != x || chromeLastY != y ||
            chromeLastWidth != width || chromeLastHeight != height ||
            chromeLastTarget != target.Handle;
        bool compactZOrderRepair =
            compactLayout &&
            NeedsCompactZOrderRepair(leftChromeOverlay, target, IntPtr.Zero);

        if (!visible || placementChanged || ownershipChanged || compactZOrderRepair)
        {
            bool positioned = SetWindowPos(
                leftChromeOverlay,
                HWND_TOPMOST,
                x,
                y,
                width,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();

            ShowWindow(leftChromeOverlay, SW_SHOWNOACTIVATE);

            chromeLastX = x;
            chromeLastY = y;
            chromeLastWidth = width;
            chromeLastHeight = height;
            chromeLastTarget = target.Handle;

            if (!chromePositionLogged)
            {
                chromePositionLogged = true;
                LogDiagnostic(
                    "provider chrome show: ok=" + positioned +
                    " err=" + positionError +
                    " rect=" + x + "," + y + " " + width + "x" + height +
                    " target=0x" + target.Handle.ToInt64().ToString("X")
                );
            }
        }

        if (placementChanged)
        {
            InvalidateRect(leftChromeOverlay, IntPtr.Zero, false);
        }
    }

    private static void HideChromeBackdrop()
    {
        if (leftChromeOverlay == IntPtr.Zero)
        {
            return;
        }

        if (IsWindowVisible(leftChromeOverlay))
        {
            ShowWindow(leftChromeOverlay, SW_HIDE);
            SetWindowPos(
                leftChromeOverlay,
                HWND_NOTOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
            );
        }

        chromeLastTarget = IntPtr.Zero;
    }


    private static bool ShouldShowRightChrome(TargetInfo target, string currentRightMode)
    {
        bool browserSurface =
            String.Equals(currentRightMode, "dashboard", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase);

        return
            target != null &&
            target.Handle != IntPtr.Zero &&
            browserSurface &&
            IsTrustedShellTarget(target);
    }

    /*
     * The right chrome belongs to Dashboard, not to the desktop. Making these
     * helper windows owned by the proven Dashboard HWND lets Windows keep them
     * above Dashboard while naturally allowing unrelated windows to cover the
     * whole Dashboard + chrome pair. No foreground or geometry occlusion guess
     * is needed, and the provider colour still comes from leftMode.
     */

    private static void PositionRightChrome(TargetInfo target)
    {
        if (rightChromeOverlay == IntPtr.Zero || rightCaptionBlockerOverlay == IntPtr.Zero || target == null)
        {
            HideRightChrome();
            return;
        }

        bool ownerChanged = rightChromeLastTarget != target.Handle;
        if (ownerChanged)
        {
            SetOwner(rightChromeOverlay, target.Handle);
            SetOwner(rightCaptionBlockerOverlay, target.Handle);
        }

        int dpi = target.Dpi;
        int width = Math.Max(1, target.Rect.Right - target.Rect.Left);
        int height = Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi));
        int x = target.Rect.Left;
        int y = target.Rect.Top;

        bool chromeVisible = IsWindowVisible(rightChromeOverlay);
        bool chromeChanged =
            rightChromeLastX != x || rightChromeLastY != y ||
            rightChromeLastWidth != width || rightChromeLastHeight != height ||
            rightChromeLastTarget != target.Handle;

        if (!chromeVisible || chromeChanged)
        {
            bool positioned = SetWindowPos(
                rightChromeOverlay,
                IntPtr.Zero,
                x,
                y,
                width,
                height,
                SWP_NOZORDER | SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();
            ShowWindow(rightChromeOverlay, SW_SHOWNOACTIVATE);

            rightChromeLastX = x;
            rightChromeLastY = y;
            rightChromeLastWidth = width;
            rightChromeLastHeight = height;
            rightChromeLastTarget = target.Handle;

            if (!rightChromePositionLogged)
            {
                rightChromePositionLogged = true;
                LogDiagnostic(
                    "right provider chrome show: ok=" + positioned +
                    " err=" + positionError +
                    " rect=" + x + "," + y + " " + width + "x" + height +
                    " target=0x" + target.Handle.ToInt64().ToString("X")
                );
            }
        }

        int blockerX = target.CaptionLeft;
        int blockerWidth = Math.Max(Scale(96, dpi), target.Rect.Right - target.CaptionLeft);
        bool blockerVisible = IsWindowVisible(rightCaptionBlockerOverlay);
        bool blockerChanged =
            rightBlockerLastX != blockerX || rightBlockerLastY != y ||
            rightBlockerLastWidth != blockerWidth || rightBlockerLastHeight != height ||
            rightBlockerLastTarget != target.Handle;

        if (!blockerVisible || blockerChanged)
        {
            SetWindowPos(
                rightCaptionBlockerOverlay,
                IntPtr.Zero,
                blockerX,
                y,
                blockerWidth,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            ShowWindow(rightCaptionBlockerOverlay, SW_SHOWNOACTIVATE);

            rightBlockerLastX = blockerX;
            rightBlockerLastY = y;
            rightBlockerLastWidth = blockerWidth;
            rightBlockerLastHeight = height;
            rightBlockerLastTarget = target.Handle;
        }

        if (chromeChanged)
        {
            InvalidateRect(rightChromeOverlay, IntPtr.Zero, false);
        }
        if (blockerChanged)
        {
            InvalidateRect(rightCaptionBlockerOverlay, IntPtr.Zero, false);
        }
    }

    private static void HideRightChrome()
    {
        IntPtr[] windows = new IntPtr[] { rightChromeOverlay, rightCaptionBlockerOverlay };
        for (int i = 0; i < windows.Length; i++)
        {
            IntPtr hWnd = windows[i];
            if (hWnd == IntPtr.Zero) continue;
            if (IsWindowVisible(hWnd))
            {
                ShowWindow(hWnd, SW_HIDE);
                SetWindowPos(
                    hWnd,
                    HWND_NOTOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
                );
            }
        }

        rightChromeLastTarget = IntPtr.Zero;
        rightBlockerLastTarget = IntPtr.Zero;
    }

    private static void PositionOverlay(IntPtr overlay, TargetInfo target, bool isLeft)
    {
        if (overlay == IntPtr.Zero || target == null)
        {
            HideOverlay(overlay, isLeft);
            if (isLeft) leftOwner = IntPtr.Zero; else rightOwner = IntPtr.Zero;
            return;
        }

        int dpi = target.Dpi;
        bool compactLayout;
        lock (StateLock)
        {
            compactLayout = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
        }
        RECT placementRect = GetVisibleChromePlacementRect(target, compactLayout);

        int gap = Scale(8, dpi);
        bool compactDiscord = false;
        if (!isLeft)
        {
            lock (StateLock)
            {
                compactDiscord = String.Equals(rightMode, "discord", StringComparison.OrdinalIgnoreCase);
            }
        }
        int navWidth = isLeft ? GetLeftOverlayWidth(dpi) : 0;
        int width = isLeft ? navWidth : Scale(compactDiscord ? 44 : 92, dpi);
        int height = isLeft
            ? Math.Max(Scale(28, dpi), target.TitlebarHeight + Scale(8, dpi))
            : Math.Min(Scale(24, dpi), Math.Max(Scale(20, dpi), target.TitlebarHeight - Scale(8, dpi)));
        // The Stream Shell nav now owns the far-right edge of the left caption.
        // This intentionally sits over Opera's native caption buttons so they
        // are visually and interactively replaced by Stream Shell navigation.
        int x = isLeft ? placementRect.Right - navWidth : target.CaptionLeft - gap - width;
        int y = isLeft
            ? placementRect.Top
            : placementRect.Top + Math.Max(Scale(2, dpi), (target.TitlebarHeight - height) / 2) + Scale(4, dpi);

        if (x < placementRect.Left + Scale(160, dpi))
        {
            HideOverlay(overlay, isLeft);
            return;
        }

        if (isLeft) leftOwner = target.Handle; else rightOwner = target.Handle;

        bool ownershipChanged = false;

        bool visible = IsWindowVisible(overlay);
        bool placementChanged;
        if (isLeft)
        {
            placementChanged =
                leftLastX != x || leftLastY != y ||
                leftLastWidth != width || leftLastHeight != height ||
                leftLastTarget != target.Handle;
        }
        else
        {
            placementChanged =
                rightLastX != x || rightLastY != y ||
                rightLastWidth != width || rightLastHeight != height ||
                rightLastTarget != target.Handle;
        }

        /*
         * Wide and Compact use the same TOPMOST placement while visible.
         * Compact's protection against leaking over unrelated applications is
         * handled by its Win32-foreground lifecycle gate in SyncOverlays(), not
         * by trying to balance the toolbar inside the normal z-order band.
         */
        bool compactZOrderRepair =
            compactLayout &&
            NeedsCompactZOrderRepair(
                overlay,
                target,
                isLeft ? leftChromeOverlay : IntPtr.Zero
            );

        if (!visible || placementChanged || ownershipChanged || compactZOrderRepair)
        {
            IntPtr insertAfter = HWND_TOPMOST;

            bool positioned = SetWindowPos(
                overlay,
                insertAfter,
                x,
                y,
                width,
                height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW
            );
            int positionError = positioned ? 0 : Marshal.GetLastWin32Error();

            ShowWindow(overlay, SW_SHOWNOACTIVATE);

            if (isLeft)
            {
                leftLastX = x; leftLastY = y; leftLastWidth = width; leftLastHeight = height; leftLastTarget = target.Handle;
            }
            else
            {
                rightLastX = x; rightLastY = y; rightLastWidth = width; rightLastHeight = height; rightLastTarget = target.Handle;
            }

            bool shouldLog = isLeft ? !leftPositionLogged : !rightPositionLogged;
            if (shouldLog)
            {
                if (isLeft) leftPositionLogged = true; else rightPositionLogged = true;

                RECT overlayRect;
                string rectText = GetWindowRect(overlay, out overlayRect)
                    ? overlayRect.Left + "," + overlayRect.Top + " " +
                      Math.Max(0, overlayRect.Right - overlayRect.Left) + "x" +
                      Math.Max(0, overlayRect.Bottom - overlayRect.Top)
                    : "unavailable";

                LogDiagnostic(
                    (isLeft ? "left" : "right") +
                    " overlay show: ok=" + positioned +
                    " err=" + positionError +
                    " visible=" + IsWindowVisible(overlay) +
                    " rect=" + rectText
                );
            }
        }

        if (placementChanged)
        {
            InvalidateRect(overlay, IntPtr.Zero, false);
        }
    }

    private static void HideOverlay(IntPtr overlay, bool isLeft)
    {
        if (overlay == IntPtr.Zero)
        {
            return;
        }

        if (IsWindowVisible(overlay))
        {
            ShowWindow(overlay, SW_HIDE);
            SetWindowPos(
                overlay,
                HWND_NOTOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
            );
        }

        if (isLeft)
        {
            leftLastX = Int32.MinValue;
            leftLastY = Int32.MinValue;
            leftLastWidth = Int32.MinValue;
            leftLastHeight = Int32.MinValue;
            leftLastTarget = IntPtr.Zero;
        }
        else
        {
            rightLastX = Int32.MinValue;
            rightLastY = Int32.MinValue;
            rightLastWidth = Int32.MinValue;
            rightLastHeight = Int32.MinValue;
            rightLastTarget = IntPtr.Zero;
        }
    }

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

    private static void ReadLoop()
    {
        try
        {
            while (!shuttingDown)
            {
                string json = ReadMessage();
                if (json == null)
                {
                    break;
                }

                HandleNativeMessage(json);
            }
        }
        catch
        {
        }
        finally
        {
            if (!shuttingDown && controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            else if (!shuttingDown)
            {
                PostThreadMessage(mainThreadId, WM_QUIT, UIntPtr.Zero, IntPtr.Zero);
            }
        }
    }

    private static void SendNativeStatus()
    {
        string profile;
        string browserVisibility;
        string compactMap;
        string wideMap;
        string pendingKeys;
        int compactCount;
        int wideCount;
        int pendingCount;
        int heartbeatTick;
        bool compatible;
        bool nativeFullscreenActive;
        lock (StateLock)
        {
            profile = layoutProfile;
            browserVisibility = visibilityMode;
            compactCount = CompactSurfaceWindows.Count;
            wideCount = WideSurfaceWindows.Count;
            pendingCount = PendingSurfaceClaims.Count;
            heartbeatTick = lastHeartbeatTick;
            compatible = protocolCompatible;
            nativeFullscreenActive = fullscreenActive;

            List<string> compactEntries = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in CompactSurfaceWindows)
            {
                compactEntries.Add(pair.Key + "=0x" + pair.Value.ToInt64().ToString("X"));
            }
            compactMap = String.Join(";", compactEntries.ToArray());

            List<string> wideEntries = new List<string>();
            foreach (KeyValuePair<string, IntPtr> pair in WideSurfaceWindows)
            {
                wideEntries.Add(pair.Key + "=0x" + pair.Value.ToInt64().ToString("X"));
            }
            wideMap = String.Join(";", wideEntries.ToArray());

            List<string> claimEntries = new List<string>();
            foreach (string claimKey in PendingSurfaceClaims.Keys)
            {
                claimEntries.Add(claimKey);
            }
            pendingKeys = String.Join(";", claimEntries.ToArray());
        }

        int shellCount;
        lock (TaskbarShellWindows)
        {
            shellCount = TaskbarShellWindows.Count;
        }

        uint heartbeatAgeMs = unchecked((uint)(Environment.TickCount - heartbeatTick));

        WriteJson(
            "{\"event\":\"status\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
            ",\"protocolCompatible\":" + (compatible ? "true" : "false") +
            ",\"layoutProfile\":\"" + JsonEscape(profile ?? "unknown") +
            "\",\"browserVisibility\":\"" + JsonEscape(browserVisibility ?? "none") +
            "\",\"effectiveVisibility\":\"" + JsonEscape(lastEffectiveVisibility ?? "none") +
            "\",\"fullscreenActive\":" + (nativeFullscreenActive ? "true" : "false") +
            ",\"heartbeatFresh\":" + (IsHeartbeatFresh() ? "true" : "false") +
            ",\"heartbeatAgeMs\":" + heartbeatAgeMs +
            ",\"compactSurfaces\":" + compactCount +
            ",\"compactSurfaceMap\":\"" + JsonEscape(compactMap) +
            "\",\"wideSurfaces\":" + wideCount +
            ",\"wideSurfaceMap\":\"" + JsonEscape(wideMap) +
            "\",\"shellWindows\":" + shellCount +
            ",\"pendingClaims\":" + pendingCount +
            ",\"pendingClaimKeys\":\"" + JsonEscape(pendingKeys) +
            "\",\"foreground\":\"" + JsonEscape(DescribeWindow(GetForegroundWindow())) + "\"}"
        );
    }


    private static void HandleNativeMessage(string json)
    {
        string type = GetJsonString(json, "type") ?? String.Empty;

        if (type.Equals("shutdown", StringComparison.OrdinalIgnoreCase))
        {
            shuttingDown = true;
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        int protocolVersion = GetJsonInt(json, "protocolVersion", 0);
        if (protocolVersion != TITLEBAR_PROTOCOL_VERSION)
        {
            lock (StateLock)
            {
                protocolCompatible = false;
            }
            LogDiagnostic(
                "protocol mismatch expected=" + TITLEBAR_PROTOCOL_VERSION +
                " received=" + protocolVersion +
                " type=" + type
            );
            ClearPendingSurfaceClaims();
            WriteJson(
                "{\"event\":\"protocol-mismatch\",\"expected\":" + TITLEBAR_PROTOCOL_VERSION +
                ",\"received\":" + protocolVersion + "}"
            );
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        lock (StateLock)
        {
            protocolCompatible = true;
        }
        TouchHeartbeat();

        if (type.Equals("hello", StringComparison.OrdinalIgnoreCase))
        {
            WriteJson(
                "{\"event\":\"hello-ack\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION + "}"
            );
            return;
        }

        if (type.Equals("heartbeat", StringComparison.OrdinalIgnoreCase))
        {
            SendNativeStatus();
            return;
        }

        if (type.Equals("init", StringComparison.OrdinalIgnoreCase))
        {
            lock (StateLock)
            {
                leftPane = new PaneBounds(
                    GetJsonInt(json, "left", 0),
                    GetJsonInt(json, "top", 0),
                    GetJsonInt(json, "width", 1920),
                    GetJsonInt(json, "height", 1080)
                );

                rightPane = new PaneBounds(
                    GetJsonInt(json, "rightLeft", 1920),
                    GetJsonInt(json, "rightTop", 0),
                    GetJsonInt(json, "rightWidth", 1920),
                    GetJsonInt(json, "rightHeight", 1080)
                );

                layoutProfile = GetJsonString(json, "layoutProfile") ?? "wide";
                leftMode = GetJsonString(json, "leftMode") ?? "landing";
                rightMode = GetJsonString(json, "rightMode") ?? "dashboard";
                visibilityMode = GetJsonString(json, "visibilityMode") ?? "none";
                settingsOpen = GetJsonBool(json, "settingsOpen", false);
                volumeActive = GetJsonBool(json, "volumeActive", false);
                fullscreenActive = GetJsonBool(json, "fullscreenActive", false);
                volumeShortcut = GetJsonString(json, "volumeShortcut") ?? "";
                initialized = true;
            }

            LogDiagnostic(
                "init received protocol=" + TITLEBAR_PROTOCOL_VERSION +
                " layout=" + layoutProfile +
                ", leftMode=" + leftMode +
                ", rightMode=" + rightMode +
                ", visibility=" + visibilityMode
            );

            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }

            WriteJson(
                "{\"event\":\"ready\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION + "}"
            );
            SendNativeStatus();
            return;
        }

        if (type.Equals("claim-cancel", StringComparison.OrdinalIgnoreCase))
        {
            ClearPendingSurfaceClaims();
            return;
        }

        if (type.Equals("claim", StringComparison.OrdinalIgnoreCase))
        {
            string claimProfile = GetJsonString(json, "layoutProfile") ?? String.Empty;
            string claimSide = GetJsonString(json, "side") ?? String.Empty;
            string claimMode = GetJsonString(json, "mode") ?? String.Empty;
            string titleHint = GetJsonString(json, "titleHint") ?? String.Empty;

            QueueSurfaceClaim(claimProfile, claimSide, claimMode, titleHint);
            if (controllerWindow != IntPtr.Zero)
            {
                PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        if (type.Equals("state", StringComparison.OrdinalIgnoreCase))
        {
            lock (StateLock)
            {
                string nextLayoutProfile = GetJsonString(json, "layoutProfile");
                string nextLeft = GetJsonString(json, "leftMode");
                string nextRight = GetJsonString(json, "rightMode");
                string nextVisibility = GetJsonString(json, "visibilityMode");

                if (!String.IsNullOrWhiteSpace(nextLayoutProfile)) layoutProfile = nextLayoutProfile;
                if (!String.IsNullOrWhiteSpace(nextLeft)) leftMode = nextLeft;
                if (!String.IsNullOrWhiteSpace(nextRight)) rightMode = nextRight;
                if (!String.IsNullOrWhiteSpace(nextVisibility)) visibilityMode = nextVisibility;
                settingsOpen = GetJsonBool(json, "settingsOpen", settingsOpen);
                volumeActive = GetJsonBool(json, "volumeActive", volumeActive);
                fullscreenActive = GetJsonBool(json, "fullscreenActive", fullscreenActive);

                // Display-profile geometry can change while the native host
                // remains connected (for example after docking and reopening
                // Stream Shell). Keep pane discovery synchronized with the
                // extension instead of requiring a native-host restart.
                leftPane = new PaneBounds(
                    GetJsonInt(json, "left", leftPane.Left),
                    GetJsonInt(json, "top", leftPane.Top),
                    GetJsonInt(json, "width", leftPane.Width),
                    GetJsonInt(json, "height", leftPane.Height)
                );

                rightPane = new PaneBounds(
                    GetJsonInt(json, "rightLeft", rightPane.Left),
                    GetJsonInt(json, "rightTop", rightPane.Top),
                    GetJsonInt(json, "rightWidth", rightPane.Width),
                    GetJsonInt(json, "rightHeight", rightPane.Height)
                );
            }

            if (leftChromeOverlay != IntPtr.Zero) InvalidateRect(leftChromeOverlay, IntPtr.Zero, false);
            if (rightChromeOverlay != IntPtr.Zero) InvalidateRect(rightChromeOverlay, IntPtr.Zero, false);
            if (rightCaptionBlockerOverlay != IntPtr.Zero) InvalidateRect(rightCaptionBlockerOverlay, IntPtr.Zero, false);
            if (leftOverlay != IntPtr.Zero) InvalidateRect(leftOverlay, IntPtr.Zero, false);
            if (rightOverlay != IntPtr.Zero) InvalidateRect(rightOverlay, IntPtr.Zero, false);
            if (controllerWindow != IntPtr.Zero) PostMessage(controllerWindow, WM_APP_SYNC, IntPtr.Zero, IntPtr.Zero);
            return;
        }

        if (type.Equals("focus", StringComparison.OrdinalIgnoreCase))
        {
            string side = GetJsonString(json, "side") ?? String.Empty;
            if (side.Equals("left", StringComparison.OrdinalIgnoreCase) || side.Equals("right", StringComparison.OrdinalIgnoreCase))
            {
                lock (StateLock)
                {
                    pendingFocusSide = side.ToLowerInvariant();
                }

                if (controllerWindow != IntPtr.Zero) PostMessage(controllerWindow, WM_APP_FOCUS, IntPtr.Zero, IntPtr.Zero);
            }
            return;
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

    private static void CleanupWindows()
    {
        lock (StateLock)
        {
            PendingSurfaceClaims.Clear();
            CompactSurfaceWindows.Clear();
            WideSurfaceWindows.Clear();
            protocolCompatible = false;
        }

        CleanupOverlay(ref leftChromeOverlay);
        CleanupOverlay(ref rightChromeOverlay);
        CleanupOverlay(ref rightCaptionBlockerOverlay);
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
