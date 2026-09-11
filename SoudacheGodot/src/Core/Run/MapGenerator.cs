using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Soudache;

// ported from src/map-generator.js（208 行，四层种子化生成器）。
// TARGETS=[13,15,17,15] 四层共 60 节点、WIDTHS=[7,8,9,8]、行 -3..3；
// 每层独立命名种子流（`${seed}:attempt:${a}:layer:${li}`）；最多 8 次候选举优；
// 保底与质量规则逐条对齐真源（v0.53.3 / LAYOUT_VERSION=5）：
//   每层 ≤1 火堆 + ≤1 补给站且 x≥2、功能房互不相邻、搜刮点保底 1 上限 4、
//   战斗保底 3 上限 4、禁三连战、缺火堆/补给站自动补、L3 唯一紧急撤离点、
//   L4 终局三连 altar→boss→extraction。
// RNG 口径（HANDOFF §0.1）：不逐位复刻网页 mulberry32，用骨架 DeterministicRng
// 以 FNV-1a(种子字符串) 为种，只保 Godot 内部确定性（同 seed 同结果）。

public static class MapGenerator
{
    public static readonly IReadOnlyList<int> Targets = new[] { 13, 15, 17, 15 };
    public static readonly IReadOnlyList<int> Widths = new[] { 7, 8, 9, 8 };
    public const int RowMin = -3;
    public const int RowMax = 3;
    public const int GeneratorVersion = 3;
    // v5：2026-09-10 玩法定版——每层物资格（搜刮点）保底 1 格、上限 4 格；野生敌人格上限 4 格不变
    public const int LayoutVersion = 5;
    public const int MaxAttempts = 8;

    private const int GrowthAttemptLimit = 512;
    private const int TripleBattleGuard = 64;
    private const int BattleMinGuard = 16;
    private const int BattleCap = 4;
    private const int ChestCap = 4;
    private const int BattleMin = 3;

    /// <summary>种子 → 四层地图；内部最多 MaxAttempts 次候选举优，全部失败抛异常（同网页版）。</summary>
    public static LayeredMap Generate(ulong seed)
    {
        var issues = new List<string>();
        for (var attempt = 0; attempt < MaxAttempts; attempt++)
        {
            var layers = Build(seed, attempt);
            issues = Validate(layers);
            if (issues.Count == 0)
                return new LayeredMap(seed, GeneratorVersion, LayoutVersion, attempt + 1, layers);
        }
        throw new InvalidOperationException(
            $"地图生成失败：{MaxAttempts} 次候选均未通过质量校验（{string.Join("；", issues)}）");
    }

