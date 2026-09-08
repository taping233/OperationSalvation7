using Godot;
using System.Collections.Generic;
using SoudacheGodot.App;

namespace SoudacheGodot.UI;

/// Battle HUD: character, all enemies, piles, hand and action status are snapshot-driven.
public partial class BattleScreen : UiScreen
{
    private Label _turnLabel = null!;
    private Label _energyLabel = null!;
    private Label _statusLabel = null!;
    private Label _playerStateLabel = null!;
    private VBoxContainer _enemyList = null!;
    private Button _drawPileButton = null!;
    private Button _discardPileButton = null!;
    private Button _exhaustPileButton = null!;
    private Button _playerTargetButton = null!;
    private CardHandLayout _handLayout = null!;
    private ICoreUiPort? _corePort;
    private string[] _handCardIds = System.Array.Empty<string>();
    private int[] _handInfuseCounts = System.Array.Empty<int>();
    private string[] _handTargetKinds = System.Array.Empty<string>();
    private string _playerTargetId = "player";
    private int _pendingCardIndex = -1;
    private string _pendingTargetKind = "none";
    private readonly HashSet<int> _fuelIndices = new();

    public void BindCore(ICoreUiPort corePort)
    {
        if (_corePort != null) _corePort.BattleSnapshotChanged -= ApplySnapshot;
        _corePort = corePort; _corePort.BattleSnapshotChanged += ApplySnapshot;
    }

    public override void _ExitTree()
    {
        if (_handLayout != null) _handLayout.CardSelected -= OnCardSelected;
        if (_corePort != null) _corePort.BattleSnapshotChanged -= ApplySnapshot;
    }

    protected override void Build()
    {
        AssetLibrary.Background(this, AssetLibrary.Battle, 0.26f);
        UiTheme.Backdrop(this, new Color(0.03f, 0.08f, 0.11f, 0.84f));
        var margin = new MarginContainer(); UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 34); margin.AddThemeConstantOverride("margin_right", 34); margin.AddThemeConstantOverride("margin_top", 26); margin.AddThemeConstantOverride("margin_bottom", 26); AddChild(margin);
        var root = ScreenChrome.Column(margin, 12);
        var header = ScreenChrome.Row(root, 12); header.AddChild(UiTheme.Label("战斗", 30, UiTheme.Frost));
        _turnLabel = UiTheme.Label("回合 1", 18, UiTheme.Accent); _turnLabel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; _turnLabel.HorizontalAlignment = HorizontalAlignment.Right; header.AddChild(_turnLabel);
        var menu = ScreenChrome.AddNav(header, this, "主菜单", "menu"); menu.CustomMinimumSize = new Vector2(150, 44);

