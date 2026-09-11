using Godot;
using SoudacheGodot.App;
using SoudacheGodot.UI.Fx;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// <summary>
/// Battle HUD: character, all enemies, piles, hand and action status are snapshot-driven.
/// 批次 6c 战斗表现（动画时序 1:1 网页版 / 参数见 _planning/sts2-reference.md 与 battle.css）：
/// - 快照数值 diff 驱动反馈：伤害/治疗/格挡飘字（重力 2000 抛物线）、受击抖动（抖受击者）、
///   打击粒子（三层 one-shot）、能量球脉冲（380ms brightness）、牌堆 bump、洗牌飞卡；
/// - 拖拽出牌状态机（STS2 §1）：75% 屏高 play zone、动态阈值（起点上/下 → -50/-100px）、
///   举卡待选（屏中锚位 + 0.75 缩放）、95% 以下取消区（须先离开过一次）、拖拽不旋转；
/// - 19 节贝塞尔目标指示箭头（NTargetingArrow 公式 + 网页 AIM_COLOR 分色）；
/// - 手牌敌方回合下沉 100px+变灰 0.2s CubicOut、回合一恢复 0.38s；结束回合按钮呼吸光+隐藏/出现滑动；
/// - 音频：SfxRequests 逐键 PlaySfx（[7a→A] 契约消费）；进战斗 SetDucked(true)（ducking ×0.45）。
/// </summary>
public partial class BattleScreen : UiScreen
{
    private Label _turnLabel = null!;
    private EnergyOrb _energyOrb = null!;
    private Label _statusLabel = null!;
    private Label _playerStateLabel = null!;
    private Control _playerFigure = null!;
    private Control _playerShake = null!;
    private ColorRect _playerHpFill = null!;
    private VBoxContainer _enemyList = null!;
    private Button _drawPileButton = null!;
    private Button _discardPileButton = null!;
    private Button _exhaustPileButton = null!;
    private Button _playerTargetButton = null!;
    private Button _endTurnButton = null!;
    private Panel _endTurnGlow = null!;
    private Control _handDock = null!;
    private CardHandLayout _handLayout = null!;
    private Control _vfxLayer = null!;
    private HurtFlash _hurtFlash = null!;
    private AimArrowLayer _aimArrow = null!;
    private ICoreUiPort? _corePort;
    private GameAudio? _audio;
    private string[] _handCardIds = System.Array.Empty<string>();
    private int[] _handInfuseCounts = System.Array.Empty<int>();
    private string[] _handTargetKinds = System.Array.Empty<string>();
    private string _playerTargetId = "player";
    private int _pendingCardIndex = -1;
    private string _pendingTargetKind = "none";
    private readonly HashSet<int> _fuelIndices = new();

    // ---- 快照 diff 状态（前一帧数值，驱动飘字/抖动/粒子/脉冲） ----
    private int _prevEnergy = -1, _prevDraw = -1, _prevDiscard = -1, _prevExhaust = -1;
    private int _prevPlayerHp = -1, _prevPlayerBlock = -1;
    private readonly Dictionary<string, (int Hp, int Block)> _prevEnemy = new();

    // ---- 单位视觉注册表（受击抖动/飘字/粒子按目标定位；跨快照复用） ----
    private sealed class UnitView
    {
        public string Id = "";
        public Control Root = null!;    // 容器内定位层（点击命中区）
        public Control Shake = null!;   // 抖动目标（内容列）
        public Control Figure = null!;  // 粒子/飘字锚
        public Label Intent = null!;    // 意图气泡（浮动）
        public Label State = null!;
        public ColorRect HpFill = null!;
        public float HpRatio = 1f;
    }
    private readonly Dictionary<string, UnitView> _enemyViews = new();

    // ---- 拖拽状态机（STS2 NMouseCardPlay/NCardPlay） ----
    private int _dragIndex = -1;
    private Control? _dragCard;
    private float _dragStartY;
    private bool _leftCancelZone;
    private bool _dragHoverSelf;
    private string? _dragHoverEnemyId;
    private Vector2 _dragCardPos;
    private Vector2 _dragCardScale = Vector2.One;
    private ulong _dragPlayedUntilMs;

    // ---- 飞牌上下文（SubmitCard 时捕获，快照到达时结算去向） ----
    private (string CardId, Rect2 SourceGlobal, string Kind, string? TargetId)? _flyContext;
    private bool _endTurnPending;

    private string? _demoMode;
    private double _demoT;

    public void BindCore(ICoreUiPort corePort)
    {
        if (_corePort != null) _corePort.BattleSnapshotChanged -= ApplySnapshot;
        _corePort = corePort; _corePort.BattleSnapshotChanged += ApplySnapshot;
    }

    public override void _EnterTree()
    {
        // sound.js setDucked(true)：战斗 BGM 侧链 ducking ×0.45；切曲由 AppMain.SetContext("battle") 完成
        _audio = GetNodeOrNull<GameAudio>("../GameAudio");
        _audio?.SetDucked(true);
    }

