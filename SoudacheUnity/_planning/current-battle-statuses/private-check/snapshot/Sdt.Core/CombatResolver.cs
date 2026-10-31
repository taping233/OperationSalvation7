// ported from src/combat.js
// 伤害结算与状态（诅咒/祝福）系统：四类 dmgType（attack/spell/fixed/true）逐行对齐 dealDamage。
// 纯逻辑：不依赖 UnityEngine；Combatant 为玩家/敌人通用战斗载体（对齐 JS 任意带 hp/atk/status/defense 的对象）。
using System;
using System.Collections.Generic;

namespace Sdt.Core
{
    /// <summary>防御状态：护盾 → 护甲 → 生命 的吸收顺序（combat.js defense）。</summary>
    public sealed class DefenseState
    {
        public int Shield;
        public int Armor;
        public bool Guard;
    }

    /// <summary>
    /// 状态数值表：键名与原版 status 对象完全一致（bleed/poison/freeze/silence/abreak/healban +
    /// atkUp/spellUp/stealth/immune/reduce/swordForm/natureForm/cosmosForm）。
    /// </summary>
    public sealed class UnitStatus
    {
        public int bleed;     // 叠层：受到的攻击伤害每层 +1，无上限不衰减
        public int poison;    // 叠层：每层回合末 1 点固定伤害，不衰减
        public int freeze;    // 计时：1 回合无法行动
        public int silence;   // 计时：1 回合技能无法生效（攻击除外）
        public int abreak;    // 计时：2 回合内无法减免伤害
        public int healban;   // 计时：2 回合内无法回复生命
        public int atkDown;
        public int atkUp;     // 祝福 value 型：攻击伤害 +N（本场战斗）
        public int spellUp;   // 祝福 value 型：法术伤害 +N（本场战斗）
        public int stealth;   // 祝福 timed 型：无法成为被攻击对象；造成伤害破除
        public int immune;    // 祝福 timed 型：不受到任何伤害
        public int reduce;    // 祝福 value 型：每次受到的伤害 -N（真实除外）
        public int dodge;
        public int swordForm;   // 祝福 flag 型：回合开始时额外抽 1 张
        public int natureForm;  // 祝福 flag 型：回合开始时额外获得 1 点能量
        public int cosmosForm;  // 祝福 flag 型：本局对战所有卡牌变为 1 费
        public int necroticExposure;

        public int Get(string key)
        {
            switch (key)
            {
                case "bleed": return bleed;
                case "poison": return poison;
                case "freeze": return freeze;
                case "silence": return silence;
                case "abreak": return abreak;
                case "healban": return healban;
                case "atkDown": return atkDown;
                case "atkUp": return atkUp;
                case "spellUp": return spellUp;
                case "stealth": return stealth;
                case "immune": return immune;
                case "reduce": return reduce;
                case "dodge": return dodge;
                case "swordForm": return swordForm;
                case "natureForm": return natureForm;
                case "cosmosForm": return cosmosForm;
                case "necroticExposure": return necroticExposure;
                default: return 0;
            }
        }

        public void Set(string key, int value)
        {
            switch (key)
            {
                case "bleed": bleed = value; break;
                case "poison": poison = value; break;
                case "freeze": freeze = value; break;
                case "silence": silence = value; break;
                case "abreak": abreak = value; break;
                case "healban": healban = value; break;
                case "atkDown": atkDown = value; break;
                case "atkUp": atkUp = value; break;
                case "spellUp": spellUp = value; break;
                case "stealth": stealth = value; break;
                case "immune": immune = value; break;
                case "reduce": reduce = value; break;
                case "dodge": dodge = value; break;
                case "swordForm": swordForm = value; break;
                case "natureForm": natureForm = value; break;
                case "cosmosForm": cosmosForm = value; break;
                case "necroticExposure": necroticExposure = value; break;
            }
        }

        /// <summary>导出为与原版 status 对象同键的只读字典（快照用）。</summary>
        public IReadOnlyDictionary<string, int> Export()
        {
            var d = new Dictionary<string, int>(14);
            foreach (var k in CombatResolver.Curses) d[k] = Get(k);
            foreach (var k in CombatResolver.Buffs) d[k] = Get(k);
            if(necroticExposure>0)d["necroticExposure"]=necroticExposure;
            return d;
        }
    }

