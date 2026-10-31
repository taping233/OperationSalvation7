// Reward mutations use the existing save transaction; source acquisition extras stay pending in this box.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        void ReserveCurrentEventFixedRewards(EventProgress progress,IEnumerable<string> ids)
        {
            var cards=ids.Where(id=>CardLibrary.FindById(id)!=null).ToList();if(cards.Count==0)throw new InvalidOperationException("当前没有符合条件的奖励");
            var receipt=CurrentNodeReceipt;receipt.chests=new[]{"small"};receipt.chestIndex=0;
            receipt.chestQueue=new List<ChestVisitReceipt>{new ChestVisitReceipt{kind="small",title="领取奖励",source=CardLibrary.FindById(progress.eventId)?.name,claimMode="all",cardIds=cards}};
            progress.stage="chests";
        }
        ChestVisitReceipt CurrentChestReward
        {
            get{var r=CurrentNodeReceipt;if(r.chestQueue==null||r.chestIndex<0||r.chestIndex>=r.chestQueue.Count)return null;var box=r.chestQueue[r.chestIndex];box.taken=box.taken??new HashSet<int>();box.lost=box.lost??new HashSet<int>();
                if(box.claimMode=="one"&&box.taken.Any(i=>i<ChestChoiceCount(box)))for(int i=0;i<ChestChoiceCount(box);i++)if(!box.taken.Contains(i))box.lost.Add(i);
                return box;}
        }
        public ChestVisitReceipt CurrentChestReceipt=>CurrentChestReward;
        public bool TryPrepareCurrentRewardContinuation(string node,int? seed,out string reason)
        {
            reason=null;if(!State.runActive||State.battleActive||CurrentNodeId!=node||State.seed!=seed||State.closed.Contains(node)){reason="本次奖励已失效";return false;}
            var receipt=CurrentNodeReceipt;
            if(receipt.chestQueue!=null&&receipt.chestQueue.Any(box=>!box.completed)){reason="仍有待处理的奖励";return false;}
            return TryPersistMutation(()=>
            {
                // BattleBridge owns extra rewards, boss cleanup and the final node receipt.
                // A room may finish its current queue without committing that battle continuation early.
                var current=CurrentNodeReceipt;
                if(current.battleWon)State.Phase="modal";
                else{current.completed=true;State.settled.Add(node);State.Phase="idle";}
            },out reason);
        }
        bool OwnsCurrentChest(string node,int? seed)=>State.runActive&&!State.battleActive&&CurrentNodeId==node&&State.seed==seed&&!State.closed.Contains(node)&&CurrentChestReward!=null;
        static bool ChestPending(ChestVisitReceipt box,int i)=>!box.taken.Contains(i)&&!box.lost.Contains(i);
        static int ChestChoiceCount(ChestVisitReceipt box)=>box.choiceCount>0?box.choiceCount:box.cardIds.Count;
        public bool TryClaimCurrentChest(string node,int? seed,int index,out string reason)
        {
            reason=null;if(!OwnsCurrentChest(node,seed)){reason="本次奖励已失效";return false;}
            var box=CurrentChestReward;
            bool isChoice(int i)=>box.claimMode=="one"&&i<ChestChoiceCount(box);
            if(index>=box.cardIds.Count||index>=0&&!ChestPending(box,index)){reason="该奖励已经处理";return false;}
            if(index<0&&Enumerable.Range(0,box.cardIds.Count).Any(i=>isChoice(i)&&ChestPending(box,i))){reason="请从候选中选择 1 张";return false;}
            bool full=false;
            bool saved=TryPersistMutation(()=>
            {
                var current=CurrentChestReward;int count=current.cardIds.Count;
                for(int i=0;i<count;i++)
                {
                    if(index>=0&&index!=i||!ChestPending(current,i))continue;
                    var card=CardLibrary.FindById(current.cardIds[i]);
                    if(card==null||!GrantCurrentNodeReward(card,current)){full=true;continue;}
                    current.taken.Add(i);
                    if(current.claimMode=="one"&&i<ChestChoiceCount(current))for(int other=0;other<ChestChoiceCount(current);other++)if(other!=i&&!current.taken.Contains(other))current.lost.Add(other);
                }
                if(!string.IsNullOrEmpty(current.title)&&!current.coinsTaken){current.coinsTaken=true;if(current.coins>0)GainCoins(current.coins);}
                current.completed=!Enumerable.Range(0,current.cardIds.Count).Any(i=>ChestPending(current,i));
            },out reason);
            if(saved&&full)reason="当前放不下，整理背包后可重试；未领候选仍保留在这里。";
            return saved;
        }
        public bool TryCollectCurrentChestCoins(string node,int? seed,out string reason)
        {
            reason=null;if(!OwnsCurrentChest(node,seed)){reason="本次奖励已失效";return false;}
            return TryPersistMutation(()=>{var box=CurrentChestReward;if(!box.coinsTaken){box.coinsTaken=true;if(box.coins>0)GainCoins(box.coins);}},out reason);
        }
        public bool TryForfeitCurrentChest(string node,int? seed,out string reason)
        {
            reason=null;if(!OwnsCurrentChest(node,seed)){reason="本次奖励已失效";return false;}
            return TryPersistMutation(()=>{var box=CurrentChestReward;for(int i=0;i<box.cardIds.Count;i++)if(!box.taken.Contains(i))box.lost.Add(i);if(!box.coinsTaken){box.coinsTaken=true;if(box.coins>0)GainCoins(box.coins);}box.completed=true;},out reason);
        }
        bool GrantCurrentNodeReward(CardDef card,ChestVisitReceipt box)
        {
            if(!GrantCard(card))return false;
            var extra=RollAcquiredCardBonus(card);
            if(extra!=null){if(box.claimMode=="one"&&box.choiceCount<=0)box.choiceCount=box.cardIds.Count;box.cardIds.Add(extra.id);}
            return true;
        }
        CardDef RollAcquiredCardBonus(CardDef card)
        {
            if(card?.id!="tt2-apollo")return null;
            var pool=CardLibrary.All().Where(c=>CardLibrary.IsRandomObtainable(c)&&c.id!="tt2-apollo").ToArray();
            return pool.Length>0?pool[(int)(Rng.Random("loot","reward")*pool.Length)]:null;
        }
    }
}
