using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// 对局地图屏（网页版对局界面 1:1）：
/// 中央棋盘 = MapBoardCanvas（renderer.js 画布移植，批次 6c-map）；
/// 顶中环层横幅 layerBanner（LayerName 快照接线）+ 左上 topBtns（定位/红退出/静音/目标生命值 HUD）+
/// 右上 resHud（金币/攻击 chips，Atk 快照接线）+ 底部 sidebar（hero/背包/小地图 MiniMapCanvas/
/// 路线选择/骰子面板+体力+近 8 次记录）+ 节点点击后的房间弹层（#overlay .card：场景图 + 行动按钮）。
/// 布局/配色取自 index.html + winter.css #sidebar/#layerBanner/#topBtns/#resHud/#dicePanel。
/// </summary>
public partial class MapScreen : UiScreen
{
    private ICoreUiPort? _core;
    private GameAudio? _audio;
    private RunUiSnapshot? _snapshot;

    private Label _layerZh = null!;
    private Label _layerEn = null!;
    private Label _hpText = null!;
    private Label _coinText = null!;
    private Label _atkText = null!;
    private TextureButton? _muteButton;
    private Label _bagText = null!;
    private Label _staminaText = null!;
    private HBoxContainer _staminaRow = null!;
    private Label _diceHist = null!;
    private DiceFace _diceFace = null!;
    private Button _rollButton = null!;
    private Control _roomLayer = null!;
    private MapBoardCanvas _board = null!;
    private MiniMapCanvas _miniMap = null!;
    private VBoxContainer _boardInfo = null!;

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
        _audio = GetNodeOrNull<GameAudio>("../GameAudio");

        AssetLibrary.Background(this, AssetLibrary.MapBack, 0.9f);
        AssetLibrary.Background(this, AssetLibrary.MapMid, 0.6f);
        AssetLibrary.Background(this, AssetLibrary.MapFront, 0.45f);
        UiTheme.Backdrop(this, new Color("0a1420", 0.35f));