    /// <summary>战斗单位载体：玩家（宿主镜像）与敌人通用；hp&gt;=0，Dead 由战斗层维护。</summary>
    public class Combatant
    {
        public string name;
        public int hp;
        public int maxHp;
        public int atk;
        public int spellPower;
        public UnitStatus status = new UnitStatus();
        public DefenseState defense = new DefenseState();
        public bool dead;
        public string behavior;
        public int damageCap;
    }

    /// <summary>单次伤害结算结果（对齐 dealDamage 返回对象全字段）。</summary>
    public sealed class DamageResult
    {
        public string type;
        public int raw;
        public int bonus;
        public int atkPart;
        public int spellPart;
        public int bleedBonus;
        public int absorbed;
        public int dealt;
        public int overkill;
        public int reduced;
        public bool immune;
        public bool stealthed;
        public bool guarded;
        public List<string> log = new List<string>();
    }

    /// <summary>中毒结算结果（对齐 tickPoison 返回对象；无可结算时为 null）。</summary>
    public sealed class PoisonResult
    {
        public int poisonStacks;
        public int dealt;
        public int overkill;
        public bool immune;
        public List<string> log;
    }

    /// <summary>卡面记号解析结果：3' → 3 点法术伤害；3'' → 3 点真实伤害；无角标 type=null。</summary>
    public sealed class Notation
    {
        public int amount;
        public string type; // attack/spell/true 语义见 parseNotation；null = 无类型角标
    }

    public static class CombatResolver
    {
        // TYPES / TYPE_NAME（照抄原版常量与中文文案）
        public const string ATTACK = "attack";
        public const string SPELL = "spell";
        public const string FIXED = "fixed";
        public const string TRUE = "true";

        public static readonly IReadOnlyDictionary<string, string> TYPE_NAME = new Dictionary<string, string>
        {
            { ATTACK, "攻击伤害" }, { SPELL, "法术伤害" }, { FIXED, "固定伤害" }, { TRUE, "真实伤害" },
        };

        public sealed class CurseMeta { public string name; public string icon; public bool stack; public string desc; }
        public sealed class BuffMeta { public string name; public string icon; public bool value; public bool timed; public bool flag; public string desc; }

        // 诅咒状态表：bleed/poison 为叠层，其余为计时（共享回合钟：每回合结束统一递减）
        public static readonly string[] Curses = { "bleed", "poison", "freeze", "silence", "abreak", "healban", "atkDown" };
        public static readonly IReadOnlyDictionary<string, CurseMeta> CurseMetaDict = new Dictionary<string, CurseMeta>
        {
            { "bleed", new CurseMeta { name = "流血", icon = "[[icon:status-bleed]]", stack = true, desc = "每层使受到的攻击伤害 +1" } },
            { "poison", new CurseMeta { name = "中毒", icon = "[[icon:status-poison]]", stack = true, desc = "每层在回合结束时受到 1 点固定伤害" } },
            { "freeze", new CurseMeta { name = "冰冻", icon = "[[icon:status-freeze]]", stack = false, desc = "1 回合无法行动" } },
            { "silence", new CurseMeta { name = "沉默", icon = "[[icon:status-silence]]", stack = false, desc = "1 回合技能无法生效（攻击除外）" } },
            { "abreak", new CurseMeta { name = "破甲", icon = "[[icon:status-armor-break]]", stack = false, desc = "2 回合内无法减免伤害" } },
            { "healban", new CurseMeta { name = "禁疗", icon = "[[icon:status-heal-ban]]", stack = false, desc = "2 回合内无法回复生命" } },
            { "atkDown", new CurseMeta { name = "攻击降低", icon = "[[icon:status-atk-down]]", stack = false, desc = "持续期间攻击力降低，到期归还" } },
        };

