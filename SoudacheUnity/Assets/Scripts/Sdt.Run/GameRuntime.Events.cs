using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class EventChoice { public bool Disabled; }
    public sealed partial class EventOutcome
    {
        public string Title, Message, Stage;
        public bool CanLeave;
        public int Need;
        public List<string> DiceLabels, CardIds, CardKeys, PreviewCardIds;
        public IReadOnlyList<CardDef> CardFaces { get; internal set; }
        public List<EventChoice> Choices = new List<EventChoice>();
    }
    public sealed partial class GameRuntime
    {
        EventProgress CurrentEvent => CurrentNodeReceipt.eventProgress;
        IEnumerable<RuleValue> CurrentEventSpecs(string id)
        {
            var layers=EventDatabase.Find(id)?.Items("layers");
            return layers != null ? (layers[Math.Max(0,Math.Min(3,State.layerIdx))] as object[] ?? Array.Empty<object>()).OfType<RuleValue>() : Enumerable.Empty<RuleValue>();
        }
        public List<EventChoice> GetEventChoices(string cardId)
        {
            if(EventDatabase.Find(cardId)==null)return new List<EventChoice>();
            if(CurrentEvent==null)TryPersistMutation(()=>{
                CurrentNodeReceipt.eventCardId=cardId;CurrentNodeReceipt.eventProgress=new EventProgress{eventId=cardId};
            },out _);
            return CurrentEventSpecs(cardId).Select(spec=>{
                string detail=spec.Text("detail","");int health=spec.Number("healthCost");
                if(health>0)detail+="；失去 "+health+" 生命"+(State.hp<=health?"（会致死）":"");
                bool entryCost=spec.Operations("operations").Any(op=>op.Text("op")=="route"&&op.Text("kind")=="quartermaster");
                return new EventChoice{Label=spec.Text("label"),Detail=detail,Tone=spec.Text("tone"),EffectKey=spec.Text("key"),Disabled=entryCost&&State.coins<spec.Number("coinCost")};
            }).ToList();
        }
        public EventOutcome GetCurrentEventOutcome()
        {
            var p=CurrentEvent;if(p==null)return null;
            var o=new EventOutcome{Title=CardLibrary.FindById(p.eventId)?.name,Message=p.message,Stage=p.stage,CanLeave=true,Settled=p.settled,Need=p.need};
            if(p.stage=="choices")o.Choices=GetEventChoices(p.eventId);
            if(p.stage=="dice"&&p.diceIndex<p.dice.Count){
                var die=p.dice[p.diceIndex];o.DiceLabels=new List<string>();
                for(int i=0;i<die.labels.Count;i++){
                    int from=(int)Math.Ceiling(i*6d/die.labels.Count)+1,to=(int)Math.Ceiling((i+1)*6d/die.labels.Count);
                    o.DiceLabels.Add((from==to?from.ToString():from+"～"+to)+" 点："+die.labels[i]);
                }
                if(die.result.HasValue){o.Message="掷出 "+die.result+" 点 · "+die.labels[(die.result.Value-1)*die.labels.Count/6];o.Choices.Add(new EventChoice{Label="确认结果，继续",EffectKey="__dice_continue",Tone="ok"});}
            }
            if(new[]{"sources","selection","rewards","restore","gamble","recodeConfirm"}.Contains(p.stage)){
                if(p.stage=="restore")
                {
                    o.CardIds=new List<string>();o.CardKeys=new List<string>();var faces=new List<CardDef>();
                    for(int i=0;i<State.usedPocket.Count;i++)
                    {
                        var stack=State.usedPocket[i];if(stack.count<=0||!FireRestorable(stack.card))continue;
                        o.CardIds.Add(stack.card.id);o.CardKeys.Add(EventRestoreKey(stack,i));faces.Add(stack.card.Clone());
                    }
                    o.CardFaces=faces.AsReadOnly();
                }
                else
                {
                    o.CardIds=p.cardIds.Where((id,index)=>!p.taken.Contains(index)).ToList();
                    o.CardKeys=p.cardKeys.Where((id,index)=>!p.taken.Contains(index)).ToList();
                }
                if(p.stage=="gamble"){
                    o.PreviewCardIds=p.cardIds.ToList();o.CardIds=null;o.CardKeys=null;
                    o.Message="每次 3 币，1～3 点落空，4～6 点拿走全部；第 5 次保底。已尝试 "+p.attempts+" 次。";
                    o.Choices.Add(new EventChoice{Label="投入 3 币投骰"+(p.attempts==4?"（本次保底）":""),EffectKey="__gamble",Disabled=State.coins<3,Tone="ok"});
                }
                if(p.stage=="recodeConfirm"){
                    o.CardIds=null;o.CardKeys=null;
                    o.Message=string.Join("\n",p.sources.Select((source,i)=>source.name+" → "+CardLibrary.FindById(p.drawn[i])?.name));
                    o.Choices.Add(new EventChoice{Label="确认重编",EffectKey="__recode_confirm",Tone="ok"});
                }
                o.Choices.Add(new EventChoice{Label="放弃并离开",EffectKey="__abandon"});
            }
            if(p.stage=="battle"&&!p.settled){o.Stage="complete";o.Battle=EventBattleRequest(p);}
            if(p.stage=="chests"&&!p.settled){o.Stage="complete";o.Chests=CurrentNodeReceipt.chests?.ToList();}
            return o;
        }
        EventOutcome EventMutation(Action action)
        {
            bool saved=TryPersistMutation(action,out var reason);
            var outcome=GetCurrentEventOutcome()??new EventOutcome();
            if(!saved){outcome.Message=reason;outcome.Settled=false;}
            return outcome;
        }
        public EventOutcome ApplyCurrentEventChoice(string key)
        {
            if(CurrentEvent==null)return null;
            if(key=="__leave"){
                bool saved=TryPersistMutation(()=>{State.Phase="idle";},out var reason);var leave=GetCurrentEventOutcome();
                leave.Settled=saved;if(!saved)leave.Message=reason;return leave;
            }
            if(CurrentEvent.settled)return GetCurrentEventOutcome();
            return EventMutation(()=>{
                var p=CurrentEvent;
                if(key=="__abandon"){SettleEvent(p);return;}
                if(key=="__dice_continue"){ContinueEventDie(p);return;}
                if(key=="__gamble"){BeginGambleAttempt(p);return;}
                if(key=="__recode_confirm"){ConfirmEventRecode(p);return;}
                if(p.stage!="choices")throw new InvalidOperationException("本次选择已确定，请继续当前步骤");
                var spec=CurrentEventSpecs(p.eventId).FirstOrDefault(c=>c.Text("key")==key);
                if(spec==null)throw new InvalidOperationException("选项不可用");
                p.choiceKey=key;p.pending=spec.Operations("operations").ToList();RunEventOperations(p);
            });
        }
        void SettleEvent(EventProgress p)
        {
            p.stage="complete";p.settled=true;CurrentNodeReceipt.completed=true;State.settled.Add(CurrentNodeId);State.Phase="idle";
        }
        void RunEventOperations(EventProgress p)
        {
            while(p.pending.Count>0){
                var op=p.pending[0];p.pending.RemoveAt(0);int n=op.Number("n");
                switch(op.Text("op")){
                    case "coins":GainCoins(n);break;
                    case "heal":Heal(n);break;
                    case "fragment":State.fragments+=n;break;
                    case "maxHp":State.maxHp+=n;State.hp+=n;break;
                    case "sacrifice":State.hp=Math.Max(1,State.hp-n);break;
                    case "damage":Damage(n,op.Text("reason"));if(!State.runActive){p.stage="complete";p.settled=true;return;}break;
                    case "consumeCard":
                        var wood=State.ownedCards.FirstOrDefault(c=>c.card.id==op.Text("id")&&c.safe!=true&&!c.stored&&string.IsNullOrEmpty(c.pouchOf));
                        if(wood==null)throw new InvalidOperationException("随身背包中没有可用的木材卡");State.ownedCards.Remove(wood);break;
                    case "commission":p.commissionPending=true;break;
                    case "rewards":
                        var rewardIds=op.Items("ids").OfType<string>().ToList();
                        var selectedSpec=CurrentEventSpecs(p.eventId).FirstOrDefault(spec=>spec.Text("key")==p.choiceKey);
                        string capacityId=selectedSpec?.Text("capacityCard");
                        if(!string.IsNullOrEmpty(capacityId))
                        {
                            // Source capacityCard.claim runs on confirmation; resource and follow-up effect commit together.
                            foreach(var id in rewardIds)if(!GrantCard(CardLibrary.FindById(id)))throw new InvalidOperationException("当前背包装不下，选择与奖励保留，请整理背包后重试");
                            break;
                        }
                        ReserveCurrentEventFixedRewards(p,rewardIds);return;
                    case "chests":ReserveEventChests(p,op.Items("kinds").OfType<string>());return;
                    case "battle":
                        p.enemies=op.Operations("enemies").Select(e=>ScaledEnemy(new EnemyStats{id=e.Text("id"),name=e.Text("name"),hp=e.Number("hp"),atk=e.Number("atk"),behavior=e.Text("behavior")}))
                            .Select(e=>new MonsterDef{id=e.id,name=e.name,hp=e.hp,atk=e.atk,behavior=e.behavior}).ToList();
                        p.battleChests=p.eventId=="tt6-bandits"?new List<string>{"medium","medium"}:null;p.stage="battle";return;
                    case "restore":
                        if(!State.usedPocket.Any(s=>s.count>0&&FireRestorable(s.card)))break;
                        p.cardIds.Clear();p.cardKeys.Clear();p.stage="restore";p.need=1;return;
                    case "dice":BeginEventDie(p,op.Operations("branches").Select(b=>RuleValue.Obj("label",b.Text("label"),"operations",b.Items("operations"))).ToList());return;
                    case "drawCards":
                        BeginEventDraw(p,op.Items("pools").OfType<object[]>().Select(a=>a.OfType<string>().ToList()).ToList(),op.Operations("after").ToList(),op.Flag("unique"));return;
                    case "route":BeginEventRoute(p,op.Text("kind"));return;
                    default:throw new InvalidOperationException("事件指令尚未接入："+op.Text("op"));
                }
            }
            SettleEvent(p);
        }
        void SetEventCards(EventProgress p,IEnumerable<string> ids,string stage)
        {
            p.cardIds=ids.Where(id=>CardLibrary.FindById(id)!=null).ToList();p.cardKeys=p.cardIds.Select((id,i)=>i.ToString()).ToList();p.taken.Clear();p.stage=stage;p.need=1;
            if(p.cardIds.Count==0)throw new InvalidOperationException("当前没有符合条件的卡牌");
        }
        void ReserveEventChests(EventProgress p,IEnumerable<string> kinds)
        {
            var receipt=CurrentNodeReceipt;receipt.chests=kinds.ToArray();receipt.chestQueue=new List<ChestVisitReceipt>();receipt.chestIndex=0;
            foreach(var kind in receipt.chests){var contents=ChestLoot.RollContents(kind,Rng,cls:State.myClass,mode:State.mode,petEggChance:Base.PetEggDropChance);
                Base.RecordPetEggChestResult(contents.eggHit);
                receipt.chestQueue.Add(new ChestVisitReceipt{kind=kind,cardIds=contents.cards.Select(c=>c.id).ToList(),coins=contents.coins,claimMode=contents.claimMode,choiceCount=contents.choiceCount,eggHit=contents.eggHit});}
            p.stage="chests";
        }
        BattleRequest EventBattleRequest(EventProgress p)=>new BattleRequest{Layer=State.layerIdx,Name=CardLibrary.FindById(p.eventId)?.name,IsBoss=false,
            Foes=p.enemies.Select(e=>new EnemyStats{id=e.id,name=e.name,hp=e.hp,atk=e.atk,behavior=e.behavior}).ToList()};
        public bool StartEventBattle(BattleRequest request)
        {
            var p=CurrentEvent;if(CurrentNodeReceipt.completed||p==null||p.stage!="battle"||p.settled||State.battleActive)return false;
            if(TryPersistMutation(()=>{
                State.pendingEventLoot=p.battleChests==null?null:new PendingLoot{text="事件物资",chests=p.battleChests.ToArray()};p.battleStarted=true;State.Phase="modal";
            },out _)){Bus.Emit(new BattleRequested{Request=EventBattleRequest(p)});return State.battleActive||CurrentNodeReceipt.completed;}return false;
        }
        // Applied only when a new shop shelf is reserved; the same profile commit stores both sides.
        public void ApplyEventCommission(List<ShopOfferReceipt> stock)
        {
            BindEventCommission(stock);
        }
    }
}