    /// <summary>质量校验（=网页版 quality/validateGeneratedMap）。返回问题列表，空列表表示通过。</summary>
    public static List<string> Validate(IReadOnlyList<GeneratedLayer> layers)
    {
        var issues = new List<string>();
        if (layers.Count != 4) issues.Add("必须生成四层");
        for (var li = 0; li < layers.Count; li++)
        {
            var layer = layers[li];
            var layerNo = li + 1;
            if (layer.Nodes.Count != Targets[li]) issues.Add($"层 {layerNo} 节点数异常");
            if (layer.Entry == layer.Exit) issues.Add($"层 {layerNo} 入口出口相同");
            var coords = new HashSet<(int X, int Row)>();
            var sameLayerEdges = 0;
            foreach (var node in layer.Nodes)
            {
                if (!coords.Add((node.X, node.Row))) issues.Add($"重复坐标 {li},{node.X},{node.Row}");
                var sameLayerDegree = 0;
                foreach (var edge in node.Next)
                {
                    if (edge.ToLayer != li) continue;
                    sameLayerDegree++;
                    if (edge.ToIdx < 0 || edge.ToIdx >= layer.Nodes.Count
                        || Math.Abs(layer.Nodes[edge.ToIdx].X - node.X) + Math.Abs(layer.Nodes[edge.ToIdx].Row - node.Row) != 1)
                        issues.Add($"非四向边 {li},{node.Idx}");
                }
                if (sameLayerDegree > 4) issues.Add($"层 {layerNo} 节点度数超过4");
                sameLayerEdges += sameLayerDegree;
            }
            // 入口可达全部节点（无孤岛）
            var seen = new HashSet<int> { layer.Entry };
            var queue = new Queue<int>();
            queue.Enqueue(layer.Entry);
            while (queue.Count > 0)
            {
                var idx = queue.Dequeue();
                foreach (var edge in layer.Nodes[idx].Next)
                    if (edge.ToLayer == li && seen.Add(edge.ToIdx)) queue.Enqueue(edge.ToIdx);
            }
            if (seen.Count != layer.Nodes.Count) issues.Add($"层 {layerNo} 存在孤岛");
            if (layer.Nodes.Count(n => n.Next.Count(e => e.ToLayer == li) >= 3) < 2) issues.Add($"层 {layerNo} 分叉不足");
            if (sameLayerEdges / 2 - layer.Nodes.Count + 1 < 1) issues.Add($"层 {layerNo} 没有回环");
            var bounds = layer.GridBounds;
            if (bounds is null || bounds.MaxX <= bounds.MinX || bounds.MaxRow <= bounds.MinRow) issues.Add($"层 {layerNo} 缺少有效 bounds");
            if (li == 3 && layer.Nodes.Count(n => n.Type == RunRoomType.Altar) != 1) issues.Add("层 4 缺少祭坛格");
            if (li == 3 && layer.Nodes.Count(n => n.Type == RunRoomType.Boss) != 1) issues.Add("层 4 缺少首脑格");
            if (layer.Nodes.Count(n => n.Type == RunRoomType.Battle) > BattleCap) issues.Add($"层 {layerNo} 战斗格超过 4");
            if (layer.Nodes.Count(n => n.Type == RunRoomType.Chest) > ChestCap) issues.Add($"层 {layerNo} 宝箱格（物资格）超过 4");
            if (layer.Nodes.Count(n => n.Type == RunRoomType.Chest) < 1) issues.Add($"层 {layerNo} 缺少物资格（宝箱格）");
            if (layer.Nodes.Any(n => (n.Type == RunRoomType.Campfire || n.Type == RunRoomType.Shop) && n.X < 2))
                issues.Add($"层 {layerNo} 火堆/补给站贴着入口");
        }
        // 层间门：双向边存在且指向下一层
        for (var li = 0; li < layers.Count - 1; li++)
        {
            var door = layers[li].Doors.Count > 0 ? layers[li].Doors[0] : null;
            var next = layers[li + 1];
            var forwardOk = door is not null && door.ToLayer == li + 1
                && layers[li].Nodes[door.At].Next.Any(e => e.ToLayer == li + 1 && e.ToIdx == door.ArriveAt)
                && next.Nodes[door.ArriveAt].Next.Any(e => e.ToLayer == li && e.ToIdx == door.At);
            if (!forwardOk) issues.Add($"层间门 {li} 非法");
        }
        return issues;
    }

    private static IReadOnlyList<GeneratedLayer> Build(ulong seed, int attempt)
    {
        var builtLayers = new List<(List<GenNode> Nodes, int Entry, int Exit)>();
        for (var li = 0; li < Targets.Count; li++)
        {
            var rng = LayerRng(seed, attempt, li);
            builtLayers.Add(MakeLayer(li, Targets[li], Widths[li], rng));
        }
        // 撤离只发生在第三层（紧急撤离点）与第四层（击败首脑后的终局撤离点）——
        // 环间门不再挂 exit 免费撤离标记，一律只向深处通行。
        var doors = new List<IReadOnlyList<RunDoor>> { Array.Empty<RunDoor>(), Array.Empty<RunDoor>(), Array.Empty<RunDoor>(), Array.Empty<RunDoor>() };
        for (var li = 0; li < 3; li++)
        {
            var from = builtLayers[li].Nodes[builtLayers[li].Exit];
            var to = builtLayers[li + 1].Nodes[builtLayers[li + 1].Entry];
            AddEdge(from, to);
            doors[li] = new[] { new RunDoor($"p{li + 1}", from.Idx, li + 1, to.Idx, false) };
        }
        return builtLayers.Select((layer, li) =>
        {
            var nodes = layer.Nodes;
            var frozen = nodes.Select(n => n.Freeze(li)).ToArray();
            return new GeneratedLayer(frozen, layer.Entry, layer.Exit,
                new MapGridBounds(0, Widths[li] - 1, RowMin, RowMax), doors[li]);
        }).ToArray();
    }