        // 祝福状态表（v0.20）：value=数值型（可叠加，本场战斗）；timed=计时型（共享回合钟递减）；flag=开关型（本局对战常驻）
        public static readonly string[] Buffs = { "atkUp", "spellUp", "stealth", "immune", "reduce", "dodge", "swordForm", "natureForm", "cosmosForm" };
        public static readonly IReadOnlyDictionary<string, BuffMeta> BuffMetaDict = new Dictionary<string, BuffMeta>
        {
            { "atkUp", new BuffMeta { name = "攻击强化", icon = "[[icon:status-atk-up]]", value = true, desc = "攻击伤害 +N（本场战斗）" } },
            { "spellUp", new BuffMeta { name = "法术强化", icon = "[[icon:status-spell-up]]", value = true, desc = "法术伤害 +N（本场战斗）" } },
            { "stealth", new BuffMeta { name = "潜行", icon = "[[icon:status-stealth]]", timed = true, desc = "无法成为被攻击对象；造成伤害会破除潜行" } },
            { "immune", new BuffMeta { name = "免疫伤害", icon = "[[icon:status-immune]]", timed = true, desc = "不受到任何伤害" } },
            { "reduce", new BuffMeta { name = "减伤", icon = "[[icon:status-reduce]]", value = true, desc = "每次受到的伤害 -N（真实伤害除外）" } },
            { "dodge", new BuffMeta { name = "闪避", icon = "[[icon:status-dodge]]", value = true, desc = "避开下一段伤害（每层避开 1 段）" } },
            { "swordForm", new BuffMeta { name = "剑仙形态", icon = "[[icon:status-sword-form]]", flag = true, desc = "回合开始时额外抽 1 张" } },
            { "natureForm", new BuffMeta { name = "满月形态", icon = "[[icon:status-moon-form]]", flag = true, desc = "回合开始时额外获得 1 点能量" } },
            { "cosmosForm", new BuffMeta { name = "宇宙形态", icon = "[[icon:status-cosmos-form]]", flag = true, desc = "本局对战所有卡牌变为 1 费" } },
        };

        /// <summary>补齐战斗字段（C# 载体构造即齐整；保留入口对齐 ensureStatus 语义）。</summary>
        public static Combatant EnsureStatus(Combatant t)
        {
            if (t == null) return null;
            if (t.status == null) t.status = new UnitStatus();
            if (t.defense == null) t.defense = new DefenseState();
            return t;
        }

        /// <summary>卡面记号解析：'3\'' → 3 点法术伤害；'3\'\'' → 3 点真实伤害；无角标数字返回 type=null。</summary>
        public static Notation ParseNotation(string text)
        {
            var s = (text ?? string.Empty).Trim();
            // 对齐 /^(\d+)('')?(')?$/
            if (s.Length == 0 || !char.IsDigit(s[0])) return null;
            int i = 0;
            while (i < s.Length && char.IsDigit(s[i])) i++;
            string digits = s.Substring(0, i);
            string rest = s.Substring(i);
            if (rest == "''") return new Notation { amount = int.Parse(digits), type = TRUE };
            if (rest == "'") return new Notation { amount = int.Parse(digits), type = SPELL };
            if (rest.Length == 0) return new Notation { amount = int.Parse(digits), type = null };
            return null;
        }

        /// <summary>预览结算结果（不修改任何状态），战斗界面显示最终数字时用。</summary>
        public static DamageResult PreviewDamage(Combatant attacker, Combatant target, int amount, string type)
        {
            var clone = new Combatant
            {
                hp = target != null ? target.hp : 0,
                defense = new DefenseState
                {
                    Shield = target != null && target.defense != null ? target.defense.Shield : 0,
                    Armor = target != null && target.defense != null ? target.defense.Armor : 0,
                    Guard = target != null && target.defense != null && target.defense.Guard,
                },
                status = new UnitStatus(),
            };
            if (target != null && target.status != null)
            {
                clone.behavior=target.behavior;clone.damageCap=target.damageCap;clone.status.necroticExposure=target.status.necroticExposure;
                foreach (var k in Curses) clone.status.Set(k, target.status.Get(k));
                foreach (var k in Buffs) clone.status.Set(k, target.status.Get(k));
            }
            return DealDamage(attacker, clone, amount, type);
        }

