using Godot;
using SoudacheGodot.App;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// Responsive entry screen for the migrated Godot run flow.
public partial class MenuScreen : UiScreen
{
    private readonly List<Label> _slotLabels = new();
    private Label _saveStatus = null!;
    private ICoreUiPort? _core;

    public void BindCore(ICoreUiPort core)
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
        _core = core;
        _core.SaveSlotsChanged += ApplySaveSlots;
    }

    public override void _ExitTree()
    {
        if (_core != null) _core.SaveSlotsChanged -= ApplySaveSlots;
    }

    protected override void Build()
    {
        UiTheme.Backdrop(this, UiTheme.Ink);

        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 64);
        margin.AddThemeConstantOverride("margin_right", 64);
        margin.AddThemeConstantOverride("margin_top", 52);
        margin.AddThemeConstantOverride("margin_bottom", 52);
        AddChild(margin);

        var layout = ScreenChrome.Row(margin, 36);

        var intro = ScreenChrome.Column(layout, 18);
        intro.CustomMinimumSize = new Vector2(560, 0);
        intro.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        intro.AddChild(UiTheme.Label("升格会的的冬日猜想", 38, UiTheme.Frost));
        intro.AddChild(UiTheme.Label("ASCENSION COUNCIL · WINTER REVERIE", 15, UiTheme.Accent));
        intro.AddChild(UiTheme.Label("一场关于远征、选择与归途的桌面冒险。\nGodot 迁移版已接入数据、远征状态与卡牌战斗核心。", 18, UiTheme.Muted));

        var roster = ScreenChrome.PanelContent(intro, "远征名册 · 五名核心角色", UiTheme.PanelSurface);
        ScreenChrome.AddBody(roster, "霜翎   ·   白契   ·   栗团   ·   玄砾   ·   灯葵");
        ScreenChrome.AddBody(roster, "角色概念与原版玩法保持不变，表现层逐步迁移至 Godot。");

        var menuPanel = ScreenChrome.PanelContent(layout, "远征终端", UiTheme.PanelRaised);
        menuPanel.CustomMinimumSize = new Vector2(360, 0);
        var start = ScreenChrome.AddNav(menuPanel, this, "开始远征", "run");
        ScreenChrome.AddNav(menuPanel, this, "继续地图", "map");
        ScreenChrome.AddNav(menuPanel, this, "战斗演练", "battle");
        _saveStatus = UiTheme.Label("五槽存档", 14, UiTheme.Muted);
        menuPanel.AddChild(_saveStatus);
        for (var slot = 0; slot < 5; slot++)
        {
            var index = slot;
            var row = ScreenChrome.Row(menuPanel, 6);
            var label = UiTheme.Label($"档位 {slot + 1} · 空", 13, UiTheme.Muted);
            label.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            row.AddChild(label);
            _slotLabels.Add(label);
            var save = UiTheme.Button("存", new Vector2(48, 36));
            save.Pressed += () => _core?.RequestSaveSlot(index);
            row.AddChild(save);
            var load = UiTheme.Button("读", new Vector2(48, 36));
            load.Pressed += () => _core?.RequestLoadSlot(index);
            row.AddChild(load);
        }
        var quit = UiTheme.Button("退出", new Vector2(220, 50));
        quit.Pressed += () => Navigate("quit");
        menuPanel.AddChild(quit);

        start.GrabFocus();
    }

    private void ApplySaveSlots(SaveSlotsUiSnapshot snapshot)
    {
        if (_saveStatus == null) return;
        _saveStatus.Text = snapshot.StatusText;
        foreach (var slot in snapshot.Slots)
            if (slot.Slot >= 0 && slot.Slot < _slotLabels.Count)
                _slotLabels[slot.Slot].Text = $"档位 {slot.Slot + 1} · {slot.Summary}";
    }
}
