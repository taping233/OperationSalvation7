using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

public enum RunPhase { Ready, Battle, Shop, Campfire, Chest, Event, AwaitingDoor, Altar, Victory, Defeat }

public sealed class RunResources
{
    public int Coins { get; internal set; }
    public int Keys { get; internal set; }
    public int Wood { get; internal set; }
    public int Rations { get; internal set; }
}

public sealed record RunRoll(int Dice, int Layer, int FromPosition, int ToPosition, IReadOnlyList<int> Path);
public sealed record RunRoomResult(RunRoomType Type, int Layer, int Position, int Amount = 0, string Message = "");
public sealed record RunEventResult(string Text, int Coins, int Wood, int Rations, bool CreatedChest);
public sealed record RunChestLoot(string Kind, int Coins, IReadOnlyList<string> Items);
public sealed record RunShopOffer(string Id, RunRoomType Resource, int Quantity, int Price, bool Sold = false);
public sealed record RunSnapshot(ulong Seed, ulong RngState, int LayerIndex, int TrackPosition,
    int Turns, int Stamina, int Hp, int Coins, int Keys, int Wood, int Rations, RunPhase Phase);

/// <summary>
/// Pure C# run state machine. It has no Godot/node dependency and deliberately keeps all
/// randomness on the supplied deterministic RNG so a run can be replayed from its seed/state.
/// </summary>
public sealed class RunState
{
    private static readonly string[] OuterPool = { "infantry", "archer", "bandit", "cavalry" };
    private static readonly string[] MiddlePool = { "orc_jav", "orc_axe", "wolf_rider" };
    private static readonly string[] InnerPool = { "fire_el", "water_el", "grass_el" };
    private static readonly string[] LootTable = { "绷带", "零散弹药", "瓶装水", "旧地图" };
    private readonly List<RunEnemy> _encounter = new();
    private readonly Queue<(string Kind, bool IsBoss)> _pendingChests = new();
    private readonly HashSet<string> _discoveredDoors = new(StringComparer.Ordinal);
    private readonly HashSet<int> _defeatedBosses = new();
    private RunDoor? _pendingDoor;
    private RunPhase _returnAfterChest = RunPhase.Ready;
    private IReadOnlyList<RunShopOffer> _shop = Array.Empty<RunShopOffer>();
    private RunRisk _encounterRisk;

    public RunMap Map { get; }
    public DeterministicRng Rng { get; }
    public ulong Seed { get; }
    public RunResources Resources { get; } = new();
    public RunPhase Phase { get; private set; } = RunPhase.Ready;
    public int LayerIndex { get; private set; }
    public int TrackPosition { get; private set; }
    public int Turns { get; private set; }
    public int Stamina { get; private set; } = RunRules.StaminaMax;
    public int MaxStamina => RunRules.StaminaMax;
    public int Hp { get; private set; } = RunRules.PlayerMaxHp;
    public int MaxHp => RunRules.PlayerMaxHp;
    public IReadOnlyList<RunEnemy> Encounter => _encounter;
    public RunRisk EncounterRisk => _encounterRisk;
    public IReadOnlyList<RunShopOffer> Shop => _shop;
    public IReadOnlySet<int> DefeatedBosses => _defeatedBosses;
    public bool IsFinished => Phase is RunPhase.Victory or RunPhase.Defeat;

    public RunState(ulong seed, RunMap? map = null)
    {
        Seed = seed;
        Map = map ?? RunMap.CreateDefault();
        Rng = new DeterministicRng(seed);
        if (!Map.IsConnected(out var unreachable))
            throw new ArgumentException($"Run map contains unreachable nodes: {string.Join(",", unreachable)}", nameof(map));
    }

    public RunSnapshot CaptureSnapshot() => new(Seed, Rng.State, LayerIndex, TrackPosition, Turns, Stamina, Hp,
        Resources.Coins, Resources.Keys, Resources.Wood, Resources.Rations, Phase);

