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

// Original v0.20.12 source: lines 2673-3158.
internal static partial class StreamShellTitlebarHost
{
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

    private static string GetSurfaceClaimKey(string profile, string side, string mode, string member)
    {
        return (profile ?? String.Empty).ToLowerInvariant() + "|" +
            (side ?? String.Empty).ToLowerInvariant() + "|" +
            (mode ?? String.Empty).ToLowerInvariant() + "|" +
            (member ?? String.Empty).ToLowerInvariant();
    }

    private static void QueueSurfaceClaim(
        string profile,
        string side,
        string mode,
        string member,
        string titleHint,
        bool hasPaneOverride,
        PaneBounds paneOverride,
        bool forceRebind = false,
        int browserWindowId = 0
    )
    {
        string normalizedProfile = (profile ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedSide = (side ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedMode = (mode ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedMember = (member ?? String.Empty).Trim().ToLowerInvariant();
        string normalizedTitleHint = (titleHint ?? String.Empty).Trim();

        if ((normalizedProfile != "wide" && normalizedProfile != "compact") ||
            (normalizedSide != "left" && normalizedSide != "right") ||
            String.IsNullOrWhiteSpace(normalizedMode) ||
            String.IsNullOrWhiteSpace(normalizedTitleHint)) return;

        if (normalizedProfile == "compact" && normalizedSide != "left") return;

        bool memberClaim = !String.IsNullOrWhiteSpace(normalizedMember);
        if (memberClaim && !(normalizedProfile == "wide" && normalizedSide == "right" && normalizedMode == "twitch")) return;
        if (memberClaim && (!hasPaneOverride || paneOverride.Width <= 0 || paneOverride.Height <= 0)) return;

        string key = GetSurfaceClaimKey(normalizedProfile, normalizedSide, normalizedMode, normalizedMember);
        lock (StateLock)
        {
            SurfaceClaimState existing;
            if (PendingSurfaceClaims.TryGetValue(key, out existing) &&
                String.Equals(existing.TitleHint, normalizedTitleHint, StringComparison.OrdinalIgnoreCase) &&
                existing.ForceRebind == forceRebind &&
                existing.BrowserWindowId == browserWindowId) return;

            PendingSurfaceClaims[key] = new SurfaceClaimState(
                normalizedProfile, normalizedSide, normalizedMode, normalizedMember, normalizedTitleHint, hasPaneOverride, paneOverride, forceRebind, browserWindowId
            );
        }

        LogDiagnostic(
            "surface claim queued profile=" + normalizedProfile +
            " side=" + normalizedSide +
            " mode=" + normalizedMode +
            " member=" + (String.IsNullOrWhiteSpace(normalizedMember) ? "-" : normalizedMember) +
            " titleHint=" + normalizedTitleHint
        );
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

    private static TargetInfo FindWideClaimCandidate(PaneBounds pane, string titleHint, IntPtr excludeHandle)
    {
        IntPtr foreground = GetForegroundWindow();
        TargetInfo foregroundCandidate = TryBuildPaneTarget(foreground, pane, false);
        if (foregroundCandidate != null &&
            foregroundCandidate.Handle != IntPtr.Zero &&
            foregroundCandidate.Handle != excludeHandle &&
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
                candidate.Handle == excludeHandle ||
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

    private static IntPtr GetMappedSurfaceHandle(string profile, string side, string mode, string member)
    {
        if (!String.IsNullOrWhiteSpace(member) &&
            String.Equals(profile, "wide", StringComparison.OrdinalIgnoreCase) &&
            String.Equals(side, "right", StringComparison.OrdinalIgnoreCase) &&
            String.Equals(mode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            return GetWideTwitchClusterHandle(member);
        }
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

            claim = new SurfaceClaimState(
                existing.LayoutProfile, existing.Side, existing.Mode, existing.Member, existing.TitleHint,
                existing.HasPaneOverride, existing.PaneOverride, existing.ForceRebind, existing.BrowserWindowId
            );
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
                WriteJson(
                    "{\"event\":\"claim-expired\",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
                    "\",\"side\":\"" + JsonEscape(claim.Side) +
                    "\",\"mode\":\"" + JsonEscape(claim.Mode) +
                    "\",\"member\":\"" + JsonEscape(claim.Member) + "\"}"
                );
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

        PaneBounds pane = claim.HasPaneOverride
            ? claim.PaneOverride
            : (String.Equals(claim.Side, "right", StringComparison.OrdinalIgnoreCase) ? right : left);
        bool compact = String.Equals(claim.LayoutProfile, "compact", StringComparison.OrdinalIgnoreCase);

        /*
         * Idempotent renewal: once the exact HWND is mapped, a later synthetic
         * Alt+Tab caption must not invalidate the mapping simply because the
         * browser tab title no longer equals the native caption we customized.
         */
        IntPtr mapped = GetMappedSurfaceHandle(claim.LayoutProfile, claim.Side, claim.Mode, claim.Member);
        bool twitchClaim = String.Equals(claim.LayoutProfile, "wide", StringComparison.OrdinalIgnoreCase) &&
            String.Equals(claim.Side, "right", StringComparison.OrdinalIgnoreCase) &&
            String.Equals(claim.Mode, "twitch", StringComparison.OrdinalIgnoreCase) &&
            !String.IsNullOrWhiteSpace(claim.Member);
        int mappedBrowserId = 0;
        if (twitchClaim)
        {
            lock (StateLock) WideTwitchClaimBrowserWindowIds.TryGetValue(claim.Member, out mappedBrowserId);
        }
        bool browserIdentityChanged = twitchClaim && mappedBrowserId > 0 &&
            claim.BrowserWindowId > 0 && mappedBrowserId != claim.BrowserWindowId;
        bool forceRebind = claim.ForceRebind || browserIdentityChanged;
        bool alreadyRebound = twitchClaim && mappedBrowserId > 0 &&
            claim.BrowserWindowId > 0 && mappedBrowserId == claim.BrowserWindowId;
        if ((!forceRebind || alreadyRebound) && mapped != IntPtr.Zero && IsWindow(mapped))
        {
            TargetInfo mappedTarget = compact
                ? TryBuildPaneTarget(mapped, pane, false)
                : TryBuildTrustedOperaTarget(mapped);
            bool mappedEligible = mappedTarget != null &&
                (!compact || IsCompactForegroundTarget(mappedTarget));
            if (mappedEligible)
            {
                RegisterTaskbarWindow(mapped, "claim-renew-" + claim.LayoutProfile + "-" + claim.Side + "-" + claim.Mode + "-" + claim.Member);
                RemovePendingSurfaceClaim(key);
                WriteJson(
                    "{\"event\":\"claim-accepted\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
                    ",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
                    "\",\"side\":\"" + JsonEscape(claim.Side) +
                    "\",\"mode\":\"" + JsonEscape(claim.Mode) +
                    "\",\"member\":\"" + JsonEscape(claim.Member) +
                    "\",\"titlebarHeight\":" + mappedTarget.TitlebarHeight + ",\"renewed\":true" +
                    (forceRebind && alreadyRebound ? ",\"rebound\":true" : String.Empty) +
                    (claim.BrowserWindowId > 0 ? ",\"browserWindowId\":" + claim.BrowserWindowId : String.Empty) + "}"
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
            // Replacement Twitch popups may overlap the old still-live HWND.
            // A forced rebind must never renew or reselect that obsolete member.
            candidate = FindWideClaimCandidate(pane, claim.TitleHint,
                forceRebind && !alreadyRebound ? mapped : IntPtr.Zero);
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
                WriteJson(
                    "{\"event\":\"claim-expired\",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
                    "\",\"side\":\"" + JsonEscape(claim.Side) +
                    "\",\"mode\":\"" + JsonEscape(claim.Mode) +
                    "\",\"member\":\"" + JsonEscape(claim.Member) + "\"}"
                );
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
                bool twitchMember = !String.IsNullOrWhiteSpace(claim.Member) &&
                    String.Equals(claim.Side, "right", StringComparison.OrdinalIgnoreCase) &&
                    String.Equals(claim.Mode, "twitch", StringComparison.OrdinalIgnoreCase);

                if (twitchMember)
                {
                    WideTwitchClusterWindows.TryGetValue(claim.Member, out previousHandle);
                    List<string> duplicateMembers = new List<string>();
                    foreach (KeyValuePair<string, IntPtr> pair in WideTwitchClusterWindows)
                    {
                        if (pair.Value == candidate.Handle && !String.Equals(pair.Key, claim.Member, StringComparison.OrdinalIgnoreCase))
                            duplicateMembers.Add(pair.Key);
                    }
                    foreach (string duplicate in duplicateMembers)
                    {
                        WideTwitchClusterWindows.Remove(duplicate);
                        WideTwitchClaimBrowserWindowIds.Remove(duplicate);
                    }
                    WideTwitchClusterWindows[claim.Member] = candidate.Handle;
                    if (claim.BrowserWindowId > 0)
                        WideTwitchClaimBrowserWindowIds[claim.Member] = claim.BrowserWindowId;

                    string twitchKey = GetWideSurfaceKey("right", "twitch");
                    IntPtr primary;
                    bool havePrimary = WideSurfaceWindows.TryGetValue(twitchKey, out primary) && primary != IntPtr.Zero && IsWindow(primary);
                    if (!havePrimary || String.Equals(claim.Member, "a", StringComparison.OrdinalIgnoreCase))
                        WideSurfaceWindows[twitchKey] = candidate.Handle;
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
        }

        if (!compact &&
            !String.IsNullOrWhiteSpace(claim.Member) &&
            String.Equals(claim.Side, "right", StringComparison.OrdinalIgnoreCase) &&
            String.Equals(claim.Mode, "twitch", StringComparison.OrdinalIgnoreCase))
        {
            /* Re-establish row ownership exactly when a member becomes known.
             * This replaces timing-based extension retries with one deterministic
             * native action per accepted claim. */
            RaiseWideTwitchClusterOnce(claim.Member);
        }

        RegisterTaskbarWindow(candidate.Handle, "claim-" + claim.LayoutProfile + "-" + claim.Side + "-" + claim.Mode + "-" + claim.Member);

        if (previousHandle != IntPtr.Zero && previousHandle != candidate.Handle)
        {
            UnregisterShellWindowIfUnreferenced(previousHandle, "surface-replaced");
        }

        LogDiagnostic(
            "surface claim accepted profile=" + claim.LayoutProfile +
            " side=" + claim.Side +
            " mode=" + claim.Mode +
            " member=" + (String.IsNullOrWhiteSpace(claim.Member) ? "-" : claim.Member) +
            " hwnd=0x" + candidate.Handle.ToInt64().ToString("X") +
            " nativeTitle=" + GetWindowTitle(candidate.Handle)
        );

        RemovePendingSurfaceClaim(key);
        WriteJson(
            "{\"event\":\"claim-accepted\",\"protocolVersion\":" + TITLEBAR_PROTOCOL_VERSION +
            ",\"layoutProfile\":\"" + JsonEscape(claim.LayoutProfile) +
            "\",\"side\":\"" + JsonEscape(claim.Side) +
            "\",\"mode\":\"" + JsonEscape(claim.Mode) +
            "\",\"member\":\"" + JsonEscape(claim.Member) +
            "\",\"titlebarHeight\":" + candidate.TitlebarHeight +
            (forceRebind ? ",\"rebound\":true" : String.Empty) +
            (claim.BrowserWindowId > 0 ? ",\"browserWindowId\":" + claim.BrowserWindowId : String.Empty) + "}"
        );
    }


}
