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

// Original v0.20.12 source: lines 1283-2062.
internal static partial class StreamShellTitlebarHost
{
    private static ButtonDef BuiltinProviderButton(string id)
    {
        switch ((id ?? String.Empty).ToLowerInvariant())
        {
            case "youtube": return new ButtonDef("YT", id, "youtube.png", 19, 14);
            case "netflix": return new ButtonDef("N", id, "netflix.png", 12, 20);
            case "prime": return new ButtonDef("P", id, "prime.png", 18, 18);
            case "disney": return new ButtonDef("D+", id, "disney.png", 20, 20);
            case "crunchyroll": return new ButtonDef("CR", id, "crunchyroll.png", 19, 19);
            default: return null;
        }
    }

    private static bool HasLeftDividerAfter(ButtonDef[] buttons, int index, bool compact)
    {
        if (index < 0 || index >= buttons.Length - 1) return false;
        string current = buttons[index].Action;
        string next = buttons[index + 1].Action;
        if (compact)
        {
            return current == "volume" || next == "kill";
        }
        return next == "dashboard" || next == "kill";
    }

    private static int MeasureLeftButtons(ButtonDef[] buttons, int dpi, bool compact)
    {
        int width = buttons.Length * GetLeftButtonWidth(dpi);
        for (int i = 0; i < buttons.Length - 1; i++)
        {
            width += HasLeftDividerAfter(buttons, i, compact)
                ? 2 * GetLeftDividerMargin(dpi) + GetLeftDividerWidth(dpi)
                : GetLeftGap(dpi);
        }
        return width;
    }

    private static ButtonDef[] ComposeLeftButtons(bool compact, ButtonDef[] providers, int paneWidth, int dpi)
    {
        ButtonDef[] before = compact
            ? new ButtonDef[] { CompactButtons[0], CompactButtons[1], CompactButtons[2], CompactButtons[3] }
            : new ButtonDef[] { LeftButtons[0], LeftButtons[1] };
        ButtonDef[] after = compact
            ? new ButtonDef[] { CompactButtons[CompactButtons.Length - 1] }
            : new ButtonDef[] { LeftButtons[7], LeftButtons[8], LeftButtons[9], LeftButtons[10], LeftButtons[11] };

        // Leave the native caption's drag/title area clear; never expand into
        // the adjacent Wide pane or a Compact caption control at small DPI.
        int budget = Math.Max(Scale(100, dpi), paneWidth - Scale(180, dpi));
        for (int visible = providers.Length; visible >= 0; visible--)
        {
            List<ButtonDef> entries = new List<ButtonDef>(before);
            for (int i = 0; i < visible; i++) entries.Add(providers[i]);
            if (visible < providers.Length) entries.Add(OverflowButton);
            entries.AddRange(after);
            ButtonDef[] result = entries.ToArray();
            if (MeasureLeftButtons(result, dpi, compact) <= budget || visible == 0) return result;
        }
        return new ButtonDef[0];
    }

    private static ButtonDef[] GetOverlayButtons(bool isLeft)
    {
        bool compact;
        ButtonDef[] providers;
        int paneWidth;
        string currentRightMode;
        lock (StateLock)
        {
            compact = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
            providers = DynamicProviderButtons;
            paneWidth = leftPane.Width;
            currentRightMode = rightMode;
        }

        if (isLeft)
        {
            return ComposeLeftButtons(compact, providers, paneWidth, GetTargetDpi(leftOwner));
        }
        if (compact) return new ButtonDef[0];
        if (String.Equals(currentRightMode, "discord", StringComparison.OrdinalIgnoreCase)) return RightDiscordButtons;
        if (String.Equals(currentRightMode, "twitch", StringComparison.OrdinalIgnoreCase)) return RightTwitchButtons;
        return RightButtons;
    }

    private static void ShowProviderOverflowMenu(IntPtr overlay)
    {
        ButtonDef[] displayed = GetOverlayButtons(true);
        HashSet<string> visible = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (ButtonDef button in displayed) visible.Add(button.Action);
        List<ButtonDef> hidden = new List<ButtonDef>();
        Dictionary<string, string> names;
        lock (StateLock)
        {
            foreach (ButtonDef button in DynamicProviderButtons)
                if (!visible.Contains(button.Action)) hidden.Add(button);
            names = new Dictionary<string, string>(ProviderMenuNames, StringComparer.OrdinalIgnoreCase);
        }
        if (hidden.Count == 0) return;
        IntPtr menu = CreatePopupMenu();
        if (menu == IntPtr.Zero) return;
        try
        {
            for (int i = 0; i < hidden.Count; i++)
            {
                string name;
                if (!names.TryGetValue(hidden[i].Action, out name)) name = hidden[i].Action;
                AppendMenu(menu, MF_STRING, new UIntPtr((uint)(i + 1)), name);
            }
            RECT rectangle;
            if (!GetWindowRect(overlay, out rectangle)) return;
            uint selected = TrackPopupMenuEx(menu, TPM_RIGHTALIGN | TPM_TOPALIGN | TPM_NONOTIFY | TPM_RETURNCMD,
                rectangle.Right, rectangle.Bottom, overlay, IntPtr.Zero);
            if (selected > 0 && selected <= hidden.Count) SendAction(hidden[(int)selected - 1].Action);
        }
        finally { DestroyMenu(menu); }
    }

