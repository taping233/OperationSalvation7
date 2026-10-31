using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        EventProgress PendingCommission=>State.nodeRewards.Values.Select(r=>r.eventProgress).FirstOrDefault(p=>p?.commissionPending==true&&!p.commissionUsed);
        List<int> CommissionEligible(List<ShopOfferReceipt> stock)=>stock.Select((slot,index)=>(slot,index)).Where(e=>e.slot!=null&&!e.slot.empty&&!e.slot.sold&&!e.slot.free&&e.slot.price>0
            &&e.slot.shaReplenish==null&&!e.slot.mystery&&e.slot.cardId!=CardLibrary.SHA.id&&CardLibrary.FindById(e.slot.cardId)!=null).Select(e=>e.index).ToList();
        void BindEventCommission(List<ShopOfferReceipt> stock)
        {
            var p=PendingCommission;if(p==null||stock==null||CommissionEligible(stock).Count<2)return;
            if(p.commissionShopKey==CurrentNodeId&&p.commissionDice.Count>0)return;
            p.commissionShopKey=CurrentNodeId;p.commissionSlots.Clear();p.commissionDice.Clear();ReserveCommissionDie(p,stock);
        }
        void ReserveCommissionDie(EventProgress p,List<ShopOfferReceipt> stock)
        {
            var indices=CommissionEligible(stock).Where(index=>!p.commissionSlots.Contains(index)).ToList();
            if(indices.Count==0)throw new InvalidOperationException("没有符合条件的免单商品，凭据仍保留");
            if(indices.Count>6){var selected=new List<int>();while(selected.Count<6){int at=(int)(Rng.Random("event")*indices.Count);selected.Add(indices[at]);indices.RemoveAt(at);}indices=selected;}
            var outcomes=indices.Select(index=>RuleValue.Obj("slot",index,"label","第 "+(index+1)+" 格 · "+CardLibrary.FindById(stock[index].cardId)?.name)).ToList();
            p.commissionDice.Add(new EventDie{outcomes=outcomes,labels=outcomes.Select(o=>o.Text("label")).ToList()});
        }
        public EventOutcome GetCommissionOutcome()
        {
            var p=PendingCommission;if(p==null||p.commissionShopKey!=CurrentNodeId||p.commissionDice.Count==0)return null;
            var die=p.commissionDice.Last();var o=new EventOutcome{Title="接应凭据 · 第 "+(p.commissionSlots.Count+1)+" 格免单",Stage="dice",CanLeave=true,
                Message="亲手投两次骰子，选中的两格商品由运输员付款。初始攻击不参与。",DiceLabels=new List<string>(),PreviewCardIds=p.commissionSlots.Select(i=>CurrentNodeReceipt.shopStock[i].cardId).ToList()};
            for(int i=0;i<die.labels.Count;i++){
                int from=(int)Math.Ceiling(i*6d/die.labels.Count)+1,to=(int)Math.Ceiling((i+1)*6d/die.labels.Count);
                o.DiceLabels.Add((from==to?from.ToString():from+"～"+to)+" 点："+die.labels[i]);
            }
            if(die.result.HasValue){o.Message="掷出 "+die.result+" 点 · "+die.labels[(die.result.Value-1)*die.labels.Count/6];o.Choices.Add(new EventChoice{Label="确认免单货位",EffectKey="confirm",Tone="ok"});}
            return o;
        }
        EventOutcome CommissionMutation(Action<EventProgress,List<ShopOfferReceipt>> mutation)
        {
            bool ok=TryPersistMutation(()=>{
                var p=PendingCommission;var stock=CurrentNodeReceipt.shopStock;
                if(p==null||p.commissionShopKey!=CurrentNodeId||stock==null)throw new InvalidOperationException("当前凭据或商品已变化");mutation(p,stock);
            },out var reason);
            var o=GetCommissionOutcome();if(!ok){o??=new EventOutcome{Stage="dice",CanLeave=true};o.Message=reason;}return o;
        }
        public EventOutcome RollCommissionDice()=>CommissionMutation((p,stock)=>{
            var die=p.commissionDice.Last();if(!die.result.HasValue)die.result=1+(int)(Rng.Random("event")*6);
        });
        public EventOutcome ConfirmCommissionDice()=>CommissionMutation((p,stock)=>{
            var die=p.commissionDice.Last();if(!die.result.HasValue)throw new InvalidOperationException("请先投掷骰子");
            int index=die.outcomes[(die.result.Value-1)*die.outcomes.Count/6].Number("slot",-1);
            var eligible=CommissionEligible(stock);
            if(!eligible.Contains(index)||p.commissionSlots.Contains(index))throw new InvalidOperationException("原定免单货位已变化，优惠未应用，凭据保留");
            p.commissionSlots.Add(index);
            if(p.commissionSlots.Count<2){ReserveCommissionDie(p,stock);return;}
            if(!p.commissionSlots.All(eligible.Contains))throw new InvalidOperationException("原定免单商品已变化，凭据保留");
            foreach(int slot in p.commissionSlots){stock[slot].price=0;stock[slot].free=true;}
            p.commissionPending=false;p.commissionUsed=true;
        });
    }
}
