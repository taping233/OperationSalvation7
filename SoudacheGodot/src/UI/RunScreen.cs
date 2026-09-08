using Godot;
using SoudacheGodot.App;
using System;

namespace SoudacheGodot.UI;

/// Expedition setup and base management screen driven entirely by RunUiSnapshot.
public partial class RunScreen : UiScreen
{
    private Label _summary = null!;
    private Label _status = null!;
    private Label _baseSummary = null!;
    private Label _inventory = null!;
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
        AssetLibrary.Background(this, AssetLibrary.Hub, 0.32f);
        UiTheme.Backdrop(this, new Color(0.04f, 0.09f, 0.12f, 0.82f));
        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 56); margin.AddThemeConstantOverride("margin_right", 56);
        margin.AddThemeConstantOverride("margin_top", 42); margin.AddThemeConstantOverride("margin_bottom", 42);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 16);
        root.AddChild(UiTheme.Label("远征与基地", 32, UiTheme.Frost));
        root.AddChild(UiTheme.Label("EXPEDITION TERMINAL  /  BASE MANAGEMENT", 14, UiTheme.Accent));

        var body = ScreenChrome.Row(root, 18);
        var roster = ScreenChrome.PanelContent(body, "选择远征角色", new Color(0.09f, 0.16f, 0.20f, 0.94f));
        roster.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        roster.AddChild(UiTheme.Label("选择角色后开始新的确定性远征。", 16, UiTheme.Muted));
        var portraitGrid = new GridContainer { Columns = 5, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        portraitGrid.AddThemeConstantOverride("h_separation", 8); portraitGrid.AddThemeConstantOverride("v_separation", 8); roster.AddChild(portraitGrid);
        var entries = new[] { ("shuangling", "霜翎"), ("baiqi", "白契"), ("lituan", "栗团"), ("xuanli", "玄砾"), ("dengkui", "灯葵") };
        foreach (var entry in entries)
        {
            var card = new VBoxContainer(); card.AddThemeConstantOverride("separation", 5);
            AssetLibrary.Thumbnail(card, AssetLibrary.CharacterPortrait(entry.Item1), new Vector2(132, 118));
            var choice = UiTheme.Button(entry.Item2, new Vector2(132, 44));
            var id = entry.Item1; choice.Pressed += () => _core?.RequestStartRun(id); card.AddChild(choice); portraitGrid.AddChild(card);
        }

        var right = ScreenChrome.Column(body, 12); right.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        var expedition = ScreenChrome.PanelContent(right, "远征状态", UiTheme.PanelRaised);
        _summary = ScreenChrome.AddBody(expedition, "选择角色开始远征");
        _status = ScreenChrome.AddBody(expedition, "可以选择角色、读取存档或查看地图");
        var map = ScreenChrome.AddNav(expedition, this, "查看地图", "map"); map.GrabFocus();
        ScreenChrome.AddNav(expedition, this, "进入战斗", "battle");

        var basePanel = ScreenChrome.PanelContent(right, "基地资源与容量", UiTheme.PanelSurface);
        _baseSummary = ScreenChrome.AddBody(basePanel, "木材 0 · 口粮 0 · 钥匙 0 · 储备币 0");
        var upgrades = ScreenChrome.Row(basePanel, 8);
        AddBaseAction(upgrades, "扩充背包", "upgrade:bag"); AddBaseAction(upgrades, "扩充安全格", "upgrade:safe"); AddBaseAction(upgrades, "扩充仓库", "upgrade:stash");
        var inventoryPanel = ScreenChrome.PanelContent(right, "随身背包", UiTheme.PanelRaised);
        _inventory = ScreenChrome.AddBody(inventoryPanel, "背包为空");

        var footer = ScreenChrome.Row(root, 14); ScreenChrome.AddNav(footer, this, "返回主菜单", "menu");
    }

    private void AddBaseAction(Control parent, string label, string actionId)
    {
        var button = UiTheme.Button(label, new Vector2(132, 42)); button.Pressed += () => _core?.RequestBaseAction(actionId); parent.AddChild(button);
    }

    private void ApplySnapshot(RunUiSnapshot snapshot)
    {
        if (_summary == null) return;
        _summary.Text = $"角色：{snapshot.CharacterDisplayName}  层级：{snapshot.LayerIndex + 1}  位置：{snapshot.TrackPosition + 1}/{Math.Max(1, snapshot.TrackLength)}\n生命：{snapshot.CurrentHp}/{snapshot.MaxHp}  体力：{snapshot.Stamina}/{snapshot.MaxStamina}\n本局携带：币 {snapshot.Coins} · 钥匙 {snapshot.Keys} · 木材 {snapshot.Wood} · 口粮 {snapshot.Rations}";
        _status.Text = snapshot.StatusText;
        _baseSummary.Text = $"木材 {snapshot.BaseWood} · 口粮 {snapshot.BaseRations} · 钥匙 {snapshot.BaseKeys} · 储备币 {snapshot.BaseCoins}\n背包 {snapshot.BackpackUsed}/{snapshot.BackpackCapacity} · 安全格 {snapshot.SafeCapacity} · 仓库 {snapshot.StashUsed}/{snapshot.StashCapacity}";
        _inventory.Text = snapshot.InventoryLabels.Length == 0 ? "背包为空" : string.Join("  ·  ", snapshot.InventoryLabels);
    }
}
