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
        // 补给站（每层恰好 1）
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Shop)); run.ResolveCurrentRoom();
        Check(run.Phase == RunPhase.Shop && run.Shop.Count >= 3, "shop room missing offers");
        run.Resources.Coins = 10; run.BuyShopOffer("rations"); Check(run.Resources.Rations == 1, "shop resource purchase failed");
        run.LeaveShop(); Check(run.Phase == RunPhase.Ready, "leaving shop should settle to ready");
        // 事件格 + 事件战（拾荒者数量随层数缩放：第 1 层 3 只，第 3 层起 5 只）。
        // 事件种类由 RNG 抽取——扫 seed 直到抽中 bandits（反抗组织拾荒者）。
        RunState? banditRun = null;
        for (var seed = 1; seed <= 300 && banditRun is null; seed++)
        {
            var probe = new RunState((ulong)seed);
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
        // 时空孔隙：事件连锁移动已停用（cancelLegacyChainMove）——扫 seed 抽中 timeskip 验证不移动
        var foundTimeskip = false;
        for (var seed = 1; seed <= 300 && !foundTimeskip; seed++)
        {
            var probe = new RunState((ulong)seed);
            probe.DebugSetPosition(0, FindNode(probe.Map, 0, RunRoomType.Event));
            probe.ResolveCurrentRoom();
            var probeChoices = probe.DrawEventChoices();
            if (probeChoices[0].Id != "timeskip_move") continue;
            probe.ChooseEvent(0);
            while (probe.Phase == RunPhase.Chest) probe.OpenNextChest();
            Check(probe.Phase == RunPhase.Ready && probe.Turns == 0, "timeskip must not chain-move (链式移动已停用)");
            foundTimeskip = true;
        }
        Check(foundTimeskip, "timeskip event should appear within 300 seeds");
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
        run.DebugSetPosition(0, FindNode(run.Map, 0, RunRoomType.Event)); run.ResolveCurrentRoom(); Check(run.Phase == RunPhase.Event, "event room did not open choices");
        var choices = run.DrawEventChoices(); Check(choices.Count > 0 && choices.All(x => !string.IsNullOrWhiteSpace(x.Id)), "event choice list missing");
        run.ChooseEvent(0); while (run.Phase == RunPhase.Chest) run.OpenNextChest();
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
        Check(roundTrip.VisitedNodes.SequenceEqual(snap.VisitedNodes), "save must carry visited nodes");
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

    private static int FindNode(RunMap map, int layerIdx, RunRoomType type, int occurrence = 0)
    {
        var matches = map.Layers[layerIdx].Nodes.Where(n => n.Type == type).Select(n => n.Idx).ToArray();
        if (occurrence >= matches.Length)
            throw new InvalidOperationException($"map seed {map.Seed} layer {layerIdx} lacks {type} (occurrence {occurrence})");
        return matches[occurrence];
    }
}
