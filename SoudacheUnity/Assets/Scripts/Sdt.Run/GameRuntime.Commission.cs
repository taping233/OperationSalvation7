using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        EventProgress PendingCommission=>State.nodeRewards.Values.Select(r=>r.eventProgress).FirstOrDefault(p=>p!=null&&(p.commissionPending&&!p.commissionUsed
            ||p.commissionUsed&&!p.commissionAnnounced&&(string.IsNullOrEmpty(p.commissionShopKey)||p.commissionShopKey==CurrentNodeId)));
        List<int> CommissionEligible(List<ShopOfferReceipt> stock)=>stock.Select((slot,index)=>(slot,index)).Where(e=>e.slot!=null&&!e.slot.empty&&!e.slot.sold&&!e.slot.free&&e.slot.price>0
            &&e.slot.shaReplenish==null&&e.slot.cardId!=CardLibrary.SHA.id&&CardLibrary.FindById(e.slot.cardId)!=null&&CardLibrary.FindById(e.slot.cardId).name!=CardLibrary.SHA.name).Select(e=>e.index).ToList();
        void BindEventCommission(List<ShopOfferReceipt> stock)
        {
            var p=PendingCommission;if(p==null||stock==null)return;
            if(p.commissionUsed){if(string.IsNullOrEmpty(p.commissionShopKey))p.commissionShopKey=CurrentNodeId;return;}
            if(CommissionEligible(stock).Count<2)return;
            if(p.commissionShopKey==CurrentNodeId)return;
            // A pending voucher may move stores. Its former slot/die drafts belong to that store only.
            // Binding the source start page does not sample dice; commissionStart does that later.
            p.commissionShopKey=CurrentNodeId;p.commissionSlots.Clear();p.commissionDice.Clear();p.commissionAnnounced=false;
        }
        void ReserveCommissionDie(EventProgress p,List<ShopOfferReceipt> stock)
        {
            var indices=CommissionEligible(stock).Where(index=>!p.commissionSlots.Contains(index)).ToList();
            if(indices.Count==0)throw new InvalidOperationException("没有符合条件的免单商品，凭据仍保留");
            if(indices.Count>6){var selected=new List<int>();while(selected.Count<6){int at=(int)(Rng.Random("event")*indices.Count);selected.Add(indices[at]);indices.RemoveAt(at);}indices=selected;}
            var outcomes=indices.Select(index=>RuleValue.Obj("slot",index,"label","第 "+(index+1)+" 格 · "+(stock[index].mystery?"神秘货箱":CardLibrary.FindById(stock[index].cardId)?.name))).ToList();
            p.commissionDice.Add(new EventDie{outcomes=outcomes,labels=outcomes.Select(o=>o.Text("label")).ToList()});
        }
        public EventDie CurrentCommissionDie
        {get{var p=PendingCommission;return p!=null&&p.commissionShopKey==CurrentNodeId&&!p.commissionUsed&&p.commissionSlots.Count<p.commissionDice.Count?p.commissionDice[p.commissionSlots.Count]:null;}}
        public IReadOnlyList<int> CurrentCommissionSlots=>PendingCommission?.commissionSlots;
        public bool IsCommissionFreeShopSlot(int index)=>State.nodeRewards.Values.Select(receipt=>receipt.eventProgress).Any(p=>p!=null&&p.commissionUsed&&p.commissionShopKey==CurrentNodeId&&p.commissionSlots.Contains(index));
        public bool TryPrepareShopCommission(out string reason)
        {
            reason=null;var p=PendingCommission;if(p==null)return true;
            if(p.commissionShopKey==CurrentNodeId)return true;
            return TryPersistMutation(()=>BindEventCommission(CurrentNodeReceipt.shopStock),out reason);
        }
        public EventOutcome GetCommissionOutcome(bool started=false)
        {
            var p=PendingCommission;var stock=CurrentNodeReceipt.shopStock;if(p==null||stock==null)return null;
            if(p.commissionShopKey!=CurrentNodeId&&(p.commissionUsed&&!string.IsNullOrEmpty(p.commissionShopKey)||!p.commissionUsed&&CommissionEligible(stock).Count<2))return null;
            if(p.commissionUsed)return new EventOutcome{Title="凭据已经兑付",Stage="commission-story",CanLeave=true,
                Message="行商接过接应凭据，核对了运输员的签名。他划掉两张价签，把货物往你面前推近。"};
            if(started&&p.commissionSlots.Count==2)return new EventOutcome{Title="接应凭据进度保留",Stage="commission-apply",CanLeave=true,
                Message="免费货位尚未保存，优惠未应用；原投骰结果保留，可重试。"};
            if(!started||CurrentCommissionDie==null)return new EventOutcome{Title="中断的接应 · 交付凭据",Stage="commission-start",CanLeave=true,
                Message="你把运输员的接应凭据递过柜台。行商扫了一眼签名，取出一枚骰子。"};
            var die=CurrentCommissionDie;var o=new EventOutcome{Title="接应凭据 · 第 "+(p.commissionSlots.Count+1)+" 格免单",Stage="dice",CanLeave=true,
                Message="当前节点可返回重进，投骰结果不变；前往下一节点后事件结束。",DiceLabels=new List<string>()};
            for(int i=0;i<die.labels.Count;i++){
                int from=(int)Math.Ceiling(i*6d/die.labels.Count)+1,to=(int)Math.Ceiling((i+1)*6d/die.labels.Count);
                o.DiceLabels.Add((from==to?from.ToString():from+"～"+to)+" 点："+die.labels[i]);
            }
            if(die.result.HasValue)o.Choices.Add(new EventChoice{Label="确认结果，继续",EffectKey="confirm",Tone="ok"});
            return o;
        }
        EventOutcome CommissionFailure(string message,string stage="commission-retry")
        {var outcome=GetCommissionOutcome(true)??new EventOutcome{CanLeave=true};outcome.Stage=stage;outcome.Message=message;return outcome;}
        EventOutcome CommissionMutation(Action<EventProgress,List<ShopOfferReceipt>> mutation,bool draft=false,bool rolling=false)
        {
            bool ok=TryPersistMutation(()=>{
                var p=PendingCommission;var stock=CurrentNodeReceipt.shopStock;
                if(p==null||p.commissionShopKey!=CurrentNodeId||stock==null)throw new InvalidOperationException("当前凭据或商品已变化");mutation(p,stock);
            },out var reason,draft,out var applied);
            return ok?GetCommissionOutcome(true):CommissionFailure(reason,rolling&&applied?"commission-dice-save-failed":"commission-retry");
        }
        public EventOutcome StartCommissionDice()
        {
            if(PendingCommission?.commissionSlots.Count==2)return ApplyCommissionDiscount();
            return CommissionMutation((p,stock)=>{if(!p.commissionUsed&&p.commissionDice.Count<=p.commissionSlots.Count)ReserveCommissionDie(p,stock);},true);
        }
        public EventOutcome RollCommissionDice()
        {
            return CommissionMutation((p,stock)=>{var die=CurrentCommissionDie;if(die==null)throw new InvalidOperationException("请先交付凭据");if(!die.result.HasValue)die.result=1+(int)(Rng.Random("event")*6);},true,true);
        }
        public EventOutcome ConfirmCommissionDice()
        {
            if(PendingCommission?.commissionSlots.Count==2)return ApplyCommissionDiscount();
            // eventDiceContinue checkpoints the fixed result before accepting the chosen slot.
            if(!TryPersistMutation(()=>{},out var reason))return CommissionFailure(reason,"commission-dice-save-failed");
            var p=PendingCommission;var stock=CurrentNodeReceipt.shopStock;
            if(p==null||p.commissionShopKey!=CurrentNodeId||stock==null)return CommissionFailure("当前凭据或商品已变化");
            var die=CurrentCommissionDie;if(die==null||!die.result.HasValue)return CommissionFailure("请先投掷骰子");
            int index=die.outcomes[(die.result.Value-1)*die.outcomes.Count/6].Number("slot",-1);
            var eligible=CommissionEligible(stock);
            if(!eligible.Contains(index)||p.commissionSlots.Contains(index))return CommissionFailure("原定免单货位已变化，优惠未应用，凭据保留");
            // This accepted selection is source draft state. Applying a discount rolls back
            // price/free/status on failure, while preserving both chosen slots and dice.
            p.commissionSlots.Add(index);
            return p.commissionSlots.Count<2?StartCommissionDice():ApplyCommissionDiscount();
        }
        EventOutcome ApplyCommissionDiscount()=>CommissionMutation((p,stock)=>{
            if(p.commissionUsed)return;
            var eligible=CommissionEligible(stock);
            if(p.commissionSlots.Count!=2||p.commissionSlots.Distinct().Count()!=2)throw new InvalidOperationException("原定免单货位已变化，凭据保留");
            if(!p.commissionSlots.All(eligible.Contains))throw new InvalidOperationException("原定免单商品已变化，凭据保留");
            foreach(int slot in p.commissionSlots){stock[slot].price=0;stock[slot].free=true;}
            p.commissionPending=false;p.commissionUsed=true;p.commissionAnnounced=false;
        });
        public bool TryAnnounceShopCommission(out string reason)=>TryPersistMutation(()=>{
            var p=PendingCommission;var stock=CurrentNodeReceipt.shopStock;
            if(p==null||p.commissionShopKey!=CurrentNodeId||!p.commissionUsed||p.commissionSlots.Count!=2||p.commissionSlots.Any(index=>index<0||index>=stock.Count))throw new InvalidOperationException("原定免费商品已变化，凭据保留，尚未领取任何商品。");
            p.commissionAnnounced=true;
        },out reason);
    }
}
