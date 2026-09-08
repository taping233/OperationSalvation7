using Godot;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Full-screen expedition map. The map is a spatial canvas rather than a form/grid;
/// the run core still owns all node and action decisions.
public partial class MapScreen : UiScreen
{
    private MapCanvas _map = null!;
    private TextureRect _portrait = null!;
    private Label _layerLabel = null!;
    private Label _status = null!;
    private Label _hp = null!;
    private Label _resources = null!;
    private Label _inventory = null!;
    private HBoxContainer _actions = null!;
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
        AssetLibrary.Background(this, AssetLibrary.Board, 0.72f);
        UiTheme.Backdrop(this, new Color(0.025f, 0.055f, 0.07f, 0.66f));

        _map = new MapCanvas();
        UiTheme.FullRect(_map);
        _map.MouseFilter = Control.MouseFilterEnum.Ignore;
        AddChild(_map);
        UiMotion.Enter(_map);

        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 26);
        margin.AddThemeConstantOverride("margin_right", 26);
        margin.AddThemeConstantOverride("margin_top", 18);
        margin.AddThemeConstantOverride("margin_bottom", 18);
        AddChild(margin);
        var chrome = ScreenChrome.Column(margin, 10);

        var header = ScreenChrome.Row(chrome, 12);
        _layerLabel = UiTheme.Label("外环 · 荒地边缘\nOUTER RING / WASTELAND EDGE", 18, UiTheme.Frost);
        _layerLabel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        header.AddChild(_layerLabel);
        var telemetry = new VBoxContainer { CustomMinimumSize = new Vector2(250, 0) };
        telemetry.AddThemeConstantOverride("separation", 4);
        _status = UiTheme.Label("选择地图节点开始行动", 14, UiTheme.Frost);
        telemetry.AddChild(_status);
        _hp = UiTheme.Label("生命 30 / 30", 14, UiTheme.Muted);
        telemetry.AddChild(_hp);
        _resources = UiTheme.Label("¥0  ·  🔑0  ·  体力 60/60", 14, UiTheme.Muted);
        telemetry.AddChild(_resources);
        header.AddChild(telemetry);
        var home = ScreenChrome.AddNav(header, this, "退出远征", "menu");
        home.CustomMinimumSize = new Vector2(142, 42);

        // Bottom HUD follows the original: character/bag left, action rail and dice right.
        var bottom = new PanelContainer();
        bottom.SizeFlagsVertical = Control.SizeFlags.ShrinkEnd;
        bottom.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.035f, 0.10f, 0.14f, 0.94f), 1, new Color("496873"), 1));
        chrome.AddChild(bottom);
        var bottomMargin = new MarginContainer();
        bottomMargin.AddThemeConstantOverride("margin_left", 16);
        bottomMargin.AddThemeConstantOverride("margin_right", 16);
        bottomMargin.AddThemeConstantOverride("margin_top", 10);
        bottomMargin.AddThemeConstantOverride("margin_bottom", 10);
        bottom.AddChild(bottomMargin);
        var bar = ScreenChrome.Row(bottomMargin, 12);
        _portrait = AssetLibrary.Thumbnail(bar, "res://assets/brand-mark-codename7.png", new Vector2(62, 62));
        var profile = ScreenChrome.Column(bar, 2);
        profile.AddChild(UiTheme.Label("远征者", 16, UiTheme.Frost));
        _inventory = UiTheme.Label("背包 0/16 · 安全仓 0", 12, UiTheme.Muted);
        profile.AddChild(_inventory);
        profile.AddChild(UiTheme.Label("行动 · 价值", 12, UiTheme.Muted));
        _actions = ScreenChrome.Row(bar, 7);
        _actions.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _actions.Alignment = BoxContainer.AlignmentMode.End;
        var dice = UiTheme.Button("掷骰子\nROLL", new Vector2(132, 58));
        dice.AddThemeStyleboxOverride("normal", UiTheme.Box(new Color("DDB876"), 1));
        dice.AddThemeColorOverride("font_color", UiTheme.Ink);
        dice.Pressed += () => _core?.RequestRollDice();
        bar.AddChild(dice);
        var back = ScreenChrome.AddNav(bar, this, "返回准备", "run");
        back.CustomMinimumSize = new Vector2(124, 58);
        dice.GrabFocus();
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        if (_map == null) return;
        var layerName = snapshot.LayerIndex switch { 0 => "外环 · 荒地边缘", 1 => "中环 · 冻结港口", _ => "内环 · 升格祭坛" };
        _layerLabel.Text = $"{layerName}\n{snapshot.LayerIndex + 1:00} / 03  ·  {snapshot.Phase.ToUpperInvariant()}";
        _status.Text = $"{snapshot.CurrentRoom}  ·  {snapshot.StatusText}";
        _hp.Text = $"生命 {snapshot.CurrentHp} / {snapshot.MaxHp}";
        _resources.Text = $"¥{snapshot.Coins}  ·  🔑{snapshot.Keys}  ·  体力 {snapshot.Stamina}/{snapshot.MaxStamina}";
        _inventory.Text = $"背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity}  ·  木材 {snapshot.Wood}  ·  口粮 {snapshot.Rations}";
        var portrait = CharacterPortrait(snapshot.CharacterId);
        if (portrait != null) _portrait.Texture = GD.Load<Texture2D>(portrait);
        _map.SetSnapshot(snapshot);

        foreach (var child in _actions.GetChildren()) child.QueueFree();
        foreach (var action in snapshot.Actions)
        {
            var button = UiTheme.Button(string.IsNullOrWhiteSpace(action.Detail) ? action.Label : $"{action.Label}\n{action.Detail}", new Vector2(132, 58));
            button.Disabled = !action.Enabled;
            var actionId = action.Id;
            button.Pressed += () => _core?.RequestRunAction(actionId);
            _actions.AddChild(button);
            if (action.Enabled) button.GrabFocus();
        }
    }

    private static string? CharacterPortrait(string characterId)
        => AssetLibrary.CharacterHud(characterId);

    private sealed partial class MapCanvas : Control
    {
        private MapNodeUiSnapshot[] _nodes = System.Array.Empty<MapNodeUiSnapshot>();
        private int _layer;
        private readonly System.Collections.Generic.List<Button> _buttons = new();

        public void SetSnapshot(RunUiSnapshot snapshot)
        {
            _layer = snapshot.LayerIndex;
            _nodes = snapshot.Nodes ?? System.Array.Empty<MapNodeUiSnapshot>();
            foreach (var child in _buttons) child.QueueFree();
            _buttons.Clear();
            for (var i = 0; i < _nodes.Length; i++)
            {
                var data = _nodes[i];
                var button = UiTheme.Button(data.IsCurrent ? "▶" : data.IsResolved ? "✓" : "", new Vector2(58, 58));
                button.Icon = GD.Load<Texture2D>(AssetLibrary.MapIcon(data.Type));
                button.ExpandIcon = true;
                button.TooltipText = $"{data.Index + 1:00} · {data.Label}";
                button.Disabled = !data.IsCurrent;
                button.AddThemeFontSizeOverride("font_size", 16);
                button.AddThemeStyleboxOverride("normal", UiTheme.Box(new Color(0.06f, 0.12f, 0.15f, 0.92f), 30, new Color("6B828A"), 1));
                button.AddThemeStyleboxOverride("disabled", UiTheme.Box(new Color(0.035f, 0.07f, 0.09f, 0.74f), 30, new Color("435963"), 1));
                button.AddThemeStyleboxOverride("hover", UiTheme.Box(new Color("A9EFC3"), 30));
                button.Position = NodePosition(i, _nodes.Length, Size);
                AddChild(button);
                _buttons.Add(button);
                if (data.IsCurrent) UiMotion.Pop(button);
            }
            QueueRedraw();
        }

        public override void _Notification(int what)
        {
            if (what == NotificationResized)
            {
                if (_buttons.Count == _nodes.Length)
                    for (var i = 0; i < _buttons.Count; i++) _buttons[i].Position = NodePosition(i, _nodes.Length, Size);
                QueueRedraw();
            }
        }

        private Vector2 NodePosition(int index, int count, Vector2 size)
        {
            if (count == 0) return Vector2.Zero;
            var center = new Vector2(size.X * 0.58f, size.Y * 0.53f);
            var radius = Mathf.Min(size.X * 0.30f, size.Y * 0.34f);
            var angle = -Mathf.Pi / 2f + Mathf.Tau * index / Mathf.Max(1, count);
            return center + new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius) - new Vector2(29, 29);
        }

        public override void _Draw()
        {
            var center = new Vector2(Size.X * 0.58f, Size.Y * 0.53f);
            var radius = Mathf.Min(Size.X * 0.30f, Size.Y * 0.34f);
            for (var ring = 0; ring < 3; ring++)
            {
                var r = radius * (0.57f + ring * 0.22f);
                var active = ring == 2 - _layer;
                DrawArc(center, r, 0, Mathf.Tau, 96, active ? new Color(0.86f, 0.75f, 0.49f, 0.65f) : new Color(0.45f, 0.62f, 0.66f, 0.18f), active ? 2.2f : 1.0f, true);
            }
            if (_nodes.Length < 2) return;
            var points = new Vector2[_nodes.Length];
            for (var i = 0; i < _nodes.Length; i++) points[i] = NodePosition(i, _nodes.Length, Size) + new Vector2(29, 29);
            for (var i = 0; i < points.Length; i++)
                DrawLine(points[i], points[(i + 1) % points.Length], new Color(0.86f, 0.75f, 0.49f, 0.38f), 1.5f, true);
        }
    }
}
