using Godot;
using SoudacheGodot.UI.Fx;
using System.Collections.Generic;
using System.Linq;

namespace SoudacheGodot.UI;

/// Presentation hand bar using the reference hand-position pattern.
/// Card identity/effects stay outside this control and arrive through snapshots.
/// 动效（wave1 批次 6a，sts2-reference §1）：
/// - 位置/缩放/旋转由 SmoothFollower 指数平滑三通道收敛（delta*7/8/10）；
/// - hover：角度/缩放瞬时归零/到 1.0，Y = -(卡高*0.5)+2，ZIndex 置顶；
/// - 退出 hover：0.5s ExpoOut 回落到分段缩放（0.8 基准）；
/// - 邻卡推挤：push = Lerp(100, 0, min(1, |hoverIdx-i|/4)) px，方向 = sign(hoverIdx-i)；
/// - 新抽的牌从牌堆锚点平滑滑入（无专门 tween）。
/// 批次 6c 增补（sts2-reference §1 拖拽 / §5 可打高亮）：
/// - 拖拽：按住 >6px 启动（网页 moveAim 阈值 6px），拖拽卡脱离三通道（不旋转/缩放由宿主管），
///   松手 CardDragEnd 回报宿主决策，follower 恢复平滑收回；
/// - 可打卡 PlayableGlow 辉环（width 0.075/闪光 0.15），不可打卡 .off 压暗+下沉 12px（battle.css）。
public partial class CardHandLayout : Control
{
    [Signal]
    public delegate void CardSelectedEventHandler(int index, string cardLabel);

    /// <summary>拖拽启动（按住位移 >6px）；宿主接管该卡定位。</summary>
    public event System.Action<int>? CardDragBegin;
    /// <summary>拖拽松手（无论是否打出）；宿主决策后 follower 恢复。</summary>
    public event System.Action<int>? CardDragEnd;

    private static readonly Vector2 CardSize = new(142, 180);
    public static readonly float DragBeginPx = 6f;   // 网页 startAim：位移 <6px 算轻点

    private readonly List<Button> _cards = new();
    private readonly List<string> _labels = new();
    private readonly Dictionary<Button, SmoothFollower> _followers = new();
    private readonly Dictionary<Button, PlayableGlow> _glows = new();
    private readonly List<bool> _playable = new();
    private int _hoverIndex = -1;
    private int _pressingIndex = -1;
    private int _dragIndex = -1;
    private Vector2 _pressGlobal;

    public override void _Ready()
    {
        Resized += LayoutCards;
        LayoutCards();
    }

    public void SetCards(IReadOnlyList<string> cardNames)
    {
        _labels.Clear();
        for (var i = 0; i < cardNames.Count; i++) _labels.Add(cardNames[i]);

        // 缩编：优先移除隐藏槽位（拖拽打出的卡已隐藏），否则移除末位
        while (_cards.Count > cardNames.Count)
        {
            var victim = _cards.FirstOrDefault(c => !c.Visible) ?? _cards[^1];
            _followers.Remove(victim);
            _glows.Remove(victim);
            _cards.Remove(victim);
            victim.QueueFree();
        }
        foreach (var reused in _cards) reused.Visible = true; // 剩余槽位全部复用
        if (_dragIndex >= _cards.Count) _dragIndex = -1;
        if (_hoverIndex >= _cards.Count) _hoverIndex = -1;
        if (_pressingIndex >= _cards.Count) _pressingIndex = -1;

        for (var i = 0; i < cardNames.Count; i++)
        {
            if (i < _cards.Count)
            {
                FillCard(_cards[i], cardNames[i], i);
                continue;
            }
            var cardLabel = cardNames[i];
            var card = UiTheme.Button($"—\n{cardLabel}", CardSize);
            FillCard(card, cardLabel, i);
            var index = i;
            card.Pressed += () => EmitSignal(SignalName.CardSelected, index, _labels[index]);
            var captured = i;
            card.MouseEntered += () => Hover(captured);
            card.MouseExited += () => Unhover(captured);
            card.GuiInput += (@event) => OnCardGuiInput(captured, @event);
            card.ButtonDown += () => FlashGlow(captured); // 可打卡点击闪光（width 0.15）

            var follower = SmoothFollower.Attach(card);
            follower.TargetPosition = DeckAnchor; // 新牌生成在牌堆处，靠平滑通道滑入
            card.Position = DeckAnchor;
            follower.SnapAll();
            AddChild(card);
            _cards.Add(card);
            _followers[card] = follower;
        }
        SyncPlayableGlow();
        LayoutCards();
    }

