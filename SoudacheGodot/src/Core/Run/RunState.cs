using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/game.run.scenes.js (buildEncounter) + src/chests.js (rollDrops/rollContents)
// + src/game.run.flow.js (randomEvents) + src/cards.js (PRICE)。遭遇表、怪物图鉴、
// 宝箱掉落、随机事件与商店定价均读 data/map.json 与 data/cards.json，不在代码里写死数值。

public enum RunPhase { Ready, Battle, Shop, Campfire, Chest, Event, AwaitingDoor, Altar, Settlement, Victory, Defeat }

public sealed class RunResources
{
    public int Coins { get; internal set; }
    public int Keys { get; internal set; }
    public int Wood { get; internal set; }
    public int Rations { get; internal set; }
}

public sealed record RunMove(int Layer, int FromPosition, int ToPosition);
public sealed record RunRoomResult(RunRoomType Type, int Layer, int Position, int Amount = 0, string Message = "");
public sealed record RunEventResult(string Text, int Coins, int Wood, int Rations, bool CreatedChest);
public sealed record RunChestLoot(string Kind, int Coins, IReadOnlyList<string> Items, bool IsClass = false,
    bool RequiresChoice = false, int SelectedIndex = 0,
    IReadOnlyList<string>? AcceptedItems = null, IReadOnlyList<string>? DeferredItems = null,
    bool EggHit = false, bool TokenHit = false, string? PityTier = null);
public sealed record RunShopOffer(string Id, RunRoomType Resource, int Quantity, int Price, bool Sold = false,
    RunCard? Card = null, bool IsMystery = false, int? ShaReplenish = null);
public sealed record RunEventChoice(string Id, string Label, string Detail, string Tone = "");
/// <summary>开箱内容预览（chests.js rollContents 的移植快照）：candidates 为卡名（中宝箱 3 选 1）。</summary>
public sealed record RunChestPreview(string Kind, bool IsBoss, bool IsClass, bool RequiresChoice,
    IReadOnlyList<string> Candidates, int Coins, bool EggHit = false, bool TokenHit = false, string? PityTier = null);
public sealed record RunDoorOption(string Pair, bool CanEnter, bool CanExtract, int TargetLayer, int TargetPosition, string Label);
public sealed record RunSettlementCard(RunCard Card, int Count, bool Deposited);
public sealed record RunSettlementSnapshot(RunCardSnapshot Card, bool Deposited);
public sealed record RunSnapshot(ulong Seed, ulong RngState, int LayerIndex, int TrackPosition,
    int Turns, int Stamina, int Hp, int Coins, int Keys, int Wood, int Rations, RunPhase Phase,
    RunBaseSnapshot? Base = null, IReadOnlyList<RunCardSnapshot>? OwnedCards = null,
    IReadOnlyList<RunCardSnapshot>? UsedPocket = null, IReadOnlyList<RunCardSnapshot>? PendingRewards = null,
    IReadOnlyList<RunSettlementSnapshot>? SettlementCards = null, int Fragments = 0,
    bool AltarActivated = false, bool BossKilled = false, IReadOnlyList<string>? VisitedNodes = null);

/// <summary>
/// Pure C# run state machine. It has no Godot/node dependency and deliberately keeps all
/// randomness on the supplied deterministic RNG so a run can be replayed from its seed/state.
/// </summary>
public sealed class RunState
{
    private readonly GameData _data;
    private readonly List<RunEnemy> _encounter = new();
    private readonly Queue<(string Kind, bool IsBoss, bool IsClass)> _pendingChests = new();
    private readonly HashSet<int> _defeatedBosses = new();
    private readonly List<RunCardStack> _ownedCards = new();
    private readonly List<RunCardStack> _usedPocket = new();
    private readonly List<RunCard> _shopCardPool = new();
    private readonly List<RunCard> _classCardPool = new();
    private readonly List<RunCard> _lootCardPool = new();
    private readonly Queue<(string Kind, bool IsBoss)> _eventBattleDrops = new();
    private readonly List<RunCardStack> _pendingRewards = new();
    private readonly List<RunCardStack> _recoveryCards = new();
    private readonly List<RunSettlementCard> _settlementCards = new();
    private readonly List<int> _diceHistory = new();
    private RunDoor? _pendingDoor;
    private RunPhase _returnAfterChest = RunPhase.Ready;
    private IReadOnlyList<RunShopOffer> _shop = Array.Empty<RunShopOffer>();
    private RunRisk _encounterRisk;
    private string? _pendingEventId;
    private IReadOnlyList<RunEventChoice> _eventChoices = Array.Empty<RunEventChoice>();
    private RunChestPreview? _chestPreview;
    private IReadOnlyList<RunCard>? _chestCards;
    private bool _chestSuspended;
    // —— 四层跑图（网页版 game.session/game.run.flow 语义）——
    // visited：一次性内容防重刷（战斗/宝箱/火堆/商店/事件/祭坛/首脑只触发一次；
    // 门/紧急撤离/终局撤离是通路可重复）。键为 "li,idx"。
    private readonly HashSet<string> _visited = new(StringComparer.Ordinal);
    private bool _altarRewardPending;

    public RunMap Map { get; }
    public DeterministicRng Rng { get; }
    public ulong Seed { get; }
    public RunResources Resources { get; } = new();
    public RunBaseState Base { get; }
    public IReadOnlyList<RunCardStack> OwnedCards => _ownedCards;
    public IReadOnlyList<RunCardStack> UsedPocket => _usedPocket;
    public int BackpackUsed => _ownedCards.Sum(stack => stack.Count);
    public int BackpackCapacity => Base.BagCapacity;
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
    public IReadOnlyList<RunEventChoice> EventChoices => _eventChoices;
    public IReadOnlyList<RunCardStack> PendingRewards => _pendingRewards;
    public IReadOnlyList<RunCardStack> RecoveryCards => _recoveryCards;
    public IReadOnlyList<RunSettlementCard> SettlementCards => _settlementCards;
    public RunChestPreview? ChestPreview => _chestPreview;
    public RunDoorOption? CurrentDoor => CurrentDoorOption();
    /// <summary>撤离点放行：终局撤离点需先击败首脑；紧急撤离点需背包 ≥3 张可献祭卡牌。</summary>
    public bool CanExtract => Phase == RunPhase.AwaitingDoor &&
        (CurrentRoomType == RunRoomType.Extraction
            ? BossKilled
            : CurrentRoomType == RunRoomType.EmergencyExit && BackpackUsed >= RunRules.EmergencySacrificeCards);
    public IReadOnlySet<int> DefeatedBosses => _defeatedBosses;
    public bool IsFinished => Phase is RunPhase.Victory or RunPhase.Defeat;

    // —— 四层跑图状态（存档随 RunSnapshot 持久化）——
    /// <summary>第四层污染祭坛是否已激活（首脑格准入条件；网页版 game.altarActivated）。</summary>
    public bool AltarActivated { get; private set; }
    /// <summary>本局是否已击败首脑（终局撤离点放行条件；网页版 game.bossKilled）。</summary>
    public bool BossKilled { get; private set; }
    /// <summary>弃 3 激活祭坛后、二选一奖励未领取（不可存档，只存在于 Altar 阶段）。</summary>
    public bool PendingAltarReward => _altarRewardPending;
    /// <summary>已结算过的一次性格（"li,idx"，防回头路重刷）。</summary>
    public IReadOnlyCollection<string> VisitedNodes => _visited;
    /// <summary>近 8 次掷/移动记录（网页 ui.js diceHistory.slice(-8) 的 chips 口径；掷骰已停用，记录移动落点序号）。</summary>
    public IReadOnlyList<int> DiceHistory => _diceHistory;

    // —— 彩色令牌碎片（网页版 game.fragments，Q6 隐藏计数器）：集齐 2 枚可随员工通行证A合成彩色令牌 ——
    // 网页来源（game.run.flow.js eventChoiceSpec V2 / applyEventEffect）：神秘补给事件、系统补给事件、
    // 修鞋铺事件卡（cmtn7qttxqo4，归 4c ink 事件）；敌人不掉碎片；无上限（可积攒多枚）。
    public int Fragments { get; private set; }

    public void GrantFragments(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Fragments = checked(Fragments + amount);
    }

    public bool TryConsumeFragments(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        if (Fragments < amount) return false;
        Fragments -= amount;
        return true;
    }

    // ---------- 碎片合成入口（ported from game.bag.js craftColorToken / craftColorTokenByFragments）----------
    // 3 张员工通行证B → 1 张员工通行证A；员工通行证A + 2 枚碎片 → 1 张彩色令牌。
    // 网页合成入口在背包卡牌特写里，直接 ownedCards.push（无容量检查）——保持同语义。

    /// <summary>3 张员工通行证B（tt-token-gold）合成 1 张员工通行证A（tt-token-color）。</summary>
    public TokenCraft.CraftResult CraftTokenAFromB()
    {
        var gold = _ownedCards.FirstOrDefault(stack => stack.Card.Id == TokenCraft.TokenGoldId);
        if (gold is null || gold.Count < 3) return new(false, "员工通行证B不足 3 张，无法合成", null);
        gold.Count -= 3;
        if (gold.Count == 0) _ownedCards.Remove(gold);
        var tokenA = FindPoolCard(TokenCraft.TokenColorId)
            ?? new RunCard(TokenCraft.TokenColorId, "员工通行证A", "道具", "史诗", 4);
        ForceAddCard(tokenA);
        return new(true, "合成成功：3 张员工通行证B → 1 张员工通行证A", TokenCraft.TokenColorId);
    }

