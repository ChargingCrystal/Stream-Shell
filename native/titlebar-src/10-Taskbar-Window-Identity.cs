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

// Original v0.20.12 source: lines 5114-5744.
internal static partial class StreamShellTitlebarHost
{
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

}