    private static string NormalizeTitlebarColor(string input)
    {
        return !String.IsNullOrEmpty(input) &&
            Regex.IsMatch(input, "^#[0-9A-Fa-f]{6}$", RegexOptions.CultureInvariant)
            ? input.ToUpperInvariant() : String.Empty;
    }

    // v9: PNG primary is loaded directly by the extension worker, without the
    // offscreen SVG renderer. Normalize all received PNGs to 32px neutral-gray
    // silhouettes on the native side. The accent applies to backgrounds only.
    private static bool TryDecodeTitlebarIcon(string data, out Bitmap bitmap)
    {
        bitmap = null;
        if (String.IsNullOrEmpty(data)) return true;
        if (data.Length > 22000) return false;
        try
        {
            byte[] bytes = Convert.FromBase64String(data);
            if (bytes.Length < 24 || bytes.Length > 16384 ||
                bytes[0] != 137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71 ||
                bytes[4] != 13 || bytes[5] != 10 || bytes[6] != 26 || bytes[7] != 10)
                return false;
            using (MemoryStream stream = new MemoryStream(bytes, false))
            using (Image source = Image.FromStream(stream, false, true))
            {
                if (source.Width < 1 || source.Height < 1 ||
                    source.Width > 4096 || source.Height > 4096) return false;
                Bitmap normalized = new Bitmap(32, 32, PixelFormat.Format32bppArgb);
                try
                {
                    using (Graphics graphics = Graphics.FromImage(normalized))
                    {
                        graphics.Clear(Color.Transparent);
                        graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceOver;
                        graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                        float scale = Math.Min(32f / source.Width, 32f / source.Height);
                        float width = source.Width * scale;
                        float height = source.Height * scale;
                        graphics.DrawImage(source, (32f-width)/2, (32f-height)/2, width, height);
                    }
                    Color[] probes = new Color[] {
                        normalized.GetPixel(16,1), normalized.GetPixel(16,30),
                        normalized.GetPixel(1,16), normalized.GetPixel(30,16)
                    };
                    Color baseColor = probes[0];
                    bool flatBackground = true;
                    foreach (Color color in probes)
                    {
                        if (color.A <= 230 || Math.Max(Math.Abs(color.R-baseColor.R),
                            Math.Max(Math.Abs(color.G-baseColor.G),Math.Abs(color.B-baseColor.B))) >= 20)
                        { flatBackground = false; break; }
                    }
                    bool hasForeground = false;
                    if (flatBackground)
                    {
                        for (int y=0; y<32 && !hasForeground; y++) for (int x=0; x<32; x++)
                        {
                            Color pixel = normalized.GetPixel(x,y);
                            if (pixel.A > 128 && Math.Max(Math.Abs(pixel.R-baseColor.R),
                                Math.Max(Math.Abs(pixel.G-baseColor.G),Math.Abs(pixel.B-baseColor.B))) > 55)
                            { hasForeground = true; break; }
                        }
                    }
                    int visible = 0;
                    for (int y=0; y<32; y++) for (int x=0; x<32; x++)
                    {
                        Color pixel = normalized.GetPixel(x,y);
                        int alpha = pixel.A;
                        if (flatBackground && hasForeground)
                        {
                            int difference = Math.Max(Math.Abs(pixel.R-baseColor.R),
                                Math.Max(Math.Abs(pixel.G-baseColor.G),Math.Abs(pixel.B-baseColor.B)));
                            alpha = (int)Math.Round(alpha*Math.Min(1.0,difference/100.0));
                        }
                        if (alpha > 0) visible++;
                        normalized.SetPixel(x,y,Color.FromArgb(alpha,213,208,221));
                    }
                    if (visible == 0) return false;
                    bitmap = normalized;
                    normalized = null;
                    return true;
                }
                finally { if (normalized != null) normalized.Dispose(); }
            }
        }
        catch { if (bitmap != null) bitmap.Dispose(); bitmap = null; return false; }
    }