    /// <summary>员工通行证A + 2 枚彩色令牌碎片合成 1 张彩色令牌（cmtmvq6ss84l，2026-09-09 Q6 定版）。</summary>
    public TokenCraft.CraftResult CraftColorTokenByFragments()
    {
        if (Fragments < 2) return new(false, "彩色令牌碎片不足 2 枚，无法合成", null);
        var tokenA = _ownedCards.FirstOrDefault(stack => stack.Card.Id == TokenCraft.TokenColorId);
        if (tokenA is null) return new(false, "缺少员工通行证A，无法合成彩色令牌", null);
        if (!TryConsumeFragments(2)) return new(false, "彩色令牌碎片不足 2 枚，无法合成", null);
        tokenA.Count--;
        if (tokenA.Count == 0) _ownedCards.Remove(tokenA);
        var color = FindPoolCard(TokenCraft.ColorTokenId)
            ?? new RunCard(TokenCraft.ColorTokenId, "彩色令牌", "道具", "衍生", 8);
        ForceAddCard(color);
        return new(true, "合成成功：员工通行证A + 2 枚碎片 → 1 张彩色令牌（使用后获取本职业能力卡）", TokenCraft.ColorTokenId);
    }

    /// <summary>合成入包：同名并入、不受背包容量限制（网页 craft 直 push 的语义）。</summary>
    private void ForceAddCard(RunCard card)
    {
        var existing = _ownedCards.FirstOrDefault(stack => stack.Card.Name == card.Name);
        if (existing is null) _ownedCards.Add(new RunCardStack(card)); else existing.Count++;
    }

    public void ConfigureShopCardPool(IEnumerable<RunCard> cards)
    {
        ArgumentNullException.ThrowIfNull(cards);
        _shopCardPool.Clear(); _shopCardPool.AddRange(cards.Where(x => x is not null));
    }
    public void ConfigureClassCardPool(IEnumerable<RunCard> cards)
    {
        ArgumentNullException.ThrowIfNull(cards);
        _classCardPool.Clear(); _classCardPool.AddRange(cards.Where(x => x is not null));
    }
    public void ConfigureLootCardPool(IEnumerable<RunCard> cards)
    {
        ArgumentNullException.ThrowIfNull(cards);
        _lootCardPool.Clear(); _lootCardPool.AddRange(cards.Where(x => x is not null));
    }

    public RunState(ulong seed, RunMap? map = null, RunBaseState? baseState = null, GameData? data = null)
    {
        Seed = seed;
        _data = data ?? GameRuntime.Data;
        Base = baseState ?? new RunBaseState();
        Resources.Coins = Base.TakeReserveCoins();
        Map = map ?? RunMap.Generate(seed);
        // 四层图开局站在第 1 层入口（网页版 newRun：entrances[0]，不结算本格、不耗行动）
        LayerIndex = 0;
        TrackPosition = Map.Layers[0].Entry;
        Rng = new DeterministicRng(seed);
        if (!Map.IsConnected(out var unreachable))
            throw new ArgumentException($"Run map contains unreachable nodes: {string.Join(",", unreachable)}", nameof(map));
    }