    public override void _ExitTree()
    {
        _audio?.SetDucked(false); // 回标题/地图解除 ducking
        if (_handLayout != null) { _handLayout.CardSelected -= OnCardSelected; _handLayout.CardDragBegin -= OnDragBegin; _handLayout.CardDragEnd -= OnDragEnd; }
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
        _playerShake = ScreenChrome.Column(playerPanel, 6);
        _playerShake.AddChild(UiTheme.Label("远征者", 17, UiTheme.Frost));
        var portrait = new TextureRect { Texture = GD.Load<Texture2D>(AssetLibrary.CharacterPortrait("shuangling")), CustomMinimumSize = new Vector2(84, 72), ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.KeepAspectCovered, MouseFilter = Control.MouseFilterEnum.Ignore };
        _playerFigure = portrait; _playerShake.AddChild(portrait);
        _playerShake.AddChild(MakeHpBar(out _playerHpFill));
        _playerStateLabel = UiTheme.Label("HP 30 / 30   护盾 0", 14, UiTheme.Muted); _playerShake.AddChild(_playerStateLabel);
        _playerTargetButton = UiTheme.Button("选择自己", new Vector2(150, 36)); _playerTargetButton.Pressed += SelectPlayerTarget; _playerShake.AddChild(_playerTargetButton);
        _enemyList = ScreenChrome.Column(foeRow, 6); _enemyList.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; _enemyList.AddChild(UiTheme.Label("敌方编组", 17, UiTheme.Frost));

        var combatRow = ScreenChrome.Row(root, 12); combatRow.CustomMinimumSize = new Vector2(0, 270);
        var piles = ScreenChrome.PanelContent(combatRow, "牌堆", UiTheme.PanelRaised); piles.CustomMinimumSize = new Vector2(190, 0);
        _drawPileButton = UiTheme.Button("▣\n牌库\n0", new Vector2(156, 86)); _drawPileButton.Pressed += () => _corePort?.RequestPileView("draw"); ButtonFeedback.Attach(_drawPileButton, ButtonFeedbackStyle.Pile); piles.AddChild(_drawPileButton);
        _discardPileButton = UiTheme.Button("▤\n弃牌\n0", new Vector2(156, 86)); _discardPileButton.Pressed += () => _corePort?.RequestPileView("discard"); ButtonFeedback.Attach(_discardPileButton, ButtonFeedbackStyle.Pile); piles.AddChild(_discardPileButton);
        _exhaustPileButton = UiTheme.Button("◇\n消耗\n0", new Vector2(156, 86)); _exhaustPileButton.Pressed += () => _corePort?.RequestPileView("exhaust"); ButtonFeedback.Attach(_exhaustPileButton, ButtonFeedbackStyle.Pile); piles.AddChild(_exhaustPileButton);
        var handPanel = ScreenChrome.PanelContent(combatRow, "手牌", UiTheme.PanelSurface); handPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        _handDock = new Control { CustomMinimumSize = new Vector2(0, 220), SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, SizeFlagsVertical = Control.SizeFlags.ExpandFill }; handPanel.AddChild(_handDock);
        _handLayout = new CardHandLayout(); UiTheme.FullRect(_handLayout); _handDock.AddChild(_handLayout);
        _handLayout.CardSelected += OnCardSelected; _handLayout.CardDragBegin += OnDragBegin; _handLayout.CardDragEnd += OnDragEnd;
        _handLayout.SetCards(new[] { "初始攻击  [1]", "守势  [1]", "回响  [1]", "破阵  [2]", "余烬  [3]" });
        var controls = ScreenChrome.PanelContent(combatRow, "行动", UiTheme.PanelRaised); controls.CustomMinimumSize = new Vector2(190, 0);
        var orbRow = ScreenChrome.Row(controls, 8); orbRow.Alignment = BoxContainer.AlignmentMode.Center;
        _energyOrb = EnergyOrb.Create(); orbRow.AddChild(_energyOrb);
        _statusLabel = UiTheme.Label("可以行动", 14, UiTheme.Muted); _statusLabel.HorizontalAlignment = HorizontalAlignment.Center; controls.AddChild(_statusLabel);
        _endTurnButton = UiTheme.Button("结束回合", new Vector2(156, 56)); _endTurnButton.Pressed += OnEndTurn; controls.AddChild(_endTurnButton); _endTurnButton.GrabFocus();
        _endTurnGlow = MakeGlowShell(_endTurnButton); // 呼吸光外壳（NEndTurnButton：alpha 0.8s 循环到 0.75）
        BreathingFx.StartGlow(_endTurnGlow);
        var backMap = ScreenChrome.AddNav(controls, this, "返回地图", "map"); backMap.CustomMinimumSize = new Vector2(156, 44);
        var footer = ScreenChrome.Row(root, 8); ScreenChrome.AddBody(footer, "点击卡牌查看详情；指向卡按住拖到目标身上打出，拖到敌我中间空地即可打出无目标招式。");

        // —— 常驻特效层（飘字/飞牌 ghost/目标箭头/红闪；覆盖全屏、不拦鼠标） ——
        _vfxLayer = new Control { MouseFilter = Control.MouseFilterEnum.Ignore };
        UiTheme.FullRect(_vfxLayer);
        _vfxLayer.ZIndex = 200;
        AddChild(_vfxLayer);
        _aimArrow = AimArrowLayer.Create(_vfxLayer);
        _hurtFlash = HurtFlash.Attach(_vfxLayer);

        ParseDemoArg();
    }

    private static Panel MakeGlowShell(Button owner)
    {
        // 结束回合呼吸光外壳：金描边圆角框，BreathingGlowDriver 驱动 alpha/scale
        var shell = new Panel { MouseFilter = Control.MouseFilterEnum.Ignore };
        shell.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        shell.OffsetLeft = -6; shell.OffsetTop = -6; shell.OffsetRight = 6; shell.OffsetBottom = 6;
        shell.PivotOffset = owner.CustomMinimumSize * 0.5f + new Vector2(6, 6);
        var box = UiTheme.Box(new Color(1, 0.84f, 0.5f, 0.05f), 12, new Color(1f, 0.784f, 0f, 0.98f), 2);
        shell.AddThemeStyleboxOverride("panel", box);
        owner.AddChild(shell);
        return shell;
    }

