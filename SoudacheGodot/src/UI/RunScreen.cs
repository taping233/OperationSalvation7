using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace SoudacheGodot.UI;

/// <summary>
/// 基地 hub 屏（网页版 game.hub.js renderHub 五页签框架 1:1）：
/// hub-head（← 返回 + 资源 chips）→ hub-tabs 五页签（出发/仓库/升级/人物/成就·收藏室，图标+小字注记）
/// → hub-page 内容区（页签切换播 hubPageIn .3s cubic-bezier(.22,.61,.36,1) translateY 12px）。
/// 出发页 = hubDeployHTML 对应物（选角 + 出征预报 + 出发 + 宝藏大门条，批次 6b 已验收布局）；
/// 仓库/升级/人物三页按 RunBase 快照实数据（StashUsed/StashCapacity、InventoryLabels、upgrade:* 动作）；
/// 成就·收藏室页 = 职业收藏室（批次 6b'' 消费 RunUiSnapshot.Collection：66 张收藏池网格 +
/// 五里程碑领奖 collclaim:{id} + 熟练度转化条）+ 卡背图鉴/成就陈列空态（状态数据未透出，[6b'→A]）；
/// 宠物内容 = 仓库页宠物栏 + 升级页宠物升级行（批次 6b'' 消费 RunUiSnapshot.BasePets，
/// 动作 pet:hatch / pet:sel:{id} / pet:up:{id}，对照 game.hub.js hubPetsHTML/hubUpgradeHTML）。
/// 批次 8 接线：CollectedIds 快照点亮收藏池/仓库 ✦；仓库页卖卡（stash:sell/sellall）与
/// 口袋复原（pocket:restore）按钮文案对齐 bag.js；出征预报 chip 补攻击/宠物实值（对齐 hubDeployHTML）。
/// 录帧/smoke 参数：--ui-hub-tab=deploy|stash|upgrade|classes|ach 直开对应页签。
/// </summary>
public partial class RunScreen : UiScreen
{
    private ICoreUiPort? _core;
    private GameAudio? _audio;
    private RunUiSnapshot? _snapshot;

    private static readonly string[] TabIds = { "deploy", "stash", "upgrade", "classes", "ach" };
    private static readonly (string Id, string Icon, string Name)[] Tabs =
    {
        ("deploy", "res://assets/images/ui/icon-flag.svg", "出发"),
        ("stash", "res://assets/images/ui/icon-home.svg", "仓库"),
        ("upgrade", "res://assets/images/ui/icon-gear.svg", "升级"),
        ("classes", "res://assets/images/ui/icon-medal.svg", "人物"),
        ("ach", "res://assets/images/ui/icon-lib.svg", "成就·收藏室"),
    };

    private string _activeTab = "deploy";
    private Control _pageHost = null!;
    private readonly List<Button> _tabButtons = new();

    // —— 出发页动态件 ——
    private readonly List<Button> _classRows = new();
    private readonly List<PanelContainer> _classPanels = new();
    private Label _forecast = null!;
    private Label _gateKeys = null!;
    private Label _inventory = null!;
    private string _selectedCharacter = "";
    private Button _deployButton = null!;

    // —— 仓库/升级页动态件（页签惰性构建；仓库页与升级页各自持引用，互不覆盖） ——
    private sealed record HeadChips(Label Wood, Label Rations, Label Keys, Label Coins);
    private HeadChips _headChips = null!;
    private sealed record ForecastChips(Label Hp, Label Atk, Label Coins, Label Dice, Label Backpack, Label Pet, Label Safe, Label Stash);
    private ForecastChips _forecastChips = null!;
    private Label _stashNoteLine = null!;
    private Label _stashPageCapLine = null!;
    private Label _bagCapLine = null!;
    private Label _upgradeStashCapLine = null!;
    private ProgressBar _stashPageBar = null!;
    private ProgressBar _upgradeStashBar = null!;
    private ProgressBar _upgradeBagBar = null!;
    private VBoxContainer _stashListHost = null!;
    private VBoxContainer _pocketListHost = null!; // 批次 8：消耗口袋明细行 host（pocket:restore 动作）
    private Button _upgradeBagButton = null!;
    private Button _upgradeStashButton = null!;

    // —— 宠物/收藏室动态件（批次 6b''；仓库页宠物栏 + 升级页宠物升级行，ach 页整体重建） ——
    private Label _petTipLine = null!;        // 「N / 6 只 · 携带 1 只出战」（hubPetsHTML set-tip）
    private VBoxContainer _petListHost = null!;
    private Button _petHatchButton = null!;   // pet:hatch（Enabled=快照 Actions 同名项）
    private Label _petEggHint = null!;
    private Label _petUpTipLine = null!;      // 「口粮 2-3-4-5 · 保护格 N 格」
    private VBoxContainer _petUpHost = null!;

    /// <summary>
    /// 收藏集合（网页 B.isCollected 全量口径）。批次 8：消费 RunUiSnapshot.CollectedIds（8-prep 已落地），
    /// 随快照刷新——收藏池 ✦ 点亮 / ？槽置灰、仓库行 ✦ 同步生效。
    /// </summary>
    private readonly HashSet<string> CollectedIds = new();

    private readonly CodexCatalog _catalog = CodexCatalog.Default;

    public void BindCore(ICoreUiPort core)
    {
        GD.PrintErr($"[dbg] RunScreen.BindCore called, has_snapshot={_snapshot != null}");
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
        BuildTabs(column);
        _pageHost = new Control();
        _pageHost.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        column.AddChild(_pageHost);

        // 录帧/smoke 直开指定页签（--ui-hub-tab=stash 等）；取证滚动偏移（--ui-hub-scroll=<px>，
        // 同 6c-map --map-demo 取证时间线模式：布局稳定后滚到指定位，--write-movie 帧取后段）
        var args = OS.GetCmdlineUserArgs();
        foreach (var arg in args)
        {
            if (arg.StartsWith("--ui-hub-tab=", StringComparison.Ordinal))
                _activeTab = arg.Substring("--ui-hub-tab=".Length);
            else if (arg.StartsWith("--ui-hub-scroll=", StringComparison.Ordinal)
                && int.TryParse(arg.AsSpan("--ui-hub-scroll=".Length), out var px))
                _demoScrollPx = px;
        }

        SelectTab(_activeTab, animate: false);
        GetTree().CreateTimer(1.5).Timeout += () =>
        {
            GD.PrintErr($"[dbg-rect] viewport={GetViewport().GetVisibleRect().Size} content_scale={GetViewport().GetFinalTransform()}");
            GD.PrintErr($"[dbg-rect] deployBtn global={_deployButton.GlobalPosition} size={_deployButton.Size}");
            for (var i = 0; i < _classRows.Count && i < 3; i++)
                if (IsInstanceValid(_classRows[i]))
                    GD.PrintErr($"[dbg-rect] row{i} global={_classRows[i].GlobalPosition} size={_classRows[i].Size}");
        };
    }

    private int _demoScrollPx = -1;   // 取证滚动偏移（<0 = 不滚动）；消费一次后复位
    private int _demoScrollDelay = 10;

    public override void _Process(double delta)
    {
        if (_demoScrollPx < 0) return;
        if (_demoScrollDelay > 0)
        {
            _demoScrollDelay--; // 等快照晚到重建与布局稳定（首帧发布会在 ach/classes 页整体重建）
            return;
        }
        var scroll = _pageHost.GetChildren().OfType<ScrollContainer>().FirstOrDefault();
        if (scroll != null)
            scroll.ScrollVertical = _demoScrollPx; // ScrollContainer 自行裁剪到 max
        _demoScrollPx = -1;
    }

