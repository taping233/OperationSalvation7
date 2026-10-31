// ported from src/battle.core.js viewApi
// 战斗 UI 门面的 Boot 侧实现：BattleScreen 只消费快照（BattleSnapshot/FoeSnapshot）与本接口，
// 不直接触碰 BattleSession。每个方法注释标明对应的 viewApi 字段名，文案/数值逐字照抄原版。
// 路径说明（任务包预设的「FoeSnapshot.id 反查 BattleFoe」）：
//   BattleSession.foes 为 private，无法由 id 反查 BattleFoe 实例；快照即真实状态的只读投影
//   （GetSnapshot 携带 affix/status/defense/hp 全量字段），AegisBlocked/PreviewDamage 均按快照
//   投影判定/预结算——两者本就不改状态（aegisBlocked 只读；previewDamage 克隆后结算），语义等价。
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Screens.Battle;
// Sdt.Core.OwnedCard（RunState.cs，背包条目）与 UI 侧 OwnedCard 同名；接口用的是 UI 侧形状 {Uid, Card}
using OwnedCard = Sdt.UI.Screens.Battle.OwnedCard;

namespace Sdt.Boot
{
    public sealed class BattleViewApi : Sdt.UI.Screens.Battle.IBattleViewApi
    {
        public static BattleSession Session;                 // Boot 接线时赋值
        public static void Install() { BattleView.Api = new BattleViewApi(); }

        // 对齐 JS (status[k] || 0)：快照 status 字典取值，缺键/空表按 0
        private static int StatusOf(IReadOnlyDictionary<string, int> status, string key)
        {
            int v;
            return status != null && status.TryGetValue(key, out v) ? v : 0;
        }

        /// <summary>aegisBlocked：敌人免伤判定（元素领主：偶数回合全免伤，破甲克制）。
        /// 原版：foe.affix === 'aegis' && turn % 2 === 0 && (foe.status.abreak || 0) &lt;= 0。
        /// turn 为 BattleSession 私有字段，经快照读取（快照即唯一公共只读途径）。</summary>
        public bool AegisBlocked(FoeSnapshot foe)
        {
            if (foe == null) return false;
            int turn = Session?.Turn ?? 1;
            return foe.affix == "aegis" && turn % 2 == 0 && StatusOf(foe.status, "abreak") <= 0;
        }

        /// <summary>curseChips（= statusChips 兼容名）：状态角标，祝福（绿）在前、诅咒（红）在后，
        /// 各按 BUFFS/CURSES 表序。原版把 icon/name/值拼进 HTML，此处拆为 StatusChip 字段：
        /// buff 的 Value = 计时型「N回合」/开关型空/数值型「N」（原版值文本带前导空格供模板拼接，
        /// 数据化后由 UI 决定间距）；curse 的 Value = 叠层型「N」/计时型「N回合」（原版 txt 含名字，
        /// 对应此处的 Name + Value）。Desc：祝福 = 「祝福：」+ 描述（原版 title），诅咒 = 描述。</summary>
        public IReadOnlyList<StatusChip> CurseChips(IReadOnlyDictionary<string, int> status)
        {
            var chips = new List<StatusChip>();
            foreach (var k in CombatResolver.Buffs)
            {
                int v = StatusOf(status, k);
                if (v <= 0) continue;
                CombatResolver.BuffMeta m;
                if (!CombatResolver.BuffMetaDict.TryGetValue(k, out m)) continue;
                chips.Add(new StatusChip
                {
                    Icon = m.icon,
                    Name = m.name,
                    Value = m.timed ? v + "回合" : (m.flag ? "" : v.ToString()),
                    Desc = "祝福：" + m.desc,
                    IsCurse = false,
                });
            }
            foreach (var k in CombatResolver.Curses)
            {
                int v = StatusOf(status, k);
                if (v <= 0) continue;
                CombatResolver.CurseMeta m;
                if (!CombatResolver.CurseMetaDict.TryGetValue(k, out m)) continue;
                chips.Add(new StatusChip
                {
                    Icon = m.icon,
                    Name = m.name,
                    Value = m.stack ? v.ToString() : v + "回合",
                    Desc = m.desc,
                    IsCurse = true,
                });
            }
            return chips;
        }

        /// <summary>effCostOf：实际费用。宇宙形态下所有卡 1 费；「本局对战内所有法术 1 费」（银河之旅）
        /// 只对法术生效；否则按卡面费用。cosmosForm 经快照 pstat.status 读取。</summary>
        public int EffCostOf(CardDef card)
        {
            return Session != null ? Session.GetEffectiveCost(card) : card?.cost ?? 0;
        }

        /// <summary>读取当前会话的背包、临时卡及战斗内覆写，不为单卡查询重建整个战斗快照。</summary>
        public OwnedCard FindCard(string uid)
        {
            var found = Session?.FindCard(uid);
            return found != null ? new OwnedCard { Uid = found.uid, Card = found.card } : null;
        }

        /// <summary>infuseOf：注能数。原版 +(card.infuse || 0) || deriveInfuse(card) || 0。</summary>
        public int InfuseOf(CardDef card)
        {
            return Session != null ? Session.GetInfusionNeed(card)
                : card == null || card.noInfuse ? 0 : (card.infuse ?? 0) > 0 ? card.infuse.Value : CardLibrary.DeriveInfuse(card);
        }

        /// <summary>markDreadShown：BOSS 登场竖线阴影每场只演一次。</summary>
        public void MarkDreadShown()
        {
            var s = Session;
            if (s != null) s.MarkDreadShown();
        }

