// Current game.run.flow.js runInstant + openPickupPage claim/checkpoint boundary.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        NodeResult PrepareCurrentPickup(LogicalCell cell)
        {
            var receipt=CurrentNodeReceipt;
            if(!receipt.pickupPrepared)
            {
                receipt.pickupPrepared=true;
                if(cell.type=="coin")receipt.coins=Math.Max(1,(cell.n>0?cell.n:1)-1);
                else
                {
                    string id=cell.type=="wood"?"tt-wood":cell.type=="rations"?"tt-rations":"tt-key";
                    // Current map.json rations has no count field; source '(count || 1)' therefore yields one.
                    int count=cell.type=="wood"?Math.Max(1,cell.n):1;
                    receipt.chestQueue=new List<ChestVisitReceipt>{new ChestVisitReceipt{kind="small",title="领取奖励",source=cell.type=="wood"?"木材补给":cell.type=="rations"?"口粮补给":"钥匙补给",claimMode="all",cardIds=Enumerable.Repeat(id,count).ToList()}};
                    receipt.chestIndex=0;
                }
            }
            State.Phase="modal";
            int coins=Math.Max(1,(int)Math.Floor(receipt.coins*(ModeCfg.coinMul>0?ModeCfg.coinMul:1)+.5));
            return new NodeResult{Kind=KindOf(cell.type),KindRaw=cell.type,Instant=new InstantInfo{CoinN=receipt.coins,GainText=cell.type=="coin"?"+"+coins+" 币":null}};
        }
        bool OwnsCurrentPickup(string nodeId)=>State.runActive&&!State.battleActive&&CurrentNodeId==nodeId&&!State.closed.Contains(nodeId)&&CurrentNodeReceipt.type=="coin"&&CurrentNodeReceipt.pickupPrepared;
        public bool TryClaimCurrentPickup(string nodeId,out string reason)
        {
            reason=null;if(!OwnsCurrentPickup(nodeId)){reason="本次拾取已失效";return false;}
            var receipt=CurrentNodeReceipt;
            if(!receipt.pickupClaimed)
            {
                // Source settle('claim') runs once before its save checkpoint. A failed save keeps this memory state.
                receipt.pickupClaimed=true;GainCoins(receipt.coins);receipt.completed=true;State.settled.Add(nodeId);
            }
            if(receipt.pickupSaved)return true;
            return TryPersistMutation(()=>CurrentNodeReceipt.pickupSaved=true,out reason);
        }
        public bool TryLeaveCurrentPickup(string nodeId,out string reason)
        {
            reason=null;if(!OwnsCurrentPickup(nodeId)){reason="本次拾取已失效";return false;}
            if(CurrentNodeReceipt.pickupClaimed&&!TryClaimCurrentPickup(nodeId,out reason))return false;
            // The claim checkpoint already contains the coins, settled receipt and
            // RNG. Phase is runtime-only; LoadRun enters idle without another write.
            if(CurrentNodeReceipt.pickupClaimed&&CurrentNodeReceipt.pickupSaved){State.Phase="idle";return true;}
            return TryPersistMutation(()=>State.Phase="idle",out reason);
        }
    }
}
