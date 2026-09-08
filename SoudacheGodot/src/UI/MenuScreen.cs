using Godot;

namespace SoudacheGodot.UI;

/// Responsive entry screen for the project title and vertical-slice destinations.
public partial class MenuScreen : UiScreen
{
    protected override void Build()
    {
        UiTheme.Backdrop(this, UiTheme.Ink);

        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 64);
        margin.AddThemeConstantOverride("margin_right", 64);
        margin.AddThemeConstantOverride("margin_top", 52);
        margin.AddThemeConstantOverride("margin_bottom", 52);
        AddChild(margin);

        var layout = ScreenChrome.Row(margin, 36);

        var intro = ScreenChrome.Column(layout, 18);
        intro.CustomMinimumSize = new Vector2(560, 0);
        intro.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        intro.AddChild(UiTheme.Label("升格会的的冬日猜想", 38, UiTheme.Frost));
        intro.AddChild(UiTheme.Label("ASCENSION COUNCIL · WINTER REVERIE", 15, UiTheme.Accent));
        intro.AddChild(UiTheme.Label("一场关于远征、选择与归途的桌面冒险。\n当前版本聚焦 UI 与场景组合，规则接口将在 Core 接入后替换占位状态。", 18, UiTheme.Muted));

        var roster = ScreenChrome.PanelContent(intro, "远征名册 · 五名核心角色", UiTheme.PanelSurface);
        ScreenChrome.AddBody(roster, "霜翎   ·   白契   ·   栗团   ·   玄砾   ·   灯葵");
        ScreenChrome.AddBody(roster, "角色概念保持不变；这里仅作为 UI 入口展示。");

        var menuPanel = ScreenChrome.PanelContent(layout, "进入竖切", UiTheme.PanelRaised);
        menuPanel.CustomMinimumSize = new Vector2(360, 0);
        var start = ScreenChrome.AddNav(menuPanel, this, "开始远征", "run");
        ScreenChrome.AddNav(menuPanel, this, "地图占位页", "map");
        ScreenChrome.AddNav(menuPanel, this, "战斗竖切页", "battle");
        ScreenChrome.AddNav(menuPanel, this, "设置（占位）", "settings");
        var quit = UiTheme.Button("退出", new Vector2(220, 50));
        quit.Pressed += () => Navigate("quit");
        menuPanel.AddChild(quit);

        start.GrabFocus();
    }
}

