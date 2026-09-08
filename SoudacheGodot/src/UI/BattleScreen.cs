using Godot;
using System.Collections.Generic;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Battle vertical slice: all state here is intentionally presentation-only.
/// Replace the placeholder labels by a Core.BattleSnapshot adapter without changing this layout.
public partial class BattleScreen : UiScreen
{
    private Label _turnLabel = null!;
    private Label _energyLabel = null!;
    private Label _statusLabel = null!;
    private Label _playerStateLabel = null!;
    private Label _enemyStateLabel = null!;
    private Button _drawPileButton = null!;
    private Button _discardPileButton = null!;
    private CardHandLayout _handLayout = null!;
    private int _turn = 1;
    private int _energy = 3;
    private ICoreUiPort? _corePort;
    private string[] _handCardIds = System.Array.Empty<string>();

    /// Called by AppMain once the Core composition root exists.
    public void BindCore(ICoreUiPort corePort)
    {
        if (_corePort != null)
            _corePort.BattleSnapshotChanged -= ApplySnapshot;
        _corePort = corePort;
        _corePort.BattleSnapshotChanged += ApplySnapshot;
    }

    public override void _ExitTree()
    {
        if (_handLayout != null)
            _handLayout.CardSelected -= OnCardSelected;
        if (_corePort != null)
            _corePort.BattleSnapshotChanged -= ApplySnapshot;
    }

    protected override void Build()
    {
        UiTheme.Backdrop(this, new Color("09151B"));
        var margin = new MarginContainer();
        UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 34);
        margin.AddThemeConstantOverride("margin_right", 34);
        margin.AddThemeConstantOverride("margin_top", 26);
        margin.AddThemeConstantOverride("margin_bottom", 26);
        AddChild(margin);

        var root = ScreenChrome.Column(margin, 12);
        var header = ScreenChrome.Row(root, 12);
        header.AddChild(UiTheme.Label("战斗竖切", 30, UiTheme.Frost));
        _turnLabel = UiTheme.Label("回合 1", 18, UiTheme.Accent);
        _turnLabel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _turnLabel.HorizontalAlignment = HorizontalAlignment.Right;
        header.AddChild(_turnLabel);
        var menu = ScreenChrome.AddNav(header, this, "主菜单", "menu");
        menu.CustomMinimumSize = new Vector2(150, 44);

        var arena = ScreenChrome.PanelContent(root, "霜原遭遇 · 战场占位", UiTheme.PanelSurface);
        arena.CustomMinimumSize = new Vector2(0, 220);
        arena.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        ScreenChrome.AddBody(arena, "敌方编组、意图、血量和角色立绘将在 BattleSnapshot 接入后显示。\n当前不执行任何原作规则或数值。");
        var foeRow = ScreenChrome.Row(arena, 16);
        _playerStateLabel = AddUnitBadge(foeRow, "远征者", "等待 Core");
        _enemyStateLabel = AddUnitBadge(foeRow, "敌方目标", "意图：攻击");

        var combatRow = ScreenChrome.Row(root, 12);
        combatRow.CustomMinimumSize = new Vector2(0, 270);

        var piles = ScreenChrome.PanelContent(combatRow, "牌堆", UiTheme.PanelRaised);
        piles.CustomMinimumSize = new Vector2(190, 0);
        _drawPileButton = UiTheme.Button("▣\n牌库\n—", new Vector2(156, 86));
        _drawPileButton.Pressed += () => _corePort?.RequestPileView("draw");
        piles.AddChild(_drawPileButton);
        _discardPileButton = UiTheme.Button("▤\n弃牌\n—", new Vector2(156, 86));
        _discardPileButton.Pressed += () => _corePort?.RequestPileView("discard");
        piles.AddChild(_discardPileButton);

        var handPanel = ScreenChrome.PanelContent(combatRow, "手牌 · 点击卡牌预览", UiTheme.PanelSurface);
        handPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _handLayout = new CardHandLayout { CustomMinimumSize = new Vector2(0, 220) };
        _handLayout.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _handLayout.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        _handLayout.CardSelected += OnCardSelected;
        handPanel.AddChild(_handLayout);
        _handLayout.SetPlaceholderCards(new List<string> { "霜刻", "守势", "回响", "破阵", "余烬" });

