using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        readonly Dictionary<BattleFoe,int> bossTriggeredTurns=new Dictionary<BattleFoe,int>();
        void ApplyCurrentBossOpening()
        {
            var blocker=foes.FirstOrDefault(f=>!f.dead&&f.behavior=="mysterious_blocker");if(blocker==null)return;
            foreach(string key in new[]{"bleed","poison","abreak","healban"}){
                CombatResolver.AddCurse(pstat,key,1);
                foreach(var unit in foes.Cast<Combatant>().Concat(ruleAllies).Where(f=>!f.dead))CombatResolver.AddCurse(unit,key,1);
            }
        }
        void ApplyCurrentBossTurnStart()
        {
            foreach(var foe in foes.ToArray()){
                if(foe.dead||foe.hp<=0||foe.status.silence>0||bossTriggeredTurns.TryGetValue(foe,out int last)&&last==turn)continue;
                if(foe.behavior=="mutation_mother"&&new[]{2,4,6}.Contains(turn)){
                    bossTriggeredTurns[foe]=turn;
                    var pool=CurrentMapData.Encounters.Skip(1).Take(3).SelectMany(enc=>(enc.entries??Array.Empty<EncounterEntry>()).Select(e=>e.id)
                        .Concat(enc.guaranteedElite??Array.Empty<string>()).Concat((enc.groups??Array.Empty<EncounterGroup>()).SelectMany(group=>group.enemyIds??Array.Empty<string>()))).Distinct().ToList();
                    var id=pool[(int)(rng.Random("battle","enemy")*pool.Count)];var source=CurrentMapData.Monsters[id];double scale=opts.runMode=="elite"?1.35:1;
                    var summoned=new BattleFoe{id=id,name=source.name,hp=(int)Math.Round(source.hp*scale,MidpointRounding.AwayFromZero),maxHp=(int)Math.Round(source.hp*scale,MidpointRounding.AwayFromZero),
                        atk=(int)Math.Round((source.atk>0?source.atk:2)*scale,MidpointRounding.AwayFromZero),behavior=source.behavior,elite=source.elite,eliteSkill=source.eliteSkill,desc=source.desc,damageCap=source.damageCap,evenAttack=source.evenAttack};
                    if(summoned.eliteSkill=="firstTurnStealth")summoned.status.stealth=1;
                    foreach(var existing in Alive()){
                        if(existing.eliteSkill=="attackAura")summoned.atk+=2;
                        if(summoned.eliteSkill=="attackAura")existing.atk+=2;
                    }
                    foes.Add(summoned);summoned.intent=IntentFor(summoned,turn);
                    G.Log("畸变母体召唤了【"+summoned.name+"】","warn");
                }
                if(foe.behavior=="necromancer"&&new[]{3,6,9}.Contains(turn)){
                    bossTriggeredTurns[foe]=turn;int count=Math.Min(2,drawPile.Count);var torn=drawPile.GetRange(drawPile.Count-count,count);drawPile.RemoveRange(drawPile.Count-count,count);grave.AddRange(torn);
                    foe.status.necroticExposure=Math.Max(1,foe.status.necroticExposure)*2;
                }
            }
        }
        void CleanseCurrentBlocker(BattleFoe foe)
        {
            if(foe.dead||foe.hp<=0||foe.behavior!="mysterious_blocker"||foe.status.silence>0)return;
            var active=CombatResolver.Curses.Where(key=>foe.status.Get(key)>0).ToList();if(active.Count==0)return;
            string key=active[(int)(rng.Random("battle","enemy")*active.Count)];foe.status.Set(key,foe.status.Get(key)-1);
            if(foe.status.atkDown==0)foreach(var reduction in attackReductions.Where(r=>r.foe==foe).ToArray()){foe.atk+=reduction.amount;attackReductions.Remove(reduction);}
        }
    }
}
