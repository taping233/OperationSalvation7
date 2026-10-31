using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        void RequireAltar()
        {
            if(!State.runActive||State.battleActive||CurrentNodeReceipt.type!="altar"||State.closed.Contains(CurrentNodeId))throw new InvalidOperationException("只能在当前未结束的祭坛处理仪式");
        }
        public bool TryActivateAltarWithFragments(out string reason)
        {
            if(!TryPersistMutation(()=>{
                RequireAltar();if(State.altarActivated||State.fragments<2)throw new InvalidOperationException("祭坛已激活或通行证碎片不足2枚");
                var r=CurrentNodeReceipt;var pool=CardDatabase.All.Where(c=>c.cls==State.myClass&&c.type=="能力卡").ToList();
                if(pool.Count==0)throw new InvalidOperationException("当前职业没有可兑换的能力卡，碎片已保留");
                if(r.altarFragmentCardId==null)r.altarFragmentCardId=pool[(int)(Rng.Random("loot","reward")*pool.Count)].id;
            },out reason))return false;
            return TryPersistMutation(()=>{
                RequireAltar();if(State.altarActivated||State.fragments<2)throw new InvalidOperationException("祭坛状态已变化");
                var card=CardLibrary.FindById(CurrentNodeReceipt.altarFragmentCardId);
                if(card==null||!GrantCard(card))throw new InvalidOperationException("能力卡暂不能领取，候选与碎片已保留，请整理背包后重试");
                State.fragments-=2;State.altarActivated=true;CurrentNodeReceipt.completed=true;State.settled.Add(CurrentNodeId);State.Phase="idle";
            },out reason);
        }
        public bool TrySelectAltarReward(string kind,out string reason)=>TryPersistMutation(()=>{
            RequireAltar();var r=CurrentNodeReceipt;
            if(!State.altarActivated||!r.altarRewardPending)throw new InvalidOperationException("祭坛回赠已经选择或尚未激活");
            if(kind=="restore"){
                int available=State.usedPocket.Where(p=>p.count>0&&FireRestorable(p.card)).Sum(p=>p.count);
                if(available==0)throw new InvalidOperationException("消耗区没有可复原的卡牌，请选择其他回赠");
                r.altarRestoreLeft=Math.Min(3,available);Heal(10);
            }else if(kind=="loot"){
                r.rewardCardIds=new List<string>();
                var legends=CardDatabase.All.Where(c=>c.rarity=="传说"&&CardLibrary.IsRandomObtainable(c)).ToList();
                var legend=legends.Count>0?legends[(int)(Rng.Random("loot","reward")*legends.Count)]:null;if(legend!=null)r.rewardCardIds.Add(legend.id);
                var equips=CardDatabase.All.Where(c=>c.type=="装备"&&CardLibrary.IsRandomObtainable(c)&&(legend==null||(c.id!=legend.id&&c.name!=legend.name))).ToList();
                if(equips.Count>0)r.rewardCardIds.Add(equips[(int)(Rng.Random("loot","reward")*equips.Count)].id);
                if(r.rewardCardIds.Count==0)throw new InvalidOperationException("回赠卡池暂不可用");
            }else throw new InvalidOperationException("祭坛回赠选项无效");
            r.altarRewardPending=false;r.altarRewardKind=kind;
        },out reason);
        public List<CardDef> GetAltarRewardCards()=>CurrentNodeReceipt.type=="altar"&&CurrentNodeReceipt.altarRewardKind=="loot"?CurrentNodeReceipt.rewardCardIds?.Select(CardLibrary.FindById).ToList()??new List<CardDef>():new List<CardDef>();
        public bool TryClaimAltarReward(int index,out string reason)=>TryPersistMutation(()=>{
            RequireAltar();var r=CurrentNodeReceipt;var cards=GetAltarRewardCards();
            if(index<0||index>=cards.Count||r.altarTaken.Contains(index))throw new InvalidOperationException("该回赠已领取或不可用");
            if(cards[index]==null||!GrantCard(cards[index]))throw new InvalidOperationException("背包空间不足，回赠已保留，请整理后重试");
            r.altarTaken.Add(index);if(r.altarTaken.Count==cards.Count){r.completed=true;State.settled.Add(CurrentNodeId);}
        },out reason);
        public bool TrySacrificeAltarItem(string uid,out string reason)=>TryPersistMutation(()=>{
            RequireAltar();var r=CurrentNodeReceipt;if(State.altarActivated||r.altarItemSacrificed)throw new InvalidOperationException("本祭坛的道具献祭已结束");
            var card=State.ownedCards.FirstOrDefault(o=>o.uid==uid&&o.safe!=true&&!o.stored&&string.IsNullOrEmpty(o.pouchOf)&&o.card.type=="道具");
            int available=State.usedPocket.Where(p=>p.count>0&&FireRestorable(p.card)).Sum(p=>p.count);
            if(card==null||available==0)throw new InvalidOperationException("请选择一张随身道具，且消耗区需有可复原卡牌");
            State.ownedCards.Remove(card);r.altarItemSacrificed=true;r.altarRestoreLeft=Math.Min(2,available);r.altarRewardKind="offering";
        },out reason);
        public bool TryAltarRestore(int pocketIndex,out string reason)=>TryPersistMutation(()=>{
            RequireAltar();var r=CurrentNodeReceipt;if(r.altarRestoreLeft<=0||pocketIndex<0||pocketIndex>=State.usedPocket.Count)throw new InvalidOperationException("本次复原已结束");
            var pocket=State.usedPocket[pocketIndex];if(pocket.count<=0||!FireRestorable(pocket.card)||!GrantCard(pocket.card))throw new InvalidOperationException("该卡牌不能复原或背包需腾位");
            pocket.count--;if(pocket.count<=0)State.usedPocket.Remove(pocket);r.altarRestoreLeft--;
            if(r.altarRestoreLeft==0&&r.altarRewardKind=="restore"){r.completed=true;State.settled.Add(CurrentNodeId);}
        },out reason);
    }
}
