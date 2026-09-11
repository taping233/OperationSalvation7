using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

public enum RunCardSemantic { Combat, Resource, Event, Map, Equipment, Item }

/// <summary>Card metadata needed by run/base systems; the card engine can adapt its own definitions to this type.</summary>
public sealed record RunCard(string Id, string Name, string Type = "武术", string Rarity = "古朴",
    int SellPrice = 1, bool Sellable = false, bool IsInitialAttack = false,
    string? MaterialKind = null, int MaterialAmount = 1, RunCardSemantic? Category = null,
    bool Unrandom = false)
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
    RunCardSemantic? Category = null);
public sealed record RunBaseSnapshot(int Wood, int Rations, int Keys, int Coins, int BagUpgrade, int SafeUpgrade,
    int StashUpgrade, IReadOnlyList<RunCardSnapshot> Stash, IReadOnlyList<RunCardSnapshot> Pocket,
    IReadOnlySet<string> Collection);
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
    public int BagCapacity => Math.Min(RunRules.BagMax, RunRules.BagStart + BagUpgrade);
    public int SafeCapacity => Math.Min(RunRules.SafeMax, RunRules.SafeStart + SafeUpgrade);
    public int StashCapacity => Math.Min(RunRules.StashMax, RunRules.StashStart + StashUpgrade * RunRules.StashUpgradeSlots);
    public int StashUsed => Stash.Sum(x => x.Count);
    public int StashRoom => Math.Max(0, StashCapacity - StashUsed);
    public int KeyCount => Keys + Stash.Where(x => MaterialKind(x.Card) == "keys").Sum(x => (x.Card.Name.Contains("一串", StringComparison.Ordinal) ? 2 : 1) * x.Count);

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
        Stash.Select(ToSnapshot).ToArray(), Pocket.Select(ToSnapshot).ToArray(), new HashSet<string>(Collection, StringComparer.Ordinal));

    public void RestoreSnapshot(RunBaseSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        if (snapshot.Wood < 0 || snapshot.Rations < 0 || snapshot.Keys < 0 || snapshot.Coins < 0 || snapshot.BagUpgrade < 0 || snapshot.SafeUpgrade < 0 || snapshot.StashUpgrade < 0)
            throw new ArgumentOutOfRangeException(nameof(snapshot));
        if (snapshot.Stash.Any(x => x.Count <= 0) || snapshot.Pocket.Any(x => x.Count <= 0)) throw new ArgumentException("基地卡堆数量必须为正。", nameof(snapshot));
        Wood = snapshot.Wood; Rations = snapshot.Rations; Keys = snapshot.Keys; Coins = snapshot.Coins;
        BagUpgrade = snapshot.BagUpgrade; SafeUpgrade = snapshot.SafeUpgrade; StashUpgrade = snapshot.StashUpgrade;
        Stash.Clear(); Pocket.Clear(); Collection.Clear();
        Stash.AddRange(snapshot.Stash.Select(FromSnapshot)); Pocket.AddRange(snapshot.Pocket.Select(FromSnapshot));
        foreach (var id in snapshot.Collection) Collection.Add(id);
        if (BagUpgrade > RunRules.BagMax - RunRules.BagStart || SafeUpgrade > RunRules.SafeMax - RunRules.SafeStart || StashUpgrade > (RunRules.StashMax - RunRules.StashStart) / RunRules.StashUpgradeSlots)
            throw new ArgumentOutOfRangeException(nameof(snapshot), "基地升级超过规则上限。");
        if (StashUsed > StashCapacity) throw new ArgumentException("仓库容量不足以容纳快照卡牌。", nameof(snapshot));
    }

    private static RunCardSnapshot ToSnapshot(RunCardStack stack) => new(stack.Card.Id, stack.Card.Name, stack.Card.Type, stack.Card.Rarity,
        stack.Card.SellPrice, stack.Card.Sellable, stack.Card.IsInitialAttack, stack.Card.MaterialKind, stack.Card.MaterialAmount, stack.Count, stack.Safe, stack.Card.Category);
    private static RunCardStack FromSnapshot(RunCardSnapshot value) => new(new RunCard(value.Id, value.Name, value.Type, value.Rarity,
        value.SellPrice, value.Sellable, value.IsInitialAttack, value.MaterialKind, value.MaterialAmount, value.Category), value.Count, value.Safe);

    public void AddResources(int wood = 0, int rations = 0, int keys = 0, int coins = 0)
    {
        Wood = checked(Wood + wood); Rations = checked(Rations + rations); Keys = checked(Keys + keys); Coins = checked(Coins + coins);
    }
    public int TakeReserveCoins() { var value = Coins; Coins = 0; return value; }
    public bool UpgradeBag() => Wood >= RunRules.BagUpgradeWood && BagCapacity < RunRules.BagMax && SpendWood(RunRules.BagUpgradeWood, () => BagUpgrade++);
    public bool UpgradeSafe() => Rations >= RunRules.SafeUpgradeRations && SafeCapacity < RunRules.SafeMax && SpendRations(RunRules.SafeUpgradeRations, () => SafeUpgrade++);
    public bool UpgradeStash() => Wood >= RunRules.StashUpgradeWood && StashCapacity < RunRules.StashMax && SpendWood(RunRules.StashUpgradeWood, () => StashUpgrade++);
    private bool SpendWood(int n, Action apply) { Wood -= n; apply(); return true; }
    private bool SpendRations(int n, Action apply) { Rations -= n; apply(); return true; }

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
    public bool RestorePocket(string name, int count = 1)
    {
        var stack = Pocket.FirstOrDefault(x => x.Card.Name == name); if (stack is null || count <= 0 || count > stack.Count || StashRoom < count) return false;
        stack.Count -= count; if (stack.Count == 0) Pocket.Remove(stack);
        return DepositCards(new[] { new RunCardStack(stack.Card, count, false) });
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