        /// <summary>结算一次伤害。attacker/target 为任意带 hp/atk/spellPower/status/defense 的战斗单位。</summary>
        public static DamageResult DealDamage(Combatant attacker, Combatant target, int amount, string type)
        {
            if (string.IsNullOrEmpty(type)) type = ATTACK;
            EnsureStatus(target);
            var r = new DamageResult { type = type, raw = amount };

            // 免疫伤害：不受到任何伤害（攻击/法术/固定/真实全部无效）
            if (target.status.Get("immune") > 0)
            {
                r.immune = true;
                r.log.Add("免疫伤害");
                return r;
            }
            // 潜行：无法成为被攻击对象（造成伤害的一方若在潜行中，由调用方破除其潜行）
            if (target.status.Get("stealth") > 0)
            {
                r.stealthed = true;
                r.log.Add("潜行：无法成为被攻击对象");
                return r;
            }

            int dmg = amount;
            if (type == ATTACK)
            {
                int atk = (attacker != null ? attacker.atk : 0) +
                          (attacker != null && attacker.status != null ? attacker.status.Get("atkUp") : 0);
                int bleed = target.status.Get("bleed");
                r.atkPart = atk;
                r.bleedBonus = bleed;
                r.bonus = atk + bleed;
                dmg = amount + atk + bleed;
                if (atk > 0) r.log.Add("攻击力 +" + atk);
                if (bleed > 0) r.log.Add("流血 +" + bleed);
            }
            else if (type == SPELL)
            {
                int sp = (attacker != null ? attacker.spellPower : 0) +
                         (attacker != null && attacker.status != null ? attacker.status.Get("spellUp") : 0);
                r.spellPart = sp;
                r.bonus = sp;
                dmg = amount + sp;
                if (sp > 0) r.log.Add("法伤加成 +" + sp);
            }
            // 固定/真实伤害：无任何加成
            dmg = Math.Max(0, dmg);
            if (dmg > 0 && target.status.dodge > 0) { target.status.dodge--; r.log.Add("闪避：避开本段伤害"); return r; }

            // 破甲（abreak > 0）：目标无法减免伤害——格挡与护盾/护甲吸收全部失效
            bool broken = target.status.Get("abreak") > 0;

            // 格挡：非真实伤害每次结算降为 1 点；真实伤害无视格挡；破甲状态格挡失效
            if (target.defense.Guard && type != TRUE && !broken && dmg > 1)
            {
                dmg = 1;
                r.guarded = true;
                r.log.Add("格挡：伤害降为 1");
            }

            // 减伤（祝福）：每次受到的伤害 -N；真实伤害无视（同格挡/护盾/护甲）
            int reduce = target.status.Get("reduce");
            if (reduce > 0 && type != TRUE && !broken && dmg > 0)
            {
                int cut = Math.Min(reduce, dmg);
                dmg -= cut;
                r.reduced = cut;
                r.log.Add("减伤 -" + cut);
            }

            if (type != TRUE && !broken)
            {
                // 防御吸收：护盾 → 护甲
                var def = target.defense;
                int useShield = Math.Min(def.Shield, dmg);
                def.Shield -= useShield; dmg -= useShield;
                int useArmor = Math.Min(def.Armor, dmg);
                def.Armor -= useArmor; dmg -= useArmor;
                r.absorbed = useShield + useArmor;
                if (r.absorbed > 0) r.log.Add("防御吸收 " + r.absorbed);
            }
            else if (type == TRUE)
            {
                r.log.Add("无视防御手段");
            }
            else
            {
                r.log.Add("破甲：无法减免伤害");
            }

            if(target.damageCap>0&&type!=TRUE&&!broken)dmg=Math.Min(dmg,target.damageCap);
            if(target.status.necroticExposure>1)dmg*=target.status.necroticExposure;
            r.dealt = dmg;
            if (dmg > 0)
            {
                target.hp -= dmg;
                if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
            }
            if(dmg>0&&target.hp>0&&target.behavior=="witness_pope"&&target.status.silence==0){
                if(type==ATTACK)target.atk++;
                if(type==SPELL&&target.status.healban==0)target.hp=Math.Min(target.maxHp,target.hp+1);
            }
            return r;
        }

        // —— 流血（叠层状态）——
        public static int AddBleed(Combatant target, int n)
        {
            EnsureStatus(target);
            target.status.bleed += n;
            if (target.status.bleed < 0) target.status.bleed = 0;
            return target.status.bleed;
        }

        public static int ClearBleed(Combatant target) { EnsureStatus(target); target.status.bleed = 0; return 0; }

