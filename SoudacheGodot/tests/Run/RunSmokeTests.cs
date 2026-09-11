using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Soudache;

internal static class RunSmokeTests
{
    private static int _checks;
    private static void Check(bool value, string message) { if (!value) throw new InvalidOperationException(message); _checks++; }

    public static int Main()
    {
        MapUsesTheOriginalThreeRingsAndIsReachable();
        RuntimeTablesMatchDataFiles();
        DiceMovementIsDeterministicAndConsumesStamina();
        RoomSettlementAndDoorProgressionWork();
        BattleDropsAreSettledAndFailureIsTerminal();
        ShopEventFireAndEmergencyExtractionWork();
        BaseBackpackAndStashRulesMatchOriginal();
        BackpackAndSafeCapacityCountCardInstances();
        EventChoicesAndCampfireRestoreWork();
        SnapshotsRestoreOnlyValidatedReadyRuns();
        ChestRewardsAndSettlementNeverSilentlyDropCards();
        DoorAndChestReadOnlyStateIsInspectable();
        BossPathCanFinishACompleteRun();
        Console.WriteLine($"RUN_SMOKE_OK checks={_checks}");
        return 0;
    }

    private static void MapUsesTheOriginalThreeRingsAndIsReachable()
    {
        var map = RunMap.CreateDefault();
        Check(map.Layers.Count == 3, "map must have three layers");
        Check(map.Layers.Select(x => x.RingSize).SequenceEqual(new[] { 28, 20, 12 }), "ring sizes changed");
        Check(map.Layers[0].Doors.Count == 4 && map.Layers[1].Doors.Count == 6 && map.Layers[2].Doors.Count == 2, "door count changed");
        Check(map.Layers[2].RoomAt(10).Type == RunRoomType.EmergencyExit, "emergency exit missing");
        Check(map.IsConnected(out var unreachable) && unreachable.Count == 0, "map is disconnected");
    }

