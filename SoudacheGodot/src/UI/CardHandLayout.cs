using Godot;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// Presentation hand bar using the reference hand-position pattern.
/// Card identity/effects stay outside this control and arrive through snapshots.
public partial class CardHandLayout : Control
{
    [Signal]
    public delegate void CardSelectedEventHandler(int index, string cardLabel);

    private readonly List<Button> _cards = new();
    private readonly Dictionary<Button, Vector2> _restingPositions = new();

    public override void _Ready()
    {
        Resized += LayoutCards;
        LayoutCards();
    }

    public void SetCards(IReadOnlyList<string> cardNames)
    {
        foreach (var card in _cards)
            card.QueueFree();
        _cards.Clear();
        _restingPositions.Clear();

        for (var i = 0; i < cardNames.Count; i++)
        {
            var cardLabel = cardNames[i];
            var card = UiTheme.Button($"—\n{cardLabel}", new Vector2(142, 180));
            var art = new[] { "unknown.webp", "spell.webp", "resource-material.webp", "hero.webp", "equipment-weapon.webp" }[i % 5];
            card.Icon = GD.Load<Texture2D>($"res://assets/cards/{art}");
            card.ExpandIcon = true;
            card.AddThemeFontSizeOverride("font_size", 15);
            card.TooltipText = $"卡牌：{cardLabel}";
            var index = i;
            card.Pressed += () =>
            {
                EmitSignal(SignalName.CardSelected, index, cardLabel);
            };
            card.MouseEntered += () => Lift(card);
            card.MouseExited += () => Rest(card);
            AddChild(card);
            _cards.Add(card);
        }
        LayoutCards();
    }

    public void SetCardSelected(int index, bool selected)
    {
        if (index < 0 || index >= _cards.Count) return;
        _cards[index].Modulate = selected ? new Color(1.0f, 0.82f, 0.45f) : Colors.White;
    }

    private void LayoutCards()
    {
        if (_cards.Count == 0 || Size.X <= 1)
            return;

        const float cardWidth = 142f;
        var referenceScale = Mathf.Min(1f, Mathf.Max(0.35f, (Size.X - cardWidth - 16f) / 1220f));
        var centerX = Size.X * 0.5f;

        for (var i = 0; i < _cards.Count; i++)
        {
            var reference = ReferenceHandGeometry.Supports(_cards.Count)
                ? ReferenceHandGeometry.GetPosition(_cards.Count, i)
                : new Vector2((i - (_cards.Count - 1) * 0.5f) * 120f, -50f);
            var position = new Vector2(
                centerX + reference.X * referenceScale - cardWidth * 0.5f,
                12f + (reference.Y + 50f) * 0.65f);
            _restingPositions[_cards[i]] = position;
            _cards[i].Position = position;
            _cards[i].Rotation = Mathf.DegToRad(reference.X / 100f);
            _cards[i].ZIndex = i;
            _cards[i].PivotOffset = new Vector2(cardWidth * 0.5f, 180f);
        }
    }

    private void Lift(Button card)
    {
        if (!_restingPositions.TryGetValue(card, out var position))
            return;
        card.ZIndex = 100;
        card.Position = position + new Vector2(0, -18);
        card.Scale = new Vector2(1.04f, 1.04f);
    }

    private void Rest(Button card)
    {
        if (_restingPositions.TryGetValue(card, out var position))
            card.Position = position;
        card.ZIndex = _cards.IndexOf(card);
        card.Scale = Vector2.One;
    }
}
