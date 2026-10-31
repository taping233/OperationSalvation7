// ported from src/game.session.js + src/game.run.js（非视觉流程）+ src/game.menu.js（abandonRun/exitToTitle 非视觉部分）+ src/game.store.js（createGameState）
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    // ============================================================
    // 对 Sdt.Core 的依赖面（W1/W2 集成期对齐，详见 _planning/TODO-contracts.md）：
    //   Rng：契约 §2（Next/NextDouble/SaveState/LoadState）；原版按流（'dice'/'gameplay'/'enemy'/'card'/'event'/'audio'/'identity'）
    //        分流，本实现统一走单一 Rng 流。
    //   GameRules：静态常量 DiceSides/EmergencyExitCost/FireHeal/FireClassCardChance/PlayerMaxHp/PlayerAtk/
    //        BagSize/BagMax/SafeStart/SafeMax/StashStart/StashMax/StashUpgradeSlots/StarterSha 等（rules.js 顶层别名）。
    //   MapData：mapData.js 静态数据（Layers/MakeRing/Monsters/Encounters/Altar/Items/ChestTable/RandomEvents/
    //        Center/BuildNodePositions）。
    //   CardDatabase：cards.js（All/ById/ByName/ClassPool/RandomClassCard/SellPrice/ShopWeights/IsRandomObtainable/
    //        Classes/CardBacks/ShaId）。
    //   CharacterTable：characters.js（Characters/CharacterFor/CharacterName）。
    // ============================================================

    /// <summary>遭遇敌人（mapData monsters 条目 + 玩法模式缩放）。</summary>
    public sealed class EnemyStats
    {
        public string id, name, behavior,eliteSkill,desc;
        public int damageCap;
        public bool evenAttack;
        public int hp, atk;
        public bool elite;
    }

    /// <summary>战斗开启请求（game.run.js SDT.Battle.start 的参数集）。</summary>
    public sealed class BattleRequest
    {
        public List<EnemyStats> Foes = new List<EnemyStats>();
        public bool IsBoss;
        public int Layer;
        public string Name, Risk, Strategy, ReturnTo;   // ReturnTo = 'altar'
        public int PreDamage;                           // 闪金之锤：开战前先扣的敌人生命（事件战 UI 直发请求时由开战侧应用）
    }

    /// <summary>掷骰结果（game.run.js roll + moveBy 的逻辑结算；640ms 骰子动画与逐格移动动画由 UI 播放）。</summary>
    public sealed class RollResult
    {
        public int Dice;               // 掷出的点数（开发者固定时为固定值）
        public bool Fixed;             // 是否开发者固定骰
        public int LayerIdx, From, To; // 逻辑格索引（含起终点）
        public List<int> Path = new List<int>();   // 途经逻辑格索引（含终点，不含起点）
        public NodeResult Node;        // 落脚结算（可能为 null：未触发节点）
        public string LogText;         // 原版日志「掷出 N 点…」
    }

    /// <summary>enterNode 过场元数据（game.run.js enterNode 的 transitions 表，文案照抄）。</summary>
    public sealed class TransitionInfo
    {
        public string Tone, Asset, Eyebrow, Title, Detail;
    }

    /// <summary>环间门信息（openDoorModal 展示数据）。</summary>
    public sealed class DoorInfo
    {
        public string Pair, TargetLayerName;
        public int ToLayer, At, ArriveAt;
        public bool Exit, Reverse, ShopOnCell;
    }

    /// <summary>祭坛入口信息（openAltarEntranceModal 展示数据）。</summary>
    public sealed class AltarEntranceInfo { public string Pair; public bool ShopOnCell; }

    /// <summary>BOSS 选择页数据（openAltarModal，属性已按模式缩放）。</summary>
    public sealed class AltarBossInfo { public string Id, Name, AffixDesc; public int Atk, Hp; }

    /// <summary>紧急撤离点数据（openEmergencyModal）。</summary>
    public sealed class EmergencyInfo { public int Cost, Coins; public bool CanPay; }

    /// <summary>即时效果格数据（runInstant：coin/wood/chest/rations/key/fire/event）。</summary>
    public sealed class InstantInfo
    {
        public string GainText;                 // 拾取页大字（如「+2 币」「木材 +1」「钥匙 ×1」）
        public int CoinN, WoodN;                // coin/wood 格数量
        public List<string> Chests;             // 待开宝箱 kind 列表（chest 格 = small ×1；事件选择 medium ×2 等）
        public string ChestText;                // 宝箱日志前缀（事件路径带说明文字）
        public FireRestInfo Fire;               // 火堆
        public CardDef EventCard;               // 事件卡（事件格）
        public bool EventPoolExhausted;
    }

    /// <summary>火堆休整数据（openFireRest：回血/职业卡判定已在流程层结算，选牌复原交 UI）。</summary>
    public sealed class FireRestInfo
    {
        public int HealAmount;          // 实际回复量（game.heal 结算）
        public int RestorePicks = 2;    // openPocketRestore(2, …)
        public bool GotClassCard;       // 30% 几率额外职业卡是否触发
        public string ClassCardName;
    }

    /// <summary>事件卡选项（eventChoiceSpec / ink narrative choices 桥接）。</summary>
    public sealed partial class EventChoice
    {
        public string Label, Detail, Tone, EffectKey;
    }

    /// <summary>事件选项结算结果（eventChoiceSpec effects 表执行后）。</summary>
    public sealed partial class EventOutcome
    {
        public bool Settled;                    // true=已回待机并存档；false=进入战斗/开箱等自管收尾流程
        public BattleRequest Battle;            // 非 null：请求开启战斗
        public List<string> Chests;             // 非 null：待开宝箱
        public string ChestText;
        public List<string> Logs = new List<string>();   // 结算产生的日志
    }

    /// <summary>落脚结算结果（resolveCell → UI 呈现；呈现完调 GameRuntime.FinishNode 收尾）。</summary>
    public sealed class NodeResult
    {
        public NodeKind Kind;
        public string KindRaw;                  // 原版 def.type 字符串（存档/日志口径）
        public TransitionInfo Transition;       // enterNode 短过场
        public BattleRequest Battle;            // Kind=Battle
        public DoorInfo Door;                   // Kind=Door
        public AltarEntranceInfo AltarEntrance; // Kind=Altar（祭坛入口格）
        public EmergencyInfo Emergency;         // Kind=EmergencyExit
        public InstantInfo Instant;             // 即时效果格
        public bool IsShop;                     // Kind=Shop
    }

    /// <summary>撤离结果（doExtract + renderExtractStash + showExtractDone 数据集）。</summary>
    public sealed class ExtractResult
    {
        public int WoodN, RatN, OtherN, ShaN;   // 自动入库/遗落统计
        public long TotalValue;                 // 物资价值合计（¥）
        public string TimeStr;                  // 用时 mm:ss
        public int Actions;                     // 行动次数（turn-1）
        public int Hp, MaxHp, Coins;
        public int StashUsed, StashCap, StashRoom, CollectionCount;
        public List<StashStack> Left = new List<StashStack>();   // 待整理的背包卡牌堆
        public List<StashStack> SavedCards = new List<StashStack>(), KeptPocket = new List<StashStack>();
        public int PocketKept,PocketLost,PocketRuleLost; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;
        public bool Done;                       // true=整理已完成（showExtractDone）
        public List<string> Logs = new List<string>();
    }

    /// <summary>死亡结果（doDeath 数据集）。</summary>
    public sealed class DeathResult
    {
        public long LostValue;                  // 掉落物资价值
        public List<StashStack> SavedStacks = new List<StashStack>();  // 宠物抢运回的安全格卡牌
        public int SavedN; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;
    }

    /// <summary>放弃对局结果（game.menu.js abandonRun 数据集）。</summary>
    public sealed class AbandonResult
    {
        public int BroughtN, KeptN, Coins; public SettlementReceipt Receipt;
        public List<StashStack> KeptStacks = new List<StashStack>();
    }

    /// <summary>
    /// 对局状态（game.store.js createGameState 的 schema §5 字段 + 会话运行时字段）。
    /// Schema 字段经 GameRuntime.SaveCurrent 映射进 RunSaveData 落盘；运行时字段不序列化。
    /// </summary>
    // RunState/OwnedCard/PocketStack/EventLogEntry 定义已上移 Sdt.Core（集成裁决：schema 类型唯一真源）。本文件经 using Sdt.Core 使用。

    /// <summary>玩法模式（game.session.js MODES，文案/数值照抄）。</summary>
    public sealed class RunMode
    {
        public string id, icon, name, desc, ckpt;
        public double enemyMul, coinMul, xpMul, healMul;
        public int startCoins;
    }

    /// <summary>
    /// 全局单例：对局流程 / 存档调度 / 基地 / 元进度 / 音频总线。
    /// 原版函数 → C# 方法映射（game.session.js）：
    ///   curLayer()→CurLayer / cellCenter()→CellCenter / rndDice()→RndDice / pick()→Pick / weighted()→Weighted /
    ///   buildDerived()→BuildDerived / saveGame()→SaveCurrent / syncPlayTime()→SyncPlayTime / clearSave()→ClearSave /
    ///   clearSlot()→ClearSlot / clearAllSlots()→ClearAllSlots / loadGame()→LoadRun / newRun()→NewRun /
    ///   enterLayer()→EnterLayer / game.heal→Heal / game.damage→Damage / game.addItem→AddItem / gainCoins()→GainCoins /
    ///   cardStacks()→CardStacks / usedSlots()→UsedSlots / safeUsed()→SafeUsed / newUid()→NewUid /
    ///   grantStarterSha()→GrantStarterSha / applyDeployPicks()→ApplyDeployPicks / modeCfg()→ModeCfg /
    ///   scaledEnemy()→ScaledEnemy / applyModeRules()→ApplyModeRules / hasRun()→HasRun / hasSlot()→HasSlot。
    /// （game.run.js）：roll()→Roll / moveBy()→(Roll 内联逻辑推进) / resolveCell()→ResolveCell / enterNode()→(TransitionInfo) /
    ///   runInstant()→RunInstant / runEventDeck()→RunEventDeck / grantEventCard()→GrantCard /
    ///   openFireRest()→OpenFireRest / openPocketRestore()→FireRestoreOne+FireRestoreDone /
    ///   triggerEventCard()→TriggerEventCard / eventChoiceSpec.effects→ApplyEventChoice / applyEventEffect()→ApplyEventEffect /
    ///   openDoorModal()→OpenDoor 系 / openAltarEntranceModal()→OpenAltarEntrance 系 / openAltarModal()→OpenAltar 系 /
    ///   openEmergencyModal()→OpenEmergency 系 / doExtract()→DoExtract+ExtractStashOne/All+FinishExtract /
    ///   renderExtractStash()→(ExtractResult) / showExtractDone()→(ExtractResult.Done) /
    ///   buildEncounter()→BuildEncounter / openChestsOnCell()→OpenChestsOnCell / finishInstant()→FinishNode。
    /// （game.menu.js）：abandonRun()→AbandonRun / exitToTitle()→ExitToTitle。
    /// （game.boot.js loop）：elapsed 计时→Tick(dt)。
    /// </summary>
    public sealed partial class GameRuntime
    {
        public static GameRuntime I { get; } = new GameRuntime();

        // 视觉相关（cam/canvas/ctx/dpr/UI 刷新）不移植；hooks 注入改为 EventBus 事件。
        public RunState State { get; private set; }
        public BaseData Base { get; private set; }
        public MetaProgress Meta { get; }
        public EventBus Bus { get; } = new EventBus();
        public Rng Rng { get; private set; }
        public SaveSystem Saves { get; } = new SaveSystem();
        public AudioService Audio => AudioService.I;

        public int? ActiveSlot { get; private set; }   // 当前游玩档位（1..5）；标题界面 null
        public bool DevMode;                            // game.devMode：固定骰子
        public int NextDice;                            // game.nextDice：开发者固定骰点数

        /// <summary>叙事事件桥：Boot 装配时接 W4 NarrativeService（eventNarrative(cardId)）。</summary>
        public Func<CardDef, List<EventChoice>> NarrativeBridge;

        GameRuntime()
        {
            State = new RunState();
            Base = BaseData.Def();
            Meta = new MetaProgress(this);
            Rng = new Rng(GenerateSeed());
            Saves.MigrateLegacy();
            CardLibrary.CustomsLoader = () => SaveSystem.LoadCustomCards(Saves);
            CardLibrary.CustomsSaver = cards => SaveSystem.SaveCustomCards(Saves, cards);
            BuildDerived();   // 原版在 game.boot.js 启动时构建一次派生棋盘
        }

        static int GenerateSeed()
        {
            // random.js generateSeed：任意随机种子即可（对局种子落档，不影响确定性回放）
            return (int)(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() & 0x7fffffff);
        }

        // ============================================================
        // 玩法模式（game.session.js MODES，文案/数值照抄）
        // ============================================================
        static readonly Dictionary<string, RunMode> Modes = new Dictionary<string, RunMode> {
            ["standard"] = new RunMode { id = "standard", icon = "[[icon:map]]", name = "标准搜打撤",
                desc = "完整四层节点图：探索、搜刮与战斗，第四层经祭坛决战首脑后终局撤离。",
                enemyMul = 1, coinMul = 1, xpMul = 1, startCoins = 0, healMul = 1, ckpt = "规则无修正" },
            ["elite"] = new RunMode { id = "elite", icon = "[[icon:fire]]", name = "精英突袭",
                desc = "敌人与 BOSS 属性 ×1.35，战斗掉落金币 ×1.5，人物经验 +50%，高稀有度卡牌爆率 +20%。高风险高回报。",
                enemyMul = 1.35, coinMul = 1.5, xpMul = 1.5, startCoins = 0, healMul = 1, ckpt = "敌人 ×1.35 · 经验 +50% · 高稀有掉落 +20%" },
        };
        public static IReadOnlyDictionary<string, RunMode> AllModes => Modes;
        public RunMode ModeCfg => Modes.TryGetValue(State.mode, out var m) ? m : Modes["standard"];
        public static string ModeName(string id) => Modes.TryGetValue(id, out var m) ? m.name : id;

        const int BaseFireHeal = GameRules.FireHeal;   // MAP.rules.fireHeal 基线（rules.js map.fireHeal）
        /// <summary>game.session.js applyModeRules：模式改 fireHeal 与经验倍率。</summary>
        void ApplyModeRules()
        {
            var m = ModeCfg;
            _fireHeal = (int)(BaseFireHeal * (m.healMul > 0 ? m.healMul : 1));
            Meta.SetXpMul(m.xpMul > 0 ? m.xpMul : 1);
        }
        int _fireHeal = BaseFireHeal;
        /// <summary>MAP.rules.fireHeal 的模式缩放副本（火堆回复量）。</summary>
        public int FireHeal => _fireHeal;

        /// <summary>game.session.js scaledEnemy：按模式缩放敌人属性（战斗格/事件战/BOSS 通用）。</summary>
        public EnemyStats ScaledEnemy(EnemyStats e)
        {
            var m = ModeCfg;
            if (e == null || m.enemyMul == 1) return e;
            return new EnemyStats { id = e.id, name = e.name, behavior = e.behavior, elite = e.elite,eliteSkill=e.eliteSkill,desc=e.desc,damageCap=e.damageCap,evenAttack=e.evenAttack,
                hp = (int)Math.Floor(e.hp * m.enemyMul+.5), atk = (int)Math.Floor((e.atk > 0 ? e.atk : 2) * m.enemyMul+.5) };
        }

        // ============================================================
        // 派生棋盘（game.session.js buildDerived：逻辑格合并 / 双向门 / 结点坐标）
        // ============================================================
        public sealed class LogicalCell
        {
            public string id; public int x,row; public List<MapLink> next = new List<MapLink>();
            public int oldIdx;                  // 节点索引
            public bool fire;                   // 火堆（相连合并为 1 逻辑格）
            public string type;                 // def.type（coin/wood/battle/…/entrance/door）
            public int n;                       // coin/wood 数量
            public string name;                 // def.name（火堆=「火堆」）
        }
        public sealed class RuntimeDoor
        {
            public string pair; public int at, toLayer, arriveAt;
            public bool exit, reverse;
        }
        public sealed class RuntimeLayer
        {
            public string id, name, nameEn, color, risk;
            public int entry, exit;
            public List<LogicalCell> logical = new List<LogicalCell>();
            public List<int> entrances = new List<int>();
            public List<string> entranceNames = new List<string>();
            public List<RuntimeDoor> doors = new List<RuntimeDoor>();
            public List<(string pair, int at)> altarEntrances = new List<(string, int)>();
            public List<(float x, float y)> nodePos = new List<(float, float)>();
        }

        public List<RuntimeLayer> Layers { get; private set; } = new List<RuntimeLayer>();
        public List<(float x, float y)> CenterPos { get; private set; } = new List<(float x, float y)>();

        public RuntimeLayer CurLayer => Layers[State.layerIdx];
        public (float x, float y) CellCenter(int li, int idx) => Layers[li].nodePos[idx];

        /// <summary>buildDerived：网格环 → 逻辑环（火堆合并）、门双向补全、结点极坐标布局。</summary>
        public void BuildDerived()
        {
            Map = State.mapSnapshot == null ? MapModel.Build(State.seed ?? 0) : MapModel.FromSnapshot(State.mapSnapshot);
            State.mapSnapshot = Map.Snapshot;
            Layers = Map.LayerData.Select((layer,li) => new RuntimeLayer
            {
                id=layer.id,name=layer.name,nameEn=layer.nameEn,color=layer.color,risk=new[]{"低","中","高","极高"}[li],
                entry=Map.Snapshot.layers[li].entry,exit=Map.Snapshot.layers[li].exit,
                entrances=layer.entrances,entranceNames=layer.entranceNames.ToList(),
                doors=layer.doors.Select(d=>new RuntimeDoor{pair=d.pair,at=d.at,toLayer=d.toLayer,arriveAt=d.arriveAt,exit=false,reverse=false}).ToList(),
                logical=Map.Snapshot.layers[li].nodes.Select(n=>new LogicalCell{id=n.id,oldIdx=n.idx,x=n.x,row=n.row,next=n.next,type=n.type,name=n.name,fire=n.type=="fire"}).ToList(),
                nodePos=Map.NodePos[li].Select(p=>(p.x,p.y)).ToList()
            }).ToList();
            var altar=Map.Nodes.First(n=>n.type=="altar");CenterPos=new List<(float,float)>{(altar.x,altar.y)};
        }

        /// <summary>外圈出口门格补「出口 / 环间门」定义（buildDerived 尾段）。返回 (li=0 的门格逻辑索引, exit) 列表。</summary>
        public List<(int at, bool exit)> OuterExitDoors() =>
            Layers[0].doors.Select(d => (d.at, d.exit)).ToList();

        // ============================================================
        // 便签 / 基地导航（game.notes.js openCellEditor + game.hub.js openBaseHub）
        // ============================================================

        /// <summary>结点信息行（便签编辑器 info 区展示字段，与原版 openCellEditor 的 info 数组对应）。</summary>
        public sealed class NodeNoteInfo
        {
            public string layerName, nodeKind, entranceName, doorTo;
            public int n;
            public bool hasDoor, doorExit, hasAltarEntrance;
        }

        /// <summary>game.notes.js openCellEditor：解析结点门/入口/事件配置（li=-1 为中央区，返回 layerName 之外的空信息）。</summary>
        public NodeNoteInfo GetNodeInfo(int li, int idx)
        {
            if (li < 0 || li >= Layers.Count) return null;
            var ld = Layers[li];
            var info = new NodeNoteInfo { layerName = ld.name };
            if (idx < 0 || idx >= ld.logical.Count) return info;
            var door = ld.doors.FirstOrDefault(d => d.at == idx);
            if (door != null) { info.hasDoor = true; info.doorExit = door.exit; info.doorTo = Layers[door.toLayer].name; }
            info.hasAltarEntrance = ld.altarEntrances.Any(a => a.at == idx);
            var eIdx = ld.entrances.IndexOf(idx);
            if (eIdx >= 0 && eIdx < ld.entranceNames.Count) info.entranceName = ld.entranceNames[eIdx];
            var lc = ld.logical[idx];
            info.nodeKind = lc.type; info.n = lc.n;
            return info;
        }

        /// <summary>notes.js get（floorId 固定为 MAP.boardId = 'B1'，键 "li,idx"）。</summary>
        public string GetNodeNote(int li, int idx) => NotesStore.Get(Saves, MapData.BoardId, li, idx);

        /// <summary>notes.js set（空文本删除条目，写入自动 trim，落盘 global.json）。</summary>
        public void SetNodeNote(int li, int idx, string text) => NotesStore.Set(Saves, MapData.BoardId, li, idx, text);

        /// <summary>game.hub.js openBaseHub(tab)：发开基地页请求（tab = 出发/仓库/升级/人物/成就 页签）。</summary>
        public void OpenHub(string tab = null) => Bus.Emit(new HubOpened { Tab = tab });

        // ============================================================
        // 工具（game.session.js 工具段）
        // ============================================================
        public int RndDice() => 1 + (int)(Rng.NextDouble() * GameRules.DiceSides);
        public T Pick<T>(IReadOnlyList<T> arr) => arr[(int)(Rng.NextDouble() * arr.Count)];

        public T Weighted<T>(IReadOnlyList<(T e, double w)> arr)
        {
            double total = arr.Sum(x => x.w);
            double r = Rng.NextDouble() * total;
            foreach (var (e, w) in arr) { r -= w; if (r <= 0) return e; }
            return arr[0].e;
        }

        /// <summary>game.session.js newUid：'o' + 时间戳36 + 两段随机36。</summary>
        public string NewUid()
        {
            // Convert.ToString 只支持 2/8/10/16 进制，36 进制需手写（时间戳转 36 进制）
            static string B36(long v)
            {
                const string digits = "0123456789abcdefghijklmnopqrstuvwxyz";
                if (v == 0) return "0";
                var neg = v < 0; var uv = neg ? -v : v;
                var buf = new System.Text.StringBuilder();
                while (uv > 0) { buf.Insert(0, digits[(int)(uv % 36)]); uv /= 36; }
                return neg ? "-" + buf.ToString() : buf.ToString();
            }
            return "o" + B36(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) +
                B36((int)(Rng.Random("identity") * 46656)) + B36((int)(Rng.Random("identity") * 1296));
        }

        void Log(string text, string tone = null) => Bus.Emit(new LogRequested { Text = text, Tone = tone });

        // ============================================================
        // 人物：生命 / 经济 / 背包
        // ============================================================
        /// <summary>game.heal(n)。返回实际回复量（满血时 0）。</summary>
        public int Heal(int n)
        {
            if (State.hp >= State.maxHp) { Log("[[icon:heart]] 生命值已满", "dim"); return 0; }
            int real = Math.Min(n, State.maxHp - State.hp);
            State.hp += real;
            Audio.PlaySfx("heal");
            Log($"[[icon:heart]] 恢复 <b>{real}</b> 点生命（{State.hp}/{State.maxHp}）", "heal");
            Bus.Emit(new PlayerHealed { Amount = real, Hp = State.hp, MaxHp = State.maxHp });
            return real;
        }

        /// <summary>game.damage(n, reason)。生命归零自动 DoDeath。</summary>
        public void Damage(int n, string reason = null)
        {
            State.hp -= n;
            Log($"[[icon:heart]] {reason ?? ""}损失 <b>{n}</b> 点生命（{Math.Max(0, State.hp)}/{State.maxHp}）", "warn");
            Bus.Emit(new PlayerDamaged { Amount = n, Reason = reason, Hp = State.hp, MaxHp = State.maxHp });
            if (State.hp <= 0) DoDeath();
        }

        // 背包容量（基地扩建后生效）：物资与卡牌混占格；同名堆叠各 1 格；安全格独立计容；消耗口袋不占格
        public int BagCap => CardContainerCommands.Query(this).totalCap;
        public int SafeCap => Base.SafeCap;

        /// <summary>game.session.js cardStacks(safe)：按卡名堆叠。</summary>
        public List<StashStack> CardStacks(bool safe) => CardContainerCommands.ZoneStacks(State.ownedCards,safe);
        public int UsedSlots()=>CardContainerCommands.Query(this).used;
        public int SafeUsed()=>CardStacks(true).Count;
        public bool CanReceiveCard(CardDef card)=>CardContainerCommands.CanReceive(this,card);

        /// <summary>game.addItem(tpl, n)。返回堆叠格（背包满返回 null）。tpl 取自 MapData.Items/ChestTable。</summary>
        public InvSlot AddItem(ItemDef tpl, int n = 1)
        {
            var slot = State.inventory.FirstOrDefault(it => it.name == tpl.name && it.tier == (tpl.tier ?? "C"));
            int before=slot?.count??0;int delta=(before+n+2)/3-(before+2)/3;var capacity=CardContainerCommands.Query(this);
            if(delta>0&&(capacity.used+delta>capacity.totalCap||capacity.ordinarySlots+delta>capacity.baseCap))
            {
                Log($"[[icon:bag]] 背包已满（{UsedSlots()}/{BagCap} 格，可在基地用木材扩建），无法获得 <b>{tpl.name}</b>", "warn");
                Bus.Emit(new ItemAdded { Name = tpl.name, Count = 0, Rejected = true });
                return null;
            }
            if (slot == null)
            {
                slot = new InvSlot { name = tpl.name, value = tpl.value, tier = tpl.tier ?? "C", count = 0 };
                State.inventory.Add(slot);
            }
            slot.count += n;
            Log($"获得 <b>{tpl.name}{(slot.count > 1 ? $" ×{slot.count}" : "")}</b>（¥{(tpl.value) * slot.count}）", "loot");
            Bus.Emit(new ItemAdded { Name = tpl.name, Count = slot.count });
            return slot;
        }

        /// <summary>game.session.js gainCoins(n)：含模式金币倍率（max(1, round(n*coinMul))）。</summary>
        public void GainCoins(int n)
        {
            n = Math.Max(1, (int)Math.Floor(n * (ModeCfg.coinMul > 0 ? ModeCfg.coinMul : 1)+.5));
            State.coins += n;
            Audio.PlaySfx("coin");
            Log($"获得 <b>{n}</b> 币（现有 {State.coins}）", "coin");
            Bus.Emit(new CoinsGained { Amount = n, Total = State.coins });
        }

        /// <summary>game.run.js grantEventCard(tpl)：同名并入现有格不受容量限制；新名超容拒收。</summary>
        public bool GrantCard(CardDef tpl, bool brought = false)
        {
            if (tpl == null) return false;
            if (!CanReceiveCard(tpl))
            {
                Log($"[[icon:bag]] 背包已满（{UsedSlots()}/{BagCap} 格），【{tpl.name}】掉在了原地…", "warn");
                Bus.Emit(new CardGranted { CardName = tpl.name, Rejected = true });
                return false;
            }
            State.ownedCards.Add(new OwnedCard { uid = NewUid(), card = tpl.Clone(), brought = brought ? 1 : 0 });
            Log($"[[icon:archive]] 获得卡牌【<b>{tpl.name}</b>】", "loot");
            Bus.Emit(new CardGranted { CardName = tpl.name });
            return true;
        }

        // ============================================================
        // 档位 / 存档
        // ============================================================
        public bool HasRun(int i) => Saves.HasRun(i);
        public bool HasSlot(int i) => HasRun(i) || BaseData.HasSlot(Saves, i);

        /// <summary>game.session.js saveGame：只有 runActive 且非 title/done/boot 才写档。</summary>
        public void SaveCurrent()
        {
            if(!State.runActive||ActiveSlot==null||State.Phase=="title"||State.Phase=="done"||State.Phase=="boot"||Saves.InTransaction)return;
            TryPersistMutation(()=>{},out _);
        }

        /// <summary>game.session.js syncPlayTime：把本局 elapsed 增量并入基地累计游玩时间。</summary>
        public void SyncPlayTime()
        {
            if (ActiveSlot == null || Base.Slot == null) return;
            double now = Math.Max(0, State.elapsed);
            double prev = Math.Max(0, State.elapsedSynced);
            double delta = Math.Max(0, now - prev);
            if (delta > 0)
            {
                Base.stats.playSeconds = Math.Max(0, Base.stats.playSeconds) + delta;
                State.elapsedSynced = now;
                Base.Save();
            }
        }

        /// <summary>clearSlot(i)：对局进度 + 基地一起清空。</summary>
        public void ClearSlot(int i)
        {
            if(!TryPersistMutation(()=>{Saves.RemoveRun(i);BaseData.Wipe(Saves,i);Saves.RemoveSettlement(i);if(ActiveSlot==i){ActiveSlot=null;Base=BaseData.Def();State.runActive=false;State.Phase="title";}},out var reason))throw new System.IO.IOException(reason);
        }
        void ClearSave() { if (ActiveSlot != null) Saves.RemoveRun(ActiveSlot.Value); }
        public void ClearAllSlots()
        {
            if(!TryPersistMutation(()=>{for(int i=1;i<=SaveSystem.SlotCount;i++){Saves.RemoveRun(i);BaseData.Wipe(Saves,i);Saves.RemoveSettlement(i);}ActiveSlot=null;Base=BaseData.Def();State.runActive=false;State.Phase="title";},out var reason))throw new System.IO.IOException(reason);
        }

        /// <summary>进入档位（game.menu.js launch：切 activeSlot + 基地 use）。有对局→true。</summary>
        public bool EnterSlot(int slot)
        {
            ActiveSlot = slot;
            Base = BaseData.Use(Saves, slot);
            Log($"[[icon:archive]] 已进入 <b>档位 {slot}</b>（基地与进度独立保存到该档位）", "sys");
            return HasRun(slot);
        }

        /// <summary>game.session.js loadGame(slot)：读档回到未结束的对局。失败返回 false。</summary>
        public bool LoadRun(int slot)
        {
            var s = Saves.ReadSlot(slot);
            if (s == null) return false;
            var checkpoint=s.battleRestartCheckpoint;
            if(checkpoint!=null&&RestoreBattleCheckpoint==null){Bus.Emit(new ToastRequested{Text="战斗恢复服务暂不可用，原档已保留",Tone="warn"});return false;}
            if(checkpoint!=null){var liveElapsed=s.elapsed;var liveSavedAt=s.savedAt;s=SaveJson.Read<RunSaveData>(SaveJson.Stringify(checkpoint.run));s.elapsed=Math.Max(s.elapsed,liveElapsed);s.savedAt=Math.Max(s.savedAt,liveSavedAt);}
            BattleCheckpoint=checkpoint;
            if (ActiveSlot != slot) { ActiveSlot = slot; Base = BaseData.Use(Saves, slot); }
            string rngSnapshot = null;
            if (s.rngState != null)
                rngSnapshot = s.rngState.Type == JTokenType.String ? s.rngState.Value<string>() : s.rngState.ToString(Formatting.None);
            try { Rng.LoadState(rngSnapshot ?? Convert.ToString(s.seed)); }
            catch { Rng = new Rng(s.seed); }
            State.seed = s.seed;
            var g = State;
            g.slot = slot;
            g.runActive = true;
            g.hp = s.hp; g.maxHp = s.maxHp > 0 ? s.maxHp : GameRules.PlayerMaxHp;
            g.atk = s.atk > 0 ? s.atk : GameRules.PlayerAtk;
            g.coins = s.coins; g.fragments=s.fragments; g.turn = s.turn > 0 ? s.turn : 1;
            g.mode = Modes.ContainsKey(s.mode) ? s.mode : "standard";
            g.myClass = s.myClass; g.characterId = s.characterId;
            ApplyModeRules();
            g.inventory = (s.inventory ?? new List<InventorySlot>()).Select(x => new InvSlot { name = x.name, value = x.value, tier = x.tier, count = x.count }).ToList();
            g.ownedCards = s.ownedCards ?? new List<OwnedCard>();
            g.cardOrder = s.cardOrder ?? new List<string>();
            g.usedPocket = s.usedPocket ?? new List<PocketStack>();
            g.eventLog = s.eventLog ?? new List<EventLogEntry>();
            g.discoveredPairs = new HashSet<string>(s.discovered ?? new List<string>());
            g.diceHistory = s.diceHistory ?? new List<int>();
            g.elapsed = s.elapsed;
            g.savedAt=s.savedAt;
            // 旧存档只有本局 elapsed：首次读取时把它安全迁入累计游玩时间
            if (Base.stats.playSeconds < g.elapsed)
            {
                Base.stats.playSeconds = g.elapsed;
                Base.Save();
            }
            g.elapsedSynced = g.elapsed;
            g.chainMove = 0; g.pendingEventLoot = null; g.altarFrom = null;g.battleActive=false;
            g.mapSnapshot=s.mapSnapshot;g.explored=new HashSet<string>(s.explored??new List<string>());g.revealed=new HashSet<string>(s.revealed??new List<string>());
            g.settled=new HashSet<string>(s.settled??new List<string>());g.closed=new HashSet<string>(s.closed??new List<string>());g.nodeRewards=s.nodeRewards??new Dictionary<string,NodeVisitReceipt>();
            g.altarActivated=s.altarActivated;g.bossDefeated=s.bossDefeated;g.entrySupply=s.entrySupply;g.spellPower=s.spellPower;_lastNode=null;_lastNodeKey=null;BuildDerived();
            var settlement=Saves.GetSettlement(slot);
            if(settlement?.status=="sorting"&&settlement.reason=="extract"&&settlement.run?.seed==s.seed){
                g.layerIdx=s.layerIdx;g.trackPos=s.trackPos;g.pos=CellCenter(g.layerIdx,g.trackPos);g.runActive=false;g.Phase="settlement";
                _extractLeft=settlement.left??new List<StashStack>();Bus.Emit(new RunLoaded{Slot=slot});Bus.Emit(new ExtractStashChanged{Result=BuildExtractResult(false)});return true;
            }
            EnterLayer(s.layerIdx > 0 ? s.layerIdx : 0, s.trackPos,false);
            Audio.PlayBgm("board");
            Log($"[[icon:download]] 已读取【档位 {slot}】存档，直接回到上一局未结束的对局", "ok");
            Bus.Emit(new RunLoaded { Slot = slot });
            if(checkpoint!=null&&!RestoreBattleCheckpoint(checkpoint)){Bus.Emit(new ToastRequested{Text="战斗入场状态未能恢复，原存档已保留",Tone="warn"});return false;}
            if (g.myClass == null) Bus.Emit(new ClassChoiceOpened());   // 上次存档还没选职业：补上开局选择
            return true;
        }

        /// <summary>
        /// game.session.js newRun(mode, picks)。characterId 为预选角色（null=走 openClassChoice 选角）。
        /// picks = 出发准备页选择的仓库卡牌（卡名 => 张数）。
        /// </summary>
        public void NewRun(int slot, string characterId, string mode = "standard", Dictionary<string, int> picks = null)
        {
            TryPersistMutation(()=>{Saves.RemoveSettlement(slot);NewRunCore(slot,characterId,mode,picks);},out _);
        }
        void NewRunCore(int slot, string characterId, string mode, Dictionary<string,int> picks)
        {
            ActiveSlot = slot;
            if (Base.Slot != slot) Base = BaseData.Use(Saves, slot);
            ClearBattleCheckpoint();State.battleActive=false;
            picks = NormalizeDeparturePicks(picks, true);
            if(!PreviewDeparture(picks).capacityOk)throw new InvalidOperationException("所选携带卡牌超出背包容量，请减少后再出发");
            State.seed = GenerateSeed(); State.runActive = true;
            State.Phase = "idle";   // 开局回待机（掷骰闸门 Phase=="idle"，缺此行永远无法掷骰）
            Rng = new Rng(State.seed ?? 0);
            State.mode = Modes.ContainsKey(mode) ? mode : "standard";
            ApplyModeRules();
            var g = State;
            g.runActive = true;    // v0.21：从这一刻起才写对局存档
            g.mapSnapshot=null;g.explored.Clear();g.revealed.Clear();g.settled.Clear();g.closed.Clear();g.nodeRewards.Clear();g.altarActivated=false;g.bossDefeated=false;g.spellPower=0;g.entrySupply=null;_lastNode=null;_lastNodeKey=null;
            BuildDerived();
            g.inventory = new List<InvSlot>();
            g.ownedCards = new List<OwnedCard>();
            g.cardOrder = new List<string>();
            g.usedPocket = new List<PocketStack>();
            Base.pocket.Clear();
            g.eventLog = new List<EventLogEntry>();
            g.pendingEventLoot = null;
            g.myClass = null;
            g.characterId = characterId;
            g.classCard = null;
            g.coins = ModeCfg.startCoins; g.fragments=0;
            g.maxHp = GameRules.PlayerMaxHp;
            g.maxHp+=Base.CarriedPet?.effect?.maxHp??0;
            g.hp = g.maxHp;
            g.atk = GameRules.PlayerAtk;
            g.discoveredPairs = new HashSet<string>();
            g.diceHistory = new List<int>();
            g.dice = null;
            g.turn = 1;
            g.elapsed = 0; g.elapsedSynced = 0;
            g.altarFrom = null;
            Audio.PlayBgm("board");   // 出发：切入行军氛围
            Log($"欢迎来到<b>代号7</b>：本次玩法【<b>{ModeCfg.name}</b>】——{ModeCfg.ckpt}", "sys");
            Log("沿道路选择相邻地点，探索四层地图；第三层可献祭撤离，击败首脑后终局撤离", "sys");
            if (characterId != null) SetCharacter(characterId, false);
            GrantStarterSha();
            Log($"[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×{GameRules.StarterSha}（固定携带 · 不可入库 / 安全格）", "sys");
            ApplyDeployPicks(picks);
            // 随机入口出生
            var l1 = Layers.Count > 0 ? Layers[0] : null;
            if (l1 == null) BuildDerived();
            l1 = Layers[0];
            int k = (int)(Rng.NextDouble() * l1.entrances.Count);
            Log($"[[icon:dice]] 随机出生在 <b>{l1.entranceNames[k]}</b>", "sys");
            EnterLayer(0, l1.entrances[k]);
            Bus.Emit(new RunStarted { Slot = slot, Mode = State.mode, CharacterId = characterId });
            if (characterId == null) Bus.Emit(new ClassChoiceOpened());   // 从全部职业中选择 + 1 张随机职业卡
        }

        /// <summary>每局开始：固定携带 starterSha 张「初始攻击」（brought=1）。</summary>
        void GrantStarterSha()
        {
            for (int i = 0; i < DepartureStarterCount; i++)
                State.ownedCards.Add(new OwnedCard { uid = NewUid(), card = DepartureStarterCard.Clone(), brought = 1 });
        }
        public CardDef DepartureStarterCard=>DepartureStarterCardForPet(Base.petSel);
        public int DepartureStarterCount=>DepartureStarterCountForPet(Base.petSel);
        public CardDef DepartureStarterCardForPet(string petId)=>BaseData.PetsCatalog.FirstOrDefault(p=>p.id==(petId??Base.petSel))?.effect?.shaToFireball==true?CardLibrary.FindById("tt3-fireball")??CardLibrary.SHA:CardLibrary.FindById(CardLibrary.SHA.id)??CardLibrary.SHA;
        public int DepartureStarterCountForPet(string petId)=>GameRules.StarterSha+(BaseData.PetsCatalog.FirstOrDefault(p=>p.id==(petId??Base.petSel))?.effect?.extraSha??0);
        public BagCapacityQuery PreviewDeparture(Dictionary<string,int> picks)
            =>PreviewDeparture(picks,Base.petSel);
        public BagCapacityQuery PreviewDeparture(Dictionary<string,int> picks,string petId)
            => ProjectDeparture(picks, petId).capacity;

        /// <summary>applyDeployPicks(picks)：把出发准备页选择的仓库卡牌带入背包。</summary>
        public void ApplyDeployPicks(Dictionary<string, int> picks)
            => ApplyStableDeparturePicks(picks);

        /// <summary>game.run.js pickClass：确认角色（熟练度生命加成 + 随机角色卡）。fromChoice=false 为 NewRun 预选。</summary>
        public void SetCharacter(string characterIdOrClass, bool fromChoice = true)
        {
            var ch = CharacterTable.CharacterFor(characterIdOrClass);
            if (ch == null) return;
            State.myClass = ch.rulesetId;
            State.characterId = ch.id;
            State.classCard = null;
            Log($"[[icon:medal]] 本局角色：<b>{ch.name}</b>", "ok");
            // 熟练度加成：每级（Lv.1 起）生命上限 +2，立即生效
            int lv = Meta.ClassLv(ch.rulesetId);
            if (lv > 1)
            {
                int bonus = lv - 1;
                State.maxHp += bonus; State.hp += bonus;
                Log($"[[icon:medal]] {ch.name} 熟练度 <b>Lv.{lv}</b>：生命上限 +{bonus}（{State.maxHp}）", "ok");
            }
            var card = CardLibrary.RandomClassCard(Rng, ch.rulesetId);
            var second=CardLibrary.RandomClassCard(Rng,ch.rulesetId);
            for(int i=0;i<8&&card!=null&&second!=null&&card.id==second.id;i++)second=CardLibrary.RandomClassCard(Rng,ch.rulesetId);
            State.entrySupply=new EntrySupplyReceipt();
            if(card!=null)State.entrySupply.cardIds.Add(card.id);
            if(second!=null&&second.id!=card?.id)State.entrySupply.cardIds.Add(second.id);
            if (fromChoice)
            {
                State.Phase = "idle";
                SaveCurrent();
            }
        }

        /// <summary>game.session.js enterLayer(li, atIdx)。</summary>
        public void EnterLayer(int li, int atIdx,bool save=true)
        {
            State.layerIdx = li;
            State.trackPos = atIdx;
            State.pos = CellCenter(li, atIdx);
            State.hop = 0;
            State.Phase = "idle";
            RevealCurrent();
            var f = CurLayer;
            int eIdx = f.entrances.IndexOf(atIdx);
            string eName = eIdx >= 0 ? f.entranceNames[eIdx] : $"#{atIdx} 格";
            Log($"—— 置身 <b>{f.name}</b>（{eName}）——", "sys");
            if(save)SaveCurrent();
        }

        /// <summary>game.boot.js loop 的 elapsed 语义：state ∈ {idle,rolling,moving,modal} 时累计对局时长。</summary>
        public void Tick(float dt)
        {
            State.time += dt;
            switch (State.Phase)
            {
                case "idle": case "rolling": case "moving": case "modal":
                    State.elapsed += dt; break;
            }
        }

        // ============================================================
        // 掷骰与移动（game.run.js roll/moveBy/resolveCell）
        // ============================================================
        /// <summary>
        /// game.run.js roll() + moveBy(n)：掷骰→记录→turn++→track('action')→逻辑推进到目标格→落脚结算。
        /// 640ms 骰子动画与逐格 hop 动画由 UI 按 Path 播放；本方法立即完成逻辑结算。
        /// </summary>
        public RollResult Roll()
        {
            Bus.Emit(new ToastRequested("请选择地图上的相邻地点，再次点击确认前往"));
            return null;
        }

        NodeResult _lastNode;

        /// <summary>game.run.js resolveCell：落脚结算（战斗/即时/门/祭坛/撤离/商店），返回给 UI 呈现。</summary>
        public NodeResult ResolveCell()
        {
            var g=State;var lc=CurLayer.logical[g.trackPos];string key=CurrentNodeId;
            if(g.closed.Contains(key)||(g.settled.Contains(key)&&!new[]{"shop","fire","altar","door","emergencyExit","extraction"}.Contains(lc.type))){g.Phase="idle";SaveCurrent();return null;}
            if(_lastNodeKey==key&&_lastNode!=null){g.Phase="modal";Present(_lastNode);return _lastNode;}
            var receipt=CurrentNodeReceipt;NodeResult node=null;
            if(receipt.battleWon && !receipt.completed)
            {
                g.Phase="modal";
                node=new NodeResult{Kind=NodeKind.Chest,KindRaw="battle-rewards"};
                _lastNodeKey=key;Present(node);return node;
            }
            switch(lc.type)
            {
                case "entrance":g.settled.Add(key);g.Phase="idle";SaveCurrent();return null;
                case "battle":
                    var enemies=receipt.enemies?.Select(t=>new EnemyStats{id=t.id,name=t.name,hp=t.hp,atk=t.atk,behavior=t.behavior,elite=t.elite,eliteSkill=t.eliteSkill,desc=t.desc,damageCap=t.damageCap,evenAttack=t.evenAttack}).ToList();
                    if(enemies==null){enemies=BuildEncounter(g.layerIdx);receipt.enemies=enemies.Select(t=>new MonsterDef{id=t.id,name=t.name,hp=t.hp,atk=t.atk,behavior=t.behavior,elite=t.elite,eliteSkill=t.eliteSkill,desc=t.desc,damageCap=t.damageCap,evenAttack=t.evenAttack}).ToList();SaveCurrent();}
                    node=BattleNode(enemies);break;
                case "boss":
                    if(!g.altarActivated){g.Phase="idle";Bus.Emit(new ToastRequested("需先激活祭坛"));return null;}
                    // Current openBossGate owns confirmation; merely visiting must not roll or start the encounter.
                    g.Phase="modal";node=new NodeResult{Kind=NodeKind.Boss,KindRaw="boss",Transition=Transitions["battle"]};break;
                case "altar":node=AltarEntranceNode((key,g.trackPos),lc);break;
                case "extraction":g.Phase="modal";node=new NodeResult{Kind=NodeKind.Extraction,KindRaw="extraction",Transition=Transitions["emergencyExit"]};break;
                case "door":var d=CurLayer.doors.FirstOrDefault(x=>x.at==g.trackPos);node=d==null?null:DoorNode(d,lc);break;
                case "emergencyExit":node=EmergencyNode();break;
                case "shop":node=ShopNode();break;
                case "event":
                    if(!string.IsNullOrEmpty(receipt.eventCardId)){var card=CardLibrary.FindById(receipt.eventCardId);node=new NodeResult{Kind=NodeKind.Event,KindRaw="event",Instant=new InstantInfo{EventCard=card}};g.Phase="modal";}
                    else {node=RunInstant(lc);receipt.eventCardId=node?.Instant?.EventCard?.id;}
                    break;
                case "chest":
                    receipt.chests=receipt.chests??new[]{Rng.Random("loot","reward")<.7?"small":"medium"};g.Phase="modal";
                    node=new NodeResult{Kind=NodeKind.Chest,KindRaw="chest",Instant=new InstantInfo{Chests=receipt.chests.ToList()}};break;
                case "resource":
                    ReserveResourceReward(receipt);node=new NodeResult{Kind=NodeKind.Resource,KindRaw="resource",Instant=new InstantInfo()};g.Phase="modal";break;
                default:node=RunInstant(lc);break;
            }
            _lastNodeKey=key;SaveCurrent();Present(node);return node;
        }

        void Present(NodeResult node)
        {
            _lastNode = node;
            _lastNodeKey = CurrentNodeId;
            if (node != null) Bus.Emit(new NodeEntered { Node = node });
        }

        /// <summary>契约 §4 EnterNode(kind)：取最近一次落脚结算中该类型的节点数据（含过场元数据）。</summary>
        public NodeResult EnterNode(NodeKind kind)
        {
            var node = _lastNode;
            if (node != null && node.Kind == kind) return node;
            return node;
        }

        /// <summary>连锁移动（moveBy 复用）：时空孔隙等事件把棋子向前推 n 格。</summary>
        public NodeResult ChainMove(int n)
        {
            State.chainMove=0;State.Phase="idle";SaveCurrent();return null;
        }

        /// <summary>finishInstant / 场景收尾：事件连锁移动优先，否则回待机并存档。</summary>
        public void FinishNode()
        {
            if (State.chainMove != 0)
            {
                int n = State.chainMove;
                State.chainMove = 0;
                ChainMove(n);
                return;
            }
            if(State.runActive && !new[]{"shop","fire","altar","door","emergencyExit","extraction","chest","resource"}.Contains(CurLayer.logical[State.trackPos].type)){
                State.settled.Add(CurrentNodeId);CurrentNodeReceipt.completed=true;
            }
            State.Phase = "idle";
            SaveCurrent();
        }

        static string KindRawOf(string defType) => defType ?? "";
        static NodeKind KindOf(string defType) => defType switch
        {
            "coin" => NodeKind.Coin, "wood" => NodeKind.Wood, "battle" => NodeKind.Battle,
            "event" => NodeKind.Event, "shop" => NodeKind.Shop, "fire" => NodeKind.Fire,
            "chest" => NodeKind.Chest, "rations" => NodeKind.Rations, "key" => NodeKind.Key,
            "emergencyExit" => NodeKind.EmergencyExit, "door" => NodeKind.Door,
            "altar" => NodeKind.Altar, "boss" => NodeKind.Boss, "resource" => NodeKind.Resource, "extraction" => NodeKind.Extraction, _ => NodeKind.Event,
        };

        // ---------- enterNode 过场表（文案照抄 game.run.js） ----------
        static readonly Dictionary<string, TransitionInfo> Transitions = new Dictionary<string, TransitionInfo> {
            ["battle"] = new TransitionInfo { Tone = "battle", Asset = "scene-battle-bg", Eyebrow = "HOSTILE CONTACT", Title = "遭遇敌袭", Detail = "武器解锁 · 准备接敌" },
            ["door"] = new TransitionInfo { Tone = "door", Asset = "scene-door-bg", Eyebrow = "GATE SIGNAL", Title = "抵达大门", Detail = "环层通路正在响应" },
            ["altar"] = new TransitionInfo { Tone = "altar", Asset = "scene-altar-bg", Eyebrow = "CONTAMINATION DETECTED", Title = "污染核心", Detail = "高危生命信号逼近" },
            ["emergencyExit"] = new TransitionInfo { Tone = "exit", Asset = "scene-extract-bg", Eyebrow = "EXTRACTION POINT", Title = "紧急撤离点", Detail = "撤离信标已经接通" },
            ["shop"] = new TransitionInfo { Tone = "shop", Asset = "scene-shop-bg", Eyebrow = "CARAVAN SIGNAL", Title = "拾荒商队", Detail = "交易频道已经开放" },
        };
        static TransitionInfo FallbackTransition => new TransitionInfo { Tone = "battle", Asset = "scene-battle-bg", Eyebrow = "", Title = "进入节点", Detail = "" };

        // ---------- 遭遇组建（game.run.js buildEncounter，设计者 2026-09-02 定版） ----------
        public List<EnemyStats> BuildEncounter(int layerIdx)
        {
            var enc=MapData.Encounters[Math.Max(0,Math.Min(layerIdx,MapData.Encounters.Length-1))];
            int entryCount=enc.entries.Length,groupCount=enc.groups?.Length??0;int chosen=(int)(Rng.Random("enemy","enemy")*(entryCount+groupCount));
            var group=chosen>=entryCount?enc.groups[chosen-entryCount]:null;var entry=group==null?enc.entries[chosen]:null;
            int n=group==null?entry.size[0]+(int)(Rng.Random("enemy","enemy")*(entry.size[1]-entry.size[0]+1)):2;
            var alternatives=layerIdx==2&&group==null?enc.entries.Where(e=>e.size[0]<=n&&e.size[1]>=n&&!MapData.Monsters[e.id].elite).ToList():new List<EncounterEntry>();
            int ordinal=Layers[layerIdx].logical.Where(c=>c.type=="battle").ToList().FindIndex(c=>c.oldIdx==State.trackPos);uint hash=2166136261;
            unchecked{foreach(char c in (State.mapSnapshot.seed+":third-layer-encounters:v1")){hash^=c;hash*=16777619;}}
            EnemyStats Enemy(string id){var t=MapData.Monsters[id];return ScaledEnemy(new EnemyStats{id=t.id,name=t.name,hp=t.hp,atk=t.atk,behavior=t.behavior,elite=t.elite,eliteSkill=t.eliteSkill,desc=t.desc,damageCap=t.damageCap,evenAttack=t.evenAttack});}
            var list=new List<EnemyStats>();for(int i=0;i<n;i++){
                string id=group==null?entry.id:group.enemyIds[i];
                if(group==null)Rng.Random("enemy","enemy");
                if(alternatives.Count>1&&ordinal>=0)id=alternatives[(int)(((ulong)hash+(uint)ordinal+(uint)i)%(ulong)alternatives.Count)].id;
                list.Add(Enemy(id));
            }
            if(enc.guaranteedElite?.Length>0)list[0]=Enemy(enc.guaranteedElite[(int)(Rng.Random("enemy","enemy")*enc.guaranteedElite.Length)]);
            _lastRisk=enc.risk;_lastStrategy=group?.strategy??enc.strategy;return list;
        }
        string _lastRisk, _lastStrategy;

        NodeResult BattleNode(List<EnemyStats> encounter)
        {
            State.Phase = "modal";
            var req = new BattleRequest
            {
                Foes = encounter, IsBoss = false, Layer = State.layerIdx,
                Name = encounter[0].name, Risk = _lastRisk, Strategy = _lastStrategy,
            };
            var node = new NodeResult { Kind = NodeKind.Battle, KindRaw = "battle", Transition = Transitions["battle"], Battle = req };
            Bus.Emit(new BattleRequested { Request = req });
            return node;
        }

        NodeResult DoorNode(RuntimeDoor door, LogicalCell cellDef)
        {
            State.Phase = "modal";
            State.discoveredPairs.Add(door.pair);
            return new NodeResult
            {
                Kind = NodeKind.Door, KindRaw = "door", Transition = Transitions["door"],
                Door = new DoorInfo
                {
                    Pair = door.pair, ToLayer = door.toLayer, At = door.at, ArriveAt = door.arriveAt,
                    Exit = door.exit, Reverse = door.reverse,
                    TargetLayerName = Layers[door.toLayer].name,
                    ShopOnCell = cellDef?.type == "shop",
                },
            };
        }

        NodeResult AltarEntranceNode((string pair, int at) altarE, LogicalCell cellDef)
        {
            State.Phase = "modal";
            State.discoveredPairs.Add(altarE.pair);
            return new NodeResult
            {
                Kind = NodeKind.Altar, KindRaw = "altar", Transition = Transitions["altar"],
                AltarEntrance = new AltarEntranceInfo { Pair = altarE.pair, ShopOnCell = cellDef?.type == "shop" },
            };
        }

        NodeResult EmergencyNode()
        {
            State.Phase = "modal";
            return new NodeResult
            {
                Kind = NodeKind.EmergencyExit, KindRaw = "emergencyExit", Transition = Transitions["emergencyExit"],
                Emergency = new EmergencyInfo { Cost = GameRules.EmergencyExitCost, Coins = State.coins, CanPay = State.coins >= GameRules.EmergencyExitCost },
            };
        }

        NodeResult ShopNode()
        {
            State.Phase = "modal";
            Bus.Emit(new ShopOpened());
            return new NodeResult { Kind = NodeKind.Shop, KindRaw = "shop", Transition = Transitions["shop"], IsShop = true };
        }

        /// <summary>game.run.flow.js runInstant(def)：拾取与固定奖励先准备记录，由领取命令入账。</summary>
        NodeResult RunInstant(LogicalCell def)
        {
            if(new[]{"coin","wood","rations","key"}.Contains(def.type))return PrepareCurrentPickup(def);
            var node = new NodeResult { Kind = KindOf(def.type), KindRaw = KindRawOf(def.type), Transition = FallbackTransition };
            var info = new InstantInfo();
            node.Instant = info;
            switch (def.type)
            {
                case "chest":
                    info.Chests = new List<string> { "small" };   // 物资格：开 1 个小型遗留物资箱
                    info.ChestText = null;
                    Log($"[[icon:archive]] 回收了{ChestDropText(info.Chests)}", "loot");
                    State.Phase = "modal";
                    break;
                case "fire":
                    return FireRestNode();   // 火堆：回 10 血 + 消耗口袋复原 2 张 + 30% 额外职业卡
                case "event":
                    return RunEventDeck();
                default:
                    State.Phase = "idle";
                    SaveCurrent();
                    return null;
            }
            if (info.Chests == null) { State.Phase = "modal"; SaveCurrent(); }   // 呈现完过场屏（FinishNode）再回 idle，防止过场未关即可再掷骰
            return node;
        }

        /// <summary>chests.js dropText 等价：宝箱列表 → 文案（「1 个小型物资箱」）。</summary>
        public static string ChestDropText(List<string> chests)
        {
            var kinds = new Dictionary<string, string> { ["small"] = "小型物资箱", ["medium"] = "密封物资箱", ["large"] = "军用保险柜", ["boss"] = "首脑保险柜" };
            var names = chests.Select(k => kinds.TryGetValue(k, out var n) ? n : k);
            return string.Join("、", names.GroupBy(x => x).Select(g => g.Count() > 1 ? $"{g.Key}×{g.Count()}" : g.Key));
        }

        /// <summary>game.run.js openChestsOnCell：事件路径开箱（状态 modal；开完 UI 调 FinishNode）。</summary>
        public NodeResult OpenChestsOnCell(List<string> chests, string text)
        {
            Log($"[[icon:archive]] {text ?? ("回收了" + ChestDropText(chests))}", "loot");
            State.Phase = "modal";
            return new NodeResult { Kind = NodeKind.Chest, KindRaw = "chest", Transition = FallbackTransition,
                Instant = new InstantInfo { Chests = chests, ChestText = text } };
        }

        /// <summary>game.run.js openFireRest：回血 + 30% 职业卡 + 消耗口袋复原（选牌交互）。</summary>
        public NodeResult FireRestNode()
        {
            var receipt=CurrentNodeReceipt;State.Phase="modal";
            return new NodeResult{Kind=NodeKind.Fire,KindRaw="fire",Transition=FallbackTransition,Instant=new InstantInfo{Fire=new FireRestInfo{HealAmount=receipt.healAmount,RestorePicks=receipt.restoreUsed?0:2,GotClassCard=receipt.bonusReceived,ClassCardName=CardLibrary.FindById(receipt.classCardId)?.name}}};
        }
        static bool FireRestorable(CardDef c)=>c!=null&&c.type!="装备"&&c.type!="道具";
        bool FitsRestored(CardDef c)=>CanReceiveCard(c);
        void FireBonus(NodeVisitReceipt receipt)
        {
            if(receipt.bonusRolled)return;receipt.bonusRolled=true;
            if(Rng.Random("card","reward")<GameRules.FireClassCardChance){var c=CardLibrary.RandomClassCard(Rng,State.myClass);if(c!=null){receipt.classCardId=c.id;receipt.bonusReceived=GrantCard(c);}}
        }
        public bool TryFireHeal(out string reason)
        {
            return TryPersistMutation(()=>{var r=CurrentNodeReceipt;if(State.battleActive||r.type!="fire"||State.closed.Contains(CurrentNodeId)||r.healUsed||State.hp>=State.maxHp)throw new InvalidOperationException("当前无法回血");
                r.healAmount=Heal(FireHeal);r.healUsed=true;FireBonus(r);},out reason);
        }
        public bool TryFireRestore(out string reason)
        {
            return TryPersistMutation(()=>{var r=CurrentNodeReceipt;if(State.battleActive||r.type!="fire"||State.closed.Contains(CurrentNodeId)||r.restoreUsed)throw new InvalidOperationException("本次复原已使用");
                if(!State.usedPocket.Any(p=>p.count>0&&FireRestorable(p.card)&&FitsRestored(p.card)))throw new InvalidOperationException("没有可复原卡牌或背包需腾位");
                FireBonus(r);int restored=0;for(int i=0;i<2;i++){var available=State.usedPocket.Where(p=>p.count>0&&FireRestorable(p.card)&&FitsRestored(p.card)).ToList();if(available.Count==0)break;var p=available[(int)(Rng.Random("pocket")*available.Count)];p.count--;if(p.count==0)State.usedPocket.Remove(p);State.ownedCards.Add(new OwnedCard{uid=NewUid(),card=p.card.Clone()});r.restoredIds.Add(p.card.id);restored++;}
                if(restored<=0)throw new InvalidOperationException("背包需腾位");r.restoreUsed=true;},out reason);
        }
        public bool FireRestoreOne(int pocketIndex)
        {
            if(pocketIndex<0||pocketIndex>=State.usedPocket.Count)return false;
            return TryFireRestore(out _);
        }
        public int FireRestoreLeft=>CurrentNodeReceipt.restoreUsed?0:2;
        public void FireRestoreDone(){State.Phase="idle";SaveCurrent();}

        // ---------- 事件卡（game.run.js runEventDeck / triggerEventCard） ----------
        /// <summary>事件格：从卡牌库「事件」卡池随机触发；无事件卡时退回旧随机事件表。</summary>
        NodeResult RunEventDeck()
        {
            var deck = CardDatabase.All.Where(c => c.type == "事件").ToList();
            if (deck.Count == 0)
            {
                var ev = Weighted(MapData.RandomEvents.Select(r => (e: r, w: (double)r.w)).ToList());
                if (ev.coinsMin != null)
                { Log($"【事件】{ev.text}", "sys"); GainCoins(ev.coinsMin.Value + (int)(Rng.NextDouble() * (ev.coinsMax.Value - ev.coinsMin.Value + 1))); }
                else if (ev.item != null) { Log($"【事件】{ev.text}", "sys"); AddItem(Pick(MapData.ChestTable)); }
                else Log($"【事件】{ev.text}", "dim");
                State.Phase = "idle";
                SaveCurrent();
                return null;
            }
            var used = new HashSet<string>(State.nodeRewards.Values
                .Where(record => record.type == "event" || record.type == "event-choice")
                .Select(record => record.eventCardId).Where(id => !string.IsNullOrEmpty(id)));
            var history = State.eventLog ?? new List<EventLogEntry>();
            var available = deck.Where(card => !used.Contains(card.id)
                && !history.Any(entry => entry.id == card.id || entry.name == card.name)).ToList();
            if (available.Count == 0)
            {
                State.Phase = "modal";
                return new NodeResult { Kind = NodeKind.Event, KindRaw = "event", Transition = FallbackTransition,
                    Instant = new InstantInfo { EventPoolExhausted = true } };
            }
            return TriggerEventCard(Pick(available),false);
        }

        /// <summary>triggerEventCard(card)：记录触发历史；返回事件页数据（选项经 NarrativeBridge 或单按钮）。</summary>
        public NodeResult TriggerEventCard(CardDef card)
            =>TriggerEventCard(card,true);
        NodeResult TriggerEventCard(CardDef card,bool present)
        {
            var g = State;
            g.eventLog ??= new List<EventLogEntry>();
            g.eventLog.Add(new EventLogEntry { id = card.id, name = card.name, desc = card.desc ?? "", turn = g.turn });
            Log($"[[icon:dice]] 触发事件【<b>{card.name}</b>】{(string.IsNullOrEmpty(card.desc) ? "" : "· " + card.desc)}", "sys");
            g.Phase = "modal";
            Audio.PlaySfx("scene");
            var node = new NodeResult { Kind = NodeKind.Event, KindRaw = "event", Transition = FallbackTransition,
                Instant = new InstantInfo { EventCard = card } };
            if(present)Present(node);
            return node;
        }

        /// <summary>事件卡选项（eventChoiceSpec）：经 NarrativeBridge（ink 叙事）取选项；无则空表=单按钮「继 续」。</summary>
        public List<EventChoice> EventChoices(CardDef card)
        {
            try { return NarrativeBridge?.Invoke(card); } catch { return null; }
        }

        /// <summary>game.run.js eventChoiceSpec 的 effects 表（数值与文案照抄）。执行后返回结算结果。</summary>
        public EventOutcome ApplyEventChoice(string effectKey)
        {
            var g = State;
            void settle(Action run)
            {
                run();
                g.Phase = "idle";
                SaveCurrent();
            }
            var o = new EventOutcome();
            switch (effectKey)
            {
                case "goldmine_safe":
                    settle(() => GainCoins(3)); o.Settled = true; break;
                case "goldmine_deep":
                    settle(() => { GainCoins(6); g.hp = Math.Max(1, g.hp - 3); Log("[[icon:tools]] 挖矿过深，获得 6 币但损失 3 血", "warn"); });
                    o.Settled = true; break;
                case "airdrop_wood":
                    settle(() => AddItem(MapData.Items["wood"], 1)); o.Settled = true; break;
                case "airdrop_rations":
                    settle(() => AddItem(MapData.Items["rations"], 1)); o.Settled = true; break;
                case "airdrop_heal":
                    settle(() => Heal(3)); o.Settled = true; break;
                case "chest_small":
                    o.Chests = new List<string> { "small" }; o.ChestText = "你选择了稳妥的小型物资箱";
                    Present(OpenChestsOnCell(o.Chests, o.ChestText)); break;
                case "chest_medium":
                    o.Chests = new List<string> { "medium" }; o.ChestText = "你选择了高风险的密封物资箱";
                    Present(OpenChestsOnCell(o.Chests, o.ChestText)); break;
                case "timeskip_move":
                    settle(() => { Log("[[icon:crystal]] 时空孔隙把你向前卷了 <b>6</b> 格！", "sys"); g.chainMove = 6; });
                    o.Settled = true; break;
                case "relief_heal":
                    settle(() => { Log("[[icon:heart]] 爱心救济站为你处理了伤口", "ok"); Heal(6); }); o.Settled = true; break;
                case "mystery_supply":
                    settle(() => { GrantCard(CardLibrary.FindByName("彩色令牌")); GainCoins(2); }); o.Settled = true; break;
                case "systemsupply_restock":
                    settle(() => { GrantCard(CardLibrary.FindByName("彩色令牌")); AddItem(MapData.Items["wood"], 1); }); o.Settled = true; break;
                case "demondeal_trade":
                    settle(() =>
                    {
                        g.hp = Math.Max(1, g.hp - 1);
                        Log("[[icon:demon]] 恶魔收走了一点生命力（-1 血）", "warn");
                        var legends = CardDatabase.All.Where(c => c.rarity == "传说" && (c.type == "装备" || c.type == "武术" || c.type == "法术")).ToList();
                        GrantCard(legends.Count > 0 ? legends[(int)(Rng.NextDouble() * legends.Count)] : null);
                    });
                    o.Settled = true; break;
                case "bandits_fight":
                {
                    Log("[[icon:swords]] 掠夺者一伙（×5）拦住了去路！", "warn");
                    g.pendingEventLoot = new PendingLoot { text = "密封物资箱 ×2", chests = new[] { "medium", "medium" } };
                    g.Phase = "modal";
                    var tpl = MapData.Monsters["bandit"];
                    var gang = new List<EnemyStats>();
                    for (int i = 0; i < 5; i++) gang.Add(ScaledEnemy(new EnemyStats { id = tpl.id, name = tpl.name, hp = tpl.hp, atk = tpl.atk, behavior = tpl.behavior }));
                    o.Battle = new BattleRequest { Foes = gang, IsBoss = false, Layer = g.layerIdx, Name = tpl.name };
                    Bus.Emit(new BattleRequested { Request = o.Battle });
                    Present(new NodeResult { Kind = NodeKind.Battle, KindRaw = "battle", Transition = Transitions["battle"], Battle = o.Battle });
                    break;
                }
                case "goldhammer_strike":
                {
                    var enc = g.layerIdx < MapData.Encounters.Length ? MapData.Encounters[g.layerIdx] : MapData.Encounters[0];
                    var tpl = MapData.Monsters[enc.pool[(int)(Rng.NextDouble() * enc.pool.Length)]];
                    var foe = ScaledEnemy(new EnemyStats { id = tpl.id, name = tpl.name, hp = tpl.hp, atk = tpl.atk, behavior = tpl.behavior });
                    foe.hp -= 5;
                    if (foe.hp <= 0)
                    {
                        Log($"[[icon:tools]] 闪金之锤一击制敌（{foe.name}）！+2 币", "coin");
                        GainCoins(2);
                        g.Phase = "idle"; SaveCurrent();
                        o.Settled = true;
                        break;
                    }
                    Log($"[[icon:tools]] 闪金之锤重击 <b>{foe.name}</b>（-5 血），战斗打响！", "warn");
                    g.Phase = "modal";
                    o.Battle = new BattleRequest { Foes = new List<EnemyStats> { foe }, IsBoss = false, Layer = g.layerIdx, Name = foe.name };
                    Bus.Emit(new BattleRequested { Request = o.Battle });
                    Present(new NodeResult { Kind = NodeKind.Battle, KindRaw = "battle", Transition = Transitions["battle"], Battle = o.Battle });
                    break;
                }
                default:
                    settle(() => { });   // 未列出的事件：单按钮结算（兼容旧存档与自定义事件卡）
                    o.Settled = true; break;
            }
            return o;
        }

        /// <summary>applyEventEffect(card)（旧版单按钮路径）：效果后续版本实装，仅存档。</summary>
        public void ApplyEventEffect(CardDef card)
        {
            Log("（该事件的效果将在后续版本实装）", "dim");
            SaveCurrent();
        }

        // ---------- 节点弹窗动作（data-act 等价方法） ----------
        /// <summary>openDoorModal goDoor：穿过闸门 → enterLayer。</summary>
        public void UseDoor(DoorInfo door)
        {
            if(door!=null)TryUseDoor(door.ToLayer,door.ArriveAt,out _);
        }
        public bool TryUseDoor(int toLayer,int arriveAt,out string reason)
        {
            if(State.battleActive||!State.runActive||!CurLayer.doors.Any(d=>d.at==State.trackPos&&d.toLayer==toLayer&&d.arriveAt==arriveAt)){reason="当前闸门无法通行";return false;}
            return TryPersistMutation(()=>{
                CloseCurrentNode();_lastNode=null;_lastNodeKey=null;
                Log("穿过隔离闸门，继续深入", "sys");
                EnterLayer(toLayer, arriveAt);
                State.explored.Add(CurrentNodeId);
                Bus.Emit(new NodeMovementCompleted{LayerIdx=State.layerIdx,NodeId=CurrentNodeId});
            },out reason);
        }
        /// <summary>openDoorModal stayHere。</summary>
        public void StayHere() { State.Phase = "idle"; }

        /// <summary>openAltarEntranceModal enterAltar：踏入污染核心（altarFrom 记录入口格）。</summary>
        public void EnterAltarArea(string pair)
        {
            State.altarFrom = new AltarFrom { li = State.layerIdx, idx = State.trackPos, pair = pair };
            State.pos = CellCenter(State.layerIdx,State.trackPos);
            Log("踏入<b>污染核心</b>……盖革计数器的咔嗒声密了起来", "sys");
        }

        /// <summary>openAltarModal：BOSS 选择页数据（属性按模式缩放；eliteTip 文案照抄）。</summary>
        public List<AltarBossInfo> AltarBosses()
        {
            State.Phase = "modal";
            return MapData.AltarBosses.Select(b =>
            {
                var s = ScaledEnemy(new EnemyStats { id = b.id, name = b.name, hp = b.hp, atk = b.atk });
                return new AltarBossInfo { Id = b.id, Name = b.name, Atk = s.atk, Hp = s.hp, AffixDesc = b.affixDesc };
            }).ToList();
        }

        /// <summary>openAltarModal fightBoss(i)：开启 BOSS 战（BOSS 战使用过的卡牌不会消耗）。</summary>
        public BattleRequest FightBoss(int bossIndex)
        {
            var b = MapData.AltarBosses[bossIndex];
            var req = new BattleRequest
            {
                Foes = new List<EnemyStats> { ScaledEnemy(new EnemyStats { id = b.id, name = b.name, hp = b.hp, atk = b.atk, behavior = b.behavior }) },
                IsBoss = true, ReturnTo = "map", Name = b.name, Layer=State.layerIdx,
            };
            Bus.Emit(new BattleRequested { Request = req });
            return req;
        }

        /// <summary>openAltarModal leaveAltar：退回入口格。</summary>
        public void LeaveAltar()
        {
            var f = State.altarFrom;
            if (f != null)
            {
                State.layerIdx = f.li; State.trackPos = f.idx;
                State.pos = CellCenter(f.li, f.idx);
            }
            State.Phase = "idle";
            Log("退出污染核心，回到入口格", "dim");
        }

        /// <summary>openEmergencyModal payExit：花币撤离（币不足返回 false）。</summary>
        public bool PayEmergencyExit()
        {
            Bus.Emit(new ToastRequested("紧急撤离需要选择 3 张随身卡牌献祭"));return false;
        }

        // ============================================================
        // 撤离（game.run.js doExtract / renderExtractStash / showExtractDone）
        // ============================================================
        /// <summary>game.menu.js exitToTitle：存档后回标题。</summary>
        public bool ExitToTitle()
        {
            if(State.runActive){SaveCurrent();if(!Saves.LastWriteSucceeded)return false;}
            ShowTitle();return true;
        }

        /// <summary>game.menu.js showTitle（非视觉部分）。</summary>
        public void ShowTitle()
        {
            State.Phase = "title";
            State.runActive = false;
            ActiveSlot = null;
            Audio.PlayBgm("title");
        }

        /// <summary>game.menu.js launch 后开新档（newSlot/overwriteSlot）。</summary>
        public void ResetSlot(int slot)
        {
            TryPersistMutation(()=>{ClearSlot(slot);ClearBattleCheckpoint();State.battleActive=false;State.runActive=false;State.Phase="title";ActiveSlot=slot;Base=BaseData.Reset(Saves,Rng,slot);},out _);
        }
    }
}
