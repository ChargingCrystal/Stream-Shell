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

internal static partial class StreamShellTitlebarHost
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
    private const uint WM_SETTEXT = 0x000C;
    private const uint SMTO_BLOCK = 0x0001;
    private const uint SMTO_ABORTIFHUNG = 0x0002;
    private const uint EXTERNAL_WINDOW_MESSAGE_TIMEOUT_MS = 350;
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
    private const string CONTROL_PIPE_NAME = "StreamShell.ControlBridge.v1";
    private const int TITLEBAR_PROTOCOL_VERSION = 9;
    private const uint HEARTBEAT_TIMEOUT_MS = 6500;

    private static readonly HashSet<string> ControlBridgeActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "landing",
        "dashboard",
        "settings",
        "reload",
        "volume",
        "youtube",
        "netflix",
        "prime",
        "disney",
        "crunchyroll",
        "discord",
        "twitch",
        "twitch-drops",
        "kill"
    };

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
    private static IntPtr rightSplitChromeOverlay = IntPtr.Zero;
    private static IntPtr rightSplitCaptionBlockerOverlay = IntPtr.Zero;
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
    private static string twitchTarget = "resume";
    private static string twitchPaneFullscreenMember = String.Empty;
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
    // Correlate native HWND mappings with Chrome popup incarnation IDs.
    // Retrying a completed forced claim must NOT exclude its own new HWND.
    private static readonly Dictionary<string, int> WideTwitchClaimBrowserWindowIds =
        new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    private static readonly Dictionary<string, IntPtr> WideTwitchClusterWindows =
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
    private static int rightSplitChromeLastX = Int32.MinValue;
    private static int rightSplitChromeLastY = Int32.MinValue;
    private static int rightSplitChromeLastWidth = Int32.MinValue;
    private static int rightSplitChromeLastHeight = Int32.MinValue;
    private static IntPtr rightSplitChromeLastTarget = IntPtr.Zero;
    private static bool rightSplitChromePositionLogged;
    private static int rightSplitBlockerLastX = Int32.MinValue;
    private static int rightSplitBlockerLastY = Int32.MinValue;
    private static int rightSplitBlockerLastWidth = Int32.MinValue;
    private static int rightSplitBlockerLastHeight = Int32.MinValue;
    private static IntPtr rightSplitBlockerLastTarget = IntPtr.Zero;

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
    // Old rasters remain alive until shutdown: native messages arrive on the
    // reader thread, while the overlay can still be drawing the previous icon.
    private static readonly List<Bitmap> RetiredDynamicIcons = new List<Bitmap>();
    private static readonly HashSet<string> DynamicIconActions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    private sealed class SurfaceClaimState
    {
        public string LayoutProfile;
        public string Side;
        public string Mode;
        public string Member;
        public string TitleHint;
        public bool HasPaneOverride;
        public PaneBounds PaneOverride;
        public bool ForceRebind;
        public int BrowserWindowId;
        public IntPtr Candidate;
        public int StablePasses;
        public int Attempts;

        public SurfaceClaimState(
            string layoutProfile,
            string side,
            string mode,
            string member,
            string titleHint,
            bool hasPaneOverride,
            PaneBounds paneOverride,
            bool forceRebind,
            int browserWindowId
        )
        {
            ForceRebind = forceRebind;
            BrowserWindowId = browserWindowId;
            LayoutProfile = layoutProfile ?? String.Empty;
            Side = side ?? String.Empty;
            Mode = mode ?? String.Empty;
            Member = member ?? String.Empty;
            TitleHint = titleHint ?? String.Empty;
            HasPaneOverride = hasPaneOverride;
            PaneOverride = paneOverride;
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
        public string AccentColor;

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

    // The right-side buttons and Twitch/Discord HWND ownership are deliberately static.
    // The left provider section alone is replaced by validated messages from the extension.
    private static ButtonDef[] DynamicProviderButtons = new ButtonDef[]
    {
        new ButtonDef("YT", "youtube", "youtube.png", 19, 14),
        new ButtonDef("N", "netflix", "netflix.png", 12, 20),
        new ButtonDef("P", "prime", "prime.png", 18, 18),
        new ButtonDef("D+", "disney", "disney.png", 20, 20),
        new ButtonDef("CR", "crunchyroll", "crunchyroll.png", 19, 19)
    };
    private static Dictionary<string, string> ProviderMenuNames =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    private static int ProviderConfigGeneration = 0;
    private static readonly ButtonDef OverflowButton = new ButtonDef("...", "provider-overflow");

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

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    // Time-bounded Win32 IPC: SendMessage can wait indefinitely when Opera's
    // renderer/UI thread is hung (notably after long fullscreen gaming sessions).
    [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SendMessageTimeoutPtr(IntPtr hWnd, uint msg, IntPtr wParam,
        IntPtr lParam, uint flags, uint timeoutMs, out IntPtr result);

    [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SendMessageTimeoutText(IntPtr hWnd, uint msg, IntPtr wParam,
        [MarshalAs(UnmanagedType.LPWStr)] string lParam, uint flags, uint timeoutMs, out IntPtr result);

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

    private const uint TPM_RIGHTALIGN = 0x0008;
    private const uint TPM_TOPALIGN = 0x0000;
    private const uint TPM_NONOTIFY = 0x0080;
    private const uint TPM_RETURNCMD = 0x0100;
    private const uint MF_STRING = 0;

    [DllImport("user32.dll")]
    private static extern IntPtr CreatePopupMenu();

    [DllImport("user32.dll")]
    private static extern bool DestroyMenu(IntPtr hMenu);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool AppendMenu(IntPtr hMenu, uint flags, UIntPtr itemId, string itemText);

    [DllImport("user32.dll")]
    private static extern uint TrackPopupMenuEx(IntPtr hMenu, uint flags, int x, int y, IntPtr hWnd, IntPtr reserved);

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

}
