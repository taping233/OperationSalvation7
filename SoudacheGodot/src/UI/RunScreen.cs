using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// <summary>
/// 远征准备 + 基地概要屏，1:1 对齐网页版基地 hub（game.hub.js renderHub/hubDeployHTML）的
/// 出发页布局：hub-head（← 返回 + 资源 chips）→ deploy-grid（选角 / 出征预报 + 出发）→
/// 宝藏大门条 → 基地概要（容量条 + 扩建 + 随身背包）。hub 五页签完整版留 6b'。
/// 角色数据读 data/characters.json（接口需求 [1→B] 过渡口径）。
/// </summary>
public partial class RunScreen : UiScreen
{
    private ICoreUiPort? _core;
    private GameAudio? _audio;
    private RunUiSnapshot? _snapshot;

    private readonly List<Button> _classRows = new();
    private readonly List<PanelContainer> _classPanels = new();
    private Label _forecast = null!;
    private Label _backpackLine = null!;
    private Label _inventory = null!;
    private ProgressBar? _backpackBar;
    private ProgressBar? _stashBar;
    private string _selectedCharacter = "";
    private Button _deployButton = null!;

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

        // #depMain / #hubMain 背景：hub 壁纸 + 深色渐变（winter.css）
        AssetLibrary.Background(this, "res://assets/images/hub-wallpaper.webp", 1f);
        WinterUi.Linear(this, new Color("09121a", 0.66f), new Color("09121a", 0.8f), true);

        var page = new MarginContainer();
        UiTheme.FullRect(page);
        page.AddThemeConstantOverride("margin_left", 30);
        page.AddThemeConstantOverride("margin_right", 30);
        page.AddThemeConstantOverride("margin_top", 22);
        page.AddThemeConstantOverride("margin_bottom", 26);
        AddChild(page);

        var column = ScreenChrome.Column(page, 14);
        column.SizeFlagsVertical = Control.SizeFlags.ExpandFill;

