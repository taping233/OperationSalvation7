using System;
using System.Collections.Generic;
using System.Linq;

namespace Soudache;

public enum RunRoomType
{
    Empty, Coin, Wood, Rations, Key, Battle, Event, Shop, Campfire, Chest,
    EmergencyExit, Door, AltarEntrance, Altar, Boss, Extraction
}

public enum RunRisk { Low, Medium, High, Elite }

public sealed record RunRoom(RunRoomType Type, int Amount = 1);

public sealed record RunDoor(string Pair, int At, int ToLayer, int ArriveAt, bool IsExit);

public sealed record RunEnemy(string Id, string Name, int Hp, int Attack, bool Elite = false);

public sealed class RunLayer
{
    private readonly Dictionary<int, RunRoom> _rooms;

    public string Id { get; }
    public string Name { get; }
    public int RingSize { get; }
    public RunRisk Risk { get; }
    public IReadOnlyDictionary<int, RunRoom> Rooms => _rooms;
    public IReadOnlyList<RunDoor> Doors { get; }
    public IReadOnlySet<int> AltarEntrances { get; }

    public RunLayer(string id, string name, int ringSize, RunRisk risk,
        IDictionary<int, RunRoom>? rooms = null, IEnumerable<RunDoor>? doors = null,
        IEnumerable<int>? altarEntrances = null)
    {
        Id = id;
        Name = name;
        RingSize = ringSize;
        Risk = risk;
        _rooms = rooms is null ? new Dictionary<int, RunRoom>() : new Dictionary<int, RunRoom>(rooms);
        Doors = (doors ?? Array.Empty<RunDoor>()).ToArray();
        AltarEntrances = new HashSet<int>(altarEntrances ?? Array.Empty<int>());
        foreach (var room in _rooms.Keys)
            if (room < 0 || room >= ringSize) throw new ArgumentOutOfRangeException(nameof(rooms));
        foreach (var door in Doors)
            if (door.At < 0 || door.At >= ringSize) throw new ArgumentOutOfRangeException(nameof(doors));
    }

    public RunRoom RoomAt(int index) => _rooms.TryGetValue(index, out var room) ? room : new RunRoom(RunRoomType.Empty);
    public RunDoor? DoorAt(int index) => Doors.FirstOrDefault(door => door.At == index);
    public bool HasAltarEntrance(int index) => AltarEntrances.Contains(index);
}

/// <summary>Immutable topology and encounter tables copied from map.json/mapData.js.</summary>
public sealed class RunMap
{
    public static readonly int[] RingSizes = { 28, 20, 12 };
    public IReadOnlyList<RunLayer> Layers { get; }
    public IReadOnlyList<(string Id, string Name, int Hp, int Attack)> Bosses { get; }

    public RunMap(IEnumerable<RunLayer> layers,
        IEnumerable<(string Id, string Name, int Hp, int Attack)>? bosses = null)
    {
        Layers = layers.ToArray();
        if (Layers.Count != 3 || !Layers.Select(x => x.RingSize).SequenceEqual(RingSizes))
            throw new ArgumentException("Run maps must contain rings sized 28/20/12.", nameof(layers));
        Bosses = (bosses ?? Array.Empty<(string, string, int, int)>()).ToArray();
    }

