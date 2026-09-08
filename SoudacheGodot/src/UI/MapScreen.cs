using Godot;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Responsive three-ring run-map view backed by immutable UI snapshots.
public partial class MapScreen : UiScreen
{
    private GridContainer _grid = null!;
    private Label _status = null!;
    private ICoreUiPort? _core;

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
        _core = core;
        _core.RunSnapshotChanged += ApplySnapshot;
    }

    public override void _ExitTree()
    {
        if (_core != null) _core.RunSnapshotChanged -= ApplySnapshot;
    }

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
        root.AddChild(UiTheme.Label("THREE-RING EXPEDITION MAP", 14, UiTheme.Accent));

        var board = ScreenChrome.PanelContent(root, "三环远征棋盘", UiTheme.PanelSurface);
        board.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _status = UiTheme.Label("等待远征状态", 15, UiTheme.Muted);
        board.AddChild(_status);

        _grid = new GridContainer { Columns = 7 };
        _grid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _grid.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _grid.AddThemeConstantOverride("h_separation", 8);
        _grid.AddThemeConstantOverride("v_separation", 8);
        board.AddChild(_grid);

        var footer = ScreenChrome.Row(root, 14);
        var roll = UiTheme.Button("掷三面骰", new Vector2(180, 48));
        roll.Pressed += () => _core?.RequestRollDice();
        footer.AddChild(roll);
        var resolve = UiTheme.Button("结算当前房间", new Vector2(200, 48));
        resolve.Pressed += () => _core?.RequestResolveRoom();
        footer.AddChild(resolve);
        ScreenChrome.AddNav(footer, this, "进入战斗", "battle");
        ScreenChrome.AddNav(footer, this, "返回远征准备", "run");
        var back = ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
        back.GrabFocus();
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        if (_grid == null) return;
        _status.Text = $"{snapshot.Phase} · {snapshot.CurrentRoom} · {snapshot.StatusText}";
        foreach (var child in _grid.GetChildren()) child.QueueFree();
        foreach (var mapNode in snapshot.Nodes)
        {
            var marker = mapNode.IsCurrent ? "▶" : mapNode.IsResolved ? "✓" : "";
            var node = UiTheme.Button($"{marker}{mapNode.Index + 1:00}\n{mapNode.Label}", new Vector2(116, 58));
            node.Disabled = !mapNode.IsCurrent;
            node.AddThemeFontSizeOverride("font_size", 14);
            _grid.AddChild(node);
        }
    }
}
