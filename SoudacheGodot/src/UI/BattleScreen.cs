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
    private HBoxContainer _enemyList = null!;
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
        AssetLibrary.Background(this, AssetLibrary.Battle, 0.52f);
        UiTheme.Backdrop(this, new Color(0.025f, 0.055f, 0.07f, 0.66f));
        var margin = new MarginContainer(); UiTheme.FullRect(margin);
        margin.AddThemeConstantOverride("margin_left", 22); margin.AddThemeConstantOverride("margin_right", 22); margin.AddThemeConstantOverride("margin_top", 16); margin.AddThemeConstantOverride("margin_bottom", 16); AddChild(margin);
        var root = ScreenChrome.Column(margin, 8);
        var header = ScreenChrome.Row(root, 10);
        header.AddChild(UiTheme.Label("霜原遭遇  ·  HOSTILE CONTACT", 22, UiTheme.Frost));
        _playerStateLabel = UiTheme.Label("HP 30 / 30   护盾 0", 14, UiTheme.Muted);
        header.AddChild(_playerStateLabel);
        _turnLabel = UiTheme.Label("回合 1", 18, UiTheme.Accent); _turnLabel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; _turnLabel.HorizontalAlignment = HorizontalAlignment.Right; header.AddChild(_turnLabel);
        var menu = ScreenChrome.AddNav(header, this, "主菜单", "menu"); menu.CustomMinimumSize = new Vector2(128, 40);

        // The stage owns the full scene image; units float over it like the reference battle view.
        var arena = new Control { CustomMinimumSize = new Vector2(0, 300), SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        root.AddChild(arena);
        AssetLibrary.Background(arena, AssetLibrary.Battle, 0.30f);
        UiTheme.Backdrop(arena, new Color(0.02f, 0.06f, 0.08f, 0.40f));
        var stageMargin = new MarginContainer(); UiTheme.FullRect(stageMargin);
        stageMargin.AddThemeConstantOverride("margin_left", 24); stageMargin.AddThemeConstantOverride("margin_right", 24); stageMargin.AddThemeConstantOverride("margin_top", 28); stageMargin.AddThemeConstantOverride("margin_bottom", 22); arena.AddChild(stageMargin);
        UiMotion.Enter(stageMargin, 0.05);
        var foeRow = ScreenChrome.Row(stageMargin, 36); foeRow.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
        var playerPanel = new PanelContainer(); playerPanel.CustomMinimumSize = new Vector2(210, 0); playerPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.035f, 0.12f, 0.15f, 0.86f), 4, new Color("6B828A"), 1)); foeRow.AddChild(playerPanel);
        var playerContent = ScreenChrome.Column(playerPanel, 6); playerContent.AddChild(UiTheme.Label("远征者  ·  YOU", 16, UiTheme.Frost));
        var playerPortrait = AssetLibrary.Thumbnail(playerContent, "res://assets/brand-mark-codename7.png", new Vector2(150, 152));
        playerPortrait.ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize;
        _playerTargetButton = UiTheme.Button("选择自己", new Vector2(150, 38)); _playerTargetButton.Pressed += SelectPlayerTarget; playerContent.AddChild(_playerTargetButton);
        _enemyList = ScreenChrome.Row(foeRow, 12); _enemyList.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; _enemyList.Alignment = BoxContainer.AlignmentMode.Center;

        var combatRow = ScreenChrome.Row(root, 8); combatRow.CustomMinimumSize = new Vector2(0, 258);
        var piles = ScreenChrome.Column(combatRow, 5); piles.CustomMinimumSize = new Vector2(112, 0); piles.AddChild(UiTheme.Label("牌 堆", 12, UiTheme.Muted));
        _drawPileButton = UiTheme.Button("▣  牌库\n0", new Vector2(110, 62)); _drawPileButton.Pressed += () => _corePort?.RequestPileView("draw"); piles.AddChild(_drawPileButton);
        _discardPileButton = UiTheme.Button("▤  弃牌\n0", new Vector2(110, 62)); _discardPileButton.Pressed += () => _corePort?.RequestPileView("discard"); piles.AddChild(_discardPileButton);
        _exhaustPileButton = UiTheme.Button("◇  消耗\n0", new Vector2(110, 62)); _exhaustPileButton.Pressed += () => _corePort?.RequestPileView("exhaust"); piles.AddChild(_exhaustPileButton);
        var handPanel = new PanelContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        handPanel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.025f, 0.07f, 0.09f, 0.76f), 3, new Color("496873"), 1)); combatRow.AddChild(handPanel);
        _handLayout = new CardHandLayout { CustomMinimumSize = new Vector2(0, 246), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; _handLayout.CardSelected += OnCardSelected; handPanel.AddChild(_handLayout);
        _handLayout.SetCards(System.Array.Empty<string>());
        var controls = ScreenChrome.Column(combatRow, 7); controls.CustomMinimumSize = new Vector2(164, 0);
        _energyLabel = UiTheme.Label("能量 0 / 0", 21, UiTheme.AkMint); _energyLabel.HorizontalAlignment = HorizontalAlignment.Center; controls.AddChild(_energyLabel);
        _statusLabel = UiTheme.Label("可以行动", 13, UiTheme.Muted); _statusLabel.HorizontalAlignment = HorizontalAlignment.Center; _statusLabel.SizeFlagsVertical = Control.SizeFlags.ExpandFill; controls.AddChild(_statusLabel);
        var endTurn = UiTheme.Button("结束回合", new Vector2(150, 54)); endTurn.Pressed += OnEndTurn; controls.AddChild(endTurn); endTurn.GrabFocus();
        var backMap = ScreenChrome.AddNav(controls, this, "返回地图", "map"); backMap.CustomMinimumSize = new Vector2(150, 42);
        arena.Modulate = new Color(1, 1, 1, 0.0f); arena.CreateTween().TweenProperty(arena, "modulate", Colors.White, 0.55f).SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
    }

    private void OnEndTurn() => _corePort?.RequestEndTurn();

    private void OnCardSelected(int index, string cardLabel)
    {
        if (index < 0 || index >= _handCardIds.Length) return;
        if (_pendingCardIndex < 0)
        {
            _handLayout.PopCard(index);
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
        foreach (var child in _enemyList.GetChildren()) child.QueueFree();
        if (snapshot.Enemies.Length == 0)
        {
            _enemyList.AddChild(UiTheme.Label("敌方单位为零", 14, UiTheme.Muted));
        }
        foreach (var enemy in snapshot.Enemies)
        {
            var unit = new PanelContainer { CustomMinimumSize = new Vector2(154, 0) };
            unit.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color(0.035f, 0.09f, 0.11f, 0.88f), 4, enemy.Defeated ? new Color("435963") : new Color("8B615C"), 1));
            var content = ScreenChrome.Column(unit, 4);
            content.AddChild(UiTheme.Label(enemy.Name, 15, enemy.Defeated ? UiTheme.Muted : UiTheme.Frost));
            var enemyPortrait = AssetLibrary.Thumbnail(content, "res://assets/portraits/enemy-infantry.webp", new Vector2(130, 126));
            enemyPortrait.ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize;
            content.AddChild(UiTheme.Label($"HP {enemy.Hp}/{enemy.MaxHp}   盾 {enemy.Block}", 12, UiTheme.Muted));
            content.AddChild(UiTheme.Label($"意图  {enemy.Attack}", 12, UiTheme.Accent));
            var target = UiTheme.Button(enemy.Defeated ? "已击倒" : "选择目标", new Vector2(130, 34));
            target.Disabled = enemy.Defeated;
            var targetId = enemy.Id; target.Pressed += () => { UiMotion.Pop(unit); SelectEnemyTarget(targetId); }; content.AddChild(target);
            _enemyList.AddChild(unit);
        }
        var portrait = CharacterPortrait(snapshot.CharacterId);
        if (_playerTargetButton.GetParent() is VBoxContainer playerContent && playerContent.GetChildCount() > 1 && playerContent.GetChild(1) is TextureRect image && portrait != null)
            image.Texture = GD.Load<Texture2D>(portrait);
    }

    private static string? CharacterPortrait(string characterId)
        => AssetLibrary.CharacterBattle(characterId);
}
