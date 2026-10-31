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
        /// <summary>'li,idx' → 结点（对齐 game.cellDefs）。</summary>
        public Dictionary<string, MapNode> CellDefs { get; private set; }

        public sealed class GridPos { public float x, y; }

        /// <summary>确定性构建整个棋盘（同输入必得同输出；seed 保留参数但布局不使用随机数）。</summary>
        public static MapModel Build(int seed) => FromSnapshot(LayeredMapGenerator.Generate(seed.ToString(System.Globalization.CultureInfo.InvariantCulture)));

        public static MapModel FromSnapshot(MapSnapshot snapshot)
        {
            if(!LayeredMapGenerator.ValidateSnapshot(snapshot,out var reason))throw new ArgumentException(reason,nameof(snapshot));
            var m=new MapModel{Snapshot=snapshot,LayerData=new List<LayerData>(),NodePos=new List<List<GridPos>>(),CellDefs=new Dictionary<string,MapNode>()};
            var names=new[]{"外围荒地","风雪哨线","冻土遗迹","污染核心"};var english=new[]{"Outer Wastes","Blizzard Watchline","Permafrost Ruins","Polluted Core"};var colors=new[]{"#78b9d6","#9fcf8d","#d8ae68","#b77ad8"};var nodes=new List<MapNode>();
            for(int li=0;li<4;li++){
                var l=snapshot.layers[li];var positions=new List<GridPos>();var logical=new List<LogicalCell>();
                foreach(var n in l.nodes){var p=new GridPos{x=180+(n.x-l.gridBounds.minX)*180,y=180+(n.row-l.gridBounds.minRow)*180};positions.Add(p);var def=new MapCell{type=n.type,name=n.name};var node=new MapNode{id=li+","+n.idx,idx=n.idx,layerIdx=li,ring=li,x=p.x,y=p.y,type=n.type,name=n.name,kind=KindOf(n.type),def=def,next=n.next};nodes.Add(node);m.CellDefs.Add(node.id,node);logical.Add(new LogicalCell{grid=new List<GridCell>(),fire=n.type=="fire",oldIdx=n.idx,def=def});}
                m.NodePos.Add(positions);m.LayerData.Add(new LayerData{id="layer-"+(li+1),name=$"第{li+1}层 · {names[li]}",nameEn=$"Layer {li+1} · {english[li]}",color=colors[li],entrances=new List<int>{l.entry},entranceNames=new[]{l.nodes[l.entry].name},doors=l.doors,altarEntrances=new List<MapAltarEntrance>(),logical=logical,toLogical=Enumerable.Range(0,l.nodes.Count).ToDictionary(i=>i,i=>i)});
            }
            m.Nodes=nodes;m.Layers=m.LayerData.Select(l=>l.name).ToList();return m;
        }

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
        /// <summary>确定性 hash → [0,1)（对齐 _hash：整数混列后取高 16 位）。</summary>
        public static double Hash(int a, int b)
        {
            uint n = unchecked((uint)(a * 374761393 + b * 668265263));
            n = unchecked((n ^ (n >> 13)) * 1274126177);
            return (n ^ (n >> 16)) / 4294967296.0;
        }
    }
}
