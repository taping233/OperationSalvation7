using Godot;

namespace SoudacheGodot.UI;

/// Run preparation placeholder. The Core RunState can later feed this screen through a snapshot.
public partial class RunScreen : UiScreen
{
    protected override void Build()
    {
        UiTheme.Backdrop(this, new Color("0B171E"));
        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 56);
        margin.AddThemeConstantOverride("margin_right", 56);
        margin.AddThemeConstantOverride("margin_top", 42);
        margin.AddThemeConstantOverride("margin_bottom", 42);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 20);
        root.AddChild(UiTheme.Label("远征准备", 32, UiTheme.Frost));
        root.AddChild(UiTheme.Label("RUN PREPARATION  /  PLACEHOLDER", 14, UiTheme.Accent));

        var body = ScreenChrome.Row(root, 20);
        var roster = ScreenChrome.PanelContent(body, "选择远征角色", UiTheme.PanelSurface);
        roster.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        roster.AddChild(UiTheme.Label("五名核心角色概念将在此接入 Core.CharacterTable。", 16, UiTheme.Muted));
        foreach (var name in new[] { "霜翎", "白契", "栗团", "玄砾", "灯葵" })
        {
            var choice = UiTheme.Button(name + "   ·   概念保留", new Vector2(320, 44));
            choice.Pressed += () => GD.Print($"Placeholder character selected: {name}");
            roster.AddChild(choice);
        }

        var brief = ScreenChrome.PanelContent(body, "运行状态", UiTheme.PanelRaised);
        brief.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        ScreenChrome.AddBody(brief, "Seed: —   Layer: —   Track: —");
        ScreenChrome.AddBody(brief, "这里不写入规则或数值；只预留 RunState 快照的显示位。");
        var map = ScreenChrome.AddNav(brief, this, "查看地图", "map");
        map.GrabFocus();
        ScreenChrome.AddNav(brief, this, "直接打开战斗竖切", "battle");

        var footer = ScreenChrome.Row(root, 14);
        ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
    }
}

