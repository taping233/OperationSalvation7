using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

public enum RunCardSemantic { Combat, Resource, Event, Map, Equipment, Item }

/// <summary>Card metadata needed by run/base systems; the card engine can adapt its own definitions to this type.</summary>
public sealed record RunCard(string Id, string Name, string Type = "武术", string Rarity = "古朴",
    int SellPrice = 1, bool Sellable = false, bool IsInitialAttack = false,
    string? MaterialKind = null, int MaterialAmount = 1, RunCardSemantic? Category = null,
    bool Unrandom = false, string? Cls = null)
{
    public RunCardSemantic Semantic => Category ?? Type switch
    {
        "资源" => RunCardSemantic.Resource,
        "事件" => RunCardSemantic.Event,
        "地图" => RunCardSemantic.Map,
        "装备" => RunCardSemantic.Equipment,
        "道具" => RunCardSemantic.Item,
        _ => RunCardSemantic.Combat
    };
}

public sealed class RunCardStack
{
    public RunCard Card { get; }
    public int Count { get; internal set; }
    public bool Safe { get; internal set; }
    public RunCardStack(RunCard card, int count = 1, bool safe = false)
    {
        Card = card ?? throw new ArgumentNullException(nameof(card));
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count));
        Count = count; Safe = safe;
    }
}

public sealed record RunCardSnapshot(string Id, string Name, string Type, string Rarity, int SellPrice,
    bool Sellable, bool IsInitialAttack, string? MaterialKind, int MaterialAmount, int Count, bool Safe,
    RunCardSemantic? Category = null, string? Cls = null);
public sealed record PetSnapshot(string Id, int Lv, long Ts);
public sealed record RunBaseSnapshot(int Wood, int Rations, int Keys, int Coins, int BagUpgrade, int SafeUpgrade,
    int StashUpgrade, IReadOnlyList<RunCardSnapshot> Stash, IReadOnlyList<RunCardSnapshot> Pocket,
    IReadOnlySet<string> Collection, IReadOnlyList<PetSnapshot>? Pets = null, string? PetSel = null,
    IReadOnlySet<string>? CollClaimed = null, IReadOnlySet<string>? CollXp = null,
    IReadOnlyDictionary<string, ClassProgress>? Classes = null);
public sealed record RunMaterialUseResult(bool Ok, int Quantity, int Total, string Kind, string Why);

/// <summary>Pure representation of the per-slot base from base.js.</summary>
public sealed class RunBaseState
{
    public int Wood { get; private set; }
    public int Rations { get; private set; }
    public int Keys { get; private set; }
    public int Coins { get; private set; }
    public int BagUpgrade { get; private set; }
    public int SafeUpgrade { get; private set; }
    public int StashUpgrade { get; private set; }
    public List<RunCardStack> Stash { get; } = new();
    public List<RunCardStack> Pocket { get; } = new();
    public HashSet<string> Collection { get; } = new(StringComparer.Ordinal);
    // —— 批次 5：宠物 + 收藏室 + 职业熟练度（base.js def() 的 pets/petSel/collClaimed/collXp/classes）——
    /// <summary>已拥有宠物 [宠物id] => { lv, ts }（宠物蛋孵化；初始宠物汪汪狗自动获得）。</summary>
    public Dictionary<string, PetSave> Pets { get; } = new(StringComparer.Ordinal);
    /// <summary>当前携带的宠物 id（出发携带效果 / 安全格数量随之变化）；无宠物时 null。</summary>
    public string? PetSel { get; private set; }
    /// <summary>收藏里程碑领奖记录（meta.js collClaimed，每个一次性奖励只能领一次）。</summary>
    public HashSet<string> CollClaimed { get; } = new(StringComparer.Ordinal);
    /// <summary>收藏经验已结算标记（meta.js collXp：取消重藏不重复发放）。</summary>
    public HashSet<string> CollXp { get; } = new(StringComparer.Ordinal);
    /// <summary>职业熟练度 [职业名] => { lv, xp }（收藏转化 +10/+50 的去处）。</summary>
    public Dictionary<string, ClassProgress> Classes { get; } = new(StringComparer.Ordinal);
    public int BagCapacity => Math.Min(RunRules.BagMax, RunRules.BagStart + BagUpgrade);
    /// <summary>安全格容量（批次 5 起随携带宠物）：Lv.N 提供 safeStart+N-1 格（上限 safeMax），safeBonus 额外累加。</summary>
    public int SafeCapacity => PetSystem.SafeCapacity(PetSpec, PetSel,
        Pets.TryGetValue(PetSel ?? "", out var carried) ? carried.Lv : 0);
    public int StashCapacity => Math.Min(RunRules.StashMax, RunRules.StashStart + StashUpgrade * RunRules.StashUpgradeSlots);
    public int StashUsed => Stash.Sum(x => x.Count);
    public int StashRoom => Math.Max(0, StashCapacity - StashUsed);
    public int KeyCount => Keys + Stash.Where(x => MaterialKind(x.Card) == "keys").Sum(x => (x.Card.Name.Contains("一串", StringComparison.Ordinal) ? 2 : 1) * x.Count);

