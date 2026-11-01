using System.Collections.Generic;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        readonly Queue<(string uid,BattleFoe target,string token)> drawnCasts=new Queue<(string,BattleFoe,string)>();
        int drawnCastHold;
        bool drainingDrawnCasts,drawnCastResumeQueued;
        void ClearDrawnCasts(){drawnCasts.Clear();drawnCastHold=0;drainingDrawnCasts=false;drawnCastResumeQueued=false;}
        void QueueDrawnCast(string uid,CardDef card,int continuationBase)
        {
            if(RequiresInfusion(card)&&InfuseOf(card)>0)return;
            hand.Remove(uid);
            drawnCasts.Enqueue((uid,foes.Find(foe=>!foe.dead),_battleToken));
            DrainDrawnCasts(continuationBase);
        }
        void DeferDrawnCasts(int continuationBase)
        {
            if(drawnCastResumeQueued)return;
            drawnCastResumeQueued=true;
            DeferRuleBatch(continuationBase,()=>{drawnCastResumeQueued=false;DrainDrawnCasts(ruleContinuations.Count);});
        }
        void DrainDrawnCasts(int continuationBase)
        {
            if(over||drawnCastHold>0||drainingDrawnCasts||drawnCasts.Count==0)return;
            if(RuleInputPending){DeferDrawnCasts(continuationBase);return;}
            string token=_battleToken;drainingDrawnCasts=true;
            try
            {
                while(!over&&_battleToken==token&&drawnCasts.Count>0)
                {
                    var next=drawnCasts.Dequeue();if(next.token!=token)continue;
                    // Held physical copies are not material candidates; the existing executor owns payment/movement.
                    if(!hand.Contains(next.uid))hand.Add(next.uid);
                    int childBase=ruleContinuations.Count;
                    CastRuleHandCard(next.uid,next.target,false);
                    if(over||_battleToken!=token)return;
                    if(RuleInputPending){DeferDrawnCasts(childBase);return;}
                }
            }
            finally{if(_battleToken==token)drainingDrawnCasts=false;}
        }
    }
}
