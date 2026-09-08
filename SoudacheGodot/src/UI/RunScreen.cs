using Godot;
using SoudacheGodot.App;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// Base and expedition hub. The visual hierarchy follows the original hub:
/// resource header, icon-like tabs, a light content card, and an expedition
/// preparation area. Core state remains snapshot-driven.
public partial class RunScreen : UiScreen
{
    private static readonly (string Id, string Name, string Class, string? Art)[] Characters =
    {
        ("shuangling", "无", "侠客", "res://assets/characters/wu/archive.png"),
        ("baiqi", "常无欲", "降临者", "res://assets/characters/chang-wu-yu/archive.png"),
        ("lituan", "白塔", "法师", "res://assets/characters/bai-ta/archive.png"),
        ("xuanli", "待定角色 IV", "战士", null),
        ("dengkui", "待定角色 V", "牧师", null)
    };

    private static readonly (string Id, string Icon, string Name)[] Tabs =
    {
        ("deploy", "⚑", "出发"),
        ("stash", "⌂", "仓库"),
        ("upgrade", "⚒", "升级"),
        ("classes", "✦", "人物"),
        ("ach", "◇", "成就")
    };

    private readonly Dictionary<string, Button> _tabButtons = new(StringComparer.Ordinal);
    private string _activeTab = "deploy";
    private ICoreUiPort? _core;
    private RunUiSnapshot _snapshot = new();
    private VBoxContainer _page = null!;
    private Label _resourceLine = null!;
    private Label _summary = null!;
    private Label _status = null!;
    private Label _baseSummary = null!;
    private Label _inventory = null!;
    private VBoxContainer _actionList = null!;

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
        AssetLibrary.Background(this, AssetLibrary.Hub, 0.82f);
        UiTheme.Backdrop(this, new Color(0.025f, 0.065f, 0.08f, 0.58f));

        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 44);
        margin.AddThemeConstantOverride("margin_right", 44);
        margin.AddThemeConstantOverride("margin_top", 30);
        margin.AddThemeConstantOverride("margin_bottom", 30);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 14);
        var header = ScreenChrome.Row(root, 14);
        var back = UiTheme.Button("←  返回主菜单", new Vector2(172, 48));
        back.Pressed += () => RequestNavigation("menu");
        header.AddChild(back);

        var heading = ScreenChrome.Column(header, 2);
        heading.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        heading.AddChild(UiTheme.Label("基地", 30, UiTheme.Frost));
        heading.AddChild(UiTheme.Label("BASE CAMP  /  EXPEDITION HUB", 11, UiTheme.Muted));

        _resourceLine = UiTheme.Label("木材 0    口粮 0    钥匙 0    储备 0 币", 14, UiTheme.Frost);
        _resourceLine.HorizontalAlignment = HorizontalAlignment.Right;
        _resourceLine.CustomMinimumSize = new Vector2(360, 0);
        header.AddChild(_resourceLine);
        UiMotion.Enter(header);

        var body = ScreenChrome.Row(root, 16);
        var tabPanel = new PanelContainer { CustomMinimumSize = new Vector2(156, 0) };
        tabPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.06f, 0.13f, 0.16f, 0.92f), 2, new Color(0.62f, 0.74f, 0.72f, 0.40f), 1));
        body.AddChild(tabPanel);
        var tabMargin = new MarginContainer();
        tabMargin.AddThemeConstantOverride("margin_left", 10); tabMargin.AddThemeConstantOverride("margin_right", 10);
        tabMargin.AddThemeConstantOverride("margin_top", 16); tabMargin.AddThemeConstantOverride("margin_bottom", 16);
        tabPanel.AddChild(tabMargin);
        var tabColumn = ScreenChrome.Column(tabMargin, 8);
        tabColumn.AddChild(UiTheme.Label("基地终端", 13, UiTheme.Muted));
        foreach (var tab in Tabs)
        {
            var button = UiTheme.Button($"{tab.Icon}  {tab.Name}", new Vector2(130, 54));
            button.Name = $"HubTab_{tab.Id}";
            button.Pressed += () => SelectTab(tab.Id);
            tabColumn.AddChild(button);
            _tabButtons[tab.Id] = button;
        }
        tabColumn.AddChild(new Control { CustomMinimumSize = new Vector2(0, 0), SizeFlagsVertical = Control.SizeFlags.ExpandFill });
        tabColumn.AddChild(UiTheme.Label("WINTER ARCHIVE\nTERMINAL ONLINE", 10, UiTheme.Muted));

        var contentPanel = new PanelContainer();
        contentPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        contentPanel.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        contentPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.90f, 0.89f, 0.85f, 0.97f), 2, new Color(0.75f, 0.70f, 0.58f, 0.8f), 1));
        body.AddChild(contentPanel);
        var contentMargin = new MarginContainer();
        contentMargin.AddThemeConstantOverride("margin_left", 24); contentMargin.AddThemeConstantOverride("margin_right", 24);
        contentMargin.AddThemeConstantOverride("margin_top", 20); contentMargin.AddThemeConstantOverride("margin_bottom", 20);
        contentPanel.AddChild(contentMargin);
        _page = ScreenChrome.Column(contentMargin, 14);

        SelectTab("deploy", false);
    }

    private void SelectTab(string tab, bool animate = true)
    {
        _activeTab = Tabs.Any(item => item.Id == tab) ? tab : "deploy";
        foreach (var item in _tabButtons)
        {
            var active = item.Key == _activeTab;
            item.Value.AddThemeStyleboxOverride("normal", UiTheme.Box(active ? new Color("D8BC86") : new Color(0.08f, 0.18f, 0.21f, 0.74f), 2, active ? new Color("8A6A2F") : new Color("496873"), 1));
            item.Value.AddThemeColorOverride("font_color", active ? UiTheme.Ink : UiTheme.Frost);
        }

        foreach (var child in _page.GetChildren()) child.QueueFree();
        _summary = null!;
        _status = null!;
        _baseSummary = null!;
        _inventory = null!;
        _actionList = null!;
        switch (_activeTab)
        {
            case "stash": BuildStashPage(); break;
            case "upgrade": BuildUpgradePage(); break;
            case "classes": BuildClassesPage(); break;
            case "ach": BuildAchievementsPage(); break;
            default: BuildDeployPage(); break;
        }
        if (animate) UiMotion.Enter(_page);
    }

    private void BuildDeployPage()
    {
        _page.AddChild(UiTheme.Label("出发", 28, new Color("3C3A33")));
        _page.AddChild(UiTheme.Label("选择一名远征者，准备进入外环。基地资源与本局状态会在右侧实时更新。", 13, new Color("6B685B")));

        var row = ScreenChrome.Row(_page, 16);
        var gallery = new PanelContainer();
        gallery.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        gallery.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("F7F5EF"), 2, new Color("C9C5B8"), 1));
        row.AddChild(gallery);
        var galleryMargin = new MarginContainer();
        galleryMargin.AddThemeConstantOverride("margin_left", 14); galleryMargin.AddThemeConstantOverride("margin_right", 14);
        galleryMargin.AddThemeConstantOverride("margin_top", 14); galleryMargin.AddThemeConstantOverride("margin_bottom", 14);
        gallery.AddChild(galleryMargin);
        var galleryColumn = ScreenChrome.Column(galleryMargin, 10);
        galleryColumn.AddChild(UiTheme.Label("选择人物", 17, new Color("3C3A33")));
        var cards = new HBoxContainer { Name = "CharacterChoices", SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        cards.AddThemeConstantOverride("separation", 8);
        galleryColumn.AddChild(cards);
        for (var i = 0; i < Characters.Length; i++) AddCharacterCard(cards, Characters[i], i);

        var statusPanel = new PanelContainer { CustomMinimumSize = new Vector2(286, 0) };
        statusPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("ECE9E2"), 2, new Color("B7B4AA"), 1));
        row.AddChild(statusPanel);
        var statusMargin = new MarginContainer();
        statusMargin.AddThemeConstantOverride("margin_left", 16); statusMargin.AddThemeConstantOverride("margin_right", 16);
        statusMargin.AddThemeConstantOverride("margin_top", 14); statusMargin.AddThemeConstantOverride("margin_bottom", 14);
        statusPanel.AddChild(statusMargin);
        var statusColumn = ScreenChrome.Column(statusMargin, 8);
        statusColumn.AddChild(UiTheme.Label("远征状态", 17, new Color("3C3A33")));
        _summary = UiTheme.Label("请选择人物开始远征", 13, new Color("4A473E"));
        _summary.CustomMinimumSize = new Vector2(0, 110);
        statusColumn.AddChild(_summary);
        _status = UiTheme.Label("可以选择角色、读取存档或查看地图", 12, new Color("6B685B"));
        _status.CustomMinimumSize = new Vector2(0, 48);
        statusColumn.AddChild(_status);
        var map = ScreenChrome.AddNav(statusColumn, this, "查看地图", "map"); map.CustomMinimumSize = new Vector2(0, 40);
        var battle = ScreenChrome.AddNav(statusColumn, this, "进入战斗", "battle"); battle.CustomMinimumSize = new Vector2(0, 40);
        _actionList = ScreenChrome.Column(statusColumn, 5);
        _actionList.Name = "RunActions";

        var forecast = new PanelContainer();
        forecast.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("F7F5EF"), 2, new Color("C9C5B8"), 1));
        _page.AddChild(forecast);
        var forecastMargin = new MarginContainer();
        forecastMargin.AddThemeConstantOverride("margin_left", 16); forecastMargin.AddThemeConstantOverride("margin_right", 16);
        forecastMargin.AddThemeConstantOverride("margin_top", 10); forecastMargin.AddThemeConstantOverride("margin_bottom", 10);
        forecast.AddChild(forecastMargin);
        var forecastColumn = ScreenChrome.Column(forecastMargin, 6);
        forecastColumn.AddChild(UiTheme.Label("出征预报", 16, new Color("3C3A33")));
        forecastColumn.AddChild(UiTheme.Label("生命、攻击、背包与安全格等数值沿用远征核心；开始后可在地图页掷骰前进。", 12, new Color("6B685B")));
        _inventory = UiTheme.Label("背包为空", 12, new Color("6B685B"));
        forecastColumn.AddChild(_inventory);
        ApplySnapshot(_snapshot);
    }

    private void AddCharacterCard(Control parent, (string Id, string Name, string Class, string? Art) entry, int index)
    {
        var card = new PanelContainer { Name = $"CharacterCard_{entry.Id}", CustomMinimumSize = new Vector2(142, 282), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        card.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("F7F5EF"), 2, new Color("C9C5B8"), 1));
        parent.AddChild(card);
        UiMotion.Enter(card, index * 0.05);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 8); margin.AddThemeConstantOverride("margin_right", 8);
        margin.AddThemeConstantOverride("margin_top", 10); margin.AddThemeConstantOverride("margin_bottom", 10);
        card.AddChild(margin);
        var column = ScreenChrome.Column(margin, 6);
        if (entry.Art == null)
        {
            var empty = new PanelContainer { CustomMinimumSize = new Vector2(0, 164) };
            empty.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("E4E1D8"), 1, new Color("B7B4AA"), 1));
            column.AddChild(empty);
            var emptyLabel = UiTheme.Label("—", 42, new Color("8A8677"));
            emptyLabel.HorizontalAlignment = HorizontalAlignment.Center;
            emptyLabel.VerticalAlignment = VerticalAlignment.Center;
            empty.AddChild(emptyLabel);
        }
        else
        {
            var art = AssetLibrary.Thumbnail(column, entry.Art, new Vector2(0, 164));
            art.ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize;
            art.StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered;
        }
        var name = UiTheme.Label(entry.Name, 16, new Color("3C3A33"));
        name.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(name);
        var classLabel = UiTheme.Label(entry.Class, 11, new Color("8A6A2F"));
        classLabel.HorizontalAlignment = HorizontalAlignment.Center;
        column.AddChild(classLabel);
        var choose = UiTheme.Button("出发", new Vector2(0, 38));
        choose.Pressed += () => { UiMotion.Pop(card); _core?.RequestStartRun(entry.Id); };
        column.AddChild(choose);
        if (index == 0) choose.GrabFocus();
    }

    private void BuildStashPage()
    {
        _page.AddChild(UiTheme.Label("仓库", 28, new Color("3C3A33")));
        _page.AddChild(UiTheme.Label("整理远征物资与随身卡牌。卡牌数据仍由原有核心驱动。", 13, new Color("6B685B")));
        var panel = LightPanel(_page, "基地资源");
        _baseSummary = AddLightBody(panel, "基地资源同步中");
        var inventory = LightPanel(_page, "随身背包");
        _inventory = AddLightBody(inventory, "背包为空");
        AddSnapshotActions();
        ApplySnapshot(_snapshot);
    }

    private void BuildUpgradePage()
    {
        _page.AddChild(UiTheme.Label("升级", 28, new Color("3C3A33")));
        _page.AddChild(UiTheme.Label("消耗基地资源扩充背包、安全格与仓库容量。", 13, new Color("6B685B")));
        var panel = LightPanel(_page, "设施升级");
        _baseSummary = AddLightBody(panel, "基地资源同步中");
        var actions = ScreenChrome.Row(panel, 10);
        AddBaseAction(actions, "扩充背包", "upgrade:bag");
        AddBaseAction(actions, "扩充安全格", "upgrade:safe");
        AddBaseAction(actions, "扩充仓库", "upgrade:stash");
        ApplySnapshot(_snapshot);
    }

    private void BuildClassesPage()
    {
        _page.AddChild(UiTheme.Label("人物", 28, new Color("3C3A33")));
        _page.AddChild(UiTheme.Label("当前可用五个规则槽位；前三个使用已确认的新人物资源，后两个等待后续美术确认。", 13, new Color("6B685B")));
        var row = ScreenChrome.Row(_page, 10);
        for (var i = 0; i < Characters.Length; i++)
        {
            var entry = Characters[i];
            var panel = new PanelContainer { CustomMinimumSize = new Vector2(150, 250), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("F7F5EF"), 2, new Color("C9C5B8"), 1));
            row.AddChild(panel);
            var margin = new MarginContainer();
            margin.AddThemeConstantOverride("margin_left", 8); margin.AddThemeConstantOverride("margin_right", 8);
            margin.AddThemeConstantOverride("margin_top", 10); margin.AddThemeConstantOverride("margin_bottom", 10);
            panel.AddChild(margin);
            var column = ScreenChrome.Column(margin, 7);
            if (entry.Art != null) AssetLibrary.Thumbnail(column, entry.Art, new Vector2(0, 142));
            else
            {
                var empty = new PanelContainer { CustomMinimumSize = new Vector2(0, 142) };
                empty.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("E4E1D8"), 1, new Color("B7B4AA"), 1));
                column.AddChild(empty);
            }
            var label = UiTheme.Label(entry.Name, 15, new Color("3C3A33"));
            label.HorizontalAlignment = HorizontalAlignment.Center;
            column.AddChild(label);
            var cls = UiTheme.Label(entry.Class, 11, new Color("8A6A2F"));
            cls.HorizontalAlignment = HorizontalAlignment.Center;
            column.AddChild(cls);
        }
    }

    private void BuildAchievementsPage()
    {
        _page.AddChild(UiTheme.Label("成就", 28, new Color("3C3A33")));
        _page.AddChild(UiTheme.Label("远征记录、基地成长与卡背收藏将在此汇总。", 13, new Color("6B685B")));
        var panel = LightPanel(_page, "冬日档案");
        var body = AddLightBody(panel, "完成远征、收集钥匙与升级基地设施后，成就会在对应存档中累计。\n\n当前档案：" + (_snapshot.CharacterDisplayName.Length == 0 ? "未选择人物" : _snapshot.CharacterDisplayName));
        body.CustomMinimumSize = new Vector2(0, 160);
    }

    private VBoxContainer LightPanel(Control parent, string title)
    {
        var panel = new PanelContainer();
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("F7F5EF"), 2, new Color("C9C5B8"), 1));
        parent.AddChild(panel);
        var margin = new MarginContainer();
        margin.AddThemeConstantOverride("margin_left", 16); margin.AddThemeConstantOverride("margin_right", 16);
        margin.AddThemeConstantOverride("margin_top", 14); margin.AddThemeConstantOverride("margin_bottom", 14);
        panel.AddChild(margin);
        var column = ScreenChrome.Column(margin, 8);
        column.AddChild(UiTheme.Label(title, 17, new Color("3C3A33")));
        return column;
    }

    private static Label AddLightBody(Control parent, string text)
    {
        var label = UiTheme.Label(text, 13, new Color("4A473E"));
        label.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        parent.AddChild(label);
        return label;
    }

    private void AddSnapshotActions()
    {
        if (_actionList != null && GodotObject.IsInstanceValid(_actionList))
            foreach (var child in _actionList.GetChildren()) child.QueueFree();
    }

    private void AddBaseAction(Control parent, string label, string actionId)
    {
        var button = UiTheme.Button(label, new Vector2(0, 46));
        button.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        button.Pressed += () => _core?.RequestBaseAction(actionId);
        parent.AddChild(button);
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        _snapshot = snapshot;
        if (_resourceLine != null && GodotObject.IsInstanceValid(_resourceLine))
            _resourceLine.Text = $"木材 {snapshot.BaseWood}    口粮 {snapshot.BaseRations}    钥匙 {snapshot.BaseKeys}    储备 {snapshot.BaseCoins} 币";
        if (_summary != null && GodotObject.IsInstanceValid(_summary))
        {
            _summary.Text = $"人物：{snapshot.CharacterDisplayName}\n层级：{snapshot.LayerIndex + 1}  ·  位置：{snapshot.TrackPosition + 1}/{Math.Max(1, snapshot.TrackLength)}\n生命：{snapshot.CurrentHp}/{snapshot.MaxHp}\n体力：{snapshot.Stamina}/{snapshot.MaxStamina}\n本局：币 {snapshot.Coins}  ·  钥匙 {snapshot.Keys}";
        }
        if (_status != null && GodotObject.IsInstanceValid(_status)) _status.Text = snapshot.StatusText;
        if (_baseSummary != null && GodotObject.IsInstanceValid(_baseSummary))
            _baseSummary.Text = $"木材 {snapshot.BaseWood} · 口粮 {snapshot.BaseRations} · 钥匙 {snapshot.BaseKeys} · 储备币 {snapshot.BaseCoins}\n背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity} · 安全格 {snapshot.SafeCapacity} · 仓库 {snapshot.StashUsed}/{snapshot.StashCapacity}";
        if (_inventory != null && GodotObject.IsInstanceValid(_inventory))
            _inventory.Text = snapshot.InventoryLabels.Length == 0 ? "背包为空" : string.Join("  ·  ", snapshot.InventoryLabels);
        if (_actionList != null && GodotObject.IsInstanceValid(_actionList))
        {
            foreach (var child in _actionList.GetChildren()) child.QueueFree();
            foreach (var action in snapshot.Actions.Take(5))
            {
                var button = UiTheme.Button(action.Label, new Vector2(0, 36));
                button.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
                button.Disabled = !action.Enabled;
                var actionId = action.Id;
                button.Pressed += () => _core?.RequestRunAction(actionId);
                _actionList.AddChild(button);
            }
        }
    }
}
