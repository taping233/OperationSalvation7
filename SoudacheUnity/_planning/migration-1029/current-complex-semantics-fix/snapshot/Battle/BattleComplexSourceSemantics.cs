// Current choice-semantic-operations, infusion domain and recruited-ally lifecycle.
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        private bool HasRuleInfusionWaiver(CardDef card) => card != null &&
            (card.noInfuse || persistentRules.Contains("allSpellsInfused") && IsMove(card));

        private void ApplyRandomRuleBlessing(RuleValue operation, List<string> choices)
        {
            var targets = new List<(Combatant unit, DefenseState defense)> { (pstat, pdef) };
            if (operation.Text("target") == "allAllies")
                targets.AddRange(ruleAllies.Where(ally => !ally.dead && !ally.statless && ally.hp > 0 && ally.status != null)
                    .Select(ally => ((Combatant)ally, ally.defense ?? (ally.defense = new DefenseState()))));
            foreach (var entry in targets)
            {
                var fresh = choices.Where(key => key == "purify" ? CombatResolver.HasCurse(entry.unit)
                    : key == "armor" ? !(entry.defense.Armor > 0) : !(entry.unit.status.Get(key) > 0)).ToList();
                var pool = operation.Flag("preferMissing") && fresh.Count > 0 ? fresh : choices;
                string key = pool[(int)(rng.Random("battle", "generation") * pool.Count)];
                if (key == "purify") CombatResolver.Purify(entry.unit);
                else if (key == "armor") entry.defense.Armor += 5;
                else CombatResolver.AddBlessing(entry.unit, key, 1);
            }
        }

        private RuleAlly CloneRecruitedAlly(BattleFoe source)
        {
            var ally = new RuleAlly { name = source.name, hp = source.hp, maxHp = source.maxHp,
                atk = source.atk, spellPower = source.spellPower, behavior = source.behavior, damageCap = source.damageCap,
                defense = new DefenseState { Armor = source.defense.Armor, Shield = source.defense.Shield, Guard = source.defense.Guard } };
            foreach (var key in CombatResolver.Curses.Concat(CombatResolver.Buffs)) ally.status.Set(key, source.status.Get(key));
            ally.status.necroticExposure = source.status.necroticExposure;
            // The source deep clone retains each outstanding attack-restoration entry.
            foreach (var item in stolenAttackReturns.Where(item => ReferenceEquals(item.foe, source)).ToArray())
                stolenAttackReturns.Add((ally, item.amount, item.turn));
            foreach (var item in attackReductions.Where(item => ReferenceEquals(item.foe, source)).ToArray())
                attackReductions.Add((ally, item.amount));
            return ally;
        }

        private void ResolveRuleAllyPoison()
        {
            foreach (var ally in ruleAllies.Where(ally => !ally.dead && !ally.statless).ToArray())
            {
                int before = ally.hp; var defenseBefore = CopyDefense(ally.defense);
                var result = ally.hp > 0 ? CombatResolver.TickPoison(ally) : null;
                if (result?.dealt > 0)
                {
                    floats.Add(new BattleFloat { unit = "ally:" + ruleAllies.IndexOf(ally), text = "-" + result.dealt, cls = "hurt" });
                    G.Log("[[icon:skull]] 中毒结算：<b>" + Esc(ally.name) + "</b> 受到 " + result.dealt + " 点固定伤害", "warn");
                }
                if (ally.hp <= 0) { ally.dead = true; G.Log("[[icon:skull]] <b>" + Esc(ally.name) + "</b> 毒发阵亡", "warn"); }
                if (before != ally.hp)
                    EmitPresentation(new BattleActorCue { Kind = "hit", AllyIndex = ruleAllies.IndexOf(ally), HpBefore = before,
                        HpAfter = ally.hp, MaxHp = ally.maxHp, DefenseBefore = defenseBefore,
                        DefenseAfter = CopyDefense(ally.defense), Dead = ally.dead });
            }
        }

        private void TickRuleAllyDurations()
        {
            foreach (var ally in ruleAllies)
                if (!ally.dead && !ally.statless) TickDurationsLog(ally.status, ally.name);
        }
    }
}
