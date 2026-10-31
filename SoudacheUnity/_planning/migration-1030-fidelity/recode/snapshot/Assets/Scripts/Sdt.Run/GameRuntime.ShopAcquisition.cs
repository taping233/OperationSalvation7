// Shop acquisition only reserves a source bonus; the shared node chest commands own its delivery.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        const string ShopGiftSource="阿猫的礼物 · 神秘货箱附赠";
        public bool HasPendingShopAcquisition
        {
            get{var r=CurrentNodeReceipt;return !r.completed&&r.chestQueue!=null&&r.chestIndex<r.chestQueue.Count&&r.chestQueue.Any(box=>box.source==ShopGiftSource);}
        }
        // Only a mystery offer invokes this source hook, inside the purchase TryPersistMutation.
        // The purchase retains its card, coins, shelf and reserved bonus if checkpoint I/O fails.
        // Delivery waits for a successful save; retrying that save must never reserve a second gift.
        public void ReserveShopAcquisition(CardDef card)
        {
            if(card?.id!="tt2-apollo")return;
            if(!State.runActive||State.battleActive||CurLayer.logical[State.trackPos].type!="shop")throw new InvalidOperationException("当前地点没有营业中的商店");
            var pool=CardLibrary.All().Where(candidate=>candidate.id!=card.id&&CardLibrary.IsRandomObtainable(candidate)).ToArray();if(pool.Length==0)return;
            var extra=pool[(int)(Rng.Random("loot","reward")*pool.Length)];var receipt=CurrentNodeReceipt;
            receipt.chestQueue=receipt.chestQueue??new List<ChestVisitReceipt>();
            int previous=receipt.chestQueue.FindIndex(box=>!box.completed);
            receipt.chestQueue.Add(new ChestVisitReceipt{kind="small",title="领取附赠",source=ShopGiftSource,claimMode="all",cardIds=new List<string>{extra.id}});
            receipt.chestIndex=previous>=0?previous:receipt.chestQueue.Count-1;receipt.completed=false;
        }
    }
}