        /// <summary>pileTip：牌堆悬停提示，同名卡计数「名×N」以「，」连接，空堆「（空）」。
        /// 委托 BattleSession.PileTipOf（内部用真 FindCard，可查宿主背包与临时卡）。</summary>
        public string PileTip(IReadOnlyList<string> uids)
        {
            var s = Session;
            if (s == null) return "（空）";
            return s.PileTipOf(uids != null ? new List<string>(uids) : new List<string>());
        }

        /// <summary>takeFloats：取走待展示的飘字/受击特效（取后清空）。
        /// BattleFloat.unit 为 "self" 或敌人下标；FloatSpec 以 IsSelf 区分，敌人下标存 Unit，
        /// self 时 Unit = -1（哨兵，非合法敌人下标）。</summary>
        public IReadOnlyList<FloatSpec> TakeFloats()
        {
            var s = Session;
            if (s == null) return new FloatSpec[0];
            var list = s.TakeFloats();
            var result = new List<FloatSpec>(list.Count);
            foreach (var f in list)
            {
                bool isSelf = false;
                int unit = -1;
                if (f.unit is string str) { if (str == "self") isSelf = true; }
                else if (f.unit is int) { unit = (int)f.unit; }
                result.Add(new FloatSpec { Unit = unit, IsSelf = isSelf, Text = f.text, Cls = f.cls, Warm = f.warm, PresentationSequence=f.presentationSequence });
            }
            return result;
        }

        /// <summary>targetSide：指向侧判定。'enemy' = 伤害类拖到敌人；'self' = 治疗/护甲等拖到自己；
        /// null = 群体卡与无指向效果直接点击。纯函数，逐字对齐 battle.rules.js targetSideFor。</summary>
        public string TargetSide(CardDef card)
        {
            return BattleRules.TargetSideFor(card);
        }

        /// <summary>unplayableReason：不可打出判定（v0.24），返回 null = 可打。
        /// 原版 unplayableReasonFor(card, mode)，mode（'normal'|'boss'）经快照读取，未开局按 "normal"。</summary>
        public string UnplayableReason(CardDef card)
        {
            return BattleRules.UnplayableReasonFor(card, Session?.Mode ?? "normal");
        }

        /// <summary>Combat.previewDamage 预结算（克隆快照，不改真实状态）。attacker 由 playerAtk/spellPower
        /// 构造（对齐 UI 调用形态）；target 经 FoeSnapshot 投影为 Combatant（id 反查 BattleFoe 不可行，
        /// 见文件头说明），状态/防御/生命全量来自快照。</summary>
        public PreviewResult PreviewDamage(int playerAtk, int spellPower, FoeSnapshot foe, int amount, string dmgType, CardDef card = null)
        {
            var attacker = new Combatant { atk = playerAtk, spellPower = spellPower };
            var target = new Combatant
            {
                hp = foe != null ? foe.hp : 0,
                defense = foe != null && foe.defense != null
                    ? new DefenseState { Shield = foe.defense.Shield, Armor = foe.defense.Armor, Guard = foe.defense.Guard }
                    : new DefenseState(),
                status = new UnitStatus(),
            };
            if (foe != null)
            {
                foreach (var k in CombatResolver.Curses) target.status.Set(k, StatusOf(foe.status, k));
                foreach (var k in CombatResolver.Buffs) target.status.Set(k, StatusOf(foe.status, k));
            }
            amount = Session?.AdjustCardDamage(card, StatusOf(foe?.status,"bleed"), amount, dmgType) ?? amount;
            var r = CombatResolver.PreviewDamage(attacker, target, amount, dmgType);
            return new PreviewResult { Dealt = r.dealt, Stealthed = r.stealthed, Log = r.log };
        }

        /// <summary>AFFIX_META（词缀角标）：grow/frenzy/aegis 的 {icon, name, desc}；未知词缀返回 null
        /// （对齐原版取表 miss 为 undefined）。</summary>
        public AffixDef AffixMeta(string affix)
        {
            string[] m;
            if (affix == null || !BattleSession.AffixMeta.TryGetValue(affix, out m)) return null;
            return new AffixDef { Icon = m[0], Name = m[1], Desc = m[2] };
        }

        /// <summary>Combat.TYPE_NAME：法术伤害/攻击伤害…；无效 key 回落 fixed（接口约定）。</summary>
        public string DmgTypeName(string dmgType)
        {
            string name;
            if (!string.IsNullOrEmpty(dmgType) && CombatResolver.TYPE_NAME.TryGetValue(dmgType, out name)) return name;
            return CombatResolver.TYPE_NAME[CombatResolver.FIXED];
        }

        // R()（rules.js 数值）——战斗 UI 需要的字段
        public int BattleStartDraw { get { return GameRules.BattleStartDraw; } }   // BOSS 战开局抽牌数
        public int BattleTurnDraw { get { return GameRules.BattleTurnDraw; } }     // 每回合开始抽牌数
        public int BattleEnergy { get { return GameRules.BattleEnergy; } }         // 每回合固定能量
        public int StarterSha { get { return GameRules.StarterSha; } }             // 初始攻击携带张数
        public int BossDeckSize { get { return GameRules.BossDeckSize; } }         // BOSS 战牌库编成张数

        /// <summary>SDT.Cards.all()：全卡牌库（发现/初始攻击用）。</summary>
        public IReadOnlyList<CardDef> AllCards { get { return CardLibrary.All(); } }

        /// <summary>SDT.Cards.SHA：初始攻击模板。</summary>
        public CardDef StarterAttack { get { return CardLibrary.SHA; } }
    }
}