    /// <summary>宠物表（pets.json）；经 GameRuntime 注入进程级数据（与 RunState 同一约定）。</summary>
    private static PetTableSpec PetSpec => GameRuntime.Data.Pets;

    public RunBaseState() => EnsureStarterPet();

    /// <summary>
    /// 初始宠物「汪汪狗」进入基地自动获得（base.js:173-178 ensureStarterPet，需求 #4）；
    /// 老档/快照恢复也走这里兜底（dog 缺失补领，petSel 失效回退到 dog）。
    /// </summary>
    public void EnsureStarterPet()
    {
        if (!Pets.ContainsKey("dog")) Pets["dog"] = new PetSave(1, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        if (PetSel is null || !Pets.ContainsKey(PetSel)) PetSel = "dog";
    }

    public int SeedStarterStash(IEnumerable<RunCard> cards, int count = 5)
    {
        ArgumentNullException.ThrowIfNull(cards);
        if (count < 0) throw new ArgumentOutOfRangeException(nameof(count));
        var added = 0;
        foreach (var card in cards.Where(x => !x.IsInitialAttack).GroupBy(x => x.Name).Select(x => x.First()))
        {
            if (added >= count || StashRoom <= 0) break;
            if (DepositCards(new[] { new RunCardStack(card) })) added++;
        }
        return added;
    }

    public RunBaseSnapshot CaptureSnapshot() => new(Wood, Rations, Keys, Coins, BagUpgrade, SafeUpgrade, StashUpgrade,
        Stash.Select(ToSnapshot).ToArray(), Pocket.Select(ToSnapshot).ToArray(), new HashSet<string>(Collection, StringComparer.Ordinal),
        Pets.Select(pair => new PetSnapshot(pair.Key, pair.Value.Lv, pair.Value.Ts)).ToArray(), PetSel,
        new HashSet<string>(CollClaimed, StringComparer.Ordinal), new HashSet<string>(CollXp, StringComparer.Ordinal),
        new Dictionary<string, ClassProgress>(Classes, StringComparer.Ordinal));

    public void RestoreSnapshot(RunBaseSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (snapshot.Wood < 0 || snapshot.Rations < 0 || snapshot.Keys < 0 || snapshot.Coins < 0 || snapshot.BagUpgrade < 0 || snapshot.SafeUpgrade < 0 || snapshot.StashUpgrade < 0)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Stash.Any(x => x.Count <= 0) || snapshot.Pocket.Any(x => x.Count <= 0)) throw new ArgumentException("基地卡堆数量必须为正。", nameof(snapshot));
        Wood = snapshot.Wood; Rations = snapshot.Rations; Keys = snapshot.Keys; Coins = snapshot.Coins;
        BagUpgrade = snapshot.BagUpgrade; SafeUpgrade = snapshot.SafeUpgrade; StashUpgrade = snapshot.StashUpgrade;
        Stash.Clear(); Pocket.Clear(); Collection.Clear(); Pets.Clear(); CollClaimed.Clear(); CollXp.Clear(); Classes.Clear();
        Stash.AddRange(snapshot.Stash.Select(FromSnapshot)); Pocket.AddRange(snapshot.Pocket.Select(FromSnapshot));
        foreach (var id in snapshot.Collection) Collection.Add(id);
        // 批次 5：宠物/收藏室/熟练度（可选字段，旧快照缺省即空）。
        if (snapshot.Pets is not null)
            foreach (var pet in snapshot.Pets)
                Pets[pet.Id] = new PetSave(Math.Max(1, pet.Lv), pet.Ts);
        PetSel = snapshot.PetSel is not null && Pets.ContainsKey(snapshot.PetSel) ? snapshot.PetSel : null;
        if (snapshot.CollClaimed is not null) foreach (var id in snapshot.CollClaimed) CollClaimed.Add(id);
        if (snapshot.CollXp is not null) foreach (var id in snapshot.CollXp) CollXp.Add(id);
        if (snapshot.Classes is not null)
            foreach (var pair in snapshot.Classes)
                Classes[pair.Key] = new(Math.Max(1, pair.Value.Lv), Math.Max(0, pair.Value.Xp));
        // base.js ensureStarterPet：每次进入档位兜底（狗必在、petSel 有效）
        EnsureStarterPet();
        if (BagUpgrade > RunRules.BagMax - RunRules.BagStart || SafeUpgrade > RunRules.SafeMax - RunRules.SafeStart || StashUpgrade > (RunRules.StashMax - RunRules.StashStart) / RunRules.StashUpgradeSlots)
            throw new ArgumentOutOfRangeException(nameof(snapshot), "基地升级超过规则上限。");
        if (StashUsed > StashCapacity) throw new ArgumentException("仓库容量不足以容纳快照卡牌。", nameof(snapshot));
    }

