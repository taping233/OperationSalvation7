using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed class EndTurnContextSnapshot
    {
        public int DeathSave;
        public bool ExtraTurn, TimeRune;
    }
    public sealed class BattleTurnForecastResult
    {
        public int Damage, HpAfter;
        public bool Lethal;
        public string Note = "按当前状态估算；回合末触发、随从攻击与随机效果可能改变结果。";
    }
    public sealed partial class BattleSnapshot
    {
        public string Phase, BattleToken;
        public bool TurnEndPending;
        public IReadOnlyList<string> ConsumedPile;
        public EndTurnContextSnapshot EndTurnContext;
        public BattleTurnForecastResult Forecast;
    }
    public sealed class EnemyActionPlan
    {
        public readonly string Kind, Skip;
        public readonly int Hits;
        public bool CanAttack => Skip == null;
        public EnemyActionPlan(string kind, string skip, int hits) { Kind=kind;Skip=skip;Hits=hits; }
    }
    /// <summary>One source decision for forecasts, intent and live enemy actions.</summary>
    public static class BattleEnemyPlan
    {
        static EnemyActionPlan Build(string behavior,string affix,bool dead,bool stunned,bool evenAttack,bool noFirstAttack,int freeze,int round)
        {
            int turn=round==0?1:round;
            string kind=!string.IsNullOrEmpty(behavior)?behavior:affix=="grow"?"general":affix=="frenzy"?"orc_boss":affix=="aegis"?"element_boss":"strike";
            string skip=dead?"dead":stunned?"stunned":evenAttack&&turn%2==1?"oddRound":noFirstAttack&&turn==1?"firstRound":freeze>0?"frozen":null;
            return new EnemyActionPlan(kind,skip,affix=="frenzy"?2:1);
        }
        public static EnemyActionPlan Build(FoeSnapshot foe,int round=1)
            => Build(foe.behavior,foe.affix,foe.dead,foe.stunned,foe.evenAttack,foe.noFirstAttack,
                foe.status!=null&&foe.status.TryGetValue("freeze",out var n)?n:0,round);
        public static EnemyActionPlan Build(BattleFoe foe,int round=1)
            => Build(foe.behavior,foe.affix,foe.dead,foe.stunned,foe.evenAttack,foe.noFirstAttack,foe.status?.freeze??0,round);
    }
    /// <summary>Direct translation of battle.turn-forecast.js; copies all simulated state.</summary>
    public static class BattleTurnForecast
    {
        static Combatant Copy(int hp, IReadOnlyDictionary<string,int> status, DefenseState defense)
        {
            var result = new Combatant { hp = hp, defense = new DefenseState {
                Armor = defense?.Armor ?? 0, Shield = defense?.Shield ?? 0, Guard = defense?.Guard ?? false } };
            if (status != null) foreach (var entry in status) result.status.Set(entry.Key,entry.Value);
            return result;
        }
        public static BattleTurnForecastResult Estimate(BattleSnapshot snapshot)
        {
            int hp = snapshot.player?.hp ?? 0;
            var result = new BattleTurnForecastResult { HpAfter = hp };
            if (snapshot.EndTurnContext?.ExtraTurn == true) return result;
            var player = Copy(hp, snapshot.pstat?.status, snapshot.pdef);
            var allies = (snapshot.Allies ?? Array.Empty<FoeSnapshot>()).Where(a=>!a.dead && !a.Statless && a.hp>0)
                .Select(a=>Copy(a.hp,a.status,a.defense)).ToList();
            int saves = snapshot.EndTurnContext?.DeathSave ?? 0;
            for (int i=0;i<(snapshot.EndTurnContext?.TimeRune==true?2:1);i++)
                result.Damage += CombatResolver.TickPoison(player)?.dealt ?? 0;
            foreach (var foe in snapshot.foes ?? Array.Empty<FoeSnapshot>())
            {
                if (player.hp<=0) break;
                var plan=BattleEnemyPlan.Build(foe,snapshot.turn);
                if (!plan.CanAttack) continue;
                for (int i=0;i<plan.Hits;i++)
                {
                    if (player.hp<=0 || CombatResolver.IsStealthed(player)) break;
                    var ally=allies.FirstOrDefault(a=>a.hp>0 && !CombatResolver.IsStealthed(a));
                    int before=player.hp;
                    var hit=CombatResolver.DealDamage(new Combatant { atk=foe.atk },ally??player,0,CombatResolver.ATTACK);
                    if (ally!=null) continue;
                    if (hit.dealt>0 && before-hit.dealt<=0 && saves>0)
                    { saves--; player.hp=before; player.status.immune=1; }
                    else result.Damage+=hit.dealt;
                }
            }
            result.HpAfter=Math.Max(0,player.hp);result.Lethal=hp>0 && player.hp<=0;
            return result;
        }
    }
}