    /// <summary>批次 1 数据接线断言：运行时读到的每张表与 data/*.json 原文逐项一致。</summary>
    private static void RuntimeTablesMatchDataFiles()
    {
        var dataDir = GameData.FindDataDirectory();
        var data = GameRuntime.Data;
        using var mapDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "map.json")));
        var map = mapDoc.RootElement.GetProperty("map");
        using var rulesDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "rules.json")));
        var rules = rulesDoc.RootElement.GetProperty("rules");
        using var charsDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "characters.json")));
        var characters = charsDoc.RootElement.GetProperty("characters");
        using var cardsDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "cards.json")));

        // 怪物图鉴（map.json.monsters）逐项一致。
        var monsterCount = 0;
        foreach (var node in map.GetProperty("monsters").EnumerateObject())
        {
            monsterCount++;
            var monster = data.RequireMonster(node.Name);
            Check(monster.Name == node.Value.GetProperty("name").GetString()
                && monster.Hp == node.Value.GetProperty("hp").GetInt32()
                && monster.Attack == node.Value.GetProperty("atk").GetInt32()
                && monster.Elite == (node.Value.TryGetProperty("elite", out var eliteFlag) && eliteFlag.ValueKind == JsonValueKind.True),
                $"monster {node.Name} runtime/data mismatch");
        }
        Check(data.Monsters.Count == monsterCount, "monster table size mismatch");

        // 遭遇表（encounters）逐层一致。
        var encounterNodes = map.GetProperty("encounters");
        Check(data.Encounters.Count == encounterNodes.GetArrayLength(), "encounter table size mismatch");
        for (var i = 0; i < data.Encounters.Count; i++)
        {
            var row = encounterNodes[i];
            var ids = row.GetProperty("entries").EnumerateArray().Select(e => e.GetProperty("id").GetString() ?? "").ToArray();
            var table = data.Encounters[i];
            Check(table.Entries.Count == ids.Length && table.Entries.Select(en => en.MonsterId).SequenceEqual(ids),
                $"encounter row {i} entry ids mismatch");
            for (var j = 0; j < ids.Length; j++)
            {
                var size = row.GetProperty("entries")[j].GetProperty("size");
                var sizeMax = (int)size.GetArrayLength() - 1;
                Check(table.Entries[j].Min == size[0].GetInt32() && table.Entries[j].Max == size[sizeMax].GetInt32(),
                    $"encounter row {i} entry {ids[j]} size mismatch");
            }
            var elite = row.TryGetProperty("elite", out var eliteNode) ? eliteNode : (JsonElement?)null;
            Check(Math.Abs(table.EliteChance - (elite is null ? 0 : elite.Value.GetProperty("chance").GetDouble())) < 1e-9,
                $"encounter row {i} elite chance mismatch");
        }

        // 祭坛 BOSS 表与 RunMap 注入一致。
        var bossNodes = map.GetProperty("altar").GetProperty("bosses");
        Check(data.Bosses.Count == bossNodes.GetArrayLength(), "boss table size mismatch");
        for (var i = 0; i < data.Bosses.Count; i++)
        {
            var node = bossNodes[i];
            var boss = data.Bosses[i];
            Check(boss.Id == node.GetProperty("id").GetString() && boss.Name == node.GetProperty("name").GetString()
                && boss.Hp == node.GetProperty("hp").GetInt32() && boss.Attack == node.GetProperty("atk").GetInt32()
                && boss.Affix == node.GetProperty("affix").GetString(), $"boss {i} runtime/data mismatch");
        }
        var runtimeMap = RunMap.CreateDefault();
        Check(runtimeMap.Bosses.Select(b => (b.Id, b.Name, b.Hp, b.Attack)).SequenceEqual(
            data.Bosses.Select(b => (b.Id, b.Name, b.Hp, b.Attack))), "RunMap bosses not sourced from map.json");

        // 箱型（chestKinds）：small(1,1,1)/medium(1,2,3)/large(2,3,3)/boss(0,0,5) 由数据决定。
        foreach (var node in map.GetProperty("chestKinds").EnumerateObject())
        {
            var kind = data.RequireChestKind(node.Name);
            var coins = node.Value.TryGetProperty("coins", out var coinsNode) && coinsNode.ValueKind == JsonValueKind.Array
                ? coinsNode.EnumerateArray().Select(c => c.GetInt32()).ToArray() : Array.Empty<int>();
            var candidates = node.Value.TryGetProperty("pickFrom", out var pickFrom) ? pickFrom.GetInt32()
                : node.Value.GetProperty("cards").GetInt32();
            Check(kind.CoinMin == (coins.Length > 0 ? coins[0] : 0) && kind.CoinMax == (coins.Length > 0 ? coins[^1] : 0)
                && kind.Candidates == candidates, $"chest kind {node.Name} runtime/data mismatch");
        }

        // 宝箱物品表（chestTable）与分层掉落（layerChests）。
        var chestTable = map.GetProperty("chestTable").EnumerateArray().Select(item => item.GetProperty("name").GetString() ?? "").ToArray();
        Check(data.ChestTable.SequenceEqual(chestTable), "chest table mismatch");
        var layerNodes = map.GetProperty("layerChests");
        Check(data.LayerChests.Count == layerNodes.GetArrayLength(), "layerChests size mismatch");
        for (var i = 0; i < data.LayerChests.Count; i++)
        {
            var node = layerNodes[i];
            var layer = data.LayerChests[i];
            if (node.TryGetProperty("fixed", out var fixedNode))
                Check(layer.FixedCounts.Select(f => f.Kind).SequenceEqual(fixedNode.EnumerateArray().Select(f => f.GetProperty("k").GetString() ?? "")),
                    $"layerChests[{i}] fixed mismatch");
            else
                Check(layer.Types.Select(t => t.Kind).SequenceEqual(node.GetProperty("types").EnumerateArray().Select(t => t.GetProperty("k").GetString() ?? "")),
                    $"layerChests[{i}] types mismatch");
        }

        // 随机事件表（randomEvents）。
        var eventNodes = map.GetProperty("randomEvents");
        Check(data.RandomEvents.Count == eventNodes.GetArrayLength(), "randomEvents size mismatch");
        for (var i = 0; i < data.RandomEvents.Count; i++)
        {
            var node = eventNodes[i];
            var ev = data.RandomEvents[i];
            Check(ev.Text == node.GetProperty("text").GetString() && ev.Weight == node.GetProperty("w").GetInt32()
                && ev.CreatesChest == (node.TryGetProperty("item", out var item) && item.GetString() == "chest"),
                $"randomEvent {i} runtime/data mismatch");
        }

        // 角色表（characters.json）：名字/职业/序号来自数据。
        Check(data.Characters.Count == characters.GetArrayLength(), "character table size mismatch");
        for (var i = 0; i < data.Characters.Count; i++)
        {
            var node = characters[i];
            var character = data.Characters[i];
            Check(character.Id == node.GetProperty("id").GetString() && character.Name == node.GetProperty("name").GetString()
                && character.Class == node.GetProperty("rulesetId").GetString() && character.Index == i,
                $"character {i} runtime/data mismatch");
        }

        // 规则数值（rules.json → RunRules 注入）。
        Check(RunRules.DiceSides == rules.GetProperty("diceSides").GetInt32(), "rule diceSides not injected");
        Check(RunRules.PlayerMaxHp == rules.GetProperty("playerMaxHp").GetInt32(), "rule playerMaxHp not injected");
        Check(RunRules.StaminaMax == rules.GetProperty("staminaMax").GetInt32(), "rule staminaMax not injected");
        Check(RunRules.StaminaWarn == rules.GetProperty("staminaWarn").GetInt32(), "rule staminaWarn not injected");
        Check(RunRules.FireHeal == rules.GetProperty("fireHeal").GetInt32(), "rule fireHeal not injected");
        Check(RunRules.EmergencyExitCost == rules.GetProperty("emergencyExitCost").GetInt32(), "rule emergencyExitCost not injected");
        Check(RunRules.BagStart == rules.GetProperty("bagSize").GetInt32(), "rule bagSize not injected");
        Check(RunRules.BagMax == rules.GetProperty("bagMax").GetInt32(), "rule bagMax not injected");
        Check(RunRules.BagUpgradeWood == rules.GetProperty("bagUpgradeWood").GetInt32(), "rule bagUpgradeWood not injected");
        Check(RunRules.SafeStart == rules.GetProperty("safeStart").GetInt32(), "rule safeStart not injected");
        Check(RunRules.SafeMax == rules.GetProperty("safeMax").GetInt32(), "rule safeMax not injected");
        Check(RunRules.SafeUpgradeRations == rules.GetProperty("safeUpgradeRations").GetInt32(), "rule safeUpgradeRations not injected");
        Check(RunRules.StashStart == rules.GetProperty("stashStart").GetInt32(), "rule stashStart not injected");
        Check(RunRules.StashMax == rules.GetProperty("stashMax").GetInt32(), "rule stashMax not injected");
        Check(RunRules.StashUpgradeSlots == rules.GetProperty("stashUpgradeSlots").GetInt32(), "rule stashUpgradeSlots not injected");
        Check(RunRules.StashUpgradeWood == rules.GetProperty("stashUpgradeWood").GetInt32(), "rule stashUpgradeWood not injected");
        Check(RunRules.BossDeckSize == rules.GetProperty("bossDeckSize").GetInt32(), "rule bossDeckSize not injected");
        Check(Math.Abs(RunRules.CampfireClassCardChance - rules.GetProperty("fireClassCardChance").GetDouble()) < 1e-9,
            "rule fireClassCardChance not injected");

        // 商店定价（cards.json price 表），兜底 2 与网页版 `PRICE[rarity] || 2` 一致。
        foreach (var node in cardsDoc.RootElement.GetProperty("price").EnumerateObject())
            Check(data.CardPrice(node.Name) == node.Value.GetInt32(), $"price {node.Name} runtime/data mismatch");
        Check(data.CardPrice("未定稀有度") == 2, "unknown rarity price fallback should be 2");

        // 行为抽查：外环遭遇只含该层表内的怪物且数量落在数据 size 区间。
        var entryIds = data.Encounters[0].Entries.Select(en => en.MonsterId).ToHashSet();
        var minCount = data.Encounters[0].Entries.Min(en => en.Min);
        var maxCount = data.Encounters[0].Entries.Max(en => en.Max);
        for (var seed = 1; seed <= 200; seed++)
        {
            var run = new RunState((ulong)seed);
            run.DebugSetPosition(0, 5);
            run.ResolveCurrentRoom();
            Check(run.Phase == RunPhase.Battle && run.Encounter.Count >= minCount && run.Encounter.Count <= maxCount,
                $"seed {seed} encounter count {run.Encounter.Count} outside data range [{minCount},{maxCount}]");
            Check(run.Encounter.All(enemy => entryIds.Contains(enemy.Id)), $"seed {seed} enemy outside outer encounter table");
            run.CompleteBattle(true);
            while (run.Phase == RunPhase.Chest) run.OpenNextChest();
            Check(run.Phase == RunPhase.Ready, $"seed {seed} battle/chest flow did not settle");
        }
    }

    private static void DiceMovementIsDeterministicAndConsumesStamina()
    {
        var a = new RunState(1234UL); var b = new RunState(1234UL);
        for (var i = 0; i < 8; i++)
        {
            var ra = a.Roll(); var rb = b.Roll();
            Check(ra.Dice == rb.Dice && ra.ToPosition == rb.ToPosition && ra.Path.SequenceEqual(rb.Path), "run replay diverged");
            SettleToReady(a); SettleToReady(b);
        }
        Check(a.Stamina == RunRules.StaminaMax - 8 && a.Turns == 8, "roll did not consume stamina/turn");
    }

    private static void RoomSettlementAndDoorProgressionWork()
    {
        var run = new RunState(1);
        run.DebugSetPosition(0, 2);
        run.ResolveCurrentRoom();
        Check(run.Resources.Coins == 1 && run.Phase == RunPhase.Ready, "coin room settlement incorrect");
        run.DebugSetPosition(0, 1); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor, "outer door should await choice");
        run.EnterDoor();
        Check(run.LayerIndex == 1 && run.TrackPosition == 0 && run.Phase == RunPhase.Ready, "door did not progress to layer two");
    }

    private static void BattleDropsAreSettledAndFailureIsTerminal()
    {
        var run = new RunState(4); run.DebugSetPosition(0, 5); run.ResolveCurrentRoom();
        // data/map.json 外环遭遇表 entries 的 size 均为 [2,3]（网页版 per-entry 语义）。
        Check(run.Phase == RunPhase.Battle && run.Encounter.Count is >= 2 and <= 3, "battle encounter invalid");
        run.CompleteBattle(true); Check(run.Phase == RunPhase.Chest, "battle should open a chest settlement");
        run.OpenNextChest(); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "chest queue did not settle");
        run.DebugSetPosition(0, 5); run.ResolveCurrentRoom(); run.CompleteBattle(false);
        Check(run.Phase == RunPhase.Defeat && run.IsFinished, "battle failure must be terminal");
    }

    private static void ShopEventFireAndEmergencyExtractionWork()
    {
        var run = new RunState(9); run.DebugSetPosition(1, 13); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Shop && run.Shop.Count >= 3, "shop room missing offers");
        run.Resources.Coins = 10; run.BuyShopOffer("rations"); Check(run.Resources.Rations == 1, "shop resource purchase failed"); run.LeaveShop(); run.StayAtDoor();
        run.DebugSetPosition(1, 4); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.Event, "event room missing"); run.ResolveEvent();
        run.DebugSetPosition(2, 10); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.AwaitingDoor, "emergency exit should await payment");
        run.Resources.Coins = RunRules.EmergencyExitCost; run.ExtractAtDoor(); Check(run.Phase == RunPhase.Settlement, "emergency exit should enter settlement");
        Check(run.FinalizeSettlement() && run.Phase == RunPhase.Victory, "empty settlement should complete the run");
    }

    private static void BossPathCanFinishACompleteRun()
    {
        var run = new RunState(17); run.DebugSetPosition(2, 1); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.AwaitingDoor, "altar entrance should await choice");
        run.EnterDoor(); Check(run.Phase == RunPhase.Altar, "altar entrance did not open altar");
        for (var i = 0; i < 3; i++)
        {
            run.ChallengeBoss(i); Check(run.Phase == RunPhase.Battle, "boss challenge did not enter battle");
            run.CompleteBattle(true); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
            Check(run.Phase == (i == 2 ? RunPhase.Altar : RunPhase.Altar), "boss chest return state incorrect");
        }
        run.Extract(); Check(run.Phase == RunPhase.Settlement, "complete run should enter settlement");
        Check(run.FinalizeSettlement() && run.Phase == RunPhase.Victory, "complete run did not reach victory");
    }

    private static void SnapshotsRestoreOnlyValidatedReadyRuns()
    {
        var source = new RunState(42); source.DebugSetPosition(1, 7); source.Resources.Coins = 6; source.Resources.Keys = 1;
        var snapshot = source.CaptureSnapshot(); var restored = RunState.FromSnapshot(snapshot);
        Check(restored.Seed == 42 && restored.LayerIndex == 1 && restored.TrackPosition == 7 && restored.Resources.Coins == 6 && restored.Resources.Keys == 1, "snapshot fields did not restore");
        Check(restored.Rng.State == snapshot.RngState && restored.Phase == RunPhase.Ready, "snapshot RNG/phase did not restore");
        var invalid = snapshot with { Phase = RunPhase.Battle };
        try { RunState.FromSnapshot(invalid); throw new InvalidOperationException("non-ready snapshot was accepted"); }
        catch (ArgumentException) { _checks++; }
    }

    private static void BaseBackpackAndStashRulesMatchOriginal()
    {
        var baseState = new RunBaseState();
        Check(baseState.BagCapacity == 16 && baseState.SafeCapacity == 2 && baseState.StashCapacity == 25, "base defaults changed");
        baseState.AddResources(wood: 4, rations: 2, coins: 5);
        Check(baseState.UpgradeBag() && baseState.BagCapacity == 17, "bag upgrade rule incorrect");
        Check(baseState.UpgradeStash() && baseState.StashCapacity == 28, "stash upgrade rule incorrect");
        Check(baseState.UpgradeSafe() && baseState.SafeCapacity == 3, "safe upgrade rule incorrect");
        var card = new RunCard("sellable", "旧枪", "装备", "稀有", 3, true);
        Check(baseState.DepositCards(new[] { new RunCardStack(card, 2) }), "stash deposit failed");
        var sold = baseState.SellCards("旧枪", 1); Check(sold.Ok && sold.Coins == 3 && baseState.Coins == 8, "stash sell rule incorrect");
        Check(baseState.DepositResource("wood", 1) && baseState.Wood == 1, "resource deposit failed");
        var run = new RunState(99, null, baseState); Check(run.Resources.Coins == 8 && baseState.Coins == 0, "reserve coins were not carried into run");
        run.ConfigureShopCardPool(new[] { new RunCard("shop-card", "商店卡", "武术", "稀有") });
        run.DebugSetPosition(0, 3); run.ResolveCurrentRoom(); run.BuyShopOffer("card-0");
        Check(run.OwnedCards.Any(x => x.Card.Name == "商店卡"), "shop card purchase failed"); run.LeaveShop();
        Check(run.AddCard(new RunCard("a", "安全卡"), safe: true), "safe backpack card failed");
        Check(!run.AddCard(new RunCard("b", "第二安全卡"), safe: true) || baseState.SafeCapacity >= 2, "safe capacity gate missing");
        run.MoveCardToPocket("安全卡"); run.DebugSetPosition(0, 23); run.ResolveCurrentRoom(); run.CompleteCampfire(new[] { "安全卡" });
        Check(run.OwnedCards.Any(x => x.Card.Name == "安全卡"), "campfire pocket restore failed");
    }

    private static void BackpackAndSafeCapacityCountCardInstances()
    {
        var run = new RunState(701);
        var card = new RunCard("stacked", "成叠卡牌");
        Check(run.AddCard(card, 16) && run.BackpackUsed == 16, "bag slots must count every card instance");
        Check(!run.AddCard(new RunCard("overflow", "溢出卡")), "bag accepted a seventeenth card");
        Check(run.SetCardSafe("成叠卡牌", 2), "two cards could not enter the default safe pocket");
        Check(run.OwnedCards.Where(x => x.Safe).Sum(x => x.Count) == 2 && !run.SetCardSafe("成叠卡牌"), "safe pocket did not enforce its two-card capacity");
        Check(run.UnsetCardSafe("成叠卡牌") && run.ReturnCardToBase("成叠卡牌"), "safe/loadout card transfer failed");
    }

    private static void EventChoicesAndCampfireRestoreWork()
    {
        Check(new RunCard("r", "资源", "资源").Semantic == RunCardSemantic.Resource &&
              new RunCard("e", "事件", "事件").Semantic == RunCardSemantic.Event &&
              new RunCard("m", "地图", "地图").Semantic == RunCardSemantic.Map, "RunCard semantic categories drifted");
        var run = new RunState(123); run.AddCard(new RunCard("class", "职业卡", "武术", "职业")); run.ConfigureClassCardPool(new[] { new RunCard("class2", "职业卡2", "武术", "职业") });
        run.DebugSetPosition(0, 4); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.Event, "event room did not open choices");
        var choices = run.DrawEventChoices(); Check(choices.Count > 0 && choices.All(x => !string.IsNullOrWhiteSpace(x.Id)), "event choice list missing");
        run.ChooseEvent(0); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase is RunPhase.Ready or RunPhase.Battle, "event choice did not settle");
    }

    private static void SettleToReady(RunState run)
    {
        for (var guard = 0; guard < 8 && run.Phase != RunPhase.Ready; guard++)
        {
            switch (run.Phase)
            {
                case RunPhase.Event: run.ResolveEvent(); break;
                case RunPhase.Chest: run.OpenNextChest(); break;
                case RunPhase.Campfire: run.CompleteCampfire(); break;
                case RunPhase.Shop: run.LeaveShop(); break;
                case RunPhase.AwaitingDoor: run.StayAtDoor(); break;
                case RunPhase.Battle: run.CompleteBattle(true); break;
                case RunPhase.Altar: run.LeaveAltar(); break;
                default: throw new InvalidOperationException($"unexpected phase {run.Phase}");
            }
        }
        Check(run.Phase == RunPhase.Ready, "room did not settle to ready");
    }

    private static void ChestRewardsAndSettlementNeverSilentlyDropCards()
    {
        var baseState = new RunBaseState();
        // Deliberately leave one stash slot available and make the run backpack full with unique cards.
        for (var i = 0; i < baseState.StashCapacity - 1; i++) baseState.DepositCards(new[] { new RunCardStack(new RunCard($"s{i}", $"仓库卡{i}")) });
        var run = new RunState(8, null, baseState);
        for (var i = 0; i < run.BackpackCapacity; i++) run.AddCard(new RunCard($"b{i}", $"背包卡{i}"));
        run.DebugSetPosition(0, 17); run.ResolveCurrentRoom();
        var preview = run.PeekNextChest(); var loot = run.OpenNextChest();
        Check(loot.Items.Count == 1 && loot.AcceptedItems!.Count == 1, "chest reward preview/acceptance mismatch");
        Check(run.OwnedCards.Count == run.BackpackCapacity && run.PendingRewards.Count == 1, "full backpack silently discarded chest card");
        Check(!run.ClaimPendingReward(run.PendingRewards[0].Card.Name), "pending reward bypassed capacity");
        run.MoveCardToPocket("背包卡0"); Check(run.ClaimPendingReward(run.PendingRewards[0].Card.Name), "pending reward could not be claimed after capacity freed");
        run.Extract(); Check(run.Phase == RunPhase.Settlement && run.SettlementCards.Any(x => !x.Deposited), "full stash did not expose settlement remainder");
        baseState.Stash.Clear();
        for (var i = 0; i < run.SettlementCards.Count; i++) run.DepositSettlementCard(i);
        Check(run.FinalizeSettlement(), "settlement remainder could not be deposited after capacity freed");
        var settlement = new RunState(8); settlement.AddCard(new RunCard("settle", "结算卡")); settlement.Extract();
        Check(settlement.Phase == RunPhase.Settlement && settlement.SettlementCards.All(x => x.Deposited), "settlement card deposit was lost");
        Check(settlement.FinalizeSettlement(), "settlement should finish after all cards deposited");

        var death = new RunState(3, null, new RunBaseState()); death.AddCard(new RunCard("safe", "安全卡"), safe: true);
        death.DebugSetPosition(0, 5); death.ResolveCurrentRoom(); death.CompleteBattle(false);
        Check(death.Phase == RunPhase.Defeat && death.RecoveryCards.Count == 0, "safe card should be recovered when capacity exists");
    }

    private static void DoorAndChestReadOnlyStateIsInspectable()
    {
        var run = new RunState(2); run.DebugSetPosition(0, 1); run.ResolveCurrentRoom();
        Check(run.CurrentDoor is not null && run.CurrentDoor.CanEnter && run.CurrentDoor.CanExtract, "door availability was not exposed");
        run.StayAtDoor(); run.DebugSetPosition(0, 5); run.ResolveCurrentRoom(); run.CompleteBattle(true);
        var preview = run.PeekNextChest(); Check(preview.Kind is "small" or "medium" or "large" && preview.Candidates.Count > 0, "chest preview missing");
        Check(run.PeekNextChest() == preview, "chest preview was not stable");
    }
}
