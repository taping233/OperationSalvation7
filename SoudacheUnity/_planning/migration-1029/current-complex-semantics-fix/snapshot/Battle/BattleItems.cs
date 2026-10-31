using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed class BattleItemSnapshot
    {
        public string uid,reason,targetSide;
        public CardDef card;
        public bool usable;
    }
    public sealed partial class BattleSnapshot
    {
        public IReadOnlyList<BattleItemSnapshot> Items;
    }
    public sealed partial class BattleSession
    {
        string resolvingItemUid;
        sealed class BattleItemJob {public CardDef card;public RuleValue operation;public int left,turn;public BattleFoe target;}
        readonly List<BattleItemJob> itemJobs=new List<BattleItemJob>();
        public string ItemTargetSide(CardDef card)
        {
            if(card?.type!="道具")return null;
            var operations=card.rules?.Get("bag")?.Operations("use").ToList();
            if(operations!=null)return operations.Any(op=>(op.Text("op")=="curse"||op.Text("op")=="damage")&&op.Text("target")!="self"&&op.Text("target")!="allEnemies")?"enemy":null;
            return (card.desc??"").Contains("附加冰冻")||(card.desc??"").Contains("固定伤害，附加流血")?"enemy":null;
        }
        List<string> BattleConsumedPile()=>played.Concat(consumed).Concat(discard).Concat(grave).Distinct().Where(uid=>!hand.Contains(uid)&&!drawPile.Contains(uid)&&uid!=resolvingItemUid).ToList();
        List<OwnedCard> AvailableBattleItems()
        {
            var unavailable=played.Concat(consumed).Concat(grave).Concat(discard).Concat(drawPile).ToHashSet();
            return (mode=="boss"?Enumerable.Empty<OwnedCard>():G.OwnedCards).Concat(granted).Where(e=>e.card?.type=="道具"&&e.safe!=true&&!unavailable.Contains(e.uid)&&e.uid!=resolvingItemUid).ToList();
        }
        string BattleItemReason(CardDef card)
        {
            if(card==null)return "未知道具";
            if(new[]{"cmtn6bge52qt","tt-crystal"}.Contains(card.id)&&BattleConsumedPile().Count==0)return "消耗牌堆是空的，没有可复原的卡牌";
            if(card.id=="tt-token-color")return "合成材料：请在背包里合成";
            if(mode=="boss"&&card.rules?.Get("bag")?.Operations("use").Any(op=>op.Text("op")=="flee")==true)return "首脑战中无法逃跑";
            if(ItemTargetSide(card)=="enemy"&&Alive().Count==0)return "场上没有敌人可用";
            return null;
        }
        IReadOnlyList<BattleItemSnapshot> BattleItemsState()=>G==null?Array.Empty<BattleItemSnapshot>():AvailableBattleItems().Select(e=>new BattleItemSnapshot{
            uid=e.uid,card=e.card,reason=BattleItemReason(e.card),usable=BattleItemReason(e.card)==null,targetSide=ItemTargetSide(e.card)}).ToList();
        public CommandResult UseItem(string uid,int targetIndex=-1)
        {
            if(over||busy||selectingDeck||RuleInputPending||infusing!=null)return CommandResult.No("请先完成当前战斗操作");
            var entry=AvailableBattleItems().FirstOrDefault(e=>e.uid==uid);string reason=BattleItemReason(entry?.card);if(reason!=null)return CommandResult.No(reason);
            var target=targetIndex>=0&&targetIndex<foes.Count&&!foes[targetIndex].dead?foes[targetIndex]:null;
            if(ItemTargetSide(entry.card)=="enemy"&&target==null){
                if(Alive().Count==1)target=Alive()[0];else{pendingTarget=new PendingTargetSnapshot{uid=uid,card=entry.card};pendingHint="请选择一名敌人使用道具";RequestRender();return CommandResult.No(pendingHint);}
            }
            target??=Alive().FirstOrDefault();pendingTarget=null;pendingHint="";
            hand.Remove(uid);if(!played.Contains(uid))played.Add(uid);resolvingItemUid=uid;
            try{
                var card=BattleItemExecutionCard(entry.card);BeginRuleCast(card,target,new List<string>());castContext.uid=uid;
                var bag=card.rules?.Get("bag");
                if(bag?.Has("use")==true)ResolveBattleBagOperations(card,bag.Operations("use"),target);
                else ResolveCard(card,target);
                ResolveRuleOutcome();ProcessDiscoverQueue();RequestRender();return CommandResult.Yes();
            }finally{resolvingItemUid=null;}
        }
        CardDef BattleItemExecutionCard(CardDef source)
        {
            var card=source.Clone();var rules=RuleValue.Obj();foreach(var pair in source.rules?.Values??new Dictionary<string,object>())rules.Values[pair.Key]=pair.Value;
            var battle=RuleValue.Obj();foreach(var pair in rules.Get("battle")?.Values??new Dictionary<string,object>())battle.Values[pair.Key]=pair.Value;
            battle.Values["ignoresSilence"]=true;rules.Values["battle"]=battle;card.rules=rules;return card;
        }
        void RestoreBattleConsumed(int count)
        {
            foreach(var uid in BattleConsumedPile().AsEnumerable().Reverse().Take(count).ToArray()){
                if(FindCard(uid)==null)continue;played.RemoveAll(s=>s==uid);consumed.RemoveAll(s=>s==uid);discard.RemoveAll(s=>s==uid);grave.RemoveAll(s=>s==uid);hand.Add(uid);
            }
            CheckRuleCombinations();
        }
        void ResolveBattleBagOperations(CardDef card,IEnumerable<RuleValue> operations,BattleFoe target)
        {
            foreach(var op in operations){
                int amount=op.Has("amount")?op.Number("amount"):op.Text("amountField")=="heal"?card.heal??0:op.Text("amountField")=="draw"?card.draw??0:op.Number("n",1);
                if(op.Has("schedule")){
                    var copy=RuleValue.Obj();foreach(var pair in op.Values)if(pair.Key!="schedule")copy.Values[pair.Key]=pair.Value;
                    itemJobs.Add(new BattleItemJob{card=card,operation=copy,target=target,left=op.Number("duration",1),turn=turn+1});continue;
                }
                switch(op.Text("op")){
                    case "flee":Finish(null);return;
                    case "heal":if(pstat.status.healban==0)G.Heal(amount);break;
                    case "restoreConsumed":RestoreBattleConsumed(amount);break;
                    case "energy":energy+=amount;break;
                    case "blessing":ApplyRuleOperation(card,op,target);break;
                    case "curse":foreach(var foe in op.Text("target")=="allEnemies"?Alive():op.Text("target")=="self"?new List<BattleFoe>():target!=null?new List<BattleFoe>{target}:new List<BattleFoe>())AddRuleStatus(foe,op.Text("curse"),op.Number("stacks",op.Number("duration",1)));break;
                    case "draw":DrawCards(op.Flag("perCurseKinds")?Math.Max(1,target==null?0:new[]{"bleed","poison","freeze","silence","abreak","healban","atkDown"}.Count(key=>target.status.Get(key)>0)):amount);break;
                    case "damage":
                        var range=op.Items("range");int damage=op.Has("amount")?op.Number("amount"):range.Length==2?Convert.ToInt32(range[0])+(int)(rng.Random("battle","generation")*(Convert.ToInt32(range[1])-Convert.ToInt32(range[0])+1)):0;
                        foreach(var foe in op.Text("target")=="allEnemies"?Alive():target!=null?new List<BattleFoe>{target}:new List<BattleFoe>())ApplyRuleRawHit(card,foe,damage,op.Text("dmgType","fixed"),false);break;
                    case "execute":
                        var cap=op.Get("cap");foreach(var foe in Alive().Where(f=>(cap?.Has("atk")!=true||f.atk<=cap.Number("atk"))&&(cap?.Flag("wounded")!=true||f.hp<f.maxHp)).Take(op.Number("count",1)).ToArray())ApplyRuleRawHit(card,foe,foe.hp+9999,"true",false);break;
                    case "acquire":
                        var pool=op.Get("pool");if(pool?.Text("kind")=="classAbility"||pool?.Text("kind")=="legendary"){
                            var available=pool.Text("kind")=="classAbility"?CardLibrary.All().Where(c=>c.type=="能力卡"&&c.cls==G.MyClass).ToList():RulePool(pool);
                            if(available.Count>0){var chosen=available[(int)(rng.Random("battle","generation")*available.Count)];AddTempCard(chosen);}break;
                        }
                        StartStructuredDiscover(card,op,target);break;
                    case "discover":StartStructuredDiscover(card,op,target);break;
                    default:ApplyRuleOperation(card,op,target);break;
                }
                if(over)return;
            }
        }
        void AdvanceBattleItems()
        {
            foreach(var job in itemJobs.Where(job=>job.turn<=turn).ToArray()){
                itemJobs.Remove(job);ResolveBattleBagOperations(job.card,new[]{job.operation},job.target?.dead==true?Alive().FirstOrDefault():job.target);
                if(--job.left>0){job.turn=turn+1;itemJobs.Add(job);}
            }
        }
    }
}
