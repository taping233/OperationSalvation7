using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/map-generator.js（消费生成结果）+ src/layeredMap.js（层命名）
// + src/map-graph.js（连通性检查）+ src/mapData.js（祭坛 BOSS 表读 data/map.json altar.bosses）。
// 四层节点图：层内为四向网格图（生成器保证连通/回环/分叉），层间只靠 door 单向深入。
// 三环旧拓扑（28/20/12）已随批次 3 移除——地图一律由 MapGenerator 按种子产出。

public enum RunRoomType
{
    Entrance, Empty, Coin, Wood, Rations, Key, Battle, Event, Shop, Campfire, Chest,
    EmergencyExit, Door, AltarEntrance, Altar, Boss, Extraction
}

public enum RunRisk { Low, Medium, High, Elite }

public sealed record RunRoom(RunRoomType Type, int Amount = 1);

public sealed record RunDoor(string Pair, int At, int ToLayer, int ArriveAt, bool IsExit);

public sealed record RunEnemy(string Id, string Name, int Hp, int Attack, bool Elite = false);

/// <summary>一层节点图：节点表 + 入口/出口下标 + 网格边界 + 层间门（只向深处）。</summary>
public sealed class RunLayer
{
    public string Id { get; }
    public string Name { get; }
    public int Index { get; }
    public IReadOnlyList<MapNode> Nodes { get; }
    public int NodeCount => Nodes.Count;
    public int Entry { get; }
    public int Exit { get; }
    public MapGridBounds GridBounds { get; }
    public IReadOnlyList<RunDoor> Doors { get; }

    internal RunLayer(int index, GeneratedLayer generated)
    {
        Index = index;
        Id = $"layer-{index + 1}";
        Name = LayerNames.For(index);
        Nodes = generated.Nodes;
        Entry = generated.Entry;
        Exit = generated.Exit;
        GridBounds = generated.GridBounds;
        Doors = generated.Doors;
    }

    public RunRoomType TypeAt(int idx) => Nodes[idx].Type;
    public string NameAt(int idx) => Nodes[idx].Name;
    public RunDoor? DoorAt(int idx) => Doors.FirstOrDefault(door => door.At == idx);

    /// <summary>同层相邻节点（next 中 toLayer==本层），即玩家可直选的移动目标。</summary>
    public IReadOnlyList<int> NeighborsOf(int idx) =>
        Nodes[idx].Next.Where(edge => edge.ToLayer == Index).Select(edge => edge.ToIdx).ToArray();
}

/// <summary>四层拓扑 + BOSS 表。由种子经 MapGenerator 产出（同 seed 同地图）。</summary>
public sealed class RunMap
{
    public ulong Seed { get; }
    public int GeneratorVersion { get; }
    public int LayoutVersion { get; }
    public IReadOnlyList<RunLayer> Layers { get; }
    public IReadOnlyList<(string Id, string Name, int Hp, int Attack)> Bosses { get; }

    private readonly LayeredMap _generated;

    public RunMap(LayeredMap generated,
        IEnumerable<(string Id, string Name, int Hp, int Attack)>? bosses = null)
    {
        _generated = generated;
        Seed = generated.Seed;
        GeneratorVersion = generated.GeneratorVersion;
        LayoutVersion = generated.LayoutVersion;
        Layers = generated.Layers.Select((layer, index) => new RunLayer(index, layer)).ToArray();
        Bosses = (bosses ?? Array.Empty<(string, string, int, int)>()).ToArray();
    }

    public static RunMap Generate(ulong seed) => new(MapGenerator.Generate(seed), GameRuntime.Data.Bosses
        .Select(boss => (boss.Id, boss.Name, boss.Hp, boss.Attack))
        .ToArray());

    // ---------- 连通性检查（ported from src/map-graph.js）----------
    // 邻接表：层内 next 双向边 + 门转移边 + 祭坛入口→中央（v5 生成器不再产出祭坛入口，保留口径）。

    public Dictionary<string, HashSet<string>> BuildAdjacency()
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        void Link(string a, string b)
        {
            if (!result.TryGetValue(a, out var aa)) result[a] = aa = new HashSet<string>(StringComparer.Ordinal);
            if (!result.TryGetValue(b, out var bb)) result[b] = bb = new HashSet<string>(StringComparer.Ordinal);
            aa.Add(b); bb.Add(a);
        }
        var generated = _generated;
        for (var li = 0; li < Layers.Count; li++)
        {
            var nodes = generated.Layers[li].Nodes;
            for (var i = 0; i < nodes.Count; i++)
                foreach (var edge in nodes[i].Next)
                    Link($"{li},{i}", $"{edge.ToLayer},{edge.ToIdx}");
            foreach (var door in Layers[li].Doors)
                Link($"{li},{door.At}", $"{door.ToLayer},{door.ArriveAt}");
        }
        return result;
    }

    /// <summary>从第 1 层入口出发 flood-fill（map-graph.checkConnectivity）。返回不可达 'li,idx' 列表。</summary>
    public bool CheckConnectivity(out IReadOnlyList<string> unreachable)
    {
        var graph = BuildAdjacency();
        if (graph.Count == 0) { unreachable = Array.Empty<string>(); return true; }
        var starts = new List<string> { $"0,{Layers[0].Entry}" };
        var seen = new HashSet<string>(starts, StringComparer.Ordinal);
        var queue = new Queue<string>(starts);
        while (queue.Count > 0)
        {
            if (!graph.TryGetValue(queue.Dequeue(), out var neighbors)) continue;
            foreach (var next in neighbors)
                if (seen.Add(next)) queue.Enqueue(next);
        }
        unreachable = graph.Keys.Where(k => !seen.Contains(k) && !k.StartsWith("altar,", StringComparison.Ordinal))
            .OrderBy(k => k, StringComparer.Ordinal).ToArray();
        return unreachable.Count == 0;
    }

    public bool IsConnected(out IReadOnlyList<string> unreachable) => CheckConnectivity(out unreachable);
}