    public static RunMap CreateDefault()
    {
        var l1 = new Dictionary<int, RunRoom>
        {
            [2] = new(RunRoomType.Coin, 2), [3] = new(RunRoomType.Shop), [4] = new(RunRoomType.Event),
            [5] = new(RunRoomType.Battle), [6] = new(RunRoomType.Wood), [9] = new(RunRoomType.Coin, 2),
            [10] = new(RunRoomType.Battle), [11] = new(RunRoomType.Event), [12] = new(RunRoomType.Battle),
            [13] = new(RunRoomType.Battle), [16] = new(RunRoomType.Battle), [17] = new(RunRoomType.Chest),
            [18] = new(RunRoomType.Event), [19] = new(RunRoomType.Coin, 2), [20] = new(RunRoomType.Battle),
            [23] = new(RunRoomType.Campfire), [24] = new(RunRoomType.Campfire), [25] = new(RunRoomType.Event),
            [26] = new(RunRoomType.Battle), [27] = new(RunRoomType.Wood)
        };
        var l2 = new Dictionary<int, RunRoom>
        {
            [0] = new(RunRoomType.Coin, 2), [1] = new(RunRoomType.Campfire), [2] = new(RunRoomType.Campfire),
            [3] = new(RunRoomType.Battle), [4] = new(RunRoomType.Event), [5] = new(RunRoomType.Coin, 2),
            [6] = new(RunRoomType.Battle), [7] = new(RunRoomType.Rations), [8] = new(RunRoomType.Battle),
            [9] = new(RunRoomType.Coin, 4), [10] = new(RunRoomType.Coin, 2), [11] = new(RunRoomType.Battle),
            [12] = new(RunRoomType.Key), [13] = new(RunRoomType.Shop), [14] = new(RunRoomType.Battle),
            [15] = new(RunRoomType.Coin, 2), [16] = new(RunRoomType.Battle), [17] = new(RunRoomType.Coin, 3),
            [18] = new(RunRoomType.Shop), [19] = new(RunRoomType.Event)
        };
        var l3 = new Dictionary<int, RunRoom>
        {
            [0] = new(RunRoomType.Battle), [1] = new(RunRoomType.Coin, 4), [2] = new(RunRoomType.Wood, 2),
            [3] = new(RunRoomType.Battle), [4] = new(RunRoomType.Campfire), [5] = new(RunRoomType.Campfire),
            [6] = new(RunRoomType.Battle), [7] = new(RunRoomType.Event), [8] = new(RunRoomType.Shop),
            [9] = new(RunRoomType.Battle), [10] = new(RunRoomType.EmergencyExit), [11] = new(RunRoomType.Shop)
        };
        return new RunMap(new[]
        {
            new RunLayer("L1", "外环 · 荒地边缘", 28, RunRisk.Low, l1, new[]
            {
                new RunDoor("p1", 1, 1, 0, true), new RunDoor("p2", 8, 1, 5, true),
                new RunDoor("p3", 15, 1, 10, true), new RunDoor("p4", 22, 1, 15, true)
            }),
            new RunLayer("L2", "中环 · 废墟市街", 20, RunRisk.Medium, l2, new[]
            {
                new RunDoor("p5", 13, 2, 8, false), new RunDoor("p6", 18, 2, 11, false)
            }),
            new RunLayer("L3", "内环 · 污染核心区", 12, RunRisk.High, l3, altarEntrances: new[] { 1, 11 })
        }, new[]
        {
            ("boss_general", "锈蚀将军", 50, 5), ("boss_orc", "兽群之主", 45, 4), ("boss_elem", "辐射领主", 48, 8)
        });
    }

    public Dictionary<string, HashSet<string>> BuildAdjacency()
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        void Link(string a, string b)
        {
            if (!result.TryGetValue(a, out var aa)) result[a] = aa = new HashSet<string>();
            if (!result.TryGetValue(b, out var bb)) result[b] = bb = new HashSet<string>();
            aa.Add(b); bb.Add(a);
        }
        for (var layer = 0; layer < Layers.Count; layer++)
        {
            for (var i = 0; i < Layers[layer].RingSize; i++)
                Link($"{layer},{i}", $"{layer},{(i + 1) % Layers[layer].RingSize}");
            foreach (var door in Layers[layer].Doors)
                Link($"{layer},{door.At}", $"{door.ToLayer},{door.ArriveAt}");
            foreach (var altar in Layers[layer].AltarEntrances)
                Link($"{layer},{altar}", "altar,0");
        }
        return result;
    }

    public bool IsConnected(out IReadOnlyList<string> unreachable)
    {
        var graph = BuildAdjacency();
        var seen = new HashSet<string>(StringComparer.Ordinal) { "0,0" };
        var queue = new Queue<string>(); queue.Enqueue("0,0");
        while (queue.Count > 0)
            foreach (var next in graph[queue.Dequeue()])
                if (seen.Add(next)) queue.Enqueue(next);
        unreachable = graph.Keys.Where(x => !seen.Contains(x) && !x.StartsWith("altar,", StringComparison.Ordinal)).OrderBy(x => x).ToArray();
        return unreachable.Count == 0;
    }
}
