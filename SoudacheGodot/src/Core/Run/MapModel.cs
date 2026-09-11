using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

// ported from src/map-generator.js（数据形状）+ src/layeredMap.js（显示元数据）。
// 四层节点图模型：每层是四向网格上的无向图（生成器保证连通、无对角边），
// 层与层之间只靠 door（层间门）单向深入转移。节点 11 种：
// entrance/battle/event/fire(chest搜刮点/shop补给站)/emergencyExit/door/altar/boss/extraction。

public sealed record MapGridBounds(int MinX, int MaxX, int MinRow, int MaxRow);

/// <summary>一条邻接边：(目标层, 目标节点下标)。同层边四向相邻；跨层边只出现在层间门两端。</summary>
public sealed record MapEdge(int ToLayer, int ToIdx);

/// <summary>生成完成后的冻结节点（生成器内部构造，外部只读）。</summary>
public sealed class MapNode
{
    public string Id { get; }
    public int Li { get; }
    public int Idx { get; }
    public int X { get; }
    public int Row { get; }
    public RunRoomType Type { get; }
    public string Name { get; }
    public IReadOnlyList<MapEdge> Next { get; }

    internal MapNode(string id, int li, int idx, int x, int row, RunRoomType type, string name,
        IReadOnlyList<MapEdge> next)
    {
        Id = id; Li = li; Idx = idx; X = x; Row = row; Type = type; Name = name; Next = next;
    }
}

/// <summary>一层生成结果：节点表 + 入口/出口下标 + 网格边界 + 层间门。</summary>
public sealed class GeneratedLayer
{
    public IReadOnlyList<MapNode> Nodes { get; }
    public int Entry { get; }
    public int Exit { get; }
    public MapGridBounds GridBounds { get; }
    public IReadOnlyList<RunDoor> Doors { get; }

    internal GeneratedLayer(IReadOnlyList<MapNode> nodes, int entry, int exit,
        MapGridBounds gridBounds, IReadOnlyList<RunDoor> doors)
    {
        Nodes = nodes; Entry = entry; Exit = exit; GridBounds = gridBounds; Doors = doors;
    }
}

/// <summary>一次完整生成：四层 + 版本常量（GENERATOR_VERSION/LAYOUT_VERSION 随真源 map-generator.js）。</summary>
public sealed class LayeredMap
{
    public ulong Seed { get; }
    public int GeneratorVersion { get; }
    public int LayoutVersion { get; }
    public int AttemptsUsed { get; }
    public IReadOnlyList<GeneratedLayer> Layers { get; }
    public int TotalNodes => Layers.Sum(layer => layer.Nodes.Count);

    internal LayeredMap(ulong seed, int generatorVersion, int layoutVersion, int attemptsUsed,
        IReadOnlyList<GeneratedLayer> layers)
    {
        Seed = seed; GeneratorVersion = generatorVersion; LayoutVersion = layoutVersion;
        AttemptsUsed = attemptsUsed; Layers = layers;
    }
}

/// <summary>layeredMap.js 的显示命名：层名与配色（配色归 UI，这里只保留名称）。</summary>
public static class LayerNames
{
    public static readonly IReadOnlyList<string> Chinese = new[] { "外围荒地", "风雪哨线", "冻土遗迹", "污染核心" };

    public static string For(int li) => $"第{li + 1}层 · {Chinese[li]}";
}
