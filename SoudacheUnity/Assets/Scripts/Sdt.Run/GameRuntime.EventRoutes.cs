using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        List<CardDef> EventPool(params string[] types)=>CardLibrary.All().Where(c=>types.Contains(c.type)&&CardLibrary.IsRandomObtainable(c)).ToList();
        bool EventOrdinary(CardDef c)=>new[]{"古朴","普通"}.Contains(c.rarity)&&string.IsNullOrEmpty(c.cls);
        List<CardDef> EventReplacementPool(CardDef card,bool trade=false)=>CardLibrary.All().Where(c=>c.id!=card.id&&c.name!=card.name&&c.type==card.type&&c.rarity==card.rarity
            &&(CardLibrary.IsRandomObtainable(c)||(!trade&&card.rarity=="职业"&&c.cls==State.myClass&&c.hero!=true))).ToList();
        bool EventContainer(CardDef card)=>card?.rules?.Get("equip")?.Get("container")!=null||card?.id==CardContainerCommands.PearlId||card?.id==CardContainerCommands.PouchId;
        List<OwnedCard> EventRecodeSources(string route)=>State.ownedCards.Where(e=>e.safe!=true&&!e.stored&&string.IsNullOrEmpty(e.pouchOf)&&e.card.hero!=true
            &&new[]{"武术","法术","装备"}.Contains(e.card.type)&&(route=="recodeTwo"||!EventContainer(e.card))
            &&(route!="trade"||e.card.type=="装备")&&EventReplacementPool(e.card,route=="trade").Count>0).ToList();
        void BeginEventRoute(EventProgress p,string route)
        {
            p.route=route;p.price=route=="purchase"?2:route=="recode"?3:0;
            if(new[]{"recodeTwo","recode","trade"}.Contains(route)){
                var sources=EventRecodeSources(route);if(sources.Count==0)throw new InvalidOperationException("没有可更换的随身招式或装备");
                p.cardIds=sources.Select(e=>e.card.id).ToList();p.cardKeys=sources.Select(e=>e.uid).ToList();p.need=route=="recodeTwo"?Math.Min(2,sources.Count):1;p.stage="sources";return;
            }
            var pool=route=="potions"?EventPool("道具").Where(c=>c.name.Contains("药水")).ToList()
                :route=="quartermaster"?EventPool("装备")
                :route=="arrows"?EventPool("武术","法术","装备").Where(c=>c.name.Contains("箭")&&c.rarity!="职业"&&string.IsNullOrEmpty(c.cls)).ToList()
                :route=="equipment"?EventPool("装备").Where(EventOrdinary).ToList()
                :EventPool("武术","法术").Where(EventOrdinary).ToList();
            var pools=route=="gamble"?new List<List<string>>{EventPool("装备").Select(c=>c.id).ToList(),EventPool("武术","法术").Select(c=>c.id).ToList(),EventPool("武术","法术").Select(c=>c.id).ToList()}
                :Enumerable.Repeat(pool.Select(c=>c.id).ToList(),Math.Min(new[]{"potions","quartermaster","arrows"}.Contains(route)?3:1,pool.Select(c=>c.name).Distinct().Count())).ToList();
            if(pools.Count==0||pools.Any(a=>a.Count==0))throw new InvalidOperationException("当前没有符合条件的候选");
            if(route=="quartermaster"){
                if(State.coins<3)throw new InvalidOperationException("军需转运费需要 3 币");State.coins-=3;
            }
            BeginEventDraw(p,pools,new List<RuleValue>{RuleValue.Obj("op","routeDrawn")},true);
        }
        void BeginEventDraw(EventProgress p,List<List<string>> pools,List<RuleValue> after,bool unique)
        {
            p.drawPools=pools;p.drawAfter=after;p.uniqueDraw=unique;p.drawn.Clear();p.dice.Clear();p.diceIndex=0;
            PrepareEventCardDie(p);
        }
        void PrepareEventCardDie(EventProgress p)
        {
            int index=p.drawn.Count;var pool=p.drawPools[index].Select(CardLibrary.FindById).Where(c=>c!=null&&(!p.uniqueDraw||!p.drawn.Select(CardLibrary.FindById).Any(old=>old.id==c.id||old.name==c.name))).ToList();
            if(pool.Count==0)throw new InvalidOperationException("没有符合条件的候选，结果保留");
            BeginEventDie(p,pool.Select(c=>RuleValue.Obj("label",c.name,"cardId",c.id)).ToList());
        }
        void BeginEventDie(EventProgress p,List<RuleValue> outcomes)
        {
            if(outcomes.Count==0)throw new InvalidOperationException("骰子没有可用结果");
            if(outcomes.Count>6){var remaining=outcomes.ToList();outcomes=new List<RuleValue>();while(outcomes.Count<6){int i=(int)(Rng.Random("event")*remaining.Count);outcomes.Add(remaining[i]);remaining.RemoveAt(i);}}
            p.dice.Add(new EventDie{labels=outcomes.Select(c=>c.Text("label")).ToList(),outcomes=outcomes});p.diceIndex=p.dice.Count-1;p.stage="dice";
        }
        public EventOutcome RollCurrentEventDice()
        {
            return EventMutation(()=>{
                var p=CurrentEvent;if(p==null||p.stage!="dice"||p.diceIndex>=p.dice.Count)throw new InvalidOperationException("当前没有待投骰子");
                var die=p.dice[p.diceIndex];if(!die.result.HasValue)die.result=1+(int)(Rng.Random("event")*6);
            });
        }
        void ContinueEventDie(EventProgress p)
        {
            if(p.stage!="dice"||p.diceIndex>=p.dice.Count)throw new InvalidOperationException("当前骰子不可确认");
            var die=p.dice[p.diceIndex];if(!die.result.HasValue)throw new InvalidOperationException("请先投掷骰子");
            var result=die.outcomes[(die.result.Value-1)*die.outcomes.Count/6];p.message="掷出 "+die.result+" 点 · "+result.Text("label");
            if(result.Has("cardId")){
                p.drawn.Add(result.Text("cardId"));
                if(p.drawn.Count<p.drawPools.Count){PrepareEventCardDie(p);return;}
                var after=p.drawAfter;p.drawPools=null;p.drawAfter=null;
                if(after.Count==1&&after[0].Text("op")=="routeDrawn"){FinishEventRouteDraw(p);return;}
                var resolved=new List<RuleValue>();
                foreach(var op in after){
                    resolved.Add(op.Text("op")=="rewards"?RuleValue.Obj("op","rewards","ids",op.Items("ids").OfType<string>().Select(id=>id.StartsWith("$draw:")?p.drawn[int.Parse(id.Substring(6))]:id).Cast<object>().ToArray()):op);
                }
                p.pending.InsertRange(0,resolved);
                RunEventOperations(p);return;
            }
            if(result.Has("gambleWin")){
                if(result.Flag("gambleWin")){ReserveCurrentEventFixedRewards(p,p.drawn);p.route=null;}
                else p.stage="gamble";
                return;
            }
            p.pending.InsertRange(0,result.Operations("operations"));RunEventOperations(p);
        }
        void FinishEventRouteDraw(EventProgress p)
        {
            if(p.route=="gamble"){p.stage="gamble";p.cardIds=p.drawn.ToList();p.cardKeys=p.cardIds.Select((id,i)=>i.ToString()).ToList();return;}
            if(p.route=="recodeTwo"){p.stage="recodeConfirm";return;}
            SetEventCards(p,p.drawn,"selection");
        }
        void BeginGambleAttempt(EventProgress p)
        {
            if(p.stage!="gamble")throw new InvalidOperationException("当前不是赌约判定步骤");
            if(State.coins<3)throw new InvalidOperationException("需要 3 币，尚未扣费");
            State.coins-=3;p.attempts++;
            BeginEventDie(p,p.attempts>=5?new List<RuleValue>{RuleValue.Obj("label","第 5 次保底：拿走三张卡","gambleWin",true)}
                :new List<RuleValue>{RuleValue.Obj("label","本次落空","gambleWin",false),RuleValue.Obj("label","拿走三张卡","gambleWin",true)});
        }
        string EventRestoreKey(PocketStack stack,int index)=>SaveJson.Stringify(new object[]{ActiveSlot,State.seed,CurrentNodeId,index,stack.count,stack.card.id,stack.card.variantKey??"",stack.card.name,stack.card.type});
        public EventOutcome SubmitEventSelection(List<string> keys)
        {
            return EventMutation(()=>{
                var p=CurrentEvent;if(p==null||p.settled||keys==null||keys.Count!=p.need||keys.Distinct().Count()!=keys.Count
                    ||p.stage!="restore"&&keys.Any(k=>!p.cardKeys.Contains(k)))throw new InvalidOperationException("请选择要求数量的当前卡牌");
                if(p.stage=="sources"){
                    var entries=keys.Select(uid=>State.ownedCards.FirstOrDefault(e=>e.uid==uid)).ToList();var eligible=EventRecodeSources(p.route);
                    if(entries.Any(e=>e==null||!eligible.Contains(e)))throw new InvalidOperationException("原卡已变化，请重新选择");
                    p.sources=entries.Select(EventSource.Of).ToList();
                    var pools=p.sources.Select(s=>EventReplacementPool(CardLibrary.FindById(s.id),p.route=="trade").Select(c=>c.id).ToList()).ToList();
                    if(p.route!="recodeTwo")pools=Enumerable.Repeat(pools[0],Math.Min(3,pools[0].Select(CardLibrary.FindById).Select(c=>c.name).Distinct().Count())).ToList();
                    BeginEventDraw(p,pools,new List<RuleValue>{RuleValue.Obj("op","routeDrawn")},p.route!="recodeTwo");return;
                }
                if(p.stage=="restore"){
                    PocketStack stack=null;
                    for(int i=0;i<State.usedPocket.Count;i++)
                    {
                        var candidate=State.usedPocket[i];
                        if(candidate.count>0&&FireRestorable(candidate.card)&&EventRestoreKey(candidate,i)==keys[0]){stack=candidate;break;}
                    }
                    if(stack==null||!GrantCard(stack.card))throw new InvalidOperationException("卡牌已变化或背包需腾位");
                    stack.count--;if(stack.count==0)State.usedPocket.Remove(stack);RunEventOperations(p);return;
                }
                if(p.stage!="selection"&&p.stage!="rewards")throw new InvalidOperationException("当前步骤无法领取卡牌");
                int index=p.cardKeys.IndexOf(keys[0]);if(p.taken.Contains(index))throw new InvalidOperationException("该奖励已领取");
                var card=CardLibrary.FindById(p.cardIds[index]);
                if(card.id=="tt2-apollo"&&p.stage=="selection"&&p.route=="quartermaster")
                {
                    // event-card-choice.js adopts the selected gift as a pending fixed reward before granting.
                    // The body and its acquisition bonus each retain their own receipt, even with a full bag.
                    p.taken.Add(index);p.stage="chests";
                    var receipt=CurrentNodeReceipt;receipt.chests=new[]{"small"};receipt.chestIndex=0;
                    receipt.chestQueue=new List<ChestVisitReceipt>{new ChestVisitReceipt{kind="small",title="领取奖励",source="转运军需",claimMode="all",cardIds=new List<string>{card.id}}};
                    return;
                }
                if(p.route=="recode"||p.route=="trade"){
                    ReplaceEventCards(p,new List<string>{card.id});
                }else{
                    if(State.coins<p.price)throw new InvalidOperationException("货币不足，尚未扣费");
                    if(!GrantCard(card))throw new InvalidOperationException("背包需腾位；候选与货币保留");State.coins-=p.price;
                }
                p.taken.Add(index);
                if(p.stage=="selection"||p.taken.Count==p.cardIds.Count)RunEventOperations(p);
            });
        }
        void ReplaceEventCards(EventProgress p,List<string> replacements)
        {
            if(State.coins<p.price)throw new InvalidOperationException("货币不足，原卡与候选保留");
            var entries=p.sources.Select(source=>State.ownedCards.FirstOrDefault(e=>source.Matches(e))).ToList();
            if(entries.Count!=replacements.Count||entries.Any(e=>e==null))throw new InvalidOperationException("原卡已变化，尚未更换或扣费");
            for(int i=0;i<entries.Count;i++){
                var card=CardLibrary.FindById(replacements[i]);if(!EventReplacementPool(entries[i].card,p.route=="trade").Any(c=>c.id==card?.id))throw new InvalidOperationException("候选条件已变化");
                entries[i].card=card.Clone();
            }
            if(!CardContainerCommands.Query(this).capacityOk)throw new InvalidOperationException("更换后背包放不下，原卡与货币保留");
            State.coins-=p.price;
        }
        void ConfirmEventRecode(EventProgress p)
        {
            if(p.stage!="recodeConfirm")throw new InvalidOperationException("当前没有待确认重编");
            ReplaceEventCards(p,p.drawn);RunEventOperations(p);
        }
    }
}
