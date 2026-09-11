using Godot;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// <summary>
/// winter 主题（生效层）组件工厂。所有颜色/圆角/字号直接取自网页版
/// 搜打撤/game/css/winter.css 的选择器（注释标来源），与 ThemeTokens 配套。
/// </summary>
public static class WinterUi
{
    // ---------- 渐变背景（CSS linear-gradient / radial-gradient 等价物） ----------

    /// <summary>线性渐变矩形（vertical=false 为横向）。</summary>
    public static TextureRect Linear(Control parent, Color from, Color to, bool vertical,
        Color? mid = null, float midAt = 0.5f)
    {
        var gradient = new Gradient();
        if (mid.HasValue)
        {
            gradient.Colors = new[] { from, mid.Value, to };
            gradient.Offsets = new[] { 0f, midAt, 1f };
        }
        else
        {
            gradient.Colors = new[] { from, to };
            gradient.Offsets = new[] { 0f, 1f };
        }
        var texture = new GradientTexture2D { Gradient = gradient, Width = 64, Height = 64 };
        texture.FillFrom = vertical ? new Vector2(0.5f, 0f) : new Vector2(0f, 0.5f);
        texture.FillTo = vertical ? new Vector2(0.5f, 1f) : new Vector2(1f, 0.5f);
        var rect = new TextureRect
        {
            Texture = texture,
            MouseFilter = Control.MouseFilterEnum.Ignore,
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.Scale
        };
        rect.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        parent.AddChild(rect);
        return rect;
    }

    /// <summary>径向渐变矩形（对应 CSS radial-gradient(circle/ellipse at x% y%, …)）。</summary>
    public static TextureRect Radial(Control parent, Color from, Color to, Vector2 center, Vector2 extent)
    {
        var gradient = new Gradient();
        gradient.Colors = new[] { from, to };
        gradient.Offsets = new[] { 0f, 1f };
        var texture = new GradientTexture2D
        {
            Gradient = gradient,
            Fill = GradientTexture2D.FillEnum.Radial,
            FillFrom = center,
            FillTo = center + extent,
            Width = 128,
            Height = 128
        };
        var rect = new TextureRect
        {
            Texture = texture,
            MouseFilter = Control.MouseFilterEnum.Ignore,
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.Scale
        };
        rect.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
        parent.AddChild(rect);
        return rect;
    }

    // ---------- 样式盒 ----------

    public static StyleBoxFlat Box(Color bg, int radius, Color? border = null, int borderWidth = 0)
    {
        var box = new StyleBoxFlat { BgColor = bg };
        box.SetCornerRadiusAll(radius);
        if (border.HasValue)
        {
            box.BorderColor = border.Value;
            box.SetBorderWidthAll(borderWidth);
        }
        return box;
    }

    // ---------- 按钮（winter: .ov-btn/.mini-btn 块） ----------

    /// <summary>.ov-btn：bg #24424f 边 #607c86 字 #e3eeea，radius 1；kind = "" | "ok" | "danger"。</summary>
    public static Button OvButton(string text, string kind = "", Vector2? minSize = null)
    {
        var button = new Button { Text = text, FocusMode = Control.FocusModeEnum.All };
        button.CustomMinimumSize = minSize ?? new Vector2(0, 44);
        button.AddThemeFontSizeOverride("font_size", 14);
        button.AddThemeColorOverride("font_color", kind == "ok" ? ThemeTokens.BtnOkText
            : kind == "danger" ? ThemeTokens.BtnDangerText : new Color("e3eeea"));
        var bg = kind == "ok" ? ThemeTokens.BtnOkBg : kind == "danger" ? ThemeTokens.BtnDangerBg : ThemeTokens.BtnBg;
        var border = kind == "ok" ? ThemeTokens.BtnOkBg : kind == "danger" ? ThemeTokens.BtnDangerBorder : ThemeTokens.BtnBorder;
        var hoverBg = kind == "ok" ? new Color("e5cf9d") : kind == "danger" ? new Color("96564e") : ThemeTokens.BtnBgHover;
        button.AddThemeStyleboxOverride("normal", Box(bg, ThemeTokens.RadiusCrisp, border, 1));
        button.AddThemeStyleboxOverride("hover", Box(hoverBg, ThemeTokens.RadiusCrisp, ThemeTokens.BtnBorderHover, 1));
        button.AddThemeStyleboxOverride("pressed", Box(bg.Darkened(0.15f), ThemeTokens.RadiusCrisp, border, 1));
        button.AddThemeStyleboxOverride("focus", Box(bg, ThemeTokens.RadiusCrisp, ThemeTokens.FocusRing, 2));
        return button;
    }