    public static RunState FromSnapshot(RunSnapshot snapshot, RunMap? map = null)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var state = new RunState(snapshot.Seed, map);
        state.Restore(snapshot);
        return state;
    }

    /// <summary>Restores only a validated ready-to-roll snapshot; unresolved UI choices are never serialized.</summary>
    public void Restore(RunSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (snapshot.Phase != RunPhase.Ready) throw new ArgumentException("只能恢复 Ready 状态的运行快照。", nameof(snapshot));
        if (snapshot.LayerIndex < 0 || snapshot.LayerIndex >= Map.Layers.Count)
            throw new ArgumentOutOfRangeException(nameof(snapshot.LayerIndex));
        if (snapshot.TrackPosition < 0 || snapshot.TrackPosition >= Map.Layers[snapshot.LayerIndex].RingSize)
            throw new ArgumentOutOfRangeException(nameof(snapshot.TrackPosition));
        if (snapshot.Turns < 0 || snapshot.Stamina < 0 || snapshot.Stamina > MaxStamina)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Hp < 0 || snapshot.Hp > MaxHp || snapshot.Coins < 0 || snapshot.Keys < 0 || snapshot.Wood < 0 || snapshot.Rations < 0)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Seed != Seed) throw new ArgumentException("快照种子与当前运行不一致。", nameof(snapshot));
        LayerIndex = snapshot.LayerIndex; TrackPosition = snapshot.TrackPosition; Turns = snapshot.Turns;
        Stamina = snapshot.Stamina; Hp = snapshot.Hp; Resources.Coins = snapshot.Coins; Resources.Keys = snapshot.Keys;
        Resources.Wood = snapshot.Wood; Resources.Rations = snapshot.Rations; Rng.RestoreState(snapshot.RngState);
        _pendingDoor = null; _pendingChests.Clear(); _encounter.Clear(); _shop = Array.Empty<RunShopOffer>(); _encounterRisk = default; Phase = RunPhase.Ready;
    }

    public RunRoll Roll()
    {
        EnsurePhase(RunPhase.Ready);
        if (Stamina <= 0) { Phase = RunPhase.Defeat; throw new InvalidOperationException("体力耗尽，行动失败。"); }
        var layer = Map.Layers[LayerIndex];
        var from = TrackPosition;
        var dice = Rng.NextInt(1, RunRules.DiceSides + 1);
        Stamina--;
        Turns++;
        var path = new List<int>(dice);
        for (var i = 0; i < dice; i++)
        {
            TrackPosition = (TrackPosition + 1) % layer.RingSize;
            path.Add(TrackPosition);
        }
        ResolveRoom();
        return new RunRoll(dice, LayerIndex, from, TrackPosition, path);
    }

    public RunRoomResult ResolveCurrentRoom()
    {
        EnsurePhase(RunPhase.Ready);
        ResolveRoom();
        return CurrentRoomResult();
    }

    private void ResolveRoom()
    {
        var room = Map.Layers[LayerIndex].RoomAt(TrackPosition);
        switch (room.Type)
        {
            case RunRoomType.Coin:
                Resources.Coins += Math.Max(1, room.Amount - 1);
                FinishInstantOrDoor();
                break;
            case RunRoomType.Wood: Resources.Wood += room.Amount; FinishInstantOrDoor(); break;
            case RunRoomType.Rations: Resources.Rations += room.Amount; FinishInstantOrDoor(); break;
            case RunRoomType.Key: Resources.Keys++; FinishInstantOrDoor(); break;
            case RunRoomType.Battle:
                BuildEncounter(); Phase = RunPhase.Battle; break;
            case RunRoomType.Event: Phase = RunPhase.Event; break;
            case RunRoomType.Shop:
                EnterShop(); break;
            case RunRoomType.Campfire:
                Hp = Math.Min(MaxHp, Hp + RunRules.FireHeal); Phase = RunPhase.Campfire; break;
            case RunRoomType.Chest:
                _pendingChests.Enqueue(("small", false)); _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; break;
            case RunRoomType.EmergencyExit: Phase = RunPhase.AwaitingDoor; break;
            default:
                if (Map.Layers[LayerIndex].DoorAt(TrackPosition) is not null || Map.Layers[LayerIndex].HasAltarEntrance(TrackPosition))
                    FinishInstantOrDoor();
                else Phase = RunPhase.Ready;
                break;
        }
    }

    private void FinishInstantOrDoor()
    {
        _pendingDoor = Map.Layers[LayerIndex].DoorAt(TrackPosition);
        if (_pendingDoor is not null || Map.Layers[LayerIndex].HasAltarEntrance(TrackPosition))
        {
            if (_pendingDoor is not null) _discoveredDoors.Add(_pendingDoor.Pair);
            Phase = RunPhase.AwaitingDoor;
        }
        else Phase = RunPhase.Ready;
    }

    private RunRoomResult CurrentRoomResult()
    {
        var room = Map.Layers[LayerIndex].RoomAt(TrackPosition);
        return new RunRoomResult(room.Type, LayerIndex, TrackPosition, room.Amount, Describe(room.Type));
    }

    public void CompleteCampfire() { EnsurePhase(RunPhase.Campfire); Phase = RunPhase.Ready; }
    public void LeaveEventWithoutEffect() { EnsurePhase(RunPhase.Event); Phase = RunPhase.Ready; }
    public RunEventResult ResolveEvent()
    {
        EnsurePhase(RunPhase.Event);
        var roll = Rng.NextInt(0, 8);
        RunEventResult result = roll < 3
            ? new("在瓦砾堆里捡到几枚旧世界硬币", Rng.NextInt(1, 4), 0, 0, false)
            : roll < 5
                ? new("翻到一批先行者遗留的物资", 0, 0, 0, true)
                : roll < 7
                    ? new("辐射风掠过荒原，什么也没发生", 0, 0, 0, false)
                    : new("找到一只未撬过的保险柜！", Rng.NextInt(4, 7), 0, 0, false);
        Resources.Coins += result.Coins; Resources.Wood += result.Wood; Resources.Rations += result.Rations;
        if (result.CreatedChest) { _pendingChests.Enqueue(("small", false)); _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; }
        else Phase = RunPhase.Ready;
        return result;
    }

    private void BuildEncounter()
    {
        _encounter.Clear();
        var layer = LayerIndex;
        _encounterRisk = layer switch { 0 => RunRisk.Low, 1 => RunRisk.Medium, _ => RunRisk.High };
        var pool = layer switch { 0 => OuterPool, 1 => MiddlePool, _ => InnerPool };
        var min = layer == 0 ? 2 : layer == 1 ? 2 : 1;
        var max = layer == 0 ? 4 : layer == 1 ? 3 : 3;
        if (layer == 2 && Rng.NextDouble() < 0.25)
        {
            _encounterRisk = RunRisk.Elite;
            _encounter.Add(new RunEnemy("dragon", "巨兽「荒渊」", 40, 7, true));
            return;
        }
        var count = Rng.NextInt(min, max + 1);
        for (var i = 0; i < count; i++) _encounter.Add(CreateEnemy(pool[Rng.NextInt(pool.Length)]));
        if (layer == 0 && _encounter.Any(x => x.Id == "bandit"))
            while (_encounter.Count < 3) _encounter.Add(CreateEnemy(pool[Rng.NextInt(pool.Length)]));
    }

    private static RunEnemy CreateEnemy(string id) => id switch
    {
        "infantry" => new(id, "荒民打手", 4, 4), "archer" => new(id, "废土猎手", 3, 5),
        "bandit" => new(id, "掠夺者", 3, 3), "cavalry" => new(id, "机车掠袭者", 6, 5),
        "orc_jav" => new(id, "畸变投掷者", 4, 6), "orc_axe" => new(id, "畸变屠夫", 7, 4),
        "wolf_rider" => new(id, "畸变狼骑兵", 6, 7), "fire_el" => new(id, "灼热异变体", 7, 10),
        "water_el" => new(id, "腐蚀异变体", 10, 7), _ => new(id, "滋生异变体", 12, 5)
    };

    public IReadOnlyList<(string Kind, bool IsBoss)> CompleteBattle(bool won)
        => CompleteBattle(won, Hp);

    public IReadOnlyList<(string Kind, bool IsBoss)> CompleteBattle(bool won, int remainingHp)
    {
        EnsurePhase(RunPhase.Battle);
        if (remainingHp < 0 || remainingHp > MaxHp) throw new ArgumentOutOfRangeException(nameof(remainingHp));
        Hp = remainingHp;
        if (!won) { Phase = RunPhase.Defeat; return Array.Empty<(string, bool)>(); }
        var bossIndex = -1;
        if (_encounter.Count == 1)
            for (var index = 0; index < Map.Bosses.Count; index++)
                if (Map.Bosses[index].Id == _encounter[0].Id) { bossIndex = index; break; }
        if (bossIndex >= 0) _defeatedBosses.Add(bossIndex);
        var drops = bossIndex >= 0 ? new[] { ("boss", true) } : RollDrops(LayerIndex);
        foreach (var drop in drops) _pendingChests.Enqueue(drop);
        _returnAfterChest = bossIndex >= 0 ? RunPhase.Altar : RunPhase.Ready;
        Phase = RunPhase.Chest;
        return drops;
    }

    private IReadOnlyList<(string, bool)> RollDrops(int layer)
    {
        if (layer == 0) return Enumerable.Range(0, Rng.NextInt(1, 3)).Select(_ => ("small", false)).ToArray();
        if (layer == 1) return Rng.NextInt(2) == 0 ? new[] { ("medium", false), ("medium", false) } : new[] { ("large", false) };
        return Rng.NextInt(2) == 0 ? new[] { ("large", false), ("small", false) } : new[] { ("large", false), ("medium", false) };
    }

    public RunChestLoot OpenNextChest()
    {
        EnsurePhase(RunPhase.Chest);
        if (_pendingChests.Count == 0) { Phase = _returnAfterChest; return new RunChestLoot("none", 0, Array.Empty<string>()); }
        var chest = _pendingChests.Dequeue();
        var (min, max, count) = chest.Kind switch { "medium" => (2, 3, 3), "large" => (3, 4, 3), "boss" => (0, 0, 5), _ => (1, 2, 1) };
        var coins = chest.IsBoss ? 0 : Rng.NextInt(min, max + 1);
        var items = Enumerable.Range(0, count).Select(_ => LootTable[Rng.NextInt(LootTable.Length)]).ToArray();
        if (chest.IsBoss) Resources.Coins += Rng.NextInt(1, 4);
        Resources.Coins += coins;
        if (_pendingChests.Count == 0) Phase = _returnAfterChest;
        return new RunChestLoot(chest.Kind, coins, items);
    }

    public void EnterDoor() {
        EnsurePhase(RunPhase.AwaitingDoor);
        if (_pendingDoor is not null) { LayerIndex = _pendingDoor.ToLayer; TrackPosition = _pendingDoor.ArriveAt; _pendingDoor = null; Phase = RunPhase.Ready; return; }
        if (Map.Layers[LayerIndex].HasAltarEntrance(TrackPosition)) { Phase = RunPhase.Altar; return; }
        throw new InvalidOperationException("当前房间没有可进入的门。");
    }
    public void StayAtDoor() { EnsurePhase(RunPhase.AwaitingDoor); _pendingDoor = null; Phase = RunPhase.Ready; }
    public void ExtractAtDoor()
    {
        EnsurePhase(RunPhase.AwaitingDoor);
        if (_pendingDoor is { IsExit: true } || Map.Layers[LayerIndex].RoomAt(TrackPosition).Type == RunRoomType.EmergencyExit) Extract();
        else throw new InvalidOperationException("当前门不是撤离出口。");
    }
    public void EnterAltar() { EnsurePhase(RunPhase.Altar); }
    public void LeaveAltar() { EnsurePhase(RunPhase.Altar); Phase = RunPhase.Ready; }
    public void ChallengeBoss(int index)
    {
        EnsurePhase(RunPhase.Altar);
        if (index < 0 || index >= Map.Bosses.Count) throw new ArgumentOutOfRangeException(nameof(index));
        if (_defeatedBosses.Contains(index)) throw new InvalidOperationException("该首领已被击败。");
        var b = Map.Bosses[index]; _encounter.Clear(); _encounter.Add(new RunEnemy(b.Id, b.Name, b.Hp, b.Attack, true)); Phase = RunPhase.Battle;
    }

    private void EnterShop()
    {
        _pendingDoor = Map.Layers[LayerIndex].DoorAt(TrackPosition);
        _shop = new[] { new RunShopOffer("rations", RunRoomType.Rations, 1, 2), new RunShopOffer("wood", RunRoomType.Wood, 1, 1), new RunShopOffer("key", RunRoomType.Key, 1, 8) };
        Phase = RunPhase.Shop;
    }
    public void BuyShopOffer(string id)
    {
        EnsurePhase(RunPhase.Shop);
        var offer = _shop.FirstOrDefault(x => x.Id == id && !x.Sold) ?? throw new InvalidOperationException("商品不存在或已售出。");
        if (Resources.Coins < offer.Price) throw new InvalidOperationException("金币不足。");
        Resources.Coins -= offer.Price;
        if (offer.Resource == RunRoomType.Rations) Resources.Rations += offer.Quantity;
        else if (offer.Resource == RunRoomType.Wood) Resources.Wood += offer.Quantity;
        else Resources.Keys += offer.Quantity;
        _shop = _shop.Select(x => x.Id == id ? x with { Sold = true } : x).ToArray();
    }
    public void LeaveShop() { EnsurePhase(RunPhase.Shop); Phase = _pendingDoor is not null ? RunPhase.AwaitingDoor : RunPhase.Ready; }

    public void ConsumeRation(int amount = 1)
    {
        EnsurePhase(RunPhase.Ready);
        if (amount <= 0 || Resources.Rations < amount) throw new InvalidOperationException("口粮不足。");
        Resources.Rations -= amount; Stamina = Math.Min(MaxStamina, Stamina + amount * 3);
    }
    public void Extract()
    {
        if (Stamina <= 0) { Phase = RunPhase.Defeat; return; }
        Phase = RunPhase.Victory;
    }

    /// <summary>Test/adapter seam for restoring a saved position before a room resolves.</summary>
    public void DebugSetPosition(int layer, int position)
    {
        if (layer < 0 || layer >= Map.Layers.Count) throw new ArgumentOutOfRangeException(nameof(layer));
        if (position < 0 || position >= Map.Layers[layer].RingSize) throw new ArgumentOutOfRangeException(nameof(position));
        if (Phase is not RunPhase.Ready) throw new InvalidOperationException("只能在待行动状态设置位置。");
        LayerIndex = layer; TrackPosition = position; _pendingDoor = null;
    }

    private static string Describe(RunRoomType type) => type switch
    {
        RunRoomType.Coin => "拾取金币", RunRoomType.Wood => "拾取木材", RunRoomType.Rations => "拾取口粮",
        RunRoomType.Key => "拾取神秘钥匙", RunRoomType.Battle => "遭遇战斗", RunRoomType.Event => "触发随机事件",
        RunRoomType.Shop => "进入商店", RunRoomType.Campfire => "营火休整", RunRoomType.Chest => "发现宝箱",
        RunRoomType.EmergencyExit => "抵达紧急撤离点", _ => "安全节点"
    };
    private void EnsurePhase(RunPhase expected) { if (Phase != expected) throw new InvalidOperationException($"当前状态为 {Phase}，需要 {expected}。"); }
}

public static class RunRules
{
    public const int DiceSides = 3;
    public const int PlayerMaxHp = 30;
    public const int StaminaMax = 60;
    public const int StaminaWarn = 10;
    public const int FireHeal = 8;
    public const int EmergencyExitCost = 10;
}
