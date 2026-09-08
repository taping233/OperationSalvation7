using Godot;

namespace SoudacheGodot.UI;

/// Map placeholder: a responsive node grid that will consume MapModel snapshots later.
public partial class MapScreen : UiScreen
{
    protected override void Build()
    {
        UiTheme.Backdrop(this, new Color("0C1A22"));
        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 46);
        margin.AddThemeConstantOverride("margin_right", 46);
        margin.AddThemeConstantOverride("margin_top", 38);
        margin.AddThemeConstantOverride("margin_bottom", 38);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 16);
        root.AddChild(UiTheme.Label("远征地图", 32, UiTheme.Frost));
        root.AddChild(UiTheme.Label("MAP OVERVIEW  /  SNAPSHOT PLACEHOLDER", 14, UiTheme.Accent));

        var board = ScreenChrome.PanelContent(root, "三环棋盘预览", UiTheme.PanelSurface);
        board.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        board.AddChild(UiTheme.Label("节点布局仅用于验证响应式 UI；实际节点由 Core.MapModel 提供。", 15, UiTheme.Muted));

        var grid = new GridContainer { Columns = 8 };
        grid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        grid.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        grid.AddThemeConstantOverride("h_separation", 8);
        grid.AddThemeConstantOverride("v_separation", 8);
        board.AddChild(grid);

        var labels = new[] { "营地", "战斗", "事件", "商店", "火堆", "宝箱", "战斗", "出口", "木材", "金币", "战斗", "钥匙", "事件", "祭坛", "战斗", "首领" };
        for (var i = 0; i < 32; i++)
        {
            var label = labels[i % labels.Length];
            var node = UiTheme.Button($"{i + 1:00}\n{label}", new Vector2(116, 58));
            node.AddThemeFontSizeOverride("font_size", 14);
            node.Pressed += () => GD.Print($"Placeholder map node selected: {label}");
            grid.AddChild(node);
        }

        var footer = ScreenChrome.Row(root, 14);
        ScreenChrome.AddNav(footer, this, "进入战斗竖切", "battle");
        ScreenChrome.AddNav(footer, this, "返回远征准备", "run");
        var back = ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
        back.GrabFocus();
    }
}

