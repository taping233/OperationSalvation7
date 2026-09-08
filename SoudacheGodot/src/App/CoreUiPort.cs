using System;

namespace SoudacheGodot.App;

/// Adapter seam for the future Soudache Core. UI consumes snapshots, never Core rules or card models.
public interface ICoreUiPort
{
    event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    event Action<RunUiSnapshot>? RunSnapshotChanged;
    void RequestPlayCard(string cardId);
    void RequestEndTurn();
    void RequestPileView(string pileKey);
    void PublishCurrentState();
}

public sealed class BattleUiSnapshot
{
    public int Turn { get; init; }
    public int Energy { get; init; }
    public int MaxEnergy { get; init; }
    public int DrawPileCount { get; init; }
    public int DiscardPileCount { get; init; }
    public string StatusText { get; init; } = "";
    public string[] HandCardLabels { get; init; } = Array.Empty<string>();
    public string[] HandCardIds { get; init; } = Array.Empty<string>();
}

public sealed class RunUiSnapshot
{
    public string CharacterId { get; init; } = "";
    public string CharacterDisplayName { get; init; } = "";
    public int LayerIndex { get; init; }
    public int TrackPosition { get; init; }
    public int CurrentHp { get; init; }
    public int MaxHp { get; init; }
}
