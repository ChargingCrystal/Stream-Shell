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

// Original v0.20.12 source: lines 4162-4522.
internal static partial class StreamShellTitlebarHost
{
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
         * lifetime of the HWND. Claim renewals are deliberately slower than the
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


}
