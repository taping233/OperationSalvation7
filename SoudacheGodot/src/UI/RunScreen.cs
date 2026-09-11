using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace SoudacheGodot.UI;

/// <summary>
/// 基地 hub 屏（网页版 game.hub.js renderHub 五页签框架 1:1）：
/// hub-head（← 返回 + 资源 chips）→ hub-tabs 五页签（出发/仓库/升级/人物/成就·收藏室，图标+小字注记）
/// → hub-page 内容区（页签切换播 hubPageIn .3s cubic-bezier(.22,.61,.36,1) translateY 12px）。
/// 出发页 = hubDeployHTML 对应物（选角 + 出征预报 + 出发 + 宝藏大门条，批次 6b 已验收布局）；
/// 仓库/升级/人物三页按 RunBase 快照实数据（StashUsed/StashCapacity、InventoryLabels、upgrade:* 动作）；
/// 成就·收藏室页为页签框架空态（数据消费待批次 5 快照，需求清单见 PROGRESS 接口需求 [6b'→A]）。
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
    private sealed record ForecastChips(Label Hp, Label Coins, Label Backpack, Label Safe, Label Stash, Label Pet);
    private ForecastChips _forecastChips = null!;
    private Label _stashNoteLine = null!;
    private Label _stashPageCapLine = null!;
    private Label _bagCapLine = null!;
    private Label _upgradeStashCapLine = null!;
    private ProgressBar _stashPageBar = null!;
    private ProgressBar _upgradeStashBar = null!;
    private ProgressBar _upgradeBagBar = null!;
    private VBoxContainer _stashListHost = null!;
    private Button _upgradeBagButton = null!;
    private Button _upgradeStashButton = null!;

    private static readonly Regex StackRegex = new(@"^(?<name>.+?)\s*×(?<n>\d+)$", RegexOptions.Compiled);
    private readonly CodexCatalog _catalog = CodexCatalog.Default;

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
        BuildTabs(column);
        _pageHost = new Control();
        _pageHost.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        column.AddChild(_pageHost);

        // 录帧/smoke 直开指定页签（--ui-hub-tab=stash 等）
        var args = OS.GetCmdlineUserArgs();
        foreach (var arg in args)
            if (arg.StartsWith("--ui-hub-tab=", StringComparison.Ordinal))
                _activeTab = arg.Substring("--ui-hub-tab=".Length);

        SelectTab(_activeTab, animate: false);
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
        pocketCard.AddChild(WinterUi.Label("（空——口袋里的牌会在这里列出）", 11.5f, new Color("8a8677")));
        var materialsCard = WinterUi.HubCard(right, "物资", "res://assets/images/ui/icon-wood.svg");
        var materials = new VBoxContainer();
        materials.AddThemeConstantOverride("separation", 6);
        materialsCard.AddChild(materials);
        materials.AddChild(MaterialRow("icon-wood", "木材", "背包与仓库扩建用 · 不可卖币", () => _snapshot?.BaseWood ?? 0));
        materials.AddChild(MaterialRow("icon-bread", "口粮", "宠物升级用 · 不可卖币", () => _snapshot?.BaseRations ?? 0));
        materials.AddChild(MaterialRow("icon-key", "钥匙", "口袋复原与宝藏大门钥匙", () => _snapshot?.BaseKeys ?? 0));

        RefreshStashPage();
    }

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
        line.AddChild(WinterUi.Label(note, 11, new Color("8a8677")));
        return row;
    }

    /// <summary>仓库列表（InventoryLabels 栈「名 ×N」→ 卡库反查 meta：费用 · 类型 · 收购价；收藏态 ✦ 标记位=[6b'→A]）。</summary>
    private void RefreshStashPage()
    {
        var snapshot = _snapshot;
        if (_stashListHost == null || !IsInstanceValid(_stashListHost) || snapshot == null) return;
        if (_stashPageCapLine != null && IsInstanceValid(_stashPageCapLine))
            _stashPageCapLine.Text = $"仓库容量 {snapshot.StashUsed} / {snapshot.StashCapacity} 张";
        if (_stashPageBar != null && IsInstanceValid(_stashPageBar) && snapshot.StashCapacity > 0)
            _stashPageBar.Value = (double)snapshot.StashUsed / snapshot.StashCapacity;
        foreach (var child in _stashListHost.GetChildren()) child.QueueFree();
        if (snapshot.InventoryLabels.Length == 0)
        {
            _stashListHost.AddChild(WinterUi.Label("（空——撤离成功后在整理界面把战利品放回这里）", 11.5f, new Color("8a8677")));
        }
        else
        {
            foreach (var label in snapshot.InventoryLabels)
            {
                var match = StackRegex.Match(label);
                var name = match.Success ? match.Groups["name"].Value : label;
                var count = match.Success && int.TryParse(match.Groups["n"].Value, out var parsed) ? parsed : 1;
                var card = _catalog.ByName(name);
                var meta = card != null
                    ? $"{card.Cost}费 · {card.Type} · 收购 {_catalog.SellPrice(card)} 币/张"
                    : "基地物资";
                var rowLine = new HBoxContainer();
                rowLine.AddThemeConstantOverride("separation", 8);
                _stashListHost.AddChild(rowLine);
                var collectedMark = WinterUi.Label("✦", 12, new Color("b8934c")); // 收藏态标记位（[6b'→A] 收藏集合就绪后按卡点亮）
                collectedMark.Visible = false;
                rowLine.AddChild(collectedMark);
                rowLine.AddChild(WinterUi.Label($"{name} ×{count}", 13, new Color("3c3a33")));
                var spacer = new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
                rowLine.AddChild(spacer);
                rowLine.AddChild(WinterUi.Label(meta, 11, new Color("8a8677")));
            }
        }
        _stashNoteLine.Text = snapshot.InventoryLabels.Length > 0
            ? "卖出 / 收藏操作将随收藏室系统开放后在此页提供。"
            : "仓库里的卡牌可卖出换储备币，或收藏进图鉴。";
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

        // —— 宠物升级卡（批次 5 数据接入前的说明态） ——
        var petCard = WinterUi.HubCard(parent, "宠物升级", "res://assets/images/ui/icon-bread.svg");
        petCard.AddChild(WinterUi.Label("每只宠物独立升级（口粮消耗递增 2-3-4-5，上限 Lv.5），Lv.1 起每级 +1 保护格；携带不同宠物，保护格数量不同。",
            11.5f, new Color("6b685b"), true));
        petCard.AddChild(WinterUi.Label("（孵化宠物后，可升级的宠物会在这里列出——仓库页宠物蛋 + 50 币孵化）", 11.5f, new Color("8a8677")));

        RefreshUpgradePage();
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
            var has = progressByCls.TryGetValue(entry.RulesetId, out var progress);
            var lv = has ? progress.Lv : 1;
            var maxed = has && progress.Maxed;
            var ratio = has && progress.XpForNext > 0 ? (double)progress.Xp / progress.XpForNext : 0;
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
    // 成就·收藏室页（页签框架空态；数据消费待批次 5 快照，[6b'→A] 清单见 PROGRESS）
    // ------------------------------------------------------------------

    private void BuildAchPage(VBoxContainer parent)
    {
        var card = WinterUi.HubCard(parent, "成就与职业收藏室", "res://assets/images/ui/icon-lib.svg");
        card.AddChild(WinterUi.Label("卡背图鉴、成就陈列与职业收藏室（收藏职业卡 +10 / 能力卡 +50 熟练度经验，5/15/30/45/全收集里程碑奖励）将陈列在此。",
            12, new Color("6b685b"), true));
        var empty = WinterUi.Label("收藏档案为空——收藏第一批职业卡后，这里会开始点亮。", 13, new Color("8a8677"));
        empty.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        card.AddChild(empty);
        var note = WinterUi.Label("成就进度与收藏陈列的数据链路随收藏室系统一并接入。", 11.5f, new Color("8a8677"), true);
        card.AddChild(note);
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
        RefreshUpgradePage();
        if (_activeTab == "classes")
            SelectTab("classes", animate: false); // 熟练度实数据（批次 5 Collection）晚于首帧到达，重建人物页
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
