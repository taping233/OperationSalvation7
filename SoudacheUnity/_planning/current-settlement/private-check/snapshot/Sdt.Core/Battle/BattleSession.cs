// ported from src/battle.core.js
// 战斗核心：状态机 + 命令（PlayCard/EndTurn/Retract）+ 快照 + 不可打出判定。
// 纯逻辑：宿主（血量/卡组/日志/结束回调）经 BattleHost 注入；无 Unity 依赖。
// 与原版差异（协调者已认可的移植决策）：
//   1. 敌人回合的 setTimeout(420ms) 节奏动画改为同步结算，快照在每步后经 SnapshotChanged 通知；
//   2. 音效调用（SDT.Sound.*）归 W3/W7，本层只产生日志与飘字数据；
//   3. esc/escapeHtml 在核心层为恒等函数（HTML 转义由 UI 层渲染时处理）。
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Sdt.Core.Battle
{
    /// <summary>宿主桥：由 W3 GameRuntime 实现，对齐 battle.core.js 对 game 对象（G）的全部用法。</summary>
    public interface BattleHost
    {
        int Hp { get; set; }
        int MaxHp { get; }
        int Atk { get; }
        int SpellPower { get; }          // 原版 G.spellPower || 0
        string MyClass { get; }          // 原版 G.myClass || null
        string CharacterId { get; }      // 原版 G.characterId || null
        IReadOnlyList<OwnedCard> OwnedCards { get; }
        void Log(string message, string kind = null);   // 对齐 G.log(message, kind)
        void Heal(int amount);                           // 对齐 G.heal（受模式加成等由宿主处理）
        void OnBattleEnd(BattleResult result);           // 对齐 G.onBattleEnd(opts, played, win, consumed)
    }

    /// <summary>敌人定义输入（对齐 start 的 enemyDefs 元素）。</summary>
    public sealed class EnemyInput
    {
        public string id, name, affix, affixName, behavior;
        public string eliteSkill, desc;
        public int damageCap;
        public bool elite, evenAttack, noFirstAttack;
        public int hp, atk;
    }

    /// <summary>战斗开始参数（对齐 start(game, enemyDefs, options) 的 options）。</summary>
    public sealed class BattleStartContext
    {
        public BattleHost host;                    // 必填：宿主桥
        public IReadOnlyList<EnemyInput> enemies;  // 敌人组（多敌人遭遇）
        public bool isBoss;
        public int layer;
        public string returnTo;
        public string name;
        public string risk;                        // 遭遇战风险文案（低/中/高）
        public string runMode="standard";
        public Rng rng = null;                     // 默认 Rng.Default；battle/status 流用于击杀欢呼/狂乱掷骰
        public bool IsBoss => isBoss;              // UI 别名
        public string Strategy => risk;            // UI 别名（源字段 risk）
    }

    /// <summary>战斗结束回调载荷（对齐 finish() → G.onBattleEnd 的实参）。</summary>
    public sealed class BattleResult
    {
        public int TurnMovesMax,BattleEquipsMax,ReviveKills;
        public List<OwnedCard> SpentCards = new List<OwnedCard>();
        public bool? Win;                          // true 胜 / false 负 / null 撤退
        public bool IsBoss;
        public int Layer;
        public string ReturnTo;
        public string Name;
        public string Risk;
        public List<string> FoeNames = new List<string>();
        public List<string> Played = new List<string>();     // 本场打出的卡 uid
        public List<string> Consumed = new List<string>();   // 本场注能消耗的卡 uid
        public BattleSummary Summary;
    }

    /// <summary>命令统一返回：Ok=false 时 Reason 给出不可执行原因（对齐 play 里的 warn 日志语义）。</summary>
    public sealed class CommandResult
    {
        public bool Ok;
        public string Reason;
        public static CommandResult Yes() { return new CommandResult { Ok = true }; }
        public static CommandResult No(string reason) { return new CommandResult { Ok = false, Reason = reason }; }
    }

    public sealed class FoeIntent
    {
        public string kind; public string icon; public string label; public int damage;
        public int hits=1, bleedBonus;
        public bool HasDamage=true;
        public string Icon => icon; public string Label => label; public int Damage => damage;   // UI 别名
    }

    /// <summary>敌人运行时（对齐 foes 数组元素；继承战斗载体）。</summary>
    public sealed class BattleFoe : Combatant
    {
        public string eliteSkill, desc;
        public bool elite, evenAttack, noFirstAttack, stunned;
        public string id;
        public string affix;
        public string affixName;
        public FoeIntent intent;
        public string Id => id; public string Name => name; public string Affix => affix;
        public int Hp => hp; public int MaxHp => maxHp; public int Atk => atk; public bool Dead => dead;
        public UnitStatus Status => status;   // UI 别名
    }

    // —— 快照子结构（对齐 getSnapshot() 各冻结字段的形状）——
    public sealed class PlayerSnapshot
    {
        public int hp, maxHp, atk, spellPower; public string myClass, characterId;
        public int Hp => hp; public int MaxHp => maxHp; public int Atk => atk; public int SpellPower => spellPower;
        public string MyClass => myClass; public string CharacterId => characterId;   // UI 别名
    }
    public sealed class PstatSnapshot
    {
        public int hp; public IReadOnlyDictionary<string, int> status;
        public int Hp => hp; public IReadOnlyDictionary<string, int> Status => status;   // UI 别名
    }
    public sealed class FoeSnapshot
    {
        public string id, name, affix, affixName, behavior;
        public string eliteSkill, desc;
        public int damageCap;
        public bool elite, evenAttack, noFirstAttack, stunned, Statless;
        public int hp, maxHp, atk; public bool dead;
        public IReadOnlyDictionary<string, int> status;
        public DefenseState defense;
        public FoeIntent intent;
        public string Id => id; public string Name => name; public string Affix => affix;
        public int Hp => hp; public int MaxHp => maxHp; public int Atk => atk; public bool Dead => dead;
        public IReadOnlyDictionary<string, int> Status => status;   // UI 别名
        public FoeIntent Intent => intent;                          // UI 别名
    }
    public sealed class InfusingSnapshot
    {
        public bool CanPlayDirect;
        public string uid; public CardDef card; public int need; public IReadOnlyList<string> picked;
        public string Uid => uid; public CardDef Card => card; public int Need => need; public IReadOnlyList<string> Picked => picked;   // UI 别名
    }
    public sealed class DiscoveringSnapshot
    {
        public IReadOnlyList<CardDef> options; public int n; public string rarity;
        public IReadOnlyList<CardDef> Options => options;   // UI 别名
    }
    public sealed class PendingTargetSnapshot
    {
        public string uid; public CardDef card;
        public string Uid => uid; public CardDef Card => card;   // UI 别名
    }
    public sealed class DeckCardEntry { public string uid; public CardDef card;
        public string Uid => uid; public CardDef Card => card;   // UI 别名
    }
    public sealed class DeckSelectionSnapshot
    {
        public int Maximum;
        public int need;                // bossDeckSize
        public int starterCount;        // 初始攻击自动带入数
        public IReadOnlyList<string> selected;
        public IReadOnlyList<DeckCardEntry> cards;
        public FoeSnapshot boss;
        public int Need => need; public int StarterCount => starterCount;
        public IReadOnlyList<string> Selected => selected; public IReadOnlyList<DeckCardEntry> Cards => cards;
        public FoeSnapshot Boss => boss;   // UI 别名
    }

    /// <summary>战斗快照（对齐 getSnapshot() 全字段；只读数据包，每次命令后经 SnapshotChanged 广播）。</summary>
    public sealed partial class BattleSnapshot
    {
        public string mode;             // 'normal' | 'boss'
        public int turn, energy, maxEnergy;
        public bool busy;
        public BattleStartContext opts; // 原样回传开局参数（对齐 snapshot.opts）
        public PlayerSnapshot player;
        public DefenseState pdef;
        public PstatSnapshot pstat;
        public IReadOnlyList<FoeSnapshot> foes;
        public IReadOnlyList<string> hand;
        public IReadOnlyList<string> drawPile;
        public IReadOnlyList<string> discard;
        public IReadOnlyList<string> grave;
        public InfusingSnapshot infusing;
        public DiscoveringSnapshot discovering;
        public PendingTargetSnapshot pendingTarget;
        public string pendingHint;
        public bool viewingGrave;
        public bool dreadShown;
        public DeckSelectionSnapshot deckSelection;
        public RuleChoiceSnapshot RuleChoice;
        public RuleHandSelectionSnapshot RuleHandSelection;
        public IReadOnlyList<EquipmentSnapshot> Equipment;
        public HeroSkillSnapshot HeroSkill;
        public IReadOnlyList<FoeSnapshot> Allies;
        public bool over;               // 终态标记（finish 后 true；原版以 battleActive 表达，此处快照层可见）

        // ---- PascalCase 别名（W9 UI 按契约 §2 大写命名引用；集成桥） ----
        public string Mode => mode; public int Turn => turn; public int Energy => energy; public int MaxEnergy => maxEnergy;
        public bool Busy => busy; public BattleStartContext Opts => opts; public PlayerSnapshot Player => player;
        public DefenseState Pdef => pdef; public PstatSnapshot Pstat => pstat; public IReadOnlyList<FoeSnapshot> Foes => foes;
        public IReadOnlyList<string> Hand => hand; public IReadOnlyList<string> DrawPile => drawPile;
        public IReadOnlyList<string> Discard => discard; public IReadOnlyList<string> Grave => grave;
        public InfusingSnapshot Infusing => infusing; public DiscoveringSnapshot Discovering => discovering;
        public PendingTargetSnapshot PendingTarget => pendingTarget; public string PendingHint => pendingHint;
        public bool ViewingGrave => viewingGrave; public bool DreadShown => dreadShown;
        public DeckSelectionSnapshot DeckSelection => deckSelection; public bool Over => over;
    }

    public sealed partial class BattleSession
    {
        /// <summary>每次快照变更（对应原版 requestBattleRender）后触发；W9 的 BattleEvents 消费。</summary>
        public static event Action<BattleSnapshot> SnapshotChanged;
        /// <summary>战斗结束（finish）时触发，载荷与 OnBattleEnd 相同。</summary>
        public static event Action<BattleResult> BattleEnded;

        private static readonly string[] KillCheer = { "👍", "✌️", "✨" };   // 击杀后自己头上的随机欢呼贴纸

        private BattleHost G;
        private Rng rng;
        private List<BattleFoe> foes = new List<BattleFoe>();
        private BattleStartContext opts;
        private string mode = "normal";
        private List<string> drawPile = new List<string>(), hand = new List<string>(), discard = new List<string>();
        private List<OwnedCard> granted = new List<OwnedCard>();
        private readonly HashSet<string> normalStarterUids = new HashSet<string>();
        private List<string> played = new List<string>(), consumed = new List<string>();
        string _phase="start";
        string _battleToken;
        private List<string> grave = new List<string>();     // 墓地（v0.25）：被消耗的牌；不参与洗回
        private int energy, maxEnergy, turn = 1;
        private DefenseState pdef;
        private Combatant pstat;
        private bool busy;
        private InfusingState infusing;
        private DiscoveringState discovering;
        private readonly List<DiscoverJob> discoverQueue = new List<DiscoverJob>();
        private PendingTargetSnapshot pendingTarget;
        private string pendingHint = "";
        private readonly List<DelayedItem> delayed = new List<DelayedItem>();   // 「回合开始时」延迟效果
        private bool noDrawNext;
        private bool viewingGrave;
        private readonly List<BattleFloat> floats = new List<BattleFloat>();
        private bool dreadShown;
        private bool spellCost1;        // 「本局对战内所有法术 1 费」（银河之旅）
        private List<DeckCardEntry> selPool = new List<DeckCardEntry>();
        private int selShaN;
        private HashSet<string> sel = new HashSet<string>();
        private List<string> lastDeckSel = new List<string>();
        private bool selectingDeck;
        private bool over;
        private EffectExecutor applyTextEffects;

        private sealed class InfusingState { public string uid; public CardDef card; public int need, targetIndex; public HashSet<string> picked = new HashSet<string>(); }
        private sealed class DiscoveringState { public List<CardDef> options; public int n; public string rarity; }
        private sealed class DelayedItem { public string text; public string cardName; public bool repeat; }

        public static readonly IReadOnlyDictionary<string, string[]> AffixMeta = new Dictionary<string, string[]>
        {
            { "grow",   new[] { "[[icon:arrow]]",   "军威",     "每个回合结束时攻击力 +2" } },
            { "frenzy", new[] { "[[icon:tools]]",   "狂乱",     "每回合攻击两次，每次附加 1 层流血或中毒" } },
            { "aegis",  new[] { "[[icon:crystal]]", "元素庇幕", "偶数回合减免所有伤害（破甲可克制）" } },
        };
        private static readonly IReadOnlyDictionary<string, string[]> IntentMeta = new Dictionary<string, string[]>
        {
            { "strike",      new[] { "[[icon:swords]]",  "攻击" } },
            { "volley",      new[] { "[[icon:swords]]",  "攻击" } },
            { "charge",      new[] { "[[icon:swords]]",  "攻击" } },
            { "guard",       new[] { "[[icon:swords]]",  "攻击" } },
            { "curse",       new[] { "[[icon:skull]]",   "攻击并施加诅咒" } },
            { "dragon",      new[] { "[[icon:demon]]",   "攻击·阶段效果" } },
            { "general",     new[] { "[[icon:arrow]]",   "攻击·回合末强化" } },
            { "orc_boss",    new[] { "[[icon:tools]]",   "双击并施加诅咒" } },
            { "element_boss",new[] { "[[icon:crystal]]", "攻击·偶数回合庇幕" } },
            { "witness_pope",new[] { "[[icon:skull]]", "攻击·受击强化／法伤回血" } },
            { "mutation_mother",new[] { "[[icon:skull]]", "攻击·第2/4/6回合召唤" } },
            { "mysterious_blocker",new[] { "[[icon:skull]]", "攻击后清除自身一层诅咒" } },
            { "necromancer",new[] { "[[icon:skull]]", "攻击·第3/6/9回合撕牌并倍增承伤" } },
        };

        public BattleSnapshot Snapshot { get { return GetSnapshot(); } }

        private FoeIntent IntentFor(BattleFoe def, int round)
        {
            var plan=BattleEnemyPlan.Build(def,round);
            string kind = plan.Kind;
            string[] meta;
            if (!IntentMeta.TryGetValue(kind, out meta)) meta = IntentMeta["strike"];
            if(!plan.CanAttack) return new FoeIntent { kind=kind,icon="[[icon:crystal]]",damage=0,HasDamage=false,
                label=plan.Skip=="firstRound"?"蓄力·首回合不攻击":plan.Skip=="frozen"?"冰冻·无法行动":plan.Skip=="dead"?"已退场":"蓄力·下回合行动" };
            int bleed=pstat?.status.bleed??0;
            return new FoeIntent { kind = kind, icon = meta[0], label = kind=="orc_boss"&&plan.Hits==1?"攻击":meta[1], damage = Math.Max(0, def.atk)+bleed, hits=plan.Hits,bleedBonus=bleed };
        }

        private static string Esc(string s) { return s ?? string.Empty; }   // 核心层恒等转义（对齐 esc 的占位）

        private List<BattleFoe> Alive()
        {
            var list = new List<BattleFoe>();
            foreach (var f in foes) if (!f.dead) list.Add(f);
            return list;
        }

        // ---------- 牌堆提示（对齐 pileTip） ----------
        private string PileTip(List<string> uids)
        {
            var order = new List<string>();
            var counts = new List<KeyValuePair<string, int>>();
            foreach (var uid in uids)
            {
                var o = FindCard(uid);
                if (o == null) continue;
                int i = counts.FindIndex(kv => kv.Key == o.card.name);
                if (i >= 0) counts[i] = new KeyValuePair<string, int>(o.card.name, counts[i].Value + 1);
                else counts.Add(new KeyValuePair<string, int>(o.card.name, 1));
            }
            foreach (var kv in counts) order.Add(kv.Key + "×" + kv.Value);
            return order.Count > 0 ? string.Join("，", order.ToArray()) : "（空）";
        }

        private int DrawCards(int n)
        {
            int got = 0;
            while (n-- > 0)
            {
                if (drawPile.Count == 0) break;
                if (mode=="boss" && hand.Count >= GameRules.BattleHandMax) break;
                var drawnUid = drawPile[drawPile.Count - 1];
                hand.Add(drawnUid);
                drawPile.RemoveAt(drawPile.Count - 1);
                OnStructuredDraw(drawnUid);
                got++;
            }
            return got;
        }

        private int tmpSeq;
        private string NewTmpUid(string prefix)
        {
            return "battle-temp:" + prefix + ":" + (tmpSeq++);
        }

        private string AddTempCard(CardDef tpl)
        {
            string uid = NewTmpUid("bts");
            granted.Add(new OwnedCard { uid = uid, card = tpl.Clone() });
            if(tpl.type!="道具") { hand.Add(uid); castContext?.drawn.Add(uid); }
            FireRuleAcquire(tpl);
            CheckRuleCombinations();
            return uid;
        }

        // 创造一张牌直接插入牌库（「将 x 洗入牌库」用；不进手牌，战后随临时卡消散）
        private string AddDeckCard(CardDef tpl)
        {
            if(tpl.type=="道具")return AddTempCard(tpl);
            string uid = NewTmpUid("btd");
            granted.Add(new OwnedCard { uid = uid, card = tpl.Clone() });
            drawPile.Add(uid);
            FireRuleAcquire(tpl);
            return uid;
        }

        private void GrantSha(int n)
        {
            var lib = CardLibrary.All();
            CardDef baseCard = null;
            foreach (var c in lib) if (c.id == CardLibrary.SHA.id) { baseCard = c; break; }
            if (baseCard == null) baseCard = CardLibrary.SHA;
            for (int i = 0; i < n; i++) AddTempCard(baseCard);
        }

        public OwnedCard FindCard(string uid)
        {
            if (G != null) foreach (var o in G.OwnedCards) if (o.uid == uid) return OverrideCard(o);
            foreach (var o in granted) if (o.uid == uid) return OverrideCard(o);
            return null;
        }

        private static int DrawOf(CardDef card) { return (card.draw ?? 0) > 0 ? card.draw.Value : CardLibrary.DeriveDraw(card); }
        private int InfuseOf(CardDef card) { return card.noInfuse || persistentRules.Contains("allSpellsInfused") && IsMove(card) ? 0 : (card.infuse ?? 0) > 0 ? card.infuse.Value : CardLibrary.DeriveInfuse(card); }

        // 实际费用：宇宙形态下所有卡牌变为 1 费；「本局对战内所有法术 1 费」（银河之旅）只对法术生效
        private int EffCostOf(CardDef card)
        {
            if (card == null) return 0;
            if (card.runtimeCost.HasValue) return card.runtimeCost.Value;
            if (card.zeroCostUntilTurn.HasValue && card.zeroCostUntilTurn.Value == turn) return 0;
            if (card.type == "装备" || card.type == "道具" || card.type == "资源" || card.type == "生物" || card.type == "事件") return 0;
            if (pstat != null && pstat.status.Get("cosmosForm") > 0) return 1;
            if (spellCost1 && (card.type == "法术" || card.type == "武术")) return 1;
            return StructuredCost(card);
        }

        public int GetEffectiveCost(CardDef card) { return card == null ? 0 : Math.Max(0, EffCostOf(card)); }
        public bool SpellCostOne => spellCost1;
        public IReadOnlyList<OwnedCard> GrantedCards => granted.AsReadOnly();

        // ---------- 入口 ----------
        public void Start(BattleStartContext ctx)
        {
            if (ctx == null || ctx.host == null) throw new ArgumentNullException("ctx.host");
            CaptureBattleEntry(ctx);
            _summaryHits.Clear();
            G = ctx.host;
            rng = ctx.rng ?? Rng.Default;
            over = false;
            _phase = "start";
            _battleToken = Guid.NewGuid().ToString("N");
            opts = ctx;
            mode = ctx.isBoss ? "boss" : "normal";
            foes = new List<BattleFoe>();
            foreach (var d in ctx.enemies ?? new EnemyInput[0])
            {
                var f = new BattleFoe
                {
                    id = d.id,
                    name = d.name,
                    hp = d.hp, maxHp = d.hp,
                    atk = d.atk > 0 ? d.atk : 2,
                    affix = d.affix, affixName = d.affixName, behavior = d.behavior,
                    elite = d.elite, eliteSkill = d.eliteSkill, desc = d.desc, damageCap = d.damageCap, evenAttack = d.evenAttack, noFirstAttack=d.noFirstAttack,
                    dead = false,
                };
                f.intent = IntentFor(f, 1);
                CombatResolver.EnsureStatus(f);
                foes.Add(f);
            }
            foreach (var f in foes) { if (f.eliteSkill == "firstTurnStealth") f.status.stealth = foes.Count > 1 ? 1 : 0; if (f.eliteSkill == "attackAura") foreach (var ally in foes) if (ally != f) ally.atk += 2; }
            pendingTarget = null;
            G.Log("[[icon:swords]] <b>" + (ctx.isBoss ? "BOSS战" : "遭遇战") + "【" + Esc(string.Join("、", foes.ConvertAll(f => f.name + "(" + f.atk + "-" + f.hp + ")").ToArray())) + "】</b>" +
                  (!ctx.isBoss && !string.IsNullOrEmpty(ctx.risk) ? " · 风险<b>" + Esc(ctx.risk) + "</b>" : ""), "warn");
            if (mode == "boss") PrepareDeckSelection();
            else BeginNormal();
        }

        private void BeginNormal()
        {
            drawPile = new List<string>(); discard = new List<string>(); granted = new List<OwnedCard>();
            played = new List<string>(); consumed = new List<string>(); grave = new List<string>();
            // 道具/资源/事件/生物卡默认不进手牌（v0.32：手牌只放可直接打出的战斗卡）
            hand = new List<string>();
            foreach (var o in G.OwnedCards)
            {
                string t = o.card.type;
                if (!o.stored && string.IsNullOrEmpty(o.pouchOf) && t != "道具" && t != "资源" && t != "事件" && t != "生物" && !IsBattleStartEquipment(o.card)) hand.Add(o.uid);
            }
            maxEnergy = GameRules.BattleEnergy;
            energy = maxEnergy;
            turn = 1; busy = false;
            pdef = new DefenseState();
            pstat = CombatResolver.EnsureStatus(new Combatant { hp = G.Hp });
            infusing = null; discovering = null; discoverQueue.Clear(); pendingTarget = null; floats.Clear();
            delayed.Clear(); noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
            InitializeStructuredBattle();
            _phase="player";
            ApplyRuleBattleSetup();
            ApplyCurrentBossOpening();
            for (int i = 0; i < GameRules.Battle.NormalStarterDeckSize; i++) normalStarterUids.Add(AddDeckCard(CardLibrary.FindById("starter-attack") ?? CardLibrary.SHA));
            if (Alive().Count > 1)
                G.Log("[[icon:question]] 以一敌多：伤害类卡牌需<b>拖到目标身上</b>打出；群体伤害直接点击生效", "sys");
            G.Log("[[icon:cards]] 随身 <b>" + hand.Count + "</b> 张战斗卡直接入手；另有 <b>" + GameRules.Battle.NormalStarterDeckSize + "</b> 张本场临时初始攻击牌库，仅由抽牌效果取牌，开局与每回合不固定抽牌 · 每回合固定 <b>" + maxEnergy + "</b> 费", "sys");
            RequestRender();
        }

        // ---------- BOSS战：编组牌库 ----------
        private void PrepareDeckSelection()
        {
            selPool = new List<DeckCardEntry>();
            foreach (var o in G.OwnedCards)
            {
                string t = o.card.type;
                if (!o.stored && string.IsNullOrEmpty(o.pouchOf) && t != "道具" && t != "资源" && t != "事件" && t != "生物" && o.card.name != "初始攻击")
                    selPool.Add(new DeckCardEntry { uid = o.uid, card = o.card });
            }
            int shas = 0;
            foreach (var o in G.OwnedCards) if (o.card.name == "初始攻击") shas++;
            selShaN = Math.Min(shas, GameRules.StarterSha);
            sel = new HashSet<string>();
            foreach (var uid in lastDeckSel)
                foreach (var entry in selPool) if (entry.uid == uid) { sel.Add(uid); break; }
            int cap = Math.Min(BossDeckMaximum(), selPool.Count);
            // 超出上限时按插入顺序移除（对齐 sel.delete(values().next().value)）
            var ordered = new List<string>(sel);
            while (sel.Count > cap && ordered.Count > 0)
            {
                sel.Remove(ordered[0]);
                ordered.RemoveAt(0);
            }
            selectingDeck = true;
            RequestRender();
        }

        public CommandResult SelectDeckCard(string uid)
        {
            if (!selectingDeck) return CommandResult.No("not selecting");
            bool inPool = false;
            foreach (var entry in selPool) if (entry.uid == uid) { inPool = true; break; }
            if (!inPool) return CommandResult.No("not in pool");
            if (!sel.Contains(uid))
            {
                var card = selPool.Find(entry => entry.uid == uid).card;
                if (IsBattleStartEquipment(card) && selPool.Count(entry => sel.Contains(entry.uid) && IsBattleStartEquipment(entry.card)) >= EquipmentCapacity()) return CommandResult.No("开战装备栏已满");
                var proposed = new HashSet<string>(sel); proposed.Add(uid);
                if (proposed.Count > BossDeckMaximum(proposed)) return CommandResult.No("超过牌库上限");
            }
            if (sel.Contains(uid)) sel.Remove(uid); else sel.Add(uid);
            RequestRender();
            return CommandResult.Yes();
        }

        public CommandResult ConfirmDeck() { return BeginBoss(); }

        public CommandResult CancelDeckSelection()
        {
            if (!selectingDeck) return CommandResult.No("not selecting");
            G.Log("[[icon:runner]] 你放下了挑战，首脑仍在污染核心深处盘踞", "sys");
            Finish(null);
            return CommandResult.Yes();
        }

        private CommandResult BeginBoss()
        {
            int need = BossDeckMinimum();
            if (sel.Count < need) return CommandResult.No("选卡不足（需 " + need + " 张，已选 " + sel.Count + " 张）");
            if (sel.Count > BossDeckMaximum()) return CommandResult.No("超过牌库上限");
            var shas = new List<string>();
            int shaLeft = GameRules.StarterSha;
            foreach (var o in G.OwnedCards)
            {
                if (o.card.name == "初始攻击" && shaLeft > 0) { shas.Add(o.uid); shaLeft--; }
            }
            lastDeckSel = new List<string>(sel);
            if(restartCheckpoint!=null)restartCheckpoint.selectedDeck=new List<string>(sel);
            selectingDeck = false;
            var deck = new List<string>(sel);
            deck.AddRange(shas);
            hand = new List<string>(); discard = new List<string>(); granted = new List<OwnedCard>();
            while (shas.Count < GameRules.StarterSha) { var uid = AddDeckCard(CardLibrary.FindById("starter-attack") ?? CardLibrary.SHA); shas.Add(uid); deck.Add(uid); }
            drawPile = DeckOps.ShuffleCards(deck, rng);
            played = new List<string>(); consumed = new List<string>(); grave = new List<string>();
            maxEnergy = GameRules.BattleEnergy;
            energy = maxEnergy;
            turn = 1; busy = false;
            pdef = new DefenseState();
            pstat = CombatResolver.EnsureStatus(new Combatant { hp = G.Hp });
            infusing = null; discovering = null; discoverQueue.Clear(); pendingTarget = null; floats.Clear();
            delayed.Clear(); noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
            InitializeStructuredBattle();
            _phase="player";
            ApplyRuleBattleSetup();
            ApplyCurrentBossOpening();
            G.Log("[[icon:cards]] 牌库编成：自选 " + sel.Count + " 张非道具卡 + 初始攻击 ×" + shas.Count + " = <b>" + drawPile.Count + "</b> 张 · " +
                  "开局抽 " + GameRules.BattleStartDraw + " · 每回合开始抽 " + GameRules.BattleTurnDraw + " · 每回合固定 <b>" + maxEnergy + "</b> 费", "sys");
            DrawCards(GameRules.BattleStartDraw);
            RequestRender();
            return CommandResult.Yes();
        }

        /// <summary>
        /// 指向侧判定（v0.22 设计者定版）：'enemy' 拖到敌人；'self' 拖到自己；null 直接点击打出。
        /// </summary>
        public string TargetSide(CardDef card) { return BattleRules.TargetSideFor(card); }

        /// <summary>不可打出判定（v0.24）。cardId 为手牌 uid；返回 false 时 reason 为原版提示文案。</summary>
        public bool TryGetUnplayableReason(string cardId, out string reason)
        {
            var entry = FindCard(cardId);
            if (entry == null) { reason = "找不到这张卡"; return true; }
            reason = BattleRules.UnplayableReasonFor(entry.card, mode);
            return reason != null;
        }

        /// <summary>
        /// 出牌命令（对齐 play(uid, side)）。targetIndex：≥0 = 敌人下标；-1 = 自己；-2 = 直接点击（无指向）。
        /// infused = true 时自动消耗注能所需的其他手牌（对齐 infusing 挑选流程的一键确认）。
        /// </summary>
        public CommandResult PlayCard(string cardId, int targetIndex, bool infused)
        {
            if (over || selectingDeck || _phase=="enemy" || _phase=="resolving") return CommandResult.No("当前不能出牌");
            if (RuleInputPending) return CommandResult.No("请先完成当前选择");
            if (!hand.Contains(cardId)) return CommandResult.No("卡牌已不在手牌中");
            if (busy) return CommandResult.No("busy");
            if (infusing != null) return CommandResult.No("infusing");
            if (discovering != null) return CommandResult.No("discovering");
            if (viewingGrave) return CommandResult.No("viewingGrave");
            var entry = FindCard(cardId);
            if (entry == null) return CommandResult.No("card not found");
            CardDef card = entry.card;
            string why = BattleRules.UnplayableReasonFor(card, mode);
            if (why != null)
            {
                G.Log("[[icon:cross]] 【" + Esc(card.name) + "】无法打出：" + why, "warn");
                return CommandResult.No(why);
            }
            var requirement = StructuredRequirement(card);
            if (requirement != null) return CommandResult.No(requirement);
            int effCost = EffCostOf(card);
            if (effCost > energy)
            {
                string msg = "[[icon:bolt]] 能量不足：【" + Esc(card.name) + "】需要 " + effCost + " 点能量";
                G.Log(msg, "warn");
                return CommandResult.No("能量不足");
            }
            int infN = skipInfusionCards.Contains(cardId) ? 0 : InfuseOf(card);
            if (infN > 0 && !infused)
            {
                int others = 0;
                foreach (var h in hand) if (h != cardId) others++;
                if (others < infN)
                {
                    string msg = "[[icon:flask]] 手牌不足：【" + Esc(card.name) + "】注能(" + infN + ") 需要消耗 " + infN + " 张手牌，当前只有 " + others + " 张可选";
                    G.Log(msg, "warn");
                    if (RequiresInfusion(card)) return CommandResult.No("手牌不足");
                    infN = 0;
                }
                if (infN > 0) { infusing = new InfusingState { uid = cardId, card = card, need = infN, targetIndex = targetIndex }; RequestRender(); return CommandResult.No("select infusion"); }
            }
            if (infN > 0 && infused)
            {
                // 自动挑选：同名堆叠优先（对齐 toggleInfusePick 的堆叠语义），不足则依次取其余手牌
                var fuel = new List<string>();
                foreach (var h in hand)
                {
                    if (h == cardId || fuel.Count >= infN) continue;
                    fuel.Add(h);
                }
                if (fuel.Count < infN)
                {
                    string msg = "[[icon:flask]] 手牌不足：【" + Esc(card.name) + "】注能(" + infN + ") 需要消耗 " + infN + " 张手牌";
                    G.Log(msg, "warn");
                    return CommandResult.No("手牌不足");
                }
                infusing = new InfusingState { uid = cardId, card = card, need = infN, targetIndex = targetIndex };
                foreach (var f in fuel) infusing.picked.Add(f);
                ConfirmInfusion(targetIndex);
                return CommandResult.Yes();
            }
            // 目标校验：指向性卡必须指定对应目标
            string need = BattleRules.TargetSideFor(card);
            BattleFoe target = null;
            if (need == "enemy")
            {
                if (targetIndex < 0)
                {
                    pendingTarget = new PendingTargetSnapshot { uid = cardId, card = card };
                    _phase="targeting";
                    pendingHint = "";
                    RequestRender();
                    return CommandResult.No("pending target");
                }
                target = targetIndex < foes.Count ? foes[targetIndex] : null;
                if (target == null || target.dead)
                {
                    pendingTarget = new PendingTargetSnapshot { uid = cardId, card = card };
                    _phase="targeting";
                    pendingHint = "";
                    RequestRender();
                    return CommandResult.No("pending target");
                }
            }
            else if (need == "self")
            {
                if (targetIndex != -1)
                {
                    pendingTarget = new PendingTargetSnapshot { uid = cardId, card = card };
                    _phase="targeting";
                    pendingHint = "";
                    RequestRender();
                    return CommandResult.No("pending target");
                }
            }
            else
            {
                var alive = Alive();
                target = alive.Count > 0 ? alive[0] : null;
            }
            pendingTarget = null;
            pendingHint = "";
            ExecPlay(cardId, card, new List<string>(), target);
            return CommandResult.Yes();
        }

        // v0.32 堆叠手牌：点击的是一叠同名卡的代表性 uid——选中/取消该叠中的一张
        public CommandResult SelectInfusion(string uid)
        {
            if (infusing == null || uid == infusing.uid) return CommandResult.No("not infusing");
            var entry = FindCard(uid);
            if (entry == null) return CommandResult.No("card not found");
            var groupUids = new List<string>();
            foreach (var h in hand)
            {
                if (h == infusing.uid) continue;
                var o = FindCard(h);
                if (o != null && o.card.name == entry.card.name) groupUids.Add(h);
            }
            string pickedInGroupLast = null;
            foreach (var u in groupUids) if (infusing.picked.Contains(u)) pickedInGroupLast = u;
            if (pickedInGroupLast != null)
            {
                infusing.picked.Remove(pickedInGroupLast);
            }
            else
            {
                foreach (var u in groupUids)
                {
                    if (!infusing.picked.Contains(u))
                    {
                        if (infusing.picked.Count < infusing.need) infusing.picked.Add(u);
                        break;
                    }
                }
            }
            RequestRender();
            return CommandResult.Yes();
        }

        public CommandResult CancelInfusion()
        {
            infusing = null;
            RequestRender();
            return CommandResult.Yes();
        }

        public CommandResult ConfirmInfusion(int targetIndex)
        {
            if (infusing == null || infusing.picked.Count != infusing.need) return CommandResult.No("picks incomplete");
            string uid = infusing.uid;
            CardDef card = infusing.card;
            var fuel = new List<string>(infusing.picked);
            infusing = null;
            var alive = Alive();
            BattleFoe target = targetIndex >= 0 && targetIndex < foes.Count ? foes[targetIndex] : (alive.Count > 0 ? alive[0] : null);
            ExecPlay(uid, card, fuel, target);
            return CommandResult.Yes();
        }

        private void ExecPlay(string uid, CardDef card, List<string> fuelUids, BattleFoe target, bool freeCost = false, bool directRelease = false)
        {
            if(_phase!="enemy") _phase="resolving";
            RequestRender();
            BeginRuleCast(card, target, fuelUids);
            if (directRelease) castContext.infused = true;
            castContext.uid = uid; skipInfusionCards.Remove(uid);
            int effCost = freeCost ? 0 : EffCostOf(card);
            if (!freeCost && effCost != card.cost)
                G.Log("[[icon:sparkles]] 宇宙形态：【" + Esc(card.name) + "】按 <b>1</b> 费打出（原 " + card.cost + " 费）", "sys");
            energy -= effCost;
            played.Add(uid);
            hand.RemoveAll(h => h == uid || fuelUids.Contains(h));
            foreach (var f in fuelUids)
            {
                consumed.Add(f);
                RecordRuleConsumption(f);
                // v0.25：被消耗的牌进入墓地——墓地不参与洗回，战胜 BOSS 后可在整理背包放回
                if (mode == "boss") grave.Add(f);
                var o = FindCard(f);
                G.Log("[[icon:flask]] <b>" + Esc(card.name) + "</b> 注能：消耗了【<b>" + Esc(o != null ? o.card.name : "?") + "</b>】" +
                      (mode == "boss" ? "（进墓地，不参与洗回）" : "（战后进消耗口袋，可在火堆复原）"), "sys");
                // 被牺牲的牌并没有被「使用」：不结算主效果，只结算它的「被注能时」条件效果
                if (o != null) ResolveInfusedFuel(o.card, target);
            }
            if (mode == "boss") discard.Add(uid);
            int continuationBase = ruleContinuations.Count;
            var context = castContext;
            using (BeginActorCard(card)) ResolveCard(card, target);
            Action complete = () =>
            {
                var previous = castContext; castContext = context;
                CompleteRuleCast(card);
                if (Alive().Count == 0) Finish(true); else ProcessDiscoverQueue();
                castContext = previous;
            };
            if (RuleInputPending) ruleContinuations.Insert(continuationBase, complete); else complete();
            CompletePlayerResolution();
            RequestRender();
        }

        // 注册「回合开始时」延迟段（repeat = 装备卡或「每回合开始时」，每回合开始重复触发）
        private void RegisterTurnStart(CardDef card, List<TurnStartItem> items)
        {
            foreach (var it in items)
            {
                bool repeat = card.type == "装备" || it.each;
                delayed.Add(new DelayedItem { text = it.text, cardName = card.name, repeat = repeat });
                G.Log("[[icon:hourglass]] <b>回合开始时</b>：【" + Esc(card.name) + "】" + Esc(it.text) + "（下个回合开始" + (repeat ? "起每回合" : "") + "生效）", "sys");
            }
        }

        // 回合开始：结算延迟段（沉默中技能无效——一次性段被吞掉，重复段保留到下回合）
        private void ProcessDelayed()
        {
            if (delayed.Count == 0) return;
            bool silenced = pstat.status.Get("silence") > 0;
            var keep = new List<DelayedItem>();
            foreach (var q in delayed)
            {
                if (silenced)
                {
                    G.Log("[[icon:cross]] 沉默中：【" + Esc(q.cardName) + "】的回合开始效果无法生效", "warn");
                }
                else
                {
                    G.Log("[[icon:hourglass]] <b>回合开始时</b>：【" + Esc(q.cardName) + "】" + Esc(q.text), "sys");
                    var alive = Alive();
                    applyTextEffects.ApplyTextEffects(new CardDef { name = q.cardName }, q.text, alive.Count > 0 ? alive[0] : null);
                }
                if (q.repeat) keep.Add(q);
            }
            delayed.Clear();
            delayed.AddRange(keep);
        }

        // 「本局对战内」持续效果：注册并结算其中已支持的部分（增益本身即战斗内长期有效）
        private bool RegisterBattle(CardDef card, string clause, BattleFoe target)
        {
            G.Log("[[icon:question]] <b>本局对战内</b>：" + Esc(clause) + "（整场战斗有效，离开战斗失效）", "ok");
            string inner = Regex.Replace(clause, @"^(本局对战内|本场对战|本场战斗)[中内]?[：:，,]?\s*", "");
            if (Regex.IsMatch(inner, @"所有法术[^。]*?1\s*费"))
            {
                spellCost1 = true;
                G.Log("[[icon:sparkles]] 持续规则：你的所有法术均按 <b>1</b> 费打出", "ok");
            }
            return applyTextEffects.ApplyTextEffects(card, inner, target).did;
        }

        // 「被注能时」条件效果：作为注能牺牲品被消耗时触发（未被使用，主效果不结算）
        private bool ResolveInfusedFuel(CardDef card, BattleFoe target)
        {
            if (card.rules?.Get("triggers")?.Has("onConsume") == true) { RunStructuredTrigger(card, "onConsume", target); return true; }
            var parts = EffectParser.SplitEffectClauses(card.desc);
            if (parts.onInfused.Count == 0) return false;
            if (pstat.status.Get("silence") > 0)
            {
                G.Log("[[icon:cross]] 沉默中：【" + Esc(card.name) + "】的被注能效果无法生效", "warn");
                return true;
            }
            foreach (var text in parts.onInfused)
            {
                G.Log("[[icon:flask]] <b>被注能时</b>：【" + Esc(card.name) + "】" + Esc(text), "sys");
                applyTextEffects.ApplyTextEffects(card, text, target);
            }
            return true;
        }

        // 出牌结算（目标：单点卡 = target；群体卡 = 所有存活敌人）
        private void ResolveCard(CardDef card, BattleFoe target)
        {
            if (ResolveStructuredCard(card, target)) return;
            string desc = card.desc ?? string.Empty;
            var parts = EffectParser.SplitEffectClauses(desc);
            bool did = false;
            bool isDmgType = System.Array.IndexOf(CardLibrary.DmgTypes, card.type) >= 0;
            // —— 伤害（卡面伤害词条立即结算，不受沉默影响） ——
            if (isDmgType && ((card.dmg ?? 0) > 0 || card.dmgType == "attack"))
            {
                string type = CardLibrary.IsDmgTypeValid(card.dmgType) ? card.dmgType : CombatResolver.FIXED;
                var tm = Regex.Match(desc, @"(?:攻击|命中)\s*(\d+)\s*次");
                if (!tm.Success) tm = Regex.Match(desc, @"(\d+)\s*段");
                int times = tm.Success ? Math.Max(1, int.Parse(tm.Groups[1].Value)) : 1;
                List<BattleFoe> targets;
                if (BattleRules.IsAreaEffect(card)) targets = Alive();
                else
                {
                    targets = new List<BattleFoe>();
                    var t = target ?? (Alive().Count > 0 ? Alive()[0] : null);
                    if (t != null) targets.Add(t);
                }
                if (targets.Count == 0) return;
                for (int i = 0; i < times; i++)
                {
                    using var presentationGroup = BeginActorDamageGroup(card, type, times);
                    foreach (var foe in targets)
                        HitFoe(foe, card, card.dmg ?? 0, type, times > 1 ? "（第 " + (i + 1) + " 段）" : "");
                }
                did = true;
            }
            // 沉默：除攻击外的技能效果全部失效（延迟段与持续段也不注册）
            if (pstat.status.Get("silence") > 0)
            {
                G.Log("[[icon:cross]] <b>" + Esc(card.name) + "</b> 的技能效果被沉默封印（只剩攻击生效，持续 " + pstat.status.Get("silence") + " 回合）", "warn");
                return;
            }
            // —— 立即生效句 ——
            var res = applyTextEffects.ApplyTextEffects(card, string.Join("，", parts.immediate.ToArray()), target);
            did = did || res.did;
            // 结构化词条兜底（描述未写明但制作坊标注了回复/护甲/抽卡字段时）
            if (!res.healed && (card.heal ?? 0) > 0)
            {
                int n = card.heal.Value;
                if (pstat.status.Get("healban") > 0)
                {
                    G.Log("[[icon:heart]] 禁疗中：回复 " + n + " 点生命无效（还剩 " + pstat.status.Get("healban") + " 回合）", "warn");
                }
                else
                {
                    G.Heal(n);
                    floats.Add(new BattleFloat { unit = "self", text = "💚", cls = "stk", warm = true });
                }
                did = true;
            }
            if (!res.armored && (card.armor ?? 0) > 0)
            {
                pdef.Armor += card.armor.Value;
                G.Log("[[icon:plate]]获得 " + card.armor.Value + " 点护甲", "sys");
                did = true;
            }
            // 卡面结构化抽卡字段兜底（描述未写「抽 N 张牌」时）
            if (!res.drawn && DrawOf(card) > 0)
            {
                int n = DrawOf(card);
                int got = DrawCards(n);
                G.Log("[[icon:cards]] <b>" + Esc(card.name) + "</b>：抽了 " + got + " 张牌", "sys");
                did = true;
            }
            // —— 「回合开始时」生效时刻词条 ——
            if (parts.turnStart.Count > 0) { RegisterTurnStart(card, parts.turnStart); did = true; }
            // —— 「本局对战内」持续时间词条 ——
            foreach (var cl in parts.battle) { did = RegisterBattle(card, cl, target) || did; }
            // 「被注能时」句在打出时不结算（SplitEffectClauses 已剥出，留给 ResolveInfusedFuel）
            if (!did) G.Log("[[icon:play]] <b>" + Esc(card.name) + "</b>：该效果在 M1 后续实装（占位）", "dim");
        }

        // 敌人免伤判定（元素领主：偶数回合全免伤，破甲克制）
        private bool AegisBlocked(BattleFoe foe)
        {
            return foe.affix == "aegis" && turn % 2 == 0 && foe.status.Get("abreak") <= 0;
        }

        private int FoeIdx(BattleFoe foe) { return foes.IndexOf(foe); }

        // 对单个敌人结算一次伤害（含潜行/免伤/死亡处理），返回实际伤害
        private int HitFoe(BattleFoe foe, CardDef card, int amount, string type, string seg)
        {
            if (foe.dead) return 0;
            using var presentationHit = BeginActorHit(foe, card, amount, type);
            if (AegisBlocked(foe))
            {
                floats.Add(new BattleFloat { unit = FoeIdx(foe), text = "免伤", cls = "block" });
                G.Log("[[icon:crystal]] " + (seg ?? string.Empty) + "<b>" + Esc(foe.name) + "</b> 的元素庇幕展开：伤害被完全减免！（破甲可击碎）", "warn");
                return 0;
            }
            var attacker = new Combatant { atk = G.Atk, spellPower = G.SpellPower, status = pstat.status };
            var r = CombatResolver.DealDamage(attacker, foe, amount, type);
            if (r.stealthed)
            {
                floats.Add(new BattleFloat { unit = FoeIdx(foe), text = "未命中", cls = "block" });
                G.Log("[[icon:runner]] " + (seg ?? string.Empty) + "<b>" + Esc(foe.name) + "</b> 处于<b>潜行</b>中：无法成为被攻击对象！", "warn");
                return 0;
            }
            if (r.dealt > 0) { enemyDamageThisTurn = true; floats.Add(new BattleFloat { unit = FoeIdx(foe), text = "-" + r.dealt, cls = "dmg" }); }
            G.Log("[[icon:play]] <b>" + Esc(card.name) + "</b>" + (seg ?? string.Empty) + " → " + Esc(foe.name) + "：造成 <b>" + r.dealt + "</b> 点" + CombatResolver.TYPE_NAME[type] +
                  (r.log.Count > 0 ? "（" + string.Join("，", r.log.ToArray()) + "）" : string.Empty), "sys");
            // 造成伤害会破除自己的潜行（不造成伤害便不会破除）
            if (r.dealt > 0 && CombatResolver.BreakStealth(pstat))
            {
                G.Log("[[icon:runner]] 你造成了伤害，<b>潜行</b>被破除", "dim");
            }
            if (foe.hp <= 0 && !foe.dead)
            {
                foe.dead = true;
                G.Log("[[icon:skull]] <b>" + Esc(foe.name) + "</b> 被击倒！（剩 " + Alive().Count + " 个敌人）", "ok");
                floats.Add(new BattleFloat { unit = FoeIdx(foe), text = "💥", cls = "stk" });
                floats.Add(new BattleFloat { unit = "self", text = KillCheer[(int)Math.Floor(rng.Random("battle") * KillCheer.Length)], cls = "stk stk-late" });
            }
            return r.dealt;
        }

        private CardDef RandomDiscoverCard(string rarity)
        {
            var pool = CurrentBattlePools.Resolve(CardLibrary.All(), null, G.MyClass).Where(c => rarity == null || c.rarity == rarity).ToList();
            if (pool.Count == 0) return null;
            return pool[(int)Math.Floor(rng.Random("battle", "generation") * pool.Count)];
        }

        private void ProcessDiscoverQueue()
        {
            if (discovering != null || discoverQueue.Count == 0) return;
            var job = discoverQueue[0];
            discoverQueue.RemoveAt(0);
            var options = new List<CardDef>();
            var taken = new HashSet<string>();
            for (int i = 0; i < 3; i++)
            {
                var c = RandomDiscoverCard(job.rarity);
                if (c != null && !taken.Contains(c.id)) { taken.Add(c.id); options.Add(c); }
            }
            if (options.Count == 0) { G.Log("（卡牌库是空的，没有可发现的卡牌）", "dim"); return; }
            discovering = new DiscoveringState { options = options, n = job.n, rarity = job.rarity };
            RequestRender();
        }

        public CommandResult PickDiscover(int i)
        {
            if (discovering == null) return CommandResult.No("not discovering");
            CardDef card = i >= 0 && i < discovering.options.Count ? discovering.options[i] : null;
            if (card == null) return CommandResult.No("bad index");
            if (structuredDiscoverAction != null)
            {
                var action = structuredDiscoverAction; structuredDiscoverAction = null; discovering = null;
                action(card); ResumeRules(); ResolveRuleOutcome(); RequestRender(); return CommandResult.Yes();
            }
            AddTempCard(card);
            G.Log("[[icon:question]] 发现：【<b>" + Esc(card.name) + "</b>】置入手牌（战斗内临时卡，战后消散）", "loot");
            int n = discovering.n;
            string rarity = discovering.rarity;
            discovering = null;
            if (Alive().Count == 0) { Finish(true); return CommandResult.Yes(); }
            if (n > 1) discoverQueue.Insert(0, new DiscoverJob { n = n - 1, rarity = rarity });
            ProcessDiscoverQueue();
            RequestRender();
            return CommandResult.Yes();
        }

        // 玩家受到一次攻击（含流血加成 / 格挡），返回实际伤害
        private int PlayerTakeHit(BattleFoe foe)
        {
            using var presentationHit = BeginPlayerHit(foe);
            var playerRef = new Combatant { hp = G.Hp, defense = pdef, status = pstat.status };
            var r = CombatResolver.DealDamage(new Combatant { atk = foe.atk }, playerRef, 0, CombatResolver.ATTACK);
            if (TryBlockPlayerFatalDamage(r.dealt)) return 0;
            G.Hp = playerRef.hp - r.overkill;
            RecordSummaryDamage(foe.name,r.dealt);
            OnStructuredPlayerDamaged(foe, r.dealt);
            floats.Add(new BattleFloat { unit = "self", text = r.dealt>0?"-"+r.dealt:r.immune?"免疫":"防御", cls = r.dealt>0?"hurt":"block" });
            if (r.dealt > 0) floats.Add(new BattleFloat { unit = "self", text = "💢", cls = "stk stk-late" });
            G.Log("[[icon:demon]] <b>" + Esc(foe.name) + "</b> 反击：你受到 <b>" + r.dealt + "</b> 点攻击伤害（" + G.Hp + "/" + G.MaxHp + "）", "warn");
            return r.dealt;
        }

        // 附加 1 层流血或中毒（兽人首领狂乱用）
        private void FrenzyCurse(BattleFoe foe)
        {
            if (persistentRules.Contains("playerCurseImmune")) return;
            string key = rng.Random("status", "generation") < 0.5 ? "bleed" : "poison";
            CombatResolver.AddCurse(pstat, key, 1);
            G.Log("[[icon:bolt]] <b>" + Esc(foe.name) + "</b> 的攻击附加了 <b>1</b> 层" + CombatResolver.CurseMetaDict[key].name, "warn");
        }

        // ---------- 回合结束 ----------
        public CommandResult EndTurn()
        {
            if (over) return CommandResult.No("战斗已结束");
            if (RuleInputPending || selectingDeck) return CommandResult.No("请先完成当前选择");
            if (busy || infusing != null || discovering != null) return CommandResult.No("busy/infusing/discovering");
            pendingTarget=null;pendingHint="";
            if(_phase=="targeting") _phase="player";
            if (extraTurn) { extraTurn = false; turn++; energy = maxEnergy; AdvanceStructuredTurn(); RequestRender(); return CommandResult.Yes(); }
            busy = true;
            _phase = "enemy";
            pendingTarget = null;
            pendingHint = "";
            // —— 玩家回合结束：中毒结算 ——
            var poisonPresentation=BeginPassiveHit();
            var pref = new Combatant { hp = G.Hp, defense = pdef, status = pstat.status };
            var pr = CombatResolver.TickPoison(pref);
            G.Hp = pref.hp - (pr?.overkill ?? 0);
            if (pr != null)
            {
                RecordSummaryDamage("中毒",pr.dealt);
                floats.Add(new BattleFloat { unit = "self", text = "-" + pr.dealt, cls = "hurt" });
                G.Log("[[icon:skull]] 中毒结算：你受到 <b>" + pr.dealt + "</b> 点固定伤害（" + G.Hp + "/" + G.MaxHp + "）", "warn");
            }
            // 计时状态不在玩家阶段递减——共享回合钟统一在每回合结束（AfterEnemies 末尾）递减
            poisonPresentation.Dispose();
            RequestRender();
            if (G.Hp <= 0) { busy = false; Finish(false); return CommandResult.Yes(); }
            ResolveRuleAllyAttacks();
            if (over) { busy = false; return CommandResult.Yes(); }
            // —— 敌人回合：逐个行动（原版 setTimeout 分步动画，此处同步结算，每步发快照）——
            var acting = Alive();
            EmitPresentation(new BattleActorCue { Kind="wait", WindupMs=420 });
            int i = 0;
            while (true)
            {
                if (G.Hp <= 0) { busy = false; Finish(false); return CommandResult.Yes(); }
                if (i >= acting.Count) { AfterEnemies(); break; }
                var foe = acting[i++];
                var plan=BattleEnemyPlan.Build(foe,turn);
                if (plan.Skip=="dead") continue;
                if (plan.Skip=="stunned") { foe.stunned=false;continue; }
                if (plan.Skip=="oddRound" || plan.Skip=="firstRound") continue;
                if (plan.Skip=="frozen")
                {
                    G.Log("[[icon:crystal]] <b>" + Esc(foe.name) + "</b> 被冰冻，无法行动！", "sys");
                }
                else
                {
                    for (int h = 0; h < plan.Hits && G.Hp > 0 && CombatResolver.CanAct(foe); h++)
                    {
                        // 潜行：无法成为被攻击对象（冰冻/潜行的敌人在自己行动后照常递减计时）
                        if (CombatResolver.IsStealthed(pstat))
                        {
                            G.Log("[[icon:runner]] 你在<b>潜行</b>中，<b>" + Esc(foe.name) + "</b> 无法将你作为攻击对象", "sys");
                            break;
                        }
                        if (TryRuleAllyGuard(foe)) { CleanseCurrentBlocker(foe);continue; }
                        int dealt = PlayerTakeHit(foe);
                        // 敌人造成伤害也会破除它自己的潜行
                        if (dealt > 0 && CombatResolver.BreakStealth(foe))
                        {
                            G.Log("[[icon:runner]] <b>" + Esc(foe.name) + "</b> 发动了攻击，<b>潜行</b>被破除", "dim");
                        }
                        if (dealt > 0 && foe.affix == "frenzy") FrenzyCurse(foe);
                        CleanseCurrentBlocker(foe);
                    }
                }
                RequestRender();
                if (G.Hp <= 0) { busy = false; Finish(false); return CommandResult.Yes(); }
                EmitPresentation(new BattleActorCue { Kind="wait", WindupMs=420 });
            }
            busy = false;
            RequestRender();
            return CommandResult.Yes();
        }

        private void AfterEnemies()
        {
            // —— 敌人回合结束：中毒结算 + 词缀 ——
            foreach (var foe in foes)
            {
                if (foe.dead) continue;
                using var poisonPresentation=BeginPassiveHit(foe);
                var er = CombatResolver.TickPoison(foe);
                if (er != null)
                {
                    floats.Add(new BattleFloat { unit = foes.IndexOf(foe), text = "-" + er.dealt, cls = "dmg" });
                    G.Log("[[icon:skull]] 中毒结算：<b>" + Esc(foe.name) + "</b> 受到 <b>" + er.dealt + "</b> 点固定伤害（" + Math.Max(0, foe.hp) + "/" + foe.maxHp + "）", "sys");
                }
                if (foe.hp <= 0 && !foe.dead)
                {
                    foe.dead = true;
                    G.Log("[[icon:skull]] <b>" + Esc(foe.name) + "</b> 毒发倒地！（剩 " + Alive().Count + " 个敌人）", "ok");
                    floats.Add(new BattleFloat { unit = foes.IndexOf(foe), text = "💥", cls = "stk" });
                    floats.Add(new BattleFloat { unit = "self", text = KillCheer[(int)Math.Floor(rng.Random("battle") * KillCheer.Length)], cls = "stk stk-late" });
                }
            }
            if (Alive().Count == 0) { busy = false; Finish(true); return; }
            // 军威（将军）：回合结束时攻击力 +2
            foreach (var foe in foes)
            {
                if (!foe.dead && foe.affix == "grow")
                {
                    foe.atk += 2;
                    G.Log("[[icon:arrow]] <b>军威</b>：<b>" + Esc(foe.name) + "</b> 攻击力增至 <b>" + foe.atk + "</b>", "warn");
                }
            }
            // —— 共享回合钟：所有计时状态在本回合结束统一递减 1 ——
            // 持续 1 回合 = 本回合结束前生效；持续 n 回合 = 从触发当回合起覆盖 n 个完整回合
            TickDurationsLog(pstat.status, "你");
            foreach (var foe in foes) if (!foe.dead) TickDurationsLog(foe.status, foe.name);
            turn++;
            _phase = "player";
            foreach (var foe in foes) if (!foe.dead) foe.intent = IntentFor(foe, turn);
            energy = maxEnergy;
            AdvanceStructuredTurn();
            // —— 新回合开始：玩家形态祝福 ——
            if (pstat.status.Get("natureForm") > 0)
            {
                energy++;
                G.Log("[[icon:wood]] <b>自然形态</b>：额外获得 1 点能量（当前 " + energy + "/" + maxEnergy + "）", "ok");
            }
            if (pstat.status.Get("swordForm") > 0)
            {
                int got = DrawCards(1);
                G.Log("[[icon:sword]] <b>剑仙形态</b>：额外抽了 " + got + " 张牌", "ok");
            }
            // —— 新回合开始：「回合开始时」延迟段结算 ——
            ProcessDelayed();
            // —— 常规抽牌（「下回合无法抽牌」标记在本回合开始消耗掉）——
            if (noDrawNext)
            {
                noDrawNext = false;
                G.Log("[[icon:cross]] <b>下回合无法抽牌</b>生效：本回合开始不抽牌", "warn");
            }
            else if (mode == "boss")
            {
                DrawCards(GameRules.BattleTurnDraw);
            }
            busy = false;
            RequestRender();
        }

        private void TickDurationsLog(UnitStatus status, string who)
        {
            var expired = CombatResolver.TickDurations(new Combatant { status = status });
            foreach (var k in expired)
            {
                string display = null;
                CombatResolver.CurseMetaDict.TryGetValue(k, out var cm);
                if (cm != null) display = cm.name;
                else
                {
                    CombatResolver.BuffMetaDict.TryGetValue(k, out var bm);
                    if (bm != null) display = bm.name;
                }
                if (display != null) G.Log("[[icon:sparkles]] " + Esc(who) + " 的<b>" + display + "</b>效果结束了", "dim");
            }
        }

        /// <summary>主动撤离判负；首脑战只允许获胜或战败。</summary>
        public CommandResult Surrender()
        {
            if (mode == "boss") return CommandResult.No("首脑战不可撤离，击败首脑或战败即终局");
            if (over || busy || infusing != null || RuleInputPending) return CommandResult.No("请先完成当前操作");
            G.Log("[[icon:cross]] 你选择了撤离——本局视为失败，安全格中的卡牌将被抢运回基地", "warn");
            Finish(false);
            return CommandResult.Yes();
        }

        /// <summary>烟雾弹等效果的脱战豁免：打出过的卡照常结算。</summary>
        public CommandResult Retract()
        {
            if (busy || infusing != null || discovering != null) return CommandResult.No("busy/infusing/discovering");
            G.Log("[[icon:runner]] 你撤出了战斗（打出过的卡照常结算）", "sys");
            Finish(null);
            return CommandResult.Yes();
        }

        private void Finish(bool? win)
        {
            if (over) return;
            if (win == false && G.Hp <= 0) EmitActorCue("death");
            if(win==true) _phase="victory";
            else if(win==false) _phase="defeat";
            busy=false;
            var result = new BattleResult
            {
                TurnMovesMax=turnMovesMax,BattleEquipsMax=equippedCards.Count,ReviveKills=0,
                SpentCards=granted.Where(entry=>!normalStarterUids.Contains(entry.uid)&&(played.Contains(entry.uid)||consumed.Contains(entry.uid))).Select(entry=>new OwnedCard{uid=entry.uid,card=entry.card.Clone()}).ToList(),
                Win = win,
                IsBoss = opts != null && opts.isBoss,
                Layer = opts != null ? opts.layer : 0,
                ReturnTo = opts != null ? opts.returnTo : null,
                Name = opts != null ? opts.name : null,
                Risk = opts != null ? opts.risk : null,
                Played = new List<string>(played),
                Consumed = new List<string>(consumed),
                Summary = ReadSummary(),
            };
            foreach (var f in foes) result.FoeNames.Add(f.name);
            played = new List<string>(); consumed = new List<string>();
            drawPile = new List<string>(); hand = new List<string>(); discard = new List<string>();
            granted = new List<OwnedCard>(); grave = new List<string>();
            sel = new HashSet<string>();
            infusing = null; discovering = null; discoverQueue.Clear(); pendingTarget = null; floats.Clear();
            delayed.Clear(); noDrawNext = false; spellCost1 = false; viewingGrave = false; dreadShown = false; selectingDeck = false;
            over = true;
            deathSaves=0;extraTurn=false;
            var handler = BattleEnded;
            if (handler != null) handler(result);
            if (G != null) G.OnBattleEnd(result);
            RequestRender();
        }

        // ---------- 墓地查看（BOSS 战专属） ----------
        public CommandResult OpenGrave() { viewingGrave = true; RequestRender(); return CommandResult.Yes(); }
        public CommandResult CloseGrave() { viewingGrave = false; RequestRender(); return CommandResult.Yes(); }

        public CommandResult CancelPendingTarget() { pendingTarget = null; pendingHint = ""; if(_phase=="targeting")_phase="player"; RequestRender(); return CommandResult.Yes(); }
        public void SetPendingHint(string value) { pendingHint = value ?? string.Empty; RequestRender(); }
        public void LockPendingTarget(PendingTargetSnapshot value) { pendingTarget = value; pendingHint = ""; if(value!=null && !over)_phase="targeting"; RequestRender(); }
        public void MarkDreadShown() { dreadShown = true; }

        /// <summary>取走待展示的飘字/受击特效（渲染后由视图消费，取后清空）。</summary>
        public List<BattleFloat> TakeFloats()
        {
            var list = new List<BattleFloat>(floats);
            floats.Clear();
            return list;
        }

        /// <summary>牌堆悬停提示（对齐 pileTip）：uids 为手牌/牌库/弃牌堆任一列表。</summary>
        public string PileTipOf(List<string> uids) { return PileTip(uids); }

        // ---------- 快照 ----------
        public BattleSnapshot GetSnapshot()
        {
            SyncConditionalEquipment();
            var foeSnaps = new List<FoeSnapshot>();
            foreach (var foe in foes)
            {
                foeSnaps.Add(new FoeSnapshot
                {
                    id = foe.id, name = foe.name, affix = foe.affix, affixName = foe.affixName, behavior = foe.behavior,
                    elite = foe.elite, eliteSkill = foe.eliteSkill, desc = foe.desc, damageCap = foe.damageCap, evenAttack = foe.evenAttack, noFirstAttack=foe.noFirstAttack, stunned=foe.stunned,
                    hp = foe.hp, maxHp = foe.maxHp, atk = foe.atk, dead = foe.dead,
                    status = foe.status.Export(),
                    defense = new DefenseState { Shield = foe.defense.Shield, Armor = foe.defense.Armor, Guard = foe.defense.Guard },
                    intent = IntentFor(foe,turn),
                });
            }
            InfusingSnapshot inf = null;
            if (infusing != null)
            {
                inf = new InfusingSnapshot { uid = infusing.uid, card = infusing.card, need = infusing.need, picked = new List<string>(infusing.picked), CanPlayDirect = !RequiresInfusion(infusing.card) };
            }
            DiscoveringSnapshot disc = null;
            if (discovering != null)
            {
                disc = new DiscoveringSnapshot { options = new List<CardDef>(discovering.options), n = discovering.n, rarity = discovering.rarity };
            }
            DeckSelectionSnapshot deckSel = null;
            if (selectingDeck)
            {
                deckSel = new DeckSelectionSnapshot
                {
                    need = BossDeckMinimum(), Maximum = BossDeckMaximum(),
                    starterCount = GameRules.StarterSha,
                    selected = new List<string>(sel),
                    cards = selPool,
                    boss = foeSnaps.Count > 0 ? foeSnaps[0] : null,
                };
            }
            var snapshot = new BattleSnapshot
            {
                Phase = _phase,
                BattleToken = _battleToken,
                ConsumedPile = BattleConsumedPile().AsReadOnly(),
                EndTurnContext = new EndTurnContextSnapshot { ExtraTurn = extraTurn, DeathSave = deathSaves },
                mode = mode, turn = turn, energy = energy, maxEnergy = maxEnergy, busy = busy,
                opts = opts,
                player = G != null
                    ? new PlayerSnapshot { hp = G.Hp, maxHp = G.MaxHp, atk = G.Atk, spellPower = G.SpellPower, myClass = G.MyClass, characterId = G.CharacterId }
                    : null,
                pdef = pdef != null ? new DefenseState { Shield = pdef.Shield, Armor = pdef.Armor, Guard = pdef.Guard } : null,
                pstat = pstat != null ? new PstatSnapshot { hp = pstat.hp, status = pstat.status.Export() } : null,
                foes = foeSnaps,
                hand = new List<string>(hand),
                drawPile = new List<string>(drawPile),
                discard = new List<string>(discard),
                grave = new List<string>(grave),
                infusing = inf,
                discovering = disc,
                pendingTarget = pendingTarget != null ? new PendingTargetSnapshot { uid = pendingTarget.uid, card = pendingTarget.card } : null,
                pendingHint = pendingHint,
                viewingGrave = viewingGrave,
                dreadShown = dreadShown,
                deckSelection = deckSel,
                RuleChoice = ruleChoice,
                RuleHandSelection = ruleHandSelection,
                Equipment = EquipmentState(),
                HeroSkill = CurrentHeroSkill(),
                Allies = RuleAllySnapshots(),
                Items = BattleItemsState(),
                over = over,
            };
            snapshot.Forecast = BattleTurnForecast.Estimate(snapshot);
            return snapshot;
        }

        private void RequestRender()
        {
            var handler = SnapshotChanged;
            if (handler != null) handler(GetSnapshot());
        }

        /// <summary>构造时装配效果执行器（端口绑定到本会话内部状态）。</summary>
        public BattleSession()
        {
            applyTextEffects = new EffectExecutor(new EffectPorts
            {
                getAlive = () => new List<Combatant>(Alive()),
                getPlayerStatus = () => pstat != null ? pstat.status : null,
                getPlayerDefense = () => pdef,
                getMode = () => mode,
                log = (message, kind) => G.Log(message, kind),
                escapeHtml = s => s ?? string.Empty,
                heal = amount => G.Heal(amount),
                pushFloat = value => floats.Add(value),
                drawCards = DrawCards,
                grantStarterAttack = GrantSha,
                markNoDrawNext = () => { noDrawNext = true; },
                queueDiscover = value => discoverQueue.Add(value),
                randomDiscoverCard = RandomDiscoverCard,
                addTempCard = AddTempCard,
                addDeckCard = AddDeckCard,
                allCards = () => CardLibrary.All(),
                shuffleDeck = () => { drawPile = DeckOps.ShuffleCards(drawPile, rng); return drawPile.Count; },
                addEnergy = amount => { energy += amount; return energy; },
                addEnergyCap = amount => { maxEnergy += amount; energy += amount; return maxEnergy; },
            });
        }
    }
}
