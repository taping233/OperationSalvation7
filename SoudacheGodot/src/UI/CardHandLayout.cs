using Godot;
using System.Collections.Generic;

namespace SoudacheGodot.UI;

/// Presentation hand bar using the reference hand-position pattern. Cards sit in a low,
/// overlapping arc like the reference battle view; identity/effects remain snapshot-owned.
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
            var card = UiTheme.Button($"—\n{cardLabel}", new Vector2(142, 188));
            var art = new[] { "unknown.webp", "spell.webp", "resource-material.webp", "hero.webp", "equipment-weapon.webp" }[i % 5];
            card.Icon = GD.Load<Texture2D>($"res://assets/cards/{art}");
            card.ExpandIcon = true;
            card.AddThemeFontSizeOverride("font_size", 15);
            card.AddThemeColorOverride("font_color", new Color("E8EEEA"));
            card.AddThemeColorOverride("font_hover_color", new Color("101E27"));
            card.AddThemeStyleboxOverride("normal", UiTheme.Box(new Color(0.055f, 0.12f, 0.16f, 0.96f), 3, new Color("6B828A"), 1));
            card.AddThemeStyleboxOverride("hover", UiTheme.Box(new Color(0.66f, 0.86f, 0.77f, 0.98f), 3, new Color("DDB876"), 2));
            card.AddThemeStyleboxOverride("pressed", UiTheme.Box(new Color(0.87f, 0.72f, 0.42f, 0.98f), 3, new Color("F2D49B"), 2));
            card.AddThemeStyleboxOverride("focus", UiTheme.Box(new Color(0.09f, 0.18f, 0.20f, 0.98f), 3, new Color("A9EFC3"), 2));
            card.TooltipText = $"卡牌：{cardLabel}";
            var index = i;
            card.Pressed += () =>
            {
                EmitSignal(SignalName.CardSelected, index, cardLabel);
            };
            card.MouseEntered += () => { Lift(card); UiMotion.Pop(card); };
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

    public void PopCard(int index)
    {
        if (index >= 0 && index < _cards.Count) UiMotion.Pop(_cards[index]);
    }

    private void LayoutCards()
    {
        if (_cards.Count == 0 || Size.X <= 1)
            return;

        const float cardWidth = 142f;
        const float cardHeight = 188f;
        var referenceScale = Mathf.Min(1f, Mathf.Max(0.35f, (Size.X - cardWidth - 16f) / 1220f));
        var centerX = Size.X * 0.5f;

        for (var i = 0; i < _cards.Count; i++)
        {
            var reference = ReferenceHandGeometry.Supports(_cards.Count)
                ? ReferenceHandGeometry.GetPosition(_cards.Count, i)
                : new Vector2((i - (_cards.Count - 1) * 0.5f) * 120f, -50f);
            var position = new Vector2(
                centerX + reference.X * referenceScale - cardWidth * 0.5f,
                12f + (reference.Y + 50f) * 0.72f);
            _restingPositions[_cards[i]] = position;
            _cards[i].Position = position;
            _cards[i].Rotation = Mathf.DegToRad(reference.X / 100f);
            _cards[i].ZIndex = i;
            _cards[i].PivotOffset = new Vector2(cardWidth * 0.5f, cardHeight);
            // Keep a readable physical card while scaling the hand's spread to the viewport.
            _cards[i].Scale = new Vector2(referenceScale, referenceScale);
        }
    }

    private void Lift(Button card)
    {
        if (!_restingPositions.TryGetValue(card, out var position))
            return;
        card.ZIndex = 100;
        card.Position = position + new Vector2(0, -18);
        card.Scale = card.Scale * 1.06f;
    }

    private void Rest(Button card)
    {
        if (_restingPositions.TryGetValue(card, out var position))
            card.Position = position;
        card.ZIndex = _cards.IndexOf(card);
        var scale = Mathf.Min(1f, Mathf.Max(0.35f, (Size.X - 142f - 16f) / 1220f));
        card.Scale = new Vector2(scale, scale);
    }
}