        /// <summary>挂诅咒：bleed/poison 按层叠加（n 可为负做减层）；计时类取「剩余较大值」不叠加。</summary>
        public static int AddCurse(Combatant target, string key, int? n)
        {
            if (!CurseMetaDict.ContainsKey(key)) return 0;
            int v = n ?? 1;
            EnsureStatus(target);
            if (CurseMetaDict[key].stack) target.status.Set(key, Math.Max(0, target.status.Get(key) + v));
            else target.status.Set(key, Math.Max(target.status.Get(key), v));
            return target.status.Get(key);
        }

        /// <summary>是否身负任意诅咒（深解印记「诅咒状态下」/ 暗影射击判定用）。</summary>
        public static bool HasCurse(Combatant target)
        {
            if (target == null || target.status == null) return false;
            foreach (var k in Curses) if (target.status.Get(k) > 0) return true;
            return false;
        }

        /// <summary>净化：清除身上所有诅咒类型与效果（叠层与计时全部归零），返回被清除的键。</summary>
        public static List<string> Purify(Combatant target)
        {
            EnsureStatus(target);
            var cleared = new List<string>();
            foreach (var k in Curses) if (target.status.Get(k) > 0) cleared.Add(k);
            foreach (var k in Curses) target.status.Set(k, 0);
            return cleared;
        }

        /// <summary>
        /// 中毒结算：每层 1 点固定伤害（不吃任何加成、不受防御影响；免疫伤害可挡下；
        /// 中毒是状态伤害不是攻击——潜行不挡中毒）。层数不衰减。
        /// </summary>
        public static PoisonResult TickPoison(Combatant target)
        {
            EnsureStatus(target);
            int stacks = target.status.poison;
            if (stacks <= 0) return null;
            if (target.status.Get("immune") > 0)
            {
                return new PoisonResult { poisonStacks = stacks, dealt = 0, immune = true, log = new List<string> { "免疫伤害" } };
            }
            int damage = (target.damageCap > 0 && target.status.abreak <= 0 ? Math.Min(stacks, target.damageCap) : stacks)
                * Math.Max(1, target.status.necroticExposure);
            var r = new PoisonResult { poisonStacks = stacks, dealt = damage, log = new List<string>() };
            target.hp -= damage;
            if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }
            return r;
        }

        /// <summary>
        /// 计时状态递减：战斗层在「每回合结束」（共享回合钟，双方各行动一次）调用一次，
        /// 返回本次到点解除的键（冰冻/沉默/破甲/禁疗/潜行/免疫伤害）。
        /// 持续 n 回合 = 从触发当回合起覆盖 n 个完整回合。
        /// </summary>
        public static List<string> TickDurations(Combatant target)
        {
            if (target == null || target.status == null) return new List<string>();
            var expired = new List<string>();
            var timedKeys = new List<string>();
            foreach (var k in Curses) if (!CurseMetaDict[k].stack) timedKeys.Add(k);
            foreach (var k in Buffs) if (BuffMetaDict[k].timed) timedKeys.Add(k);
            foreach (var k in timedKeys)
            {
                if (target.status.Get(k) > 0)
                {
                    target.status.Set(k, target.status.Get(k) - 1);
                    if (target.status.Get(k) == 0) expired.Add(k);
                }
            }
            return expired;
        }

        /// <summary>能否行动：冰冻 &gt; 0 时轮到该方行动必须跳过（跳过后照常递减计时）。</summary>
        public static bool CanAct(Combatant target)
        {
            if (target == null || target.status == null) return true;
            return target.status.Get("freeze") <= 0;
        }

        /// <summary>挂祝福：value 型加数值（可叠加，本场战斗）；timed 型取「剩余较大值」；flag 型置 1（本局对战常驻）。</summary>
        public static int AddBlessing(Combatant target, string key, int? n)
        {
            if (!BuffMetaDict.ContainsKey(key)) return 0;
            int v = n ?? 1;
            EnsureStatus(target);
            var m = BuffMetaDict[key];
            if (m.value) target.status.Set(key, Math.Max(0, target.status.Get(key) + v));
            else if (m.timed) target.status.Set(key, Math.Max(target.status.Get(key), v));
            else target.status.Set(key, 1);
            return target.status.Get(key);
        }

