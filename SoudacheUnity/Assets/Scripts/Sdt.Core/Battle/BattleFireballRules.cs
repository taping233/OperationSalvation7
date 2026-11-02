using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed partial class BattleSession
    {
        private sealed class FireballBatch
        {
            public string token;
            public CardDef fireball;
            public BattleFoe target;
            public BattleFoe[] targets;
            public List<BattleFoe> unrewarded;
            public List<CardDef> rewardPool;
            public bool randomTarget,reward;
            public int index,total,perTarget;
        }
        private int fireballVictoryHolds;
        private bool fireballVictoryPending;

        private void CastFireballs(RuleValue operation,BattleFoe target)
        {
            var fireball=CardLibrary.FindById("tt3-fireball");
            int count=operation.Number("count",1);
            if(fireball==null||count<=0||over)return;
            var alive=Alive();if(alive.Count==0)return;
            var all=operation.Text("target")=="allEnemies"?alive.ToArray():null;
            bool reward=operation.Flag("rewardFireballOnKill");
            var batch=new FireballBatch{token=_battleToken,fireball=fireball,target=target,targets=all,
                randomTarget=operation.Text("target")=="randomEnemy",reward=reward,
                rewardPool=reward?CardLibrary.All().Where(card=>IsMove(card)&&(card.name??"").Contains("火球")).ToList():null,
                unrewarded=reward?alive:null,perTarget=count,total=all==null?count:all.Length*count};
            fireballVictoryHolds++;
            ContinueFireballs(batch);
        }
        private bool OwnsFireballs(FireballBatch batch)=>!over&&batch.token==_battleToken;
        private void ContinueFireballs(FireballBatch batch)
        {
            while(OwnsFireballs(batch)&&batch.index<batch.total)
            {
                var alive=Alive();if(alive.Count==0)break;
                var target=batch.targets!=null?batch.targets[batch.index/batch.perTarget]
                    :batch.randomTarget?alive[(int)(rng.Random("target")*alive.Count)]
                    :batch.target!=null&&!batch.target.dead?batch.target:alive[0];
                batch.index++;
                if(target.dead||target.hp<=0)continue;
                int continuationBase=ruleContinuations.Count;
                CastRuleCard(batch.fireball,target);
                if(!OwnsFireballs(batch))return;
                if(RuleInputPending){DeferRuleBatch(continuationBase,()=>CompleteFireballHit(batch));return;}
                if(!RewardFireballKills(batch))return;
            }
            FinishFireballs(batch);
        }
        private void CompleteFireballHit(FireballBatch batch)
        {if(OwnsFireballs(batch)&&RewardFireballKills(batch))ContinueFireballs(batch);}
        private bool RewardFireballKills(FireballBatch batch)
        {
            if(!batch.reward)return true;
            while(true)
            {
                var fallen=batch.unrewarded.FirstOrDefault(foe=>foe.dead||foe.hp<=0);if(fallen==null)return true;
                batch.unrewarded.Remove(fallen);
                var reward=RandomRuleCard(batch.rewardPool);if(reward==null)continue;
                int continuationBase=ruleContinuations.Count;AddTempCard(reward);
                if(!OwnsFireballs(batch))return false;
                if(RuleInputPending){DeferRuleBatch(continuationBase,()=>CompleteFireballHit(batch));return false;}
            }
        }
        private void FinishFireballs(FireballBatch batch)
        {
            if(!OwnsFireballs(batch))return;
            fireballVictoryHolds--;
            if(fireballVictoryHolds==0&&fireballVictoryPending)
            {fireballVictoryPending=false;if(Alive().Count==0)Finish(true);}
        }
    }
}
