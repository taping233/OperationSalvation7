using Godot;

namespace SoudacheGodot.UI;

/// Layout helpers shared by screens; all geometry is container-driven for resize safety.
public static class ScreenChrome
{
    public static VBoxContainer Column(Control parent, int separation = 12)
    {
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", separation);
        parent.AddChild(column);
        return column;
    }

    public static HBoxContainer Row(Control parent, int separation = 14)
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", separation);
        row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        parent.AddChild(row);
        return row;
    }

    public static VBoxContainer PanelContent(Control parent, string title, Color? color = null)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(color ?? UiTheme.PanelSurface));
        parent.AddChild(panel);

        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 18);
        margin.AddThemeConstantOverride("margin_right", 18);
        margin.AddThemeConstantOverride("margin_top", 16);
        margin.AddThemeConstantOverride("margin_bottom", 16);
        panel.AddChild(margin);
        var content = Column(margin, 10);
        if (!string.IsNullOrWhiteSpace(title))
            content.AddChild(UiTheme.Label(title, 19, UiTheme.AkMint));
        return content;
    }

    public static Label AddBody(Control parent, string text)
    {
        var label = UiTheme.Label(text, 16, UiTheme.Muted);
        label.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        parent.AddChild(label);
        return label;
    }

    public static Button AddNav(Control parent, UiScreen screen, string text, string destination)
    {
        var button = UiTheme.Button(text, new Vector2(220, 50));
        button.Pressed += () => screen.RequestNavigation(destination);
        parent.AddChild(button);
        return button;
    }
}