    /// <summary>可打性掩码（费用≤能量）：可打挂 PlayableGlow 辉环，不可打 .off 压暗。</summary>
    public void SetPlayable(IReadOnlyList<bool> playable)
    {
        _playable.Clear();
        for (var i = 0; i < playable.Count; i++) _playable.Add(playable[i]);
        SyncPlayableGlow();
        UpdateTargets();
    }

    private void SyncPlayableGlow()
    {
        for (var i = 0; i < _cards.Count; i++)
        {
            var card = _cards[i];
            if (!_glows.TryGetValue(card, out var glow))
            {
                glow = PlayableGlow.AttachCard(card);
                glow.ShowBehindParent = false;
                _glows[card] = glow;
            }
            var playable = i < _playable.Count && _playable[i];
            glow.SetPlayable(playable);
            if (ModulateState(i) == SelectionState.Normal)
                card.Modulate = playable ? Colors.White : DimModulate; // battle.css .off brightness(.55)
        }
    }

    private void FlashGlow(int index)
    {
        if (index < 0 || index >= _cards.Count) return;
        if (_glows.TryGetValue(_cards[index], out var glow)) glow.Flash();
    }

    private static readonly Color DimModulate = new(0.55f, 0.62f, 0.62f); // battle.css .off 压暗近似（含降饱和感）

    private enum SelectionState { Normal, Selected }

    private SelectionState ModulateState(int index) =>
        index < _cards.Count && _cards[index].Modulate == new Color(1.0f, 0.82f, 0.45f)
            ? SelectionState.Selected : SelectionState.Normal;

    // ---- 拖拽（网页 startAim/moveAim：按住 >6px 进入指向；松手由宿主结算） ----

    private void OnCardGuiInput(int index, InputEvent @event)
    {
        if (@event is InputEventMouseButton { ButtonIndex: MouseButton.Left } press)
        {
            if (press.Pressed)
            {
                _pressingIndex = index;
                _pressGlobal = GetGlobalMousePosition();
            }
            else
            {
                if (_dragIndex == index)
                {
                    _dragIndex = -1;
                    CardDragEnd?.Invoke(index);
                }
                if (_pressingIndex == index) _pressingIndex = -1;
            }
            return;
        }
        if (@event is InputEventMouseMotion motion && _pressingIndex == index)
        {
            if (_dragIndex < 0 && GetGlobalMousePosition().DistanceTo(_pressGlobal) > DragBeginPx)
            {
                _dragIndex = index;
                if (_hoverIndex == index)
                {
                    SettleScale(index); // 拖拽开始：退出 hover 升起态
                    _hoverIndex = -1;
                }
                CardDragBegin?.Invoke(index);
            }
            _ = motion; // 拖拽中的跟手定位由宿主 _Process 完成（举卡锚位/目标吸附）
        }
    }

    public bool IsDragging => _dragIndex >= 0;
    public int DragIndex => _dragIndex;

    /// <summary>拖拽结束/取消后恢复平滑通道（follower 目标已由 UpdateTargets 刷新）。</summary>
    public void ReleaseDrag()
    {
        _dragIndex = -1;
        _pressingIndex = -1;
        LayoutCards();
    }

    // ---- 宿主访问器 ----

    public int Count => _cards.Count;
    public Vector2 CardSizePx => CardSize;
    public Control? CardAt(int index) => index >= 0 && index < _cards.Count ? _cards[index] : null;
    public SmoothFollower? FollowerAt(int index) =>
        index >= 0 && index < _cards.Count && _followers.TryGetValue(_cards[index], out var f) ? f : null;

    /// <summary>拖拽期间冻结三通道（宿主直接定位卡片）；按卡引用（快照缩编后索引会漂移）。</summary>
    public void SetFollowerSuspended(Control? card, bool suspended)
    {
        if (card is Button button && _followers.TryGetValue(button, out var follower)) follower.Suspended = suspended;
    }

    /// <summary>卡牌美术（ghost 飞卡复用）；与 FillCard 同表。</summary>
    public static string ArtPathForIndex(int index) =>
        $"res://assets/cards/{new[] { "unknown.webp", "spell.webp", "resource-material.webp", "hero.webp", "equipment-weapon.webp" }[index % 5]}";

    public void SetCardSelected(int index, bool selected)
    {
        if (index < 0 || index >= _cards.Count) return;
        // 选中金着色优先；未选中时按可打性决定是否压暗（battle.css .off）
        var playable = index >= _playable.Count || _playable[index];
        _cards[index].Modulate = selected ? new Color(1.0f, 0.82f, 0.45f) : (playable ? Colors.White : DimModulate);
    }

