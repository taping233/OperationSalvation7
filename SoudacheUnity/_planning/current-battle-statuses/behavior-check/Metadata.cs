using System;using System.Collections.Generic;namespace Sdt.Core {public static class CombatResolver {
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

}}