using System;

namespace SoudacheGodot.App;

/// Adapter seam for the future Soudache Core. UI consumes snapshots, never Core rules or card models.
public interface ICoreUiPort
{
    event Action<BattleUiSnapshot>? BattleSnapshotChanged;
    event Action<RunUiSnapshot>? RunSnapshotChanged;
    event Action<SaveSlotsUiSnapshot>? SaveSlotsChanged;
    void RequestPlayCard(string cardId, string? targetId, string[] infusionFuelIds);
    void RequestEndTurn();
    void RequestPileView(string pileKey);
    void RequestStartRun(string characterId);
    void RequestRollDice();
    void RequestRunAction(string actionId);
    void RequestBaseAction(string actionId);
    void RequestSaveSlot(int slot);
    void RequestLoadSlot(int slot);
    void PublishCurrentState();
}

public sealed class BattleUiSnapshot
{
    public string CharacterId { get; init; } = "shuangling";
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
    public string PlayerTargetId { get; init; } = "player";
    public BattleEnemyUiSnapshot[] Enemies { get; init; } = Array.Empty<BattleEnemyUiSnapshot>();
    public string StatusText { get; init; } = "";
    public string[] HandCardLabels { get; init; } = Array.Empty<string>();
    public string[] HandCardIds { get; init; } = Array.Empty<string>();
    public int[] HandCardInfuseCounts { get; init; } = Array.Empty<int>();
    public string[] HandCardTargetKinds { get; init; } = Array.Empty<string>();
    /// <summary>
    /// 战斗音效信号（接口需求 [7a→A]，对照 _planning/audio-inventory.md §3）。
    /// 引擎在结算时产生 sound.js 同名键（parry/curse/strike/card/flee/hit/hurt/heal/victory/defeat…），
    /// UI 侧逐个 GameAudio.PlaySfx(key) 后清空；hit/hurt/heal 可继续沿用现有 HP 变化推断，二者并存。
    /// </summary>
    public string[] SfxRequests { get; init; } = Array.Empty<string>();
}

public sealed class BattleEnemyUiSnapshot
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "敌方目标";
    public int Hp { get; init; }
    public int MaxHp { get; init; }
    public int Block { get; init; }
    public int Attack { get; init; }
    public bool Defeated { get; init; }
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
    public int BackpackUsed { get; init; }
    public int BackpackCapacity { get; init; }
    public int BaseWood { get; init; }
    public int BaseRations { get; init; }
    public int BaseKeys { get; init; }
    public int BaseCoins { get; init; }
    public int SafeCapacity { get; init; }
    public int StashUsed { get; init; }
    public int StashCapacity { get; init; }
    public string Phase { get; init; } = "准备";
    public string CurrentRoom { get; init; } = "营地";
    public string StatusText { get; init; } = "请选择角色开始远征";
    public string[] InventoryLabels { get; init; } = Array.Empty<string>();
    public RunActionUiSnapshot[] Actions { get; init; } = Array.Empty<RunActionUiSnapshot>();
    public MapNodeUiSnapshot[] Nodes { get; init; } = Array.Empty<MapNodeUiSnapshot>();
}

public sealed class RunActionUiSnapshot
{
    public string Id { get; init; } = "";
    public string Label { get; init; } = "继续";
    public string Detail { get; init; } = "";
    public bool Enabled { get; init; } = true;
}

public sealed class MapNodeUiSnapshot
{
    public int Index { get; init; }
    public string Type { get; init; } = "unknown";
    public string Label { get; init; } = "未知";
    public bool IsCurrent { get; init; }
    public bool IsResolved { get; init; }
    // 四层节点图几何（批次 6c 地图渲染用）：网格坐标与同层相邻节点
    public int X { get; init; }
    public int Row { get; init; }
    public int[] Neighbors { get; init; } = Array.Empty<int>();
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
