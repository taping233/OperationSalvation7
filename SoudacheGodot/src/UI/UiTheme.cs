using Godot;

namespace SoudacheGodot.UI;

/// Shared local theme factory for the Godot presentation layer.
public static class UiTheme
{
    public static readonly Color Ink = new("101E27");
    public static readonly Color PanelSurface = new("172B35");
    public static readonly Color PanelRaised = new("203C48");
    public static readonly Color AkMint = new("A9EFC3");
    public static readonly Color Frost = new("D9F3F2");
    public static readonly Color Muted = new("91B0B5");
    public static readonly Color Accent = new("E7B86A");
    public static readonly Color Danger = new("D97979");

    public static StyleBoxFlat Box(Color color, int radius = 10, Color? border = null, int borderWidth = 0)
    {
        var box = new StyleBoxFlat { BgColor = color };
        box.CornerRadiusTopLeft = radius;
        box.CornerRadiusTopRight = radius;
        box.CornerRadiusBottomLeft = radius;
        box.CornerRadiusBottomRight = radius;
        if (border.HasValue)
        {
            box.BorderColor = border.Value;
            box.BorderWidthLeft = borderWidth;
            box.BorderWidthRight = borderWidth;
            box.BorderWidthTop = borderWidth;
            box.BorderWidthBottom = borderWidth;
        }
        return box;
    }

    public static PanelContainer Panel(Control parent, string title = "", Color? color = null)
    {
        var panel = new PanelContainer { Name = string.IsNullOrWhiteSpace(title) ? "Panel" : title };
        panel.AddThemeStyleboxOverride("panel", Box(color ?? PanelSurface));
        parent.AddChild(panel);
        if (!string.IsNullOrWhiteSpace(title))
        {
            var margin = new MarginContainer();
            margin.AddThemeConstantOverride("margin_left", 18);
            margin.AddThemeConstantOverride("margin_right", 18);
            margin.AddThemeConstantOverride("margin_top", 14);
            margin.AddThemeConstantOverride("margin_bottom", 14);
            panel.AddChild(margin);
            var column = new VBoxContainer();
            column.AddThemeConstantOverride("separation", 8);
            margin.AddChild(column);
            column.AddChild(Label(title, 18, AkMint));
        }
        return panel;
    }

    public static Label Label(string text, int size = 16, Color? color = null)
    {
        var label = new Label { Text = text, AutowrapMode = TextServer.AutowrapMode.WordSmart };
        label.AddThemeFontSizeOverride("font_size", size);
        label.AddThemeColorOverride("font_color", color ?? Frost);
        return label;
    }

    public static Button Button(string text, Vector2 minSize = default)
    {
        var button = new Button { Text = text, FocusMode = Control.FocusModeEnum.All };
        button.CustomMinimumSize = minSize == default ? new Vector2(220, 52) : minSize;
        button.AddThemeFontSizeOverride("font_size", 17);
        button.AddThemeColorOverride("font_color", Frost);
        button.AddThemeColorOverride("font_hover_color", Ink);
        button.AddThemeStyleboxOverride("normal", Box(PanelRaised, 9, new Color("385C66"), 1));
        button.AddThemeStyleboxOverride("hover", Box(AkMint, 9));
        button.AddThemeStyleboxOverride("pressed", Box(Accent, 9));
        button.AddThemeStyleboxOverride("focus", Box(PanelRaised, 9, AkMint, 2));
        return button;
    }

    public static void FullRect(Control node)
    {
        node.SetAnchorsAndOffsetsPreset(Control.LayoutPreset.FullRect);
    }

    public static ColorRect Backdrop(Control parent, Color color)
    {
        var backdrop = new ColorRect { Color = color, MouseFilter = Control.MouseFilterEnum.Ignore };
        FullRect(backdrop);
        parent.AddChild(backdrop);
        parent.MoveChild(backdrop, 0);
        return backdrop;
    }
}