    public RunSnapshot CaptureSnapshot() => new(Seed, Rng.State, LayerIndex, TrackPosition, Turns, Stamina, Hp,
        Resources.Coins, Resources.Keys, Resources.Wood, Resources.Rations, Phase, Base.CaptureSnapshot(),
        _ownedCards.Select(ToSnapshot).ToArray(), _usedPocket.Select(ToSnapshot).ToArray(), _pendingRewards.Select(ToSnapshot).ToArray(),
        _settlementCards.Select(x => new RunSettlementSnapshot(ToSnapshot(new RunCardStack(x.Card, x.Count)), x.Deposited)).ToArray(),
        Fragments, AltarActivated, BossKilled, _visited.ToArray());

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
        if (snapshot.Phase is not (RunPhase.Ready or RunPhase.Settlement)) throw new ArgumentException("只能恢复 Ready 或 Settlement 状态的运行快照。", nameof(snapshot));
        if (snapshot.LayerIndex < 0 || snapshot.LayerIndex >= Map.Layers.Count)
            throw new ArgumentOutOfRangeException(nameof(snapshot.LayerIndex));
        if (snapshot.TrackPosition < 0 || snapshot.TrackPosition >= Map.Layers[snapshot.LayerIndex].NodeCount)
            throw new ArgumentOutOfRangeException(nameof(snapshot.TrackPosition));
        if (snapshot.Turns < 0 || snapshot.Stamina < 0 || snapshot.Stamina > MaxStamina)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Hp < 0 || snapshot.Hp > MaxHp || snapshot.Coins < 0 || snapshot.Keys < 0 || snapshot.Wood < 0 || snapshot.Rations < 0)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Seed != Seed) throw new ArgumentException("快照种子与当前运行不一致。", nameof(snapshot));
        LayerIndex = snapshot.LayerIndex; TrackPosition = snapshot.TrackPosition; Turns = snapshot.Turns;
        Stamina = snapshot.Stamina; Hp = snapshot.Hp; Resources.Coins = snapshot.Coins; Resources.Keys = snapshot.Keys;
        Resources.Wood = snapshot.Wood; Resources.Rations = snapshot.Rations; Rng.RestoreState(snapshot.RngState);
        Fragments = Math.Max(0, snapshot.Fragments);
        AltarActivated = snapshot.AltarActivated;
        BossKilled = snapshot.BossKilled;
        _visited.Clear();
        if (snapshot.VisitedNodes is not null)
            foreach (var key in snapshot.VisitedNodes)
            {
                if (key.Length > 32 || !IsVisitedKeyValid(key)) throw new ArgumentException($"非法的已访节点键 '{key}'。", nameof(snapshot));
                _visited.Add(key);
            }
        if (snapshot.Base is not null) Base.RestoreSnapshot(snapshot.Base);
        _ownedCards.Clear(); _usedPocket.Clear();
        if (snapshot.OwnedCards is not null) _ownedCards.AddRange(snapshot.OwnedCards.Select(FromSnapshot));
        if (snapshot.UsedPocket is not null) _usedPocket.AddRange(snapshot.UsedPocket.Select(FromSnapshot));
        _pendingRewards.Clear();
        if (snapshot.PendingRewards is not null) _pendingRewards.AddRange(snapshot.PendingRewards.Select(FromSnapshot));
        _settlementCards.Clear();
        if (snapshot.SettlementCards is not null)
            _settlementCards.AddRange(snapshot.SettlementCards.Select(x => new RunSettlementCard(FromSnapshot(x.Card).Card, x.Card.Count, x.Deposited)));
        if (BackpackUsed > BackpackCapacity || _ownedCards.Where(x => x.Safe).Sum(x => x.Count) > Base.SafeCapacity)
            throw new ArgumentException("背包卡牌超过容量。", nameof(snapshot));
        _pendingDoor = null; _pendingChests.Clear(); _eventBattleDrops.Clear(); _encounter.Clear(); _shop = Array.Empty<RunShopOffer>(); _eventChoices = Array.Empty<RunEventChoice>(); _pendingEventId = null; _encounterRisk = default; Phase = snapshot.Phase;
        _chestPreview = null; _chestCards = null; _chestSuspended = false;
        _altarRewardPending = false;
    }

    private bool IsVisitedKeyValid(string key)
    {
        var parts = key.Split(',');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var li) || !int.TryParse(parts[1], out var idx)) return false;
        return li >= 0 && li < Map.Layers.Count && idx >= 0 && idx < Map.Layers[li].NodeCount;
    }

    private static RunCardSnapshot ToSnapshot(RunCardStack stack) => new(stack.Card.Id, stack.Card.Name, stack.Card.Type, stack.Card.Rarity,
        stack.Card.SellPrice, stack.Card.Sellable, stack.Card.IsInitialAttack, stack.Card.MaterialKind, stack.Card.MaterialAmount, stack.Count, stack.Safe);
    private static RunCardStack FromSnapshot(RunCardSnapshot value) => new(new RunCard(value.Id, value.Name, value.Type, value.Rarity,
        value.SellPrice, value.Sellable, value.IsInitialAttack, value.MaterialKind, value.MaterialAmount), value.Count, value.Safe);

    /// <summary>
    /// 移动事务（ported from game.run.flow.js moveTo）：只能从稳定落点（Ready）出发、
    /// 只能前往当前节点相邻的下一节点；位置/回合/事件结算在本次调用内一次性提交。
    /// 掷骰已被网页版移除——「掷骰子移动」按钮实际是选择相邻节点前进（chooseNextTarget）。
    /// </summary>
    public RunMove MoveTo(int toIdx)
    {
        EnsurePhase(RunPhase.Ready);
        var layer = Map.Layers[LayerIndex];
        if (toIdx < 0 || toIdx >= layer.NodeCount) throw new ArgumentOutOfRangeException(nameof(toIdx));
        if (!layer.NeighborsOf(TrackPosition).Contains(toIdx))
            throw new InvalidOperationException("该节点不是当前节点的相邻路径，无法直接跳转。");
        var from = TrackPosition;
        TrackPosition = toIdx;
        Turns++;
        // diceHistory：网页版存每次掷骰点数、UI 取 slice(-8) 展示 chips；v0.53 掷骰停用后
        // 记录移动落点（节点序号 1 起），保留最近 8 条。
        _diceHistory.Add(toIdx + 1);
        if (_diceHistory.Count > 8) _diceHistory.RemoveAt(0);
        ResolveRoom();
        return new RunMove(LayerIndex, from, TrackPosition);
    }

    /// <summary>当前节点的相邻可移动目标（同层）。</summary>
    public IReadOnlyList<int> ReachableNodes() => Map.Layers[LayerIndex].NeighborsOf(TrackPosition);

    public RunRoomResult ResolveCurrentRoom()
    {
        EnsurePhase(RunPhase.Ready);
        ResolveRoom();
        return CurrentRoomResult();
    }

    public bool AddCard(RunCard card, int count = 1, bool safe = false)
    {
        ArgumentNullException.ThrowIfNull(card);
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count));
        var existing = _ownedCards.FirstOrDefault(x => x.Card.Name == card.Name && x.Safe == safe);
        if (BackpackUsed + count > BackpackCapacity) return false;
        if (safe && _ownedCards.Where(x => x.Safe).Sum(x => x.Count) + count > Base.SafeCapacity) return false;
        if (existing is null) _ownedCards.Add(new RunCardStack(card, count, safe)); else existing.Count += count;
        return true;
    }

    public int TakeCardsFromBase(IEnumerable<(string Name, int Count)> selections)
    {
        ArgumentNullException.ThrowIfNull(selections);
        var taken = 0;
        foreach (var selection in selections)
        {
            var source = Base.Stash.FirstOrDefault(x => x.Card.Name == selection.Name);
            if (source is null) continue;
            var room = BackpackCapacity - BackpackUsed;
            if (room <= 0) break;
            var count = Base.TakeStashCards(selection.Name, Math.Min(selection.Count, room));
            if (count == 0) continue;
            AddCard(source.Card, count);
            taken += count;
        }
        return taken;
    }

    public bool MoveCardToPocket(string name, int count = 1)
    {
        var stack = _ownedCards.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null || count <= 0 || count > stack.Count) return false;
        stack.Count -= count; if (stack.Count == 0) _ownedCards.Remove(stack);
        var pocket = _usedPocket.FirstOrDefault(x => x.Card.Name == name);
        if (pocket is null) _usedPocket.Add(new RunCardStack(stack.Card, count)); else pocket.Count += count;
        return true;
    }

    public bool SetCardSafe(string name, int count = 1)
    {
        var source = _ownedCards.FirstOrDefault(x => x.Card.Name == name && !x.Safe);
        var safeUsed = _ownedCards.Where(x => x.Safe).Sum(x => x.Count);
        if (source is null || count <= 0 || count > source.Count || safeUsed + count > Base.SafeCapacity) return false;
        source.Count -= count; if (source.Count == 0) _ownedCards.Remove(source);
        var target = _ownedCards.FirstOrDefault(x => x.Card.Name == name && x.Safe);
        if (target is null) _ownedCards.Add(new RunCardStack(source.Card, count, true)); else target.Count += count;
        return true;
    }

    public bool UnsetCardSafe(string name, int count = 1)
    {
        var source = _ownedCards.FirstOrDefault(x => x.Card.Name == name && x.Safe);
        if (source is null || count <= 0 || count > source.Count) return false;
        source.Count -= count; if (source.Count == 0) _ownedCards.Remove(source);
        var target = _ownedCards.FirstOrDefault(x => x.Card.Name == name && !x.Safe);
        if (target is null) _ownedCards.Add(new RunCardStack(source.Card, count)); else target.Count += count;
        return true;
    }

    public bool ReturnCardToBase(string name, int count = 1)
    {
        var source = _ownedCards.FirstOrDefault(x => x.Card.Name == name && !x.Safe);
        if (source is null || count <= 0 || count > source.Count || !Base.DepositCards(new[] { new RunCardStack(source.Card, count) })) return false;
        source.Count -= count; if (source.Count == 0) _ownedCards.Remove(source);
        return true;
    }

    public bool RestorePocketCard(string name, int count = 1)
    {
        if (BackpackUsed + count > BackpackCapacity) return false;
        var stack = _usedPocket.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null || count <= 0 || count > stack.Count) return false;
        stack.Count -= count; if (stack.Count == 0) _usedPocket.Remove(stack);
        return AddCard(stack.Card, count, false);
    }

    public (bool Ok, int Quantity, int Coins, string Why) SellOwnedCard(string name, int count = 1)
    {
        var stack = _ownedCards.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null) return (false, 0, 0, "empty");
        if (!stack.Card.Sellable) return (false, 0, 0, "unsellable");
        var qty = Math.Min(Math.Max(1, count), stack.Count); stack.Count -= qty; if (stack.Count == 0) _ownedCards.Remove(stack);
        var coins = qty * Math.Max(1, stack.Card.SellPrice); Resources.Coins += coins;
        return (true, qty, coins, "");
    }

    private void ResolveRoom()
    {
        // ported from game.run.flow.js resolveCell：落脚结算 + 一次性内容防重刷。
        // 战斗/宝箱/拾取/事件/火堆/商店结算过一次就标记；回头路再次踏入不重触发。
        // 仍可通行/使用的格：门/紧急撤离/终局撤离（通路）。
        // 祭坛格：踩上不锁定，激活（或碎片兑换）成功后才算触发过；
        // 首脑格：编组/战斗前也不锁定——放弃可再来，只有击败首脑后才消耗本格。
        var layer = Map.Layers[LayerIndex];
        var idx = TrackPosition;
        var type = layer.TypeAt(idx);
        var door = layer.DoorAt(idx);
        var key = $"{LayerIndex},{idx}";
        var repeatable = door is not null || type is RunRoomType.Door or RunRoomType.EmergencyExit or RunRoomType.Extraction;
        if (_visited.Contains(key) && !repeatable)
        {
            // 「这里已经来过了——能拿的都拿走了，什么也没有。」
            Phase = RunPhase.Ready;
            return;
        }
        var ritualPending = type is RunRoomType.Altar or RunRoomType.Boss;
        if (!ritualPending) _visited.Add(key);
        switch (type)
        {
            case RunRoomType.Battle:
                BuildEncounter(); Phase = RunPhase.Battle; break;
            case RunRoomType.Event:
                Phase = RunPhase.Event; break;
            case RunRoomType.Shop:
                EnterShop(); break;
            case RunRoomType.Campfire:
                Hp = Math.Min(MaxHp, Hp + RunRules.FireHeal); Phase = RunPhase.Campfire; break;
            case RunRoomType.Chest:
                // 物资格（网页版 runInstant case 'chest'）：70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1）
                _pendingChests.Enqueue((Rng.NextDouble() < 0.7 ? "small" : "medium", false, false));
                _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; break;
            case RunRoomType.Door:
                // 层间门只向深处放行（网页版 openDoorModal：没有撤离选项）
                _pendingDoor = door; Phase = RunPhase.AwaitingDoor; break;
            case RunRoomType.EmergencyExit:
                Phase = RunPhase.AwaitingDoor; break;
            case RunRoomType.Extraction:
                // 终局撤离点：击败首脑后无条件放行，否则封印（可再通行）
                Phase = BossKilled ? RunPhase.AwaitingDoor : RunPhase.Ready; break;
            case RunRoomType.Altar:
                Phase = RunPhase.Altar; break;
            case RunRoomType.Boss:
                // 首脑格不锁定：未激活祭坛时挑战会被拒绝（封印）；激活后由 ChallengeBoss 进入战斗
                Phase = RunPhase.Ready; break;
            default:
                Phase = RunPhase.Ready; break;
        }
    }

    private RunRoomResult CurrentRoomResult()
    {
        var type = Map.Layers[LayerIndex].TypeAt(TrackPosition);
        return new RunRoomResult(type, LayerIndex, TrackPosition, 0, Describe(type));
    }

    public RunRoomType CurrentRoomType => Map.Layers[LayerIndex].TypeAt(TrackPosition);

    private RunDoorOption? CurrentDoorOption()
    {
        if (Phase != RunPhase.AwaitingDoor) return null;
        if (_pendingDoor is not null)
            return new RunDoorOption(_pendingDoor.Pair, true, false,
                _pendingDoor.ToLayer, _pendingDoor.ArriveAt, Map.Layers[_pendingDoor.ToLayer].Name);
        if (CurrentRoomType == RunRoomType.EmergencyExit)
            return new RunDoorOption("emergency", false, BackpackUsed >= RunRules.EmergencySacrificeCards, LayerIndex, TrackPosition, "紧急撤离点");
        if (CurrentRoomType == RunRoomType.Extraction && BossKilled)
            return new RunDoorOption("extraction", false, true, LayerIndex, TrackPosition, "终局撤离点");
        return null;
    }

    public void CompleteCampfire(IEnumerable<string>? restoreCards = null)
    {
        EnsurePhase(RunPhase.Campfire);
        if (restoreCards is not null)
            foreach (var name in restoreCards.Take(RunRules.CampfireRestorePocket)) RestorePocketCard(name);
        if (_classCardPool.Count > 0 && Rng.NextDouble() < RunRules.CampfireClassCardChance)
            AddCard(_classCardPool[Rng.NextInt(_classCardPool.Count)]);
        Phase = RunPhase.Ready;
    }
    public void LeaveEventWithoutEffect() { EnsurePhase(RunPhase.Event); Phase = RunPhase.Ready; }
    public RunEventResult ResolveEvent()
    {
        EnsurePhase(RunPhase.Event);
        // 网页版 runEventDeck 旧表路径：按权重抽 randomEvents 一条；coins 区间掷币，
        // item=chest 转为开宝箱，其余无事发生。
        var total = _data.RandomEvents.Sum(ev => ev.Weight);
        var roll = Rng.NextInt(total);
        var picked = _data.RandomEvents[0];
        foreach (var ev in _data.RandomEvents)
        {
            roll -= ev.Weight;
            if (roll < 0) { picked = ev; break; }
        }
        var coins = picked.HasCoins && !picked.CreatesChest ? Rng.NextInt(picked.CoinMin, picked.CoinMax + 1) : 0;
        RunEventResult result = new(picked.Text, coins, 0, 0, picked.CreatesChest);
        Resources.Coins += result.Coins; Resources.Wood += result.Wood; Resources.Rations += result.Rations;
        if (result.CreatedChest) { _pendingChests.Enqueue(("small", false, false)); _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; }
        else Phase = RunPhase.Ready;
        return result;
    }

    public IReadOnlyList<RunEventChoice> DrawEventChoices()
    {
        EnsurePhase(RunPhase.Event);
        var ids = new[] { "goldmine", "airdrop", "chestdraw", "timeskip", "demondeal", "bandits", "mystery", "goldhammer", "relief", "systemsupply" };
        _pendingEventId = ids[Rng.NextInt(ids.Length)];
        _eventChoices = EventChoicesFor(_pendingEventId);
        return _eventChoices;
    }

    public RunEventResult ChooseEvent(int choiceIndex)
    {
        EnsurePhase(RunPhase.Event);
        if (_pendingEventId is null) DrawEventChoices();
        if (choiceIndex < 0 || choiceIndex >= _eventChoices.Count) throw new ArgumentOutOfRangeException(nameof(choiceIndex));
        var choice = _eventChoices[choiceIndex];
        _pendingEventId = null; _eventChoices = Array.Empty<RunEventChoice>();
        return ApplyEventChoice(choice.Id);
    }

    private static IReadOnlyList<RunEventChoice> EventChoicesFor(string id) => id switch
    {
        "goldmine" => new[] { new RunEventChoice("goldmine_safe", "收下 3 币", "稳定收益", "ok"), new RunEventChoice("goldmine_deep", "冒险挖深", "+6 币，但损失 3 血", "danger") },
        "airdrop" => new[] { new RunEventChoice("airdrop_wood", "木材 ×1", "扩建与仓储路线"), new RunEventChoice("airdrop_rations", "口粮 ×1", "为安全格与续航准备"), new RunEventChoice("airdrop_heal", "应急处理", "回复 3 血", "ok") },
        "chestdraw" => new[] { new RunEventChoice("chest_small", "撬开小型物资箱", "低风险：1 张卡 + 1~2 币"), new RunEventChoice("chest_medium", "赌一把密封物资箱", "高回报：三选一 + 2~3 币", "ok") },
        "timeskip" => new[] { new RunEventChoice("timeskip_move", "踏入裂隙", "向前 6 格，落点照常结算", "ok") },
        "demondeal" => new[] { new RunEventChoice("demondeal_trade", "以血换物", "-1 血，获得一件传说物品", "danger") },
        "bandits" => new[] { new RunEventChoice("bandits_fight", "应 战", "掠夺者 ×5，战胜后密封物资箱 ×2", "danger") },
        "mystery" => new[] { new RunEventChoice("mystery_supply", "翻找补给柜", "彩色令牌 + 2 币") },
        "goldhammer" => new[] { new RunEventChoice("goldhammer_strike", "抡起动力锤", "先造成 5 点伤害，一击制敌再 +2 币", "danger") },
        "relief" => new[] { new RunEventChoice("relief_heal", "接受处理", "回复 6 血", "ok") },
        _ => new[] { new RunEventChoice("systemsupply_restock", "对接终端", "彩色令牌 + 木材 ×1") }
    };

    private RunEventResult ApplyEventChoice(string id)
    {
        switch (id)
        {
            case "goldmine_safe": Resources.Coins += 3; Phase = RunPhase.Ready; return new("你只取走入口附近的矿石，在第二次震动前退了出来。", 3, 0, 0, false);
            case "goldmine_deep": Resources.Coins += 6; Hp = Math.Max(1, Hp - 3); Phase = RunPhase.Ready; return new("更深处确实埋着富矿，代价是被碎石划开的伤口。", 6, 0, 0, false);
            case "airdrop_wood": Resources.Wood++; Phase = RunPhase.Ready; return new("你拆下还能承重的结构件。", 0, 1, 0, false);
            case "airdrop_rations": Resources.Rations++; Phase = RunPhase.Ready; return new("你留下密封完好的口粮。", 0, 0, 1, false);
            case "airdrop_heal": Hp = Math.Min(MaxHp, Hp + 3); Phase = RunPhase.Ready; return new("箱内的医疗模块仍能完成一次快速处理。", 0, 0, 0, false);
            case "chest_small": _pendingChests.Enqueue(("small", false, false)); _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; return new("小箱的锁扣应声弹开。", 0, 0, 0, true);
            case "chest_medium": _pendingChests.Enqueue(("medium", false, false)); _returnAfterChest = RunPhase.Ready; Phase = RunPhase.Chest; return new("密封箱亮起绿色指示灯。", 0, 0, 0, true);
            case "timeskip_move":
                // 网页版已停用事件连锁移动（cancelLegacyChainMove：即时事件不会盲选第一条邻边）
                Phase = RunPhase.Ready; return new("时空孔隙在你面前塌缩了——什么也没有发生。", 0, 0, 0, false);
            case "demondeal_trade": Hp = Math.Max(1, Hp - 1); AddCard(new RunCard("event-legend", "传说旧物", "装备", "传说", 5, true)); Phase = RunPhase.Ready; return new("指尖被划开的瞬间，一件冰冷的旧物落进了掌心。", 0, 0, 0, false);
            case "bandits_fight":
                // 网页版 2026-09-11 实机定版：数量随层数缩放（第 1 层 3 只 → 第 3 层起 5 只）
                _encounter.Clear();
                var gangN = Math.Min(5, 3 + LayerIndex);
                for (var i = 0; i < gangN; i++) _encounter.Add(CreateEnemy("bandit"));
                _eventBattleDrops.Enqueue(("medium", false)); _eventBattleDrops.Enqueue(("medium", false)); _encounterRisk = RunRisk.Medium; Phase = RunPhase.Battle; return new("五道剪影从残骸后站起。", 0, 0, 0, false);
            case "mystery_supply":
                // 网页 2026-09-09 事件 v2（tt6-mystery 接收补给）：彩色令牌碎片 ×1 + 2 币（不再直发彩色令牌卡）
                GrantFragments(1); Resources.Coins += 2; Phase = RunPhase.Ready;
                return new("补给舱完好——你收下了里面的晶体与两枚旧硬币。", 2, 0, 0, false);
            case "goldhammer_strike":
                BuildEncounter(); var foe = _encounter[0]; _encounter.Clear(); _encounter.Add(foe with { Hp = foe.Hp - 5 });
                if (_encounter[0].Hp <= 0) { Resources.Coins += 2; Phase = RunPhase.Ready; return new("闪金之锤一击制敌。", 2, 0, 0, false); }
                Phase = RunPhase.Battle; return new("闪金之锤重击后，战斗打响！", 0, 0, 0, false);
            case "relief_heal": Hp = Math.Min(MaxHp, Hp + 6); Phase = RunPhase.Ready; return new("缠好绷带时，你觉得自己又能再走一段了。", 0, 0, 0, false);
            default:
                // 网页 2026-09-09 事件 v2（tt6-systemsupply 接收补给）：彩色令牌碎片 ×1 + 木材卡 ×1
                // （需求 #10：物资一律以卡牌入包；背包满时入待收取队列）
                GrantFragments(1);
                var wood = FindPoolCard("tt-wood") ?? new RunCard("tt-wood", "木材", "资源", "古朴", 2);
                if (!AddCard(wood)) EnqueueReward(wood);
                Phase = RunPhase.Ready;
                return new("无人机松开货舱：一枚晶体和一段建材滑了出来。", 0, 0, 0, false);
        }
    }

    private void BuildEncounter()
    {
        _encounter.Clear();
        // 网页版 buildEncounter：先掷精英（按表 chance/pool/size），否则抽一个 entry 并按其
        // size 区间等概率取数量，逐只从 monsters 图鉴取模板。
        var table = _data.Encounters[Math.Min(LayerIndex, _data.Encounters.Count - 1)];
        if (table.EliteChance > 0 && Rng.NextDouble() < table.EliteChance)
        {
            _encounterRisk = RunRisk.Elite;
            var eliteId = table.ElitePool[Rng.NextInt(table.ElitePool.Count)];
            _encounter.Add(CreateEnemy(eliteId));
            return;
        }
        _encounterRisk = table.Risk;
        var entry = table.Entries[Rng.NextInt(table.Entries.Count)];
        var count = Rng.NextInt(entry.Min, entry.Max + 1);
        for (var i = 0; i < count; i++) _encounter.Add(CreateEnemy(entry.MonsterId));
    }

    private RunEnemy CreateEnemy(string id)
    {
        var monster = _data.RequireMonster(id);
        return new RunEnemy(id, monster.Name, monster.Hp, monster.Attack, monster.Elite);
    }

    /// <summary>测试/适配 seam：注入遭遇（战斗结算的「巨兽 2 大箱」判定依赖遭遇名单）。</summary>
    public void DebugSetEncounter(IEnumerable<RunEnemy> enemies)
    {
        ArgumentNullException.ThrowIfNull(enemies);
        if (Phase is not (RunPhase.Ready or RunPhase.Battle)) throw new InvalidOperationException("只能在待行动或战斗状态注入遭遇。");
        _encounter.Clear(); _encounter.AddRange(enemies);
    }

    /// <summary>按 id 在已配置卡池中找卡（宠物蛋/桃/令牌类固定 id 的入口）。</summary>
    private RunCard? FindPoolCard(string id) =>
        _lootCardPool.FirstOrDefault(card => card.Id == id)
        ?? _shopCardPool.FirstOrDefault(card => card.Id == id)
        ?? _classCardPool.FirstOrDefault(card => card.Id == id);

    /// <summary>按卡名在已配置卡池中找卡（BOSS 箱的 金币/银币/铜币 按名取卡）。</summary>
    private RunCard? FindPoolCardByName(string name) =>
        _lootCardPool.FirstOrDefault(card => card.Name == name)
        ?? _shopCardPool.FirstOrDefault(card => card.Name == name)
        ?? _classCardPool.FirstOrDefault(card => card.Name == name);

    public IReadOnlyList<(string Kind, bool IsBoss, bool IsClass)> CompleteBattle(bool won)
        => CompleteBattle(won, Hp);

    public IReadOnlyList<(string Kind, bool IsBoss, bool IsClass)> CompleteBattle(bool won, int remainingHp)
    {
        EnsurePhase(RunPhase.Battle);
        if (remainingHp < 0 || remainingHp > MaxHp) throw new ArgumentOutOfRangeException(nameof(remainingHp));
        Hp = remainingHp;
        if (!won)
        {
            foreach (var stack in _ownedCards.Where(x => x.Safe))
                if (!Base.DepositCards(new[] { new RunCardStack(stack.Card, stack.Count) }, false))
                    EnqueueRecovery(stack);
            foreach (var stack in _pendingRewards) EnqueueRecovery(stack);
            _pendingRewards.Clear();
            _ownedCards.Clear(); _usedPocket.Clear(); Resources.Coins = 0; Resources.Wood = 0; Resources.Rations = 0; Resources.Keys = 0;
            Phase = RunPhase.Defeat; return Array.Empty<(string, bool, bool)>();
        }
        var bossIndex = -1;
        if (_encounter.Count == 1)
            for (var index = 0; index < Map.Bosses.Count; index++)
                if (Map.Bosses[index].Id == _encounter[0].Id) { bossIndex = index; break; }
        if (bossIndex >= 0)
        {
            _defeatedBosses.Add(bossIndex);
            BossKilled = true;                       // 终局撤离点放行（网页版 game.bossKilled）
            _visited.Add($"{LayerIndex},{TrackPosition}");   // 击败首脑后才消耗本格
        }
        IReadOnlyList<(string Kind, bool IsBoss, bool IsClass)> drops;
        if (bossIndex >= 0)
        {
            drops = new[] { ("boss", true, false) };
        }
        else
        {
            // 网页 onBattleEnd：eventChests.concat(rollDrops(opts))——事件奖励宝箱与
            // 常规分层掉落叠加发放（巨兽 2 大箱也走 rollDrops 的 foeNames 判定）。
            var combined = new List<(string Kind, bool IsBoss, bool IsClass)>();
            while (_eventBattleDrops.Count > 0)
            {
                var drop = _eventBattleDrops.Dequeue();
                combined.Add((drop.Kind, drop.IsBoss, false));
            }
            combined.AddRange(RollDrops(LayerIndex));
            drops = combined;
        }
        foreach (var drop in drops) _pendingChests.Enqueue(drop);
        // 战利品结算后回待机：祭坛→首脑→终局撤离点是图上三个相邻节点，走格子衔接
        _returnAfterChest = RunPhase.Ready;
        Phase = RunPhase.Chest;
        return drops;
    }

    private IReadOnlyList<(string Kind, bool IsBoss, bool IsClass)> DrainEventDrops()
    {
        var result = _eventBattleDrops.Select(drop => (drop.Kind, drop.IsBoss, false)).ToArray();
        _eventBattleDrops.Clear(); return result;
    }

    private IReadOnlyList<(string Kind, bool IsBoss, bool IsClass)> RollDrops(int layer)
    {
        // ported from chests.js rollDrops：BOSS 固定首脑保险柜（CompleteBattle 分支）；
        // 巨兽「荒渊」（第 3/4 层精英）固定奖励 2 个大宝箱（30% 额外传说卡归战后结算，见网页 settle）；
        // 其余按层取 layerChests 表——fixed 直接给，否则加权抽箱数与箱型，
        // 每箱 25% 为职业宝箱（黑箱，只掉职业卡牌；猎鹰宝宝 35% 归批次 5 宠物）。
        if (_encounter.Any(enemy => enemy.Name.Contains("巨兽", StringComparison.Ordinal)))
            return new[] { ("large", false, false), ("large", false, false) };
        var spec = _data.LayerChests[Math.Min(layer, _data.LayerChests.Count - 1)];
        if (spec.FixedCounts.Count > 0)
            return spec.FixedCounts
                .SelectMany(fixedDrop => Enumerable.Repeat((fixedDrop.Kind, false, false), fixedDrop.Weight))
                .ToArray();
        var chests = Weighted(spec.Counts.Select(count => (count.Count, count.Weight)));
        var result = new List<(string, bool, bool)>(chests);
        for (var i = 0; i < chests; i++)
        {
            var kind = Weighted(spec.Types.Select(t => (t.Kind, t.Weight)));
            result.Add((kind, false, Rng.NextDouble() < LootTables.ClassChestChance));
        }
        return result;
    }

    private T Weighted<T>(IEnumerable<(T Value, int Weight)> items)
    {
        var list = items as IList<(T Value, int Weight)> ?? items.ToArray();
        var total = 0;
        foreach (var item in list) total += item.Weight;
        var roll = Rng.NextInt(total);
        foreach (var item in list)
        {
            roll -= item.Weight;
            if (roll < 0) return item.Value;
        }
        return list[list.Count - 1].Value;
    }

    public RunChestLoot OpenNextChest() => OpenNextChest(0);

    public RunChestPreview PeekNextChest()
    {
        EnsurePhase(RunPhase.Chest);
        if (_chestPreview is not null) return _chestPreview;
        if (!_pendingChests.TryPeek(out var chest))
        {
            _chestPreview = new RunChestPreview("none", false, false, false, Array.Empty<string>(), 0);
            return _chestPreview;
        }
        // 网页 chests.next()：开箱瞬间 rollContents 一次性掷完整个箱子的内容，挂起/恢复不重掷
        RollContents(chest);
        return _chestPreview!;
    }

    // ported from chests.js rollContents：掷一个宝箱的完整内容（cards=开出的卡，coins=内含币）。
    private void RollContents((string Kind, bool IsBoss, bool IsClass) chest)
    {
        var kind = _data.RequireChestKind(chest.Kind);
        var cards = new List<RunCard>();
        var taken = new HashSet<string>(StringComparer.Ordinal);
        string? pity = null;
        var eggHit = false;
        var tokenHit = false;
        var coins = 0;
        if (chest.IsClass && chest.Kind != "boss")
        {
            // 职业宝箱（黑箱）：只掉落本职业的职业卡牌（2026-09-06）；不参与保底/宠物蛋/通行证
            var pool = _classCardPool.Where(card => card.Rarity == "职业").ToList();
            for (var i = 0; i < kind.Candidates && pool.Count > 0; i++)
                cards.Add(pool[Rng.NextInt(pool.Count)]);
            if (kind.CoinMax > 0) coins = Rng.NextInt(kind.CoinMin, kind.CoinMax + 1);
            PublishChestPreview(chest, cards, coins, eggHit, tokenHit, pity);
            return;
        }
        // 随机卡池（2026-09-08 定版爆率）：只开 武术/法术/装备/道具/资源 五类，
        // 稀有度 古朴:稀有:史诗:传说 = 60:28:9:3，同稀有度内均分、道具 ×0.7、装备 ×0.8；
        // 同一宝箱内尽量不重复（taken 去重）。卡池未配置时退回 chestTable 名单（骨架测试兜底，
        // 网页版卡库恒非空无此路径）。
        for (var i = 0; i < kind.Candidates; i++)
        {
            RunCard? card = _lootCardPool.Count > 0
                ? LootTables.RandomDropCard(_lootCardPool, _data, Rng, taken)
                : null;
            if (card is null && _data.ChestTable.Count > 0)
            {
                var name = _data.ChestTable[Rng.NextInt(_data.ChestTable.Count)];
                card = new RunCard($"loot-{name}", name, "资源", "古朴", 1, false, false, null, 1, RunCardSemantic.Resource);
            }
            if (card is not null) { taken.Add(card.Id); cards.Add(card); }
        }
        // 宠物蛋（2026-09-09 需求 #2）：固定 0.7% 爆率额外开出（不占随机卡池，unrandom）；
        // 蛋的孵化系统归批次 5，这里只落物品。
        if (Rng.NextDouble() < LootTables.PetEggChance)
        {
            var egg = FindPoolCard(LootTables.PetEggId);
            if (egg is not null) { cards.Add(egg); eggHit = true; }
        }
        // —— 宝箱保底（2026-09-09；设计者定版权重 60:28:9:3 不动）——
        // 中宝箱（3 选 1，pickFrom）保底至少 1 张「稀有」+；大宝箱/首脑宝箱保底至少 1 张「史诗」+。
        // 未达标重掷最后一张（目标档内挑卡，该档暂无可用卡则逐档上探；全部失败保持原结果）。
        var rarities = _data.CardRarities.ToList();
        int RiOf(string rarity) => Math.Max(0, rarities.IndexOf(rarity));
        var needRi = kind.PickFrom > 0 ? rarities.IndexOf("稀有")
            : chest.Kind is "large" or "boss" ? rarities.IndexOf("史诗") : -1;
        if (needRi > 0 && cards.Count > 0 && !cards.Any(card => RiOf(card.Rarity) >= needRi))
        {
            // 网页字面顺序：[目标档, 传说, 史诗, 稀有] 过滤后逐档上探
            var tiers = new[] { rarities[needRi], "传说", "史诗", "稀有" }.Where(rarity => RiOf(rarity) >= needRi);
            foreach (var tier in tiers)
            {
                var up = LootTables.PickOfRarity(tier, _lootCardPool, _data, Rng, taken);
                if (up is null) continue;
                cards[^1] = up;
                taken.Add(up.Id);
                pity = tier;
                break;
            }
        }
        if (kind.CoinMax > 0) coins = Rng.NextInt(kind.CoinMin, kind.CoinMax + 1);
        // BOSS宝箱：金币/银币/铜币按名取一张 + tokenChance 概率的员工通行证B（都是卡牌并入 cards）。
        // 币名先取好再找卡——随机取名不能写进查找回调（网页 chests.js 注释同款坑）。
        if (kind.CoinCards.Count > 0)
        {
            var coinName = kind.CoinCards[Rng.NextInt(kind.CoinCards.Count)];
            var coin = FindPoolCardByName(coinName);
            if (coin is not null) cards.Add(coin);
        }
        if (kind.TokenChance > 0 && Rng.NextDouble() < kind.TokenChance)
        {
            var token = FindPoolCard(TokenCraft.TokenGoldId);
            if (token is not null) { cards.Add(token); tokenHit = true; }
        }
        PublishChestPreview(chest, cards, coins, eggHit, tokenHit, pity);
    }

    private void PublishChestPreview((string Kind, bool IsBoss, bool IsClass) chest, List<RunCard> cards,
        int coins, bool eggHit, bool tokenHit, string? pity)
    {
        var requiresChoice = _data.RequireChestKind(chest.Kind).PickFrom > 0;
        _chestCards = cards;
        _chestPreview = new RunChestPreview(chest.Kind, chest.IsBoss, chest.IsClass, requiresChoice,
            cards.Select(card => card.Name).ToArray(), coins, eggHit, tokenHit, pity);
    }

    /// <summary>Opens one chest; pickFrom chests (medium) expose candidates and the caller selects one.</summary>
    public RunChestLoot OpenNextChest(int selectedIndex)
    {
        EnsurePhase(RunPhase.Chest);
        if (_chestSuspended) throw new InvalidOperationException("搜刮流程已挂起——请先关闭背包（resume）再开箱。");
        if (_pendingChests.Count == 0) { Phase = _returnAfterChest; return new RunChestLoot("none", 0, Array.Empty<string>()); }
        var preview = PeekNextChest();
        var chest = _pendingChests.Dequeue();
        var cards = _chestCards ?? Array.Empty<RunCard>();
        var items = preview.Candidates;
        var requiresChoice = preview.RequiresChoice && cards.Count > 0;
        if (requiresChoice && (selectedIndex < 0 || selectedIndex >= cards.Count)) throw new ArgumentOutOfRangeException(nameof(selectedIndex));
        var acceptedCards = requiresChoice ? new[] { cards[selectedIndex] } : cards;
        var accepted = requiresChoice ? new[] { items[selectedIndex] } : items;
        var deferred = requiresChoice ? items.Where((_, index) => index != selectedIndex).ToArray() : Array.Empty<string>();
        foreach (var card in acceptedCards)
            if (!AddCard(card)) EnqueueReward(card);
        Resources.Coins += preview.Coins;
        _chestPreview = null;
        _chestCards = null;
        if (_pendingChests.Count == 0) Phase = _returnAfterChest;
        return new RunChestLoot(chest.Kind, preview.Coins, items, chest.IsClass, requiresChoice, selectedIndex,
            accepted, deferred, preview.EggHit, preview.TokenHit, preview.PityTier);
    }

    /// <summary>挂起开箱（ported from chests.js suspend：搜刮界面允许打开背包整理，
    /// 作废未播完的搜索演出；队列与已掷内容保持不动）。返回是否确有进行中的开箱流程。</summary>
    public bool SuspendChests()
    {
        if (Phase != RunPhase.Chest || _pendingChests.Count == 0) return false;
        _chestSuspended = true;
        return true;
    }

    /// <summary>恢复开箱（ported from chests.resume：重新渲染当前搜刮面板继续开）。</summary>
    public void ResumeChests() => _chestSuspended = false;

    /// <summary>开箱流程当前是否挂起（背包借开箱面板期间）。</summary>
    public bool ChestsSuspended => _chestSuspended;

    private void EnqueueReward(RunCard card)
    {
        var existing = _pendingRewards.FirstOrDefault(x => x.Card.Name == card.Name);
        if (existing is null) _pendingRewards.Add(new RunCardStack(card)); else existing.Count++;
    }

    public bool ClaimPendingReward(string name, int count = 1)
    {
        var pending = _pendingRewards.FirstOrDefault(x => x.Card.Name == name);
        if (pending is null || count <= 0 || count > pending.Count || !AddCard(pending.Card, count)) return false;
        pending.Count -= count; if (pending.Count == 0) _pendingRewards.Remove(pending); return true;
    }

    public void EnterDoor() {
        EnsurePhase(RunPhase.AwaitingDoor);
        if (_pendingDoor is null) throw new InvalidOperationException("当前节点没有层间门。");
        LayerIndex = _pendingDoor.ToLayer; TrackPosition = _pendingDoor.ArriveAt; _pendingDoor = null; Phase = RunPhase.Ready;
    }
    public void StayAtDoor() { EnsurePhase(RunPhase.AwaitingDoor); _pendingDoor = null; Phase = RunPhase.Ready; }

    /// <summary>紧急撤离的献祭代价（网页版 openEmergencyModal：撤离前必须献祭 3 张背包卡牌）。</summary>
    public IReadOnlyList<string> DefaultEmergencySacrifice()
    {
        var names = new List<string>();
        var left = RunRules.EmergencySacrificeCards;
        foreach (var stack in _ownedCards)
        {
            var take = Math.Min(stack.Count, left);
            for (var i = 0; i < take; i++) names.Add(stack.Card.Name);
            left -= take;
            if (left == 0) break;
        }
        if (left > 0) throw new InvalidOperationException($"背包卡牌不足 {RunRules.EmergencySacrificeCards} 张，无法支付紧急撤离的代价。");
        return names;
    }

    public void ExtractAtDoor() => ExtractAtDoor(null);

    /// <summary>
    /// 撤离（ported from game.run.altar.js openEmergencyModal）：
    /// 第三层紧急撤离点——献祭 EmergencySacrificeCards 张背包卡牌后撤离；
    /// 第四层终局撤离点——击败首脑后无条件放行（未击败则锁定）。
    /// </summary>
    public void ExtractAtDoor(IReadOnlyList<string>? sacrificeCardNames)
    {
        EnsurePhase(RunPhase.AwaitingDoor);
        var type = CurrentRoomType;
        if (type == RunRoomType.EmergencyExit)
        {
            var sacrifice = sacrificeCardNames ?? DefaultEmergencySacrifice();
            if (sacrifice.Count != RunRules.EmergencySacrificeCards)
                throw new InvalidOperationException($"紧急撤离需要献祭 {RunRules.EmergencySacrificeCards} 张背包卡牌。");
            foreach (var name in sacrifice) RemoveOneInstance(name);
            Extract();
            return;
        }
        if (type == RunRoomType.Extraction)
        {
            if (!BossKilled) throw new InvalidOperationException("撤离信标被污染核心压制——击败第四层的首脑后才能撤离。");
            Extract();
            return;
        }
        throw new InvalidOperationException("当前节点不是撤离点。");
    }

    private void RemoveOneInstance(string cardName)
    {
        var stack = _ownedCards.FirstOrDefault(x => x.Card.Name == cardName)
            ?? throw new InvalidOperationException($"背包中没有卡牌【{cardName}】。");
        stack.Count--;
        if (stack.Count == 0) _ownedCards.Remove(stack);
    }

    public void EnterAltar() { EnsurePhase(RunPhase.Altar); }
    public void LeaveAltar() { EnsurePhase(RunPhase.Altar); Phase = RunPhase.Ready; }

    // ---------- 第四层终局：祭坛（弃 3 激活选奖励 / 2 碎片兑换）→ 首脑 → 终局撤离点 ----------
    // ported from game.run.altar.js openAltarRitual/openAltarReward/openBossGate：
    // 激活（或兑换）成功才算触发过本格；离开未激活可再来。首脑格必须先激活祭坛。

    public const string AltarLockedMessage = "首脑被污染祭坛的辐射护盾庇护——先激活祭坛，再来挑战。";

    /// <summary>弃 3 张背包卡牌激活祭坛（之后需 ChooseAltarReward 二选一）。</summary>
    public void ActivateAltarByDiscard(IReadOnlyList<string> cardNames)
    {
        EnsurePhase(RunPhase.Altar);
        if (AltarActivated) throw new InvalidOperationException("祭坛已经苏醒。");
        if (cardNames is null || cardNames.Count != RunRules.AltarDiscardCards)
            throw new InvalidOperationException($"需要弃掉 {RunRules.AltarDiscardCards} 张背包卡牌才能激活祭坛。");
        foreach (var name in cardNames) RemoveOneInstance(name);
        MarkAltarActivated();
    }

    /// <summary>献 2 枚彩色令牌碎片兑换本职业随机卡并激活祭坛（不弃牌）。
    /// 职业卡池为空或背包已满时碎片原样保留并返回 false（网页版口径：先发牌后扣碎片）。</summary>
    public bool ActivateAltarByFragments()
    {
        EnsurePhase(RunPhase.Altar);
        if (AltarActivated) throw new InvalidOperationException("祭坛已经苏醒。");
        if (Fragments < RunRules.AltarFragmentCost)
            throw new InvalidOperationException($"彩色令牌碎片不足（现有 {Fragments}，需要 {RunRules.AltarFragmentCost} 枚）。");
        if (_classCardPool.Count == 0) return false;
        var card = _classCardPool[Rng.NextInt(_classCardPool.Count)];
        if (!AddCard(card)) return false;
        if (!TryConsumeFragments(RunRules.AltarFragmentCost)) return false;
        MarkAltarActivated();
        _altarRewardPending = false;   // 碎片兑换直接结算，没有二选一奖励
        Phase = RunPhase.Ready;
        return true;
    }

    /// <summary>激活后的奖励二选一：① 复原 3 张消耗卡 + 回复 10 血；② 随机传说卡 + 装备卡。</summary>
    public void ChooseAltarReward(int index)
    {
        EnsurePhase(RunPhase.Altar);
        if (!_altarRewardPending) throw new InvalidOperationException("祭坛尚未被激活。");
        if (index is not (0 or 1)) throw new ArgumentOutOfRangeException(nameof(index));
        _altarRewardPending = false;
        if (index == 0)
        {
            Hp = Math.Min(MaxHp, Hp + RunRules.AltarRewardHeal);
            RestoreFromPocket(RunRules.AltarRewardRestoreCards);
        }
        else
        {
            var legends = _lootCardPool.Where(c => c.Rarity == "传说").ToList();
            var equips = _lootCardPool.Where(c => c.Semantic == RunCardSemantic.Equipment).ToList();
            if (legends.Count > 0) AddCard(legends[Rng.NextInt(legends.Count)]);
            if (equips.Count > 0) AddCard(equips[Rng.NextInt(equips.Count)]);
        }
        Phase = RunPhase.Ready;
    }

    /// <summary>献祭 1 张道具卡，从消耗口袋复原 2 张（不消耗祭坛、不影响其他献祭功能，可重复）。</summary>
    public bool SacrificeItemAtAltar(string itemName)
    {
        EnsurePhase(RunPhase.Altar);
        var stack = _ownedCards.FirstOrDefault(x => x.Card.Name == itemName && x.Card.Semantic == RunCardSemantic.Item);
        if (stack is null) return false;
        RemoveOneInstance(itemName);
        RestoreFromPocket(RunRules.AltarItemRestoreCards);
        return true;
    }

    private void MarkAltarActivated()
    {
        AltarActivated = true;
        _visited.Add($"{LayerIndex},{TrackPosition}");   // 激活成功才消耗本格
        _altarRewardPending = true;
    }

    /// <summary>从消耗口袋复原至多 maxCount 张（道具/装备类消耗不可复原；背包满即停，网页版口径）。</summary>
    private void RestoreFromPocket(int maxCount)
    {
        for (var restored = 0; restored < maxCount;)
        {
            var next = _usedPocket.FirstOrDefault(x => x.Card.Semantic is not (RunCardSemantic.Item or RunCardSemantic.Equipment));
            if (next is null) break;
            if (!RestorePocketCard(next.Card.Name, 1)) break;
            restored++;
        }
    }

    /// <summary>挑战首脑（网页版 openBossGate：必须先激活祭坛；本格不锁定，击败后才消耗）。</summary>
    public void ChallengeBoss(int index)
    {
        EnsurePhase(RunPhase.Ready);
        if (Map.Layers[LayerIndex].TypeAt(TrackPosition) != RunRoomType.Boss)
            throw new InvalidOperationException("只有首脑格可以挑战首脑。");
        if (!AltarActivated) throw new InvalidOperationException(AltarLockedMessage);
        if (BossKilled) throw new InvalidOperationException("首脑已被击败。");
        if (index < 0 || index >= Map.Bosses.Count) throw new ArgumentOutOfRangeException(nameof(index));
        var b = Map.Bosses[index];
        _encounter.Clear(); _encounter.Add(new RunEnemy(b.Id, b.Name, b.Hp, b.Attack, true));
        _encounterRisk = RunRisk.Elite;
        Phase = RunPhase.Battle;
    }

    private void EnterShop()
    {
        // ported from game.run.shop.js generateShopStock：商队每次靠站随机卸货——
        // 6 张随机卡（稀有度按 cards.json shopWeights 掷档，档内类型均分/道具×0.7/装备×0.8）
        // + 桃固定栏位（2 币，回 6 血，2026-09-10 替代金疮药）+ 初始攻击补充（1 币/张，
        // 本站最多 5 张，2026-09-08 定版）+ 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。
        // 招财猫首格免费是宠物效果（批次 5）；网页商店不卖木材/口粮/钥匙裸资源（旧骨架栏位移除）。
        // 四层图上商店格与层间门不共存（门是独立节点），离店即回待机。
        var offers = new List<RunShopOffer>();
        for (var i = 0; i < 6; i++)
        {
            var card = PickRandomShopCard();
            offers.Add(card is null
                ? new RunShopOffer($"card-{i}", RunRoomType.Empty, 1, 0, Sold: true)
                : new RunShopOffer($"card-{i}", RunRoomType.Empty, 1, _data.CardPrice(card.Rarity), Card: card));
        }
        var peach = FindPoolCard("tt-peach") ?? new RunCard("tt-peach", "桃", "道具", "古朴", 2);
        offers.Add(new RunShopOffer("peach", RunRoomType.Empty, 1, 2, Card: peach));
        offers.Add(new RunShopOffer("sha", RunRoomType.Empty, 1, 1, Card: InitialAttackCard, ShaReplenish: 5));
        var mystery = PickRandomShopCard();
        offers.Add(mystery is null
            ? new RunShopOffer("mystery", RunRoomType.Empty, 1, 0, Sold: true)
            : new RunShopOffer("mystery", RunRoomType.Empty, 1, 3, Card: mystery, IsMystery: true));
        Phase = RunPhase.Shop; _shop = offers;
    }

    private static RunCard InitialAttackCard { get; } = new("builtin-sha", "初始攻击", "武术", "初始", 1, false, true);

    /// <summary>网页 lib 均匀抽（rarity!=='衍生' && !unrandom）：50 次掷档挑卡失败后的兜底，
    /// 也是神秘货箱的直接取卡方式（网页 mysteryCard = lib[floor(Random*len)]）。</summary>
    private RunCard? PickRandomShopCard()
    {
        if (_shopCardPool.Count == 0) return null;
        if (_data.CardShopWeights.Count > 0)
        {
            for (var tries = 0; tries < 50; tries++)
            {
                var rarity = Weighted(_data.CardShopWeights.Select(kv => (kv.Key, kv.Value)));
                var card = LootTables.PickOfRarity(rarity, _shopCardPool, _data, Rng);
                if (card is not null) return card;
            }
        }
        return _shopCardPool[Rng.NextInt(_shopCardPool.Count)];
    }

    private int CardPrice(RunCard card) => _data.CardPrice(card.Rarity);
    public void BuyShopOffer(string id)
    {
        EnsurePhase(RunPhase.Shop);
        var offer = _shop.FirstOrDefault(x => x.Id == id && !x.Sold) ?? throw new InvalidOperationException("商品不存在或已售出。");
        if (offer.ShaReplenish is <= 0) throw new InvalidOperationException("初始攻击已补满。");
        if (Resources.Coins < offer.Price) throw new InvalidOperationException("金币不足。");
        if (offer.Card is not null && BackpackUsed + offer.Quantity > BackpackCapacity)
            throw new InvalidOperationException("背包已满。");
        Resources.Coins -= offer.Price;
        if (offer.Card is not null) AddCard(offer.Card, offer.Quantity);
        else if (offer.Resource == RunRoomType.Rations) Resources.Rations += offer.Quantity;
        else if (offer.Resource == RunRoomType.Wood) Resources.Wood += offer.Quantity;
        else Resources.Keys += offer.Quantity;
        if (offer.ShaReplenish is { } remaining)
        {
            // 初始攻击补充位：本站最多 5 张（网页 slot.shaReplenish--），补满即收摊
            _shop = _shop.Select(x => x.Id == id ? x with { ShaReplenish = remaining - 1, Sold = remaining - 1 <= 0 } : x).ToArray();
        }
        else
        {
            _shop = _shop.Select(x => x.Id == id ? x with { Sold = true } : x).ToArray();
        }
    }
    public void LeaveShop() { EnsurePhase(RunPhase.Shop); Phase = RunPhase.Ready; }

    public void ConsumeRation(int amount = 1)
    {
        EnsurePhase(RunPhase.Ready);
        if (amount <= 0 || Resources.Rations < amount) throw new InvalidOperationException("口粮不足。");
        Resources.Rations -= amount; Stamina = Math.Min(MaxStamina, Stamina + amount * 3);
    }
    public void Extract()
    {
        if (Phase == RunPhase.Victory) return;
        if (Phase == RunPhase.Defeat) throw new InvalidOperationException("对局已失败。");
        if (Phase == RunPhase.Settlement) return;
        if (Stamina <= 0) { Phase = RunPhase.Defeat; return; }
        Base.AddResources(Resources.Wood, Resources.Rations, Resources.Keys);
        _settlementCards.Clear();
        foreach (var stack in _ownedCards)
            _settlementCards.Add(new RunSettlementCard(stack.Card, stack.Count, Base.DepositCards(new[] { stack }, false)));
        foreach (var stack in _pendingRewards)
            _settlementCards.Add(new RunSettlementCard(stack.Card, stack.Count, Base.DepositCards(new[] { stack }, false)));
        _pendingRewards.Clear();
        foreach (var stack in _usedPocket) Base.DepositCards(new[] { stack }, true);
        _ownedCards.Clear(); _usedPocket.Clear();
        Resources.Wood = 0; Resources.Rations = 0; Resources.Keys = 0;
        Phase = RunPhase.Settlement;
    }
    public bool DepositSettlementCard(int index)
    {
        EnsurePhase(RunPhase.Settlement);
        if (index < 0 || index >= _settlementCards.Count) throw new ArgumentOutOfRangeException(nameof(index));
        var entry = _settlementCards[index];
        if (entry.Deposited) return true;
        if (!Base.DepositCards(new[] { new RunCardStack(entry.Card, entry.Count) }, false)) return false;
        _settlementCards[index] = entry with { Deposited = true }; return true;
    }
    public bool FinalizeSettlement()
    {
        EnsurePhase(RunPhase.Settlement);
        if (_settlementCards.Any(x => !x.Deposited)) return false;
        _settlementCards.Clear(); Phase = RunPhase.Victory; return true;
    }

    public bool ClaimRecoveryCard(string name)
    {
        var entry = _recoveryCards.FirstOrDefault(x => x.Card.Name == name);
        if (entry is null || !Base.DepositCards(new[] { entry }, false)) return false;
        _recoveryCards.Remove(entry); return true;
    }

    private void EnqueueRecovery(RunCardStack card)
    {
        var existing = _recoveryCards.FirstOrDefault(x => x.Card.Name == card.Card.Name);
        if (existing is null) _recoveryCards.Add(new RunCardStack(card.Card, card.Count, true)); else existing.Count += card.Count;
    }

    /// <summary>Test/adapter seam for restoring a saved position before a room resolves.</summary>
    public void DebugSetPosition(int layer, int position)
    {
        if (layer < 0 || layer >= Map.Layers.Count) throw new ArgumentOutOfRangeException(nameof(layer));
        if (position < 0 || position >= Map.Layers[layer].NodeCount) throw new ArgumentOutOfRangeException(nameof(position));
        if (Phase is not RunPhase.Ready) throw new InvalidOperationException("只能在待行动状态设置位置。");
        LayerIndex = layer; TrackPosition = position; _pendingDoor = null;
    }

    private static string Describe(RunRoomType type) => type switch
    {
        RunRoomType.Entrance => "入口营地", RunRoomType.Battle => "遭遇战斗", RunRoomType.Event => "触发随机事件",
        RunRoomType.Shop => "进入补给站", RunRoomType.Campfire => "火堆休整", RunRoomType.Chest => "搜刮物资",
        RunRoomType.EmergencyExit => "抵达紧急撤离点", RunRoomType.Door => "层间门", RunRoomType.Altar => "污染祭坛",
        RunRoomType.Boss => "首脑巢穴", RunRoomType.Extraction => "终局撤离点", _ => "安全节点"
    };
    private void EnsurePhase(RunPhase expected) { if (Phase != expected) throw new InvalidOperationException($"当前状态为 {Phase}，需要 {expected}。"); }
}

