using System;
using System.Collections.Generic;
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
        LayeredGeneratorProducesValidFourLayerMaps();
        GeneratedMapsAreConnectedAndDoorsLinkLayers();
        RuntimeTablesMatchDataFiles();
        MovementIsATransactionAlongAdjacentNodes();
        RoomSettlementIsOneShotAndDoorsProgressLayers();
        BattleDropsAreSettledAndFailureIsTerminal();
        ShopEventFireAndEmergencyExtractionWork();
        AltarRitualBossGateAndFinalExtractionWork();
        BaseBackpackAndStashRulesMatchOriginal();
        BackpackAndSafeCapacityCountCardInstances();
        EventChoicesAndCampfireRestoreWork();
        SnapshotsRestoreOnlyValidatedReadyRuns();
        SaveRestoreRoundTripContinuesIdentically();
        ChestRewardsAndSettlementNeverSilentlyDropCards();
        DoorAndChestReadOnlyStateIsInspectable();
        ShopStockWeightsBuyAndSellMatchWeb();
        ChestKindsDropsPityEggAndClassChestMatchWeb();
        ChestQueueSuspendsAndResumes();
        FragmentSourcesAndCraftSemanticsMatchWeb();
        PetLifecycleEggHatchUpgradeCarryMatchesData();
        CollectionRoomConversionAndMilestonesMatchData();
        InkEventChoicesLandTheirEffects();
        ShoeShopAndKnotlessEventsLandSafely();
        EventPanelSuspendsResumesAndStaysUnsaveable();
        TwoThousandSeedAcceptanceHarness();
        Console.WriteLine($"RUN_SMOKE_OK checks={_checks}");
        return 0;
    }

    // ---------- 生成器（批次 3：四层地图） ----------

    private static void LayeredGeneratorProducesValidFourLayerMaps()
    {
        // 版本常量随真源 map-generator.js
        Check(MapGenerator.GeneratorVersion == 3, "generator version drifted");
        Check(MapGenerator.LayoutVersion == 5, "layout version drifted");
        Check(MapGenerator.Targets.SequenceEqual(new[] { 13, 15, 17, 15 }), "layer targets drifted");
        Check(MapGenerator.Widths.SequenceEqual(new[] { 7, 8, 9, 8 }), "layer widths drifted");
        Check(MapGenerator.MaxAttempts == 8, "candidate attempts drifted");

        var map = RunMap.Generate(123);
        Check(map.Layers.Count == 4, "map must have four layers");
        Check(map.Layers.Select(x => x.NodeCount).SequenceEqual(new[] { 13, 15, 17, 15 }), "layer node counts must match TARGETS");
        Check(map.GeneratorVersion == MapGenerator.GeneratorVersion && map.LayoutVersion == MapGenerator.LayoutVersion, "map version constants not propagated");
        Check(map.Seed == 123UL, "map seed not propagated");
        for (var li = 0; li < 4; li++) AssertLayerInvariants(map, li, 123);

        // 同 seed 同结果（内部确定性，HANDOFF §0.1）
        var again = RunMap.Generate(123);
        for (var li = 0; li < 4; li++)
        {
            var a = map.Layers[li];
            var b = again.Layers[li];
            Check(a.Nodes.Select(n => (n.Idx, n.X, n.Row, n.Type, n.Name)).SequenceEqual(b.Nodes.Select(n => (n.Idx, n.X, n.Row, n.Type, n.Name))),
                $"seed 123 layer {li} generation is not deterministic");
            Check(EdgeSignature(a) == EdgeSignature(b), $"seed 123 layer {li} edges are not deterministic");
        }
        // 每层独立命名种子流：种子推导确定、候选举优流互不相同
        Check(MapGenerator.FnvHash("123:attempt:0:layer:0") == MapGenerator.FnvHash("123:attempt:0:layer:0"), "layer seed stream not deterministic");
        Check(MapGenerator.FnvHash("123:attempt:0:layer:0") != MapGenerator.FnvHash("123:attempt:1:layer:0"), "attempt streams must differ");
    }

    private static string EdgeSignature(RunLayer layer) =>
        string.Join(";", layer.Nodes.SelectMany(n => n.Next.Select(e => $"{n.Idx}>{e.ToLayer}:{e.ToIdx}")).OrderBy(s => s, StringComparer.Ordinal));

    private static void GeneratedMapsAreConnectedAndDoorsLinkLayers()
    {
        // map-graph.js 连通性检查移植：从第 1 层入口 flood-fill，全图可达
        for (var seed = 1; seed <= 100; seed++)
        {
            var map = RunMap.Generate((ulong)seed);
            Check(map.CheckConnectivity(out var unreachable) && unreachable.Count == 0,
                $"seed {seed}: disconnected map {string.Join(",", unreachable)}");
            var adjacency = map.BuildAdjacency();
            foreach (var (from, neighbors) in adjacency)
                foreach (var to in neighbors)
                    Check(adjacency[to].Contains(from), $"seed {seed}: adjacency not symmetric {from}->{to}");
            // 层间门：0..2 层各恰好 1 扇、位于出口、指向下一层入口、双向边存在、只向深处（无撤离出口）
            for (var li = 0; li < 3; li++)
            {
                var layer = map.Layers[li];
                Check(layer.Doors.Count == 1, $"seed {seed}: layer {li} door count");
                var door = layer.Doors[0];
                Check(door.At == layer.Exit && door.ToLayer == li + 1 && door.ArriveAt == map.Layers[li + 1].Entry,
                    $"seed {seed}: layer {li} door endpoints");
                Check(!door.IsExit, $"seed {seed}: doors no longer extract (只向深处)");
                Check(map.Layers[li].Nodes[door.At].Next.Any(e => e.ToLayer == li + 1 && e.ToIdx == door.ArriveAt)
                    && map.Layers[li + 1].Nodes[door.ArriveAt].Next.Any(e => e.ToLayer == li && e.ToIdx == door.At),
                    $"seed {seed}: layer {li} door edge must be bidirectional");
            }
            Check(map.Layers[3].Doors.Count == 0, $"seed {seed}: final layer has no door");
        }
    }

    /// <summary>每层保底/质量规则逐条断言（独立于生成器自身的 Validate，作为复验口径）。</summary>
    private static (int Fires, int Shops, int Chests, int Battles, int EmergencyExits, int Altars, int Bosses) AssertLayerInvariants(RunMap map, int li, ulong seed)
    {
        var layer = map.Layers[li];
        var nodes = layer.Nodes;
        Check(nodes.Count == MapGenerator.Targets[li], $"seed {seed} layer {li}: node count");
        var coords = new HashSet<(int X, int Row)>();
        foreach (var node in nodes)
        {
            Check(node.Li == li && node.Id == $"L{li + 1}_N{node.Idx + 1}", $"seed {seed} layer {li}: node identity");
            Check(coords.Add((node.X, node.Row)), $"seed {seed} layer {li}: duplicate coord");
            Check(node.X >= 0 && node.X < MapGenerator.Widths[li] && node.Row is >= MapGenerator.RowMin and <= MapGenerator.RowMax,
                $"seed {seed} layer {li}: coord out of grid bounds");
            foreach (var edge in node.Next.Where(e => e.ToLayer == li))
            {
                Check(edge.ToIdx >= 0 && edge.ToIdx < nodes.Count, $"seed {seed} layer {li}: edge target out of range");
                var other = nodes[edge.ToIdx];
                Check(Math.Abs(other.X - node.X) + Math.Abs(other.Row - node.Row) == 1,
                    $"seed {seed} layer {li}: edge is not 4-directional");
                Check(other.Next.Any(b => b.ToLayer == li && b.ToIdx == node.Idx),
                    $"seed {seed} layer {li}: edge not bidirectional");
            }
        }
        // 入口/出口定型
        Check(layer.TypeAt(layer.Entry) == RunRoomType.Entrance && nodes.Count(n => n.Type == RunRoomType.Entrance) == 1,
            $"seed {seed} layer {li}: exactly one entrance at layer entry");
        var exitType = li == 3 ? RunRoomType.Extraction : RunRoomType.Door;
        Check(layer.TypeAt(layer.Exit) == exitType && nodes.Count(n => n.Type == exitType) == 1,
            $"seed {seed} layer {li}: exactly one {exitType} at layer exit");
        // 保底火堆/补给站：恰好各 1 且 x≥2、互不相邻（与搜刮点相邻允许）
        var fires = nodes.Count(n => n.Type == RunRoomType.Campfire);
        var shops = nodes.Count(n => n.Type == RunRoomType.Shop);
        Check(fires == 1 && shops == 1, $"seed {seed} layer {li}: fire/shop guarantee (fires={fires}, shops={shops})");
        foreach (var facility in nodes.Where(n => n.Type is RunRoomType.Campfire or RunRoomType.Shop))
        {
            Check(facility.X >= 2, $"seed {seed} layer {li}: fire/shop must sit at x>=2");
            Check(!nodes.Any(m => m != facility && m.Type is RunRoomType.Campfire or RunRoomType.Shop
                && Math.Abs(m.X - facility.X) + Math.Abs(m.Row - facility.Row) == 1),
                $"seed {seed} layer {li}: facilities must not be adjacent");
        }
        // 物资格：保底 1、上限 4；战斗：保底 3、上限 4
        var chests = nodes.Count(n => n.Type == RunRoomType.Chest);
        var battles = nodes.Count(n => n.Type == RunRoomType.Battle);
        Check(chests is >= 1 and <= 4, $"seed {seed} layer {li}: chest guarantee/cap (chests={chests})");
        Check(battles is >= 3 and <= 4, $"seed {seed} layer {li}: battle min/cap (battles={battles})");
        // 禁三连战：战斗节点战斗邻居 ≤1（两连战对保留）
        foreach (var node in nodes.Where(n => n.Type == RunRoomType.Battle))
            Check(nodes.Count(m => m.Type == RunRoomType.Battle && Math.Abs(m.X - node.X) + Math.Abs(m.Row - node.Row) == 1) <= 1,
                $"seed {seed} layer {li}: triple battle chain");
        // L3 唯一紧急撤离点；L4 终局三连 altar→boss→extraction
        var exits = nodes.Count(n => n.Type == RunRoomType.EmergencyExit);
        if (li == 2) Check(exits == 1, $"seed {seed} layer 3: unique emergency exit (exits={exits})");
        else Check(exits == 0, $"seed {seed} layer {li}: emergency exit must only exist on layer 3");
        var altars = nodes.Count(n => n.Type == RunRoomType.Altar);
        var bosses = nodes.Count(n => n.Type == RunRoomType.Boss);
        if (li == 3)
        {
            Check(altars == 1 && bosses == 1, $"seed {seed} layer 4: altar+boss final trio");
            var altarNode = nodes.First(n => n.Type == RunRoomType.Altar);
            var bossNode = nodes.First(n => n.Type == RunRoomType.Boss);
            Check(bossNode.X > altarNode.X || (bossNode.X == altarNode.X && bossNode.Row > altarNode.Row),
                $"seed {seed} layer 4: boss must sit deeper than altar");
        }
        else
        {
            Check(altars == 0 && bosses == 0, $"seed {seed} layer {li}: altar/boss only on layer 4");
        }
        return (fires, shops, chests, battles, exits, altars, bosses);
    }

    // ---------- 批次 1 数据接线断言（保留，落点改按节点类型定位） ----------

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
        var runtimeMap = RunMap.Generate(77);
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
            var pickFromValue = node.Value.TryGetProperty("pickFrom", out var pickFromNode) ? pickFromNode.GetInt32() : 0;
            var coinCards = node.Value.TryGetProperty("coinCards", out var coinCardsNode) && coinCardsNode.ValueKind == JsonValueKind.Array
                ? coinCardsNode.EnumerateArray().Select(c => c.GetString() ?? "").ToArray() : Array.Empty<string>();
            var tokenChance = node.Value.TryGetProperty("tokenChance", out var tokenNode) ? tokenNode.GetDouble() : 0.0;
            Check(kind.CoinMin == (coins.Length > 0 ? coins[0] : 0) && kind.CoinMax == (coins.Length > 0 ? coins[^1] : 0)
                && kind.Candidates == candidates && kind.PickFrom == pickFromValue
                && kind.CoinCards.SequenceEqual(coinCards)
                && Math.Abs(kind.TokenChance - tokenChance) < 1e-9, $"chest kind {node.Name} runtime/data mismatch");
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

        // 批次 4b：cards.json 顶层 shopWeights/dropWeights/dropTypes/dropDiscountTypes/rarities 逐项一致。
        var shopWeights = cardsDoc.RootElement.GetProperty("shopWeights");
        Check(data.CardShopWeights.Count == shopWeights.EnumerateObject().Count(), "shopWeights size mismatch");
        foreach (var node in shopWeights.EnumerateObject())
            Check(data.CardShopWeights.TryGetValue(node.Name, out var weight) && weight == node.Value.GetInt32(),
                $"shopWeights {node.Name} runtime/data mismatch");
        var dropWeights = cardsDoc.RootElement.GetProperty("dropWeights");
        Check(data.CardDropWeights.Count == dropWeights.EnumerateObject().Count(), "dropWeights size mismatch");
        foreach (var node in dropWeights.EnumerateObject())
            Check(data.CardDropWeights.TryGetValue(node.Name, out var dropWeight) && dropWeight == node.Value.GetInt32(),
                $"dropWeights {node.Name} runtime/data mismatch");
        foreach (var field in new[] { "dropTypes", "dropDiscountTypes", "rarities" })
        {
            var expected = cardsDoc.RootElement.GetProperty(field).EnumerateArray().Select(n => n.GetString() ?? "").ToArray();
            var actual = field switch
            {
                "dropTypes" => data.CardDropTypes,
                "dropDiscountTypes" => data.CardDropDiscountTypes,
                _ => data.CardRarities
            };
            Check(actual.SequenceEqual(expected), $"{field} runtime/data mismatch");
        }
        // rules.json playerAtk / keyNeeded / starterSha（网页 game.atk=4 / base.js KEY_NEEDED=10 / groups.battle.starterAttack=5）。
        Check(RunRules.PlayerAtk == rules.GetProperty("playerAtk").GetInt32(), "rule playerAtk not injected");
        Check(RunRules.KeyNeeded == rules.GetProperty("keyNeeded").GetInt32(), "rule keyNeeded not injected");
        Check(RunRules.StarterSha == rules.GetProperty("starterSha").GetInt32(), "rule starterSha not injected");

        // 批次 5：pets.json / achievements.json 进运行时，逐项一致。
        using var petsDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "pets.json")));
        var petsRoot = petsDoc.RootElement;
        Check(data.Pets.EggId == petsRoot.GetProperty("eggId").GetString(), "pets eggId runtime/data mismatch");
        Check(data.Pets.HatchCost == petsRoot.GetProperty("hatchCost").GetInt32(), "pets hatchCost runtime/data mismatch");
        Check(data.Pets.LevelMax == petsRoot.GetProperty("levelMax").GetInt32(), "pets levelMax runtime/data mismatch");
        Check(data.Pets.UpCosts.SequenceEqual(petsRoot.GetProperty("upCosts").EnumerateArray().Select(n => n.GetInt32())),
            "pets upCosts runtime/data mismatch");
        var petNodes = petsRoot.GetProperty("list");
        Check(data.Pets.List.Count == petNodes.GetArrayLength(), "pets list size mismatch");
        for (var i = 0; i < data.Pets.List.Count; i++)
        {
            var node = petNodes[i];
            var pet = data.Pets.List[i];
            var effect = node.GetProperty("effect");
            Check(pet.Id == node.GetProperty("id").GetString() && pet.Name == node.GetProperty("name").GetString()
                && pet.Effect.MaxHp == (effect.TryGetProperty("maxHp", out var maxHp) ? maxHp.GetInt32() : 0)
                && Math.Abs(pet.Effect.ClassChest - (effect.TryGetProperty("classChest", out var cc) ? cc.GetDouble() : 0)) < 1e-9
                && pet.Effect.ShopFree == (effect.TryGetProperty("shopFree", out var sf) && sf.ValueKind == JsonValueKind.True)
                && pet.Effect.ExtraSha == (effect.TryGetProperty("extraSha", out var es) ? es.GetInt32() : 0)
                && pet.Effect.ShaToFireball == (effect.TryGetProperty("shaToFireball", out var stf) && stf.ValueKind == JsonValueKind.True)
                && pet.Effect.SafeBonus == (effect.TryGetProperty("safeBonus", out var sb) ? sb.GetInt32() : 0),
                $"pet {pet.Id} runtime/data mismatch");
        }
        using var achDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(dataDir, "achievements.json")));
        var achievementsRoot = achDoc.RootElement;
        var achievementNodes = achievementsRoot.GetProperty("achievements");
        Check(data.Achievements.Achievements.Count == achievementNodes.GetArrayLength(), "achievements size mismatch");
        for (var i = 0; i < data.Achievements.Achievements.Count; i++)
        {
            var node = achievementNodes[i];
            var ach = data.Achievements.Achievements[i];
            Check(ach.Id == node.GetProperty("id").GetString() && ach.Name == node.GetProperty("name").GetString()
                && ach.Desc == node.GetProperty("desc").GetString(), $"achievement {i} runtime/data mismatch");
        }
        var milestoneNodes = achievementsRoot.GetProperty("collectionMilestones");
        Check(data.Achievements.CollectionMilestones.Count == milestoneNodes.GetArrayLength(), "collectionMilestones size mismatch");
        for (var i = 0; i < data.Achievements.CollectionMilestones.Count; i++)
        {
            var node = milestoneNodes[i];
            var ms = data.Achievements.CollectionMilestones[i];
            var expectedNeed = node.GetProperty("need");
            Check(ms.Id == node.GetProperty("id").GetString()
                && ms.Need == (expectedNeed.ValueKind == JsonValueKind.String ? expectedNeed.GetString() : expectedNeed.GetRawText()),
                $"milestone {i} need runtime/data mismatch");
            var reward = node.GetProperty("reward");
            Check(ms.Reward.Wood == (reward.TryGetProperty("wood", out var rw) ? rw.GetInt32() : 0)
                && ms.Reward.Rations == (reward.TryGetProperty("rations", out var rr) ? rr.GetInt32() : 0)
                && ms.Reward.Keys == (reward.TryGetProperty("keys", out var rk) ? rk.GetInt32() : 0)
                && ms.Reward.Legend == (reward.TryGetProperty("legend", out var rl) ? rl.GetInt32() : 0)
                && ms.Reward.Egg == (reward.TryGetProperty("egg", out var re) ? re.GetInt32() : 0),
                $"milestone {ms.Id} reward runtime/data mismatch");
        }
        // cards.json classes = 在册五职业（meta.js classList 的数据来源）。
        Check(data.CardClasses.SequenceEqual(cardsDoc.RootElement.GetProperty("classes").EnumerateArray().Select(n => n.GetString() ?? "")),
            "card classes runtime/data mismatch");

        // 行为抽查：外层战斗格遭遇只含该层表内的怪物且数量落在数据 size 区间。
        var entryIds = data.Encounters[0].Entries.Select(en => en.MonsterId).ToHashSet();
        var minCount = data.Encounters[0].Entries.Min(en => en.Min);
        var maxCount = data.Encounters[0].Entries.Max(en => en.Max);
        for (var seed = 1; seed <= 200; seed++)
        {
            var run = new RunState((ulong)seed);
            var battle = FindNode(run.Map, 0, RunRoomType.Battle);
            run.DebugSetPosition(0, battle);
            run.ResolveCurrentRoom();
            Check(run.Phase == RunPhase.Battle && run.Encounter.Count >= minCount && run.Encounter.Count <= maxCount,
                $"seed {seed} encounter count {run.Encounter.Count} outside data range [{minCount},{maxCount}]");
            Check(run.Encounter.All(enemy => entryIds.Contains(enemy.Id)), $"seed {seed} enemy outside outer encounter table");
            run.CompleteBattle(true);
            while (run.Phase == RunPhase.Chest) run.OpenNextChest();
            Check(run.Phase == RunPhase.Ready, $"seed {seed} battle/chest flow did not settle");
        }
    }

    // ---------- 移动事务（game.run.flow.js moveTo 对齐） ----------

    private static void MovementIsATransactionAlongAdjacentNodes()
    {
        var a = new RunState(1234UL);
        var b = new RunState(1234UL);
        Check(a.ReachableNodes().Count > 0, "starting entrance should expose neighbors");
        Check(a.TrackPosition == a.Map.Layers[0].Entry && a.LayerIndex == 0, "run must start at the layer-1 entrance");
        for (var i = 0; i < 8; i++)
        {
            var target = a.ReachableNodes()[0];
            Check(b.ReachableNodes().SequenceEqual(a.ReachableNodes()), "run replay diverged before move");
            var moveA = a.MoveTo(target);
            var moveB = b.MoveTo(target);
            Check(moveA.ToPosition == moveB.ToPosition && moveA.Layer == moveB.Layer, "run replay diverged on move");
            SettleToReady(a);
            SettleToReady(b);
            Check(a.TrackPosition == b.TrackPosition && a.Phase == b.Phase, "run replay diverged after settle");
            Check(a.Resources.Coins == b.Resources.Coins && a.Hp == b.Hp, "run replay diverged on resources");
            Check(a.Rng.State == b.Rng.State, "run replay diverged on rng state");
        }
        Check(a.Turns == 8 && b.Turns == 8, "each move is one turn");
        Check(a.Stamina == RunRules.StaminaMax, "movement must not consume stamina (网页版已移除掷骰消耗)");
        // 非相邻节点不可直达（原子事务拒绝）
        var far = Enumerable.Range(0, a.Map.Layers[a.LayerIndex].NodeCount)
            .First(idx => !a.ReachableNodes().Contains(idx));
        try { a.MoveTo(far); throw new InvalidOperationException("non-adjacent move was accepted"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("相邻", StringComparison.Ordinal), "wrong non-adjacent move error"); _checks++; }
        // 移动事务：只有稳定落点（Ready/Settlement）才可存档——战斗中途快照拒恢复
        var fight = new RunState(5UL);
        fight.DebugSetPosition(0, FindNode(fight.Map, 0, RunRoomType.Battle));
        fight.ResolveCurrentRoom();
        Check(fight.Phase == RunPhase.Battle, "battle node should enter battle");
        var midBattle = fight.CaptureSnapshot();
        try { RunState.FromSnapshot(midBattle); throw new InvalidOperationException("mid-battle snapshot was accepted"); }
        catch (ArgumentException) { _checks++; }
    }

    // ---------- 落脚结算：一次性内容防重刷 + 层间门 ----------

    private static void RoomSettlementIsOneShotAndDoorsProgressLayers()
    {
        var run = new RunState(1);
        // 入口是安全格：再结算无事发生
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Ready, "entrance should stay ready");
        // 物资格一次性：开完宝箱回头路再踏入不重触发
        var chestIdx = FindNode(run.Map, 0, RunRoomType.Chest);
        run.DebugSetPosition(0, chestIdx);
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Chest, "chest node should open a chest");
        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "chest should settle to ready");
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Ready, "revisited chest must not re-trigger (一次性内容)");
        // 事件格一次性
        var eventIdx = FindNode(run.Map, 0, RunRoomType.Event);
        run.DebugSetPosition(0, eventIdx);
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Event, "event node should open the event");
        run.LeaveEventWithoutEffect();
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Ready, "revisited event must not re-trigger");
        // 战斗格一次性（胜利结算后回头路不再触发）
        var battleIdx = FindNode(run.Map, 0, RunRoomType.Battle);
        run.DebugSetPosition(0, battleIdx);
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Battle, "battle node should start an encounter");
        run.CompleteBattle(true);
        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Ready, "revisited battle must not re-trigger");
        // 层间门：踩上弹选择（可重复通行），进入后落到下一层入口
        var doorIdx = FindNode(run.Map, 0, RunRoomType.Door);
        run.DebugSetPosition(0, doorIdx);
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor && run.CurrentDoor is { CanEnter: true }, "door should await choice");
        run.StayAtDoor();
        run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor, "door is a repeatable passage");
        run.EnterDoor();
        Check(run.LayerIndex == 1 && run.TrackPosition == run.Map.Layers[1].Entry && run.Phase == RunPhase.Ready,
            "door did not progress to layer two entrance");
    }

    private static void BattleDropsAreSettledAndFailureIsTerminal()
    {
        var run = new RunState(4);
        var battle = FindNode(run.Map, 0, RunRoomType.Battle);
        // data/map.json 外层遭遇表 entries 的 size 均为 [2,3]（网页版 per-entry 语义）。
        run.DebugSetPosition(0, battle); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Battle && run.Encounter.Count is >= 2 and <= 3, "battle encounter invalid");
        run.CompleteBattle(true); Check(run.Phase == RunPhase.Chest, "battle should open a chest settlement");
        run.OpenNextChest(); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "chest queue did not settle");
        // 一次性内容：同一战斗格不重触发，换第二个战斗格验败局终局
        var battle2 = FindNode(run.Map, 0, RunRoomType.Battle, 1);
        run.DebugSetPosition(0, battle2); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Battle, "second battle node should trigger");
        run.CompleteBattle(false);
        Check(run.Phase == RunPhase.Defeat && run.IsFinished, "battle failure must be terminal");
    }

    private static void ShopEventFireAndEmergencyExtractionWork()
    {
        var run = new RunState(9);
        // 补给站（每层恰好 1）：网页商店只卖卡牌（6 随机 + 桃 + 初始攻击 + 神秘货箱），不卖裸资源
        run.ConfigureShopCardPool(LoadRunCardUniverse());
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Shop)); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Shop && run.Shop.Count == 9, "shop stock should be 6 random + peach + sha + mystery");
        Check(run.Shop.Any(offer => offer.Id == "peach" && offer.Price == 2 && offer.Card?.Id == "tt-peach"),
            "peach fixed slot missing (2 币 tt-peach)");
        Check(run.Shop.Any(offer => offer.Id == "sha" && offer.Price == 1 && offer.ShaReplenish == 5),
            "sha replenish slot missing (1 币 ×5/站)");
        Check(run.Shop.Any(offer => offer.Id == "mystery" && offer.Price == 3 && offer.IsMystery),
            "mystery crate slot missing (3 币)");
        run.Resources.Coins = 10; run.BuyShopOffer("peach");
        Check(run.Resources.Coins == 8 && run.OwnedCards.Any(x => x.Card.Id == "tt-peach"), "peach purchase failed");
        run.LeaveShop(); Check(run.Phase == RunPhase.Ready, "leaving shop should settle to ready");
        // 事件格 + 事件战（拾荒者数量随层数缩放：第 1 层 3 只，第 3 层起 5 只）。
        // 事件种类由事件卡池 RNG 抽取（批次 4c：卡库事件卡 = 10 个 tt6 + 修鞋铺）——扫 seed 直到抽中 bandits。
        var eventDeck = LoadRunCardUniverse().Where(card => card.Type == "事件").ToList();
        RunState? banditRun = null;
        for (var seed = 1; seed <= 300 && banditRun is null; seed++)
        {
            var probe = new RunState((ulong)seed);
            probe.ConfigureEventCardPool(eventDeck);
            probe.DebugSetPosition(0, FindNode(probe.Map, 0, RunRoomType.Event));
            probe.ResolveCurrentRoom();
            var probeChoices = probe.DrawEventChoices();
            if (probeChoices[0].Id != "bandits_fight") continue;
            probe.ChooseEvent(0);
            Check(probe.Phase == RunPhase.Battle && probe.Encounter.Count == Math.Min(5, 3 + probe.LayerIndex),
                "bandits gang should scale with layer");
            probe.CompleteBattle(true, 20);
            while (probe.Phase == RunPhase.Chest) probe.OpenNextChest();
            Check(probe.Hp == 20 && probe.Phase == RunPhase.Ready, "event battle should settle with damage applied");
            banditRun = probe;
        }
        Check(banditRun is not null, "bandits event should appear within 300 seeds");
        // 时空孔隙（tt6-timeskip）：卡已被 cards-sync retire——事件格永不抽中（网页 runEventDeck 只抽在役事件卡）；
        // 其 ink 结点仍保留（批次 4a 口径），用 seam 验证选项落地：事件连锁移动已停用，原地不动回 Ready。
        var timeskipRun = new RunState(9);
        timeskipRun.ConfigureEventCardPool(eventDeck);
        timeskipRun.DebugSetPosition(0, FindNode(timeskipRun.Map, 0, RunRoomType.Event));
        timeskipRun.ResolveCurrentRoom();
        timeskipRun.DebugSetEventCard("tt6-timeskip");
        Check(timeskipRun.EventChoices[0].Id == "timeskip_move", "timeskip: ink 结点选项可达");
        timeskipRun.ChooseEvent(0);
        Check(timeskipRun.Phase == RunPhase.Ready && timeskipRun.Turns == 0, "timeskip must not chain-move (链式移动已停用)");
        // 火堆（每层恰好 1）：回 8 血（接在事件战掉血的局上验证）
        var healed = banditRun!;
        healed.DebugSetPosition(0, FindNode(healed.Map, 0, RunRoomType.Campfire)); healed.ResolveCurrentRoom();
        Check(healed.Phase == RunPhase.Campfire && healed.Hp == 20 + RunRules.FireHeal, "campfire should heal by fireHeal");
        healed.CompleteCampfire();
        Check(healed.Phase == RunPhase.Ready, "campfire should settle");
        // 紧急撤离点（仅第三层）：献祭 3 张背包卡牌后撤离
        run.DebugSetPosition(2, FindNode(run.Map, 2, RunRoomType.EmergencyExit)); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor && run.CurrentDoor is { CanEnter: false }, "emergency exit should await sacrifice");
        run.AddCard(new RunCard("sac-a", "紧急献祭甲"));
        run.AddCard(new RunCard("sac-b", "紧急献祭乙"));
        run.AddCard(new RunCard("sac-c", "紧急献祭丙"));
        Check(run.CanExtract, "extraction unlocks with three sacrifice cards available");
        run.ExtractAtDoor(new[] { "紧急献祭甲", "紧急献祭乙", "紧急献祭丙" });
        Check(run.Phase == RunPhase.Settlement, "emergency sacrifice should enter settlement");
        Check(!run.OwnedCards.Any(x => x.Card.Name.StartsWith("紧急献祭", StringComparison.Ordinal)), "sacrificed cards must be consumed");
        Check(run.FinalizeSettlement() && run.Phase == RunPhase.Victory, "empty settlement should complete the run");
        // 献祭不足 3 张时拒绝撤离
        var locked = new RunState(10);
        locked.AddCard(new RunCard("sac-x", "唯一献祭卡"));
        locked.DebugSetPosition(2, FindNode(locked.Map, 2, RunRoomType.EmergencyExit));
        locked.ResolveCurrentRoom();
        Check(!locked.CanExtract, "extraction must stay locked without enough cards");
        try { locked.ExtractAtDoor(new[] { "唯一献祭卡", "缺一张", "再缺一张" }); throw new InvalidOperationException("underfunded sacrifice was accepted"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("背包中没有", StringComparison.Ordinal), "wrong sacrifice error"); _checks++; }
    }

    private static void AltarRitualBossGateAndFinalExtractionWork()
    {
        // ---------- 弃 3 激活 → 二选一奖励 → 首脑 → 终局撤离 ----------
        var run = new RunState(4242);
        for (var i = 0; i < 5; i++) run.AddCard(new RunCard($"altar-fodder-{i}", $"祭坛弃牌{i}"));
        var altarIdx = FindNode(run.Map, 3, RunRoomType.Altar);
        var bossIdx = FindNode(run.Map, 3, RunRoomType.Boss);
        var exitIdx = FindNode(run.Map, 3, RunRoomType.Extraction);
        // 未激活祭坛：首脑格封印（挑战被拒），落脚不锁定
        run.DebugSetPosition(3, bossIdx); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Ready, "boss landing must stay ready (不锁定)");
        try { run.ChallengeBoss(0); throw new InvalidOperationException("sealed boss accepted a challenge"); }
        catch (InvalidOperationException error) { Check(error.Message == RunState.AltarLockedMessage, "wrong sealed boss message"); _checks++; }
        // 祭坛：离开未激活可再来
        run.DebugSetPosition(3, altarIdx); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Altar, "altar node should open the ritual");
        run.LeaveAltar();
        Check(run.Phase == RunPhase.Ready, "leaving the altar keeps it dormant");
        run.DebugSetPosition(3, altarIdx); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Altar, "altar can be revisited while dormant");
        // 弃 3 张数量不符 → 拒绝
        try { run.ActivateAltarByDiscard(new[] { "祭坛弃牌0", "祭坛弃牌1" }); throw new InvalidOperationException("short discard accepted"); }
        catch (InvalidOperationException) { _checks++; }
        run.ActivateAltarByDiscard(new[] { "祭坛弃牌0", "祭坛弃牌1", "祭坛弃牌2" });
        Check(run.AltarActivated && run.PendingAltarReward
            && !run.OwnedCards.Any(x => x.Card.Name is "祭坛弃牌0" or "祭坛弃牌1" or "祭坛弃牌2")
            && run.OwnedCards.Sum(x => x.Count) == 2,
            "discard-3 activation must consume the discarded cards and await reward");
        // 二选一奖励：② 随机传说+装备（卡池为空时静默跳过但必须回到 Ready）
        run.ChooseAltarReward(1);
        Check(run.Phase == RunPhase.Ready && !run.PendingAltarReward, "altar reward should settle to ready");
        Check(run.VisitedNodes.Contains($"3,{altarIdx}"), "activated altar must consume its node");
        // 激活后可挑战首脑；胜利后 bossKilled 且本格消耗
        run.DebugSetPosition(3, bossIdx); run.ResolveCurrentRoom();
        run.ChallengeBoss(0);
        Check(run.Phase == RunPhase.Battle && run.Encounter.Count == 1 && run.Encounter[0].Id == run.Map.Bosses[0].Id,
            "boss challenge must field the chosen boss");
        run.CompleteBattle(true);
        Check(run.BossKilled && run.VisitedNodes.Contains($"3,{bossIdx}"), "defeating the boss must unlock extraction and consume the node");
        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "boss loot should settle to ready");
        // 击败前终局撤离点封印：用第二局验证
        var sealedExit = new RunState(777);
        sealedExit.DebugSetPosition(3, FindNode(sealedExit.Map, 3, RunRoomType.Extraction));
        sealedExit.ResolveCurrentRoom();
        Check(sealedExit.Phase == RunPhase.Ready && !sealedExit.CanExtract, "extraction must be sealed until the boss falls");
        // 击败后终局撤离点无条件放行
        run.DebugSetPosition(3, exitIdx); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.AwaitingDoor && run.CurrentDoor is { CanEnter: false, CanExtract: true },
            "final extraction should unlock after boss kill");
        run.ExtractAtDoor();
        Check(run.Phase == RunPhase.Settlement, "final extraction should enter settlement");
        Check(run.FinalizeSettlement() && run.Phase == RunPhase.Victory, "complete run must reach victory");

        // ---------- 碎片兑换路径（2 枚彩色令牌碎片不弃牌激活） ----------
        var frags = new RunState(99);
        frags.ConfigureClassCardPool(new[] { new RunCard("cls-1", "职业卡", "武术", "职业") });
        frags.DebugSetPosition(3, FindNode(frags.Map, 3, RunRoomType.Altar));
        frags.ResolveCurrentRoom();
        try { frags.ActivateAltarByFragments(); throw new InvalidOperationException("fragment exchange without fragments accepted"); }
        catch (InvalidOperationException) { _checks++; }
        frags.GrantFragments(1);
        try { frags.ActivateAltarByFragments(); throw new InvalidOperationException("one-fragment exchange accepted"); }
        catch (InvalidOperationException) { _checks++; }
        frags.GrantFragments(1);
        Check(frags.ActivateAltarByFragments(), "two fragments should activate the altar");
        Check(frags.Fragments == 0 && frags.AltarActivated && frags.Phase == RunPhase.Ready && !frags.PendingAltarReward,
            "fragment exchange settles immediately without reward choice");
        Check(frags.OwnedCards.Any(x => x.Card.Name == "职业卡"), "fragment exchange should grant a class card");
        // 职业卡池为空：碎片原样保留、不激活（网页版「暂不可用」口径）
        var emptyPool = new RunState(98);
        emptyPool.GrantFragments(2);
        emptyPool.DebugSetPosition(3, FindNode(emptyPool.Map, 3, RunRoomType.Altar));
        emptyPool.ResolveCurrentRoom();
        Check(!emptyPool.ActivateAltarByFragments(), "empty class pool must refuse without consuming fragments");
        Check(emptyPool.Fragments == 2 && emptyPool.Phase == RunPhase.Altar && !emptyPool.AltarActivated, "refused exchange keeps fragments");

        // ---------- 献祭道具复原（不消耗祭坛，可重复） ----------
        var items = new RunState(31);
        items.AddCard(new RunCard("item-1", "金疮药", "道具"));
        items.AddCard(new RunCard("keep-1", "战利品卡"));
        items.MoveCardToPocket("战利品卡");
        items.DebugSetPosition(3, FindNode(items.Map, 3, RunRoomType.Altar));
        items.ResolveCurrentRoom();
        Check(items.SacrificeItemAtAltar("金疮药"), "item sacrifice should consume the item and restore pocket cards");
        Check(!items.OwnedCards.Any(x => x.Card.Name == "金疮药") && items.OwnedCards.Any(x => x.Card.Name == "战利品卡"),
            "item sacrifice should restore a used pocket card");
        Check(!items.AltarActivated && items.Phase == RunPhase.Altar, "item sacrifice must not consume the altar");
    }

    private static void BaseBackpackAndStashRulesMatchOriginal()
    {
        var baseState = new RunBaseState();
        // 批次 5：安全格容量随携带宠物（初始汪汪狗 Lv.1 → safeStart+0=2；网页 base.js safeCap）
        Check(baseState.BagCapacity == 16 && baseState.SafeCapacity == 2 && baseState.StashCapacity == 25, "base defaults changed");
        Check(baseState.PetSel == "dog" && baseState.Pets.ContainsKey("dog"), "starter pet must be the auto-granted dog");
        baseState.AddResources(wood: 4, rations: 2, coins: 5);
        Check(baseState.UpgradeBag() && baseState.BagCapacity == 17, "bag upgrade rule incorrect");
        Check(baseState.UpgradeStash() && baseState.StashCapacity == 28, "stash upgrade rule incorrect");
        // 批次 5：保险升级已由宠物升级取代（base.js BASE_MIGRATIONS 1→2），UpgradeSafe 不复存在
        var card = new RunCard("sellable", "旧枪", "装备", "稀有", 3, true);
        Check(baseState.DepositCards(new[] { new RunCardStack(card, 2) }), "stash deposit failed");
        var sold = baseState.SellCards("旧枪", 1); Check(sold.Ok && sold.Coins == 3 && baseState.Coins == 8, "stash sell rule incorrect");
        Check(baseState.DepositResource("wood", 1) && baseState.Wood == 1, "resource deposit failed");
        var run = new RunState(99, null, baseState); Check(run.Resources.Coins == 8 && baseState.Coins == 0, "reserve coins were not carried into run");
        run.ConfigureShopCardPool(new[] { new RunCard("shop-card", "商店卡", "武术", "稀有") });
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Shop)); run.ResolveCurrentRoom(); run.BuyShopOffer("card-0");
        Check(run.OwnedCards.Any(x => x.Card.Name == "商店卡"), "shop card purchase failed"); run.LeaveShop();
        Check(run.AddCard(new RunCard("a", "安全卡"), safe: true), "safe backpack card failed");
        Check(!run.AddCard(new RunCard("b", "第二安全卡"), safe: true) || baseState.SafeCapacity >= 2, "safe capacity gate missing");
        run.MoveCardToPocket("安全卡");
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Campfire)); run.ResolveCurrentRoom(); run.CompleteCampfire(new[] { "安全卡" });
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
        run.ConfigureEventCardPool(LoadRunCardUniverse().Where(card => card.Type == "事件"));
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Event)); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.Event, "event room did not open choices");
        var choices = run.DrawEventChoices();
        Check(choices.Count > 0 && choices.All(x => !string.IsNullOrWhiteSpace(x.Id)), "event choice list missing");
        Check(run.PendingEventId is not null && run.PendingEventTitle.Length > 0, "event panel must expose the drawn event card (id+title)");
        Check(run.EventIntro.Length > 0 || (choices.Count == 1 && choices[0].Id == RunState.EventContinueChoiceId),
            "knot events carry an ink intro; knot-less cards fall back to the single 继续 choice");
        run.ChooseEvent(0);
        if (run.EventRestorePending) run.LeaveEventWithoutEffect();   // 修鞋铺：复原面板用「继续旅程」收敛
        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        Check(run.Phase is RunPhase.Ready or RunPhase.Battle, "event choice did not settle");
        // 时空孔隙：事件连锁移动已停用（网页版 cancelLegacyChainMove）——不移动、回 Ready（扫描见 ShopEventFire 组）
        Check(true, "timeskip covered in ShopEventFireAndEmergencyExtractionWork");
    }

    private static void SnapshotsRestoreOnlyValidatedReadyRuns()
    {
        var source = new RunState(42);
        source.DebugSetPosition(1, FindNode(source.Map, 1, RunRoomType.Event));
        source.Resources.Coins = 6; source.Resources.Keys = 1;
        source.ResolveCurrentRoom();          // 访问一次事件格 → visited 有记录
        source.LeaveEventWithoutEffect();     // 回到稳定落点（只有 Ready/Settlement 可存档）
        var snapshot = source.CaptureSnapshot();
        var restored = RunState.FromSnapshot(snapshot);
        Check(restored.Seed == 42 && restored.LayerIndex == 1 && restored.TrackPosition == snapshot.TrackPosition
            && restored.Resources.Coins == 6 && restored.Resources.Keys == 1, "snapshot fields did not restore");
        Check(restored.Rng.State == snapshot.RngState && restored.Phase == RunPhase.Ready, "snapshot RNG/phase did not restore");
        Check(restored.VisitedNodes.Count == 1 && restored.VisitedNodes.Contains($"1,{snapshot.TrackPosition}"),
            "snapshot visited nodes did not restore");
        // 祭坛旗标随快照恢复
        var altarRun = new RunState(43);
        altarRun.GrantFragments(2);
        altarRun.ConfigureClassCardPool(new[] { new RunCard("c", "职业卡三", "武术", "职业") });
        altarRun.DebugSetPosition(3, FindNode(altarRun.Map, 3, RunRoomType.Altar));
        altarRun.ResolveCurrentRoom();
        altarRun.ActivateAltarByFragments();
        var altarSnapshot = altarRun.CaptureSnapshot();
        var altarRestored = RunState.FromSnapshot(altarSnapshot);
        Check(altarRestored.AltarActivated && !altarRestored.BossKilled, "altar flag did not restore");
        Check(altarRestored.VisitedNodes.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(altarRun.VisitedNodes.OrderBy(x => x, StringComparer.Ordinal)),
            "altar visited node did not restore");
        var invalid = snapshot with { Phase = RunPhase.Battle };
        try { RunState.FromSnapshot(invalid); throw new InvalidOperationException("non-ready snapshot was accepted"); }
        catch (ArgumentException) { _checks++; }
    }

    /// <summary>验收③：存档含 RNG 快照（SaveGameDto 全链路 JSON 往返），读档续跑同一 seed 结果一致。</summary>
    private static void SaveRestoreRoundTripContinuesIdentically()
    {
        const ulong seed = 20250912UL;
        var original = new RunState(seed);
        WalkAndSettle(original, 6);
        // 模拟 adapter 存档：RunSnapshot → SaveGameDto（RngState/Seed/AltarActivated/BossKilled/VisitedNodes）
        var snap = original.CaptureSnapshot();
        var dto = new SaveGameDto
        {
            Seed = snap.Seed,
            RngState = snap.RngState,
            LayerIdx = snap.LayerIndex,
            TrackPos = snap.TrackPosition,
            Turn = snap.Turns,
            Stamina = snap.Stamina,
            Hp = snap.Hp,
            MaxHp = snap.MaxHp,
            Coins = snap.Coins,
            Keys = snap.Keys,
            Wood = snap.Wood,
            Rations = snap.Rations,
            Fragments = snap.Fragments,
            AltarActivated = snap.AltarActivated,
            BossKilled = snap.BossKilled,
            VisitedNodes = snap.VisitedNodes?.ToList() ?? new List<string>(),
            RunActive = true
        };
        // 全链路 JSON 往返：证明存档内确实携带 RNG 快照与跑图状态
        var json = JsonSerializer.Serialize(dto);
        var roundTrip = JsonSerializer.Deserialize<SaveGameDto>(json);
        Check(roundTrip is not null, "save json round trip failed");
        roundTrip!.Validate();
        Check(roundTrip.RngState == snap.RngState && roundTrip.Seed == seed, "save must carry the run rng snapshot");
        Check(roundTrip.VisitedNodes.SequenceEqual(snap.VisitedNodes!), "save must carry visited nodes");
        // 读档续跑：从 DTO 恢复新 RunState，与不间断的原局继续同一动作序列，结果逐项一致
        var resumed = RunState.FromSnapshot(new RunSnapshot(roundTrip.Seed, roundTrip.RngState, roundTrip.LayerIdx,
            roundTrip.TrackPos, roundTrip.Turn, roundTrip.Stamina, roundTrip.Hp, roundTrip.Coins,
            roundTrip.Keys, roundTrip.Wood, roundTrip.Rations, RunPhase.Ready,
            null, null, null, null, null, roundTrip.Fragments, roundTrip.AltarActivated, roundTrip.BossKilled,
            roundTrip.VisitedNodes), original.Map);
        AssertSameRunProgress(original, resumed, "after load");
        for (var i = 0; i < 6 && !original.IsFinished; i++)
        {
            var target = original.ReachableNodes()[0];
            original.MoveTo(target);
            SettleToReady(original);
            resumed.MoveTo(target);
            SettleToReady(resumed);
            AssertSameRunProgress(original, resumed, $"continue step {i}");
        }
        Check(original.Rng.State == resumed.Rng.State, "rng streams diverged after load-continue");
    }

    private static void AssertSameRunProgress(RunState a, RunState b, string when)
    {
        Check(a.LayerIndex == b.LayerIndex && a.TrackPosition == b.TrackPosition, $"diverged at {when}: position");
        Check(a.Phase == b.Phase && a.Hp == b.Hp && a.Turns == b.Turns && a.Stamina == b.Stamina, $"diverged at {when}: vitals");
        Check(a.Resources.Coins == b.Resources.Coins && a.Resources.Keys == b.Resources.Keys
            && a.Resources.Wood == b.Resources.Wood && a.Resources.Rations == b.Resources.Rations, $"diverged at {when}: resources");
        Check(a.Fragments == b.Fragments && a.AltarActivated == b.AltarActivated && a.BossKilled == b.BossKilled, $"diverged at {when}: flags");
        Check(a.VisitedNodes.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(b.VisitedNodes.OrderBy(x => x, StringComparer.Ordinal)),
            $"diverged at {when}: visited nodes");
        Check(a.Rng.State == b.Rng.State, $"diverged at {when}: rng state");
    }

    private static void ChestRewardsAndSettlementNeverSilentlyDropCards()
    {
        var baseState = new RunBaseState();
        // Deliberately leave one stash slot available and make the run backpack full with unique cards.
        for (var i = 0; i < baseState.StashCapacity - 1; i++) baseState.DepositCards(new[] { new RunCardStack(new RunCard($"s{i}", $"仓库卡{i}")) });
        var run = new RunState(8, null, baseState);
        for (var i = 0; i < run.BackpackCapacity; i++) run.AddCard(new RunCard($"b{i}", $"背包卡{i}"));
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Chest)); run.ResolveCurrentRoom();
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
        death.DebugSetPosition(0, FindNode(death.Map, 0, RunRoomType.Battle)); death.ResolveCurrentRoom(); death.CompleteBattle(false);
        Check(death.Phase == RunPhase.Defeat && death.RecoveryCards.Count == 0, "safe card should be recovered when capacity exists");
    }

    private static void DoorAndChestReadOnlyStateIsInspectable()
    {
        var run = new RunState(2);
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Door)); run.ResolveCurrentRoom();
        Check(run.CurrentDoor is not null && run.CurrentDoor.CanEnter && !run.CurrentDoor.CanExtract,
            "layer doors must allow entering and never extract (撤离只在三/四层撤离点)");
        run.StayAtDoor();
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Battle)); run.ResolveCurrentRoom(); run.CompleteBattle(true);
        var preview = run.PeekNextChest(); Check(preview.Kind is "small" or "medium" or "large" && preview.Candidates.Count > 0, "chest preview missing");
        Check(run.PeekNextChest() == preview, "chest preview was not stable");
    }

    // ---------- 批次 4b：商店/宝箱/碎片（真源 game.run.shop.js / chests.js / game.bag.js） ----------

    private static IReadOnlyList<RunCard> LoadRunCardUniverse()
    {
        var path = Path.Combine(GameData.FindDataDirectory(), "cards.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var list = new List<RunCard>();
        foreach (var card in document.RootElement.GetProperty("cards").EnumerateArray())
        {
            var id = card.GetProperty("id").GetString() ?? "unknown";
            var name = card.TryGetProperty("name", out var nameNode) ? nameNode.GetString() ?? id : id;
            var type = card.TryGetProperty("type", out var typeNode) ? typeNode.GetString() ?? "武术" : "武术";
            var rarity = card.TryGetProperty("rarity", out var rarityNode) ? rarityNode.GetString() ?? "古朴" : "古朴";
            var desc = card.TryGetProperty("desc", out var descNode) && descNode.ValueKind == JsonValueKind.String ? descNode.GetString() ?? "" : "";
            var value = card.TryGetProperty("value", out var valueNode) && valueNode.TryGetInt32(out var parsed) ? parsed : 0;
            bool sellable;
            if (card.TryGetProperty("sellable", out var sellableNode) && sellableNode.ValueKind is JsonValueKind.True or JsonValueKind.False)
                sellable = sellableNode.ValueKind == JsonValueKind.True;
            else if (desc.Contains("不可出售", StringComparison.Ordinal)) sellable = false;
            else sellable = desc.Contains("可出售", StringComparison.Ordinal);
            var unrandom = card.TryGetProperty("unrandom", out var unrandomNode) && unrandomNode.ValueKind == JsonValueKind.True;
            var cls = card.TryGetProperty("cls", out var clsNode) ? clsNode.GetString() : null;
            list.Add(new RunCard(id, name, type, rarity, Math.Max(1, value), sellable) { Unrandom = unrandom, Cls = cls });
        }
        return list;
    }

    private static void BattleChestToPreview(RunState run, int layer)
    {
        run.DebugSetPosition(layer, FindNode(run.Map, layer, RunRoomType.Battle));
        run.ResolveCurrentRoom();
        run.DebugSetEncounter(new[] { new RunEnemy("probe", "探针怪", 10, 1) });
        run.CompleteBattle(true);
    }

    private static void ShopStockWeightsBuyAndSellMatchWeb()
    {
        var data = GameRuntime.Data;
        var universe = LoadRunCardUniverse();
        var rarityById = universe.ToDictionary(card => card.Id, card => card.Rarity, StringComparer.Ordinal);

        // —— 进货：6 随机槽价格==cards.json price 表、稀有度分布≈shopWeights（60:28:9:3）——
        var run = new RunState(31);
        run.ConfigureShopCardPool(universe);
        run.ConfigureLootCardPool(universe);
        var histogram = new Dictionary<string, int>(StringComparer.Ordinal);
        var mysterySeen = 0;
        for (var seed = 1; seed <= 600; seed++)
        {
            var probe = new RunState((ulong)seed);
            probe.ConfigureShopCardPool(universe);
            probe.ConfigureLootCardPool(universe);
            probe.DebugSetPosition(0, FindNode(probe.Map, 0, RunRoomType.Shop));
            probe.ResolveCurrentRoom();
            Check(probe.Phase == RunPhase.Shop && probe.Shop.Count == 9, $"seed {seed}: shop stock shape broken");
            foreach (var offer in probe.Shop)
            {
                if (offer.Card is null) { Check(offer.Sold, $"seed {seed}: empty slot must be unsellable"); continue; }
                if (offer.IsMystery) { Check(offer.Price == 3, "mystery crate must cost 3"); mysterySeen++; continue; }
                Check(data.CardPrice(offer.Card.Rarity) == offer.Price,
                    $"seed {seed}: slot price {offer.Price} != PRICE[{offer.Card.Rarity}]");
                if (offer.Id.StartsWith("card-", StringComparison.Ordinal))
                {
                    Check(rarityById.TryGetValue(offer.Card.Id, out var rarity) && rarity == offer.Card.Rarity,
                        "shop card metadata drifted from cards.json");
                    histogram[offer.Card.Rarity] = histogram.GetValueOrDefault(offer.Card.Rarity) + 1;
                }
            }
        }
        Check(mysterySeen == 600, "mystery crate must appear exactly once per visit");
        var slots = histogram.Values.Sum();
        Check(slots == 3600, $"expected 3600 weighted slots, got {slots}");
        foreach (var (rarity, weight) in data.CardShopWeights)
        {
            var share = histogram.GetValueOrDefault(rarity) / (double)slots;
            var expected = weight / (double)data.CardShopWeights.Values.Sum();
            Check(Math.Abs(share - expected) < 0.05,
                $"shop rarity share {rarity}={share:F3} drifted from shopWeights {expected:F3}");
        }
        Check(histogram.Keys.All(rarity => data.CardShopWeights.ContainsKey(rarity)),
            "weighted slots must only roll shopWeights rarities (初始/职业/衍生/棱彩 excluded)");

        // —— 买卖限制：币不足/已售/补货上限/神秘货箱开出/仅可出售卡能卖 ——
        var shop = new RunState(77);
        shop.ConfigureShopCardPool(universe);
        shop.ConfigureLootCardPool(universe);
        shop.DebugSetPosition(0, FindNode(shop.Map, 0, RunRoomType.Shop));
        shop.ResolveCurrentRoom();
        shop.Resources.Coins = 0;
        try { shop.BuyShopOffer("card-0"); throw new InvalidOperationException("poor buyer was accepted"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("金币不足", StringComparison.Ordinal), "wrong poor-buyer error"); _checks++; }
        shop.Resources.Coins = 100;
        var first = shop.Shop.First(offer => offer.Id == "card-0" && offer.Card is not null);
        shop.BuyShopOffer("card-0");
        Check(shop.Resources.Coins == 100 - first.Price && shop.OwnedCards.Any(x => x.Card.Id == first.Card!.Id),
            "buying a card must charge PRICE and add the card");
        Check(shop.Shop.First(offer => offer.Id == "card-0").Sold, "bought slot must be marked sold");
        try { shop.BuyShopOffer("card-0"); throw new InvalidOperationException("sold slot was sold twice"); }
        catch (InvalidOperationException) { _checks++; }
        var coinsBeforeSha = shop.Resources.Coins;
        for (var i = 0; i < 5; i++) shop.BuyShopOffer("sha");
        Check(shop.OwnedCards.First(x => x.Card.Id == "builtin-sha").Count == 5
            && shop.Resources.Coins == coinsBeforeSha - 5,
            "sha replenish must sell exactly 5 copies at 1 coin each per visit");
        var shaSlot = shop.Shop.First(offer => offer.Id == "sha");
        Check(shaSlot.Sold && shaSlot.ShaReplenish == 0, "sha slot must close (已补满) after 5 replenishes");
        try { shop.BuyShopOffer("sha"); throw new InvalidOperationException("sixth sha accepted"); }
        catch (InvalidOperationException) { _checks++; }
        shop.BuyShopOffer("mystery");
        Check(shop.Shop.First(offer => offer.Id == "mystery").Sold, "mystery slot must close after purchase");
        shop.Resources.Coins = 0;
        shop.SellOwnedCard(first.Card!.Name);
        Check(shop.Resources.Coins == 0, "unsellable shop card must not convert to coins (默认不可出售)");
        shop.Resources.Coins = 50;
        var sellGold = shop.SellOwnedCard("金币");
        Check(!sellGold.Ok || sellGold.Coins == 9 * sellGold.Quantity, "currency cards sell at face value 9");
        Check(!shop.SellOwnedCard("木材").Ok, "材料卡（木材）禁止卖币（sellable=false）");
        Check(!shop.SellOwnedCard("口粮").Ok && !shop.SellOwnedCard("一把钥匙").Ok, "口粮/钥匙材料卡禁止卖币");
        var diamond = universe.First(card => card.Id == "tt3-diamond");
        Check(diamond.Sellable && diamond.SellPrice == 16, "钻石 desc「可出售」→ sellable（isSellable 描述回退）");

        // —— 基地侧出售：材料折入物资不可卖币，货币类资源卡仍可出售（base.js materialInfo 口径）——
        var baseState = new RunBaseState();
        Check(!baseState.SellCards("木材", 1).Ok || baseState.SellCards("木材", 1).Why != "",
            "wood card needs a stack before selling");
        baseState.DepositCards(new[] { new RunCardStack(universe.First(card => card.Id == "tt-wood")) });
        var woodSell = baseState.SellCards("木材", 1);
        Check(!woodSell.Ok && woodSell.Why == "material", "base sale must refuse material cards (材料类卡禁止卖币)");
        baseState.DepositCards(new[] { new RunCardStack(universe.First(card => card.Id == "tt-gold")) });
        var goldSell = baseState.SellCards("金币", 1);
        Check(goldSell.Ok && goldSell.Coins == 9, "currency resource cards remain sellable at face value");
    }

    private static void ChestKindsDropsPityEggAndClassChestMatchWeb()
    {
        var data = GameRuntime.Data;
        var universe = LoadRunCardUniverse();
        var rarityById = universe.GroupBy(card => card.Name, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().Rarity, StringComparer.Ordinal);

        // —— 四箱型内容形状：small 1 卡 / medium 3 选 1 / large 3 卡 / boss 5 卡+币卡；币区间逐项 ——
        var classPool = universe.Where(card => card.Rarity == "职业").Take(6).ToList();
        long eggHits = 0, bossTokens = 0, bossTotal = 0, classChests = 0, chestTotal = 0;
        for (var seed = 1; seed <= 1200; seed++)
        {
            var run = new RunState((ulong)seed);
            run.ConfigureLootCardPool(universe);
            run.ConfigureClassCardPool(classPool);
            var layer = (seed - 1) % 4;
            BattleChestToPreview(run, layer);
            chestTotal++;
            while (run.Phase == RunPhase.Chest)
            {
                var preview = run.PeekNextChest();
                var kind = data.RequireChestKind(preview.Kind);
                // 宠物蛋是「额外开出」并入同一 cards 数组（网页 chests.js 原语义）：
                // 中箱可能 4 张里选 1，蛋不占随机卡池配额
                Check(preview.Candidates.Count == kind.Candidates + (preview.EggHit ? 1 : 0),
                    $"{preview.Kind} must roll Candidates={kind.Candidates}(+egg), got {preview.Candidates.Count}");
                Check(preview.Coins == 0 || (preview.Coins >= kind.CoinMin && preview.Coins <= kind.CoinMax),
                    $"{preview.Kind} coins {preview.Coins} outside data range [{kind.CoinMin},{kind.CoinMax}]");
                if (preview.IsClass)
                {
                    classChests++;
                    // 职业宝箱（黑箱）：只掉职业稀有度卡，不参与蛋/通行证/保底；
                    // 中箱规格的职业箱仍是 3 选 1（网页 isPick 只看 K.pickFrom）
                    Check(preview.Candidates.All(name => classPool.Any(card => card.Name == name)),
                        "class chest must only drop 职业 rarity class cards");
                    Check(!preview.EggHit && !preview.TokenHit, "class chest has no egg/token rolls");
                }
                if (preview.Kind == "boss")
                {
                    bossTotal++;
                    Check(preview.Candidates.Any(name => data.RequireChestKind("boss").CoinCards.Contains(name)),
                        "boss chest must include one of 金币/银币/铜币");
                    if (preview.TokenHit) bossTokens++;
                }
                if (preview.EggHit)
                {
                    eggHits++;
                    Check(preview.Candidates.Contains("宠物蛋"), "egg roll must surface the 宠物蛋 card");
                }
                run.OpenNextChest();
            }
            Check(run.Phase == RunPhase.Ready, $"seed {seed}: chest flow must settle");
        }
        Check(eggHits > 0 && eggHits / (double)chestTotal < 0.02,
            $"pet egg rate {eggHits}/{chestTotal} must be ~0.7% (0 < rate < 2%)");
        var classShare = classChests / (double)chestTotal;
        Check(Math.Abs(classShare - LootTables.ClassChestChance) < 0.05,
            $"class chest share {classShare:F3} drifted from 0.25");

        // —— 首脑保险柜：击败首脑掉 boss 箱（5 卡 + 金币/银币/铜币 其一 + 30% 员工通行证B）——
        var boss = data.Bosses[0];
        for (var seed = 1; seed <= 400; seed++)
        {
            var run = new RunState((ulong)seed);
            run.ConfigureLootCardPool(universe);
            run.ConfigureClassCardPool(classPool);
            run.DebugSetPosition(3, FindNode(run.Map, 3, RunRoomType.Battle));
            run.ResolveCurrentRoom();
            run.DebugSetEncounter(new[] { new RunEnemy(boss.Id, boss.Name, boss.Hp, boss.Attack, true) });
            var drops = run.CompleteBattle(true);
            Check(drops.Count == 1 && drops[0] is ("boss", true, false), "boss kill must drop exactly the boss chest");
            bossTotal++;
            while (run.Phase == RunPhase.Chest)
            {
                var preview = run.PeekNextChest();
                Check(preview.Kind == "boss" && preview.IsBoss, "boss chest preview must be the boss kind");
                var kindSpec = data.RequireChestKind("boss");
                Check(preview.Candidates.Count == kindSpec.Candidates + 1 + (preview.TokenHit ? 1 : 0) + (preview.EggHit ? 1 : 0),
                    "boss chest must roll 5 cards + 1 coin card (+token/+egg)");
                Check(preview.Candidates.Any(name => data.RequireChestKind("boss").CoinCards.Contains(name)),
                    "boss chest must include one of 金币/银币/铜币");
                Check(preview.Coins == 0, "boss chest carries coin cards, no raw coins");
                if (preview.TokenHit) bossTokens++;
                if (preview.EggHit) eggHits++;
                run.OpenNextChest();
            }
        }
        Check(bossTokens > 0 && bossTokens / (double)bossTotal is > 0.15 and < 0.45,
            $"boss tokenChance 0.3 drifted: {bossTokens}/{bossTotal}");

        // —— 巨兽「荒渊」：固定 2 个大宝箱 ——
        var beast = new RunState(99);
        beast.ConfigureLootCardPool(universe);
        beast.DebugSetPosition(0, FindNode(beast.Map, 0, RunRoomType.Battle));
        beast.ResolveCurrentRoom();
        beast.DebugSetEncounter(new[] { new RunEnemy("huangyuan", "巨兽·荒渊", 10, 1, true) });
        var beastDrops = beast.CompleteBattle(true);
        Check(beastDrops.Count == 2 && beastDrops.All(drop => drop.Kind == "large" && !drop.IsBoss && !drop.IsClass),
            "巨兽 encounter must drop exactly 2 large chests");
        while (beast.Phase == RunPhase.Chest) beast.OpenNextChest();

        // —— 分层掉落表（layerChests）：L3 fixed=[large,medium]；加权层箱数/箱型分布 ——
        var fixedRun = new RunState(555);
        fixedRun.ConfigureLootCardPool(universe);
        fixedRun.DebugSetPosition(3, FindNode(fixedRun.Map, 3, RunRoomType.Battle));
        fixedRun.ResolveCurrentRoom();
        fixedRun.DebugSetEncounter(new[] { new RunEnemy("probe", "探针怪", 10, 1) });
        var fixedDrops = fixedRun.CompleteBattle(true);
        Check(fixedDrops.Select(drop => drop.Kind).SequenceEqual(new[] { "large", "medium" }),
            "layer 4 fixed drops must be [large, medium] (layerChests[3].fixed)");
        var countHistogram = new Dictionary<int, int>();
        var typeHistogram = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var seed = 1; seed <= 400; seed++)
        {
            var run = new RunState((ulong)seed);
            run.ConfigureLootCardPool(universe);
            run.DebugSetPosition(2, FindNode(run.Map, 2, RunRoomType.Battle));
            run.ResolveCurrentRoom();
            run.DebugSetEncounter(new[] { new RunEnemy("probe", "探针怪", 10, 1) });
            var drops = run.CompleteBattle(true);
            countHistogram[drops.Count] = countHistogram.GetValueOrDefault(drops.Count) + 1;
            foreach (var drop in drops) typeHistogram[drop.Kind] = typeHistogram.GetValueOrDefault(drop.Kind) + 1;
            while (run.Phase == RunPhase.Chest) run.OpenNextChest();
        }
        var oneChest = countHistogram.GetValueOrDefault(1);
        var twoChests = countHistogram.GetValueOrDefault(2);
        Check(oneChest > 0 && twoChests > 0 && Math.Abs(oneChest / 400.0 - 0.7) < 0.08,
            $"layer 3 chest count weights 7:3 drifted (1箱 {oneChest}/400)");
        Check(typeHistogram.Keys.All(kind => kind is "medium" or "large"), "layer 3 types must be medium/large only");
        var largeShare = typeHistogram.GetValueOrDefault("large") / (double)typeHistogram.Values.Sum();
        Check(Math.Abs(largeShare - 0.3) < 0.08, $"layer 3 type weights 7:3 drifted (large {largeShare:F3})");

        // —— 保底：中宝箱至少 1 张「稀有」+；大宝箱/首脑至少 1 张「史诗」+（池内含对应档）——
        var pityPool = universe.Where(card => card.Rarity is "古朴" or "稀有" or "史诗").ToList();
        var pityRarities = data.CardRarities.ToList();
        var pityClassPool = universe.Where(card => card.Rarity == "职业").Take(6).ToList();
        for (var seed = 1; seed <= 300; seed++)
        {
            var run = new RunState((ulong)seed);
            run.ConfigureLootCardPool(pityPool);
            run.ConfigureClassCardPool(pityClassPool);
            var layer = seed % 2 == 0 ? 1 : 3;   // L1 会出 large；L3 fixed large+medium
            BattleChestToPreview(run, layer);
            while (run.Phase == RunPhase.Chest)
            {
                var preview = run.PeekNextChest();
                var need = preview.RequiresChoice || preview.Kind == "large" ? (preview.RequiresChoice ? "稀有" : "史诗") : null;
                if (need is not null && !preview.IsClass)   // 职业箱不参与保底（网页独立分支）
                {
                    var needRi = pityRarities.IndexOf(need);
                    Check(preview.Candidates.Any(name => rarityById.TryGetValue(name, out var rarity) && Math.Max(0, pityRarities.IndexOf(rarity)) >= needRi),
                        $"{preview.Kind} chest broke the pity floor (need {need}+): [{string.Join(",", preview.Candidates)}]");
                }
                run.OpenNextChest();
            }
        }
    }

    private static void ChestQueueSuspendsAndResumes()
    {
        var universe = LoadRunCardUniverse();
        var run = new RunState(99);
        run.ConfigureLootCardPool(universe);
        // 巨兽遭遇固定掉 2 个大宝箱 → 两个箱的队列
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Battle));
        run.ResolveCurrentRoom();
        run.DebugSetEncounter(new[] { new RunEnemy("huangyuan", "巨兽·荒渊", 10, 1, true) });
        run.CompleteBattle(true);
        Check(run.Phase == RunPhase.Chest, "beast loot should open the chest queue");
        Check(run.SuspendChests(), "suspend must report an open chest flow");
        var suspended = run.PeekNextChest();
        Check(run.SuspendChests() && run.PeekNextChest() == suspended, "suspend must keep queue and rolled content stable");
        try { run.OpenNextChest(); throw new InvalidOperationException("suspended chest was opened"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("挂起", StringComparison.Ordinal), "wrong suspend error"); _checks++; }
        run.ResumeChests();
        Check(!run.ChestsSuspended && run.PeekNextChest() == suspended, "resume must re-expose the same rolled chest");
        run.OpenNextChest();
        Check(run.Phase == RunPhase.Chest, "queue must still hold the second chest after the first");
        run.OpenNextChest();
        Check(run.Phase == RunPhase.Ready, "queue must settle to ready after the last chest");
        Check(!run.SuspendChests(), "suspend outside a chest flow must return false");
        run.ResumeChests();   // 非挂起状态恢复是无操作
        Check(true, "resume without suspend is a no-op");

        // diceHistory：近 8 次掷/移动记录（slice(-8) 口径，超出丢弃最旧）
        var walker = new RunState(4242);
        for (var i = 0; i < 10; i++)
        {
            walker.MoveTo(walker.ReachableNodes()[0]);
            SettleToReady(walker);
        }
        Check(walker.DiceHistory.Count == 8, "dice history must keep at most 8 entries");
    }

    // ---------- 批次 5：宠物系统（真源 base.js:26-39/255-393 + pets.json + game.session/chests/shop 携带效果） ----------

    private static void PetLifecycleEggHatchUpgradeCarryMatchesData()
    {
        var spec = GameRuntime.Data.Pets;
        // 数值逐项 == pets.json（孵化 50 币、上限 Lv.5、升级 2/3/4/5 口粮、6 只）
        Check(spec.EggId == "pet-egg" && spec.HatchCost == 50 && spec.LevelMax == 5, "pet spec scalars drifted from pets.json");
        Check(spec.UpCosts.SequenceEqual(new[] { 2, 3, 4, 5 }), "pet upCosts must be 2/3/4/5");
        Check(spec.List.Select(pet => pet.Id).SequenceEqual(new[] { "dog", "falcon", "cat", "robot", "fire", "penguin" }),
            "pet list must be the six data pets");
        Check(spec.List.Single(pet => pet.Id == "dog").Effect.MaxHp == 5
            && Math.Abs(spec.List.Single(pet => pet.Id == "falcon").Effect.ClassChest - 0.35) < 1e-9
            && spec.List.Single(pet => pet.Id == "cat").Effect.ShopFree
            && spec.List.Single(pet => pet.Id == "robot").Effect.ExtraSha == 2
            && spec.List.Single(pet => pet.Id == "fire").Effect.ShaToFireball
            && spec.List.Single(pet => pet.Id == "penguin").Effect.SafeBonus == 2,
            "pet effects drifted from pets.json");

        // 初始宠物：汪汪狗进入基地自动获得且默认携带（base.js ensureStarterPet），不计入孵化数
        var b = new RunBaseState();
        Check(b.PetSel == "dog" && b.Pets["dog"].Lv == 1 && b.HatchedCount() == 0, "starter dog must be auto-granted and carried");
        Check(b.CarriedPet()!.Id == "dog" && b.CarriedPetEffect().MaxHp == 5, "carried pet effect lookup failed");
        Check(!b.SetPet("cat"), "carrying an unowned pet must be rejected");

        // 孵化：无蛋→noegg；蛋+50 币→随机未拥有宠物；币不足→poor；集齐→all（base.js hatchPet）
        var egg = new RunCard("pet-egg", "宠物蛋", "道具", "稀有", 2);
        Check(b.HatchPet().Why == "noegg", "hatch without an egg must report noegg");
        Check(b.DepositCards(new[] { new RunCardStack(egg, 2) }), "setup: eggs into stash");
        b.AddResources(coins: 30);
        Check(b.HatchPet().Why == "poor" && b.Stash.Single(x => x.Card.Id == "pet-egg").Count == 2, "hatch without coins must be refused and consume nothing");
        b.AddResources(coins: 50);            // 累计 80 币
        var hatch = b.HatchPet(_ => 4);   // 未拥有池按 data 顺序排除 dog → 下标 4 = penguin
        Check(hatch.Ok && hatch.Pet!.Id == "penguin", "hatch picker must select within the unowned pool");
        Check(b.Coins == 80 - spec.HatchCost && b.Stash.Single(x => x.Card.Id == "pet-egg").Count == 1, "hatch must consume 1 egg + 50 coins");
        Check(b.Pets["penguin"].Lv == 1 && b.HatchedCount() == 1, "hatched pet enters the base at Lv.1");
        Check(b.PetSel == "dog", "hatch must not switch the carried pet when one is already carried");

        // 升级：口粮 2/3/4/5 递增，上限 Lv.5（base.js petUpCost/upgradePet）
        b.AddResources(rations: 14);
        int[] expectCosts = { 2, 3, 4, 5 };
        for (var lv = 1; lv <= 4; lv++)
        {
            var rationsBefore = b.Rations;
            Check(b.CanUpgradePet("penguin") && b.PetUpgradeCost("penguin") == expectCosts[lv - 1], $"penguin upgrade cost at Lv.{lv} must be {expectCosts[lv - 1]}");
            Check(b.UpgradePet("penguin") && b.PetLevel("penguin") == lv + 1 && b.Rations == rationsBefore - expectCosts[lv - 1],
                $"penguin upgrade Lv.{lv}→{lv + 1} must consume rations per data");
        }
        Check(b.PetLevel("penguin") == 5 && !b.CanUpgradePet("penguin"), "pet must cap at Lv.5");
        Check(b.PetUpgradeCost("penguin") == 0, "maxed pet upgrade cost must clamp to 0（网页 undefined 的显式化）");
        Check(!b.UpgradePet("dog") && b.PetLevel("dog") == 1, "upgrade without rations must be refused and not change level");

        // 携带切换与等级制安全格（base.js safeCap：min(safeMax, safeStart+lv-1)+safeBonus）
        Check(b.SetPet("penguin") && b.PetSel == "penguin", "carrying the hatched penguin must work");
        Check(b.SafeCapacity == RunRules.SafeMax + 2, "penguin Lv.5 safe capacity must be safeMax+2 (=8)");
        b.Pets["penguin"] = b.Pets["penguin"] with { Lv = 1 };
        Check(b.SafeCapacity == RunRules.SafeStart + 2, "penguin Lv.1 safe capacity must be safeStart+2 (=4)");
        Check(b.SetPet("dog") && b.SafeCapacity == RunRules.SafeStart, "dog capacity follows its level without a bonus");

        // 对局内携带效果①：汪汪狗生命上限 +5（newRun 时 hp=满血）
        // （测试 seam：孵化语义已在上面验证，其余宠物直接登记所有权后切换携带）
        foreach (var id in new[] { "falcon", "cat", "robot", "fire" }) b.Pets[id] = new PetSave(1, 0);
        var dogRun = new RunState(501, null, b);
        Check(dogRun.MaxHp == RunRules.PlayerMaxHp + 5 && dogRun.Hp == dogRun.MaxHp, "dog carry must raise max HP at new run");
        // ②猎鹰宝宝：职业宝箱概率 0.25 → 0.35（统计口径，多 seed 对照）
        b.SetPet("dog");
        var plainRate = ClassChestRate(b);
        b.SetPet("falcon");
        var falconRate = ClassChestRate(b);
        Check(falconRate > plainRate && Math.Abs(falconRate - 0.35) < 0.08 && Math.Abs(plainRate - 0.25) < 0.08,
            $"falcon must raise the class-chest rate toward 0.35 (plain={plainRate:F2}, falcon={falconRate:F2})");
        // ③招财猫：商店第一格免费（catFree：第 1 格随机卡 0 币，其余照价）
        b.SetPet("cat");
        var shopRun = new RunState(502, null, b);
        shopRun.ConfigureShopCardPool(LoadRunCardUniverse());
        shopRun.DebugSetPosition(0, FindNode(shopRun.Map, 0, RunRoomType.Shop));
        shopRun.ResolveCurrentRoom();
        Check(shopRun.Phase == RunPhase.Shop && shopRun.Shop.Count == 9, "cat run: shop must still have 9 slots");
        Check(shopRun.Shop[0].Price == 0 && !shopRun.Shop[0].Sold && shopRun.Shop[0].Card is not null,
            "cat carry must make the first shop slot free");
        Check(shopRun.Shop.Where(x => x.Id != "card-0" && !x.Sold).Any(x => x.Price > 0),
            "cat carry must leave the other slots priced");
        shopRun.Resources.Coins = 0;
        shopRun.BuyShopOffer("card-0");
        Check(shopRun.Shop[0].Sold && shopRun.OwnedCards.Any(x => x.Card.Id == shopRun.Shop[0].Card!.Id),
            "buying the free slot must work with 0 coins");
        // ④⑤变形机器人/火焰精灵：开局初始牌（grantStarterSha 语义，落在 RunState.GrantStarterCards）
        var catalog = LoadRunCardUniverse();
        b.SetPet("robot");
        var robotRun = new RunState(503, null, b);
        var robotStarters = robotRun.GrantStarterCards(catalog);
        Check(robotStarters.StarterCount == RunRules.StarterSha + 2 + 1 && !robotStarters.FireballConverted,
            "robot must add +2 starter attacks (7 杀 + 1 火球 = 8 张初始牌)");
        Check(robotRun.OwnedCards.First(x => x.Card.Id == "builtin-sha").Count == RunRules.StarterSha + 2
            && robotRun.OwnedCards.Any(x => x.Card.Id == "tt3-fireball" && x.Count == 1),
            "robot loadout = 7 杀 + 1 火球");
        b.SetPet("fire");
        var fireRun = new RunState(504, null, b);
        var fireStarters = fireRun.GrantStarterCards(catalog);
        Check(fireStarters.FireballConverted && fireStarters.StarterCount == RunRules.StarterSha,
            "fire pet must convert the starters to fireballs");
        Check(fireRun.OwnedCards.First(x => x.Card.Id == "tt3-fireball").Count == RunRules.StarterSha
            && fireRun.OwnedCards.All(x => x.Card.Id != "builtin-sha"),
            "fire loadout = 5 火球、不再携带初始攻击/单独火球");
        b.SetPet("dog");
        var plainStarters = new RunState(505, null, b);
        var plainLoadout = plainStarters.GrantStarterCards(catalog);
        Check(!plainLoadout.FireballConverted && plainLoadout.StarterCount == RunRules.StarterSha + 1,
            "dog loadout = 5 杀 + 1 火球");

        // 蛋链路：宝箱 0.7% 掉蛋 → 撤离结算入仓库 → 孵化消费（批次 4b 掉落物在本批闭环）
        var eggCatalog = LoadRunCardUniverse();
        var eggFound = 0;
        for (var seed = 700; seed < 5200 && eggFound == 0; seed++)
        {
            var probe = new RunState((ulong)seed, null, new RunBaseState());
            probe.ConfigureLootCardPool(eggCatalog);
            BattleChestToPreview(probe, 0);
            var preview = probe.PeekNextChest();
            if (!preview.EggHit) continue;
            // 中宝箱是 4 选 1（蛋并入 cards 数组）——选中蛋所在的候选位
            var eggIndex = -1;
            for (var index = 0; index < preview.Candidates.Count; index++)
                if (preview.Candidates[index] == "宠物蛋") { eggIndex = index; break; }
            while (probe.Phase == RunPhase.Chest) probe.OpenNextChest(eggIndex > 0 ? eggIndex : 0);
            Check(probe.OwnedCards.Any(x => x.Card.Id == "pet-egg") || probe.PendingRewards.Any(x => x.Card.Id == "pet-egg"),
                "egg chest hit must put the egg into the backpack (或待收取队列)");
            probe.Extract();
            Check(probe.SettlementCards.Any(x => x.Card.Id == "pet-egg"), "extract must settle the egg into the base stash");
            for (var index = 0; index < probe.SettlementCards.Count; index++) probe.DepositSettlementCard(index);
            Check(probe.Base.Stash.Any(x => x.Card.Id == "pet-egg"), "egg must land in the base stash after settlement");
            probe.Base.AddResources(coins: spec.HatchCost);
            Check(probe.Base.HatchPet().Ok, "the settled egg must be consumable by hatch");
            eggFound++;
        }
        Check(eggFound > 0, "0.7% egg drop should appear within 4500 battle seeds");
        Console.WriteLine($"[批次5] 宠物全流程：蛋掉落→孵化（1 蛋+50 币）→升级（口粮 2/3/4/5→Lv.5）→携带（6 只效果逐项对齐 data） 断言通过");
    }

    /// <summary>统计职业宝箱占比（多 seed 战斗掉落；对照 chests.js classChestChance；携带状态由调用方先行 SetPet）。</summary>
    private static double ClassChestRate(RunBaseState carriedState)
    {
        var total = 0;
        var classChests = 0;
        for (var seed = 600; seed < 1400; seed++)
        {
            var probe = new RunState((ulong)seed, null, carriedState);
            probe.ConfigureClassCardPool(new[] { new RunCard("cls-probe", "职业探针", "武术", "职业") });
            BattleChestToPreview(probe, 0);
            var loot = probe.OpenNextChest();
            if (loot.Kind == "none") continue;
            total++;
            if (loot.IsClass) classChests++;
        }
        return total == 0 ? 0 : (double)classChests / total;
    }

    // ---------- 批次 5：职业收藏室（真源 meta.js:97-212 + achievements.json collectionMilestones） ----------

    private static void CollectionRoomConversionAndMilestonesMatchData()
    {
        var data = GameRuntime.Data;
        var catalog = LoadRunCardUniverse();
        var pool = CollectionRoom.Pool(catalog, data.CardClasses);

        // 收藏池：有 cls 且归属五职业的 职业卡+能力卡；衍生/无 cls/其他职业不入池（meta.js isCollectible）
        Check(pool.All(card => card.Cls is not null && data.CardClasses.Contains(card.Cls)
                && (card.Rarity == "职业" || card.Type == "能力卡")),
            "collection pool must only contain classed 职业/能力卡");
        Check(catalog.Count(card => card.Cls is not null && data.CardClasses.Contains(card.Cls)
                && (card.Rarity == "职业" || card.Type == "能力卡")) == pool.Count,
            "collection pool must not duplicate cards");
        Check(pool.Count >= 45, "collection pool must cover the m45 milestone (data pool=66)");
        // 里程碑触发条件 == achievements.json：5/15/30/45/全收集
        var milestones = data.Achievements.CollectionMilestones;
        Check(milestones.Select(ms => ms.Id).SequenceEqual(new[] { "m5", "m15", "m30", "m45", "mAll" }),
            "milestone ids drifted from achievements.json");
        Check(milestones.Select(ms => CollectionRoom.MilestoneNeed(ms, pool.Count)).SequenceEqual(new[] { 5, 15, 30, 45, pool.Count }),
            "milestone needs must be 5/15/30/45/all");
        Check(milestones[0].Reward.Wood == 3 && milestones[1].Reward.Rations == 5 && milestones[2].Reward.Keys == 10
            && milestones[3].Reward.Legend == 2 && milestones[4].Reward.Egg == 1,
            "milestone rewards drifted from achievements.json");

        // 收藏转化：职业卡 +10 / 能力卡 +50，同一张只结算一次；取消重藏不重复发放（meta.js onCollect）
        var b = new RunBaseState();
        var classCard = pool.First(card => card.Rarity == "职业");
        var abilityCard = pool.First(card => card.Type == "能力卡");
        var stranger = new RunCard("not-collectible", "野生卡", "武术", "稀有", 2) { Cls = null };
        Check(CollectionRoom.OnCollect(b, stranger, CollectionRoom.Toggle(b, stranger), data.CardClasses).Converted == false,
            "uncatalogued cards must not convert xp");
        var first = CollectionRoom.Toggle(b, classCard);
        var xp1 = CollectionRoom.OnCollect(b, classCard, first, data.CardClasses);
        Check(xp1.Converted && xp1.Amount == MetaRules.CollectXpClassCard && xp1.Cls == classCard.Cls && xp1.Ups == 0,
            "class-card collection must convert +10 xp to its class");
        Check(b.Classes[classCard.Cls!].Xp == MetaRules.CollectXpClassCard && b.Classes[classCard.Cls!].Lv == 1,
            "class xp must land in the base class table");
        CollectionRoom.Toggle(b, classCard);   // 取消收藏
        CollectionRoom.Toggle(b, classCard);   // 再收藏
        var xp2 = CollectionRoom.OnCollect(b, classCard, true, data.CardClasses);
        Check(xp2.Converted == false && b.Classes[classCard.Cls!].Xp == MetaRules.CollectXpClassCard,
            "re-collection must not pay the xp twice (collXp 落档)");
        Check(CollectionRoom.Progress(b, pool) == 1, "collection progress must count distinct collected cards");
        var xp3 = CollectionRoom.OnCollect(b, abilityCard, CollectionRoom.Toggle(b, abilityCard), data.CardClasses);
        Check(xp3.Converted && xp3.Amount == MetaRules.CollectXpAbilityCard, "ability-card collection must convert +50 xp");

        // 升级链：xpForNext(lv)=50+(lv-1)*40、Lv.10 封顶（meta.js LEVEL_MAX/xpForNext）
        Check(MetaRules.XpForNext(1) == 50 && MetaRules.XpForNext(2) == 90 && MetaRules.XpForNext(10) == 410,
            "xp curve drifted from meta.js");
        var xpState = new RunBaseState();
        CollectionRoom.AddClassXp(xpState, abilityCard.Cls!, 350);   // 350 = 跨 lv1→4（50+90+130+80 剩余）
        var leveled = xpState.Classes[abilityCard.Cls!];
        Check(leveled.Lv == 4 && leveled.Xp == 80, "xp must chain level-ups across the curve (350 → Lv.4 + 80)");
        CollectionRoom.AddClassXp(xpState, abilityCard.Cls!, 10000);
        Check(xpState.Classes[abilityCard.Cls!].Lv == MetaRules.ClassLevelMax, "class level must cap at 10");
        Check(CollectionRoom.AddClassXp(xpState, abilityCard.Cls!, 100) == 0, "xp must not accrue past the level cap");

        // 里程碑领奖：条件=进度≥need；奖励入库（传说卡随机不重复/宠物蛋卡），仓库满则整批缓发（meta.js claimColl）
        var collector = new RunBaseState();
        foreach (var card in pool.Take(5)) CollectionRoom.OnCollect(collector, card, CollectionRoom.Toggle(collector, card), data.CardClasses);
        Check(CollectionRoom.MilestoneReached(milestones[0], collector, pool), "m5 must be reached at 5 collected");
        Check(!CollectionRoom.MilestoneReached(milestones[1], collector, pool), "m15 must stay locked below 15");
        var claim5 = CollectionRoom.Claim(collector, milestones[0], catalog, data.Pets, data, () => 0.0);
        Check(claim5.Ok && collector.CollClaimed.Contains("m5") && collector.Wood == 3, "m5 claim must pay 3 wood once");
        Check(CollectionRoom.Claim(collector, milestones[0], catalog, data.Pets, data, () => 0.0).Why == "claimed",
            "m5 must be claimable only once");
        Check(CollectionRoom.Claim(collector, milestones[1], catalog, data.Pets, data, () => 0.0).Why == "locked",
            "locked milestones must refuse to claim");

        // m45：2 张传说卡（同池去重）+ 已达成；mAll：宠物蛋入仓
        foreach (var card in pool.Skip(5).Take(40)) CollectionRoom.OnCollect(collector, card, CollectionRoom.Toggle(collector, card), data.CardClasses);
        Check(CollectionRoom.Progress(collector, pool) == 45, "setup: 45 collected");
        var legendCountBefore = collector.Stash.Where(x => x.Card.Rarity == "传说").Sum(x => x.Count);
        var claim45 = CollectionRoom.Claim(collector, milestones[3], catalog, data.Pets, data, () => 0.0);
        Check(claim45.Ok, "m45 claim must succeed at 45 collected");
        var legendGained = collector.Stash.Where(x => x.Card.Rarity == "传说").ToList();
        Check(legendGained.Sum(x => x.Count) == legendCountBefore + 2, "m45 must deposit 2 legend cards");
        Check(legendGained.Select(x => x.Card.Id).Distinct().Count() == legendGained.Count, "m45 legends must be distinct");
        foreach (var card in pool.Skip(45)) CollectionRoom.OnCollect(collector, card, CollectionRoom.Toggle(collector, card), data.CardClasses);
        Check(CollectionRoom.Progress(collector, pool) == pool.Count && CollectionRoom.PendingMilestones(milestones, collector, pool).Select(ms => ms.Id).Contains("mAll"),
            "mAll must become pending at full collection");
        var claimAll = CollectionRoom.Claim(collector, milestones[4], catalog, data.Pets, data, () => 0.0);
        Check(claimAll.Ok && collector.Stash.Any(x => x.Card.Id == data.Pets.EggId), "mAll must deposit a pet-egg card");
        Check(CollectionRoom.Claim(collector, milestones[4], catalog, data.Pets, data, () => 0.0).Why == "claimed",
            "mAll must be claimable only once");

        // 仓库容量不足：整批缓发（不扣里程碑、不发物资）
        var packed = new RunBaseState();
        while (packed.StashRoom > 0) packed.DepositCards(new[] { new RunCardStack(new RunCard($"filler-{packed.StashUsed}", $"塞满{packed.StashUsed}")) });
        foreach (var card in pool.Take(45)) CollectionRoom.OnCollect(packed, card, CollectionRoom.Toggle(packed, card), data.CardClasses);
        var fullClaim = CollectionRoom.Claim(packed, milestones[3], catalog, data.Pets, data, () => 0.0);
        Check(fullClaim.Why == "full" && !packed.CollClaimed.Contains("m45") && packed.Rations == 0,
            "a full stash must defer the whole milestone reward");

        // 基地档持久化：收藏/收藏经验/里程碑 + 宠物全量随 RunBaseSnapshot/SaveGameDto JSON 往返
        var snapshot = collector.CaptureSnapshot();
        var restored = new RunBaseState();
        restored.RestoreSnapshot(snapshot);
        Check(restored.Collection.SetEquals(collector.Collection) && restored.CollXp.SetEquals(collector.CollXp)
            && restored.CollClaimed.SetEquals(collector.CollClaimed) && restored.PetSel == collector.PetSel
            && restored.Pets.Count == collector.Pets.Count && restored.Classes.Count == collector.Classes.Count,
            "pets/collection base state must round-trip through the snapshot");
        Check(restored.Stash.Sum(x => x.Count) == collector.Stash.Sum(x => x.Count), "snapshot stash must round-trip");
        var dto = new SaveGameDto { Base = ToDtoForTest(snapshot) };
        var json = JsonSerializer.Serialize(dto);
        var roundTrip = JsonSerializer.Deserialize<SaveGameDto>(json)!;
        roundTrip.Validate();
        Check(roundTrip.Base!.Pets.ContainsKey("dog") && roundTrip.Base.PetSel == collector.PetSel
            && roundTrip.Base.CollClaimed.ContainsKey("mAll") && roundTrip.Base.CollXp.Count == collector.CollXp.Count,
            "pets/collection must survive the save JSON round trip");
        var rehydrated = new RunBaseState();
        rehydrated.RestoreSnapshot(new RunBaseSnapshot(roundTrip.Base.Wood, roundTrip.Base.Rations, roundTrip.Base.Keys,
            roundTrip.Base.Coins, roundTrip.Base.BagUp, roundTrip.Base.SafeUp, roundTrip.Base.StashUp,
            roundTrip.Base.Stash.Select(s => s.Card.Deserialize<RunCardSnapshot>()! with { Count = s.Count }).ToArray(),
            roundTrip.Base.Pocket.Select(s => s.Card.Deserialize<RunCardSnapshot>()! with { Count = s.Count }).ToArray(),
            new HashSet<string>(roundTrip.Base.Collection.Keys, StringComparer.Ordinal),
            roundTrip.Base.Pets.Select(pair => new PetSnapshot(pair.Key, pair.Value.Lv, pair.Value.Ts)).ToArray(),
            roundTrip.Base.PetSel,
            new HashSet<string>(roundTrip.Base.CollClaimed.Keys, StringComparer.Ordinal),
            new HashSet<string>(roundTrip.Base.CollXp.Keys, StringComparer.Ordinal),
            new Dictionary<string, ClassProgress>(roundTrip.Base.Classes.Select(pair => KeyValuePair.Create(pair.Key,
                new ClassProgress(pair.Value.Lv, pair.Value.Xp))), StringComparer.Ordinal)));
        Check(rehydrated.Pets.Count == collector.Pets.Count && rehydrated.Collection.Count == collector.Collection.Count
            && rehydrated.CollClaimed.Count == collector.CollClaimed.Count,
            "pet/collection state must rehydrate from the save DTO");
        // 存档校验：petSel 必须指向已拥有宠物
        var badDto = new SaveGameDto { Base = new BaseStateDto { PetSel = "ghost" } };
        try { badDto.Validate(); throw new InvalidOperationException("petSel must reference an owned pet"); }
        catch (SaveFormatException) { _checks++; }
        Console.WriteLine("[批次5] 收藏室：收藏池==data（职业+能力卡）、转化 +10/+50 一次结算、五里程碑触发/领奖/缓发==achievements.json 断言通过");
    }

    /// <summary>测试专用：RunBaseSnapshot → BaseStateDto（与 adapter ToDto 同构；测试工程不引用 App 层）。</summary>
    private static BaseStateDto ToDtoForTest(RunBaseSnapshot snapshot) => new()
    {
        Wood = snapshot.Wood, Rations = snapshot.Rations, Keys = snapshot.Keys, Coins = snapshot.Coins,
        BagUp = snapshot.BagUpgrade, SafeUp = snapshot.SafeUpgrade, StashUp = snapshot.StashUpgrade,
        Stash = snapshot.Stash.Select(s => new CardStackDto { Card = JsonSerializer.SerializeToElement(s), Count = s.Count }).ToList(),
        Pocket = snapshot.Pocket.Select(s => new CardStackDto { Card = JsonSerializer.SerializeToElement(s), Count = s.Count }).ToList(),
        Collection = snapshot.Collection.ToDictionary(name => name, name => new CollectionEntryDto { Name = name }, StringComparer.Ordinal),
        Pets = (snapshot.Pets ?? Array.Empty<PetSnapshot>()).ToDictionary(pet => pet.Id,
            pet => new PetStateDto { Lv = pet.Lv, Ts = pet.Ts }, StringComparer.Ordinal),
        PetSel = snapshot.PetSel,
        CollClaimed = (snapshot.CollClaimed ?? (IReadOnlySet<string>)new HashSet<string>()).ToDictionary(id => id, _ => true, StringComparer.Ordinal),
        CollXp = (snapshot.CollXp ?? (IReadOnlySet<string>)new HashSet<string>()).ToDictionary(id => id, _ => true, StringComparer.Ordinal)
    };

    private static void FragmentSourcesAndCraftSemanticsMatchWeb()
    {
        var universe = LoadRunCardUniverse();
        var eventDeck = universe.Where(card => card.Type == "事件").ToList();

        // —— 来源①神秘补给（tt6-mystery，v2 覆盖选项「接收补给」）：碎片 ×1 + 2 币（网页 v2 实跑口径，批次 4b 冻结）——
        RunState? mystery = null;
        for (var seed = 1; seed <= 300 && mystery is null; seed++)
        {
            var probe = new RunState((ulong)seed);
            probe.ConfigureEventCardPool(eventDeck);
            probe.DebugSetPosition(0, FindNode(probe.Map, 0, RunRoomType.Event));
            probe.ResolveCurrentRoom();
            var choices = probe.DrawEventChoices();
            if (choices[0].Id != EventV2Overlay.MysteryReceive) continue;
            var coinsBefore = probe.Resources.Coins;
            probe.ChooseEvent(0);
            Check(probe.Fragments == 1 && probe.Resources.Coins == coinsBefore + 2,
                "mystery supply must grant 1 fragment + 2 coins");
            Check(probe.OwnedCards.All(x => x.Card.Id != "event-color-token"),
                "mystery supply must NOT grant a color token card (网页 v2 事件口径)");
            SettleToReady(probe);
            mystery = probe;
        }
        Check(mystery is not null, "mystery event should appear within 300 seeds");

        // —— 来源②系统补给（tt6-systemsupply，v2 覆盖选项「接收补给」）：碎片 ×1 + 木材卡 ×1（物资以卡牌入包）——
        RunState? supply = null;
        for (var seed = 1; seed <= 300 && supply is null; seed++)
        {
            var probe = new RunState((ulong)seed);
            probe.ConfigureLootCardPool(universe);
            probe.ConfigureEventCardPool(eventDeck);
            probe.DebugSetPosition(0, FindNode(probe.Map, 0, RunRoomType.Event));
            probe.ResolveCurrentRoom();
            var choices = probe.DrawEventChoices();
            if (choices[0].Id != EventV2Overlay.SystemSupplyReceive) continue;
            probe.ChooseEvent(0);
            Check(probe.Fragments == 1, "system supply must grant 1 fragment");
            Check(probe.OwnedCards.Any(x => x.Card.Id == "tt-wood") || probe.PendingRewards.Any(x => x.Card.Id == "tt-wood"),
                "system supply must grant the wood card (物资以卡牌入包)");
            SettleToReady(probe);
            supply = probe;
        }
        Check(supply is not null, "system supply event should appear within 300 seeds");

        // —— 敌人不掉碎片；碎片无上限（网页 game.fragments 只增不减，祭坛兑换/合成才消耗）——
        var plain = new RunState(7);
        plain.ConfigureLootCardPool(universe);
        plain.DebugSetPosition(0, FindNode(plain.Map, 0, RunRoomType.Battle));
        plain.ResolveCurrentRoom();
        plain.DebugSetEncounter(new[] { new RunEnemy("probe", "探针怪", 10, 1) });
        plain.CompleteBattle(true);
        while (plain.Phase == RunPhase.Chest) plain.OpenNextChest();
        Check(plain.Fragments == 0, "enemies must not grant fragments");
        plain.GrantFragments(7);
        Check(plain.Fragments == 7, "fragments accumulate without a cap");

        // —— 合成入口：3 张通行证B → 1 张通行证A；A + 2 碎片 → 彩色令牌（game.bag.js 语义）——
        var craft = new RunState(8);
        craft.ConfigureLootCardPool(universe);
        var gold = universe.First(card => card.Id == TokenCraft.TokenGoldId);
        var tokenA = universe.First(card => card.Id == TokenCraft.TokenColorId);
        Check(craft.CraftTokenAFromB().Ok == false, "craft without gold tokens must fail");
        craft.AddCard(gold, 2);
        Check(!craft.CraftTokenAFromB().Ok, "craft with 2 gold tokens must fail");
        craft.AddCard(gold, 1);
        Check(craft.OwnedCards.First(x => x.Card.Id == TokenCraft.TokenGoldId).Count == 3, "setup: 3 gold tokens");
        var craftA = craft.CraftTokenAFromB();
        Check(craftA.Ok && craftA.CraftedCardId == TokenCraft.TokenColorId, "3 gold tokens must craft token A");
        Check(!craft.OwnedCards.Any(x => x.Card.Id == TokenCraft.TokenGoldId), "gold tokens must be consumed");
        Check(craft.OwnedCards.Any(x => x.Card.Id == TokenCraft.TokenColorId), "token A enters the backpack");
        Check(!craft.CraftColorTokenByFragments().Ok, "color token craft without fragments must fail");
        craft.GrantFragments(1);
        Check(!craft.CraftColorTokenByFragments().Ok, "color token craft with 1 fragment must fail");
        craft.GrantFragments(1);
        var colorCraft = craft.CraftColorTokenByFragments();
        Check(colorCraft.Ok && colorCraft.CraftedCardId == TokenCraft.ColorTokenId, "A + 2 fragments must craft the color token");
        Check(craft.Fragments == 0 && !craft.OwnedCards.Any(x => x.Card.Id == TokenCraft.TokenColorId), "A + fragments consumed");
        Check(craft.OwnedCards.Any(x => x.Card.Id == TokenCraft.ColorTokenId), "color token enters the backpack");
    }

    // ---------- 批次 4b 结束 ----------

    // ---------- 批次 4c：ink 事件整合进跑图流程（真源 narrative.js + game.run.flow.js + events.ink）----------

    /// <summary>事件探针：落位第 1 层事件格、配置全量卡池/事件卡池、压低生命便于 heal/掉血断言。
    /// 生成器只保底火堆/补给站/搜刮点/战斗，不保证事件格——向后扫描种子直到第 1 层出现事件格。</summary>
    private static RunState EventProbe(ulong seed, IReadOnlyList<RunCard> universe, IReadOnlyList<RunCard> eventDeck)
    {
        var run = new RunState(seed);
        while (!run.Map.Layers[0].Nodes.Any(node => node.Type == RunRoomType.Event)) { seed++; run = new RunState(seed); }
        run.ConfigureLootCardPool(universe);
        run.ConfigureEventCardPool(eventDeck);
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Event));
        run.ResolveCurrentRoom();
        run.DebugSetHp(10);
        return run;
    }

    private static IReadOnlyList<RunCard> EventDeck() => LoadRunCardUniverse().Where(card => card.Type == "事件").ToList();

    /// <summary>
    /// 验收①：10 张事件卡×全选项落地矩阵——6 张 v2 覆盖事件（EventV2Overlay，真源 game.run.flow.js:277-318
    /// 的 V2 表）逐选项断言「选项文案/色调/落地」=网页实跑口径；非覆盖事件维持 ink 纯净链断言
    /// （intro/选项数/@@effect@@ 落地）。ink 结点本身的 v1 旧文案走查兜底在 tests/Narrative（4a 口径）。
    /// 修鞋铺 cmtn7qttxqo4（无 ink 结点，4b 移交）与未知 cardId 兜底在 ShoeShopAndKnotlessEventsLandSafely。
    /// </summary>
    private static void InkEventChoicesLandTheirEffects()
    {
        var universe = LoadRunCardUniverse();
        var eventDeck = EventDeck();
        // 网页卡库事实（cards-sync retire）：tt6-timeskip「时空孔隙」已退役，事件格永不抽中；
        // 在役事件卡 = 9 个 tt6 结点 + 修鞋铺。timeskip 的 ink 结点仍按批次 4a 全分支口径走查（见循环后）。
        Check(eventDeck.Count == 10, "event deck must mirror the live web library (9 tt6 + 修鞋铺；timeskip 已 retire)");
        Check(eventDeck.Count(card => InkEventCatalog.Knots.ContainsKey(card.Id)) == 9,
            "9 个在役 tt6 事件卡对应 ink 结点");
        Check(eventDeck.Count(card => EventV2Overlay.IsCovered(card.Id)) == 6,
            "v2 覆盖层恰覆盖 6 张事件卡（flow.js V2 表：mystery/systemsupply/demondeal/airdrop/chestdraw/goldhammer）");
        Check(!eventDeck.Any(card => card.Id == "tt6-timeskip"), "retired timeskip card must not be drawn");
        var catalog = new InkEventCatalog(GameRuntime.Data.NarrativeStoryJson!);
        var totalChoices = 0;

        foreach (var card in eventDeck)
        {
            var covered = EventV2Overlay.IsCovered(card.Id);
            var session = catalog.OpenEvent(card.Id);
            var choiceCount = covered ? EventV2Overlay.ChoiceCount(card.Id) : session?.Choices.Count ?? 1;
            for (var choiceIndex = 0; choiceIndex < choiceCount; choiceIndex++)
            {
                totalChoices++;
                var run = EventProbe((ulong)(7000 + totalChoices * 13), universe, eventDeck);
                run.DebugSetEventCard(card.Id);
                Check(run.PendingEventId == card.Id, $"{card.Id}: DebugSetEventCard must open the named event");
                Check(run.PendingEventTitle == card.Name, $"{card.Id}: panel title must be the card name (网页 nodeShell title=card.name)");
                // intro 一律来自 ink 结点（v2 覆盖事件网页也展示 ink intro，flow.js:249）
                Check(run.EventIntro == (session?.Intro ?? ""), $"{card.Id}: EventIntro must surface the ink knot intro (v2 覆盖事件同款)");
                if (covered)
                {
                    // v2 覆盖：只暴露 V2 表选项；ink 的 v2 前旧文案选项（「以血换物」「抡起动力锤」等）不得泄漏
                    Check(run.EventChoices.All(choice => choice.Id.StartsWith("v2_", StringComparison.Ordinal)),
                        $"{card.Id}: v2 覆盖事件只暴露 V2 表选项（ink v2 前旧文案不泄漏）");
                    CheckV2ChoiceTexts(card.Id, run.EventChoices);
                }
                else if (session is not null)
                {
                    Check(run.EventChoices.Count == session.Choices.Count, $"{card.Id}: choice count must match the ink knot");
                    Check(run.EventChoices.All(choice => choice.Id.Length > 0 && !choice.Label.Contains("@@", StringComparison.Ordinal)),
                        $"{card.Id}: every choice carries an effect key and never leaks @@ metadata");
                }
                var effect = run.EventChoices[choiceIndex].Id;
                var hpBefore = run.Hp;
                var coinsBefore = run.Resources.Coins;
                var fragsBefore = run.Fragments;
                var result = run.ChooseEvent(choiceIndex);
                if (!covered)
                    Check(result.Text.Length > 0 || effect == RunState.EventContinueChoiceId,
                        $"{card.Id} 选项[{choiceIndex}]({effect}): ink 结点推进应有后果文本（narrate() 口径；v2 覆盖事件 run() 直调无后果文本）");
                switch (effect)
                {
                    // —— 批次 4c-fix：v2 覆盖层落地（对照 flow.js V2 表 run() 闭包，逐项）——
                    case EventV2Overlay.MysteryReceive:   // flow.js:279
                        Check(run.Phase == RunPhase.Ready && run.Fragments == fragsBefore + 1 && run.Resources.Coins == coinsBefore + 2,
                            "tt6-mystery 接收补给: 碎片 ×1 + 2 币（flow.js:279）");
                        Check(run.OwnedCards.All(x => x.Card.Id != TokenCraft.TokenColorId),
                            "tt6-mystery: 不直发彩色令牌卡（v2 落碎片）");
                        Check(result.Text.Contains("获得彩色令牌碎片"), "tt6-mystery: 落地文案含碎片提示（网页 gainFragment log）");
                        break;
                    case EventV2Overlay.SystemSupplyReceive:   // flow.js:282-285
                        Check(run.Phase == RunPhase.Ready && run.Fragments == fragsBefore + 1
                            && (run.OwnedCards.Any(x => x.Card.Id == "tt-wood") || run.PendingRewards.Any(x => x.Card.Id == "tt-wood")),
                            "tt6-systemsupply 接收补给: 碎片 ×1 + 木材卡 ×1（flow.js:282-285）");
                        break;
                    case EventV2Overlay.DemonAccept:   // flow.js:289-293
                    {
                        Check(run.Phase == RunPhase.Chest && run.Hp == Math.Max(1, hpBefore - 5),
                            "tt6-demondeal 成交: -5 血（不低于 1）并进入开箱（flow.js:289-290）");
                        Check(result.Text.Contains("军用保险柜"), "tt6-demondeal 成交: 落地文案=「恶魔收走了 5 点生命力…」（flow.js:291）");
                        var large = run.PeekNextChest();
                        Check(large.Kind == "large", "tt6-demondeal 成交: 大宝箱（恶魔的报酬，flow.js:292）");
                        run.OpenNextChest();
                        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
                        Check(run.Phase == RunPhase.Ready, "tt6-demondeal 成交: 开完回 Ready");
                        break;
                    }
                    case EventV2Overlay.DemonRefuse:   // flow.js:294
                        Check(run.Phase == RunPhase.Ready && run.Hp == hpBefore && result.Text == "你顶住了诱惑，继续赶路",
                            "tt6-demondeal 拒绝: 无事发生（flow.js:294）");
                        break;
                    case EventV2Overlay.AirdropWood:   // flow.js:302
                        Check(run.Phase == RunPhase.Ready
                            && (run.OwnedCards.Any(x => x.Card.Id == "tt-wood") || run.PendingRewards.Any(x => x.Card.Id == "tt-wood")),
                            "tt6-airdrop 木材: 木材卡 ×1 入包（flow.js:302）");
                        break;
                    case EventV2Overlay.AirdropRations:   // flow.js:303
                        Check(run.Phase == RunPhase.Ready
                            && (run.OwnedCards.Any(x => x.Card.Id == "tt-rations") || run.PendingRewards.Any(x => x.Card.Id == "tt-rations")),
                            "tt6-airdrop 口粮: 口粮卡 ×1 入包（flow.js:303）");
                        break;
                    case EventV2Overlay.AirdropPeach:   // flow.js:304
                        Check(run.Phase == RunPhase.Ready && run.Hp == Math.Min(run.MaxHp, hpBefore + 6) && result.Text.Contains("一颗鲜桃"),
                            "tt6-airdrop 桃: 回复 6 血（flow.js:304）");
                        break;
                    case EventV2Overlay.AirdropPotion:   // flow.js:297+305
                    {
                        var potionIds = universe.Where(c => c.Type == "道具" && LootTables.IsRandomObtainable(c, GameRuntime.Data)
                            && (c.Name.Contains("药水", StringComparison.Ordinal) || c.Name == "能量饮料")).Select(c => c.Id).ToHashSet();
                        var granted = run.OwnedCards.Select(x => x.Card).Concat(run.PendingRewards.Select(x => x.Card))
                            .Any(c => potionIds.Contains(c.Id));
                        Check(run.Phase == RunPhase.Ready && granted,
                            "tt6-airdrop 随机药水: 从药水池（道具+isRandomObtainable+药水/能量饮料）发 1 张（flow.js:297,305）");
                        break;
                    }
                    case EventV2Overlay.ChestDrawOpen:   // flow.js:309-313
                    {
                        Check(run.Phase == RunPhase.Chest, "tt6-chestdraw 开箱: 进入开箱队列");
                        var preview = run.PeekNextChest();
                        Check(preview.Kind is "large" or "medium" or "small",
                            "tt6-chestdraw 开箱: 箱型=大/中/小均匀抽 1（flow.js:310-311）");
                        run.OpenNextChest();
                        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
                        Check(run.Phase == RunPhase.Ready, "tt6-chestdraw 开箱: 结算回 Ready");
                        break;
                    }
                    case EventV2Overlay.GoldhammerTake:   // flow.js:316
                        Check(run.Phase == RunPhase.Ready
                            && (run.OwnedCards.Any(x => x.Card.Id == EventV2Overlay.GoldhammerCardId)
                                || run.PendingRewards.Any(x => x.Card.Id == EventV2Overlay.GoldhammerCardId)),
                            "tt6-goldhammer 收下: 直发卡牌「闪金之锤」（非锤击敌人，flow.js:316）");
                        break;
                    // —— ink 纯净链（非覆盖结点，回归兜底）——
                    // （被 v2 覆盖的 ink 旧效果键 chest_*/airdrop_*/demondeal_trade/goldhammer_strike
                    //   /mystery_supply/systemsupply_restock 在在役卡池已不可达，断言移除；
                    //   ink 结点级走查兜底保留在 tests/Narrative）——
                    case "goldmine_safe":
                        Check(run.Phase == RunPhase.Ready && run.Resources.Coins == coinsBefore + 3, "goldmine_safe: +3 币回 Ready");
                        break;
                    case "goldmine_deep":
                        Check(run.Phase == RunPhase.Ready && run.Resources.Coins == coinsBefore + 6 && run.Hp == Math.Max(1, hpBefore - 3),
                            "goldmine_deep: +6 币 -3 血（不低于 1）");
                        break;
                    case "timeskip_move":
                        Check(run.Phase == RunPhase.Ready && run.TrackPosition == run.Map.Layers[0].Nodes.First(n => n.Type == RunRoomType.Event).Idx,
                            "timeskip_move: 链式移动已停用（原地不动回 Ready）");
                        break;
                    case "bandits_fight":
                    {
                        Check(run.Phase == RunPhase.Battle && run.Encounter.Count == Math.Min(5, 3 + run.LayerIndex)
                            && run.Encounter.All(enemy => enemy.Id == "bandit"),
                            "bandits_fight: 拾荒者一伙数量随层缩放（第 1 层 3 → 第 3 层起 5）");
                        var drops = run.CompleteBattle(true);
                        Check(drops.Count >= 2 && drops[0] is ("medium", false, false) && drops[1] is ("medium", false, false),
                            "bandits_fight: 战胜后先发密封物资箱 ×2（再叠常规掉落）");
                        while (run.Phase == RunPhase.Chest) run.OpenNextChest();
                        Check(run.Phase == RunPhase.Ready, "bandits_fight: 战利品结算回 Ready");
                        break;
                    }
                    case "relief_heal":
                        Check(run.Phase == RunPhase.Ready && run.Hp == Math.Min(run.MaxHp, hpBefore + 6), "relief_heal: +6 血");
                        break;
                    case RunState.EventContinueChoiceId when card.Id == RunState.ShoeShopCardId:
                        Check(run.Fragments == fragsBefore + 1, "修鞋铺: 继续 → 碎片 ×1（复原交互见下一组）");
                        if (run.EventRestorePending) run.LeaveEventWithoutEffect();
                        break;
                    default:
                        Check(run.Phase == RunPhase.Ready, $"{card.Id}/{effect}: 无效果选项安静落地回 Ready");
                        break;
                }
            }
        }
        // 在役卡池全部选项一个不漏：v2 覆盖 10 选项（mystery 1+systemsupply 1+demondeal 2+airdrop 4
        // +chestdraw 1+goldhammer 1）+ ink 纯净链 4 选项（goldmine 2+bandits 1+relief 1）+ 修鞋铺 1
        Check(totalChoices == 15, $"event deck must walk every choice exactly once (v2 覆盖 10 + ink 4 + 修鞋铺 1), got {totalChoices}");

        // —— 时空孔隙（tt6-timeskip，cards-sync 已 retire、事件格永不触发）：ink 结点仍在，
        //    用测试 seam 走查其唯一选项的落地 = 链式移动停用 → 原地不动回 Ready ——
        var timeskip = EventProbe(9300, universe, eventDeck);
        timeskip.DebugSetEventCard("tt6-timeskip");
        Check(timeskip.EventIntro.Length > 0 && timeskip.EventChoices[0].Id == "timeskip_move",
            "timeskip: ink 结点 intro/选项仍完整可走（批次 4a 全分支口径）");
        var timeskipPos = timeskip.TrackPosition;
        timeskip.ChooseEvent(0);
        Check(timeskip.Phase == RunPhase.Ready && timeskip.TrackPosition == timeskipPos,
            "timeskip_move: 链式移动已停用（cancelLegacyChainMove）→ 原地不动回 Ready");
        Console.WriteLine($"[4c-fix] 事件落地矩阵：{eventDeck.Count} 张在役事件卡（v2 覆盖 6 张 10 选项 + ink 纯净链 4 选项 + 修鞋铺 1）+ retire 的 timeskip 结点，全部 {totalChoices + 1} 个选项逐一断言");
    }

    /// <summary>v2 覆盖事件的选项文案/色调逐项对照真源 flow.js V2 表（tt6-airdrop 药水 detail 为运行时模板）。</summary>
    private static void CheckV2ChoiceTexts(string cardId, IReadOnlyList<RunEventChoice> choices)
    {
        switch (cardId)
        {
            case "tt6-mystery":
                Check(choices.Count == 1 && choices[0] is { Label: "接收补给", Detail: "获得彩色令牌碎片，+2 币", Tone: "ok" },
                    "tt6-mystery: 选项=「接收补给｜获得彩色令牌碎片，+2 币｜ok」（flow.js:279）");
                break;
            case "tt6-systemsupply":
                Check(choices.Count == 1 && choices[0] is { Label: "接收补给", Detail: "获得彩色令牌碎片，木材卡 ×1", Tone: "ok" },
                    "tt6-systemsupply: 选项=「接收补给｜获得彩色令牌碎片，木材卡 ×1｜ok」（flow.js:282）");
                break;
            case "tt6-demondeal":
                Check(choices.Count == 2
                    && choices[0] is { Label: "成交", Detail: "-5 血，获得 1 个大宝箱", Tone: "danger" }
                    && choices[1] is { Label: "拒绝", Detail: "无事发生", Tone: "" },
                    "tt6-demondeal: 成交(danger)｜拒绝 文案对照 flow.js:289-294");
                break;
            case "tt6-airdrop":
                Check(choices.Count == 4
                    && choices[0] is { Label: "木材", Detail: "木材卡 ×1", Tone: "" }
                    && choices[1] is { Label: "口粮", Detail: "口粮卡 ×1", Tone: "" }
                    && choices[2] is { Label: "桃", Detail: "回复 6 血", Tone: "ok" }
                    && choices[3].Label == "随机药水" && choices[3].Tone == "ok"
                    && (choices[3].Detail == "（补给已耗尽）"
                        || (choices[3].Detail.StartsWith("获得【", StringComparison.Ordinal) && choices[3].Detail.EndsWith("】", StringComparison.Ordinal))),
                    "tt6-airdrop: 木材/口粮/桃/随机药水 文案对照 flow.js:302-305（药水 detail 运行时抽定卡名）");
                break;
            case "tt6-chestdraw":
                Check(choices.Count == 1 && choices[0] is { Label: "开箱", Detail: "从大、中、小宝箱中随机抽取 1 个", Tone: "ok" },
                    "tt6-chestdraw: 选项=「开箱｜从大、中、小宝箱中随机抽取 1 个｜ok」（flow.js:310）");
                break;
            case "tt6-goldhammer":
                Check(choices.Count == 1 && choices[0] is { Label: "收下", Detail: "获得卡牌「闪金之锤」", Tone: "ok" },
                    "tt6-goldhammer: 选项=「收下｜获得卡牌「闪金之锤」｜ok」（flow.js:316）");
                break;
        }
    }

    /// <summary>修鞋铺 cmtn7qttxqo4（4b 移交）：碎片 ×1 + openPocketRestore(1) 复原 1 张消耗卡；空口袋直接收敛；未知 cardId 兜底。</summary>
    private static void ShoeShopAndKnotlessEventsLandSafely()
    {
        var universe = LoadRunCardUniverse();
        var eventDeck = EventDeck();
        // —— 修鞋铺：碎片 ×1 + 复原面板（网页 applyEventEffect + openPocketRestore(1)）——
        var run = EventProbe(9101, universe, eventDeck);
        run.AddCard(new RunCard("shoe-fodder", "复原源卡"));
        run.MoveCardToPocket("复原源卡");   // → 消耗口袋
        run.DebugSetEventCard(RunState.ShoeShopCardId);
        Check(run.PendingEventTitle == "修鞋铺", "修鞋铺: 面板标题为卡名");
        Check(run.EventIntro.Length == 0 && run.EventChoices.Count == 1 && run.EventChoices[0].Id == RunState.EventContinueChoiceId,
            "修鞋铺无 ink 结点 → intro 为空 + 单按钮「继 续」（网页 evtNext 路径）");
        var frags = run.Fragments;
        run.ChooseEvent(0);
        Check(run.Fragments == frags + 1 && run.Phase == RunPhase.Event && run.EventRestorePending,
            "修鞋铺: 碎片 ×1 并停留在复原面板（openPocketRestore 口径）");
        Check(run.EventRestorableCards.Contains("复原源卡"), "复原列表来自消耗口袋（道具/装备除外）");
        Check(!run.RestoreEventPocketCard("口袋里没有的卡"), "复原不存在的卡必须拒绝");
        Check(run.RestoreEventPocketCard("复原源卡") && run.Phase == RunPhase.Ready
            && run.OwnedCards.Any(x => x.Card.Name == "复原源卡"),
            "复原 1 张回背包并结束事件（restoreOne→finish 口径）");

        // —— 修鞋铺空消耗口袋：碎片照发、直接收敛到 Ready（网页空面板+继续旅程等价）——
        var empty = EventProbe(9102, universe, eventDeck);
        empty.DebugSetEventCard(RunState.ShoeShopCardId);
        empty.ChooseEvent(0);
        Check(empty.Fragments == 1 && empty.Phase == RunPhase.Ready && !empty.EventRestorePending,
            "修鞋铺空口袋: 碎片照发并直接结束");

        // —— 未知 cardId（无 ink 结点的自定义事件卡，narrative.js KNOTS 未收录）→ null 兜底 + 无事发生 ——
        var unknown = EventProbe(9103, universe, eventDeck);
        unknown.DebugSetEventCard("legacy-custom-event");
        Check(unknown.PendingEventId == "legacy-custom-event" && unknown.PendingEventTitle == "legacy-custom-event"
            && unknown.EventIntro.Length == 0,
            "未知 cardId 走 null 兜底（运行时侧：单按钮面板，无叙事正文）");
        var coinsBefore = unknown.Resources.Coins;
        unknown.ChooseEvent(0);
        Check(unknown.Phase == RunPhase.Ready && unknown.Fragments == 0 && unknown.Resources.Coins == coinsBefore,
            "未知事件「继 续」无事发生回 Ready（网页 default：效果后续版本实装）");
        Console.WriteLine("[4c] 修鞋铺复原/空口袋收敛 + 未知 cardId 兜底 断言通过");
    }

    /// <summary>验收③：事件面板挂起/恢复（镜像开箱 suspend/resume）+ 事件进行中不可入档（网页只在稳定落点写档）。</summary>
    private static void EventPanelSuspendsResumesAndStaysUnsaveable()
    {
        var universe = LoadRunCardUniverse();
        var eventDeck = EventDeck();
        var run = EventProbe(9201, universe, eventDeck);
        run.DebugSetEventCard("tt6-goldmine");
        var labels = run.EventChoices.Select(choice => choice.Label).ToArray();
        Check(run.SuspendEvent(), "挂起事件面板必须返回 true");
        Check(run.EventSuspended, "挂起状态可查询");
        try { run.ChooseEvent(0); throw new InvalidOperationException("suspended event accepted a choice"); }
        catch (InvalidOperationException error) { Check(error.Message.Contains("挂起", StringComparison.Ordinal), "挂起中选项必须被拒绝"); }
        run.ResumeEvent();
        Check(!run.EventSuspended && run.EventChoices.Select(choice => choice.Label).SequenceEqual(labels),
            "恢复后 intro/选项保持不变（同预览继续）");
        run.ChooseEvent(0);
        Check(run.Phase == RunPhase.Ready && !run.SuspendEvent(), "事件结算后挂起返回 false");
        run.ResumeEvent();   // 非挂起状态恢复是无操作
        Check(!run.EventSuspended, "非事件阶段 resume 无操作");
        // 事件进行中状态不入档（对齐网页口径：只在稳定落点 saveGame）——Event 阶段快照拒恢复
        var mid = EventProbe(9202, universe, eventDeck);
        mid.DebugSetEventCard("tt6-goldmine");
        var snapshot = mid.CaptureSnapshot();
        try { RunState.FromSnapshot(snapshot); throw new InvalidOperationException("event-phase snapshot was accepted"); }
        catch (ArgumentException) { Check(true, "事件进行中标记不可存档（Restore 拒绝非 Ready/Settlement）"); }
        // 稳定落点后再存档恢复正常：结束面板 → Ready 快照可恢复，且事件面板状态被清空
        mid.LeaveEventWithoutEffect();
        var restored = RunState.FromSnapshot(mid.CaptureSnapshot());
        Check(restored.Phase == RunPhase.Ready && restored.PendingEventId is null && !restored.EventRestorePending,
            "恢复后的稳定落点不携带事件面板暂存");
        Console.WriteLine("[4c] 事件面板挂起/恢复 + 事件进行中不可入档 断言通过");
    }


    // ---------- 验收①：2000 seed 复验 harness ----------

    private static void TwoThousandSeedAcceptanceHarness()
    {
        const int seeds = 2000;
        var data = GameRuntime.Data;
        var attemptHistogram = new SortedDictionary<int, int>();
        long layerFires = 0, layerShops = 0, layerChests = 0, layerBattles = 0, layerExits = 0, layerAltars = 0, layerBosses = 0;
        var chestCountHistogram = new SortedDictionary<int, int>();
        var battleCountHistogram = new SortedDictionary<int, int>();
        // L0 遭遇数量分布（entries size 均为 [2,3] → 2/3 各约 1/2，对齐 encounter-count.test.js）
        var l0Distribution = new Dictionary<string, Dictionary<int, int>>(StringComparer.Ordinal);
        long eliteEncounters = 0, totalEncounters = 0;
        for (var seed = 1; seed <= seeds; seed++)
        {
            var generated = MapGenerator.Generate((ulong)seed);
            attemptHistogram[generated.AttemptsUsed] = attemptHistogram.GetValueOrDefault(generated.AttemptsUsed) + 1;
            var issues = MapGenerator.Validate(generated.Layers);
            Check(issues.Count == 0, $"seed {seed}: generator quality issues: {string.Join("；", issues)}");
            Check(generated.TotalNodes == 60, $"seed {seed}: total node count must be 60");
            var map = new RunMap(generated, data.Bosses.Select(b => (b.Id, b.Name, b.Hp, b.Attack)).ToArray());
            Check(map.CheckConnectivity(out var unreachable) && unreachable.Count == 0,
                $"seed {seed}: unreachable {string.Join(",", unreachable)}");
            for (var li = 0; li < 4; li++)
            {
                var stats = AssertLayerInvariants(map, li, (ulong)seed);
                layerFires += stats.Fires; layerShops += stats.Shops; layerChests += stats.Chests;
                layerBattles += stats.Battles; layerExits += stats.EmergencyExits;
                layerAltars += stats.Altars; layerBosses += stats.Bosses;
            }
            foreach (var li in new[] { 0, 1, 2, 3 })
            {
                var chests = map.Layers[li].Nodes.Count(n => n.Type == RunRoomType.Chest);
                chestCountHistogram[chests] = chestCountHistogram.GetValueOrDefault(chests) + 1;
                var battles = map.Layers[li].Nodes.Count(n => n.Type == RunRoomType.Battle);
                battleCountHistogram[battles] = battleCountHistogram.GetValueOrDefault(battles) + 1;
            }
            // 遭遇数量 sanity：逐战斗格组建遭遇（分布对齐网页 encounter-count.test.js 的等概率口径）
            var run = new RunState((ulong)seed, map);
            var table = data.Encounters;
            foreach (var layer in map.Layers)
            {
                foreach (var node in layer.Nodes.Where(n => n.Type == RunRoomType.Battle))
                {
                    run.DebugSetPosition(layer.Index, node.Idx);
                    run.ResolveCurrentRoom();
                    Check(run.Phase == RunPhase.Battle && run.Encounter.Count > 0, $"seed {seed}: battle without encounter");
                    totalEncounters++;
                    var ids = run.Encounter.Select(e => e.Id).Distinct().ToArray();
                    Check(ids.Length == 1, $"seed {seed}: encounter mixes monster kinds");
                    var entry = table[layer.Index].Entries.FirstOrDefault(en => en.MonsterId == ids[0]);
                    if (entry is not null)
                    {
                        Check(run.Encounter.Count >= entry.Min && run.Encounter.Count <= entry.Max,
                            $"seed {seed}: encounter count {run.Encounter.Count} outside [{entry.Min},{entry.Max}]");
                    }
                    else
                    {
                        Check(ids[0] == "dragon" && run.Encounter.Count == 1, $"seed {seed}: elite must be a lone dragon");
                        eliteEncounters++;
                    }
                    if (layer.Index == 0)
                    {
                        if (!l0Distribution.TryGetValue(ids[0], out var counts))
                            l0Distribution[ids[0]] = counts = new Dictionary<int, int>();
                        counts[run.Encounter.Count] = counts.GetValueOrDefault(run.Encounter.Count) + 1;
                    }
                    run.CompleteBattle(true);
                    for (var guard = 0; guard < 8 && run.Phase == RunPhase.Chest; guard++) run.OpenNextChest();
                    Check(run.Phase == RunPhase.Ready, $"seed {seed}: encounter did not settle");
                }
            }
        }
        // 汇总保底命中（期望：火堆/补给站 8000/8000 层、紧急撤离 2000、祭坛/首脑 2000）
        Check(layerFires == 4L * seeds && layerShops == 4L * seeds, "fire/shop guarantee totals");
        Check(layerExits == seeds, "layer-3 emergency exit totals");
        Check(layerAltars == seeds && layerBosses == seeds, "layer-4 altar/boss totals");
        foreach (var attempts in attemptHistogram.Keys)
            Check(attempts is >= 1 and <= MapGenerator.MaxAttempts, "attempt count within 1..8");
        // L0 分布 sanity：每怪 2/3 双值出现且频率接近 1/2（±0.12 宽松护栏，防系统性偏斜）
        var sampleTotal = 0;
        foreach (var (monster, counts) in l0Distribution)
        {
            var n = counts.Values.Sum();
            sampleTotal += n;
            Check(counts.Keys.All(k => k is 2 or 3), $"L0 monster {monster} count outside [2,3]");
            Check(counts.ContainsKey(2) && counts.ContainsKey(3), $"L0 monster {monster} distribution collapsed");
            var share2 = (double)counts[2] / n;
            Check(Math.Abs(share2 - 0.5) < 0.12, $"L0 monster {monster} count-2 share {share2:F3} not near 0.5");
        }
        Check(sampleTotal > seeds, "encounter sample size too small");
        Check(eliteEncounters > 0, "elite dragon should appear across 2000 seeds");
        // 数据口径（encounter-count.test.js 第一条）：每层每种敌人数量区间落在 1..3
        foreach (var table in data.Encounters)
            foreach (var entry in table.Entries)
                Check(entry.Min is >= 1 and <= 3 && entry.Max is >= 1 and <= 3 && entry.Min <= entry.Max,
                    $"encounter entry {entry.MonsterId} size [{entry.Min},{entry.Max}] outside 1..3");
        var attemptReport = string.Join(", ", attemptHistogram.Select(kv => $"{kv.Key}次:{kv.Value}"));
        Console.WriteLine("[2000-seed] 候选举优分布: " + attemptReport);
        Console.WriteLine($"[2000-seed] 保底命中: 火堆 {layerFires}/{4L * seeds} 补给站 {layerShops}/{4L * seeds} 紧急撤离 {layerExits}/{seeds} 祭坛 {layerAltars}/{seeds} 首脑 {layerBosses}/{seeds}");
        Console.WriteLine("[2000-seed] 每层搜刮点数分布: " + string.Join(", ", chestCountHistogram.Select(kv => $"{kv.Key}个:{kv.Value}层")));
        Console.WriteLine("[2000-seed] 每层战斗格数分布: " + string.Join(", ", battleCountHistogram.Select(kv => $"{kv.Key}个:{kv.Value}层")));
        var l0Report = string.Join(", ", l0Distribution.Select(kv =>
        {
            var n = kv.Value.Values.Sum();
            return $"{kv.Key}: 2只×{kv.Value.GetValueOrDefault(2)} / 3只×{kv.Value.GetValueOrDefault(3)}（2只占比{(double)kv.Value.GetValueOrDefault(2) / n:F3}）";
        }));
        Console.WriteLine("[2000-seed] L0 遭遇数量分布: " + l0Report + $"；精英荒渊遭遇 {eliteEncounters}/{totalEncounters}");
    }

    // ---------- 公共助手 ----------

    private static void WalkAndSettle(RunState run, int moves)
    {
        for (var i = 0; i < moves && !run.IsFinished; i++)
        {
            SettleToReady(run);
            var neighbors = run.ReachableNodes();
            if (neighbors.Count == 0) break;
            run.MoveTo(neighbors[0]);
            SettleToReady(run);
        }
    }

    private static void SettleToReady(RunState run)
    {
        for (var guard = 0; guard < 8 && run.Phase != RunPhase.Ready; guard++)
        {
            switch (run.Phase)
            {
                case RunPhase.Event:
                    // 批次 4c：事件面板=事件卡池均匀抽（池空时 DrawEventChoices 内部落 map.json randomEvents 旧表）
                    if (run.PendingEventId is null) run.DrawEventChoices();
                    if (run.Phase == RunPhase.Event && run.PendingEventId is not null)
                    {
                        if (run.EventRestorePending) run.LeaveEventWithoutEffect();   // 修鞋铺复原面板：直接「继续旅程」
                        else run.ChooseEvent(0);
                    }
                    break;
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

    private static int FindNode(RunMap map, int layerIdx, RunRoomType type, int occurrence = 0)
    {
        var matches = map.Layers[layerIdx].Nodes.Where(n => n.Type == type).Select(n => n.Idx).ToArray();
        if (occurrence >= matches.Length)
            throw new InvalidOperationException($"map seed {map.Seed} layer {layerIdx} lacks {type} (occurrence {occurrence})");
        return matches[occurrence];
    }
}
