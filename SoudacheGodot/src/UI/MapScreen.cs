using Godot;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Responsive three-ring run-map view backed by immutable UI snapshots.
public partial class MapScreen : UiScreen
{
    private GridContainer _grid = null!;
    private Label _status = null!;
    private Label _inventory = null!;
    private VBoxContainer _actions = null!;
    private TextureRect _roomImage = null!;
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
        AssetLibrary.Background(this, AssetLibrary.MapBack, 0.42f);
        AssetLibrary.Background(this, AssetLibrary.MapMid, 0.24f);
        AssetLibrary.Background(this, AssetLibrary.MapFront, 0.18f);
        UiTheme.Backdrop(this, new Color(0.04f, 0.10f, 0.13f, 0.76f));
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
        _status = UiTheme.Label("选择地图节点开始行动", 15, UiTheme.Muted);
        board.AddChild(_status);
        _roomImage = AssetLibrary.Thumbnail(board, "res://assets/scenes/scene-chest.webp", new Vector2(0, 86));
        _roomImage.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _inventory = UiTheme.Label("背包：—", 14, UiTheme.Muted);
        board.AddChild(_inventory);

        _actions = ScreenChrome.Column(board, 7);

        _grid = new GridContainer { Columns = 7 };
        _grid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _grid.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _grid.AddThemeConstantOverride("h_separation", 8);
        _grid.AddThemeConstantOverride("v_separation", 8);
        board.AddChild(_grid);

        var footer = ScreenChrome.Row(root, 14);
        ScreenChrome.AddNav(footer, this, "进入战斗", "battle");
        ScreenChrome.AddNav(footer, this, "返回远征准备", "run");
        var back = ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
        back.GrabFocus();
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        if (_grid == null) return;
        _status.Text = $"{snapshot.Phase} · {snapshot.CurrentRoom} · {snapshot.StatusText}";
        _inventory.Text = snapshot.InventoryLabels.Length == 0 ? "背包：空" : $"背包：{string.Join("  ·  ", snapshot.InventoryLabels)}";
        var room = snapshot.CurrentRoom.ToLowerInvariant();
        _roomImage.Texture = GD.Load<Texture2D>(room.Contains("商") || room.Contains("shop") ? "res://assets/scenes/scene-shop.webp" : room.Contains("战") || room.Contains("battle") ? "res://assets/scenes/battle-normal.webp" : room.Contains("事件") || room.Contains("event") ? "res://assets/scenes/event-bandits.webp" : room.Contains("门") || room.Contains("door") ? "res://assets/scenes/scene-door.webp" : room.Contains("祭坛") || room.Contains("altar") ? "res://assets/scenes/scene-altar.webp" : room.Contains("营火") || room.Contains("fire") ? "res://assets/scenes/scene-fire.webp" : "res://assets/scenes/scene-chest.webp");
        foreach (var child in _grid.GetChildren()) child.QueueFree();
        foreach (var child in _actions.GetChildren()) child.QueueFree();
        foreach (var mapNode in snapshot.Nodes)
        {
            var marker = mapNode.IsCurrent ? "▶" : mapNode.IsResolved ? "✓" : "";
            var node = UiTheme.Button($"{marker}{mapNode.Index + 1:00}\n{mapNode.Label}", new Vector2(116, 58));
            node.Disabled = !mapNode.IsCurrent;
            node.Icon = GD.Load<Texture2D>(AssetLibrary.MapIcon(mapNode.Type));
            node.ExpandIcon = true;
            node.AddThemeFontSizeOverride("font_size", 14);
            _grid.AddChild(node);
        }
        var focusedAction = false;
        foreach (var action in snapshot.Actions)
        {
            var button = UiTheme.Button(string.IsNullOrWhiteSpace(action.Detail) ? action.Label : $"{action.Label}  ·  {action.Detail}", new Vector2(0, 42));
            button.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; button.Disabled = !action.Enabled;
            var actionId = action.Id; button.Pressed += () => _core?.RequestRunAction(actionId); _actions.AddChild(button);
            if (!focusedAction && action.Enabled) { button.GrabFocus(); focusedAction = true; }
        }
    }
}
