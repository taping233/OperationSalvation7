using System;

namespace SoudacheGodot.App;

/// Adapter seam for the future Soudache Core. UI consumes snapshots, never Core rules or card models.
public interface ICoreUiPort
{
    event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    event Action<RunUiSnapshot>? RunSnapshotChanged;
    event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;
    void RequestPlayCard(string cardId);
    void RequestEndTurn();
    void RequestPileView(string pileKey);
    void RequestStartRun(string characterId);
    void RequestRollDice();
    void RequestResolveRoom();
    void RequestSaveSlot(int slot);
    void RequestLoadSlot(int slot);
    void PublishCurrentState();
}

public sealed class BattleUiSnapshot
{
    public int Turn { get; init; }
    public int Energy { get; init; }
    public int MaxEnergy { get; init; }
    public int DrawPileCount { get; init; }
    public int DiscardPileCount { get; init; }
    public int ExhaustPileCount { get; init; }
    public int PlayerHp { get; init; }
    public int PlayerMaxHp { get; init; }
    public int PlayerBlock { get; init; }
    public int EnemyHp { get; init; }
    public int EnemyMaxHp { get; init; }
    public int EnemyBlock { get; init; }
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
    public int TrackLength { get; init; }
    public int LastRoll { get; init; }
    public int Coins { get; init; }
    public int Keys { get; init; }
    public int Wood { get; init; }
    public int Rations { get; init; }
    public int Stamina { get; init; }
    public int MaxStamina { get; init; }
    public string Phase { get; init; } = "准备";
    public string CurrentRoom { get; init; } = "营地";
    public string StatusText { get; init; } = "请选择角色开始远征";
    public MapNodeUiSnapshot[] Nodes { get; init; } = Array.Empty<MapNodeUiSnapshot>();
}

public sealed class MapNodeUiSnapshot
{
    public int Index { get; init; }
    public string Type { get; init; } = "unknown";
    public string Label { get; init; } = "未知";
    public bool IsCurrent { get; init; }
    public bool IsResolved { get; init; }
}

public sealed class SaveSlotsUiSnapshot
{
    public SaveSlotUiSnapshot[] Slots { get; init; } = Array.Empty<SaveSlotUiSnapshot>();
    public string StatusText { get; init; } = "";
}

public sealed class SaveSlotUiSnapshot
{
    public int Slot { get; init; }
    public bool Exists { get; init; }
    public string Summary { get; init; } = "空档位";
}
