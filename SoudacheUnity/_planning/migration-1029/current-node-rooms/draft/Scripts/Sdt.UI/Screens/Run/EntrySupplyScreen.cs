// Current game.run.altar.js openEntrySupply/openResourcePick reward frame.
using System;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class EntrySupplyScreen:NodeShellPanel
    {
        bool _resource,_busy;
        string _node,_error;int? _seed;
        CurrentRewardScene _view;
        bool Current=>GameRuntime.I.State.runActive&&GameRuntime.I.State.seed==_seed&&GameRuntime.I.CurrentNodeId==_node&&UiStack.Top==this;
        public static void Open()
        {
            if(GameRuntime.I.EntrySupplyComplete)return;
            var page=ScreenMount.Show<EntrySupplyScreen>("EntrySupply");page.Bind();page.Build();
        }
        public static void OpenResource()
        {
            if(GameRuntime.I.CurrentNodeReceipt.rewardTaken!=null)return;
            var page=ScreenMount.Show<EntrySupplyScreen>("ResourceReward");page._resource=true;page.Bind();page.Build();
        }
        void Bind(){_node=GameRuntime.I.CurrentNodeId;_seed=GameRuntime.I.State.seed;}
        public override void Build()
        {
            var runtime=GameRuntime.I;
            if(_view==null)_view=CurrentRewardScene.Create(transform,!_resource);
            _view.OnResume=Build;
            var cards=_resource?runtime.GetResourceRewardCards():runtime.GetEntrySupplyCards();
            bool complete=_resource?runtime.CurrentNodeReceipt.rewardTaken!=null:runtime.EntrySupplyComplete;
            _view.Set(_resource?complete?"物资已领取":"选择一份物资":"随行补给",_resource?"物资投放点":"",_error??(_resource?"当前节点可整理后继续选择；领取后其余放弃。":""));
            var items=new List<CurrentRewardItem>();
            for(int i=0;i<cards.Count;i++)
            {
                int index=i;var card=cards[i];if(card==null)continue;
                string state=_resource?runtime.CurrentNodeReceipt.rewardTaken==i?"received":complete?"forfeited":"pending":runtime.State.entrySupply.taken.Contains(i)?"received":"pending";
                items.Add(new CurrentRewardItem{Key=index+":"+card.id,Index=index,Card=card,Choice=_resource,State=state,ExplicitMode=false,StateCopy=_resource&&complete?(state=="received"?"已入背包":"已永久放弃"):null,Fits=!_resource||runtime.CanReceiveCard(card),Claim=()=>Take(index),LiveState=()=>_resource?runtime.CurrentNodeReceipt.rewardTaken==index?"received":runtime.CurrentNodeReceipt.rewardTaken!=null?"forfeited":"pending":runtime.State.entrySupply.taken.Contains(index)?"received":"pending"});
            }
            _view.Sync(items);_view.ClearActions();
            CurrentNodeElements.Button(_view.Info,"整理背包",()=>{if(Current&&!_busy)runtime.Bus.Emit(new BagOpened());});
            if(_resource)CurrentNodeElements.Button(_view.Actions,complete?"继续探索":"返回地图",Leave,true);
            else if(complete)CurrentNodeElements.Button(_view.Actions,"继续探索",Leave,true);
            else
            {
                int received=runtime.State.entrySupply.taken.Count;
                CurrentNodeElements.Text(_view.Info,"entry-supply-status",received+" / "+cards.Count,28,"#d4c38d",true);
                if(cards.Count-received>1)CurrentNodeElements.Button(_view.Actions,"全部收下",()=>Take(-1));
            }
        }
        void Take(int index)
        {
            if(!Current||_busy)return;_busy=true;
            var runtime=GameRuntime.I;bool success=false;var beforeTaken=_resource?new HashSet<int>(runtime.CurrentNodeReceipt.rewardTaken.HasValue?new[]{runtime.CurrentNodeReceipt.rewardTaken.Value}:new int[0]):new HashSet<int>(runtime.State.entrySupply.taken);
            try
            {
                if(index>=0)
                {success=_resource?runtime.ClaimResourceReward(index,out _error):runtime.ClaimEntrySupply(index,out _error);}
                else
                {
                    var cards=runtime.GetEntrySupplyCards();_error=null;
                    for(int i=0;i<cards.Count;i++)
                    {
                        if(runtime.State.entrySupply.taken.Contains(i)||cards[i]==null||!runtime.CanReceiveCard(cards[i]))continue;
                        if(!runtime.ClaimEntrySupply(i,out _error))break;
                        success=true;
                    }
                    if(!success&&_error==null)_error="当前放不下，请整理背包后重试；补给已保留。";
                }
            }
            finally{_busy=false;}
            if(success){var cards=_resource?runtime.GetResourceRewardCards():runtime.GetEntrySupplyCards();_view.PlayAcquisition(cards.Where((c,i)=>c!=null&&!beforeTaken.Contains(i)&&(_resource?runtime.CurrentNodeReceipt.rewardTaken==i:runtime.State.entrySupply.taken.Contains(i))).Select(c=>c.id).ToArray());}
            Build();
        }
        void Leave()
        {
            if(!Current||_busy)return;
            if(!GameRuntime.I.TryPersistMutation(()=>GameRuntime.I.State.Phase="idle",out _error)){Build();return;}
            Close();
        }
        public override void CloseFromEscape(){if(_resource)Leave();else Sdt.UI.Screens.Menu.LeaveMenuScreen.Open();}
        protected override void OnBody(){}
    }
}