        BuildHead(column);
        var body = ScreenChrome.Row(column, 16);
        body.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        BuildDeployGrid(body);
        BuildGateStrip(column);
        BuildBaseSummary(column);
        PageTransition.HubPageIn(column);
        _deployButton.GrabFocus();
    }

    private void BuildHead(VBoxContainer parent)
    {
        var head = new PanelContainer();
        head.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        head.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("0a141c", 0.55f), 10, new Color("68808b", 0.33f), 1));
        parent.AddChild(head);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 16);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 12);
        margin.AddThemeConstantOverride("margin_bottom", 12);
        head.AddChild(margin);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 14);
        margin.AddChild(row);

        var back = WinterUi.OvButton("← 返回", "", new Vector2(110, 36));
        back.AddThemeFontSizeOverride("font_size", 13);
        back.Pressed += () => Navigate("menu");
        row.AddChild(back);
        var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        row.AddChild(spacer);
        // hub-res：基地资源 chips（.res-chip 深色版）
        var resources = new HBoxContainer();
        resources.AddThemeConstantOverride("separation", 8);
        row.AddChild(resources);
        _headChips = new HeadChips(
            ChipSlot(resources, "icon-wood", "木材"),
            ChipSlot(resources, "icon-bread", "口粮"),
            ChipSlot(resources, "icon-key", "钥匙"),
            ChipSlot(resources, "icon-coin", "储备"));
    }

    private sealed record HeadChips(Label Wood, Label Rations, Label Keys, Label Coins);

    private HeadChips _headChips = null!;

    private Label ChipSlot(HBoxContainer host, string icon, string caption)
    {
        var chip = WinterUi.Chip($"res://assets/images/ui/{icon}.svg", caption, "0");
        host.AddChild(chip);
        var labels = chip.FindChildren("*", "Label", true, false);
        return labels.Count > 0 ? (Label)labels[labels.Count - 1] : new Label();
    }

    private void BuildDeployGrid(HBoxContainer body)
    {
        // deploy-grid：1.25fr / 1fr
        var leftHost = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsStretchRatio = 1.25f };
        body.AddChild(leftHost);
        var rightHost = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsStretchRatio = 1f };
        body.AddChild(rightHost);

        // —— 左卡：选择远征角色（hub-card 浅色 + cls-list） ——
        var leftCard = WinterUi.HubCard(leftHost, "选择远征角色", "res://assets/images/ui/icon-swords.svg");
        leftCard.AddChild(WinterUi.Label("出发后从全部人物中选择 1 个本局人物；撤离成功会累积熟练度。", 11.5f, new Color("6b685b"), true));
        var list = new VBoxContainer();
        list.AddThemeConstantOverride("separation", 9);
        leftCard.AddChild(list);
        var roster = CharacterRoster.Entries;
        for (var index = 0; index < roster.Count; index++)
        {
            var entry = roster[index];
            var row = BuildClassRow(entry, index == 0);
            list.AddChild(row);
        }
        if (_selectedCharacter.Length == 0 && roster.Count > 0)
            _selectedCharacter = roster[0].Id;

        // —— 右卡：出征预报 + 出发 ——
        var rightCard = WinterUi.HubCard(rightHost, "出征预报", "res://assets/images/ui/icon-flag.svg");
        var chips = new GridContainer { Columns = 2 };
        chips.AddThemeConstantOverride("h_separation", 8);
        chips.AddThemeConstantOverride("v_separation", 8);
        rightCard.AddChild(chips);
        _forecastChips = new ForecastChips(
            ForecastChip(chips, "icon-hp", "生命"),
            ForecastChip(chips, "icon-coin", "开局币"),
            ForecastChip(chips, "icon-bag", "背包"),
            ForecastChip(chips, "icon-shield", "保护格"),
            ForecastChip(chips, "icon-key", "仓库"),
            ForecastChip(chips, "icon-dice", "骰子"));
        _forecast = WinterUi.Label("选择人物后出发，空降外圈入口。", 12, new Color("6b685b"), true);
        rightCard.AddChild(_forecast);

        var foot = new HBoxContainer();
        foot.AddThemeConstantOverride("separation", 14);
        rightCard.AddChild(foot);
        _deployButton = new Button { Text = "出 发", FocusMode = Control.FocusModeEnum.All };
        _deployButton.CustomMinimumSize = new Vector2(0, 58);
        _deployButton.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _deployButton.AddThemeFontSizeOverride("font_size", 18);
        _deployButton.AddThemeConstantOverride("spacing_glyph", 5);
        _deployButton.AddThemeColorOverride("font_color", ThemeTokens.DeployText);
        _deployButton.AddThemeColorOverride("font_hover_color", ThemeTokens.DeployText);
        _deployButton.AddThemeColorOverride("font_pressed_color", ThemeTokens.DeployText);
        var deployBox = WinterUi.Box(ThemeTokens.DeployBg, 0, new Color(0, 0, 0, 0), 0);
        _deployButton.AddThemeStyleboxOverride("normal", deployBox);
        _deployButton.AddThemeStyleboxOverride("hover", WinterUi.Box(new Color("edd49f"), 0, new Color(0, 0, 0, 0), 0));
        _deployButton.AddThemeStyleboxOverride("pressed", WinterUi.Box(new Color("c9ad7a"), 0, new Color(0, 0, 0, 0), 0));
        _deployButton.AddThemeStyleboxOverride("focus", WinterUi.Box(ThemeTokens.DeployBg, 0, ThemeTokens.FocusRing, 2));
        _deployButton.Pressed += OnDeployPressed;
        foot.AddChild(_deployButton);
    }

    private sealed record ForecastChips(Label Hp, Label Coins, Label Backpack, Label Safe, Label Stash, Label Pet);

    private ForecastChips _forecastChips = null!;

    private Label ForecastChip(GridContainer host, string icon, string caption)
    {
        var chip = WinterUi.Chip($"res://assets/images/ui/{icon}.svg", caption, "—", light: true);
        host.AddChild(chip);
        var labels = chip.FindChildren("*", "Label", true, false);
        return labels.Count > 0 ? (Label)labels[labels.Count - 1] : new Label();
    }

    /// <summary>.cls-card 行（浅色 on 态：边 #b8934c + inset 3px 左条）。</summary>
    private PanelContainer BuildClassRow(CharacterRoster.Entry entry, bool selected)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", selected
            ? WinterUi.Box(Colors.White, 1, new Color("b8934c"), 1)
            : WinterUi.Box(new Color("f7f5ef"), 1, new Color("c9c5b8"), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 13);
        margin.AddThemeConstantOverride("margin_right", 13);
        margin.AddThemeConstantOverride("margin_top", 10);
        margin.AddThemeConstantOverride("margin_bottom", 10);
        panel.AddChild(margin);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 12);
        margin.AddChild(row);

        var portrait = new TextureRect
        {
            Texture = GD.Load<Texture2D>(AssetLibrary.CharacterPortrait(entry.Id)),
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered,
            CustomMinimumSize = new Vector2(40, 40)
        };
        row.AddChild(portrait);
        var info = new VBoxContainer();
        info.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        info.AddThemeConstantOverride("separation", 2);
        row.AddChild(info);
        var nameRow = new HBoxContainer();
        nameRow.AddThemeConstantOverride("separation", 8);
        info.AddChild(nameRow);
        nameRow.AddChild(WinterUi.Heading(entry.Name, 15, new Color("3c3a33"), 1f));
        nameRow.AddChild(WinterUi.Label($"ruleset · {entry.RulesetId}", 11, new Color("8a8677")));
        info.AddChild(WinterUi.Label(entry.Role, 11, new Color("6b685b")));

        if (selected)
        {
            var bar = new ColorRect { Color = new Color("b8934c"), CustomMinimumSize = new Vector2(3, 0) };
            row.AddChild(bar);
        }
        _classPanels.Add(panel);
        var button = new Button { FocusMode = Control.FocusModeEnum.All };
        button.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        button.CustomMinimumSize = new Vector2(0, 64);
        button.AddThemeStyleboxOverride("normal", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("hover", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("pressed", new StyleBoxEmpty());
        button.AddThemeStyleboxOverride("focus", new StyleBoxEmpty());
        // 透明按钮盖在行上承接点击/键盘
        panel.AddChild(button);
        button.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        button.Pressed += () =>
        {
            _audio?.PlaySfx("switch"); // 选择语义开关音（接口需求 [7a→B]）
            SelectCharacter(entry.Id);
        };
        _classRows.Add(button);
        panel.MouseFilter = Control.MouseFilterEnum.Pass;
        return panel;
    }

    private void SelectCharacter(string id)
    {
        _selectedCharacter = id;
        var roster = CharacterRoster.Entries;
        for (var index = 0; index < _classPanels.Count && index < roster.Count; index++)
        {
            var on = roster[index].Id == id;
            _classPanels[index].AddThemeStyleboxOverride("panel", on
                ? WinterUi.Box(Colors.White, 1, new Color("b8934c"), 1)
                : WinterUi.Box(new Color("f7f5ef"), 1, new Color("c9c5b8"), 1));
        }
        RefreshForecast();
    }

    private void BuildGateStrip(VBoxContainer parent)
    {
        var strip = new PanelContainer();
        strip.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        strip.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("213946"), 1, new Color("5e727a"), 1));
        parent.AddChild(strip);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 16);
        margin.AddThemeConstantOverride("margin_right", 16);
        margin.AddThemeConstantOverride("margin_top", 10);
        margin.AddThemeConstantOverride("margin_bottom", 10);
        strip.AddChild(margin);
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 12);
        margin.AddChild(row);
        row.AddChild(WinterUi.Icon("res://assets/images/ui/icon-key.svg", 22));
        var textColumn = new VBoxContainer();
        textColumn.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        textColumn.AddThemeConstantOverride("separation", 2);
        row.AddChild(textColumn);
        textColumn.AddChild(WinterUi.Heading("宝藏大门", 14, new Color("e3e6d8"), 2f));
        _gateKeys = WinterUi.Label("钥匙 0/10 · 集齐钥匙开启特殊关卡", 12, new Color("b3c9ce"));
        textColumn.AddChild(_gateKeys);
    }

    private Label _gateKeys = null!;

    private void BuildBaseSummary(VBoxContainer parent)
    {
        var card = WinterUi.HubCard(parent, "基地概要", "res://assets/images/ui/icon-wood.svg");
        var two = new HBoxContainer();
        two.AddThemeConstantOverride("separation", 16);
        two.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        card.AddChild(two);

        var left = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        left.AddThemeConstantOverride("separation", 6);
        two.AddChild(left);
        _backpackLine = WinterUi.Label("背包 0/16 格", 12.5f, new Color("4a473e"));
        left.AddChild(_backpackLine);
        _backpackBar = CapacityBar(left);
        var safeLine = WinterUi.Label("安全格 0 格 · 宠物护送对局中放入安全格的战利品", 11, new Color("8a8677"), true);
        left.AddChild(safeLine);

        var right = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        right.AddThemeConstantOverride("separation", 6);
        two.AddChild(right);
        _stashLine = WinterUi.Label("仓库 0/40 张", 12.5f, new Color("4a473e"));
        right.AddChild(_stashLine);
        _stashBar = CapacityBar(right);
        var upgradeRow = new HBoxContainer();
        upgradeRow.AddThemeConstantOverride("separation", 8);
        right.AddChild(upgradeRow);
        foreach (var (label, action) in new[]
                 {
                     ("扩建背包", "upgrade:bag"), ("扩充安全格", "upgrade:safe"), ("扩充仓库", "upgrade:stash")
                 })
            AddBaseAction(upgradeRow, label, action);

        _inventory = WinterUi.Label("随身背包为空——出发后携带的物资会显示在这里。", 11.5f, new Color("6b685b"), true);
        card.AddChild(_inventory);
    }

    private static ProgressBar CapacityBar(Control parent)
    {
        var bar = new ProgressBar
        {
            MinValue = 0,
            MaxValue = 1,
            Value = 0,
            ShowPercentage = false,
            CustomMinimumSize = new Vector2(0, 8),
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill
        };
        var background = WinterUi.Box(new Color("d3cfc2"), 4);
        var fill = new StyleBoxFlat { BgColor = new Color("9bc5c0") };
        fill.SetCornerRadiusAll(4);
        bar.AddThemeStyleboxOverride("background", background);
        bar.AddThemeStyleboxOverride("fill", fill);
        parent.AddChild(bar);
        return bar;
    }

    private Label _stashLine = null!;

    private void AddBaseAction(HBoxContainer parent, string label, string actionId)
    {
        var button = WinterUi.MiniButton(label, "ok");
        button.CustomMinimumSize = new Vector2(120, 34);
        button.Pressed += () => _core?.RequestBaseAction(actionId);
        parent.AddChild(button);
    }

    // ------------------------------------------------------------------

    private void OnDeployPressed()
    {
        var snapshot = _snapshot;
        if (snapshot != null && snapshot.CharacterId.Length > 0 && snapshot.Nodes.Length > 0)
        {
            Navigate("map"); // 有进行中的对局：直接回到对局地图
            return;
        }
        if (_selectedCharacter.Length > 0)
            _core?.RequestStartRun(_selectedCharacter);
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        _headChips.Wood.Text = $"{snapshot.BaseWood}";
        _headChips.Rations.Text = $"{snapshot.BaseRations}";
        _headChips.Keys.Text = $"{snapshot.BaseKeys}";
        _headChips.Coins.Text = $"{snapshot.BaseCoins} 币";

        _gateKeys.Text = snapshot.BaseKeys >= 10
            ? $"钥匙 {snapshot.BaseKeys}/10 · 钥匙已集齐——特殊关卡制作中"
            : $"钥匙 {snapshot.BaseKeys}/10 · 集齐钥匙开启特殊关卡";

        if (_selectedCharacter.Length == 0 && snapshot.CharacterId.Length > 0)
            SelectCharacter(snapshot.CharacterId);
        RefreshForecast();

        _backpackLine.Text = $"背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity} 格 · 安全格 {snapshot.SafeCapacity} 格";
        if (_backpackBar != null && snapshot.BackpackCapacity > 0)
            _backpackBar.Value = (double)snapshot.BackpackUsed / snapshot.BackpackCapacity;
        _stashLine.Text = $"仓库 {snapshot.StashUsed}/{snapshot.StashCapacity} 张";
        if (_stashBar != null && snapshot.StashCapacity > 0)
            _stashBar.Value = (double)snapshot.StashUsed / snapshot.StashCapacity;

        _inventory.Text = snapshot.InventoryLabels.Length == 0
            ? "随身背包为空——出发后携带的物资会显示在这里。"
            : $"随身：{string.Join("  ·  ", snapshot.InventoryLabels)}";
    }

    private void RefreshForecast()
    {
        var snapshot = _snapshot;
        if (snapshot == null) return;
        _forecastChips.Hp.Text = snapshot.MaxHp > 0 ? $"{snapshot.CurrentHp}/{snapshot.MaxHp}" : "30";
        _forecastChips.Coins.Text = $"{snapshot.BaseCoins}";
        _forecastChips.Backpack.Text = $"{snapshot.BackpackCapacity} 格";
        _forecastChips.Safe.Text = $"{snapshot.SafeCapacity} 格";
        _forecastChips.Stash.Text = $"{snapshot.StashUsed}/{snapshot.StashCapacity} 张";
        _forecastChips.Pet.Text = "6 面";
        var rosterId = _selectedCharacter.Length > 0 ? _selectedCharacter : snapshot.CharacterId;
        var name = rosterId.Length > 0 ? CharacterRoster.DisplayName(rosterId) : "未选择";
        var hasRun = snapshot.CharacterId.Length > 0 && snapshot.Nodes.Length > 0;
        _forecast.Text = hasRun
            ? $"远征进行中 · {name} · 第 {snapshot.LayerIndex + 1} 层 {snapshot.TrackPosition + 1}/{Math.Max(1, snapshot.TrackLength)}——点「出 发」回到对局。"
            : $"{name} · 出发后随机空降到外圈入口；储备币将随身带走。";
        _deployButton.Text = hasRun ? "回 到 对 局" : "出 发";
    }
}