    private static RunCardSnapshot ToSnapshot(RunCardStack stack) => new(stack.Card.Id, stack.Card.Name, stack.Card.Type, stack.Card.Rarity,
        stack.Card.SellPrice, stack.Card.Sellable, stack.Card.IsInitialAttack, stack.Card.MaterialKind, stack.Card.MaterialAmount, stack.Count, stack.Safe, stack.Card.Category, stack.Card.Cls);
    private static RunCardStack FromSnapshot(RunCardSnapshot value) => new(new RunCard(value.Id, value.Name, value.Type, value.Rarity,
        value.SellPrice, value.Sellable, value.IsInitialAttack, value.MaterialKind, value.MaterialAmount, value.Category, Cls: value.Cls), value.Count, value.Safe);

    public void AddResources(int wood = 0, int rations = 0, int keys = 0, int coins = 0)
    {
        Wood = checked(Wood + wood); Rations = checked(Rations + rations); Keys = checked(Keys + keys); Coins = checked(Coins + coins);
    }
    public int TakeReserveCoins() { var value = Coins; Coins = 0; return value; }
    public bool UpgradeBag() => Wood >= RunRules.BagUpgradeWood && BagCapacity < RunRules.BagMax && SpendWood(RunRules.BagUpgradeWood, () => BagUpgrade++);
    public bool UpgradeStash() => Wood >= RunRules.StashUpgradeWood && StashCapacity < RunRules.StashMax && SpendWood(RunRules.StashUpgradeWood, () => StashUpgrade++);
    private bool SpendWood(int n, Action apply) { Wood -= n; apply(); return true; }

    // ---------- 宠物操作（批次 5，ported from base.js:272-293/357-381）----------

    /// <summary>宠物等级（1..levelMax 夹取；未拥有视为 1）。</summary>
    public int PetLevel(string id) => Pets.TryGetValue(id, out var pet) ? PetSystem.Level(PetSpec, pet.Lv) : 1;

    /// <summary>当前携带的宠物定义（base.js carriedPet；没有宠物时 null）。</summary>
    public PetDef? CarriedPet() => PetSystem.Def(PetSpec, PetSel);

    /// <summary>当前携带宠物的效果（无宠物时全零效果）。</summary>
    public PetEffect CarriedPetEffect() => CarriedPet()?.Effect ?? new PetEffect();

    /// <summary>携带宠物（base.js setPet：只能携带已拥有的；切换后携带效果与安全格随之变化）。</summary>
    public bool SetPet(string id)
    {
        if (!Pets.ContainsKey(id)) return false;
        PetSel = id;
        return true;
    }

