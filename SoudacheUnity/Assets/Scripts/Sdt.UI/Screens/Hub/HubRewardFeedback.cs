using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        sealed class RewardItem
        {public string Name,Destination,Target,Id;public int Count;}
        sealed class RewardFeedback
        {public string Name,Error;public bool Capacity;public readonly List<RewardItem> Items=new List<RewardItem>();}
        sealed class RewardBefore
        {
            public readonly int Wood,Rations,Keys;
            public readonly Dictionary<string,int> Stash=new Dictionary<string,int>();
            public readonly HashSet<string> Backs=new HashSet<string>();
            public RewardBefore(BaseData data)
            {
                Wood=data.wood;Rations=data.rations;Keys=data.keys;
                foreach(var stack in data.stash){string key=StackKey(stack);Stash.TryGetValue(key,out int count);Stash[key]=count+stack.count;}
                foreach(var back in CardLibrary.CardBacks)if(data.IsBackUnlocked(back.id))Backs.Add(back.id);
            }
            public RewardFeedback Receipt(BaseData data,string name)
            {
                var receipt=new RewardFeedback{Name=name};
                void Resource(string label,int amount){if(amount>0)receipt.Items.Add(new RewardItem{Name=label,Count=amount,Destination="基地资源"});}
                Resource("木材",data.wood-Wood);Resource("口粮",data.rations-Rations);Resource("钥匙",data.keys-Keys);
                var after=new Dictionary<string,(CardDef card,int count)>();
                foreach(var stack in data.stash){string key=StackKey(stack);after.TryGetValue(key,out var previous);after[key]=(stack.card,previous.count+stack.count);}
                foreach(var pair in after)
                {
                    Stash.TryGetValue(pair.Key,out int previous);int count=pair.Value.count-previous;
                    if(count>0)receipt.Items.Add(new RewardItem{Name=pair.Value.card.name,Id=pair.Value.card.id,Count=count,Destination="后勤 · 卡牌仓库",Target="stash"});
                }
                foreach(var back in CardLibrary.CardBacks)
                    if(data.IsBackUnlocked(back.id)&&!Backs.Contains(back.id))receipt.Items.Add(new RewardItem{Name="卡背 · "+back.name,Id=back.id,Count=1,Destination="收藏室 · 卡背",Target="backs"});
                return receipt;
            }
        }
        RewardFeedback _rewardFeedback;
        Transform _rewardFeedbackHost;
        Button _archiveReturnFocus;
        bool _rewardClaiming;
        static bool RewardClaimed(BaseData data,string id,bool collection)
        {var claims=collection?data.collClaimed:data.achClaimed;return claims!=null&&claims.TryGetValue(id,out bool claimed)&&claimed;}
        void ClaimReward(string name,string id,bool collection,Func<(bool ok,string reason)> run)
        {
            int revision=_renderVersion;if(!CurrentHub(revision)||_rewardClaiming)return;
            var data=G.Base;var before=new RewardBefore(data);bool claimed=RewardClaimed(data,id,collection);
            (bool ok,string reason) result=(false,null);_rewardClaiming=true;
            try{result=run();}catch(Exception error){result=(false,error.Message);}finally{_rewardClaiming=false;}
            // A log/render observer may throw after the formal transaction committed.
            bool committed=!claimed&&RewardClaimed(data,id,collection);
            if(!CurrentHub(revision))return;
            if(result.ok||committed)
            {
                _rewardFeedback=before.Receipt(data,name);G.Audio.PlaySfx("ding");Rebuild();
            }
            else
            {
                string error=result.reason??(claimed?"这项奖励已经领取，请查看对应库存。":"当前领取条件未满足，请重新查看这项目标。");
                _rewardFeedback=new RewardFeedback{Name=name,Error=error,Capacity=error.Contains("仓库")&&(error.Contains("容量")||error.Contains("已满"))};
                PaintRewardFeedback();Log(error,"warn");
            }
        }
        void CloseRewardFeedback(RewardFeedback feedback)
        {
            if(_rewardFeedback!=feedback)return;_rewardFeedback=null;PaintRewardFeedback();
            if(_archiveReturnFocus!=null&&_archiveReturnFocus.isActiveAndEnabled&&_archiveReturnFocus.interactable)_archiveReturnFocus.Select();
        }
        void PaintRewardFeedback()
        {
            if(_rewardFeedbackHost==null)return;
            UIKit.ClearChildren(_rewardFeedbackHost);var feedback=_rewardFeedback;_rewardFeedbackHost.gameObject.SetActive(feedback!=null);
            if(feedback==null)return;Surface(_rewardFeedbackHost);
            Label(_rewardFeedbackHost,feedback.Error==null?"已领取 · "+feedback.Name:"尚未领取 · "+feedback.Name,24,true,feedback.Error==null?Accent:UiPalette.Warn);
            if(feedback.Error!=null)Label(_rewardFeedbackHost,feedback.Error,20,false,UiPalette.Warn);
            else
            {
                foreach(var item in feedback.Items)Label(_rewardFeedbackHost,item.Name+" ×"+item.Count+"  ·  "+item.Destination,20);
                if(feedback.Items.Count==0)Label(_rewardFeedbackHost,"奖励已领取，明细见对应库存。",20,false,Muted);
            }
            var actions=Row(_rewardFeedbackHost,"reward-destinations",12,52);
            void Destination(string caption,Action action)
            {Command(actions,caption,()=>{if(_rewardFeedback!=feedback)return;_rewardFeedback=null;action();});}
            if(feedback.Items.Any(item=>item.Target=="stash")||feedback.Capacity)Destination("查看仓库",()=>{_warehouseView="cards";_warehouseGroup=_warehouseQuery=_warehouseType=_warehouseRarity=_warehouseCharacter="";Navigate("stash");});
            foreach(var item in feedback.Items.Where(item=>item.Target=="backs"))
            {string id=item.Id;Destination("查看卡背",()=>{_backId=id;_archiveView="backs";Rebuild();});}
            if(feedback.Capacity)Destination("扩建仓库",()=>{_facility="stash";Navigate("upgrade");});
            var close=Command(actions,"确认",()=>CloseRewardFeedback(feedback),true);close.name="reward-receipt-close";
        }
    }
}