    private static bool TryApplyProviderConfig(string encoded, int generation, out int buttonCount, out int skippedIcons)
    {
        buttonCount = 0;
        skippedIcons = 0;
        if (encoded == null || encoded.Length > 4000000 || generation < 1) return false;
        string decoded;
        try { decoded = new UTF8Encoding(false, true).GetString(Convert.FromBase64String(encoded)); }
        catch { return false; }
        string[] rows = decoded.Split(new char[] { '\n' }, StringSplitOptions.RemoveEmptyEntries);
        if (rows.Length > 128) return false;
        List<ButtonDef> buttons = new List<ButtonDef>();
        Dictionary<string, string> names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, Bitmap> newIcons = new Dictionary<string, Bitmap>(StringComparer.OrdinalIgnoreCase);
        HashSet<string> used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        bool accepted = false;
        try
        {
            foreach (string row in rows)
            {
                string[] parts = row.Split('\t');
                if (parts.Length != 5) return false;
                string id = parts[0];
                if (!Regex.IsMatch(id, "^(youtube|netflix|prime|disney|crunchyroll|custom-[a-z0-9]{8,40})$", RegexOptions.CultureInvariant)) return false;
                if (!used.Add(id)) return false;
                string label = parts[1];
                string fullName = parts[2];
                if (label.Length < 1 || label.Length > 8 || fullName.Length < 1 || fullName.Length > 48 ||
                    label.IndexOfAny(new char[] { '\r', '\n', '\t' }) >= 0 ||
                    fullName.IndexOfAny(new char[] { '\r', '\n', '\t' }) >= 0) return false;
                string color = parts[3];
                if (color.Length > 0 && NormalizeTitlebarColor(color).Length == 0) return false;
                Bitmap icon;
                // Invalid PNG data must NEVER invalidate an otherwise valid
                // provider list. Downgrade only this icon to text initials.
                if (!TryDecodeTitlebarIcon(parts[4], out icon))
                {
                    icon = null;
                    skippedIcons++;
                }
                if (icon != null) newIcons[id] = icon;
                ButtonDef builtIn = BuiltinProviderButton(id);
                ButtonDef button = builtIn ?? new ButtonDef(label, id);
                button.AccentColor = NormalizeTitlebarColor(color);
                // Icons are always neutral monochrome. AccentColor is only
                // used by CustomChromeTheme for the native background states.
                if (icon != null) { button.IconFile = "dynamic-png"; button.IconWidth = 22; button.IconHeight = 22; }
                buttons.Add(button);
                names[id] = fullName;
            }
            lock (StateLock)
            {
                if (generation < ProviderConfigGeneration) return false;
                if (generation > ProviderConfigGeneration)
                {
                    foreach (string id in DynamicIconActions)
                    {
                        Bitmap prior;
                        if (ButtonIcons.TryGetValue(id, out prior))
                        {
                            RetiredDynamicIcons.Add(prior);
                            ButtonIcons.Remove(id);
                        }
                    }
                    DynamicIconActions.Clear();
                    foreach (KeyValuePair<string, Bitmap> pair in newIcons)
                    {
                        ButtonIcons[pair.Key] = pair.Value;
                        DynamicIconActions.Add(pair.Key);
                    }
                    // Ownership of new icons transferred to the cache.
                    newIcons.Clear();
                    DynamicProviderButtons = buttons.ToArray();
                    ProviderMenuNames = names;
                    ProviderConfigGeneration = generation;
                    leftHover = -1;
                    // Force DWM caption/border reapplication even when the same
                    // provider stays open after a live color change.
                    lock (WindowChromeModes) WindowChromeModes.Clear();
                }
                buttonCount = DynamicProviderButtons.Length;
            }
            // When the same generation is acknowledged again, dispose the
            // newly decoded duplicate; the existing image cache remains live.
            foreach (Bitmap redundant in newIcons.Values) redundant.Dispose();
            newIcons.Clear();
            accepted = true;
            return true;
        }
        finally
        {
            if (!accepted)
                foreach (Bitmap pending in newIcons.Values) pending.Dispose();
        }
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
        bool compact;
        ButtonDef[] providers;
        int paneWidth;
        lock (StateLock)
        {
            compact = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase);
            providers = DynamicProviderButtons;
            paneWidth = leftPane.Width;
        }
        ButtonDef[] buttons = ComposeLeftButtons(compact, providers, paneWidth, dpi);
        return MeasureLeftButtons(buttons, dpi, compact);
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
            bool compact;
            lock (StateLock) { compact = String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase); }
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
                    cursor = right + (HasLeftDividerAfter(buttons, i, compact)
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

                    Bitmap icon = null;
                    if (isLeft && buttons[i].IconFile != null)
                    {
                        lock (StateLock) ButtonIcons.TryGetValue(buttons[i].Action, out icon);
                    }
                    if (isLeft && icon != null && graphics != null)
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
                        SetTextColor(hdc, active ? Rgb(225, 215, 235) : Rgb(205, 200, 211));
                        DrawText(hdc, buttons[i].Label, -1, ref rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
                        SelectObject(hdc, oldFont);
                        DeleteObject(font);
                    }

                    if (isLeft && i < count - 1 && HasLeftDividerAfter(buttons, i,
                        String.Equals(layoutProfile, "compact", StringComparison.OrdinalIgnoreCase)))
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
        DynamicIconActions.Clear();
        foreach (Bitmap icon in RetiredDynamicIcons)
        {
            try { icon.Dispose(); } catch { }
        }
        RetiredDynamicIcons.Clear();
    }

    private static bool IsActionActive(string action)
    {
        lock (StateLock)
        {
            if (action == "landing" || action.StartsWith("custom-", StringComparison.OrdinalIgnoreCase) ||
                action == "youtube" || action == "netflix" || action == "prime" || action == "disney" || action == "crunchyroll")
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

}