    /// <summary>升级到下一级所需口粮（base.js petUpCost：upCosts[level-1]，递增 2-3-4-5）。</summary>
    public int PetUpgradeCost(string id) => PetSystem.UpgradeCost(PetSpec, PetLevel(id));

    /// <summary>base.js canUpgradePet：已拥有、未满级、口粮足够。</summary>
    public bool CanUpgradePet(string id) => Pets.ContainsKey(id) && PetLevel(id) < PetSpec.LevelMax && Rations >= PetUpgradeCost(id);

    /// <summary>base.js upgradePet：保险升级已改为宠物升级——口粮递增 2-3-4-5，上限 Lv.5。</summary>
    public bool UpgradePet(string id)
    {
        if (!CanUpgradePet(id)) return false;
        Rations -= PetUpgradeCost(id);
        var current = Pets[id];
        Pets[id] = current with { Lv = PetLevel(id) + 1 };
        return true;
    }

    /// <summary>
    /// base.js hatchPet：仓库中的 1 张宠物蛋 + hatchCost 储备币 → 随机获得 1 只未拥有的宠物。
    /// picker(unownedCount) 返回选中的下标（网页 Random('pet') 流；缺省取首个，测试可注入）。
    /// </summary>
    public HatchResult HatchPet(Func<int, int>? picker = null)
    {
        var spec = PetSpec;
        var eggStack = Stash.FirstOrDefault(x => x.Card.Id == spec.EggId);
        if (eggStack is null) return HatchResult.NoEgg;
        if (Coins < spec.HatchCost) return HatchResult.Poor;
        var unowned = spec.List.Where(pet => !Pets.ContainsKey(pet.Id)).ToArray();
        if (unowned.Length == 0) return HatchResult.AllOwned;
        var index = Math.Clamp(picker?.Invoke(unowned.Length) ?? 0, 0, unowned.Length - 1);
        var pet = unowned[index];
        eggStack.Count -= 1;
        if (eggStack.Count <= 0) Stash.Remove(eggStack);
        Coins -= spec.HatchCost;
        Pets[pet.Id] = new PetSave(1, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        PetSel ??= pet.Id;
        return new(true, "", pet);
    }

    /// <summary>孵化计数（meta.js petHatchedN）：已拥有宠物数 − 初始宠物（汪汪狗自动获得，不算孵化）。</summary>
    public int HatchedCount() => Math.Max(0, Pets.Count - 1);

    public bool DepositResource(string kind, int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount));
        switch (kind) { case "wood": Wood += amount; return true; case "rations": Rations += amount; return true; case "keys": Keys += amount; return true; default: return false; }
    }
    public bool DepositCards(IEnumerable<RunCardStack> cards, bool toPocket = false)
    {
        var target = toPocket ? Pocket : Stash;
        foreach (var incoming in cards)
        {
            if (!toPocket && incoming.Card.IsInitialAttack) continue;
            if (!toPocket && StashRoom < incoming.Count) return false;
        }
        foreach (var incoming in cards)
        {
            if (!toPocket && incoming.Card.IsInitialAttack) continue;
            var existing = target.FirstOrDefault(x => x.Card.Name == incoming.Card.Name);
            if (existing is null) target.Add(new RunCardStack(incoming.Card, incoming.Count, incoming.Safe)); else existing.Count += incoming.Count;
        }
        return true;
    }
    public int TakeStashCards(string name, int count)
    {
        var stack = Stash.FirstOrDefault(x => x.Card.Name == name); if (stack is null || count <= 0) return 0;
        var take = Math.Min(count, stack.Count); stack.Count -= take; if (stack.Count == 0) Stash.Remove(stack); return take;
    }
    public RunMaterialUseResult UseStashMaterial(string name, bool all = false)
    {
        var stack = Stash.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null) return new(false, 0, 0, "", "empty");
        var materialKind = MaterialKind(stack.Card);
        if (materialKind is null) return new(false, 0, 0, "", "notmaterial");
        var qty = all ? stack.Count : 1;
        var total = checked(qty * Math.Max(1, stack.Card.MaterialAmount));
        stack.Count -= qty; if (stack.Count == 0) Stash.Remove(stack);
        DepositResource(materialKind, total);
        return new(true, qty, total, materialKind, "");
    }
    // ---------- 消耗口袋复原（批次 8-prep 接口 [6b'→A]，ported from base.js:329-355 pocketKeyCost/restore）----------
    // 在仓库中使用钥匙按稀有度计价复原：古朴 1 / 稀有 2 / 史诗 3 / 传说 4；整堆复原 = 单张价 × 张数。

    /// <summary>base.js pocketKeyCost：整堆复原钥匙价 = 稀有度单价（古朴1/稀有2/史诗3/传说4，缺省 1）× 张数。</summary>
    public static int PocketKeyCost(RunCardStack stack)
    {
        ArgumentNullException.ThrowIfNull(stack);
        var per = stack.Card.Rarity switch { "古朴" => 1, "稀有" => 2, "史诗" => 3, "传说" => 4, _ => 1 };
        return per * stack.Count;
    }

    /// <summary>base.js restore(i) 的结果：Ok=成功入仓；Why 取 ""（成功）/"sha"/"full"/"nokey"/"empty"，Cost=本次消耗（nokey 时=所需）钥匙数。</summary>
    public readonly record struct PocketRestoreResult(bool Ok, string Why, int Cost);

    /// <summary>
    /// base.js restore(i)：消耗口袋整堆复原回卡牌仓库。
    /// 「初始攻击」直接销毁不入仓（每局自动重带，why="sha"）；裸钥匙不足 why="nokey"
    /// （网页 Core 判定用 data.keys 裸钥匙而非 keyCount 折算——hub UI 的按钮置灰用折算值属网页自身不一致，移植按 Core 行为）；
    /// 仓库容量不足 why="full"。
    /// </summary>
    public PocketRestoreResult RestorePocketWithKeys(string name)
    {
        var stack = Pocket.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null) return new(false, "empty", 0);
        if (stack.Card.IsInitialAttack) { Pocket.Remove(stack); return new(true, "sha", 0); }
        var cost = PocketKeyCost(stack);
        if (Keys < cost) return new(false, "nokey", cost);
        if (StashRoom < stack.Count) return new(false, "full", 0);
        Keys -= cost;
        Pocket.Remove(stack);
        return DepositCards(new[] { new RunCardStack(stack.Card, stack.Count, false) })
            ? new PocketRestoreResult(true, "", cost) : new(false, "full", cost);
    }
    public (bool Ok, int Quantity, int Coins, string Why) SellCards(string name, int count)
    {
        var stack = Stash.FirstOrDefault(x => x.Card.Name == name);
        if (stack is null) return (false, 0, 0, "empty");
        if (Collection.Contains(stack.Card.Id)) return (false, 0, 0, "collected");
        if (MaterialKind(stack.Card) is not null) return (false, 0, 0, "material");
        if (!stack.Card.Sellable) return (false, 0, 0, "unsellable");
        var qty = Math.Min(Math.Max(1, count), stack.Count); stack.Count -= qty; if (stack.Count == 0) Stash.Remove(stack);
        var coins = qty * Math.Max(1, stack.Card.SellPrice); Coins += coins; return (true, qty, coins, "");
    }

    private static string? MaterialKind(RunCard card)
    {
        if (card.MaterialKind is not null) return card.MaterialKind;
        if (card.Type != "资源") return null;
        if (card.Name.Contains("木材", StringComparison.Ordinal)) return "wood";
        if (card.Name.Contains("口粮", StringComparison.Ordinal)) return "rations";
        if (card.Name.Contains("钥匙", StringComparison.Ordinal)) return "keys";
        return null;
    }
    public (bool Ok, int Quantity, int Coins, string Why) SellRaw(string kind, bool all = false)
    {
        var amount = kind == "wood" ? Wood : kind == "rations" ? Rations : 0;
        var qty = all ? amount : Math.Min(1, amount); if (qty <= 0) return (false, 0, 0, "empty");
        if (kind == "wood") Wood -= qty; else if (kind == "rations") Rations -= qty; else return (false, 0, 0, "invalid");
        var coins = qty * (kind == "wood" ? 5 : 15); Coins += coins; return (true, qty, coins, "");
    }
}