        BuildLayerBanner();
        BuildTopButtons();
        BuildResHud();
        BuildSidebar();
        BuildBoard();
        BuildRoomLayer();
        ParseDemoArgs();
    }

    // ------------------------------------------------------------------
    // 顶栏
    // ------------------------------------------------------------------

    private void BuildLayerBanner()
    {
        var banner = new VBoxContainer();
        banner.AnchorLeft = 0.5f; banner.AnchorRight = 0.5f;
        banner.OffsetLeft = -260; banner.OffsetRight = 260;
        banner.OffsetTop = 20;
        banner.Alignment = BoxContainer.AlignmentMode.Center;
        banner.MouseFilter = Control.MouseFilterEnum.Ignore;
        AddChild(banner);
        _layerZh = WinterUi.Heading("—", 18, Colors.White, 5f);
        _layerZh.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        banner.AddChild(_layerZh);
        _layerEn = WinterUi.Label("", 9, new Color("c0bd9f"));
        _layerEn.AddThemeFontOverride("font", ThemeTokens.Mono);
        _layerEn.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        banner.AddChild(_layerEn);
    }

    private void BuildTopButtons()
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 8);
        row.Position = new Vector2(22, 20);
        AddChild(row);

        // btnLocate：44×44 深蓝（镜头功能挂点，镜头拖拽/缩放归后续交互批次）
        var locate = SquareButton("res://assets/images/ui/icon-locate.svg", new Color("142c38"), new Color("637c89"));
        locate.TooltipText = "镜头回到当前位置（F）";
        locate.Disabled = true;
        row.AddChild(locate);

        // btnHome：朱红渐变 44×44 = 离开对局
        var home = new Button { FocusMode = Control.FocusModeEnum.All };
        home.CustomMinimumSize = new Vector2(44, 44);
        home.AddThemeStyleboxOverride("normal", WinterUi.Box(new Color("701616"), 3));
        home.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("82201b"), 3));
        home.AddThemeStyleboxOverride("pressed", WinterUi.Box(new Color("701616"), 3));
        home.AddThemeStyleboxOverride("focus", WinterUi.Box(new Color("701616"), 3, ThemeTokens.FocusRing, 2));
        home.TooltipText = "离开对局（可保存或放弃） / 回主菜单";
        var homeIcon = WinterUi.Icon("res://assets/images/ui/icon-home.svg", 22);
        homeIcon.MouseFilter = Control.MouseFilterEnum.Ignore;
        home.AddChild(homeIcon);
        home.Pressed += () => Navigate("menu");
        row.AddChild(home);

        // btnMute：44×44 深蓝 = 全局静音
        _muteButton = new TextureButton
        {
            TextureNormal = GD.Load<Texture2D>("res://assets/images/ui/icon-sound-on.svg"),
            IgnoreTextureSize = true,
            StretchMode = TextureButton.StretchModeEnum.KeepAspectCentered,
            CustomMinimumSize = new Vector2(44, 44),
            FocusMode = Control.FocusModeEnum.All,
            TooltipText = "音效 / 背景乐开关"
        };
        var mutePanel = new PanelContainer();
        mutePanel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("142c38"), 3, new Color("637c89"), 1));
        mutePanel.CustomMinimumSize = new Vector2(44, 44);
        mutePanel.AddChild(_muteButton);
        _muteButton.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _muteButton.Pressed += OnToggleMute;
        row.AddChild(mutePanel);

        // hpHud：图标块 + 「目标生命值」标签 + 数值
        var hud = new PanelContainer();
        hud.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        hud.AddThemeStyleboxOverride("panel", WinterUi.Box(ThemeTokens.HpHudBg, 3, ThemeTokens.HpHudBorder, 1));
        var hudRow = new HBoxContainer();
        hudRow.AddThemeConstantOverride("separation", 0);
        hud.AddChild(hudRow);
        var iconBlock = new PanelContainer();
        iconBlock.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("547c90"), 0));
        iconBlock.CustomMinimumSize = new Vector2(24, 0);
        iconBlock.AddChild(WinterUi.Icon("res://assets/images/ui/icon-hp.svg", 14));
        hudRow.AddChild(iconBlock);
        var body = new VBoxContainer();
        body.AddThemeConstantOverride("separation", 1);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 7);
        margin.AddThemeConstantOverride("margin_right", 14);
        margin.AddThemeConstantOverride("margin_top", 3);
        margin.AddThemeConstantOverride("margin_bottom", 3);
        margin.AddChild(body);
        hudRow.AddChild(margin);
        var hpLabel = WinterUi.Label("目标生命值", 9, new Color("f2f2f2"));
        hpLabel.AddThemeConstantOverride("spacing_glyph", 2);
        var labelPanel = new PanelContainer();
        labelPanel.SizeFlagsHorizontal = Control.SizeFlags.ShrinkBegin;
        labelPanel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("547c90"), 2));
        labelPanel.AddChild(hpLabel);
        body.AddChild(labelPanel);
        _hpText = WinterUi.Label("30/30", 14, new Color("4db2ff"));
        _hpText.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        body.AddChild(_hpText);
        row.AddChild(hud);
    }

    private Button SquareButton(string icon, Color bg, Color border)
    {
        var button = new Button { FocusMode = Control.FocusModeEnum.All };
        button.CustomMinimumSize = new Vector2(44, 44);
        button.AddThemeStyleboxOverride("normal", WinterUi.Box(bg, 3, border, 1));
        button.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("1d3d4c"), 3, border, 1));
        button.AddThemeStyleboxOverride("pressed", WinterUi.Box(bg.Darkened(0.1f), 3, border, 1));
        button.AddThemeStyleboxOverride("focus", WinterUi.Box(bg, 3, ThemeTokens.FocusRing, 2));
        var image = WinterUi.Icon(icon, 20);
        image.MouseFilter = Control.MouseFilterEnum.Ignore;
        button.AddChild(image);
        return button;
    }

    private void BuildResHud()
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 6);
        row.AnchorLeft = 1f; row.AnchorRight = 1f;
        row.OffsetLeft = -350; row.OffsetRight = -22;
        row.OffsetTop = 20;
        row.Alignment = BoxContainer.AlignmentMode.End;
        AddChild(row);
        // 金币 / 攻击 chips（#resHud .chip-mini；Atk 接 RunUiSnapshot.Atk，批次 4b 字段）
        _coinText = ResChip("res://assets/images/ui/icon-coin.svg", ThemeTokens.ResGold, row);
        _atkText = ResChip("res://assets/images/ui/icon-swords.svg", ThemeTokens.ResAtk, row);
        _atkText.Text = "—";
    }

    private Label ResChip(string icon, Color valueColor, Container parent)
    {
        var chip = WinterUi.Chip(icon, "", "0");
        chip.AddThemeConstantOverride("separation", 8);
        parent.AddChild(chip);
        var labels = chip.FindChildren("*", "Label", true, false);
        var value = labels.Count > 0 ? (Label)labels[labels.Count - 1] : new Label();
        value.AddThemeColorOverride("font_color", valueColor);
        value.AddThemeFontOverride("font", ThemeTokens.MonoBold);
        value.CustomMinimumSize = new Vector2(42, 0);
        value.HorizontalAlignment = HorizontalAlignment.Right;
        return value;
    }

    // ------------------------------------------------------------------
    // 底部 sidebar（winter：高 118px 渐变 105deg #122a36→#1b3541）
    // ------------------------------------------------------------------

    private void BuildSidebar()
    {
        var sidebar = new PanelContainer();
        sidebar.AnchorTop = 1f; sidebar.AnchorBottom = 1f;
        sidebar.AnchorLeft = 0f; sidebar.AnchorRight = 1f;
        sidebar.OffsetTop = -118;
        sidebar.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("122a36"), 0, new Color("6f8994"), 1));
        AddChild(sidebar);
        // 用渐变贴片覆盖底色（linear-gradient(105deg,#122a36,#1b3541) + 上阴影）
        var shade = WinterUi.Linear(sidebar, new Color("122a36"), new Color("1b3541"), false);
        shade.MouseFilter = Control.MouseFilterEnum.Ignore;

        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 26);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 28);
        margin.AddThemeConstantOverride("margin_right", 28);
        margin.AddThemeConstantOverride("margin_top", 10);
        margin.AddThemeConstantOverride("margin_bottom", 10);
        margin.AddChild(row);
        sidebar.AddChild(margin);

        // charPanel：hero-ava 96×96 + 角色名
        var charPanel = new HBoxContainer { SizeFlagsVertical = Control.SizeFlags.ShrinkCenter };
        charPanel.AddThemeConstantOverride("separation", 10);
        row.AddChild(charPanel);
        _heroAva = new TextureRect
        {
            Texture = GD.Load<Texture2D>(AssetLibrary.CorePortraits[0]),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered,
            CustomMinimumSize = new Vector2(96, 96)
        };
        charPanel.AddChild(_heroAva);

        // bagPanel：背包按钮（b 背包 n/cap）
        var bagButton = new Button { FocusMode = Control.FocusModeEnum.All };
        bagButton.CustomMinimumSize = new Vector2(140, 50);
        bagButton.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        bagButton.AddThemeColorOverride("font_color", new Color("e8e8e8"));
        var bagBox = WinterUi.Box(new Color("2c4652"), 1, new Color("728b91"), 1);
        bagButton.AddThemeStyleboxOverride("normal", bagBox);
        bagButton.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("385a68"), 1, new Color("a9c3c9"), 1));
        bagButton.AddThemeStyleboxOverride("pressed", bagBox);
        bagButton.AddThemeStyleboxOverride("focus", WinterUi.Box(new Color("2c4652"), 1, ThemeTokens.FocusRing, 2));
        var bagColumn = new VBoxContainer();
        bagColumn.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        bagColumn.Alignment = BoxContainer.AlignmentMode.Center;
        bagColumn.AddThemeConstantOverride("separation", 2);
        bagColumn.MouseFilter = Control.MouseFilterEnum.Ignore;
        bagButton.AddChild(bagColumn);
        var bagHead = new HBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter };
        bagHead.AddThemeConstantOverride("separation", 6);
        bagColumn.AddChild(bagHead);
        bagHead.AddChild(WinterUi.Icon("res://assets/images/ui/icon-bag.svg", 18));
        _bagText = WinterUi.Label("背包 0/16", 14, new Color("e8e8e8"));
        bagHead.AddChild(_bagText);
        bagButton.Pressed += () =>
        {
            if (_snapshot != null && _snapshot.Actions.Length > 0) return;
        };
        row.AddChild(bagButton);

        // statsPanel：#miniMap 迷你地图（76px 高、max-width 560px，事件驱动重绘）
        var statsPanel = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        statsPanel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        statsPanel.AddThemeConstantOverride("separation", 4);
        row.AddChild(statsPanel);
        var miniMapPanel = new PanelContainer();
        miniMapPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        miniMapPanel.CustomMinimumSize = new Vector2(0, 76);
        miniMapPanel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("112530"), 1, new Color("425d68"), 1));
        _miniMap = new MiniMapCanvas();
        _miniMap.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _miniMap.OffsetLeft = 3; _miniMap.OffsetRight = -3;
        _miniMap.OffsetTop = 3; _miniMap.OffsetBottom = -3;
        miniMapPanel.AddChild(_miniMap);
        statsPanel.AddChild(miniMapPanel);

        // routePanel：路线选择
        var routePanel = new VBoxContainer { SizeFlagsVertical = Control.SizeFlags.ShrinkCenter };
        routePanel.CustomMinimumSize = new Vector2(230, 0);
        routePanel.AddThemeConstantOverride("separation", 5);
        row.AddChild(routePanel);
        routePanel.AddChild(WinterUi.Heading("路线选择", 13, new Color("f0d28e"), 1f));
        routePanel.AddChild(WinterUi.Label("点击金色亮环的相邻节点继续前进（方向不一定在右侧）", 12, new Color("a9b9c1"), true));

        // dicePanel：rollBtn + diceFace + 体力 + 历史（winter #dicePanel 260px）
        var dicePanel = new VBoxContainer { SizeFlagsVertical = Control.SizeFlags.ShrinkCenter };
        dicePanel.CustomMinimumSize = new Vector2(250, 0);
        dicePanel.AddThemeConstantOverride("separation", 6);
        row.AddChild(dicePanel);
        var diceRow = new HBoxContainer();
        diceRow.AddThemeConstantOverride("separation", 12);
        dicePanel.AddChild(diceRow);
        _rollButton = new Button { Text = "掷骰子移动", FocusMode = Control.FocusModeEnum.All };
        _rollButton.CustomMinimumSize = new Vector2(0, 44);
        _rollButton.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _rollButton.AddThemeFontSizeOverride("font_size", 13);
        _rollButton.AddThemeColorOverride("font_color", new Color("17303e"));
        _rollButton.AddThemeColorOverride("font_hover_color", new Color("17303e"));
        _rollButton.AddThemeColorOverride("font_pressed_color", new Color("17303e"));
        _rollButton.AddThemeStyleboxOverride("normal", WinterUi.Box(ThemeTokens.RollBtnBg, 0));
        _rollButton.AddThemeStyleboxOverride("hover", WinterUi.Box(ThemeTokens.RollBtnHover, 0));
        _rollButton.AddThemeStyleboxOverride("pressed", WinterUi.Box(new Color("c9ad7a"), 0));
        _rollButton.AddThemeStyleboxOverride("focus", WinterUi.Box(ThemeTokens.RollBtnBg, 0, ThemeTokens.FocusRing, 2));
        diceRow.AddChild(_rollButton);
        _diceFace = new DiceFace();
        diceRow.AddChild(_diceFace);
        _rollButton.Pressed += () => _core?.RequestRollDice();

        // diceHist：近 8 次移动/掷点记录 chips（RunUiSnapshot.DiceHistory，ui.js diceHist 同款 9px）
        var historyRow = new HBoxContainer();
        historyRow.AddThemeConstantOverride("separation", 4);
        dicePanel.AddChild(historyRow);
        _diceHist = WinterUi.Label("—", 9, new Color("8da6af"));
        _diceHist.AddThemeFontOverride("font", ThemeTokens.Mono);
        historyRow.AddChild(_diceHist);

        _staminaRow = new HBoxContainer();
        _staminaRow.AddThemeConstantOverride("separation", 5);
        dicePanel.AddChild(_staminaRow);
        _staminaRow.AddChild(WinterUi.Icon("res://assets/images/ui/icon-hourglass.svg", 13));
        _staminaRow.AddChild(WinterUi.Label("体力", 12, new Color("9db4bd")));
        _staminaText = WinterUi.Label("60/60", 12, new Color("e4eeea"));
        _staminaRow.AddChild(_staminaText);
    }

    private TextureRect _heroAva = null!;

    // ------------------------------------------------------------------
    // 中央棋盘（renderer.js 画布移植，6c-map）
    // ------------------------------------------------------------------

    private void BuildBoard()
    {
        var board = new PanelContainer();
        board.AnchorLeft = 0f; board.AnchorRight = 1f;
        board.AnchorTop = 0f; board.AnchorBottom = 1f;
        board.OffsetLeft = 46; board.OffsetRight = -46;
        board.OffsetTop = 92; board.OffsetBottom = -134;
        board.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("152e3b", 0.55f), 8, new Color("9ebac0", 0.25f), 1));
        AddChild(board);
        _board = new MapBoardCanvas();
        _board.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _board.SetIconResolver(AssetLibrary.MapIcon);
        _board.NodeClicked += idx => _core?.RequestRunAction($"move:{idx}");
        _board.HoverChanged += () => _audio?.PlaySfx("hover");
        board.AddChild(_board);
        var margin = new MarginContainer();
        margin.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        margin.AddThemeConstantOverride("margin_left", 18);
        margin.AddThemeConstantOverride("margin_right", 18);
        margin.AddThemeConstantOverride("margin_top", 14);
        margin.AddThemeConstantOverride("margin_bottom", 14);
        margin.MouseFilter = Control.MouseFilterEnum.Ignore;
        _boardInfo = ScreenChrome.Column(margin, 6);
        board.AddChild(margin);
    }

    // ------------------------------------------------------------------
    // 房间弹层（#overlay .card：场景图 + 行动按钮）
    // ------------------------------------------------------------------

    private void BuildRoomLayer()
    {
        _roomLayer = new Control { MouseFilter = Control.MouseFilterEnum.Ignore, Visible = false };
        _roomLayer.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        AddChild(_roomLayer);
    }

    private void ShowRoomPanel(RunActionUiSnapshot[] actions)
    {
        var snapshot = _snapshot!;
        foreach (var child in _roomLayer.GetChildren())
            child.QueueFree();
        _roomLayer.Visible = true;
        _roomLayer.MouseFilter = Control.MouseFilterEnum.Stop;

        var scrim = new ColorRect { Color = ThemeTokens.OverlayScrim };
        scrim.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _roomLayer.AddChild(scrim);

        var center = new CenterContainer();
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        _roomLayer.AddChild(center);

        var card = WinterUi.OverlayCard(center);
        card.CustomMinimumSize = new Vector2(430, 0);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", ThemeTokens.PadPanelX);
        margin.AddThemeConstantOverride("margin_right", ThemeTokens.PadPanelX);
        margin.AddThemeConstantOverride("margin_top", 26);
        margin.AddThemeConstantOverride("margin_bottom", ThemeTokens.PadPanelY);
        card.AddChild(margin);
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 10);
        margin.AddChild(column);

        column.AddChild(WinterUi.Heading(snapshot.CurrentRoom, ThemeTokens.FontHeading, new Color("e8eeea"), 1f));
        var image = AssetLibrary.Thumbnail(column, RoomImage(snapshot.CurrentRoom), new Vector2(0, 150));
        image.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        if (snapshot.StatusText.Length > 0)
            column.AddChild(WinterUi.Label(snapshot.StatusText, 13, new Color("b6c9ce"), true));

        var firstAction = true;
        foreach (var action in actions)
        {
            var button = WinterUi.OvButton(
                string.IsNullOrWhiteSpace(action.Detail) ? action.Label : $"{action.Label}  ·  {action.Detail}",
                firstAction ? "ok" : "", new Vector2(0, 44));
            button.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            button.Disabled = !action.Enabled;
            var actionId = action.Id;
            button.Pressed += () => _core?.RequestRunAction(actionId);
            column.AddChild(button);
            if (firstAction && action.Enabled)
            {
                button.GrabFocus();
                firstAction = false;
            }
        }

        var close = WinterUi.MiniButton("收起 ✕");
        close.SizeFlagsHorizontal = Control.SizeFlags.ShrinkEnd;
        close.Pressed += HideRoomPanel;
        column.AddChild(close);
        PageTransition.CardIn(card);
        _audio?.PlaySfx("open");
        _roomShownForActions = actions.Length;
    }

    private void HideRoomPanel()
    {
        if (!_roomLayer.Visible) return;
        _roomLayer.Visible = false;
        _roomLayer.MouseFilter = Control.MouseFilterEnum.Ignore;
        _audio?.PlaySfx("close");
        _rollButton.GrabFocus();
    }

    private int _roomShownForActions;

    /// <summary>地图自由动作（Ready 阶段直选/整理，不进房间弹层）：move:/roll/ration/安全袋/仓库携带。</summary>
    private static readonly string[] MapFreeActionPrefixes = { "move:", "roll", "ration", "safeadd:", "saferemove:", "load:", "unload:" };

    private static bool IsMapFreeAction(RunActionUiSnapshot action) =>
        MapFreeActionPrefixes.Any(p => action.Id.StartsWith(p, StringComparison.Ordinal));

    private static string RoomImage(string room)
    {
        var key = room.ToLowerInvariant();
        if (key.Contains("商") || key.Contains("shop")) return "res://assets/scenes/scene-shop.webp";
        if (key.Contains("战") || key.Contains("battle")) return "res://assets/scenes/battle-normal.webp";
        if (key.Contains("事件") || key.Contains("event")) return "res://assets/scenes/event-bandits.webp";
        if (key.Contains("门") || key.Contains("door")) return "res://assets/scenes/scene-door.webp";
        if (key.Contains("祭坛") || key.Contains("altar")) return "res://assets/scenes/scene-altar.webp";
        if (key.Contains("营火") || key.Contains("fire")) return "res://assets/scenes/scene-fire.webp";
        return "res://assets/scenes/scene-chest.webp";
    }

    private void OnToggleMute()
    {
        if (_audio == null) return;
        _audio.SetMuted(!_audio.Muted);
        _audio.PlaySfx("switch");
        _muteButton!.TextureNormal = GD.Load<Texture2D>(_audio.Muted
            ? "res://assets/images/ui/icon-sound-off.svg"
            : "res://assets/images/ui/icon-sound-on.svg");
        _muteButton.Modulate = _audio.Muted ? new Color("8b9791") : Colors.White;
    }

    // ------------------------------------------------------------------
    // 快照应用
    // ------------------------------------------------------------------

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        // layerBanner：LayerName 快照（批次 4b「第N层 · 层名」），消掉旧三环硬编码映射
        if (string.IsNullOrEmpty(snapshot.LayerName))
        {
            _layerZh.Text = "—";
            _layerEn.Text = "";
        }
        else
        {
            _layerZh.Text = snapshot.LayerName;
            var sep = snapshot.LayerName.IndexOf('·');
            var tail = sep >= 0 ? snapshot.LayerName[(sep + 1)..].Trim() : snapshot.LayerName;
            _layerEn.Text = $"Layer {snapshot.LayerIndex + 1} · {tail}";
        }
        _hpText.Text = $"{snapshot.CurrentHp}/{snapshot.MaxHp}";
        _coinText.Text = $"{snapshot.Coins}";
        _atkText.Text = snapshot.Atk.ToString();   // resHud 攻击力（rules.json playerAtk，消掉「—」）
        _bagText.Text = $"背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity}";
        // 体力空态（6b 打磨遗留）：无 run 时对齐网页 index.html 缺省「60/60」
        _staminaText.Text = snapshot.MaxStamina > 0
            ? $"{snapshot.Stamina}/{snapshot.MaxStamina}"
            : "60/60";
        var low = snapshot.MaxStamina > 0 && snapshot.Stamina <= 10;
        foreach (var child in _staminaRow.GetChildren())
            if (child is Label label)
                label.AddThemeColorOverride("font_color", low ? new Color("ff7b6b") : label == _staminaText ? new Color("e4eeea") : new Color("9db4bd"));

        if (snapshot.CharacterId.Length > 0)
            _heroAva.Texture = GD.Load<Texture2D>(AssetLibrary.CharacterPortrait(snapshot.CharacterId));

        // 骰子：点数变化时翻面；diceHist = 近 8 次记录 chips（RunUiSnapshot.DiceHistory）
        if (snapshot.LastRoll > 0)
            _diceFace.ShowFace(snapshot.LastRoll);
        _diceHist.Text = snapshot.DiceHistory.Length == 0
            ? "—"
            : string.Join("  ", snapshot.DiceHistory);

        // 中央棋盘 + 小地图（画布渲染，6c-map）
        _board.SetData(snapshot);
        _miniMap.SetData(snapshot);
        _boardInfo.Visible = false;   // 调试信息层退场（网格时代遗留），保留容器供未来查错开关

        // 房间弹层：节点移动/背包整理等地图自由动作由画布点击与侧栏承接，不弹面板
        // （网页 move:idx 直选 / 安全袋·仓库整理走背包页）；落脚后的房间/事件/门/祭坛
        // 行动集仍走 nodeShell 等价弹层。
        var roomActions = snapshot.Actions.Where(a => !IsMapFreeAction(a)).ToArray();
        if (roomActions.Length > 0 && _roomShownForActions != roomActions.Length)
            ShowRoomPanel(roomActions);
        else if (roomActions.Length == 0 && _roomLayer.Visible)
            HideRoomPanel();
        if (roomActions.Length == 0)
        {
            _roomShownForActions = 0;
            if (!_rollButton.HasFocus())
                _rollButton.GrabFocus();
        }

        TickDemoOnSnapshot(snapshot);
    }

    // ------------------------------------------------------------------
    // 验收演示时间线（--map-demo=<pano|select|walk>）：驱动真实 run 供取证帧导出。
    // --map-shot=<path.png> + --map-shot-at=<秒>：在指定时刻抓视口存 PNG 并退出
    // （UiScreen --shot 固定 0.6s，走格子时间线需要更晚的抓帧点）。
    // ------------------------------------------------------------------

    private string? _demoMode;
    private double _demoT;
    private int _demoStage;
    private string? _mapShotPath;
    private double _mapShotAt = 1.2;
    private bool _mapShotDone;

    private void ParseDemoArgs()
    {
        foreach (var arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--map-demo=", StringComparison.Ordinal))
                _demoMode = arg.Substring("--map-demo=".Length);
            else if (arg == "--map-demo")
                _demoMode = "pano";
            else if (arg.StartsWith("--map-shot=", StringComparison.Ordinal))
                _mapShotPath = arg.Substring("--map-shot=".Length);
            else if (arg.StartsWith("--map-shot-at=", StringComparison.Ordinal))
                _mapShotAt = double.TryParse(arg.Substring("--map-shot-at=".Length), out var t) ? t : 1.2;
        }
    }

    public override void _Process(double delta)
    {
        _demoT += delta;
        if (_mapShotPath != null && !_mapShotDone && _demoT >= _mapShotAt)
        {
            _mapShotDone = true;
            var image = GetViewport().GetTexture().GetImage();
            image.SavePng(_mapShotPath);
            GD.Print($"UI_SHOT_SAVED {_mapShotPath}");
            GetTree().Quit();
            return;
        }
        if (_demoMode == null || _snapshot == null) return;
        switch (_demoStage)
        {
            case 0 when _snapshot.Nodes.Length == 0:
                _demoStage = 1;
                _core?.RequestStartRun("dengkui");
                break;
            case 1 when _snapshot.Nodes.Length > 0 && _snapshot.Actions.Any(a => a.Id.StartsWith("move:", StringComparison.Ordinal)):
                _demoStage = 2;
                if (_demoMode == "select")
                {
                    var first = _board.FirstLegalIndex();
                    if (first.HasValue) _board.SetPinnedHover(first.Value);
                }
                else if (_demoMode == "walk")
                {
                    _demoStage = 3;   // 0.35s 后走第一步（等待首帧烘焙完成）
                }
                break;
            case 3 when _demoT >= 0.8:
                _demoStage = 4;
                var target = _board.FirstLegalIndex();
                if (target.HasValue) _core?.RequestRunAction($"move:{target.Value}");
                break;
        }
    }

    private void TickDemoOnSnapshot(RunUiSnapshot snapshot)
    {
        // walk 模式：到达后棋子动画由画布承接；若落点仍有 move 行动则再走一步（多节点路径展示）
        if (_demoMode != "walk" || _demoStage != 4) return;
        if (snapshot.Nodes.Length == 0 || !snapshot.Actions.Any(a => a.Id.StartsWith("move:", StringComparison.Ordinal))) return;
        _demoStage = 5;   // 只走一步，落脚弹层保留展示
    }
}
