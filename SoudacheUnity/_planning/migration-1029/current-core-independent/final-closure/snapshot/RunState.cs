// ported from src/game.store.js（协调者集成裁决：schema 类型唯一真源放 Sdt.Core，Sdt.Run 经 using 桥接）
using System.Collections.Generic;

namespace Sdt.Core
{
    public sealed class OwnedCard
    {
        public string uid;
        public CardDef card;
        public int? brought;    // 1 = 开局带入（放弃对局时无条件丢失）
        public bool? safe;      // true = 存放在宠物安全格
        public bool stored;
        public string pouchOf;
        public BagDiscoveryReceipt bagDiscover;
    }

    public sealed class PocketStack
    {
        public CardDef card;
        public int count;
    }

    public sealed class UsedPocketEntry
    {
        public CardDef card;
        public int count;
    }

    public sealed class EventLogEntry
    {
        public string id;
        public string name;
        public string desc = "";
        public int turn;
    }

    public sealed class InvSlot
    {
        public string name;
        public int value;
        public string tier = "C";
        public int count;
    }

    /// <summary>对局状态（game.store.js createGameState + 契约 §5 存档 schema 全集）。</summary>
    public sealed class RunState
    {
        public int? seed;                       // 对局种子（null = 未开局的 boot 态）
        public string rngState;                 // 随机服务状态快照（Rng.SaveState）
        public int layerIdx;                    // 当前环层
        public int trackPos;                    // 环内步进位置
        public int hp;
        public int maxHp;
        public int coins;
        public int fragments;
        public int turn;                        // 对局回合数（掷骰计数）
        public int atk;
        public string mode = "standard";        // 'standard' 等（对局模式）
        public string myClass;                  // 职业名（rulesetId）
        public string characterId;              // 角色档案 id（CharacterTable）
        public List<InvSlot> inventory = new List<InvSlot>();             // 物资格（木材/口粮/战利品堆叠）
        public List<OwnedCard> ownedCards = new List<OwnedCard>();        // 背包卡实例
        public List<string> cardOrder = new List<string>();               // 背包排序 uid 序列
        public List<PocketStack> usedPocket = new List<PocketStack>();    // 战斗注能消耗口袋
        public List<EventLogEntry> eventLog = new List<EventLogEntry>();  // 事件卡使用日志
        public List<string> discovered = new List<string>();              // 已发现（图鉴）卡 id
        public int slot;                        // 游玩档位（1..5）
        public double elapsed;                  // 对局秒表
        public long savedAt;                    // 存档时间戳
        public MapSnapshot mapSnapshot;
        public HashSet<string> explored = new HashSet<string>();
        public HashSet<string> revealed = new HashSet<string>();
        public HashSet<string> settled = new HashSet<string>();
        public HashSet<string> closed = new HashSet<string>();
        public Dictionary<string,NodeVisitReceipt> nodeRewards = new Dictionary<string,NodeVisitReceipt>();
        public bool altarActivated, bossDefeated;
        public int spellPower;
        public EntrySupplyReceipt entrySupply;

        // ---- 会话运行时字段（不序列化；原 game.session.js 的 g.* 活动状态） ----
        public string Phase = "boot";                                   // boot/title/rolling/idle/done
        public bool runActive;                                          // 是否有进行中对局
        public (float x, float y) pos;                                  // 玩家世界坐标
        public float time;                                              // 会话时间（模拟累计）
        public double elapsedSynced;                                    // 上次同步的 elapsed
        public int? dice;                                               // 当前骰面
        public List<int> diceHistory = new List<int>();                 // 掷骰历史
        public int hop;                                                 // 本步剩余跳格
        public int chainMove;                                           // 连锁移动余量
        public int? moveTarget;                                         // 移动目标逻辑格
        public CardDef classCard;                                       // 本局职业卡
        public HashSet<string> discoveredPairs = new HashSet<string>(); // 已发现卡 id 集（图鉴）
        public PendingLoot pendingEventLoot;                            // 事件战利品待领取
        public AltarFrom altarFrom;                                     // 祭坛入口格（li/idx/pair）
        public bool battleActive;                                       // 战斗进行中（背包禁入）
        public bool bossCleanupPending;                                 // BOSS 战后整理待完成
        public bool togglesIndex;                                       // 结点编号显隐（N 键）
    }

    /// <summary>污染核心入口记录（EnterAltarArea 存、LeaveAltar 消费）。</summary>
    public sealed class AltarFrom { public int li, idx; public string pair; }

    /// <summary>事件战利品待领取（bandits_fight：战胜后发放的密封物资箱）。</summary>
    public sealed class PendingLoot { public string text; public string[] chests; }
    [System.Serializable] public sealed class NodeVisitReceipt
    {
        public string type,eventCardId;
        public EventProgress eventProgress;
        public bool completed,healUsed,restoreUsed,bonusRolled;
        public bool pickupPrepared,pickupClaimed,pickupSaved;
        public string[] chests;
        public int coins,restoreLeft,healAmount;
        public string classCardId;
        public bool bonusReceived;
        public List<string> restoredIds = new List<string>();
        public List<MonsterDef> enemies;
        public List<string> rewardCardIds;
        public int? rewardTaken;
        public List<ChestVisitReceipt> chestQueue;
        public int chestIndex;
        public bool battleWon;
        public List<ShopOfferReceipt> shopStock;
        public bool battleBoss;
        public List<string> battleConsumed = new List<string>();
        public bool extraLegendaryPrepared;
        public List<string> battleFoeNames=new List<string>();
        public bool altarRewardPending,altarItemSacrificed;
        public string altarRewardKind,altarFragmentCardId;
        public int altarRestoreLeft;
        public List<int> altarTaken=new List<int>();
    }
    [System.Serializable] public sealed class EntrySupplyReceipt
    {
        public List<string> cardIds = new List<string>();
        public List<int> taken = new List<int>();
    }
    public sealed class BagDiscoveryReceipt
    {
        public int version=1;
        public string poolKind="legendary";
        public List<string> cardIds=new List<string>();
    }
}