    /// <summary>每层独立命名种子流：`${seed}:attempt:${attempt}:layer:${li}` → FNV-1a → DeterministicRng。</summary>
    internal static DeterministicRng LayerRng(ulong seed, int attempt, int li) =>
        new(FnvHash($"{seed}:attempt:{attempt}:layer:{li}"));

    internal static ulong FnvHash(string text)
    {
        // 网页版 hashSeed：FNV-1a 32 位（Math.imul 语义）；0 归 0x9e3779b9。
        unchecked
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            uint hash = 2166136261;
            foreach (var b in bytes)
            {
                hash ^= b;
                hash *= 16777619;
            }
            return hash == 0 ? 0x9e3779b9UL : hash;
        }
    }

    // ---------- 生成器内部可变节点（结束后冻结为 MapNode） ----------
    private sealed class GenNode
    {
        public int Li; public int Idx; public int X; public int Row;
        public RunRoomType Type; public string Name = "";
        public readonly List<MapEdge> Next = new();

        public MapNode Freeze(int li) =>
            new($"L{li + 1}_N{Idx + 1}", li, Idx, X, Row, Type, Name, Next);
    }

    private static bool Adjacent(GenNode a, GenNode b) => Math.Abs(a.X - b.X) + Math.Abs(a.Row - b.Row) == 1;

    private static void AddEdge(GenNode a, GenNode b)
    {
        if (!a.Next.Any(e => e.ToLayer == b.Li && e.ToIdx == b.Idx)) a.Next.Add(new MapEdge(b.Li, b.Idx));
        if (!b.Next.Any(e => e.ToLayer == a.Li && e.ToIdx == a.Idx)) b.Next.Add(new MapEdge(a.Li, a.Idx));
    }

    private static (List<GenNode> Nodes, int Entry, int Exit) MakeLayer(int li, int target, int width, DeterministicRng random)
    {
        var nodes = MakeCoords(li, target, width, random);
        AssignRawTypes(nodes, random);
        for (var a = 0; a < nodes.Count; a++)
            for (var b = a + 1; b < nodes.Count; b++)
                if (Adjacent(nodes[a], nodes[b]))
                    AddEdge(nodes[a], nodes[b]);
        // 入口 = x===0 的第一个节点；出口 = 最大 x 的第一个节点（li==3 为终局撤离点，其余为层间门）
        // （网页版 exit 用 reduce 严格大于：取第一个达到最大 x 的下标）
        var entry = nodes.FindIndex(n => n.X == 0);
        var exit = 0;
        for (var i = 1; i < nodes.Count; i++)
            if (nodes[i].X > nodes[exit].X) exit = i;
        nodes[entry].Type = RunRoomType.Entrance;
        nodes[exit].Type = li == 3 ? RunRoomType.Extraction : RunRoomType.Door;

        ApplyQuantityCaps(nodes);
        DedupFacilities(nodes);
        EnforceFacilityGuarantees(nodes);
        EnforceChestGuarantee(nodes);
        if (li == 2) PlaceEmergencyExit(nodes);
        BreakTripleBattles(nodes);
        EnforceBattleMinimum(nodes);
        TrimBattleOverflow(nodes);
        if (li == 3) PlaceFinalTrio(nodes);

        AssignNames(li, nodes);
        return (nodes, entry, exit);
    }

    /// <summary>主脊（横竖交替蜿蜒）+ 随机生长到目标节点数。</summary>
    private static List<GenNode> MakeCoords(int li, int target, int width, DeterministicRng random)
    {
        var coords = new List<GenNode>();
        var occupied = new HashSet<(int X, int Row)>();
        void Add(int x, int row)
        {
            if (occupied.Add((x, row))) coords.Add(new GenNode { Idx = coords.Count, X = x, Row = row });
        }
        var row = (RowMin + RowMax) / 2 + Pick(random, new[] { -1, 0, 1 });
        Add(0, row);
        for (var x = 0; x < width - 1; x++)
        {
            var step = Pick(random, new[] { -1, 1 });
            var nextRow = Math.Max(RowMin + 1, Math.Min(RowMax - 1, row + step));
            Add(x, nextRow);
            row = nextRow;
            Add(x + 1, row);
        }
        // Idx 需与最终下标一致：生长完成后统一重排。
        var growthAttempts = 0;
        while (coords.Count < target && growthAttempts++ < GrowthAttemptLimit)
        {
            var source = coords[random.NextInt(coords.Count)];
            var candidates = new List<(int X, int Row)>();
            foreach (var (dx, dr) in new[] { (-1, 0), (1, 0), (0, -1), (0, 1) })
            {
                var (cx, cr) = (source.X + dx, source.Row + dr);
                if (cx >= 0 && cx < width && cr >= RowMin && cr <= RowMax && !occupied.Contains((cx, cr)))
                    candidates.Add((cx, cr));
            }
            if (candidates.Count > 0)
            {
                var next = candidates[random.NextInt(candidates.Count)];
                occupied.Add(next);
                coords.Add(new GenNode { Idx = coords.Count, X = next.X, Row = next.Row });
            }
        }
        if (coords.Count < target) throw new InvalidOperationException("候选网格无法扩展到目标节点数");
        for (var i = 0; i < coords.Count; i++)
        {
            coords[i].Idx = i;
            coords[i].Li = li;
        }
        return coords;
    }

    /// <summary>初始类型：战斗 2/6、事件/火堆/搜刮点/补给站/精英战(=战斗) 各 1/6。</summary>
    private static void AssignRawTypes(List<GenNode> nodes, DeterministicRng random)
    {
        var raw = new[]
        {
            (RunRoomType.Battle, 2), (RunRoomType.Event, 1), (RunRoomType.Campfire, 1),
            (RunRoomType.Chest, 1), (RunRoomType.Shop, 1), (RunRoomType.Battle, 1)
        };
        foreach (var node in nodes)
        {
            var pick = random.NextInt(raw.Length);
            node.Type = raw[pick].Item1;
        }
    }

    /// <summary>数量与位置定版：战斗/搜刮点 ≤4（超出降级事件）、火堆/补给站不在入口附近（x<2 降级事件）。</summary>
    private static void ApplyQuantityCaps(List<GenNode> nodes)
    {
        var battles = 0;
        var chests = 0;
        foreach (var node in nodes)
        {
            if (node.Type == RunRoomType.Battle)
            {
                battles++;
                if (battles > BattleCap) node.Type = RunRoomType.Event;
            }
            else if (node.Type == RunRoomType.Chest)
            {
                chests++;
                if (chests > ChestCap) node.Type = RunRoomType.Event;
            }
            else if ((node.Type == RunRoomType.Campfire || node.Type == RunRoomType.Shop) && node.X < 2)
                node.Type = RunRoomType.Event;
        }
    }

    /// <summary>每层最多 1 个火堆 / 1 个补给站——多出来的降级为战斗（后续规则再平衡）。</summary>
    private static void DedupFacilities(List<GenNode> nodes)
    {
        foreach (var type in new[] { RunRoomType.Campfire, RunRoomType.Shop })
        {
            var seen = 0;
            foreach (var node in nodes)
            {
                if (node.Type != type) continue;
                if (seen++ == 0) continue;
                node.Type = RunRoomType.Battle;
            }
        }
    }

    private static bool IsKeyRoom(RunRoomType type) => type is RunRoomType.Campfire or RunRoomType.Shop;
    private static bool IsFacility(RunRoomType type) => type is RunRoomType.Campfire or RunRoomType.Chest or RunRoomType.Shop;
    private static bool IsSpecial(RunRoomType type) => type is RunRoomType.Entrance or RunRoomType.Door or RunRoomType.Extraction;

    /// <summary>火堆/补给站保底：互不相邻（相邻的后者降级战斗），缺就在 x≥2 的深处补。</summary>
    private static void EnforceFacilityGuarantees(List<GenNode> nodes)
    {
        foreach (var a in nodes)
        {
            if (!IsKeyRoom(a.Type)) continue;
            foreach (var b in nodes)
            {
                if (a.Idx >= b.Idx) continue;
                if (IsKeyRoom(b.Type) && Adjacent(a, b)) b.Type = RunRoomType.Battle;
            }
        }
        var placed = new List<GenNode>();
        var battleCount = () => nodes.Count(n => n.Type == RunRoomType.Battle);
        bool IsConvertible(GenNode n, bool hard = false)
        {
            if (IsSpecial(n.Type) || IsFacility(n.Type) || placed.Contains(n)) return false;
            if (n.Type == RunRoomType.Battle && battleCount() <= (hard ? 1 : 2)) return false;
            return true;
        }
        int DistToKey(GenNode n) => nodes.Where(m => IsKeyRoom(m.Type))
            .Select(m => Math.Abs(n.X - m.X) + Math.Abs(n.Row - m.Row)).DefaultIfEmpty(int.MaxValue).Min();
        // 落点优先级：不贴功能房的格子 > 离功能房最远的格子；同类内优先吃事件格。
        // 火堆/补给站远离入口：只在 x ≥ 2 的格子里补。
        foreach (var type in new[] { RunRoomType.Campfire, RunRoomType.Shop })
        {
            if (nodes.Any(n => n.Type == type)) continue;
            var pool = nodes.Where(n => IsConvertible(n) && n.X >= 2
                    && !nodes.Any(m => m != n && IsKeyRoom(m.Type) && Adjacent(n, m)))
                .OrderBy(IsEventOrder).ThenBy(n => n.Idx).ToList();
            if (pool.Count == 0)
                pool = nodes.Where(n => IsConvertible(n, hard: true) && n.X >= 2)
                    .OrderByDescending(DistToKey).ThenBy(IsEventOrder).ThenBy(n => n.Idx).ToList();
            if (pool.Count > 0)
            {
                pool[0].Type = type;
                placed.Add(pool[0]);
            }
        }
        // —— 收敛（移植强化，真源坑修补）：网页版 pool2 硬兜底不带「不贴功能房」过滤，
        // 且 quality 不校验功能房相邻——极端网格会把火堆贴着补给站补（真源注释意图是互不相邻）。
        // 这里补一轮「相邻降级 → 仅用非邻格重补」，保证不变量恒成立；网格不足时与网页同样放行。
        for (var pass = 0; pass < 4; pass++)
        {
            var demoted = false;
            foreach (var a in nodes)
            {
                if (!IsKeyRoom(a.Type)) continue;
                foreach (var b in nodes)
                {
                    if (a.Idx >= b.Idx || !IsKeyRoom(b.Type) || !Adjacent(a, b)) continue;
                    b.Type = RunRoomType.Battle;
                    demoted = true;
                }
            }
            RunRoomType? missing = null;
            foreach (var type in new[] { RunRoomType.Campfire, RunRoomType.Shop })
                if (!nodes.Any(n => n.Type == type)) { missing = type; break; }
            if (!demoted && missing is null) break;
            if (missing is not null)
            {
                var type = missing.Value;
                var pool = nodes.Where(n => IsConvertible(n) && n.X >= 2
                        && !nodes.Any(m => m != n && IsKeyRoom(m.Type) && Adjacent(n, m)))
                    .OrderBy(IsEventOrder).ThenBy(n => n.Idx).ToList();
                if (pool.Count == 0)
                    pool = nodes.Where(n => IsConvertible(n, hard: true) && n.X >= 2
                            && !nodes.Any(m => m != n && IsKeyRoom(m.Type) && Adjacent(n, m)))
                        .OrderByDescending(DistToKey).ThenBy(IsEventOrder).ThenBy(n => n.Idx).ToList();
                if (pool.Count > 0)
                {
                    pool[0].Type = type;
                    placed.Add(pool[0]);
                }
            }
        }
    }

    private static int IsEventOrder(GenNode n) => n.Type == RunRoomType.Event ? 0 : 1;

    /// <summary>物资格保底：缺就补在普通格上（优先事件格；战斗不足 3 场时不动战斗格）。</summary>
    private static void EnforceChestGuarantee(List<GenNode> nodes)
    {
        if (nodes.Any(n => n.Type == RunRoomType.Chest)) return;
        var evPool = nodes.Where(n => n.Type == RunRoomType.Event).ToList();
        var btPool = nodes.Count(n => n.Type == RunRoomType.Battle) > BattleMin
            ? nodes.Where(n => n.Type == RunRoomType.Battle).ToList() : new List<GenNode>();
        var pool = evPool.Count > 0 ? evPool : btPool;
        if (pool.Count > 0) pool.OrderBy(IsEventOrder).ThenBy(n => n.Idx).First().Type = RunRoomType.Chest;
    }

    /// <summary>紧急撤离点只放第三层（li==2，献祭 3 张卡牌撤离）。</summary>
    private static void PlaceEmergencyExit(List<GenNode> nodes)
    {
        var evPool = nodes.Where(n => n.Type == RunRoomType.Event).ToList();
        var btPool = nodes.Count(n => n.Type == RunRoomType.Battle) > BattleMin
            ? nodes.Where(n => n.Type == RunRoomType.Battle).ToList() : new List<GenNode>();
        var pool = evPool.Count > 0 ? evPool : btPool;
        if (pool.Count > 0) pool.OrderBy(IsEventOrder).ThenBy(n => n.Idx).First().Type = RunRoomType.EmergencyExit;
    }

    /// <summary>禁三连战：把同时邻接 ≥2 个战斗节点的格子降级为事件，直到每个战斗邻居 ≤1。</summary>
    private static void BreakTripleBattles(List<GenNode> nodes)
    {
        for (var guard = 0; guard < TripleBattleGuard; guard++)
        {
            var over = nodes.FirstOrDefault(n => n.Type == RunRoomType.Battle
                && nodes.Count(m => m.Type == RunRoomType.Battle && Adjacent(n, m)) > 1);
            if (over is null) break;
            over.Type = RunRoomType.Event;
        }
    }

    /// <summary>战斗下限 3：只挑「自身至多邻接 1 个战斗格、且这些邻居也没别的战斗邻居」的事件格补，不制造三连战。</summary>
    private static void EnforceBattleMinimum(List<GenNode> nodes)
    {
        for (var guard = 0; guard < BattleMinGuard && nodes.Count(n => n.Type == RunRoomType.Battle) < BattleMin; guard++)
        {
            var cand = nodes.FirstOrDefault(n =>
            {
                if (n.Type != RunRoomType.Event) return false;
                var bn = nodes.Where(m => m != n && m.Type == RunRoomType.Battle && Adjacent(n, m)).ToList();
                if (bn.Count > 1) return false;
                return bn.All(m => nodes.Count(q => q != m && q != n && q.Type == RunRoomType.Battle && Adjacent(m, q)) == 0);
            });
            if (cand is null) break;
            cand.Type = RunRoomType.Battle;
        }
    }

    /// <summary>战斗上限 4：下限补足后再裁一次（防间距/撤离点规则把多余战斗格留场上）。</summary>
    private static void TrimBattleOverflow(List<GenNode> nodes)
    {
        var battles = 0;
        foreach (var node in nodes)
        {
            if (node.Type != RunRoomType.Battle) continue;
            battles++;
            if (battles > BattleCap) node.Type = RunRoomType.Event;
        }
    }

    /// <summary>第四层终局三连：候选池（事件/搜刮格）按纵深取最深处为首脑、其前一格为祭坛。</summary>
    private static void PlaceFinalTrio(List<GenNode> nodes)
    {
        var sorted = nodes.Where(n => n.Type is RunRoomType.Event or RunRoomType.Chest)
            .OrderBy(n => n.X).ThenBy(n => n.Row).ToList();
        if (sorted.Count < 2) return;
        sorted[^1].Type = RunRoomType.Boss;
        sorted[^2].Type = RunRoomType.Altar;
    }

    private static void AssignNames(int li, List<GenNode> nodes)
    {
        foreach (var node in nodes) node.Name = DefaultName(li, node.Type);
    }

    /// <summary>节点名忠实于类型（网页版 2026-09-09 定版）：出口/入口/终局有专名，其余 `N层·类型`。</summary>
    private static string DefaultName(int li, RunRoomType type) => type switch
    {
        RunRoomType.Entrance => li == 0 ? "外围入口" : $"第{li + 1}层入口",
        RunRoomType.Door => $"通往第{li + 2}层",
        RunRoomType.Extraction => "终局撤离点",
        RunRoomType.Battle => $"{li + 1}层·战斗",
        RunRoomType.Event => $"{li + 1}层·事件",
        RunRoomType.Campfire => $"{li + 1}层·火堆",
        RunRoomType.Chest => $"{li + 1}层·搜刮点",
        RunRoomType.Shop => $"{li + 1}层·补给站",
        RunRoomType.EmergencyExit => $"{li + 1}层·紧急撤离点",
        RunRoomType.Altar => $"{li + 1}层·祭坛",
        RunRoomType.Boss => $"{li + 1}层·首脑",
        _ => $"{li + 1}层·据点"
    };

    private static T Pick<T>(DeterministicRng random, IReadOnlyList<T> values) => values[random.NextInt(values.Count)];
}