    private void FillCard(Button card, string cardLabel, int index)
    {
        var art = new[] { "unknown.webp", "spell.webp", "resource-material.webp", "hero.webp", "equipment-weapon.webp" }[index % 5];
        card.Text = $"—\n{cardLabel}";
        card.Icon = GD.Load<Texture2D>($"res://assets/cards/{art}");
        card.ExpandIcon = true;
        card.AddThemeFontSizeOverride("font_size", 15);
        card.TooltipText = $"卡牌：{cardLabel}";
    }

    private Vector2 DeckAnchor => new(Size.X - 60f, Size.Y + 80f);

    private Vector2 RestPosition(int count, int i)
    {
        var cardWidth = CardSize.X;
        var referenceScale = Mathf.Min(1f, Mathf.Max(0.35f, (Size.X - cardWidth - 16f) / 1220f));
        var centerX = Size.X * 0.5f;
        var reference = ReferenceHandGeometry.Supports(count)
            ? ReferenceHandGeometry.GetPosition(count, i)
            : new Vector2((i - (count - 1) * 0.5f) * 120f, -50f);
        return new Vector2(
            centerX + reference.X * referenceScale - cardWidth * 0.5f,
            12f + (reference.Y + 50f) * 0.65f);
    }

    private float RestRotation(int count, int i)
        => ReferenceHandGeometry.Supports(count)
            ? ReferenceHandGeometry.GetPosition(count, i).X / 100f
            : 0f;

    private float RestScale(int count)
        => ReferenceHandGeometry.BaseHandScale * ReferenceHandGeometry.GetScaleFactor(count);

    private void LayoutCards() => UpdateTargets();

    /// <summary>重算全部目标：布局变化只改 target，收敛交给三通道平滑。</summary>
    private void UpdateTargets()
    {
        if (_cards.Count == 0 || Size.X <= 1) return;
        var count = _cards.Count;
        var restScale = RestScale(count);
        for (var i = 0; i < count; i++)
        {
            if (i == _dragIndex) continue; // 拖拽卡定位权在宿主（不旋转，缩放/位置由指向状态机给）
            var follower = _followers[_cards[i]];
            var off = i >= _playable.Count || _playable[i] ? Vector2.Zero : new Vector2(0, 12f); // .off 下沉 12px
            if (i == _hoverIndex)
            {
                // hover 卡：角度/缩放瞬时归零/到 1.0，Y = -(卡高*0.5)+2
                follower.TargetPosition = RestPosition(count, i) + new Vector2(0, -(CardSize.Y * 0.5f) + 2f);
                follower.TargetRotationDeg = 0f;
                follower.TargetScale = Vector2.One;
            }
            else
            {
                // 两侧卡推开 push = Lerp(100, 0, min(1, |hoverIdx-i|/4)) px，方向 = sign(hoverIdx-i)
                var push = Sts2Fx.HoverPush(i, _hoverIndex);
                follower.TargetPosition = RestPosition(count, i) + new Vector2(push, 0) + off;
                follower.TargetRotationDeg = RestRotation(count, i);
                follower.TargetScale = Vector2.One * restScale * (off == Vector2.Zero ? 1f : 0.97f);
            }
            _cards[i].PivotOffset = new Vector2(CardSize.X * 0.5f, CardSize.Y);
            _cards[i].ZIndex = i;
        }
        if (_hoverIndex >= 0 && _hoverIndex < count)
            _cards[_hoverIndex].ZIndex = 100; // hover 置顶
    }

    private void Hover(int index)
    {
        if (_dragIndex >= 0) return; // 拖拽中不响应 hover
        if (index < 0 || index >= _cards.Count) return;
        if (_hoverIndex >= 0 && _hoverIndex < _cards.Count && _hoverIndex != index)
            SettleScale(_hoverIndex); // 换 hover 时旧卡走 0.5s ExpoOut 回落
        _hoverIndex = index;
        var card = _cards[index];
        card.ZIndex = 100;
        _followers[card].ScaleInstant(Vector2.One); // 瞬时放大（无 tween）
        UpdateTargets();
    }

    private void Unhover(int index)
    {
        if (_hoverIndex != index) return;
        _hoverIndex = -1;
        SettleScale(index);
        UpdateTargets();
    }

    private void SettleScale(int index)
    {
        var card = _cards[index];
        card.ZIndex = index;
        _followers[card].ScaleSettle(Vector2.One * RestScale(_cards.Count)); // 0.5s ExpoOut 回落
    }
}
