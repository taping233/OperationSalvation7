// ported from src/battle.effects.js
// 文本效果执行器：splitEffectClauses 效果子句拆分 + applyTextEffects 逐条正则匹配结算。
// 所有状态变化通过 EffectPorts 显式端口进入，解析层不依赖战斗模块内部字段。正则逐字照抄原版。
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Sdt.Core;

namespace Sdt.Core.Battle
{
    /// <summary>「回合开始时」子句（each = 「每回合开始时」，每回合重复触发）。</summary>
    public sealed class TurnStartItem { public string text; public bool each; }

    /// <summary>卡牌描述按句切分后的结算时点归类（立即/回合开始/本局对战内/被注能时）。</summary>
    public sealed class EffectClauses
    {
        public List<string> immediate = new List<string>();
        public List<TurnStartItem> turnStart = new List<TurnStartItem>();
        public List<string> battle = new List<string>();
        public List<string> onInfused = new List<string>();
    }

    /// <summary>飘字/受击特效条目（unit = "self" 或敌人下标 int；渲染后由视图消费）。</summary>
    public sealed class BattleFloat
    {
        public object unit;   // string "self" | int 敌人下标
        public string text;
        public string cls;
        public bool warm;
        public long presentationSequence;
    }

    /// <summary>「发现」任务（n=发现张数，rarity=null 不限稀有度）。</summary>
    public sealed class DiscoverJob { public int n; public string rarity; }

    /// <summary>文本效果执行结果（对齐 applyTextEffects 返回对象）。</summary>
    public sealed class EffectResult { public bool did; public bool drawn; public bool healed; public bool armored; }

    /// <summary>效果执行端口（对齐 createEffectExecutor 的 deps）：由 BattleSession 注入实现。</summary>
    public sealed class EffectPorts
    {
        public Func<List<Combatant>> getAlive;
        public Func<UnitStatus> getPlayerStatus;
        public Func<DefenseState> getPlayerDefense;
        public Func<string> getMode;                                     // 'normal' | 'boss'
        public Action<string, string> log;                               // (message, kind)
        public Func<string, string> escapeHtml;                          // 文案转义（核心层恒等即可）
        public Action<int> heal;
        public Action<BattleFloat> pushFloat;
        public Func<int, int> drawCards;
        public Action<int> grantStarterAttack;
        public Action markNoDrawNext;
        public Action<DiscoverJob> queueDiscover;
        public Func<string, CardDef> randomDiscoverCard;                 // rarity 参数（null = 不限）
        public Func<CardDef, string> addTempCard;
        public Func<CardDef, string> addDeckCard;
        public Func<IReadOnlyList<CardDef>> allCards;
        public Func<int> shuffleDeck;                                    // 返回牌库张数
        public Func<int, int> addEnergy;                                 // 返回当前能量
        public Func<int, int> addEnergyCap;                              // 返回当前能量上限
    }

    public static class EffectParser
    {
        private static readonly Regex OnInfusedHead = new Regex(@"^被注能时[：:，,]?\s*(.+)$", RegexOptions.Compiled);
        private static readonly Regex TurnStartHead = new Regex(@"^(每回合开始时|下回合开始时?|下个回合开始时?|回合开始时)[：:，,]?\s*(.+)$", RegexOptions.Compiled);
        private static readonly Regex EachHead = new Regex(@"^每回合开始时", RegexOptions.Compiled);
        private static readonly Regex BattleHead = new Regex(@"^(本局对战内|本场对战|本场战斗)", RegexOptions.Compiled);

        /// <summary>
        /// 将卡牌自然语言拆成稳定的结算时点。这里只解析文本，不读写战斗状态。
        /// </summary>
        public static EffectClauses SplitEffectClauses(string description)
        {
            var output = new EffectClauses();
            foreach (var source in (description ?? string.Empty).Split(new[] { '。', '；', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries))
            {
                string text = source.Trim();
                if (text.Length == 0) continue;
                Match match;
                if ((match = OnInfusedHead.Match(text)).Success)
                {
                    output.onInfused.Add(match.Groups[1].Value);
                    continue;
                }
                if ((match = TurnStartHead.Match(text)).Success)
                {
                    output.turnStart.Add(new TurnStartItem { text = match.Groups[2].Value, each = EachHead.IsMatch(text) });
                    continue;
                }
                if (BattleHead.IsMatch(text))
                {
                    output.battle.Add(text);
                    continue;
                }
                output.immediate.Add(text);
            }
            return output;
        }
    }

