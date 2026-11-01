// Uses the current structured bag rules and the same replacement capacity as card containers.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public static class BagItemCommands
    {
        public static bool TryCraftTokens(GameRuntime game,string kind,out string reason)=>game.TryPersistMutation(()=>{
            if(!game.State.runActive||game.State.battleActive)throw new InvalidOperationException("当前无法合成通行证");
            if(kind!="gold"&&kind!="fragments")throw new InvalidOperationException("通行证配方无效");
            string input=kind=="gold"?"tt-token-gold":"tt-token-color",output=kind=="gold"?"tt-token-color":"cmtmvq6ss84l";
            int count=kind=="gold"?3:1,fragments=kind=="gold"?0:2;
            if(game.State.fragments<fragments)throw new InvalidOperationException("需要2枚通行证碎片");
            var sources=game.State.ownedCards.Where(o=>o.card.id==input).Take(count).ToList();
            if(sources.Count!=count)throw new InvalidOperationException(kind=="gold"?"需要3张员工通行证B":"需要1张员工通行证A");
            var card=CardLibrary.FindById(output);if(card==null)throw new InvalidOperationException("通行证目标卡不存在，材料已保留");
            if(!CardContainerCommands.CanReceive(game,card,game.State.ownedCards.Where(o=>!sources.Contains(o))))throw new InvalidOperationException("背包空间不足，材料与碎片已保留");
            foreach(var source in sources)game.State.ownedCards.Remove(source);game.State.fragments-=fragments;game.GrantCard(card);
        },out reason);
        static OwnedCard Source(GameRuntime game,string uid)
        {
            if(!game.State.runActive||game.State.battleActive)throw new InvalidOperationException("当前无法使用背包道具");
            var matches=game.State.ownedCards.Where(o=>o.uid==uid&&!o.stored&&o.safe!=true&&string.IsNullOrEmpty(o.pouchOf)).ToList();
            if(matches.Count!=1||matches[0].card?.type!="道具")throw new InvalidOperationException("该道具已不在普通背包");
            return matches[0];
        }
        static List<CardDef> Pool(GameRuntime game,string kind)=>CardLibrary.All().Where(c=>kind=="legendary"
            ? c.rarity=="传说"&&CardLibrary.IsRandomObtainable(c):c.cls==game.State.myClass&&c.type=="能力卡").ToList();
        static List<RuleValue> MapOperations(CardDef card)
        {
            if(card.id=="tt3-mystery-potion")return new List<RuleValue>();
            return (card.rules?.Get("bag")?.Operations("use")??Enumerable.Empty<RuleValue>()).Where(o=>
                o.Text("op")=="heal"||o.Text("op")=="restoreConsumed"||
                ((o.Text("op")=="acquire"||o.Text("op")=="discover")&&(o.Get("pool")?.Text("kind")=="legendary"||o.Get("pool")?.Text("kind")=="classAbility"))).ToList();
        }
        public static bool NeedsDiscovery(GameRuntime game,string uid)
        {
            var source=game.State.ownedCards.FirstOrDefault(o=>o.uid==uid);
            return source!=null&&MapOperations(source.card).Any(o=>o.Text("op")=="discover");
        }
        static string DiscoveryKind(CardDef card)
        {
            var op=MapOperations(card).FirstOrDefault(o=>o.Text("op")=="discover");
            if(op==null)throw new InvalidOperationException("该道具没有发现效果");
            return op.Get("pool").Text("kind");
        }
        static void ValidateDiscovery(BagDiscoveryReceipt receipt,string kind,Dictionary<string,CardDef> pool)
        {
            if(receipt==null||receipt.version!=1||receipt.poolKind!=kind||receipt.cardIds==null||receipt.cardIds.Count==0||receipt.cardIds.Count>3
                ||receipt.cardIds.Distinct().Count()!=receipt.cardIds.Count||receipt.cardIds.Any(id=>id==null||!pool.ContainsKey(id)))
                throw new InvalidOperationException("发现候选无效，原卡牌与候选已保留");
        }
        public static bool TryPrepareDiscovery(GameRuntime game,string uid,out List<CardDef> candidates,out string reason)
        {
            candidates=null;reason=null;
            try
            {
                var run=game.State;var source=Source(game,uid);string kind=DiscoveryKind(source.card);
                var pool=Pool(game,kind).Where(c=>!string.IsNullOrEmpty(c.id)).GroupBy(c=>c.id).Select(g=>g.First()).ToList();
                var byId=pool.ToDictionary(c=>c.id);
                if(pool.Count==0)throw new InvalidOperationException("当前没有可发现的卡牌");
                // Reopening a saved choice is read-only, while retaining the same
                // profile/slot read-error gate as the original write transaction.
                int slot=game.ActiveSlot??game.State.slot;
                if(game.Saves.HasSlotReadError(slot))throw new System.IO.IOException(game.Saves.ReadErrorForSlot(slot));
                if(source.bagDiscover!=null)
                {
                    ValidateDiscovery(source.bagDiscover,kind,byId);
                    candidates=source.bagDiscover.cardIds.Select(id=>byId[id]).ToList();return true;
                }
                bool ok=game.TryPersistMutation(()=>{
                    var receipt=new BagDiscoveryReceipt{poolKind=kind};
                    while(pool.Count>0&&receipt.cardIds.Count<3){int i=(int)(game.Rng.Random("loot","reward")*pool.Count);receipt.cardIds.Add(pool[i].id);pool.RemoveAt(i);}
                    source.bagDiscover=receipt;
                },out reason);
                if(ok)
                {
                    if(!ReferenceEquals(game.State,run)||!ReferenceEquals(Source(game,uid),source))throw new InvalidOperationException("本次发现来源已失效");
                    candidates=source.bagDiscover.cardIds.Select(id=>byId[id]).ToList();
                }
                return ok;
            }
            catch(Exception e){reason=e.Message;game.Bus.Emit(new ToastRequested{Text=reason,Tone="warn"});return false;}
        }
        public static bool TryChooseDiscovery(GameRuntime game,string uid,string cardId,out string reason)=>game.TryPersistMutation(()=>{
            var source=Source(game,uid);var receipt=source.bagDiscover;string kind=DiscoveryKind(source.card);
            var pool=Pool(game,kind).Where(c=>!string.IsNullOrEmpty(c.id)).GroupBy(c=>c.id).ToDictionary(g=>g.Key,g=>g.First());
            ValidateDiscovery(receipt,kind,pool);
            if(!receipt.cardIds.Contains(cardId))throw new InvalidOperationException("请选择已保存的发现候选");
            var card=pool[cardId];
            if(!CardContainerCommands.CanReceive(game,card,game.State.ownedCards.Where(o=>o!=source)))throw new InvalidOperationException("背包空间不足，请整理后重试；通行证与候选已保留");
            game.State.ownedCards.Remove(source);game.GrantCard(card);
        },out reason);

        public static bool TryUse(GameRuntime game,string uid,out string reason)=>game.TryPersistMutation(()=>{
            var source=Source(game,uid);var operations=MapOperations(source.card);
            if(operations.Any(o=>o.Text("op")=="discover"))throw new InvalidOperationException("请先打开发现候选并选择卡牌");
            if(operations.Count==0)throw new InvalidOperationException("该道具的效果需要在战斗中使用");
            bool consumed=false;
            void Consume(){if(consumed)return;game.State.ownedCards.Remove(source);consumed=true;}
            bool CanTake(CardDef c)=>CardContainerCommands.CanReceive(game,c,consumed?null:game.State.ownedCards.Where(o=>o!=source));
            foreach(var op in operations){
                switch(op.Text("op")){
                    case "heal":
                        int amount=op.Text("amountField")=="heal"?(source.card.heal??0):op.Number("amount");
                        if(amount>0&&game.State.hp<game.State.maxHp){Consume();game.Heal(amount);}break;
                    case "restoreConsumed":
                        int count=op.Number("amount");
                        if(count<=0||!game.State.usedPocket.Any(p=>p.card!=null&&p.count>0&&CanTake(p.card)))break;
                        Consume();for(int i=0;i<count;i++){
                            var stack=game.State.usedPocket.FirstOrDefault(p=>p.card!=null&&p.count>0&&game.CanReceiveCard(p.card));
                            if(stack==null)break;game.GrantCard(stack.card);stack.count--;if(stack.count<=0)game.State.usedPocket.Remove(stack);
                        }break;
                    case "acquire":
                        var pool=Pool(game,op.Get("pool").Text("kind"));
                        if(pool.Count==0)break;var card=pool[(int)(game.Rng.Random("loot","reward")*pool.Count)];
                        if(!CanTake(card))break;Consume();game.GrantCard(card);break;
                }
            }
            if(!consumed)throw new InvalidOperationException("当前地图效果无法生效；请检查生命、消耗区与背包空间，卡牌未消耗");
        },out reason);
    }
}
