using Godot;
using SoudacheGodot.UI.Fx;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// Presentation hand bar using the reference hand-position pattern.
/// Card identity/effects stay outside this control and arrive through snapshots.
/// 动效（wave1 批次 6a，sts2-reference §1）：
/// - 位置/缩放/旋转由 SmoothFollower 指数平滑三通道收敛（delta*7/8/10）；
/// - hover：角度/缩放瞬时归零/到 1.0，Y = -(卡高*0.5)+2，ZIndex 置顶；
/// - 退出 hover：0.5s ExpoOut 回落到分段缩放（0.8 基准）；
/// - 邻卡推挤：push = Lerp(100, 0, min(1, |hoverIdx-i|/4)) px，方向 = sign(hoverIdx-i)；
/// - 新抽的牌从牌堆锚点平滑滑入（无专门 tween）。
public partial class CardHandLayout : Control
{
    [Signal]
    public delegate void CardSelectedEventHandler(int index, string cardLabel);

    private static readonly Vector2 CardSize = new(142, 180);

    private readonly List<Button> _cards = new();
    private readonly List<string> _labels = new();
    private readonly Dictionary<Button, SmoothFollower> _followers = new();
    private int _hoverIndex = -1;

    public override void _Ready()
    {
        Resized += LayoutCards;
        LayoutCards();
    }

    public void SetCards(IReadOnlyList<string> cardNames)
    {
        _labels.Clear();
        for (var i = 0; i < cardNames.Count; i++) _labels.Add(cardNames[i]);

        // 缩编：多出的牌直接移除
        while (_cards.Count > cardNames.Count)
        {
            var removed = _cards[^1];
            _followers.Remove(removed);
            _cards.RemoveAt(_cards.Count - 1);
            removed.QueueFree();
        }

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

            var follower = SmoothFollower.Attach(card);
            follower.TargetPosition = DeckAnchor; // 新牌生成在牌堆处，靠平滑通道滑入
            card.Position = DeckAnchor;
            follower.SnapAll();
            AddChild(card);
            _cards.Add(card);
            _followers[card] = follower;
        }
        LayoutCards();
    }

    public void SetCardSelected(int index, bool selected)
    {
        if (index < 0 || index >= _cards.Count) return;
        _cards[index].Modulate = selected ? new Color(1.0f, 0.82f, 0.45f) : Colors.White;
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
            var follower = _followers[_cards[i]];
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
                follower.TargetPosition = RestPosition(count, i) + new Vector2(push, 0);
                follower.TargetRotationDeg = RestRotation(count, i);
                follower.TargetScale = Vector2.One * restScale;
            }
            _cards[i].PivotOffset = new Vector2(CardSize.X * 0.5f, CardSize.Y);
            _cards[i].ZIndex = i;
        }
        if (_hoverIndex >= 0 && _hoverIndex < count)
            _cards[_hoverIndex].ZIndex = 100; // hover 置顶
    }

    private void Hover(int index)
    {
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