        var controls = ScreenChrome.PanelContent(combatRow, "行动", UiTheme.PanelRaised);
        controls.CustomMinimumSize = new Vector2(190, 0);
        _energyLabel = UiTheme.Label("能量 3 / 3\n（占位）", 22, UiTheme.AkMint);
        _energyLabel.HorizontalAlignment = HorizontalAlignment.Center;
        controls.AddChild(_energyLabel);
        _statusLabel = UiTheme.Label("等待行动", 14, UiTheme.Muted);
        _statusLabel.HorizontalAlignment = HorizontalAlignment.Center;
        controls.AddChild(_statusLabel);
        var endTurn = UiTheme.Button("结束回合", new Vector2(156, 56));
        endTurn.Pressed += EndTurnPlaceholder;
        controls.AddChild(endTurn);
        var backMap = ScreenChrome.AddNav(controls, this, "撤回地图", "map");
        backMap.CustomMinimumSize = new Vector2(156, 44);

        var footer = ScreenChrome.Row(root, 8);
        ScreenChrome.AddBody(footer, "UI 参考：手牌按数量扇形排列，悬停抬升；牌堆显示计数并可打开查看层。规则接口保持外置。");
    }

    private Label AddUnitBadge(Control parent, string title, string intent)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("203942"), 10, new Color("385C66"), 1));
        parent.AddChild(panel);
        var content = ScreenChrome.Column(panel, 6);
        content.AddChild(UiTheme.Label(title, 17, UiTheme.Frost));
        content.AddChild(UiTheme.Label(intent, 14, UiTheme.Danger));
        var state = UiTheme.Label("HP — / —   护盾 —", 14, UiTheme.Muted);
        content.AddChild(state);
        return state;
    }

    private void EndTurnPlaceholder()
    {
        if (_corePort != null)
        {
            _corePort.RequestEndTurn();
            return;
        }
        _turn++;
        _energy = 3;
        _turnLabel.Text = $"回合 {_turn}";
        _energyLabel.Text = $"能量 {_energy} / 3\n（占位）";
        SetStatus("结束回合信号已发出；敌方阶段等待 Core 接入");
    }

    private void SetStatus(string message)
    {
        if (_statusLabel != null)
            _statusLabel.Text = message;
    }

    private void OnCardSelected(int index, string cardLabel)
    {
        SetStatus($"已选择 {cardLabel}（占位）");
        if (_corePort != null && index >= 0 && index < _handCardIds.Length)
            _corePort.RequestPlayCard(_handCardIds[index]);
    }

    private void ApplySnapshot(BattleUiSnapshot snapshot)
    {
        _turn = snapshot.Turn;
        _energy = snapshot.Energy;
        if (_turnLabel != null)
            _turnLabel.Text = $"回合 {_turn}";
        if (_energyLabel != null)
            _energyLabel.Text = $"能量 {snapshot.Energy} / {snapshot.MaxEnergy}";
        if (_drawPileButton != null)
            _drawPileButton.Text = $"▣\n牌库\n{snapshot.DrawPileCount}";
        if (_discardPileButton != null)
            _discardPileButton.Text = $"▤\n弃牌\n{snapshot.DiscardPileCount}";
        if (_playerStateLabel != null)
            _playerStateLabel.Text = $"HP {snapshot.PlayerHp} / {snapshot.PlayerMaxHp}   护盾 {snapshot.PlayerBlock}";
        if (_enemyStateLabel != null)
            _enemyStateLabel.Text = $"HP {snapshot.EnemyHp} / {snapshot.EnemyMaxHp}   护盾 {snapshot.EnemyBlock}";
        SetStatus(snapshot.StatusText);
        _handCardIds = snapshot.HandCardIds;
        if (_handLayout != null)
            _handLayout.SetPlaceholderCards(snapshot.HandCardLabels);
    }
}