    private static Control MakeHpBar(out ColorRect fill)
    {
        var bar = new Control { CustomMinimumSize = new Vector2(0, 12), MouseFilter = Control.MouseFilterEnum.Ignore, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
        var bg = new ColorRect { Color = new Color(0.05f, 0.10f, 0.13f, 0.9f) };
        bg.SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        bar.AddChild(bg);
        fill = new ColorRect { Color = new Color("7ec9a0"), SizeFlagsVertical = Control.SizeFlags.ShrinkBegin };
        fill.SetAnchorsPreset(LayoutPreset.LeftWide);
        fill.OffsetBottom = 0; fill.OffsetTop = 0;
        bar.AddChild(fill);
        return bar;
    }

    // ================================================================
    // 出牌（点击流 + 拖拽流共用 SubmitCard）
    // ================================================================

    private void OnEndTurn() => BeginEnemyPhasePresentation(() => _corePort?.RequestEndTurn());

    private void OnCardSelected(int index, string cardLabel)
    {
        if (Time.GetTicksMsec() < _dragPlayedUntilMs) return; // 指向松手刚打出，忽略残留 click（网页 aimPlayedAt 口径）
        if (index < 0 || index >= _handCardIds.Length) return;
        if (_pendingCardIndex < 0)
        {
            _pendingCardIndex = index; _pendingTargetKind = TargetKind(index); _fuelIndices.Clear();
            _handLayout.SetCardSelected(index, true);
            var required = InfuseCount(index);
            if (required > 0) { _statusLabel.Text = $"已选择 {cardLabel}：请选择 {required} 张注能材料"; return; }
            if (_pendingTargetKind == "enemy") { _statusLabel.Text = $"已选择 {cardLabel}：请点击敌方目标"; return; }
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
        // 飞牌取样：出手前记录卡面全局矩形，快照到达后按去向（弃牌/消耗）放 ghost（battle.view exitSinkFor 口径）
        var source = CardGlobalRect(_pendingCardIndex);
        if (source.HasValue)
            _flyContext = (_handCardIds[_pendingCardIndex], source.Value, _pendingTargetKind, targetId);
        _corePort.RequestPlayCard(_handCardIds[_pendingCardIndex], targetId, fuels.ToArray());
        _handLayout.SetCardSelected(_pendingCardIndex, false); foreach (var index in _fuelIndices) _handLayout.SetCardSelected(index, false);
        _pendingCardIndex = -1; _pendingTargetKind = "none"; _fuelIndices.Clear();
    }

    private Rect2? CardGlobalRect(int index)
    {
        var card = _handLayout.CardAt(index);
        if (card == null) return null;
        return new Rect2(card.GlobalPosition, card.Size * card.Scale);
    }

    // ================================================================
    // 拖拽出牌状态机（sts2-reference §1 NMouseCardPlay/NCardPlay.CenterCard + 网页 AIM 分色）
    // ================================================================

    private void OnDragBegin(int index)
    {
        if (index < 0 || index >= _handCardIds.Length) return;
        _dragIndex = index;
        _dragCard = _handLayout.CardAt(index);
        _dragStartY = GetGlobalMousePosition().Y; // 动态阈值起点 = 按住时的指针位置
        _leftCancelZone = false;
        _dragHoverSelf = false;
        _dragHoverEnemyId = null;
        _handLayout.SetFollowerSuspended(_dragCard, true);
        var card = _dragCard!;
        _dragCardPos = card.GlobalPosition;
        _dragCardScale = card.Scale;
        card.PivotOffset = _handLayout.CardSizePx * 0.5f;
        _audio?.PlaySfx("hover"); // 网页 startAim: Sound.sfx('hover')
    }

    private void OnDragEnd(int index)
    {
        _aimArrow.Hide();
        var mouse = GetGlobalMousePosition();
        var screenSize = GetViewportRect().Size;
        var line = DynamicPlayLine(screenSize);
        var wasCanceled = mouse.Y > screenSize.Y * 0.95f && !_leftCancelZone; // 95% 以下取消区（须先离开过一次）
        var needsTarget = TargetKind(index) == "enemy";
        var played = false;
        if (!wasCanceled && mouse.Y <= line)
        {
            if (!needsTarget || _dragHoverEnemyId != null)
            {
                // 拖拽=直接打出（网页：松手在目标身上即打出；'any' 落空地即打出）
                if (index >= 0 && index < _handCardIds.Length)
                {
                    _pendingCardIndex = index; _pendingTargetKind = TargetKind(index); _fuelIndices.Clear();
                    var dragCard = _dragCard;
                    dragCard!.Visible = false; // 打出的卡立刻离手（ghost 飞行补位，缩编时槽位回收）
                    SubmitCard(_pendingTargetKind == "enemy" ? _dragHoverEnemyId
                        : _pendingTargetKind == "self" ? _playerTargetId : null);
                    played = true;
                }
            }
        }
        _dragPlayedUntilMs = Time.GetTicksMsec() + 300;
        _dragIndex = -1;
        _dragHoverEnemyId = null; _dragHoverSelf = false;
        _handLayout.SetFollowerSuspended(_dragCard, false);
        _dragCard = null;
        if (played) _handLayout.ReleaseDrag(); // 已打出：直接收回布局（快照会同步手牌）
        // 未打出：follower 恢复后由三通道平滑收回扇形位（网页「拖空自动回手牌」）
    }

    /// <summary>动态出牌阈值：起点在默认线（75% 屏高）下 → 起点-100px；上 → min(默认线, 起点-50px)。</summary>
    private float DynamicPlayLine(Vector2 screenSize)
    {
        var defaultLine = screenSize.Y * 0.75f;
        return _dragStartY > defaultLine ? _dragStartY - 100f : Mathf.Min(defaultLine, _dragStartY - 50f);
    }

    public override void _Process(double delta)
    {
        if (_dragIndex >= 0) UpdateDrag(delta);
        if (_demoMode != null) TickDemo(delta);
    }

    private void UpdateDrag(double delta)
    {
        var index = _dragIndex;
        var card = _handLayout.CardAt(index);
        if (card == null) { _dragIndex = -1; return; }
        var mouse = GetGlobalMousePosition();
        var screenSize = GetViewportRect().Size;
        if (mouse.Y <= screenSize.Y * 0.95f) _leftCancelZone = true; // 取消区须先离开过一次

        // 目标吸附：指针处的有效目标（enemy 卡找活敌 / self 卡找自己立绘；any 跟指针）
        _dragHoverEnemyId = null; _dragHoverSelf = false;
        Vector2 head = mouse;
        var kind = TargetKind(index);
        if (kind == "enemy")
        {
            foreach (var view in _enemyViews.Values)
            {
                if (view.Root.GetGlobalRect().HasPoint(mouse)) { _dragHoverEnemyId = view.Id; head = view.Figure.GetGlobalRect().GetCenter(); break; }
            }
        }
        else if (kind == "self")
        {
            if (_playerFigure.GetGlobalRect().HasPoint(mouse)) { _dragHoverSelf = true; head = _playerFigure.GetGlobalRect().GetCenter(); }
        }

        // 举卡待选：无目标吸附时卡滑到屏中锚位 (W/2, H - 手牌区高*0.375)、缩放 0.75（指数平滑 delta*7/8）
        var handTop = _handDock.GetGlobalRect().Position.Y;
        var anchor = new Vector2(screenSize.X * 0.5f, screenSize.Y - (screenSize.Y - handTop) * 0.375f);
        var targetPos = anchor;
        if (_dragHoverEnemyId != null || _dragHoverSelf) targetPos = anchor + new Vector2(0, 30f); // 吸附时略微下沉示意锁定
        var dt = delta;
        _dragCardPos = Sts2Fx.Smooth(_dragCardPos, targetPos, dt, Sts2Fx.RatePosition, Sts2Fx.SnapPositionPx);
        _dragCardScale = Vector2.One * Sts2Fx.Smooth(_dragCardScale.X, 0.75f, dt, Sts2Fx.RateScale, Sts2Fx.SnapScale);
        card.GlobalPosition = _dragCardPos;
        card.Scale = _dragCardScale;
        card.Rotation = Mathf.LerpAngle(card.Rotation, 0f, (float)Mathf.Clamp(dt * Sts2Fx.RateRotation, 0.0, 1.0)); // 拖拽不旋转
        card.ZIndex = 100;

        // 19 节贝塞尔目标箭头：从卡顶中心到指针/吸附目标，敌红/友绿/空地金（网页 AIM_COLOR）
        var from = card.GlobalPosition + new Vector2(card.Size.X * card.Scale.X * 0.5f, 0);
        var color = _dragHoverEnemyId != null || kind == "enemy" ? AimArrowLayer.EnemyColor
            : _dragHoverSelf || kind == "self" ? AimArrowLayer.SelfColor
            : AimArrowLayer.AnyColor;
        if (kind == "none") _aimArrow.Hide();
        else _aimArrow.Show(from, head, color); // 箭头层与屏同原点（FullRect），全局坐标即局部坐标
    }

    // ================================================================
    // 敌方回合演出：手牌下沉 100px+变灰 0.2s CubicOut → 回合一恢复 0.38s；
    // 结束回合按钮隐藏（+250px 下滑 0.5s ExpoOut）/出现（0.5s BackOut）（NPlayerHand/NEndTurnButton）
    // ================================================================

    private void BeginEnemyPhasePresentation(System.Action resolve)
    {
        if (_endTurnPending) return;
        _endTurnPending = true;
        resolve();
        var dockBase = _handDock.Position;
        var sink = CreateTween();
        sink.TweenProperty(_handDock, "position:y", dockBase.Y + Sts2Fx.HandSinkPx, Sts2Fx.HandSinkSeconds)
            .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        sink.Parallel().TweenProperty(_handDock, "modulate", new Color(0.55f, 0.58f, 0.58f, 0.25f), Sts2Fx.HandSinkSeconds);
        var buttonBase = _endTurnButton.Position;
        var hide = CreateTween();
        hide.TweenProperty(_endTurnButton, "position:y", buttonBase.Y + Sts2Fx.EndTurnHidePx, Sts2Fx.EndTurnHideSeconds)
            .SetTrans(Tween.TransitionType.Expo).SetEase(Tween.EaseType.Out);
        hide.Parallel().TweenProperty(_endTurnButton, "modulate:a", 0.08f, Sts2Fx.EndTurnHideSeconds);
        _endTurnButton.Disabled = true;
        BreathingFx.StopGlow(_endTurnGlow);
        GetTree().CreateTimer(0.62).Timeout += () =>
        {
            if (!IsInstanceValid(_handDock) || !_endTurnPending) return;
            var restore = CreateTween();
            restore.TweenProperty(_handDock, "position:y", dockBase.Y, Sts2Fx.HandRestoreSeconds)
                .SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
            restore.Parallel().TweenProperty(_handDock, "modulate", Colors.White, Sts2Fx.HandRestoreSeconds);
            var show = CreateTween();
            show.TweenProperty(_endTurnButton, "position:y", buttonBase.Y, Sts2Fx.EndTurnHideSeconds)
                .SetTrans(Tween.TransitionType.Back).SetEase(Tween.EaseType.Out);
            show.Parallel().TweenProperty(_endTurnButton, "modulate:a", 1f, 0.3);
            _endTurnButton.Disabled = false;
            BreathingFx.StartGlow(_endTurnGlow);
            _endTurnPending = false;
        };
    }

    // ================================================================
    // 快照应用 + diff 反馈引擎（网页 takeFloats/takeCardAnims 消费口径的同步等价）
    // ================================================================

    private void ApplySnapshot(BattleUiSnapshot snapshot)
    {
        if (_turnLabel == null) return;
        // 音频信号（接口 [7a→A]）：引擎待播键逐个消费（hit/hurt/parry/curse/card/strike/flee/victory/defeat）
        foreach (var key in snapshot.SfxRequests) _audio?.PlaySfx(key);

        _turnLabel.Text = $"回合 {snapshot.Turn}";
        if (snapshot.Energy != _prevEnergy)
        {
            _energyOrb.SetEnergy(snapshot.Energy, snapshot.MaxEnergy);
            if (_prevEnergy >= 0) _energyOrb.Pulse(); // 能量增减脉冲（网页 380ms brightness）
            _prevEnergy = snapshot.Energy;
        }
        _statusLabel.Text = snapshot.StatusText;
        _playerTargetId = string.IsNullOrWhiteSpace(snapshot.PlayerTargetId) ? "player" : snapshot.PlayerTargetId;
        _handCardIds = snapshot.HandCardIds; _handInfuseCounts = snapshot.HandCardInfuseCounts; _handTargetKinds = snapshot.HandCardTargetKinds;
        _pendingCardIndex = -1; _pendingTargetKind = "none"; _fuelIndices.Clear();
        SyncHand(snapshot);
        UpdatePlayerVisual(snapshot);
        UpdateEnemyVisuals(snapshot);
        // 飞牌结算先于牌堆 diff 落账（去向判定依赖消耗堆是否增长）
        if (_flyContext.HasValue) ResolveFlyContext(snapshot);
        UpdatePiles(snapshot);
        SetPlayableFromSnapshot(snapshot);
    }

    private void SyncHand(BattleUiSnapshot snapshot)
    {
        var before = _handLayout.Count;
        _handLayout.SetCards(snapshot.HandCardLabels);
        var after = _handLayout.Count;
        // 回合结束倾倒整手 → 弃牌堆飞卡（网页 kind 'dump'）；抽牌由 SetCards 的牌堆滑入通道呈现
        if (_endTurnPending && before > after && before > 0)
        {
            for (var i = after; i < before; i++)
            {
                var rect = CardGlobalRect(i);
                if (rect.HasValue) LaunchCardGhost(rect.Value, PileGlobalCenter(_discardPileButton), $"手牌 {i}");
            }
        }
    }

    private void UpdatePlayerVisual(BattleUiSnapshot snapshot)
    {
        _playerStateLabel.Text = $"HP {snapshot.PlayerHp} / {snapshot.PlayerMaxHp}   护盾 {snapshot.PlayerBlock}";
        var ratio = snapshot.PlayerMaxHp <= 0 ? 0f : Mathf.Clamp(snapshot.PlayerHp / (float)snapshot.PlayerMaxHp, 0f, 1f);
        _playerHpFill.SetAnchorsPreset(LayoutPreset.LeftWide);
        _playerHpFill.AnchorRight = ratio;
        var portrait = AssetLibrary.CharacterPortrait(snapshot.CharacterId); // character art follows the active Core id
        if (_playerFigure is TextureRect image) image.Texture = GD.Load<Texture2D>(portrait);

        if (_prevPlayerHp >= 0)
        {
            var center = _playerFigure.GetGlobalRect().GetCenter();
            var totalBefore = _prevPlayerHp + _prevPlayerBlock;
            var totalNow = snapshot.PlayerHp + snapshot.PlayerBlock;
            if (totalNow < totalBefore)
            {
                // 我方受击：抖自己 + 红闪 + 粒子 + 飘字（网页 spawnFloats isSelf 分支）
                var lost = totalBefore - totalNow;
                HitShake.Shake(_playerShake);
                HitBurst.Burst(_vfxLayer, center, HitBurst.Kind.Hurt);
                _hurtFlash.Flash();
                FloatingText.Spawn(_vfxLayer, $"-{lost}", center, FloatKind.Damage);
            }
            else if (snapshot.PlayerHp > _prevPlayerHp)
            {
                var healed = snapshot.PlayerHp - _prevPlayerHp;
                HitBurst.Burst(_vfxLayer, center, HitBurst.Kind.Heal);
                FloatingText.Spawn(_vfxLayer, $"+{healed}", center, FloatKind.Heal);
            }
            else if (snapshot.PlayerBlock > _prevPlayerBlock)
            {
                FloatingText.Spawn(_vfxLayer, $"盾 +{snapshot.PlayerBlock - _prevPlayerBlock}", center, FloatKind.Block);
            }
        }
        _prevPlayerHp = snapshot.PlayerHp; _prevPlayerBlock = snapshot.PlayerBlock;
    }

    private void UpdateEnemyVisuals(BattleUiSnapshot snapshot)
    {
        if (snapshot.Enemies.Length == 0)
        {
            if (_enemyViews.Count == 0 && _enemyList.GetChildCount() <= 1)
                _enemyList.AddChild(UiTheme.Label("敌方单位为零", 14, UiTheme.Muted));
            return;
        }
        foreach (var child in _enemyList.GetChildren())
            if (child is Label emptyHint && child != _enemyList.GetChild(0)) child.QueueFree(); // 清空态提示

        var seen = new HashSet<string>();
        foreach (var enemy in snapshot.Enemies)
        {
            seen.Add(enemy.Id);
            if (!_enemyViews.TryGetValue(enemy.Id, out var view))
            {
                view = CreateEnemyView(enemy);
                _enemyViews[enemy.Id] = view;
                _enemyList.AddChild(view.Root);
            }
            var figureCenter = view.Figure.GetGlobalRect().GetCenter();
            var intentText = enemy.Attack > 0 ? $"⚔ 意图 {enemy.Attack}" : "◈ 蓄力中";
            if (view.Intent.Text != intentText) view.Intent.Text = intentText;
            view.State.Text = $"{enemy.Name}  HP {enemy.Hp}/{enemy.MaxHp}  护盾 {enemy.Block}";
            var ratio = enemy.MaxHp <= 0 ? 0f : Mathf.Clamp(enemy.Hp / (float)enemy.MaxHp, 0f, 1f);
            view.HpFill.AnchorRight = ratio;
            view.HpFill.Color = ratio > 0.5f ? new Color("7ec9a0") : ratio > 0.25f ? new Color("e0b34d") : new Color("e0523c");
            if (enemy.Defeated && view.Root.Modulate == Colors.White)
            {
                // 击杀：1s 灰化塌缩（网页 fx-die 的近似——modulate 暗化+轻旋）
                view.Intent.Visible = false;
                var die = view.Root.CreateTween();
                die.TweenProperty(view.Root, "modulate", new Color(0.55f, 0.58f, 0.58f, 0.32f), 1.0);
                die.Parallel().TweenProperty(view.Root, "rotation", Mathf.DegToRad(6f), 1.0).SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
                HitBurst.Burst(_vfxLayer, figureCenter, HitBurst.Kind.Hit);
            }

            if (_prevEnemy.TryGetValue(enemy.Id, out var prev))
            {
                var totalBefore = prev.Hp + prev.Block;
                var totalNow = enemy.Hp + enemy.Block;
                if (totalNow < totalBefore)
                {
                    // 命中：抖受击者 + 打击粒子 + 伤害飘字（网页 spawnFloats 敌人分支）
                    var lost = totalBefore - totalNow;
                    HitShake.Shake(view.Shake);
                    HitBurst.Burst(_vfxLayer, figureCenter, HitBurst.Kind.Hit);
                    FloatingText.Spawn(_vfxLayer, $"-{lost}", figureCenter, FloatKind.Damage);
                }
                else if (enemy.Block > prev.Block)
                {
                    FloatingText.Spawn(_vfxLayer, $"盾 +{enemy.Block - prev.Block}", figureCenter, FloatKind.Block);
                }
            }
            _prevEnemy[enemy.Id] = (enemy.Hp, enemy.Block);
        }
        foreach (var stale in _enemyViews.Keys.Where(id => !seen.Contains(id)).ToList()) _enemyViews.Remove(stale);
    }

    private UnitView CreateEnemyView(BattleEnemyUiSnapshot enemy)
    {
        var panel = new PanelContainer();
        panel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        panel.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("3a2a2c"), 10, new Color("6b4a4a"), 1));
        var content = ScreenChrome.Column(panel, 4);
        var view = new UnitView { Id = enemy.Id, Root = panel, Shake = content };

        var intentWrap = new Control { CustomMinimumSize = new Vector2(0, 24), MouseFilter = Control.MouseFilterEnum.Ignore };
        view.Intent = UiTheme.Label("◈ 蓄力中", 13, new Color("e8d8b0"));
        view.Intent.HorizontalAlignment = HorizontalAlignment.Center;
        intentWrap.AddChild(view.Intent);
        view.Intent.SetAnchorsPreset(LayoutPreset.TopWide);
        content.AddChild(intentWrap);
        IntentFloat.Attach(view.Intent); // 意图浮动 sin(t·π+phase)·10+8

        var figure = new TextureRect { Texture = GD.Load<Texture2D>("res://assets/icons/battle.svg"), CustomMinimumSize = new Vector2(72, 64), ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered, MouseFilter = Control.MouseFilterEnum.Ignore };
        view.Figure = figure;
        content.AddChild(figure);

        content.AddChild(MakeHpBar(out view.HpFill));
        view.State = UiTheme.Label($"{enemy.Name}", 14, UiTheme.Muted); content.AddChild(view.State);
        var id = enemy.Id;
        panel.GuiInput += (@event) =>
        {
            if (@event is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left }) SelectEnemyTarget(id);
        };
        panel.TooltipText = $"{enemy.Name}：点击指定为敌方目标";
        return view;
    }

    private void UpdatePiles(BattleUiSnapshot snapshot)
    {
        _drawPileButton.Text = $"▣\n牌库\n{snapshot.DrawPileCount}";
        _discardPileButton.Text = $"▤\n弃牌\n{snapshot.DiscardPileCount}";
        _exhaustPileButton.Text = $"◇\n消耗\n{snapshot.ExhaustPileCount}";
        if (_prevDraw >= 0)
        {
            if (snapshot.DrawPileCount < _prevDraw) PilePulse(_drawPileButton);            // 抽牌脉冲（pile-pulse 1.5s）
            if (snapshot.ExhaustPileCount > _prevExhaust) PilePulse(_exhaustPileButton);   // 消耗入堆 bump
            // 洗牌：弃牌堆缩水、牌库回填 → 洗牌飞卡 + 牌库旋光（网页 pile-shuffle/sts-cardfly pile-fly）
            if (snapshot.DrawPileCount > _prevDraw && snapshot.DiscardPileCount < _prevDiscard && _prevDiscard > 0)
                ShuffleFly();
        }
        _prevDraw = snapshot.DrawPileCount; _prevDiscard = snapshot.DiscardPileCount; _prevExhaust = snapshot.ExhaustPileCount;
    }

    /// <summary>可打卡高亮：费用（快照标签 [n] 后缀）≤ 能量 → 辉环常亮；否则 .off 压暗。</summary>
    private void SetPlayableFromSnapshot(BattleUiSnapshot snapshot)
    {
        var mask = new bool[_handLayout.Count];
        for (var i = 0; i < _handLayout.Count; i++)
        {
            var cost = ParseCost(snapshot.HandCardLabels, i);
            mask[i] = cost >= 0 && cost <= snapshot.Energy;
        }
        _handLayout.SetPlayable(mask);
    }

    private static int ParseCost(IReadOnlyList<string> labels, int index)
    {
        if (index < 0 || index >= labels.Count) return -1;
        var label = labels[index] ?? "";
        var open = label.LastIndexOf('[');
        var close = label.LastIndexOf(']');
        return open >= 0 && close > open && int.TryParse(label.Substring(open + 1, close - open - 1), out var cost) ? cost : -1;
    }

    // ================================================================
    // 飞牌（sts2-reference §1 NCardFlyVfx：二次贝塞尔+变加速+切线旋转+前 1/3 白→黑，CardFlyVfx 组件）
    // ================================================================

    private void ResolveFlyContext(BattleUiSnapshot snapshot)
    {
        var (cardId, sourceGlobal, kind, targetId) = _flyContext!.Value;
        _flyContext = null;
        if (snapshot.HandCardIds.Contains(cardId)) return; // 打出又回手（不朽斩族）：不演飞卡
        Vector2 destination;
        if (snapshot.ExhaustPileCount > _prevExhaust || kind == "exhaust")
            destination = PileGlobalCenter(_exhaustPileButton);   // 消耗 → 消耗堆按钮
        else if (targetId != null && _enemyViews.TryGetValue(targetId, out var view))
            destination = view.Figure.GetGlobalRect().GetCenter(); // 指向打出 → 目标立绘（网页 exitSinkFor）
        else if (kind == "self")
            destination = _playerFigure.GetGlobalRect().GetCenter();
        else
            destination = PileGlobalCenter(_discardPileButton);    // 常规打出 → 弃牌堆按钮
        LaunchCardGhost(sourceGlobal, destination, cardId);
    }

    private Vector2 PileGlobalCenter(Button pile) => pile.GetGlobalRect().GetCenter();

    /// <summary>放一张 ghost 卡沿贝塞尔飞向目的地；到达时目的牌堆 bump（网页 fly.onfinish → pile 反馈）。</summary>
    private void LaunchCardGhost(Rect2 sourceGlobal, Vector2 destination, string label)
    {
        if (sourceGlobal.Size.X <= 1) return;
        var ghost = MakeGhost(sourceGlobal.Size, label);
        _vfxLayer.AddChild(ghost);
        ghost.GlobalPosition = sourceGlobal.Position;
        // 弧向：目标在上半屏 → 上弓 -500（sts2 arcDir）；下半屏间互飞（牌堆按钮/目标立绘同层）→
        // 网页 bow=-min(130,dist·0.28) 恒上弓，取近似 -350 避免弧线出画
        float? arc = destination.Y < 540f ? null : (sourceGlobal.GetCenter().Y > 540f ? -350f : null);
        CardFlyVfx.Launch(_vfxLayer, ghost, destination, arcOffsetY: arc, onArrive: () =>
        {
            if (destination.DistanceTo(PileGlobalCenter(_discardPileButton)) < 8f) PilePulse(_discardPileButton);
            else if (destination.DistanceTo(PileGlobalCenter(_exhaustPileButton)) < 8f) PilePulse(_exhaustPileButton);
            ghost.QueueFree();
        });
    }

    private Control MakeGhost(Vector2 size, string label)
    {
        var ghost = new Panel { MouseFilter = Control.MouseFilterEnum.Ignore, CustomMinimumSize = size, Size = size };
        ghost.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("24424f"), 8, new Color("607c86"), 1));
        var column = new VBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        UiTheme.FullRect(column);
        column.AddThemeConstantOverride("separation", 2);
        ghost.AddChild(column);
        var icon = new TextureRect { Texture = GD.Load<Texture2D>(CardHandLayout.ArtPathForIndex(label.Length)), ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered, MouseFilter = Control.MouseFilterEnum.Ignore, SizeFlagsVertical = Control.SizeFlags.ExpandFill };
        column.AddChild(icon);
        var name = UiTheme.Label(label, 12, UiTheme.Frost);
        name.HorizontalAlignment = HorizontalAlignment.Center;
        name.ClipText = true;
        column.AddChild(name);
        return ghost;
    }

    /// <summary>洗牌飞卡：卡背从手牌区中央旋飞向牌库图标（1.2s 三段路径+旋转，网页 pile-fly 关键帧）。</summary>
    private void ShuffleFly()
    {
        var handCenter = _handDock.GetGlobalRect().GetCenter();
        var destination = PileGlobalCenter(_drawPileButton);
        var ghost = MakeGhost(new Vector2(110, 150), "洗牌");
        ghost.AddThemeStyleboxOverride("panel", UiTheme.Box(new Color("2c3e66"), 8, new Color("d8c79a"), 2));
        _vfxLayer.AddChild(ghost);
        ghost.GlobalPosition = handCenter - ghost.Size * 0.5f;
        ghost.PivotOffset = ghost.Size * 0.5f;
        ghost.Modulate = new Color(1, 1, 1, 0.25f);
        var dx = destination.X - handCenter.X;
        var dy = destination.Y - handCenter.Y;
        var tween = CreateTween();
        tween.TweenMethod(Callable.From<float>(t =>
        {
            // 三段关键帧等价：0 → 0.55（中途上抬 -70px、旋转 160°）→ 1（旋转 346°、缩 0.35）
            if (t < 0.55f)
            {
                var u = t / 0.55f;
                ghost.GlobalPosition = handCenter - ghost.Size * 0.5f + new Vector2(dx * 0.55f, dy * 0.55f - 70f) * u;
                ghost.RotationDegrees = Mathf.Lerp(-14f, 160f, u);
                ghost.Scale = Vector2.One * Mathf.Lerp(1f, 0.82f, u);
                ghost.Modulate = new Color(1, 1, 1, Mathf.Lerp(0.25f, 1f, u));
            }
            else
            {
                var u = (t - 0.55f) / 0.45f;
                ghost.GlobalPosition = handCenter - ghost.Size * 0.5f + new Vector2(dx * 0.55f, dy * 0.55f - 70f)
                    + new Vector2(dx * 0.45f, dy * 0.45f + 70f) * u;
                ghost.RotationDegrees = Mathf.Lerp(160f, 346f, u);
                ghost.Scale = Vector2.One * Mathf.Lerp(0.82f, 0.35f, u);
                ghost.Modulate = new Color(1, 1, 1, Mathf.Lerp(1f, 0.05f, u));
            }
        }), 0.0f, 1.0f, 1.2);
        tween.SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.InOut);
        tween.Finished += () =>
        {
            PilePulse(_drawPileButton);
            ghost.QueueFree();
        };
    }

    /// <summary>牌堆 bump：0.05s 弹起 1.15 → 0.5s ExpoOut 回落（NCombatCardPile bump 模式）。</summary>
    private void PilePulse(Button pile)
    {
        pile.PivotOffset = pile.Size * 0.5f;
        var tween = CreateTween();
        tween.TweenProperty(pile, "scale", Vector2.One * 1.15f, Sts2Fx.ButtonPopS);
        tween.TweenProperty(pile, "scale", Vector2.One, Sts2Fx.ButtonSettleS)
            .SetTrans(Tween.TransitionType.Expo).SetEase(Tween.EaseType.Out);
        var flash = CreateTween();
        flash.TweenProperty(pile, "modulate", new Color(1.5f, 1.45f, 1.3f), 0.08);
        flash.TweenProperty(pile, "modulate", Colors.White, 0.4);
    }

    // ================================================================
    // 验收演示时间线（--battle-demo=<hit|damage|fly|energy|drag>）：驱动真实组件供 --shot 取证
    // ================================================================

    private void ParseDemoArg()
    {
        foreach (var arg in OS.GetCmdlineUserArgs())
        {
            if (arg.StartsWith("--battle-demo=", System.StringComparison.Ordinal))
                _demoMode = arg.Substring("--battle-demo=".Length);
        }
        if (_demoMode == null) return;
        if (_demoMode == "drag") return; // drag 演示是静态姿态，在 EnsureDemoEnemies 后直接进入
        GetTree().CreateTimer(0.5).Timeout += () =>
        {
            if (IsInsideTree()) ScheduleDemoLoop();
        };
    }

    private void ScheduleDemoLoop()
    {
        FireDemo();
        GetTree().CreateTimer(1.4).Timeout += () => { if (IsInsideTree() && _demoMode != "drag") ScheduleDemoLoop(); };
    }

    private UnitView DemoEnemy()
    {
        if (_enemyViews.Count == 0) EnsureDemoEnemies();
        return _enemyViews.Values.First();
    }

    private void EnsureDemoEnemies()
    {
        foreach (var child in _enemyList.GetChildren())
            if (child is Label && child != _enemyList.GetChild(0)) child.QueueFree();
        var wolf = CreateEnemyView(new BattleEnemyUiSnapshot { Id = "demo-fang", Name = "霜牙狼", Hp = 24, MaxHp = 24, Block = 0, Attack = 6 });
        wolf.Intent.Text = "⚔ 意图 6";
        wolf.State.Text = "霜牙狼  HP 24/24  护盾 0";
        _enemyList.AddChild(wolf.Root);
        var beetle = CreateEnemyView(new BattleEnemyUiSnapshot { Id = "demo-shell", Name = "苔背甲虫", Hp = 30, MaxHp = 30, Block = 4, Attack = 4 });
        beetle.State.Text = "苔背甲虫  HP 30/30  护盾 4";
        _enemyList.AddChild(beetle.Root);
        _prevEnemy["demo-fang"] = (24, 0);
        _prevEnemy["demo-shell"] = (30, 4);
    }

    private void FireDemo()
    {
        if (!IsInsideTree()) return;
        var enemy = DemoEnemy();
        switch (_demoMode)
        {
            case "damage":
            {
                // 伤害/治疗飘字 + 打击粒子（敌人 -12 / 我方 +6 暖色）
                var center = enemy.Figure.GetGlobalRect().GetCenter();
                HitBurst.Burst(_vfxLayer, center, HitBurst.Kind.Hit);
                FloatingText.Spawn(_vfxLayer, "-12", center, FloatKind.Damage);
                var selfCenter = _playerFigure.GetGlobalRect().GetCenter();
                HitBurst.Burst(_vfxLayer, selfCenter, HitBurst.Kind.Heal);
                FloatingText.Spawn(_vfxLayer, "+6", selfCenter, FloatKind.Heal);
                break;
            }
            case "hit":
            {
                // 受击抖动（抖受击者）+ 我方红闪 + 盾格挡数字
                HitShake.Shake(enemy.Shake);
                HitBurst.Burst(_vfxLayer, enemy.Figure.GetGlobalRect().GetCenter(), HitBurst.Kind.Hit);
                FloatingText.Spawn(_vfxLayer, "-9", enemy.Figure.GetGlobalRect().GetCenter(), FloatKind.Damage);
                HitShake.Shake(_playerShake);
                _hurtFlash.Flash();
                HitBurst.Burst(_vfxLayer, _playerFigure.GetGlobalRect().GetCenter(), HitBurst.Kind.Hurt);
                FloatingText.Spawn(_vfxLayer, "-5", _playerFigure.GetGlobalRect().GetCenter(), FloatKind.Damage);
                FloatingText.Spawn(_vfxLayer, "盾 +4", _playerFigure.GetGlobalRect().GetCenter(), FloatKind.Block);
                break;
            }
            case "fly":
            {
                // 出手飞行：手牌第一张 → 弃牌堆按钮（贝塞尔+变加速+切线旋转）
                var rect = CardGlobalRect(0);
                if (rect.HasValue) LaunchCardGhost(rect.Value, PileGlobalCenter(_discardPileButton), "初始攻击  [1]");
                break;
            }
            case "energy":
            {
                // 能量消耗脉冲 + 牌堆 bump
                _energyOrb.SetEnergy(1, 3);
                _energyOrb.Pulse();
                PilePulse(_discardPileButton);
                break;
            }
        }
    }

    /// <summary>drag 演示：静态举卡待选 + 19 节目标箭头指向敌人（取证帧用）。</summary>
    private void StartDragDemo()
    {
        var card = _handLayout.CardAt(0)!;
        _dragCard = card;
        _handLayout.SetFollowerSuspended(card, true); // 演示期冻结三通道（不设 _dragIndex，避免 UpdateDrag 按鼠标覆盖静态姿态）
        card.PivotOffset = _handLayout.CardSizePx * 0.5f;
        var screenSize = GetViewportRect().Size;
        var handTop = _handDock.GetGlobalRect().Position.Y;
        card.GlobalPosition = new Vector2(screenSize.X * 0.5f - _handLayout.CardSizePx.X * 0.375f, screenSize.Y - (screenSize.Y - handTop) * 0.375f);
        card.Scale = Vector2.One * 0.75f;
        card.Rotation = 0f;
        card.ZIndex = 100;
        var head = DemoEnemy().Figure.GetGlobalRect().GetCenter();
        var from = card.GlobalPosition + new Vector2(_handLayout.CardSizePx.X * 0.75f * 0.5f, 0);
        _aimArrow.Show(from, head, AimArrowLayer.EnemyColor);
    }

    private void TickDemo(double delta)
    {
        _demoT += delta;
        if (_demoMode == "drag" && _demoT > 0.2 && _aimArrow != null && !_aimArrow.Visible)
        {
            // drag 姿态等布局稳定后进入（_Ready 后两帧）
            _demoMode = null; // 只进一次
            StartDragDemo();
        }
    }
}