    /// <summary>.mini-btn（小号 ov-btn：12px 字）。</summary>
    public static Button MiniButton(string text, string kind = "")
    {
        var button = OvButton(text, kind, new Vector2(0, 32));
        button.AddThemeFontSizeOverride("font_size", 12);
        return button;
    }

    /// <summary>AK 幽灵件（#btnTitleExit/#btnTitleMute/.ak-quickref：透明底，hover 青绿边+亮字）。</summary>
    public static Button GhostButton(string text, Vector2 minSize, Texture2D? icon = null)
    {
        var button = new Button
        {
            Text = text,
            Icon = icon,
            ExpandIcon = false,
            FocusMode = Control.FocusModeEnum.All
        };
        button.CustomMinimumSize = minSize;
        button.AddThemeColorOverride("font_color", new Color("eef1ec"));
        button.AddThemeColorOverride("font_hover_color", Colors.White);
        button.AddThemeFontSizeOverride("font_size", 13);
        button.AddThemeConstantOverride("h_separation", 10);
        button.AddThemeStyleboxOverride("normal", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("hover", GhostHover());
        button.AddThemeStyleboxOverride("pressed", GhostHover());
        button.AddThemeStyleboxOverride("focus", GhostHover());
        return button;
    }

    private static StyleBoxFlat GhostHover() => Box(new Color("2c3032", 0.95f), 2, UiTheme.AkMint, 1);

    // ---------- 面板 ----------

    /// <summary>
    /// #overlay .hub-card（winter 浅色）：linear-gradient(168deg,#ece9e2,#dcd8ce) 边 #b7b4aa；
    /// h3 14.5px #3c3a33。返回内容列。
    /// </summary>
    public static VBoxContainer HubCard(Control parent, string title, string titleIcon = "")
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", Box(new Color("e9e5da"), ThemeTokens.RadiusCrisp, new Color("b7b4aa"), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 16);
        margin.AddThemeConstantOverride("margin_right", 16);
        margin.AddThemeConstantOverride("margin_top", 14);
        margin.AddThemeConstantOverride("margin_bottom", 14);
        panel.AddChild(margin);
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 10);
        margin.AddChild(column);
        if (!string.IsNullOrWhiteSpace(title))
        {
            var head = new HBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            head.AddThemeConstantOverride("separation", 8);
            column.AddChild(head);
            if (titleIcon.Length > 0)
                head.AddChild(Icon(titleIcon, 15));
            head.AddChild(Heading(title, 14.5f, new Color("3c3a33")));
        }
        parent.AddChild(panel);
        return column;
    }

    /// <summary>#overlay .card 弹窗卡（深色渐变近似 #203a48→#132a36 边 #697f87 + 大投影）。</summary>
    public static PanelContainer OverlayCard(Control parent)
    {
        var panel = new PanelContainer();
        var box = Box(ThemeTokens.OverlayCardBottom, ThemeTokens.RadiusCrisp, ThemeTokens.OverlayCardBorder, 1);
        ThemeTokens.OverlayDrop.Apply(box);
        panel.AddThemeStyleboxOverride("panel", box);
        parent.AddChild(panel);
        return panel;
    }

    // ---------- 行件 ----------

    /// <summary>
    /// .res-chip/.fc-chip：icon + 文本 + 数值。light=true 为 hub-card 内浅色版。
    /// 返回 panel；调用方 AddChild 到目标布局。
    /// </summary>
    public static PanelContainer Chip(string iconPath, string text, string value, bool light = false, int fontSize = 12)
    {
        var panel = new PanelContainer();
        panel.AddThemeStyleboxOverride("panel", Box(light ? new Color("f7f5ef") : ThemeTokens.ResChipBg,
            ThemeTokens.RadiusCrisp, light ? new Color("bcb8aa") : ThemeTokens.ResChipBorder, 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 5);
        margin.AddThemeConstantOverride("margin_bottom", 5);
        panel.AddChild(margin);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 6);
        margin.AddChild(row);
        if (iconPath.Length > 0)
            row.AddChild(Icon(iconPath, fontSize + 2));
        row.AddChild(Label(text, fontSize, light ? new Color("55524a") : ThemeTokens.ResChipText));
        row.AddChild(Label(value, fontSize + 1, light ? new Color("7a5c22") : new Color("e5d4ae")));
        return panel;
    }

    /// <summary>.set-h 分组标题：中文 15px + 底线 1px #68808b66 + 右侧英文角标 10px。</summary>
    public static Control SetHeading(string cn, string en)
    {
        var row = new HBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        row.AddThemeConstantOverride("separation", 8);
        row.AddChild(Heading(cn, 15, new Color("e8eeea"), 3f));
        if (en.Length > 0)
        {
            var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            row.AddChild(spacer);
            row.AddChild(Label(en, 10, new Color("9db4bd")));
        }
        var wrap = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        wrap.AddThemeConstantOverride("separation", 6);
        wrap.AddChild(row);
        wrap.AddChild(new ColorRect { Color = new Color("68808b", 0.4f), CustomMinimumSize = new Vector2(0, 1) });
        return wrap;
    }

    /// <summary>
    /// .chk 勾选行（winter settings-page）：14.5px 字 #ceddde、bg #19344155 边 #48667433 radius 8；
    /// 切换时播 PlaySfx("switch")（接口需求 [7a→B]）。
    /// </summary>
    public static PanelContainer CheckRow(string cn, string en, bool @checked, System.Action<bool> onChanged,
        GameAudio? audio)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", Box(new Color("193441", 0.33f), 8, new Color("486674", 0.2f), 1));
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 8);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 9);
        margin.AddThemeConstantOverride("margin_bottom", 9);
        margin.AddChild(row);
        panel.AddChild(margin);
        var box = new CheckBox { ButtonPressed = @checked, Text = cn };
        box.AddThemeFontSizeOverride("font_size", 14);
        box.AddThemeColorOverride("font_color", new Color("ceddde"));
        box.AddThemeColorOverride("font_hover_color", Colors.White);
        box.AddThemeColorOverride("font_pressed_color", Colors.White);
        box.AddThemeColorOverride("font_hover_pressed_color", Colors.White);
        box.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        row.AddChild(box);
        if (en.Length > 0)
            row.AddChild(Label(en, 10, new Color("9db4bd")));
        box.Toggled += pressed =>
        {
            audio?.PlaySfx("switch");
            onChanged?.Invoke(pressed);
        };
        return panel;
    }

    /// <summary>标题（.pg-head h2：白字 + letter-spacing）。</summary>
    public static Label Heading(string text, float size, Color color, float letterSpacing = 0f)
    {
        var label = new Label { Text = text };
        label.AddThemeFontSizeOverride("font_size", (int)size);
        label.AddThemeColorOverride("font_color", color);
        if (letterSpacing > 0.01f)
            label.AddThemeConstantOverride("spacing_glyph", (int)letterSpacing);
        return label;
    }

    public static Label Label(string text, float size, Color color, bool wrap = false)
    {
        var label = new Label
        {
            Text = text,
            AutowrapMode = wrap ? TextServer.AutowrapMode.WordSmart : TextServer.AutowrapMode.Off
        };
        label.AddThemeFontSizeOverride("font_size", (int)size);
        label.AddThemeColorOverride("font_color", color);
        return label;
    }

    public static TextureRect Icon(string path, int size)
    {
        return new TextureRect
        {
            Texture = GD.Load<Texture2D>(path),
            CustomMinimumSize = new Vector2(size, size),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered
        };
    }
}