    /// <summary>文本效果执行器（createEffectExecutor 返回的 applyTextEffects 的类化封装）。</summary>
    public sealed class EffectExecutor
    {
        private readonly EffectPorts deps;
        public EffectExecutor(EffectPorts deps) { this.deps = deps; }

        // —— 正则表（照抄原版 match 调用）——
        private static readonly Regex DurationRe = new Regex(@"持续\s*(\d+)\s*回合", RegexOptions.Compiled);
        private static readonly Regex BleedNRe = new Regex(@"附加\s*(\d+)\s*层?\s*流血", RegexOptions.Compiled);
        private static readonly Regex BleedAnyRe = new Regex(@"附加流血", RegexOptions.Compiled);
        private static readonly Regex PoisonRe = new Regex(@"附加\s*(?:(\d+)\s*层)?\s*中毒", RegexOptions.Compiled);
        private static readonly Regex FreezeGuardRe = new Regex(@"免疫冰冻|对冰冻", RegexOptions.Compiled);
        private static readonly Regex FreezeHitRe = new Regex(@"附加冰冻|冰冻\s*所有|冰冻\s*\d+\s*名|冻结", RegexOptions.Compiled);
        private static readonly Regex FreezeTurnsRe = new Regex(@"(?:冻结|冰冻)状态\s*(\d+)\s*回合", RegexOptions.Compiled);
        private static readonly Regex SilenceRe = new Regex(@"沉默", RegexOptions.Compiled);
        private static readonly Regex AbreakRe = new Regex(@"破甲", RegexOptions.Compiled);
        private static readonly Regex HealbanRe = new Regex(@"禁疗", RegexOptions.Compiled);
        private static readonly Regex StealthRe = new Regex(@"潜行", RegexOptions.Compiled);
        private static readonly Regex StealthTurnsRe = new Regex(@"潜行(?:状态)?\s*(\d+)\s*回合", RegexOptions.Compiled);
        private static readonly Regex StateSuffixRe = new Regex(@"状态下", RegexOptions.Compiled);
        private static readonly Regex Atk1Re = new Regex(@"攻击\s*\+\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex Atk2Re = new Regex(@"攻\s*\+\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex Atk3Re = new Regex(@"\+\s*(\d+)\s*攻", RegexOptions.Compiled);
        private static readonly Regex Atk4Re = new Regex(@"获得\s*(\d+)\s*点?攻击力?", RegexOptions.Compiled);
        private static readonly Regex Spell1Re = new Regex(@"法伤\s*\+\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex Spell2Re = new Regex(@"法术伤害\s*\+\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex ImmuneRe = new Regex(@"免疫伤害|无敌", RegexOptions.Compiled);
        private static readonly Regex ImmuneTurns1Re = new Regex(@"(\d+)\s*回合内[^。]*无敌", RegexOptions.Compiled);
        private static readonly Regex ImmuneTurns2Re = new Regex(@"无敌[^。]*?(\d+)\s*回合", RegexOptions.Compiled);
        private static readonly Regex ReduceRe = new Regex(@"减伤\s*(\d+)?", RegexOptions.Compiled);
        private static readonly Regex SwordFormRe = new Regex(@"剑仙形态|每回合额外抽\s*\d+\s*张", RegexOptions.Compiled);
        private static readonly Regex NatureFormRe = new Regex(@"自然形态|回合开始时[^。]*获得\s*\d+\s*点?能量", RegexOptions.Compiled);
        private static readonly Regex CosmosFormRe = new Regex(@"宇宙形态", RegexOptions.Compiled);
        private static readonly Regex Heal1Re = new Regex(@"回复\s*(\d+)\s*(?:点\s*生命|点?血)", RegexOptions.Compiled);
        private static readonly Regex Heal2Re = new Regex(@"\+\s*(\d+)\s*血", RegexOptions.Compiled);
        private static readonly Regex Armor1Re = new Regex(@"获得\s*(\d+)\s*点?\s*护甲", RegexOptions.Compiled);
        private static readonly Regex Armor2Re = new Regex(@"\+\s*(\d+)\s*甲", RegexOptions.Compiled);
        private static readonly Regex ShieldRe = new Regex(@"获得\s*(\d+)\s*点?\s*护盾", RegexOptions.Compiled);
        private static readonly Regex GuardRe = new Regex(@"本回合所受伤害降为", RegexOptions.Compiled);
        private static readonly Regex PurifyRe = new Regex(@"净化", RegexOptions.Compiled);
        private static readonly Regex DrawRe = new Regex(@"抽\s*(\d+)\s*张牌", RegexOptions.Compiled);
        private static readonly Regex NoDrawRe = new Regex(@"下回合无法抽牌|下个回合无法抽牌", RegexOptions.Compiled);
        private static readonly Regex DiscoverRe = new Regex(@"发现\s*(?:(\d+)\s*张)?\s*(传说)?(?:卡牌|牌|卡)", RegexOptions.Compiled);
        private static readonly Regex RandGet1Re = new Regex(@"(?:获得|获取)\s*(\d+)\s*张随机卡牌", RegexOptions.Compiled);
        private static readonly Regex RandGet2Re = new Regex(@"随机获取\s*(\d+)\s*张卡牌", RegexOptions.Compiled);
        private static readonly Regex ShuffleRndRe = new Regex(@"洗入\s*(\d+)\s*张随机卡牌", RegexOptions.Compiled);
        private static readonly Regex ShuffleNamedRe = new Regex(@"将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库", RegexOptions.Compiled);
        private static readonly Regex HandNamedRe = new Regex(@"将\s*(?:(\d+)\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌", RegexOptions.Compiled);
        private static readonly Regex EnergyRe = new Regex(@"获得\s*(\d+)\s*点?能量", RegexOptions.Compiled);
        private static readonly Regex EnergyCapRe = new Regex(@"能量上限\s*\+\s*(\d+)", RegexOptions.Compiled);

        /// <summary>执行一段卡面文本的效果；target 为指向性目标（已死或空时回落到第一个存活敌人）。</summary>
        public EffectResult ApplyTextEffects(CardDef card, string text, Combatant target)
        {
            string desc = text ?? string.Empty;
            var pstat = deps.getPlayerStatus();
            var pdef = deps.getPlayerDefense();
            var esc = deps.escapeHtml ?? (s => s ?? string.Empty);
            bool did = false;
            var durOvM = DurationRe.Match(desc);
            int? durOv = durOvM.Success ? (int?)int.Parse(durOvM.Groups[1].Value) : null;
            Combatant curseTarget = target != null && !target.dead ? target : FirstAliveOrNull();

            var bm = BleedNRe.Match(desc);
            if (bm.Success || BleedAnyRe.IsMatch(desc))
            {
                int n = bm.Success ? int.Parse(bm.Groups[1].Value) : 1;
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "bleed", n);
                    deps.log("[[icon:blood]] <b>" + esc(curseTarget.name) + "</b> 附加 " + n + " 层流血", "sys"); did = true;
                }
            }
            var pm = PoisonRe.Match(desc);
            if (pm.Success)
            {
                int n = pm.Groups[1].Success ? int.Parse(pm.Groups[1].Value) : 1;
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "poison", n);
                    deps.log("[[icon:skull]] <b>" + esc(curseTarget.name) + "</b> 附加 " + n + " 层中毒（每层回合末 1 点固定伤害）", "sys"); did = true;
                }
            }
            if (!FreezeGuardRe.IsMatch(desc) && FreezeHitRe.IsMatch(desc))
            {
                var fm = FreezeTurnsRe.Match(desc);
                int n = fm.Success ? int.Parse(fm.Groups[1].Value) : (durOv ?? 1);
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "freeze", n);
                    deps.log("[[icon:crystal]] <b>" + esc(curseTarget.name) + "</b> 被冰冻 " + n + " 回合（无法行动）", "sys"); did = true;
                }
            }
            if (SilenceRe.IsMatch(desc))
            {
                int n = durOv ?? 1;
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "silence", n);
                    deps.log("[[icon:cross]] <b>" + esc(curseTarget.name) + "</b> 被沉默 " + n + " 回合（技能无效，攻击除外）", "sys"); did = true;
                }
            }
            if (AbreakRe.IsMatch(desc))
            {
                int n = durOv ?? 2;
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "abreak", n);
                    deps.log("[[icon:tools]] <b>" + esc(curseTarget.name) + "</b> 破甲 " + n + " 回合（无法减免伤害——元素庇幕失效）", "sys"); did = true;
                }
            }
            if (HealbanRe.IsMatch(desc))
            {
                int n = durOv ?? 2;
                if (curseTarget != null)
                {
                    CombatResolver.AddCurse(curseTarget, "healban", n);
                    deps.log("[[icon:heart]] <b>" + esc(curseTarget.name) + "</b> 禁疗 " + n + " 回合（无法回复生命）", "sys"); did = true;
                }
            }

            if (StealthRe.IsMatch(desc))
            {
                var stm = StealthTurnsRe.Match(desc);
                int n = stm.Success ? int.Parse(stm.Groups[1].Value) : (durOv ?? 1);
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "stealth", n);
                deps.log("[[icon:runner]] <b>祝福·潜行</b>：" + n + " 回合内无法成为被攻击对象（造成伤害会破除）", "ok");
                did = true;
            }
            Match atkB = null;
            if (!StateSuffixRe.IsMatch(desc))
            {
                atkB = Atk1Re.Match(desc);
                if (!atkB.Success) atkB = Atk2Re.Match(desc);
                if (!atkB.Success) atkB = Atk3Re.Match(desc);
                if (!atkB.Success) atkB = Atk4Re.Match(desc);
            }
            if (atkB != null && atkB.Success)
            {
                int v = int.Parse(atkB.Groups[1].Value);
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "atkUp", v);
                deps.log("[[icon:swords]] <b>祝福·攻击力增加</b>：攻击力 +" + v + "（本场战斗，当前加成 " + pstat.Get("atkUp") + "）", "ok");
                did = true;
            }
            Match spB = null;
            if (!StateSuffixRe.IsMatch(desc))
            {
                spB = Spell1Re.Match(desc);
                if (!spB.Success) spB = Spell2Re.Match(desc);
            }
            if (spB != null && spB.Success)
            {
                int v = int.Parse(spB.Groups[1].Value);
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "spellUp", v);
                deps.log("[[icon:crystal]] <b>祝福·法伤增加</b>：法术伤害 +" + v + "（本场战斗，当前加成 " + pstat.Get("spellUp") + "）", "ok");
                did = true;
            }
            if (ImmuneRe.IsMatch(desc))
            {
                var im = ImmuneTurns1Re.Match(desc);
                if (!im.Success) im = ImmuneTurns2Re.Match(desc);
                int n = im.Success ? int.Parse(im.Groups[1].Value) : (durOv ?? 1);
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "immune", n);
                deps.log("[[icon:sparkles]] <b>祝福·免疫伤害</b>：" + n + " 回合内不受到任何伤害", "ok");
                did = true;
            }
            var rdB = ReduceRe.Match(desc);
            if (rdB.Success)
            {
                int n = rdB.Groups[1].Success ? int.Parse(rdB.Groups[1].Value) : 1;
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "reduce", n);
                deps.log("[[icon:plate]] <b>祝福·减伤</b>：每次受到的伤害 -" + n + "（本场战斗）", "ok");
                did = true;
            }
            if (SwordFormRe.IsMatch(desc))
            {
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "swordForm", null);
                deps.log("[[icon:sword]] <b>祝福·剑仙形态</b>：回合开始时额外抽 1 张牌（本局对战）", "ok");
                did = true;
            }
            if (NatureFormRe.IsMatch(desc))
            {
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "natureForm", null);
                deps.log("[[icon:wood]] <b>祝福·自然形态</b>：回合开始时额外获得 1 点能量（本局对战）", "ok");
                did = true;
            }
            if (CosmosFormRe.IsMatch(desc))
            {
                var self = new Combatant { status = pstat };
                CombatResolver.AddBlessing(self, "cosmosForm", null);
                deps.log("[[icon:sparkles]] <b>祝福·宇宙形态</b>：本局对战内，所有卡牌变为 1 费", "ok");
                did = true;
            }

            bool healed = false, armored = false;
            var hm = Heal1Re.Match(desc);
            if (!hm.Success) hm = Heal2Re.Match(desc);
            if (hm.Success)
            {
                healed = true;
                int n = int.Parse(hm.Groups[1].Value);
                if (pstat.Get("healban") > 0)
                {
                    deps.log("[[icon:heart]] 禁疗中：回复 " + n + " 点生命无效（还剩 " + pstat.Get("healban") + " 回合）", "warn");
                }
                else
                {
                    deps.heal(n);
                    deps.pushFloat(new BattleFloat { unit = "self", text = "💚", cls = "stk", warm = true });
                }
                did = true;
            }
            var am = Armor1Re.Match(desc);
            if (!am.Success) am = Armor2Re.Match(desc);
            if (am.Success)
            {
                armored = true;
                pdef.Armor += int.Parse(am.Groups[1].Value);
                deps.log("[[icon:plate]] 获得 " + am.Groups[1].Value + " 点护甲", "sys"); did = true;
            }
            var sm = ShieldRe.Match(desc);
            if (sm.Success)
            {
                pdef.Shield += int.Parse(sm.Groups[1].Value);
                deps.log("[[icon:shield]] 获得 " + sm.Groups[1].Value + " 点护盾", "sys"); did = true;
            }
            if (GuardRe.IsMatch(desc))
            {
                pdef.Guard = true;
                deps.log("[[icon:shield]] 格挡：本回合所受伤害降为 1", "sys");
                did = true;
            }
            if (PurifyRe.IsMatch(desc))
            {
                var self = new Combatant { status = pstat };
                var cleared = CombatResolver.Purify(self);
                if (cleared.Count > 0)
                {
                    var names = new List<string>();
                    foreach (var k in cleared) names.Add(CombatResolver.CurseMetaDict[k].name);
                    deps.log("[[icon:sparkles]] 净化：清除了身上的 " + string.Join("、", names), "ok");
                }
                else
                {
                    deps.log("[[icon:sparkles]] 净化：身上没有诅咒，干干净净", "ok");
                }
                did = true;
            }

            bool drawn = false;
            var dm = DrawRe.Match(desc);
            if (dm.Success)
            {
                int n = int.Parse(dm.Groups[1].Value);
                int got = deps.drawCards(n);
                deps.log("[[icon:cards]] <b>" + esc(card.name) + "</b>：抽了 " + got + " 张牌", "sys");
                did = true; drawn = true;
            }
            if (NoDrawRe.IsMatch(desc))
            {
                deps.markNoDrawNext();
                deps.log("[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>", "sys");
                did = true;
            }
            var dcm = DiscoverRe.Match(desc);
            if (dcm.Success)
            {
                deps.queueDiscover(new DiscoverJob { n = dcm.Groups[1].Success ? int.Parse(dcm.Groups[1].Value) : 1, rarity = dcm.Groups[2].Success ? dcm.Groups[2].Value : null });
                did = true;
            }
            var rm = RandGet1Re.Match(desc);
            if (!rm.Success) rm = RandGet2Re.Match(desc);
            if (rm.Success)
            {
                int n = int.Parse(rm.Groups[1].Value);
                int got = 0;
                for (int i = 0; i < n; i++)
                {
                    var discovered = deps.randomDiscoverCard(null);
                    if (discovered != null) { deps.addTempCard(discovered); got++; }
                }
                deps.log("[[icon:cards]] <b>" + esc(card.name) + "</b>：随机获得 " + got + " 张卡牌（置入手牌，战后消散）", "loot");
                did = true;
            }

            var shR = ShuffleRndRe.Match(desc);
            var shN = ShuffleNamedRe.Match(desc);
            if (shR.Success || shN.Success)
            {
                var added = new List<string>();
                if (shR.Success)
                {
                    for (int i = 0; i < int.Parse(shR.Groups[1].Value); i++)
                    {
                        var discovered = deps.randomDiscoverCard(null);
                        if (discovered != null) { deps.addDeckCard(discovered); added.Add(discovered.name); }
                    }
                }
                if (shN.Success)
                {
                    CardDef tpl = null;
                    foreach (var candidate in deps.allCards()) if (candidate.name == shN.Groups[2].Value) { tpl = candidate; break; }
                    int count = shN.Groups[1].Success ? int.Parse(shN.Groups[1].Value) : 1;
                    if (tpl != null)
                    {
                        for (int i = 0; i < count; i++) { deps.addDeckCard(tpl); added.Add(tpl.name); }
                    }
                    else
                    {
                        deps.log("[[icon:question]] 【" + esc(card.name) + "】找不到可洗入牌库的卡牌「" + esc(shN.Groups[2].Value) + "」（占位）", "warn");
                    }
                }
                if (added.Count > 0)
                {
                    int deckSize = deps.shuffleDeck();
                    var order = new List<string>();
                    var counts = new List<KeyValuePair<string, int>>();
                    foreach (var name in added)
                    {
                        int i = counts.FindIndex(kv => kv.Key == name);
                        if (i >= 0) counts[i] = new KeyValuePair<string, int>(name, counts[i].Value + 1);
                        else counts.Add(new KeyValuePair<string, int>(name, 1));
                    }
                    foreach (var kv in counts) order.Add("【" + esc(kv.Key) + "】×" + kv.Value);
                    deps.log("[[icon:recycle]] <b>" + esc(card.name) + "</b>：将 " + string.Join("、", order.ToArray()) + " 洗入牌库" +
                             "（牌库 " + deckSize + " 张，已洗混）", "sys");
                    did = true;
                }
            }
            var hdN = HandNamedRe.Match(desc);
            if (hdN.Success)
            {
                CardDef tpl = null;
                foreach (var candidate in deps.allCards()) if (candidate.name == hdN.Groups[2].Value) { tpl = candidate; break; }
                int count = hdN.Groups[1].Success ? int.Parse(hdN.Groups[1].Value) : 1;
                if (tpl != null)
                {
                    for (int i = 0; i < count; i++) deps.addTempCard(tpl);
                    deps.log("[[icon:cards]] <b>" + esc(card.name) + "</b>：将 " + count + " 张【" + esc(tpl.name) + "】置入手牌（战斗内临时卡，战后消散）", "loot");
                }
                else
                {
                    deps.log("[[icon:question]] 【" + esc(card.name) + "】找不到可置入手牌的卡牌「" + esc(hdN.Groups[2].Value) + "」（占位）", "warn");
                }
                did = true;
            }
            var em = EnergyRe.Match(desc);
            if (em.Success)
            {
                int current = deps.addEnergy(int.Parse(em.Groups[1].Value));
                deps.log("[[icon:bolt]] 获得 " + em.Groups[1].Value + " 点能量（当前 " + current + "）", "sys");
                did = true;
            }
            var cm = EnergyCapRe.Match(desc);
            if (cm.Success)
            {
                int currentMax = deps.addEnergyCap(int.Parse(cm.Groups[1].Value));
                deps.log("[[icon:bolt]] 本场战斗能量上限 +" + cm.Groups[1].Value + "（每回合 " + currentMax + " 费）", "sys");
                did = true;
            }
            return new EffectResult { did = did, drawn = drawn, healed = healed, armored = armored };
        }

        private Combatant FirstAliveOrNull()
        {
            var alive = deps.getAlive();
            return alive.Count > 0 ? alive[0] : null;
        }
    }
}
