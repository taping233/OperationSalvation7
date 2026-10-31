using System;using System.Linq;using Sdt.Core;using Sdt.Run;namespace Sdt.UI.Kit {
    internal static class CurrentMapNodeStatus
    {
        internal struct Status {public string id,label,detail;}
        static Status S(string id,string label,string detail)=>new Status{id=id,label=label,detail=detail};
        public static Status Project(GameRuntime game,MapNode node)
        {
            var s=game.State;string key=node.id,type=node.type;bool door=type=="door"||game.Map.LayerData[node.layerIdx].doors.Any(d=>d.at==node.idx);
            s.nodeRewards.TryGetValue(key,out var r);
            if(s.closed.Contains(key))return door||type=="blank"||type=="entrance"?S("transit","",door?"闸门仍可通行。":""):type=="shop"?S("shop-closed","已离店","本次交易已结束，闸门与道路仍可通行。"):S("completed","已结束","本节点内容已结束，未领奖励与剩余机会已作废，仍可通行。");
            if(r!=null&&r.type=="fire"&&!r.completed&&(!r.healUsed||!r.restoreUsed))return S("pending","待休整","回血与复原各可使用一次，前往下一节点后剩余机会作废。");
            bool supply=key==game.CurrentNodeId&&!game.EntrySupplyComplete;
            if(supply||r!=null&&(!r.completed&&r.chestQueue!=null||r.rewardCardIds!=null&&!r.rewardTaken.HasValue||r.altarRewardPending||r.altarRestoreLeft>0||r.eventProgress!=null&&!r.eventProgress.settled||r.battleWon&&!r.completed))return S("pending","待领奖","可在当前节点整理后继续领取，前往下一节点后未领奖励作废。");
            if(type=="shop")return s.settled.Contains(key)?S("shop-closed","已离店","本次交易已结束，闸门与道路仍可通行。"):S("shop-open","营业中","离开此节点前可反复进店，货架保留。");
            if(!door&&(s.settled.Contains(key)||r?.completed==true||type=="altar"&&s.altarActivated&&r?.altarRewardPending!=true||type=="boss"&&s.bossDefeated))return S("completed","已完成","内容已结算，仍可通行。");
            if(door||new[]{"blank","empty","entrance","extraction","emergencyExit"}.Contains(type))return S("transit","",door?"闸门仍可通行。":"");
            if(type=="boss"&&!s.altarActivated)return S("incomplete","祭坛未激活","先前往污染祭坛，选择「弃 3 张 · 激活祭坛」（普通背包卡牌），或献上 2 枚员工通行证A碎片。仅献祭道具不会激活祭坛。");
            return S("incomplete","未完成",new[]{"battle","boss","elite","battleElite"}.Contains(type)?"战斗中不能整理背包。":type=="event"?"选择前可在当前节点整理，前往下一节点后事件结束。":"可在当前节点整理后重进，前往下一节点后内容结束。");
        }
    }
}
