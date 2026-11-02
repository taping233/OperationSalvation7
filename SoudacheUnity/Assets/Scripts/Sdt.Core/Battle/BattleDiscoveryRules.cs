using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        private sealed partial class RuleContext { public bool automatic; }
        private int turnSpellPowerBonus;

        private int DiscoveryCount(RuleValue operation)
        {
            if(operation.Has("n"))return operation.Number("n");
            return operation.Number("count",1)+operation.Number("extraPerSpellPower")*Math.Max(0,G.SpellPower+pstat.status.spellUp);
        }
        private void ClearTurnSpellPower()
        {
            if(turnSpellPowerBonus!=0&&pstat?.status!=null)
                pstat.status.spellUp=Math.Max(0,pstat.status.spellUp-turnSpellPowerBonus);
            turnSpellPowerBonus=0;
        }
        private void ResetDiscoveryRuleState()
        {turnSpellPowerBonus=0;fireballVictoryHolds=0;fireballVictoryPending=false;}

        // The chosen effect, its child inputs, the extra cast and the next discovery
        // settle in this order. The source's own discovered-price value stays intact.
        private void CompleteDiscoveryChoice(DiscoveringState state,CardDef chosen,Action apply,Action next=null)
        {
            if(state.choiceApplied)return;
            state.choiceApplied=true;
            int continuationBase=ruleContinuations.Count;
            var context=castContext;string token=_battleToken;
            apply();
            if(over||_battleToken!=token)return;
            Action finish=()=>
            {
                if(over||_battleToken!=token)return;
                var previous=castContext;castContext=context;
                try
                {
                    int castBase=ruleContinuations.Count;
                    CastUnchosenDiscovery(state.options,chosen);
                    if(over||_battleToken!=token)return;
                    Action resume=()=>{if(over||_battleToken!=token)return;lastAcquired=chosen;next?.Invoke();};
                    if(RuleInputPending)DeferRuleBatch(castBase,resume);else resume();
                }
                finally{if(_battleToken==token)castContext=previous;}
            };
            if(RuleInputPending)DeferRuleBatch(continuationBase,finish);else finish();
        }
        private void CastUnchosenDiscovery(IReadOnlyList<CardDef> options,CardDef chosen)
        {
            if(over||!IsMove(chosen)||!persistentRules.Contains("discoveryCastUnchosen"))return;
            var available=options.Where(option=>!ReferenceEquals(option,chosen)&&IsMove(option)).ToList();
            if(available.Count==0)return;
            var alive=Alive();if(alive.Count==0)return;
            var card=available.Count==1?available[0]:available[(int)(rng.Random("generation")*available.Count)];
            var target=BattleRules.TargetSideFor(card)=="enemy"&&!BattleRules.IsAreaEffect(card)
                ?alive.Count==1?alive[0]:alive[(int)(rng.Random("target")*alive.Count)]:null;
            CastRuleCard(card,target);
        }
    }
}