    // hub-head：← 返回 + 资源 chips（res-chip 深色版；网页 game.hub.js:48-58）
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
        var resources = new HBoxContainer();
        resources.AddThemeConstantOverride("separation", 8);
        row.AddChild(resources);
        _headChips = new HeadChips(
            ChipSlot(resources, "icon-wood", "木材"),
            ChipSlot(resources, "icon-bread", "口粮"),
            ChipSlot(resources, "icon-key", "钥匙"),
            ChipSlot(resources, "icon-coin", "储备"));
    }

    private Label ChipSlot(HBoxContainer host, string icon, string caption)
    {
        var chip = WinterUi.Chip($"res://assets/images/ui/{icon}.svg", caption, "0");
        host.AddChild(chip);
        var labels = chip.FindChildren("*", "Label", true, false);
        return labels.Count > 0 ? (Label)labels[labels.Count - 1] : new Label();
    }

    // hub-tabs：五页签等宽（.hub-tab：tab-ico 42×42 圆角 10 + tab-txt 12.5px；on=winter #d7c193/#16323e）
    private void BuildTabs(VBoxContainer parent)
    {
        var tabs = new HBoxContainer();
        tabs.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        tabs.SizeFlagsVertical = Control.SizeFlags.ShrinkBegin;
        tabs.AddThemeConstantOverride("separation", 10);
        parent.AddChild(tabs);
        foreach (var (id, icon, name) in Tabs)
        {
            var tab = new Button { FocusMode = Control.FocusModeEnum.All };
            tab.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            tab.CustomMinimumSize = new Vector2(0, 64);
            var on = id == _activeTab;
            ApplyTabStyle(tab, on);
            var column = new VBoxContainer();
            column.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
            column.Alignment = BoxContainer.AlignmentMode.Center;
            column.AddThemeConstantOverride("separation", 5);
            column.MouseFilter = Control.MouseFilterEnum.Ignore;
            tab.AddChild(column);
            var ring = new PanelContainer();
            ring.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            ring.CustomMinimumSize = new Vector2(42, 42);
            ring.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("16303c"), 10, new Color("4c6a76"), 1));
            column.AddChild(ring);
            var ringInner = new CenterContainer();
            ringInner.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
            ringInner.MouseFilter = Control.MouseFilterEnum.Ignore;
            ring.AddChild(ringInner);
            ringInner.AddChild(WinterUi.Icon(icon, 24));
            var caption = WinterUi.Label(name, 12.5f, on ? ThemeTokens.HubTabOnText : ThemeTokens.HubTabIdle);
            caption.AddThemeConstantOverride("spacing_glyph", 3);
            caption.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
            column.AddChild(caption);
            var tabId = id;
            tab.Pressed += () => SelectTab(tabId);
            _tabButtons.Add(tab);
            tabs.AddChild(tab);
        }
    }

    private void ApplyTabStyle(Button tab, bool on)
    {
        tab.AddThemeColorOverride("font_color", on ? ThemeTokens.HubTabOnText : ThemeTokens.HubTabIdle);
        tab.AddThemeColorOverride("font_hover_color", on ? ThemeTokens.HubTabOnText : new Color("cadcd9"));
        tab.AddThemeStyleboxOverride("normal", WinterUi.Box(on ? ThemeTokens.HubTabOn : new Color("16303c", 0.7f),
            1, on ? ThemeTokens.HubTabOn : new Color("4c6a76", 0.6f), 1));
        tab.AddThemeStyleboxOverride("hover", WinterUi.Box(on ? ThemeTokens.HubTabOn : new Color("1d3d4c", 0.8f),
            1, on ? ThemeTokens.HubTabOn : new Color("607c86"), 1));
        tab.AddThemeStyleboxOverride("pressed", tab.GetThemeStylebox("normal"));
        tab.AddThemeStyleboxOverride("focus", WinterUi.Box(on ? ThemeTokens.HubTabOn : new Color("16303c", 0.7f),
            1, ThemeTokens.FocusRing, 2));
    }

    // 页签切换：重建 hub-page 内容 + hubPageIn（.3s translateY 12px→0，仅切换时播，hub.js:29-31 tabChanged 口径）
    private void SelectTab(string tabId, bool animate = true)
    {
        if (!System.Array.Exists(TabIds, id => id == tabId)) tabId = "deploy";
        var changed = _activeTab != tabId || _pageHost.GetChildCount() == 0;
        _activeTab = tabId;
        for (var i = 0; i < _tabButtons.Count && i < Tabs.Length; i++)
        {
            var on = Tabs[i].Id == tabId;
            ApplyTabStyle(_tabButtons[i], on);
            // 更新页签文字颜色（子节点第 2 个 = caption）
            if (_tabButtons[i].GetChild(0) is VBoxContainer column && column.GetChildCount() > 1 && column.GetChild(1) is Label caption)
                caption.AddThemeColorOverride("font_color", on ? ThemeTokens.HubTabOnText : ThemeTokens.HubTabIdle);
        }
        foreach (var child in _pageHost.GetChildren()) child.QueueFree();

        var scroll = new ScrollContainer();
        scroll.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        scroll.HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled;
        _pageHost.AddChild(scroll);
        var content = new VBoxContainer();
        content.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        content.AddThemeConstantOverride("separation", 16);
        scroll.AddChild(content);

        switch (tabId)
        {
            case "stash": BuildStashPage(content); break;
            case "upgrade": BuildUpgradePage(content); break;
            case "classes": BuildClassesPage(content); break;
            case "ach": BuildAchPage(content); break;
            default: BuildDeployPage(content); break;
        }
        if (animate && changed) PageTransition.HubPageIn(_pageHost);
    }

    // ------------------------------------------------------------------
    // 出发页（hubDeployHTML + 出征预报 + 宝藏大门，批次 6b 已验收布局）
    // ------------------------------------------------------------------

    private void BuildDeployPage(VBoxContainer parent)
    {
        var body = ScreenChrome.Row(parent, 16);
        body.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
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
        _classPanels.Clear();
        _classRows.Clear();
        var roster = CharacterRoster.Entries;
        for (var index = 0; index < roster.Count; index++)
        {
            var entry = roster[index];
            list.AddChild(BuildClassRow(entry, index == 0));
        }
        if (_selectedCharacter.Length == 0 && roster.Count > 0)
            _selectedCharacter = roster[0].Id;

        // —— 右卡：出征预报 + 出发 ——
        var rightCard = WinterUi.HubCard(rightHost, "出征预报", "res://assets/images/ui/icon-flag.svg");
        var chips = new GridContainer { Columns = 2 };
        chips.AddThemeConstantOverride("h_separation", 8);
        chips.AddThemeConstantOverride("v_separation", 8);
        rightCard.AddChild(chips);
        // chip 集与顺序对齐网页 hubDeployHTML deploy-forecast：生命/攻击/开局币/骰子/背包/宠物/保护格/仓库
        _forecastChips = new ForecastChips(
            ForecastChip(chips, "res://assets/images/ui/icon-hp.svg", "生命"),
            ForecastChip(chips, "res://assets/images/ui/icon-swords.svg", "攻击"),
            ForecastChip(chips, "res://assets/images/ui/icon-coin.svg", "开局币"),
            ForecastChip(chips, "res://assets/images/ui/icon-dice.svg", "骰子"),
            ForecastChip(chips, "res://assets/images/ui/icon-bag.svg", "背包"),
            ForecastChip(chips, "res://assets/images/ui/icon-paw.png", "宠物"),
            ForecastChip(chips, "res://assets/images/ui/icon-shield.png", "保护格"),
            ForecastChip(chips, "res://assets/images/ui/icon-key.svg", "仓库"));
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

        BuildGateStrip(parent);

        // 随身物资（对局中=随身背包；局外=基地仓库内容，InventoryLabels 双语义——网页 forecast「仓库」chip 同源）
        var inventoryCard = WinterUi.HubCard(parent, "物资概要", "res://assets/images/ui/icon-bag.svg");
        _inventory = WinterUi.Label("物资为空——出发后携带的物资会显示在这里。", 11.5f, new Color("6b685b"), true);
        inventoryCard.AddChild(_inventory);

        RefreshForecast();
        _deployButton.GrabFocus();
    }

    private Label ForecastChip(GridContainer host, string icon, string caption)
    {
        var chip = WinterUi.Chip(icon, caption, "—", light: true);
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
        panel.AddChild(button);
        button.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        button.Pressed += () =>
        {
            GD.PrintErr($"[dbg] row click {entry.Id}");
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
            if (!IsInstanceValid(_classPanels[index])) continue; // 页签重建后旧面板已释放
            var on = roster[index].Id == id;
            _classPanels[index].AddThemeStyleboxOverride("panel", on
                ? WinterUi.Box(Colors.White, 1, new Color("b8934c"), 1)
                : WinterUi.Box(new Color("f7f5ef"), 1, new Color("c9c5b8"), 1));
        }
        if (_forecastChips != null && IsInstanceValid(_forecastChips.Hp))
            RefreshForecast();
    }

    // 宝藏大门条（网页 gate-strip：钥匙进度 + 特殊关卡说明；KeyNeeded 读快照，[6b→A] 已落地）
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

    // ------------------------------------------------------------------
    // 仓库页（hubStashHTML：卡牌仓库 + 消耗口袋 + 物资）
    // ------------------------------------------------------------------

    private void BuildStashPage(VBoxContainer parent)
    {
        var two = new HBoxContainer();
        two.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        two.AddThemeConstantOverride("separation", 16);
        parent.AddChild(two);
        var leftHost = new VBoxContainer
        {
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
            SizeFlagsStretchRatio = 1.25f
        };
        two.AddChild(leftHost);

        // —— 左卡：卡牌仓库（容量 + bar + stash-list） ——
        var stashCard = WinterUi.HubCard(leftHost, "卡牌仓库", "res://assets/images/ui/icon-home.svg");
        _stashPageCapLine = WinterUi.Label("仓库容量 0 / 0 张", 12.5f, new Color("4a473e"));
        stashCard.AddChild(_stashPageCapLine);
        _stashPageBar = CapacityBar(stashCard, new Color("9bc5c0"));
        _stashListHost = new VBoxContainer();
        _stashListHost.AddThemeConstantOverride("separation", 5);
        stashCard.AddChild(_stashListHost);
        _stashNoteLine = WinterUi.Label("", 11, new Color("8a8677"), true);
        stashCard.AddChild(_stashNoteLine);

        // —— 右列：消耗口袋 + 物资 ——
        var right = new VBoxContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsStretchRatio = 1f };
        two.AddChild(right);
        var pocketCard = WinterUi.HubCard(right, "消耗口袋", "res://assets/images/ui/icon-bag.svg");
        pocketCard.AddChild(WinterUi.Label("对战消耗的卡牌有 1/3 概率随撤离回到这里；用钥匙按稀有度复原：古朴 1 / 稀有 2 / 史诗 3 / 传说 4。下一次出发后口袋清空。",
            11, new Color("6b685b"), true));
        _pocketListHost = new VBoxContainer(); // 批次 8：BasePocket 明细行 + pocket:restore:{name} 复原按钮
        _pocketListHost.AddThemeConstantOverride("separation", 6);
        pocketCard.AddChild(_pocketListHost);
        var materialsCard = WinterUi.HubCard(right, "物资", "res://assets/images/ui/icon-wood.svg");
        var materials = new VBoxContainer();
        materials.AddThemeConstantOverride("separation", 6);
        materialsCard.AddChild(materials);
        materials.AddChild(MaterialRow("icon-wood", "木材", "背包与仓库扩建用 · 不可卖币", () => _snapshot?.BaseWood ?? 0));
        materials.AddChild(MaterialRow("icon-bread", "口粮", "宠物升级用 · 不可卖币", () => _snapshot?.BaseRations ?? 0));
        materials.AddChild(MaterialRow("icon-key", "钥匙", "口袋复原与宝藏大门钥匙", () => _snapshot?.BaseKeyCount ?? 0));

        // —— 宠物栏（game.hub.js hubPetsHTML：批次 6b'' 消费 BasePets；孵化=pet:hatch，携带=pet:sel:{id}） ——
        var petCard = WinterUi.HubCard(parent, "宠物", "res://assets/images/ui/icon-paw.png");
        _petTipLine = WinterUi.Label("", 12, new Color("7a5c22"));
        petCard.AddChild(_petTipLine);
        petCard.AddChild(WinterUi.Label("初始宠物「汪汪狗」自动获得；其余只能用宠物蛋（宝箱 0.7% 掉落）+ 50 币在仓库孵化。宠物在「升级」页用口粮升级，携带不同宠物保护格数量不同。",
            11, new Color("6b685b"), true));
        _petListHost = new VBoxContainer();
        _petListHost.AddThemeConstantOverride("separation", 6);
        petCard.AddChild(_petListHost);
        var hatchRow = new HBoxContainer();
        hatchRow.AddThemeConstantOverride("separation", 10);
        petCard.AddChild(hatchRow);
        _petHatchButton = WinterUi.OvButton("孵化宠物（-1 蛋 -50 币）", "ok", new Vector2(0, 40));
        _petHatchButton.Pressed += () => _core?.RequestBaseAction("pet:hatch");
        hatchRow.AddChild(_petHatchButton);
        _petEggHint = WinterUi.Label("", 11, new Color("6b685b"), true);
        _petEggHint.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _petEggHint.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        hatchRow.AddChild(_petEggHint);

        RefreshStashPage();
        RefreshPocketSection();
        RefreshPetSection();
    }

    private readonly List<(Label Badge, Func<int> Source)> _materialBadges = new(); // 批次 8：随快照刷新（原静态求值恒 ×0）

    private Control MaterialRow(string icon, string caption, string note, System.Func<int> value)
    {
        var row = new PanelContainer();
        row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        row.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("f7f5ef"), 1, new Color("c9c5b8"), 1));
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 12);
        margin.AddThemeConstantOverride("margin_right", 12);
        margin.AddThemeConstantOverride("margin_top", 8);
        margin.AddThemeConstantOverride("margin_bottom", 8);
        row.AddChild(margin);
        var line = new HBoxContainer();
        line.AddThemeConstantOverride("separation", 8);
        margin.AddChild(line);
        line.AddChild(WinterUi.Icon($"res://assets/images/ui/{icon}.svg", 16));
        line.AddChild(WinterUi.Label(caption, 13, new Color("3c3a33")));
        var badge = WinterUi.Label($"× {value()}", 13, new Color("7a5c22"));
        badge.CustomMinimumSize = new Vector2(46, 0);
        line.AddChild(badge);
        _materialBadges.Add((badge, value)); // 快照到达/变化时 RefreshStashPage 统一刷新
        line.AddChild(WinterUi.Label(note, 11, new Color("8a8677")));
        return row;
    }

    /// <summary>
    /// 仓库列表（批次 8：消费 BaseStash 明细行——meta「N费·类型·收购X币/张」+ 收藏态 ✦ +
    /// 卖出按钮 stash:sell:{name}/stash:sellall:{name}，文案对齐 bag.js openStashItem）。
    /// </summary>
    private void RefreshStashPage()
    {
        var snapshot = _snapshot;
        if (_stashListHost == null || !IsInstanceValid(_stashListHost) || snapshot == null) return;
        _materialBadges.RemoveAll(pair => !IsInstanceValid(pair.Badge)); // 页签重建后旧徽章已释放
        foreach (var (badge, source) in _materialBadges) badge.Text = $"× {source()}"; // 物资行实值（批次 8 修静态求值）
        if (_stashPageCapLine != null && IsInstanceValid(_stashPageCapLine))
            _stashPageCapLine.Text = $"仓库容量 {snapshot.StashUsed} / {snapshot.StashCapacity} 张";
        if (_stashPageBar != null && IsInstanceValid(_stashPageBar) && snapshot.StashCapacity > 0)
            _stashPageBar.Value = (double)snapshot.StashUsed / snapshot.StashCapacity;
        foreach (var child in _stashListHost.GetChildren()) child.QueueFree();
        var rows = snapshot.BaseStash;
        if (rows.Length == 0)
        {
            _stashListHost.AddChild(WinterUi.Label("（空——撤离成功后在整理界面把战利品放回这里）", 11.5f, new Color("8a8677")));
        }
        else
        {
            foreach (var row in rows)
            {
                var rowLine = new HBoxContainer();
                rowLine.AddThemeConstantOverride("separation", 8);
                _stashListHost.AddChild(rowLine);
                var collectedMark = WinterUi.Label("✦", 12, new Color("b8934c")); // 收藏态 ✦（批次 8 消费 BaseStash.Collected）
                collectedMark.Visible = row.Collected;
                collectedMark.TooltipText = "已收藏 · 图鉴记录";
                rowLine.AddChild(collectedMark);
                rowLine.AddChild(WinterUi.Label($"{row.Name} ×{row.Count}", 13, new Color("3c3a33")));
                var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                rowLine.AddChild(spacer);
                var meta = row.MaterialKind != null
                    ? "材料 · 可使用 · 不可卖币" // bag.js 材料卡分支：只可折入真实物资，不可卖币
                    : $"{row.Cost}费 · {row.Type} · 收购 {row.SellPrice} 币/张";
                var metaLabel = WinterUi.Label(meta, 11, new Color("8a8677"));
                metaLabel.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                rowLine.AddChild(metaLabel);
                // 卖出按钮（bag.js:624/627 文案）：收藏中受保护禁卖、材料/不可出售卡禁卖、整堆需 ≥2 张
                var sellable = row.Sellable && row.MaterialKind == null && !row.Collected;
                var sellOne = WinterUi.MiniButton($"卖出 1 张（+{row.SellPrice}）", "ok");
                sellOne.Disabled = !sellable;
                sellOne.TooltipText = sellable ? "卖出换储备币" : row.Collected ? "收藏中受保护：取消收藏后才能卖出" : "不可卖出";
                var name = row.Name;
                sellOne.Pressed += () => _core?.RequestBaseAction($"stash:sell:{name}");
                rowLine.AddChild(sellOne);
                var sellAll = WinterUi.MiniButton($"全部卖出（+{row.SellPrice * row.Count} 币）", "ok");
                sellAll.Disabled = !sellable || row.Count < 2;
                sellAll.TooltipText = sellAll.Disabled ? (row.Count < 2 && sellable ? "只有 1 张，无需整堆卖出" : "不可卖出") : "整堆卖出换储备币";
                sellAll.Pressed += () => _core?.RequestBaseAction($"stash:sellall:{name}");
                rowLine.AddChild(sellAll);
            }
        }
        _stashNoteLine.Text = rows.Length > 0
            ? "点击卖出换储备币，或收藏进图鉴（收藏职业卡 +10、能力卡 +50 对应人物熟练度经验；收藏中的卡受保护，取消收藏后才能卖出）。"
            : "仓库里的卡牌可卖出换储备币，或收藏进图鉴。";
    }

    /// <summary>
    /// 消耗口袋明细行刷新（批次 8：消费 BasePocket + pocket:restore:{name}）。
    /// 行=名 ×N · 稀有度 · 复原需钥匙 ×N +「复原 ×N」按钮（文案对齐 bag.js restoreCard：钥匙不足 Disabled；
    /// afford 口径=裸钥匙 BaseKeys，与 Core RestorePocketWithKeys 判定一致，8-prep 注）。
    /// </summary>
    private void RefreshPocketSection()
    {
        var snapshot = _snapshot;
        if (_pocketListHost == null || !IsInstanceValid(_pocketListHost) || snapshot == null) return;
        foreach (var child in _pocketListHost.GetChildren()) child.QueueFree();
        if (snapshot.BasePocket.Length == 0)
        {
            _pocketListHost.AddChild(WinterUi.Label("（空——口袋里的牌会在这里列出）", 11.5f, new Color("8a8677")));
            return;
        }
        foreach (var row in snapshot.BasePocket)
        {
            var rowPanel = new PanelContainer();
            rowPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            rowPanel.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("f7f5ef"), 1, new Color("c9c5b8"), 1));
            var margin = new MarginContainer();
            margin.AddThemeConstantOverride("margin_left", 10);
            margin.AddThemeConstantOverride("margin_right", 10);
            margin.AddThemeConstantOverride("margin_top", 6);
            margin.AddThemeConstantOverride("margin_bottom", 6);
            rowPanel.AddChild(margin);
            var line = new HBoxContainer();
            line.AddThemeConstantOverride("separation", 8);
            margin.AddChild(line);
            line.AddChild(WinterUi.Label($"{row.Name} ×{row.Count}", 13, new Color("3c3a33")));
            var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            line.AddChild(spacer);
            var meta = WinterUi.Label($"{row.Rarity} · 复原需钥匙 ×{row.PocketKeyCost}", 11, new Color("8a8677"));
            meta.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
            line.AddChild(meta);
            var afford = snapshot.BaseKeys >= row.PocketKeyCost;
            var restore = WinterUi.MiniButton($"复原 ×{row.PocketKeyCost}", "ok");
            restore.Disabled = !afford;
            restore.TooltipText = afford ? "消耗钥匙复原到卡牌仓库" : "钥匙不足";
            var name = row.Name;
            restore.Pressed += () => _core?.RequestBaseAction($"pocket:restore:{name}");
            line.AddChild(restore);
            _pocketListHost.AddChild(rowPanel);
        }
    }
    // ------------------------------------------------------------------
    // 升级页（hubUpgradeHTML：背包扩建 + 仓库扩建 + 宠物升级）
    // ------------------------------------------------------------------

    private void BuildUpgradePage(VBoxContainer parent)
    {
        var two = new HBoxContainer();
        two.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        two.AddThemeConstantOverride("separation", 16);
        parent.AddChild(two);
        var leftHost = new VBoxContainer
        {
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
            SizeFlagsStretchRatio = 1f
        };
        two.AddChild(leftHost);
        var rightHost = new VBoxContainer
        {
            SizeFlagsHorizontal = Control.SizeFlags.ExpandFill,
            SizeFlagsStretchRatio = 1f
        };
        two.AddChild(rightHost);

        // —— 背包扩建卡（hubUpgradeHTML:719-725） ——
        var bagCard = WinterUi.HubCard(leftHost, "背包扩建", "res://assets/images/ui/icon-bag.svg");
        _bagCapLine = WinterUi.Label("背包容量 — 格", 12.5f, new Color("4a473e"));
        bagCard.AddChild(_bagCapLine);
        _upgradeBagBar = CapacityBar(bagCard, new Color("d4b582"));
        _upgradeBagButton = WinterUi.OvButton("木材 ×2 扩建 +1 格", "ok", new Vector2(0, 44));
        _upgradeBagButton.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _upgradeBagButton.Pressed += () => _core?.RequestBaseAction("upgrade:bag");
        bagCard.AddChild(_upgradeBagButton);

        // —— 仓库扩建卡（hubUpgradeHTML:726-731） ——
        var stashCard = WinterUi.HubCard(rightHost, "仓库扩建", "res://assets/images/ui/icon-home.svg");
        _upgradeStashCapLine = WinterUi.Label("仓库容量 — 张", 12.5f, new Color("4a473e"));
        stashCard.AddChild(_upgradeStashCapLine);
        _upgradeStashBar = CapacityBar(stashCard, new Color("9bc5c0"));
        _upgradeStashButton = WinterUi.OvButton("木材 ×2 扩建 +5 张", "ok", new Vector2(0, 44));
        _upgradeStashButton.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _upgradeStashButton.Pressed += () => _core?.RequestBaseAction("upgrade:stash");
        stashCard.AddChild(_upgradeStashButton);

        // —— 宠物升级卡（game.hub.js hubUpgradeHTML 宠物段：批次 6b'' 消费 BasePets；升级=pet:up:{id}） ——
        var petCard = WinterUi.HubCard(parent, "宠物升级", "res://assets/images/ui/icon-bread.svg");
        _petUpTipLine = WinterUi.Label("", 12, new Color("7a5c22"));
        petCard.AddChild(_petUpTipLine);
        petCard.AddChild(WinterUi.Label("每只宠物的升级进度相互独立（Lv.1 起每级 +1 保护格）；携带不同宠物，保护格数量不同——小企鹅咕嘎可到 4-8 格。在仓库页切换携带的宠物。",
            11, new Color("6b685b"), true));
        _petUpHost = new VBoxContainer();
        _petUpHost.AddThemeConstantOverride("separation", 6);
        petCard.AddChild(_petUpHost);

        RefreshUpgradePage();
        RefreshPetUpgradeSection();
    }

    private void RefreshUpgradePage()
    {
        var snapshot = _snapshot;
        if (_bagCapLine == null || !IsInstanceValid(_bagCapLine) || snapshot == null) return;
        var bagCapacity = ResolveCapacity(snapshot, "upgrade:bag", snapshot.BackpackCapacity);
        _bagCapLine.Text = $"背包容量 {bagCapacity} 格";
        if (_upgradeStashCapLine != null && IsInstanceValid(_upgradeStashCapLine))
            _upgradeStashCapLine.Text = $"仓库容量 {snapshot.StashCapacity} 张";
        _upgradeBagButton.Disabled = !IsActionEnabled(snapshot, "upgrade:bag");
        _upgradeStashButton.Disabled = !IsActionEnabled(snapshot, "upgrade:stash");
    }

    private static int ResolveCapacity(RunUiSnapshot snapshot, string actionId, int fallback)
    {
        foreach (var action in snapshot.Actions)
            if (action.Id == actionId)
            {
                var match = Regex.Match(action.Detail, @"(\d+)\s*/\s*(\d+)");
                if (match.Success) return int.Parse(match.Groups[1].Value);
            }
        return fallback;
    }

    private static bool IsActionEnabled(RunUiSnapshot snapshot, string actionId)
    {
        foreach (var action in snapshot.Actions)
            if (action.Id == actionId)
                return action.Enabled;
        return false;
    }

    // ------------------------------------------------------------------
    // 人物页（hubClassesHTML：人物熟练度；熟练度数据=[6b'→A]，本批列真实人物名册）
    // ------------------------------------------------------------------

    private void BuildClassesPage(VBoxContainer parent)
    {
        var card = WinterUi.HubCard(parent, "人物熟练度", "res://assets/images/ui/icon-medal.svg");
        card.AddChild(WinterUi.Label("每局出发时从全部人物中自由选择 1 个；击败敌人、撤离成功都会累积所选人物的熟练度经验，升级获得常驻加成（下一局出征生效）；收藏职业卡 +10 / 能力卡 +50 也转化为对应人物经验。",
            11.5f, new Color("6b685b"), true));
        var list = new VBoxContainer();
        list.AddThemeConstantOverride("separation", 9);
        card.AddChild(list);
        // 熟练度实数据（批次 5 Collection.Classes，cls=五职业名；人物 rulesetId 同名匹配）
        var progressByCls = new Dictionary<string, ClassProgressUiSnapshot>(StringComparer.Ordinal);
        foreach (var progress in _snapshot?.Collection?.Classes ?? System.Array.Empty<ClassProgressUiSnapshot>())
            progressByCls[progress.Cls] = progress;
        foreach (var entry in CharacterRoster.Entries)
        {
            // 批次 8：改写为可空安全形式（原 has?progress.Lv 三处 CS8602 警告，6b'' 遗留）
            var progress = progressByCls.TryGetValue(entry.RulesetId, out var found) ? found : null;
            var lv = progress?.Lv ?? 1;
            var maxed = progress?.Maxed == true;
            var ratio = progress is { XpForNext: > 0 } ? (double)progress.Xp / progress.XpForNext : 0;
            var row = new HBoxContainer();
            row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            row.AddThemeConstantOverride("separation", 12);
            list.AddChild(row);
            var art = new PanelContainer();
            art.CustomMinimumSize = new Vector2(52, 52);
            art.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("202324"), 10, new Color("4c6a76"), 1));
            row.AddChild(art);
            var portrait = new TextureRect
            {
                Texture = GD.Load<Texture2D>(AssetLibrary.CharacterPortrait(entry.Id)),
                ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
                StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered
            };
            art.AddChild(portrait);
            var info = new VBoxContainer();
            info.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            info.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
            info.AddThemeConstantOverride("separation", 3);
            row.AddChild(info);
            var nameRow = new HBoxContainer();
            nameRow.AddThemeConstantOverride("separation", 8);
            info.AddChild(nameRow);
            nameRow.AddChild(WinterUi.Heading(entry.Name, 15, new Color("3c3a33"), 1f));
            nameRow.AddChild(WinterUi.Label(maxed ? $"Lv.{lv} · MAX" : $"Lv.{lv}", 12, new Color("e0a458")));
            info.AddChild(WinterUi.Label($"熟练加成随撤离累积（出征时生效） · 定位 {entry.Role}", 11, new Color("8a8677")));
            var xpBar = CapacityBar(info, new Color("6a6a6a"));
            xpBar.Value = Math.Clamp(ratio, 0, 1);
            info.AddChild(WinterUi.Label(maxed ? "已满级" : $"经验 {progress?.Xp ?? 0} / {progress?.XpForNext ?? 0}", 10, new Color("8a8677")));
        }
    }

    // ------------------------------------------------------------------
    // 成就·收藏室页（game.hub.js hubAchHTML/collRoomHTML：批次 6b'' 消费 RunUiSnapshot.Collection）：
    // 职业收藏室 = 收藏池 66 张网格（五职业 ×（职业稀有度 ∪ 能力卡），✦=已收藏）+ 五里程碑领奖
    // （collclaim:{id} 走 RequestBaseAction）+ 熟练度转化条（职业卡 +10 / 能力卡 +50）；
    // 卡背图鉴/成就陈列的解锁·领取状态集合未透出快照 → 空态置灰（接口需求 [6b'→A] 8，归 A 线补）。
    // ------------------------------------------------------------------

    private void BuildAchPage(VBoxContainer parent)
    {
        var collection = _snapshot?.Collection;
        var pool = CollectPool();
        var progress = collection?.Progress ?? 0;
        var total = collection?.Total ?? pool.Count;

        // —— 职业收藏室（collRoomHTML） ——
        var card = WinterUi.HubCard(parent, "职业收藏室", "res://assets/images/ui/icon-lib.svg");
        var tipRow = new HBoxContainer();
        tipRow.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        card.AddChild(tipRow);
        var tipSpacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        tipRow.AddChild(tipSpacer);
        tipRow.AddChild(WinterUi.Label($"收藏进度 {progress} / {total}", 12, new Color("7a5c22")));
        card.AddChild(WinterUi.Label(
            "收藏的职业卡与能力卡会陈列在这里（收藏只做记录并转化为对应人物的经验，卡牌保留在仓库），每收藏一张职业卡为对应人物 +10 点经验、能力卡 +50 点（同一张只计一次）。收藏不同的职业卡与能力卡推进进度，阶段目标各有一次奖励。",
            11, new Color("6b685b"), true));
        var overall = CapacityBar(card, new Color("b8934c"));
        if (total > 0) overall.Value = Math.Clamp((double)progress / total, 0, 1);

        // 五里程碑（coll-ms：达成→领取按钮；已领→✓ 已领取；未达→进度 N/need）
        var msList = new VBoxContainer();
        msList.AddThemeConstantOverride("separation", 6);
        card.AddChild(msList);
        foreach (var ms in collection?.Milestones ?? System.Array.Empty<CollectionMilestoneUiSnapshot>())
        {
            var reached = ms.Reached && !ms.Claimed;
            var row = new PanelContainer();
            row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            row.AddThemeStyleboxOverride("panel", WinterUi.Box(
                reached ? new Color("f3ead6") : new Color("f7f5ef"), 8,
                reached ? new Color("b8934c", 0.6f) : new Color("c9c5b8"), 1));
            if (ms.Claimed) row.Modulate = new Color(1, 1, 1, 0.72f); // .coll-ms.done opacity .72
            var margin = new MarginContainer();
            margin.AddThemeConstantOverride("margin_left", 12);
            margin.AddThemeConstantOverride("margin_right", 12);
            margin.AddThemeConstantOverride("margin_top", 7);
            margin.AddThemeConstantOverride("margin_bottom", 7);
            row.AddChild(margin);
            var line = new HBoxContainer();
            line.AddThemeConstantOverride("separation", 10);
            margin.AddChild(line);
            line.AddChild(WinterUi.Label($"收藏 {ms.Need} 张", 12.5f, new Color("3c3a33")));
            var reward = WinterUi.Label(ms.Reward, 11.5f, new Color("6b685b"));
            reward.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            line.AddChild(reward);
            if (ms.Claimed)
                line.AddChild(WinterUi.Label("✓ 已领取", 11.5f, new Color("3f8f5f")));
            else if (ms.Reached)
            {
                var claim = WinterUi.MiniButton("领取", "ok");
                var msId = ms.Id;
                claim.Pressed += () => _core?.RequestBaseAction($"collclaim:{msId}");
                line.AddChild(claim);
            }
            else
                line.AddChild(WinterUi.Label($"{progress} / {ms.Need}", 11.5f, new Color("8a8677")));
            msList.AddChild(row);
        }

        // 熟练度转化条（+10/+50 语义；Collection.Classes 实数据，meta.js classSummary 口径）
        card.AddChild(WinterUi.Label("熟练度转化 · 收藏职业卡 +10 / 能力卡 +50 经验（同一张只计一次）",
            11.5f, new Color("8a8677"), true));
        var classGrid = new GridContainer { Columns = 5 };
        classGrid.AddThemeConstantOverride("h_separation", 12);
        classGrid.AddThemeConstantOverride("v_separation", 8);
        classGrid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        card.AddChild(classGrid);
        foreach (var cls in collection?.Classes ?? System.Array.Empty<ClassProgressUiSnapshot>())
            classGrid.AddChild(ClassXpCell(cls));

        // 收藏池分组陈列（66 张，组序=Collection.Classes=五职业；槽位 ✦=已收藏 / ？=未收藏置灰）
        var classOrder = (collection?.Classes.Select(c => c.Cls) ?? Enumerable.Empty<string>()).ToList();
        if (classOrder.Count == 0)
            classOrder = pool.Select(c => c.Cls).Distinct().ToList();
        foreach (var cls in classOrder)
        {
            var cards = pool.Where(c => c.Cls == cls).ToList();
            if (cards.Count == 0) continue;
            var gotN = cards.Count(c => CollectedIds.Contains(c.Id));
            var head = new HBoxContainer();
            head.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            head.AddThemeConstantOverride("separation", 10);
            card.AddChild(head);
            head.AddChild(WinterUi.Heading(ClassName(cls), 13.5f, new Color("3c3a33"), 2f));
            head.AddChild(WinterUi.Label($"{gotN} / {cards.Count} 张 · 收藏职业卡 +10 经验 · 能力卡 +50 经验",
                11, new Color("8a8677")));
            var grid = new GridContainer { Columns = 13 };
            grid.AddThemeConstantOverride("h_separation", 8);
            grid.AddThemeConstantOverride("v_separation", 8);
            grid.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            card.AddChild(grid);
            foreach (var cardDef in cards)
                grid.AddChild(CollectedIds.Contains(cardDef.Id) ? CollectedSlot(cardDef) : EmptySlot());
        }

        // —— 卡背图鉴 / 成就陈列：解锁·领取状态未透出，空态置灰（接口需求 [6b'→A] 8） ——
        var backsCard = WinterUi.HubCard(parent, "卡背图鉴", "res://assets/images/ui/icon-book.svg");
        backsCard.AddChild(WinterUi.Label(
            "卡背随成就领取解锁（默认卡背恒可用）——解锁与装备状态的数据链路接入后在此陈列。",
            11.5f, new Color("8a8677"), true));
        var achCard = WinterUi.HubCard(parent, "成就", "res://assets/images/ui/icon-medal.svg");
        achCard.AddChild(WinterUi.Label(
            "成就陈列（达成条件 / 木材口粮 / 卡背奖励 / 领取）待解锁与领取状态的快照字段透出后接入。",
            11.5f, new Color("8a8677"), true));
    }

    /// <summary>收藏池（meta.js isCollectible/collectPool）：cls∈五职业 且（稀有度=职业 ∪ 类型=能力卡）。</summary>
    private List<CodexCatalog.CodexCard> CollectPool()
    {
        var classes = new HashSet<string>();
        foreach (var cls in _snapshot?.Collection?.Classes ?? System.Array.Empty<ClassProgressUiSnapshot>())
            classes.Add(cls.Cls);
        return _catalog.Cards
            .Where(c => c.Cls.Length > 0 && (classes.Count == 0 || classes.Contains(c.Cls))
                && (c.Rarity == "职业" || c.Type == "能力卡"))
            .ToList();
    }

    /// <summary>职业名（rulesetId=五职业名 → characters.json 人物名，同 coll-group-head characterName）。</summary>
    private static string ClassName(string cls)
    {
        foreach (var entry in CharacterRoster.Entries)
            if (entry.RulesetId == cls)
                return entry.Name;
        return cls;
    }

    /// <summary>熟练度转化单元：人物名 + Lv + xp 条 + 经验文案（hubClassesHTML xp-bar 同构）。</summary>
    private Control ClassXpCell(ClassProgressUiSnapshot cls)
    {
        var cell = new VBoxContainer();
        cell.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        cell.AddThemeConstantOverride("separation", 3);
        var head = new HBoxContainer();
        head.AddThemeConstantOverride("separation", 6);
        cell.AddChild(head);
        head.AddChild(WinterUi.Label(ClassName(cls.Cls), 12, new Color("3c3a33")));
        head.AddChild(WinterUi.Label(cls.Maxed ? $"Lv.{cls.Lv} · MAX" : $"Lv.{cls.Lv}", 11, new Color("e0a458")));
        var bar = CapacityBar(cell, new Color("6a6a6a"));
        bar.Value = cls.Maxed ? 1 : cls.XpForNext > 0 ? Math.Clamp((double)cls.Xp / cls.XpForNext, 0, 1) : 0;
        cell.AddChild(WinterUi.Label(cls.Maxed ? "已满级" : $"经验 {cls.Xp} / {cls.XpForNext}", 10, new Color("8a8677")));
        return cell;
    }

    /// <summary>.coll-slot.on：小卡面 + 右上 ✦（收藏态点亮；集合快照到位后生效）。</summary>
    private Control CollectedSlot(CodexCatalog.CodexCard card)
    {
        var cell = new Control { CustomMinimumSize = new Vector2(90, 126) };
        var face = CardFace.Create(_catalog, card, CardFace.FaceMode.Lib, 9);
        face.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        cell.AddChild(face);
        var mark = WinterUi.Label("✦", 13, new Color("b8934c"));
        mark.Position = new Vector2(3, 2);
        cell.AddChild(mark);
        cell.TooltipText = $"{card.Name} · 已收藏";
        return cell;
    }

    /// <summary>.coll-slot.off：82×114 "？" 斜纹暗格的浅色等价（90×126 虚位）。</summary>
    private Control EmptySlot()
    {
        var slot = new PanelContainer { CustomMinimumSize = new Vector2(90, 126) };
        slot.AddThemeStyleboxOverride("panel", WinterUi.Box(new Color("e6e2d7"), 9, new Color("c9c5b8"), 1));
        var center = new CenterContainer();
        center.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        center.MouseFilter = Control.MouseFilterEnum.Ignore;
        slot.AddChild(center);
        center.AddChild(WinterUi.Label("？", 22, new Color("b5b0a3")));
        slot.TooltipText = "未收藏 · 收藏职业卡/能力卡后点亮";
        return slot;
    }

    // ------------------------------------------------------------------
    // 宠物（game.hub.js hubPetsHTML / hubUpgradeHTML：批次 6b'' 消费 RunUiSnapshot.BasePets）
    // ------------------------------------------------------------------

    /// <summary>仓库页宠物栏刷新：N/6 tip + 六行（未孵化锁定态 / 携带中琥珀态 / 携带按钮）+ 孵化按钮。</summary>
    private void RefreshPetSection()
    {
        var snapshot = _snapshot;
        if (_petListHost == null || !IsInstanceValid(_petListHost) || snapshot == null) return;
        var pets = snapshot.BasePets;
        _petTipLine.Text = $"{pets.Count(p => p.Owned)} / {pets.Length} 只 · 携带 1 只出战";
        foreach (var child in _petListHost.GetChildren()) child.QueueFree();
        foreach (var pet in pets)
            _petListHost.AddChild(PetRow(pet));
        var hatchEnabled = IsActionEnabled(snapshot, "pet:hatch");
        _petHatchButton.Disabled = !hatchEnabled;
        _petEggHint.Text = hatchEnabled
            ? "仓库里有宠物蛋——点击孵化，随机获得 1 只未拥有的宠物！"
            : $"孵化需要宠物蛋 ×1 + 50 币（当前储备 {snapshot.BaseCoins} 币；蛋由宝箱 0.7% 掉落）";
    }

    /// <summary>.pk-row.pet-row（浅色版）：未孵化=锁定灰、携带中=琥珀 on 态、已拥有未携带=携带按钮。</summary>
    private Control PetRow(PetUiSnapshot pet)
    {
        var row = new PanelContainer();
        row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        var carried = pet.Owned && pet.Carried;
        row.AddThemeStyleboxOverride("panel", WinterUi.Box(
            carried ? new Color("ffca5b", 0.1f) : new Color("f7f5ef"), 8,
            carried ? new Color("ffca5b", 0.55f) : new Color("c9c5b8"), 1));
        if (!pet.Owned) row.Modulate = new Color(1, 1, 1, 0.55f); // .pet-row.locked opacity .55
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 10);
        margin.AddThemeConstantOverride("margin_right", 10);
        margin.AddThemeConstantOverride("margin_top", 6);
        margin.AddThemeConstantOverride("margin_bottom", 6);
        row.AddChild(margin);
        var column = new VBoxContainer();
        column.AddThemeConstantOverride("separation", 2);
        margin.AddChild(column);
        var line = new HBoxContainer();
        line.AddThemeConstantOverride("separation", 8);
        column.AddChild(line);
        line.AddChild(WinterUi.Icon("res://assets/images/ui/icon-paw.png", 15));
        if (pet.Owned)
        {
            line.AddChild(WinterUi.Label(pet.Name, 13, new Color("3c3a33")));
            line.AddChild(WinterUi.Label($"Lv.{pet.Level}", 11.5f, new Color("8a8677")));
            var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            line.AddChild(spacer);
            if (pet.Carried)
                line.AddChild(WinterUi.Label("✓ 携带中", 12, new Color("3f8f5f")));
            else
            {
                var carry = WinterUi.MiniButton("携带", "ok");
                carry.Disabled = !pet.CanCarry;
                var id = pet.Id;
                carry.Pressed += () => _core?.RequestBaseAction($"pet:sel:{id}");
                line.AddChild(carry);
            }
            column.AddChild(WinterUi.Label(pet.Desc.Replace("携带效果：", ""), 11, new Color("8a8677")));
        }
        else
        {
            line.AddChild(WinterUi.Label("？？？ · 未孵化", 13, new Color("3c3a33")));
            var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            line.AddChild(spacer);
            line.AddChild(WinterUi.Label("宠物蛋 + 50 币孵化", 11.5f, new Color("8a8677")));
        }
        return row;
    }

    /// <summary>升级页宠物升级行刷新：六行 Lv/口粮升级按钮（未孵化锁定行 → 引导去仓库页）。</summary>
    private void RefreshPetUpgradeSection()
    {
        var snapshot = _snapshot;
        if (_petUpHost == null || !IsInstanceValid(_petUpHost) || snapshot == null) return;
        _petUpTipLine.Text = $"口粮 2-3-4-5 · 携带中的宠物决定保护格 {snapshot.SafeCapacity} 格";
        foreach (var child in _petUpHost.GetChildren()) child.QueueFree();
        foreach (var pet in snapshot.BasePets)
        {
            var row = new PanelContainer();
            row.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            var carried = pet.Owned && pet.Carried;
            row.AddThemeStyleboxOverride("panel", WinterUi.Box(
                carried ? new Color("ffca5b", 0.1f) : new Color("f7f5ef"), 8,
                carried ? new Color("ffca5b", 0.55f) : new Color("c9c5b8"), 1));
            if (!pet.Owned) row.Modulate = new Color(1, 1, 1, 0.55f);
            var margin = new MarginContainer();
            margin.AddThemeConstantOverride("margin_left", 10);
            margin.AddThemeConstantOverride("margin_right", 10);
            margin.AddThemeConstantOverride("margin_top", 6);
            margin.AddThemeConstantOverride("margin_bottom", 6);
            row.AddChild(margin);
            var line = new HBoxContainer();
            line.AddThemeConstantOverride("separation", 8);
            margin.AddChild(line);
            line.AddChild(WinterUi.Icon("res://assets/images/ui/icon-paw.png", 15));
            if (pet.Owned)
            {
                line.AddChild(WinterUi.Label(pet.Name, 13, new Color("3c3a33")));
                if (carried)
                    line.AddChild(WinterUi.Label("✓ 携带中", 12, new Color("3f8f5f")));
                var desc = WinterUi.Label(pet.Desc.Replace("携带效果：", ""), 11, new Color("8a8677"));
                desc.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                desc.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                desc.ClipText = true;
                line.AddChild(desc);
                var maxed = pet.Level >= pet.LevelMax; // pets.json levelMax=5（批次 8 随快照透出，替代 UI 常量）
                line.AddChild(WinterUi.Label(maxed ? $"Lv.{pet.Level} · MAX" : $"Lv.{pet.Level} → {pet.Level + 1}",
                    11.5f, new Color("8a8677")));
                var up = WinterUi.MiniButton(maxed ? "已满级" : $"口粮 ×{pet.UpgradeCost} 升级", "ok");
                up.Disabled = !pet.CanUpgrade;
                up.TooltipText = maxed ? "已满级" : $"消耗口粮 ×{pet.UpgradeCost} 升级";
                var id = pet.Id;
                up.Pressed += () => _core?.RequestBaseAction($"pet:up:{id}");
                line.AddChild(up);
            }
            else
            {
                line.AddChild(WinterUi.Label("？？？ · 未孵化（宠物蛋 + 50 币，仓库页）", 13, new Color("3c3a33")));
                var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                line.AddChild(spacer);
                line.AddChild(WinterUi.Label($"Lv.? / {pet.LevelMax}", 11.5f, new Color("8a8677")));
            }
            _petUpHost.AddChild(row);
        }
    }

    private static ProgressBar CapacityBar(Control parent, Color fillColor)
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
        var fill = new StyleBoxFlat { BgColor = fillColor };
        fill.SetCornerRadiusAll(4);
        bar.AddThemeStyleboxOverride("background", background);
        bar.AddThemeStyleboxOverride("fill", fill);
        parent.AddChild(bar);
        return bar;
    }

    // ------------------------------------------------------------------

    private void OnDeployPressed()
    {
        GD.PrintErr($"[dbg] OnDeployPressed sel={_selectedCharacter} core={_core != null} snapChar={_snapshot?.CharacterId} nodes={_snapshot?.Nodes.Length}");
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
        CollectedIds.Clear();
        foreach (var id in snapshot.CollectedIds) CollectedIds.Add(id); // 批次 8：图鉴/收藏室 ✦ 数据源
        _headChips.Wood.Text = $"{snapshot.BaseWood}";
        _headChips.Rations.Text = $"{snapshot.BaseRations}";
        _headChips.Keys.Text = $"{snapshot.BaseKeys}";
        _headChips.Coins.Text = $"{snapshot.BaseCoins} 币";

        // 出发页动态件仅在出发页签构建（页签惰性布局），其余页签激活时跳过
        if (_gateKeys != null && IsInstanceValid(_gateKeys))
            _gateKeys.Text = snapshot.BaseKeys >= snapshot.KeyNeeded
                ? $"钥匙 {snapshot.BaseKeys}/{snapshot.KeyNeeded} · 钥匙已集齐——特殊关卡制作中"
                : $"钥匙 {snapshot.BaseKeys}/{snapshot.KeyNeeded} · 集齐钥匙开启特殊关卡";

        if (_selectedCharacter.Length == 0 && snapshot.CharacterId.Length > 0)
            SelectCharacter(snapshot.CharacterId);
        if (_forecastChips != null && IsInstanceValid(_forecastChips.Hp))
            RefreshForecast();

        if (_inventory != null && IsInstanceValid(_inventory))
            _inventory.Text = snapshot.InventoryLabels.Length == 0
                ? "物资为空——出发后携带的物资会显示在这里。"
                : $"{(snapshot.CharacterId.Length > 0 && snapshot.Nodes.Length > 0 ? "随身" : "仓库")}：{string.Join("  ·  ", snapshot.InventoryLabels)}";

        // 各页动态件按需刷新（页签惰性构建，null 即未构建）
        RefreshStashPage();
        RefreshPocketSection();
        RefreshUpgradePage();
        RefreshPetSection();
        RefreshPetUpgradeSection();
        if (_activeTab == "classes")
            SelectTab("classes", animate: false); // 熟练度实数据（批次 5 Collection）晚于首帧到达，重建人物页
        if (_activeTab == "ach")
            SelectTab("ach", animate: false); // 收藏室进度/里程碑/收藏池与宠物态到达后重建（同 classes 口径）
    }

    private void RefreshForecast()
    {
        var snapshot = _snapshot;
        if (snapshot == null) return;
        var hasRun = snapshot.CharacterId.Length > 0 && snapshot.Nodes.Length > 0;
        _forecastChips.Hp.Text = snapshot.MaxHp > 0 ? $"{snapshot.CurrentHp}/{snapshot.MaxHp}" : "30";
        _forecastChips.Atk.Text = $"{snapshot.Atk}"; // rules.json playerAtk（快照默认值 4，无局路径同值）
        _forecastChips.Coins.Text = $"{snapshot.BaseCoins}";
        _forecastChips.Dice.Text = "6 面";
        // 背包实值：对局中=随身背包容量，局外=基地背包（8-prep BaseBagCapacity）
        _forecastChips.Backpack.Text = $"{(hasRun ? snapshot.BackpackCapacity : snapshot.BaseBagCapacity)} 格";
        // 宠物/保护格实值（批次 8）：携带宠物名=BasePets.Carried 派生、保护格=SafeCapacity（随携带宠物等级）
        var carried = System.Array.Find(snapshot.BasePets, pet => pet.Carried);
        _forecastChips.Pet.Text = carried?.Name ?? "无";
        _forecastChips.Pet.TooltipText = carried?.Desc ?? "未携带宠物";
        _forecastChips.Safe.Text = $"{snapshot.SafeCapacity} 格";
        _forecastChips.Stash.Text = $"{snapshot.StashUsed}/{snapshot.StashCapacity} 张";
        var rosterId = _selectedCharacter.Length > 0 ? _selectedCharacter : snapshot.CharacterId;
        var name = rosterId.Length > 0 ? CharacterRoster.DisplayName(rosterId) : "未选择";
        _forecast.Text = hasRun
            ? $"远征进行中 · {name} · 第 {snapshot.LayerIndex + 1} 层 {snapshot.TrackPosition + 1}/{Math.Max(1, snapshot.TrackLength)}——点「出 发」回到对局。"
            : $"{name} · 出发后随机空降到外圈入口；储备币将随身带走。";
        _deployButton.Text = hasRun ? "回 到 对 局" : "出 发";
    }
}