// ported from src/rules.js：数值口径以 data/rules.json 为真源，进程启动时由
// GameRuntime.Load 注入；属性默认值仅作未加载数据前的兜底。
public static class RunRules
{
    public static int DiceSides { get; private set; } = 3;
    public static int PlayerMaxHp { get; private set; } = 30;
    public static int StaminaMax { get; private set; } = 60;
    public static int StaminaWarn { get; private set; } = 10;
    public static int FireHeal { get; private set; } = 8;
    public static int EmergencyExitCost { get; private set; } = 10;
    public static int BagStart { get; private set; } = 16;
    public static int BagMax { get; private set; } = 30;
    public static int BagUpgradeWood { get; private set; } = 2;
    public static int SafeStart { get; private set; } = 2;
    public static int SafeMax { get; private set; } = 6;
    public static int SafeUpgradeRations { get; private set; } = 2;
    public static int StashStart { get; private set; } = 25;
    public static int StashMax { get; private set; } = 49;
    public static int StashUpgradeSlots { get; private set; } = 3;
    public static int StashUpgradeWood { get; private set; } = 2;
    public static int BossDeckSize { get; private set; } = 15;
    public static double CampfireClassCardChance { get; private set; } = 0.3;
    /// <summary>对局攻击力（网页 game.atk = rules.playerAtk；本局恒定，战斗伤害 = 卡面值 + 攻击力）。</summary>
    public static int PlayerAtk { get; private set; } = 4;
    /// <summary>宝藏大门钥匙需求（网页 base.js KEY_NEEDED=10，已入 rules.json）。</summary>
    public static int KeyNeeded { get; private set; } = 10;