        var arena = ScreenChrome.PanelContent(root, "霜原遭遇 · 战场", new Color(0.09f, 0.16f, 0.20f, 0.93f)); arena.CustomMinimumSize = new Vector2(0, 220); arena.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        AssetLibrary.Thumbnail(arena, "res://assets/scenes/battle-normal.webp", new Vector2(0, 104)).SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        var foeRow = ScreenChrome.Row(arena, 16);
        var playerPanel = new PanelContainer(); playerPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; playerPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("203942"), 10, new Color("385C66"), 1)); foeRow.AddChild(playerPanel);
        var playerContent = ScreenChrome.Column(playerPanel, 6); playerContent.AddChild(UiTheme.Label("远征者", 17, UiTheme.Frost));
        AssetLibrary.Thumbnail(playerContent, AssetLibrary.CharacterPortrait("shuangling"), new Vector2(84, 72));
        _playerStateLabel = UiTheme.Label("HP 30 / 30   护盾 0", 14, UiTheme.Muted); playerContent.AddChild(_playerStateLabel);
        _playerTargetButton = UiTheme.Button("选择自己", new Vector2(150, 36)); _playerTargetButton.Pressed += SelectPlayerTarget; playerContent.AddChild(_playerTargetButton);
        _enemyList = ScreenChrome.Column(foeRow, 6); _enemyList.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; _enemyList.AddChild(UiTheme.Label("敌方编组", 17, UiTheme.Frost));

        var combatRow = ScreenChrome.Row(root, 12); combatRow.CustomMinimumSize = new Vector2(0, 270);
        var piles = ScreenChrome.PanelContent(combatRow, "牌堆", UiTheme.PanelRaised); piles.CustomMinimumSize = new Vector2(190, 0);
        _drawPileButton = UiTheme.Button("▣\n牌库\n0", new Vector2(156, 86)); _drawPileButton.Pressed += () => _corePort?.RequestPileView("draw"); piles.AddChild(_drawPileButton);
        _discardPileButton = UiTheme.Button("▤\n弃牌\n0", new Vector2(156, 86)); _discardPileButton.Pressed += () => _corePort?.RequestPileView("discard"); piles.AddChild(_discardPileButton);
        _exhaustPileButton = UiTheme.Button("◇\n消耗\n0", new Vector2(156, 86)); _exhaustPileButton.Pressed += () => _corePort?.RequestPileView("exhaust"); piles.AddChild(_exhaustPileButton);
        var handPanel = ScreenChrome.PanelContent(combatRow, "手牌", UiTheme.PanelSurface); handPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _handLayout = new CardHandLayout { CustomMinimumSize = new Vector2(0, 220), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; _handLayout.CardSelected += OnCardSelected; handPanel.AddChild(_handLayout);
        _handLayout.SetCards(new[] { "初始攻击", "守势", "回响", "破阵", "余烬" });
        var controls = ScreenChrome.PanelContent(combatRow, "行动", UiTheme.PanelRaised); controls.CustomMinimumSize = new Vector2(190, 0);
        _energyLabel = UiTheme.Label("能量 0 / 0", 22, UiTheme.AkMint); _energyLabel.HorizontalAlignment = HorizontalAlignment.Center; controls.AddChild(_energyLabel);
        _statusLabel = UiTheme.Label("可以行动", 14, UiTheme.Muted); _statusLabel.HorizontalAlignment = HorizontalAlignment.Center; controls.AddChild(_statusLabel);
        var endTurn = UiTheme.Button("结束回合", new Vector2(156, 56)); endTurn.Pressed += OnEndTurn; controls.AddChild(endTurn); endTurn.GrabFocus();
        var backMap = ScreenChrome.AddNav(controls, this, "返回地图", "map"); backMap.CustomMinimumSize = new Vector2(156, 44);
        var footer = ScreenChrome.Row(root, 8); ScreenChrome.AddBody(footer, "选择手牌查看详情；牌库与弃牌堆可打开查看。");
    }

    private void OnEndTurn() => _corePort?.RequestEndTurn();

    private void OnCardSelected(int index, string cardLabel)
    {
        if (index < 0 || index >= _handCardIds.Length) return;
        if (_pendingCardIndex < 0)
        {
            _pendingCardIndex = index; _pendingTargetKind = TargetKind(index); _fuelIndices.Clear();
            _handLayout.SetCardSelected(index, true);
            var required = InfuseCount(index);
            if (required > 0) { _statusLabel.Text = $"已选择 {cardLabel}：请选择 {required} 张注能材料"; return; }
            if (_pendingTargetKind == "enemy") { _statusLabel.Text = $"已选择 {cardLabel}：请选择敌方目标"; return; }
            SubmitCard(_pendingTargetKind == "self" ? _playerTargetId : null); return;
        }
        if (index == _pendingCardIndex) { _statusLabel.Text = "注能材料必须是其他手牌"; return; }
        if (InfuseCount(_pendingCardIndex) <= 0) return;
        if (_fuelIndices.Contains(index)) _fuelIndices.Remove(index); else if (_fuelIndices.Count < InfuseCount(_pendingCardIndex)) _fuelIndices.Add(index);
        _handLayout.SetCardSelected(index, _fuelIndices.Contains(index));
        _statusLabel.Text = $"注能材料 {_fuelIndices.Count}/{InfuseCount(_pendingCardIndex)}";
        if (_fuelIndices.Count == InfuseCount(_pendingCardIndex) && _pendingTargetKind == "none") SubmitCard(null);
        else if (_fuelIndices.Count == InfuseCount(_pendingCardIndex) && _pendingTargetKind == "self") SubmitCard(_playerTargetId);
    }

    private int InfuseCount(int index) => index >= 0 && index < _handInfuseCounts.Length ? System.Math.Max(0, _handInfuseCounts[index]) : 0;
    private string TargetKind(int index) => index >= 0 && index < _handTargetKinds.Length ? (_handTargetKinds[index] ?? "none").ToLowerInvariant() : "none";

    private void SelectPlayerTarget()
    {
        if (_pendingCardIndex >= 0 && _pendingTargetKind == "self" && _fuelIndices.Count == InfuseCount(_pendingCardIndex)) SubmitCard(_playerTargetId);
    }

    private void SelectEnemyTarget(string targetId)
    {
        if (_pendingCardIndex >= 0 && _pendingTargetKind == "enemy" && _fuelIndices.Count == InfuseCount(_pendingCardIndex)) SubmitCard(targetId);
    }

    private void SubmitCard(string? targetId)
    {
        if (_corePort == null || _pendingCardIndex < 0 || _pendingCardIndex >= _handCardIds.Length) return;
        var fuels = new List<string>(); foreach (var index in _fuelIndices) if (index >= 0 && index < _handCardIds.Length) fuels.Add(_handCardIds[index]);
        _corePort.RequestPlayCard(_handCardIds[_pendingCardIndex], targetId, fuels.ToArray());
        _handLayout.SetCardSelected(_pendingCardIndex, false); foreach (var index in _fuelIndices) _handLayout.SetCardSelected(index, false);
        _pendingCardIndex = -1; _pendingTargetKind = "none"; _fuelIndices.Clear();
    }

    private void ApplySnapshot(BattleUiSnapshot snapshot)
    {
        if (_turnLabel == null) return;
        _turnLabel.Text = $"回合 {snapshot.Turn}"; _energyLabel.Text = $"能量 {snapshot.Energy} / {snapshot.MaxEnergy}";
        _drawPileButton.Text = $"▣\n牌库\n{snapshot.DrawPileCount}"; _discardPileButton.Text = $"▤\n弃牌\n{snapshot.DiscardPileCount}";
        _exhaustPileButton.Text = $"◇\n消耗\n{snapshot.ExhaustPileCount}";
        _playerStateLabel.Text = $"HP {snapshot.PlayerHp} / {snapshot.PlayerMaxHp}   护盾 {snapshot.PlayerBlock}"; _statusLabel.Text = snapshot.StatusText;
        _playerTargetId = string.IsNullOrWhiteSpace(snapshot.PlayerTargetId) ? "player" : snapshot.PlayerTargetId;
        _handCardIds = snapshot.HandCardIds; _handInfuseCounts = snapshot.HandCardInfuseCounts; _handTargetKinds = snapshot.HandCardTargetKinds;
        _pendingCardIndex = -1; _pendingTargetKind = "none"; _fuelIndices.Clear(); _handLayout.SetCards(snapshot.HandCardLabels);
        foreach (var child in _enemyList.GetChildren()) if (child != _enemyList.GetChild(0)) child.QueueFree();
        if (snapshot.Enemies.Length == 0)
        {
            _enemyList.AddChild(UiTheme.Label("敌方单位为零", 14, UiTheme.Muted));
        }
        foreach (var enemy in snapshot.Enemies)
        {
            var target = UiTheme.Button($"{enemy.Name}  HP {enemy.Hp}/{enemy.MaxHp}  护盾 {enemy.Block}  意图 {enemy.Attack}", new Vector2(0, 42));
            target.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; target.Disabled = enemy.Defeated;
            var targetId = enemy.Id; target.Pressed += () => SelectEnemyTarget(targetId); _enemyList.AddChild(target);
        }
        var portrait = AssetLibrary.CharacterPortrait(snapshot.CharacterId); // character art follows the active Core id
        if (_playerStateLabel.GetParent() is VBoxContainer content && content.GetChildCount() > 1 && content.GetChild(1) is TextureRect image) image.Texture = GD.Load<Texture2D>(portrait);
    }
}