        // 潜行判定与破除（造成伤害后由调用方破除攻击方的潜行）
        public static bool IsStealthed(Combatant target)
        {
            return target != null && target.status != null && target.status.Get("stealth") > 0;
        }

        public static bool BreakStealth(Combatant target)
        {
            if (!IsStealthed(target)) return false;
            target.status.Set("stealth", 0);
            return true;
        }

#if SDT_SELFTEST
        // 对齐 combat.js selfTest 的代表性断言（协调者可扩写；此处保证核心数值语义）
        internal static void RunSelfTest(System.Collections.Generic.List<string> failures)
        {
            void Eq(string name, object got, object want)
            {
                if (!Equals(got, want)) failures.Add(name + ": 期望 " + want + "，得到 " + got);
            }
            var A = new Combatant { atk = 4 };
            var B = new Combatant { hp = 30 };
            Eq("攻击 2 + 攻击力4", DealDamage(A, B, 2, ATTACK).dealt, 6);
            Eq("  目标剩余 HP", B.hp, 24);
            B = new Combatant { hp = 30, status = new UnitStatus { bleed = 2 } };
            Eq("攻击 2 + 攻击力4 + 流血2层", DealDamage(A, B, 2, ATTACK).dealt, 8);
            var A2 = new Combatant { spellPower = 1 };
            B = new Combatant { hp = 30, status = new UnitStatus { bleed = 3 } };
            Eq("法术 3' + 法伤1（流血不加成）", DealDamage(A2, B, 3, SPELL).dealt, 4);
            var A3 = new Combatant { atk = 4, spellPower = 2 };
            Eq("固定 5 不加成", DealDamage(A3, new Combatant { hp = 30 }, 5, FIXED).dealt, 5);
            B = new Combatant { hp = 30, defense = new DefenseState { Shield = 5, Armor = 4 } };
            var r6 = DealDamage(new Combatant(), B, 3, TRUE);
            Eq("真实 3'' 无视防御", r6.dealt, 3);
            Eq("  防御值未被消耗", B.defense.Shield + B.defense.Armor, 9);
            B = new Combatant { hp = 30, defense = new DefenseState { Shield = 5, Armor = 4 } };
            var r7 = DealDamage(new Combatant { atk = 0 }, B, 10, FIXED);
            Eq("固定 10：吸收 9（盾5+甲4）", r7.absorbed, 9);
            Eq("  穿透到生命", r7.dealt, 1);
            Eq("  护甲耗尽", B.defense.Armor, 0);
            B = new Combatant { hp = 30 };
            AddBleed(B, 2); AddBleed(B, 1);
            Eq("叠 3 层流血", B.status.bleed, 3);
            ClearBleed(B);
            Eq("净化后 0 层", B.status.bleed, 0);
            B = new Combatant { hp = 30, defense = new DefenseState { Guard = true } };
            Eq("格挡：攻（+16）合 20 降为 1", DealDamage(new Combatant { atk = 4 }, B, 16, ATTACK).dealt, 1);
            B = new Combatant { hp = 30, defense = new DefenseState { Guard = true } };
            Eq("格挡不拦真实 3''", DealDamage(new Combatant(), B, 3, TRUE).dealt, 3);
            B = new Combatant { hp = 30, status = new UnitStatus { poison = 3 } };
            Eq("中毒 3 层回合末固定伤害", TickPoison(B).dealt, 3);
            Eq("  中毒层数不衰减", B.status.poison, 3);
            B = new Combatant { hp = 30 };
            AddCurse(B, "freeze", 1);
            Eq("冰冻后不能行动", CanAct(B), false);
            TickDurations(B);
            Eq("  冰冻 1 回合后解除", B.status.Get("freeze"), 0);
            B = new Combatant { hp = 30, defense = new DefenseState { Shield = 5, Armor = 4, Guard = true }, status = new UnitStatus { abreak = 2 } };
            Eq("破甲：10 点伤害全额穿透", DealDamage(new Combatant { atk = 0 }, B, 10, FIXED).dealt, 10);
            Eq("记号 3'", ParseNotation("3'").type, SPELL);
            Eq("记号 3''", ParseNotation("3''").type, TRUE);
            Eq("记号 3（无角标）", ParseNotation("3").type, null);
        }
#endif
    }
}