    /// <summary>rules.json 中没有对应字段的骨架局部常量。</summary>
    public const int CampfireRestorePocket = 2;

    // —— 四层跑图定版常量（网页版 game.run.altar.js / flow 硬编码，未进 rules.json）——
    /// <summary>紧急撤离点：撤离前必须献祭 3 张背包卡牌（openEmergencyModal）。</summary>
    public const int EmergencySacrificeCards = 3;
    /// <summary>祭坛：弃 3 张背包卡牌激活（openAltarRitual）。</summary>
    public const int AltarDiscardCards = 3;
    /// <summary>祭坛：2 枚彩色令牌碎片可不弃牌直接兑换（openAltarRitual）。</summary>
    public const int AltarFragmentCost = 2;
    /// <summary>祭坛奖励①：回复 10 血（openAltarReward）。</summary>
    public const int AltarRewardHeal = 10;
    /// <summary>祭坛奖励①：从消耗口袋复原 3 张（openAltarReward）。</summary>
    public const int AltarRewardRestoreCards = 3;
    /// <summary>献祭道具复原：1 张道具卡 → 消耗口袋复原 2 张（altarItemRestore）。</summary>
    public const int AltarItemRestoreCards = 2;

    public static void Apply(GameRulesData rules)
    {
        ArgumentNullException.ThrowIfNull(rules);
        DiceSides = rules.DiceSides;
        PlayerMaxHp = rules.PlayerMaxHp;
        StaminaMax = rules.StaminaMax;
        StaminaWarn = rules.StaminaWarn;
        FireHeal = rules.FireHeal;
        EmergencyExitCost = rules.EmergencyExitCost;
        BagStart = rules.BagStart;
        BagMax = rules.BagMax;
        BagUpgradeWood = rules.BagUpgradeWood;
        SafeStart = rules.SafeStart;
        SafeMax = rules.SafeMax;
        SafeUpgradeRations = rules.SafeUpgradeRations;
        StashStart = rules.StashStart;
        StashMax = rules.StashMax;
        StashUpgradeSlots = rules.StashUpgradeSlots;
        StashUpgradeWood = rules.StashUpgradeWood;
        BossDeckSize = rules.BossDeckSize;
        CampfireClassCardChance = rules.FireClassCardChance;
        if (rules.PlayerAtk > 0) PlayerAtk = rules.PlayerAtk;
        if (rules.KeyNeeded > 0) KeyNeeded = rules.KeyNeeded;
    }
}
