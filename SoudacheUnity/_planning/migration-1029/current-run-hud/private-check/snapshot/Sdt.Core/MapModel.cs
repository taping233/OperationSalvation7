// ported from src/mapData.js
// 三环棋盘（8×8 抽象环）+ 分布式结点极坐标确定性布局（buildNodePositions）。
// 对局模式会临时调整治疗等数值，原版 MAP.rules 是 RULES 的可变副本——
// Unity 侧统一读 GameRules 静态常量（见 TODO-contracts.md W1 条目）。
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core
{
    /// <summary>13 种结点类型（契约 §2）。'entrance'（出生入口）无对应枚举值，见 MapNode.type。</summary>
    public enum NodeKind { Coin, Wood, Battle, Event, Shop, Fire, Chest, Rations, Key, EmergencyExit, Door, Altar, Boss, Resource, Extraction, Entrance }

    // —— 原版数据结构 ——
    public sealed class MapCell { public string type; public int? n; public string name; }
    public sealed class MapDoor { public string pair; public int at; public int toLayer; public int arriveAt; public bool exit; public bool reverse; }
    public sealed class MapAltarEntrance { public string pair; public int at; }
    public sealed class MapLayerDef
    {
        public string id, name, nameEn, color, risk, tempo;
        public int inset;
        public int[] entrances; public string[] entranceNames;
        public MapDoor[] doors; public MapAltarEntrance[] altarEntrances;
        public Dictionary<int, MapCell> cells;
    }
    public sealed class ItemDef { public string name; public int value; public string tier; }
    public sealed class RandomEvent
    {
        public int w;
        public int? coinsMin, coinsMax;   // coins: [min,max]
        public string item;
        public bool nothing;
        public string text;
    }
    public sealed class MonsterDef { public string id, name, behavior,eliteSkill,desc; public int atk, hp,damageCap; public bool elite,evenAttack; }
    public sealed class EncounterEntry { public string id; public int[] size; }
    public sealed class EncounterGroup { public string id,strategy; public string[] enemyIds; public int[] size; }
    public sealed class EliteEncounter { public string[] pool; public int sizeMin, sizeMax; public double chance; public string strategy; }
    public sealed class EncounterDef
    {
        public string[] pool; public int sizeMin, sizeMax; public string risk, strategy;
        public EliteEncounter elite;
        public EncounterEntry[] entries;
        public EncounterGroup[] groups;
        public string[] guaranteedElite;
    }
    public sealed class ChestKind
    {
        public string name, icon;
        public int? cards;            // 直接获得的随机卡张数
        public int? pickFrom;         // 随机 N 张选 1
        public int? coinsMin, coinsMax; // coins: [min,max]；null = 无币
        public string[] coinCards;    // BOSS：金币/银币/铜币其一
        public double? tokenChance;   // BOSS：金色令牌概率
    }
    public sealed class ChestPart { public string k; public int? n; public int? nMin, nMax; public int w; }
    public sealed class ChestDropSpec { public ChestPart[] fixedDrops, types, count; }
    public sealed class AltarBossDef
    {
        public string id, name, icon, affix, affixName, behavior, affixDesc;
        public int hp, atk; public int cellX, cellY;
    }
    public sealed class CenterDef { public int x, y; public string type, icon, name; }

    /// <summary>运行时逻辑格（game.session.js buildDerived：相连火堆合并为一个逻辑格）。</summary>
    public sealed class LogicalCell { public List<GridCell> grid; public bool fire; public int oldIdx; public MapCell def; }
    public sealed class GridCell { public int x, y; }
    public sealed class LayerData
    {
        public string id, name, nameEn, color;
        public string[] entranceNames;
        public List<int> entrances;
        public List<MapDoor> doors;
        public List<MapAltarEntrance> altarEntrances;
        public List<LogicalCell> logical;
        public Dictionary<int, int> toLogical;
    }

    /// <summary>棋盘结点：几何 + 逻辑位置 + 格子定义（li = layerIdx；中央区 li = -1）。</summary>
    public sealed class MapNode
    {
        public string id;        // "li,idx"（中央区 "c,idx"）
        public NodeKind kind;    // entrance 格 kind = (NodeKind)(-1)，以 type 字段为准（TODO-contracts W1）
        public int ring;         // = layerIdx（0 外 / 1 中 / 2 内 / -1 中央）
        public float x, y;       // 世界像素坐标
        public int layerIdx;
        public int idx;          // 逻辑格索引
        public string type;      // 原版 def.type（coin/wood/.../entrance/door/altar/boss）
        public string name;      // entrance/door/altar/boss 的显示名
        public bool exit;        // 门格：可从此撤离
        public MapCell def;      // 原始格子定义（可能为 null）
        public List<MapLink> next = new List<MapLink>();
    }

    /// <summary>三环棋盘模型（含结点布局与全部静态数据）。</summary>
    public sealed class MapModel
    {
        public MapSnapshot Snapshot { get; private set; }
        public IReadOnlyList<MapNode> Nodes { get; private set; }
        public IReadOnlyList<string> Layers { get; private set; }
        public List<LayerData> LayerData { get; private set; }
        /// <summary>nodePos[li][idx] 与 centerPos[祭坛+BOSS×3]（世界像素）。</summary>
        public List<List<GridPos>> NodePos { get; private set; }
        public List<GridPos> CenterPos { get; private set; }
        /// <summary>'li,idx' → 结点（对齐 game.cellDefs）。</summary>
        public Dictionary<string, MapNode> CellDefs { get; private set; }

        public sealed class GridPos { public float x, y; }

        /// <summary>确定性构建整个棋盘（同输入必得同输出；seed 保留参数但布局不使用随机数）。</summary>
        public static MapModel Build(int seed) => FromSnapshot(LayeredMapGenerator.Generate(seed.ToString(System.Globalization.CultureInfo.InvariantCulture)));

        public static MapModel FromSnapshot(MapSnapshot snapshot)
        {
            if(!LayeredMapGenerator.ValidateSnapshot(snapshot,out var reason))throw new ArgumentException(reason,nameof(snapshot));
            var m=new MapModel{Snapshot=snapshot,LayerData=new List<LayerData>(),NodePos=new List<List<GridPos>>(),CenterPos=new List<GridPos>(),CellDefs=new Dictionary<string,MapNode>()};
            var names=new[]{"外围荒地","风雪哨线","冻土遗迹","污染核心"};var english=new[]{"Outer Wastes","Blizzard Watchline","Permafrost Ruins","Polluted Core"};var colors=new[]{"#78b9d6","#9fcf8d","#d8ae68","#b77ad8"};var nodes=new List<MapNode>();
            for(int li=0;li<4;li++){
                var l=snapshot.layers[li];var positions=new List<GridPos>();var logical=new List<LogicalCell>();
                foreach(var n in l.nodes){var p=new GridPos{x=180+(n.x-l.gridBounds.minX)*180,y=180+(n.row-l.gridBounds.minRow)*180};positions.Add(p);var def=new MapCell{type=n.type,name=n.name};var node=new MapNode{id=li+","+n.idx,idx=n.idx,layerIdx=li,ring=li,x=p.x,y=p.y,type=n.type,name=n.name,kind=KindOf(n.type),def=def,next=n.next};nodes.Add(node);m.CellDefs.Add(node.id,node);logical.Add(new LogicalCell{grid=new List<GridCell>(),fire=n.type=="fire",oldIdx=n.idx,def=def});}
                m.NodePos.Add(positions);m.LayerData.Add(new LayerData{id="layer-"+(li+1),name=$"第{li+1}层 · {names[li]}",nameEn=$"Layer {li+1} · {english[li]}",color=colors[li],entrances=new List<int>{l.entry},entranceNames=new[]{l.nodes[l.entry].name},doors=l.doors,altarEntrances=new List<MapAltarEntrance>(),logical=logical,toLogical=Enumerable.Range(0,l.nodes.Count).ToDictionary(i=>i,i=>i)});
            }
            m.Nodes=nodes;m.Layers=m.LayerData.Select(l=>l.name).ToList();return m;
        }

        /// <summary>旧三环数据只供历史工具参考，桌面新局调用 Build。</summary>
        public static MapModel BuildLegacy(int seed)
        {
            var m = new MapModel();
            var rings = new List<List<GridCell>>();
            var layerData = new List<LayerData>();
            for (int li = 0; li < MapData.Layers.Length; li++)
            {
                rings.Add(MakeRing(MapData.Layers[li].inset));
                MapLayerDef layer = MapData.Layers[li];
                var cellsTable = layer.cells ?? new Dictionary<int, MapCell>();
                bool IsFire(int idx) { return cellsTable.TryGetValue(idx, out var c) && c.type == "fire"; }
                var logical = new List<LogicalCell>();
                var toLogical = new Dictionary<int, int>();
                for (int i = 0; i < rings[li].Count; i++)
                {
                    if (toLogical.ContainsKey(i)) continue;
                    var grid = new List<GridCell> { rings[li][i] };
                    toLogical[i] = logical.Count;
                    bool fire = IsFire(i);
                    MapCell def = fire ? new MapCell { type = "fire", name = "火堆" } : (cellsTable.TryGetValue(i, out var c0) ? c0 : null);
                    if (fire)
                    {
                        int j = i + 1;
                        while (j < rings[li].Count && IsFire(j))
                        {
                            grid.Add(rings[li][j]);
                            toLogical[j] = logical.Count;
                            j++;
                        }
                    }
                    logical.Add(new LogicalCell { grid = grid, fire = fire, oldIdx = i, def = def });
                }
                int Conv(int oldIdx) { return toLogical.TryGetValue(oldIdx, out int v) ? v : 0; }
                var entrances = new List<int>();
                foreach (var e in layer.entrances ?? new int[0]) entrances.Add(Conv(e));
                var doors = new List<MapDoor>();
                foreach (var d in layer.doors ?? new MapDoor[0])
                    doors.Add(new MapDoor { pair = d.pair, at = Conv(d.at), toLayer = d.toLayer, arriveAt = Conv(d.arriveAt), exit = d.exit });
                var altarEntrances = new List<MapAltarEntrance>();
                foreach (var a in layer.altarEntrances ?? new MapAltarEntrance[0])
                    altarEntrances.Add(new MapAltarEntrance { pair = a.pair, at = Conv(a.at) });
                layerData.Add(new LayerData
                {
                    id = layer.id, name = layer.name, nameEn = layer.nameEn, color = layer.color,
                    entranceNames = layer.entranceNames ?? new string[0],
                    entrances = entrances, doors = doors, altarEntrances = altarEntrances,
                    logical = logical, toLogical = toLogical,
                });
            }

            // 门为双向：在目标层生成对应的返回门（同 pair）
            for (int li = 0; li < layerData.Count; li++)
            {
                foreach (var d in layerData[li].doors.ToArray())
                {
                    var dst = layerData[d.toLayer];
                    bool exists = false;
                    foreach (var x in dst.doors) if (x.pair == d.pair && x.at == d.arriveAt) { exists = true; break; }
                    if (!exists)
                        dst.doors.Add(new MapDoor { pair = d.pair, at = d.arriveAt, toLayer = li, arriveAt = d.at, reverse = true });
                }
            }

            // 结点布局（分布式结点地图的几何唯一来源）
            var counts = new List<int>();
            foreach (var ld in layerData) counts.Add(ld.logical.Count);
            var layout = MapData.BuildNodePositions(counts);
            var nodes = new List<MapNode>();
            var cellDefs = new Dictionary<string, MapNode>();
            MapNode AddNode(int li, int idx, string type, string name, bool exit, MapCell def)
            {
                GridPos p = li == -1 ? layout.Center[idx] : layout.Layers[li][idx];
                var node = new MapNode
                {
                    id = (li == -1 ? "c," : li + ",") + idx,
                    kind = KindOf(type),
                    ring = li, x = p.x, y = p.y, layerIdx = li, idx = idx,
                    type = type, name = name, exit = exit, def = def,
                };
                nodes.Add(node);
                cellDefs[node.id] = node;
                return node;
            }
            for (int li = 0; li < layerData.Count; li++)
            {
                var ld = layerData[li];
                for (int idx = 0; idx < ld.logical.Count; idx++)
                {
                    var lc = ld.logical[idx];
                    string type = lc.def != null ? lc.def.type : null;
                    string name = lc.def != null ? lc.def.name : null;
                    int eIdx = ld.entrances.IndexOf(idx);
                    if (eIdx >= 0) { type = "entrance"; name = ld.entranceNames[eIdx]; }
                    AddNode(li, idx, type, name, false, lc.def);
                }
            }
            // 外圈出口门格（无其他事件）→ 门/撤 图标
            foreach (var d in layerData[0].doors)
            {
                if (cellDefs.TryGetValue("0," + d.at, out var info) && info.type == null)
                {
                    info.type = "door";
                    info.exit = d.exit;
                    info.name = "出口 / 环间门";
                    info.kind = KindOf("door");
                }
            }
            // 中央区：祭坛 + 三 BOSS（li=-1；战斗经由祭坛触发，这里只作渲染/悬浮）
            for (int k = 0; k < MapData.Center.Length; k++)
            {
                var cc = MapData.Center[k];
                AddNode(-1, k, cc.type, cc.name, false, new MapCell { type = cc.type, name = cc.name });
            }

            m.Nodes = nodes;
            m.LayerData = layerData;
            var names = new List<string>();
            foreach (var l in MapData.Layers) names.Add(l.name);
            m.Layers = names;
            m.NodePos = layout.Layers;
            m.CenterPos = layout.Center;
            m.CellDefs = cellDefs;
            return m;
        }

        // ---------- 三环轨道（对齐 mapData.js makeRing：顺时针一圈逻辑格坐标） ----------
        public static List<GridCell> MakeRing(int inset)
        {
            int size = 8 - inset * 2, o = inset;
            var ring = new List<GridCell>();
            for (int x = 0; x < size; x++) ring.Add(new GridCell { x = o + x, y = o });                    // 上边 →
            for (int y = 1; y < size; y++) ring.Add(new GridCell { x = o + size - 1, y = o + y });          // 右边 ↓
            for (int x = size - 2; x >= 0; x--) ring.Add(new GridCell { x = o + x, y = o + size - 1 });     // 下边 ←
            for (int y = size - 2; y >= 1; y--) ring.Add(new GridCell { x = o, y = o + y });                // 左边 ↑
            return ring;
        }

        /// <summary>type 字符串 → NodeKind；'entrance' 无对应枚举（返回 (NodeKind)(-1)，以 type 为准）。</summary>
        public static NodeKind KindOf(string type)
        {
            switch (type)
            {
                case "coin": return NodeKind.Coin;
                case "wood": return NodeKind.Wood;
                case "battle": return NodeKind.Battle;
                case "event": return NodeKind.Event;
                case "shop": return NodeKind.Shop;
                case "fire": return NodeKind.Fire;
                case "chest": return NodeKind.Chest;
                case "rations": return NodeKind.Rations;
                case "key": return NodeKind.Key;
                case "emergencyExit": return NodeKind.EmergencyExit;
                case "door": return NodeKind.Door;
                case "altar": return NodeKind.Altar;
                case "boss": return NodeKind.Boss;
                case "entrance": return NodeKind.Entrance;
                case "resource": return NodeKind.Resource;
                case "extraction": return NodeKind.Extraction;
                default: return (NodeKind)(-1);
            }
        }
    }

    /// <summary>MAP 静态数据（SDT.MAP 的 1:1 内容）。</summary>
    public static class MapData
    {
        public const string Version = "0.3";
        public const string BoardId = "B1";
        public const string BoardName = "第七净化区 · 三环荒土";
        // 30×30 仅作为世界坐标基准（1440px 世界）；轨道拓扑仍由 makeRing 的 8×8 抽象环生成
        public const int Cols = 30;
        public const int Rows = 30;
        public const int Tile = 48;

        // 结点布局参数（分布式结点地图的唯一真源）
        public static readonly int[] Radii = { 560, 390, 225 }; // 三环基础半径（外 / 中 / 内）
        public const int RadiusJitter = 44;                     // 半径抖动幅度（± 一半）
        public const double AngleJitter = 0.38;                 // 角度抖动（占相邻角距比例上限）
        public const int BossRadius = 96;                       // BOSS 结点环绕祭坛的半径
        public const int MinGap = 116;                          // 同环相邻结点最小间距

        // ---------- 物品 / 表格配置 ----------
        public static readonly IReadOnlyDictionary<string, ItemDef> Items = new Dictionary<string, ItemDef>
        {
            { "wood",    new ItemDef { name = "木材",     value = 5,   tier = "C" } },
            { "rations", new ItemDef { name = "口粮",     value = 15,  tier = "C" } },
            { "key",     new ItemDef { name = "神秘钥匙", value = 100, tier = "A" } },
        };
        // 小宝箱
        public static readonly ItemDef[] ChestTable =
        {
            new ItemDef { name = "绷带",     value = 45, tier = "C" },
            new ItemDef { name = "零散弹药", value = 35, tier = "C" },
            new ItemDef { name = "瓶装水",   value = 25, tier = "C" },
            new ItemDef { name = "旧地图",   value = 20, tier = "C" },
        };
        // 事件卡战斗敌人（盗匪横行 / 闪金之锤 等 <事件战斗>）
        public static readonly MonsterDef[] EventEnemies = { new MonsterDef { id = "bandit", name = "掠夺者", hp = 3, atk = 3 } };
        // 事件格
        public static readonly RandomEvent[] RandomEvents =
        {
            new RandomEvent { w = 3, coinsMin = 1, coinsMax = 3, text = "在瓦砾堆里捡到几枚旧世界硬币" },
            new RandomEvent { w = 2, item = "chest", text = "翻到一批先行者遗留的物资" },
            new RandomEvent { w = 2, nothing = true, text = "辐射风掠过荒原，什么也没发生" },
            new RandomEvent { w = 1, coinsMin = 4, coinsMax = 6, text = "找到一只未撬过的保险柜！" },
        };

        // ---------- 怪物图鉴（设计者 2026-09-02 定版，数值 = 攻击力-生命） ----------
        public static readonly IReadOnlyDictionary<string, MonsterDef> Monsters = CurrentMapData.Monsters;
        public static readonly EncounterDef[] Encounters = CurrentMapData.Encounters;
        // 兼容旧引用（事件战等）：统一指向新表
        public static readonly MonsterDef[] EnemyPool = { new MonsterDef { id = "bandit", name = "掠夺者", hp = 3, atk = 3 } };

        // ---------- 战斗胜利宝箱掉落（设计者 2026-09-02 定版：战胜怪物 100% 掉宝箱） ----------
        public static readonly IReadOnlyDictionary<string, ChestKind> ChestKinds = CurrentChestData.Kinds;
        // 环层掉落表（键 = layerIdx）：击败该环敌人掉什么，多组组合时等概率随机一组。
        // n 为 [min,max] 随机数量或固定数量。
        public static readonly ChestDropSpec[] LayerChests = CurrentChestData.Layers;

        // ---------- 中央祭坛区 ----------
        public const string CenterColor = "#4a3763";   // 暗紫：祭坛区
        public static readonly int[] AltarPos = { 3, 3 };
        public static readonly AltarBossDef[] AltarBosses = CurrentMapData.Bosses;
        // 中央 2×2（渲染与悬浮提示用；战斗经由祭坛触发）
        public static readonly CenterDef[] Center =
        {
            new CenterDef { x = 3, y = 3, type = "altar", name = "污染核心" },
            new CenterDef { x = 4, y = 3, type = "boss", icon = "将", name = "锈蚀将军 · 550HP" },
            new CenterDef { x = 3, y = 4, type = "boss", icon = "元", name = "辐射领主 · 400HP" },
            new CenterDef { x = 4, y = 4, type = "boss", icon = "兽", name = "兽群之主 · 320HP" },
        };

        // ---------- 三个环层 ----------
        public static readonly MapLayerDef[] Layers = BuildLayers();

        private static MapLayerDef[] BuildLayers()
        {
            return new[]
            {
                new MapLayerDef
                {
                    id = "L1", name = "外环 · 荒地边缘", nameEn = "The Ashen Fringe", inset = 0, color = "#6e5133",   // 铁锈沙土：荒地外环
                    risk = "低", tempo = "补给与试探（战斗较少，适合整备）",
                    entrances = new[] { 0, 7, 14, 21 },
                    entranceNames = new[] { "清扫口A · 西北角", "清扫口B · 东北角", "清扫口C · 东南角", "清扫口D · 西南角" },
                    doors = new[]
                    {
                        // 出口和下一层的入口（exit=true 表示可从此撤离）
                        new MapDoor { pair = "p1", at = 1,  toLayer = 1, arriveAt = 0,  exit = true },  // (1,0)↔(1,1)
                        new MapDoor { pair = "p2", at = 8,  toLayer = 1, arriveAt = 5,  exit = true },  // (7,1)↔(6,1)
                        new MapDoor { pair = "p3", at = 15, toLayer = 1, arriveAt = 10, exit = true },  // (6,7)↔(6,6)
                        new MapDoor { pair = "p4", at = 22, toLayer = 1, arriveAt = 15, exit = true },  // (0,6)↔(1,6)
                    },
                    cells = new Dictionary<int, MapCell>
                    {
                        // 2:{'两个币'} 3:{'商店'} 4:{'事件'} 5:{'战斗'} 6:{'木材×1'}
                        { 2,  new MapCell { type = "coin", n = 2 } },
                        { 3,  new MapCell { type = "shop" } },
                        { 4,  new MapCell { type = "event" } },
                        { 5,  new MapCell { type = "battle" } },
                        { 6,  new MapCell { type = "wood", n = 1 } },
                        // 9:{'两个币'} 10:{'战斗'} 11:{'事件'} 12:{'战斗'} 13:{'战斗'}
                        { 9,  new MapCell { type = "coin", n = 2 } },
                        { 10, new MapCell { type = "battle" } },
                        { 11, new MapCell { type = "event" } },
                        { 12, new MapCell { type = "battle" } },
                        { 13, new MapCell { type = "battle" } },
                        // 16:{'战斗'} 17:{'小宝箱'} 18:{'事件'} 19:{'两个币'} 20:{'战斗'}
                        { 16, new MapCell { type = "battle" } },
                        { 17, new MapCell { type = "chest" } },
                        { 18, new MapCell { type = "event" } },
                        { 19, new MapCell { type = "coin", n = 2 } },
                        { 20, new MapCell { type = "battle" } },
                        // 23:{'火堆'} 24:{'火堆'} 25:{'事件'} 26:{'战斗'} 27:{'木材×1'}
                        { 23, new MapCell { type = "fire" } },
                        { 24, new MapCell { type = "fire" } },
                        { 25, new MapCell { type = "event" } },
                        { 26, new MapCell { type = "battle" } },
                        { 27, new MapCell { type = "wood", n = 1 } },
                    },
                },
                new MapLayerDef
                {
                    id = "L2", name = "中环 · 废墟市街", nameEn = "The Rusted Blocks", inset = 1, color = "#3d5a50",   // 锈绿残垣：中环街区
                    risk = "中", tempo = "分岔与取舍（战斗、钥匙、商店交错）",
                    doors = new[]
                    {
                        new MapDoor { pair = "p5", at = 13, toLayer = 2, arriveAt = 8 },   // (3,6)→(3,5) 商店，第三层入口
                        new MapDoor { pair = "p6", at = 18, toLayer = 2, arriveAt = 11 },  // (1,3)→(2,3) 商店，第三层入口
                    },
                    cells = new Dictionary<int, MapCell>
                    {
                        { 0,  new MapCell { type = "coin", n = 2 } },   // (1,1) 第二层入口，2币
                        { 1,  new MapCell { type = "fire" } },         // (2,1) 火堆
                        { 2,  new MapCell { type = "fire" } },         // (3,1) 火堆
                        { 3,  new MapCell { type = "battle" } },       // (4,1) 战斗
                        { 4,  new MapCell { type = "event" } },        // (5,1) 事件
                        { 5,  new MapCell { type = "coin", n = 2 } },   // (6,1) 2币
                        { 6,  new MapCell { type = "battle" } },       // (6,2) 战斗
                        { 7,  new MapCell { type = "rations" } },      // (6,3) 口粮
                        { 8,  new MapCell { type = "battle" } },       // (6,4) 战斗
                        { 9,  new MapCell { type = "coin", n = 4 } },   // (6,5) 4币
                        { 10, new MapCell { type = "coin", n = 2 } },   // (6,6) 2层入口，2币
                        { 11, new MapCell { type = "battle" } },       // (5,6) 战斗
                        { 12, new MapCell { type = "key" } },          // (4,6) 钥匙
                        { 13, new MapCell { type = "shop" } },         // (3,6) 商店，第三层入口
                        { 14, new MapCell { type = "battle" } },       // (2,6) 战斗
                        { 15, new MapCell { type = "coin", n = 2 } },   // (1,6) 2币
                        { 16, new MapCell { type = "battle" } },       // (1,5) 战斗
                        { 17, new MapCell { type = "coin", n = 3 } },   // (1,4) 3币
                        { 18, new MapCell { type = "shop" } },         // (1,3) 商店，第三层入口
                        { 19, new MapCell { type = "event" } },        // (1,2) 事件
                    },
                },
                new MapLayerDef
                {
                    id = "L3", name = "内环 · 污染核心区", nameEn = "The Contaminated Core", inset = 2, color = "#443a63",   // 病变紫岩：污染核心
                    risk = "高", tempo = "高压冲刺（高价值、精英预警、紧急撤离）",
                    altarEntrances = new[]
                    {
                        new MapAltarEntrance { pair = "a1", at = 1 },    // (3,2) 祭坛入口（格本身+4币）
                        new MapAltarEntrance { pair = "a2", at = 11 },   // (2,3) 祭坛入口（格本身是商店）
                    },
                    cells = new Dictionary<int, MapCell>
                    {
                        { 0,  new MapCell { type = "battle" } },          // (2,2) 战斗
                        { 1,  new MapCell { type = "coin", n = 4 } },      // (3,2) 4币，祭坛入口
                        { 2,  new MapCell { type = "wood", n = 2 } },      // (4,2) 2木材
                        { 3,  new MapCell { type = "battle" } },          // (5,2) 战斗
                        { 4,  new MapCell { type = "fire" } },            // (5,3) 火堆
                        { 5,  new MapCell { type = "fire" } },            // (5,4) 火堆
                        { 6,  new MapCell { type = "battle" } },          // (5,5) 战斗
                        { 7,  new MapCell { type = "event" } },           // (4,5) 事件
                        { 8,  new MapCell { type = "shop" } },            // (3,5) 商店
                        { 9,  new MapCell { type = "battle" } },          // (2,5) 战斗
                        { 10, new MapCell { type = "emergencyExit" } },   // (2,4) 紧急撤离点，花10币直接撤离
                        { 11, new MapCell { type = "shop" } },            // (2,3) 商店，祭坛入口
                    },
                },
            };
        }

        // ---------- 结点布局（对齐 buildNodePositions：确定性极坐标布局 + 防重叠微调） ----------
        public sealed class NodeLayout { public List<List<MapModel.GridPos>> Layers; public List<MapModel.GridPos> Center; }

        public static NodeLayout BuildNodePositions(List<int> logicalCounts)
        {
            double T = Tile;
            double cx = Cols * T / 2, cy = Rows * T / 2;
            double lo = 14, hiX = Cols * T - 14, hiY = Rows * T - 14;   // 板内安全边界
            var layers = new List<List<MapModel.GridPos>>();
            for (int li = 0; li < logicalCounts.Count; li++)
            {
                int n = logicalCounts[li];
                double R = Radii[li];
                var arr = new List<MapModel.GridPos>();
                for (int i = 0; i < n; i++)
                {
                    double a = -Math.PI / 2 + (i / (double)n) * Math.PI * 2 +
                        (Hash(li * 91 + i * 7, li * 13 + 5) - 0.5) * AngleJitter * (Math.PI * 2 / n);
                    double r = R + (Hash(li * 17 + i * 3 + 1, li * 29 + 2) - 0.5) * RadiusJitter;
                    arr.Add(new MapModel.GridPos { x = (float)(cx + Math.Cos(a) * r), y = (float)(cy + Math.Sin(a) * r) });
                }
                // 防重叠微调：同环内任意两点距 < MinGap 时沿连线推开，迭代收敛
                for (int pass = 0; pass < 24; pass++)
                {
                    bool moved = false;
                    for (int a = 0; a < n; a++)
                    {
                        for (int b = a + 1; b < n; b++)
                        {
                            double dx = arr[b].x - arr[a].x, dy = arr[b].y - arr[a].y;
                            double d = Math.Sqrt(dx * dx + dy * dy);
                            if (d >= MinGap || d < 0.001) continue;
                            double push = (MinGap - d) / 2, ux = dx / d, uy = dy / d;
                            arr[a].x -= (float)(ux * push); arr[a].y -= (float)(uy * push);
                            arr[b].x += (float)(ux * push); arr[b].y += (float)(uy * push);
                            moved = true;
                        }
                    }
                    if (!moved) break;
                }
                // 拉回板内
                foreach (var p in arr)
                {
                    p.x = (float)Math.Min(hiX, Math.Max(lo, p.x));
                    p.y = (float)Math.Min(hiY, Math.Max(lo, p.y));
                }
                layers.Add(arr);
            }
            // 中央区：祭坛居中，三只 BOSS 环绕（与 Center 顺序一一对应）
            var center = new List<MapModel.GridPos> { new MapModel.GridPos { x = (float)cx, y = (float)cy } };
            double br = BossRadius;
            double[][] bossAngles = { new[] { -Math.PI / 2, -0.35 }, new[] { Math.PI / 6 - 0.35, 0.3 }, new[] { Math.PI * 5 / 6 + 0.35, -0.3 } };
            foreach (var ang in bossAngles)
            {
                center.Add(new MapModel.GridPos { x = (float)(cx + Math.Cos(ang[0] + ang[1]) * br), y = (float)(cy + Math.Sin(ang[0] + ang[1]) * br) });
            }
            return new NodeLayout { Layers = layers, Center = center };
        }

        /// <summary>确定性 hash → [0,1)（对齐 _hash：整数混列后取高 16 位）。</summary>
        public static double Hash(int a, int b)
        {
            uint n = unchecked((uint)(a * 374761393 + b * 668265263));
            n = unchecked((n ^ (n >> 13)) * 1274126177);
            return (n ^ (n >> 16)) / 4294967296.0;
        }
    }
}
