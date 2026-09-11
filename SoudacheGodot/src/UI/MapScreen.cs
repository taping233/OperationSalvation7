using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// <summary>
/// 对局地图屏（网页版对局界面框架 1:1，地图画布渲染归 6c）：
/// 顶中环层横幅 layerBanner + 左上 topBtns（定位/红退出/静音/目标生命值 HUD）+
/// 右上 resHud（金币/攻击 chips）+ 底部 sidebar（hero/背包/小地图挂点/路线选择/骰子面板+体力）+
/// 节点点击后的房间弹层（#overlay .card：场景图 + 行动按钮）。
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
    private TextureButton? _muteButton;
    private Label _bagText = null!;
    private Label _staminaText = null!;
    private HBoxContainer _staminaRow = null!;
    private Label _diceHist = null!;
    private DiceFace _diceFace = null!;
    private Button _rollButton = null!;
    private Control _roomLayer = null!;
    private GridContainer _grid = null!;
    private VBoxContainer _boardInfo = null!;
    private int _lastRollSeen;

    private static readonly string[] LayerNames = { "外环", "中环", "内环" };
    private static readonly string[] LayerNamesEn = { "OUTER RING", "MIDDLE RING", "INNER RING" };

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

        // btnLocate：44×44 深蓝（镜头功能挂点，6c 接管）
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
        var gold = ResChip("res://assets/images/ui/icon-coin.svg", ThemeTokens.ResGold);
        _coinText = gold;
        row.AddChild(gold.GetParent() as PanelContainer);
        var atk = ResChip("res://assets/images/ui/icon-swords.svg", ThemeTokens.ResAtk);
        atk.Text = "—";
        row.AddChild(atk.GetParent() as PanelContainer);
    }

    private Label ResChip(string icon, Color valueColor)
    {
        var chip = WinterUi.Chip(icon, "", "0");
        chip.AddThemeConstantOverride("separation", 8);
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

        // statsPanel：小地图挂点（已探明区域简图；画布渲染归 6c）
        var statsPanel = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        statsPanel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        statsPanel.AddThemeConstantOverride("separation", 4);
        row.AddChild(statsPanel);
        var miniMap = new PanelContainer();
        miniMap.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        miniMap.CustomMinimumSize = new Vector2(0, 76);
        miniMap.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("112530"), 1, new Color("425d68"), 1));
        var miniLabel = WinterUi.Label("已探明区域简图", 11, new Color("6f8a94"));
        miniLabel.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        miniLabel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        var miniCenter = new CenterContainer();
        miniCenter.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        miniCenter.AddChild(miniLabel);
        miniMap.AddChild(miniCenter);
        statsPanel.AddChild(miniMap);

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
    // 中央棋盘挂点（节点网格；画布渲染与金色箭头归 6c）
    // ------------------------------------------------------------------

    private void BuildBoard()
    {
        var board = new PanelContainer();
        board.AnchorLeft = 0f; board.AnchorRight = 1f;
        board.OffsetLeft = 46; board.OffsetRight = -46;
        board.OffsetTop = 92; board.OffsetBottom = -134;
        board.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("152e3b", 0.55f), 8, new Color("9ebac0", 0.25f), 1));
        AddChild(board);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 18);
        margin.AddThemeConstantOverride("margin_right", 18);
        margin.AddThemeConstantOverride("margin_top", 14);
        margin.AddThemeConstantOverride("margin_bottom", 14);
        board.AddChild(margin);
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 8);
        margin.AddChild(column);
        _boardInfo = ScreenChrome.Column(column, 6);
        _grid = new GridContainer { Columns = 7 };
        _grid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _grid.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _grid.AddThemeConstantOverride("h_separation", 8);
        _grid.AddThemeConstantOverride("v_separation", 8);
        column.AddChild(_grid);
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

    private void ShowRoomPanel(RunUiSnapshot snapshot)
    {
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
        foreach (var action in snapshot.Actions)
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
        _roomShownForActions = snapshot.Actions.Length;
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
        var layer = Math.Clamp(snapshot.LayerIndex, 0, LayerNames.Length - 1);
        _layerZh.Text = LayerNames[layer];
        _layerEn.Text = LayerNamesEn[layer];
        _hpText.Text = $"{snapshot.CurrentHp}/{snapshot.MaxHp}";
        _coinText.Text = $"{snapshot.Coins}";
        _bagText.Text = $"背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity}";
        _staminaText.Text = $"{snapshot.Stamina}/{snapshot.MaxStamina}";
        var low = snapshot.Stamina <= 10;
        foreach (var child in _staminaRow.GetChildren())
            if (child is Label label)
                label.AddThemeColorOverride("font_color", low ? new Color("ff7b6b") : label == _staminaText ? new Color("e4eeea") : new Color("9db4bd"));

        if (snapshot.CharacterId.Length > 0)
            _heroAva.Texture = GD.Load<Texture2D>(AssetLibrary.CharacterPortrait(snapshot.CharacterId));

        // 骰子：点数变化时翻面 + 历史 chip（最近 8 次由快照 LastRoll 近似展示当次）
        if (snapshot.LastRoll > 0)
        {
            _diceFace.ShowFace(snapshot.LastRoll);
            if (_lastRollSeen != snapshot.LastRoll)
            {
                _diceHist.Text = snapshot.LastRoll.ToString();
                _lastRollSeen = snapshot.LastRoll;
            }
        }

        // 节点网格（画布化归 6c；当前网格为快照节点挂点）
        foreach (var child in _grid.GetChildren())
            child.QueueFree();
        foreach (var child in _boardInfo.GetChildren())
            child.QueueFree();
        _boardInfo.AddChild(WinterUi.Label(
            $"{snapshot.Phase} · {snapshot.CurrentRoom} · {snapshot.StatusText}", 14, new Color("dceae7"), true));
        _boardInfo.AddChild(WinterUi.Label(
            snapshot.InventoryLabels.Length == 0
                ? "背包：空"
                : $"背包：{string.Join("  ·  ", snapshot.InventoryLabels)}", 13, new Color("b2c4c9"), true));
        foreach (var mapNode in snapshot.Nodes)
        {
            var marker = mapNode.IsCurrent ? "▶ " : mapNode.IsResolved ? "✓ " : "";
            var node = UiTheme.Button($"{marker}{mapNode.Index + 1:00}\n{mapNode.Label}", new Vector2(116, 58));
            node.Disabled = !mapNode.IsCurrent;
            node.Icon = GD.Load<Texture2D>(AssetLibrary.MapIcon(mapNode.Type));
            node.ExpandIcon = true;
            node.AddThemeFontSizeOverride("font_size", 14);
            _grid.AddChild(node);
        }

        // 房间弹层：有可执行行动且未展示时弹出（节点点击后的面板）
        if (snapshot.Actions.Length > 0 && _roomShownForActions != snapshot.Actions.Length)
            ShowRoomPanel(snapshot);
        else if (snapshot.Actions.Length == 0 && _roomLayer.Visible)
            HideRoomPanel();
        if (snapshot.Actions.Length == 0)
        {
            _roomShownForActions = 0;
            if (!_rollButton.HasFocus())
                _rollButton.GrabFocus();
        }
    }
}
