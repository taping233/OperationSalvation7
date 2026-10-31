// Current chests.js presents cards directly; unimported safe-opening animation is deliberately excluded.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class ChestOpenScreen:Panel
    {
        Action _onDone;List<string> _pendingKinds;string _error,_node,_revealed;int? _seed;
        bool _busy,_leaveConfirm,_more;CurrentRewardScene _view;RevealSfxTimer _reveal;
        bool Live=>GameRuntime.I.State.runActive&&GameRuntime.I.State.seed==_seed&&GameRuntime.I.CurrentNodeId==_node&&UiStack.Top==this;
        ChestVisitReceipt Current=>GameRuntime.I.CurrentChestReceipt;
        bool Overview=>string.IsNullOrEmpty(Current?.title);
        void Bind(Action done){_onDone=done;_node=GameRuntime.I.CurrentNodeId;_seed=GameRuntime.I.State.seed;}
        public static void Open(List<string> kinds,Action done)
        {var page=ScreenMount.Show<ChestOpenScreen>("ChestOpen");page.Bind(done);page._pendingKinds=kinds==null?new List<string>():new List<string>(kinds);page.PrepareCandidates();}
        public static void OpenPending(Action done)
        {var page=ScreenMount.Show<ChestOpenScreen>("ChestOpen");page.Bind(done);page.Present();}
        void PrepareCandidates()
        {
            if(!Live||_busy)return;_busy=true;var g=GameRuntime.I;
            bool saved=g.TryPersistMutation(()=>
            {
                var receipt=g.CurrentNodeReceipt;if(receipt.chestQueue!=null&&receipt.chestQueue.Count>0)return;
                receipt.chestQueue=new List<ChestVisitReceipt>();
                foreach(var kind in _pendingKinds)
                {
                    var loot=ChestLoot.RollContents(kind,g.Rng,cls:g.State.myClass,mode:g.State.mode,petEggChance:g.Base.PetEggDropChance);
                    g.Base.RecordPetEggChestResult(loot.eggHit);
                    receipt.chestQueue.Add(new ChestVisitReceipt{kind=kind,coins=loot.coins,cardIds=loot.cards.Select(c=>c.id).ToList(),claimMode=loot.claimMode,choiceCount=loot.choiceCount,eggHit=loot.eggHit});
                }
                receipt.chestIndex=0;
            },out _error);_busy=false;if(!saved){Build();return;}_pendingKinds=null;Present();
        }
        static bool Pending(ChestVisitReceipt box,int index)=>!box.taken.Contains(index)&&!box.lost.Contains(index);
        static int ChoiceCount(ChestVisitReceipt box)=>box.choiceCount>0?box.choiceCount:box.cardIds.Count;
        static bool IsChoice(ChestVisitReceipt box,int index)=>box.claimMode=="one"&&index<ChoiceCount(box);
        static void UpdateCompletion(ChestVisitReceipt box)=>box.completed=!Enumerable.Range(0,box.cardIds.Count).Any(i=>Pending(box,i));
        void Present()
        {
            if(!Live||_busy)return;var g=GameRuntime.I;var box=Current;
            if(box==null){Finish();return;}
            if(Overview&&!box.coinsTaken)
            {
                _busy=true;bool saved=g.TryCollectCurrentChestCoins(_node,_seed,out _error);_busy=false;
                if(!saved){Build();return;}
            }
            Build();string token=g.CurrentNodeReceipt.chestIndex+":"+string.Join(",",box.cardIds);
            if(_revealed!=token){_revealed=token;if(_reveal!=null)Destroy(_reveal);_reveal=UIKit.GetOrAdd<RevealSfxTimer>(this);_reveal.Reset(box,()=>Live&&Current==box,i=>_view.Reveal(i));}
        }
        public override void Build()
        {
            if(_view==null)_view=CurrentRewardScene.Create(transform);_view.OnResume=()=>{GameRuntime.I.State.Phase="modal";Build();};_view.ClearActions();
            var g=GameRuntime.I;var box=Current;
            if(box==null)
            {
                _view.Set("奖励准备未完成","",_error??"本次奖励已保留，请重试保存。");_view.Sync(new List<CurrentRewardItem>());
                CurrentNodeElements.Button(_view.Actions,"重试",_pendingKinds!=null?(Action)PrepareCandidates:Present,true);
                CurrentNodeElements.Button(_view.Actions,"返回地图",CloseFromEscape);return;
            }
            bool pick=Enumerable.Range(0,box.cardIds.Count).Any(i=>IsChoice(box,i)&&Pending(box,i));
            int pending=Enumerable.Range(0,box.cardIds.Count).Count(i=>Pending(box,i));bool complete=pending==0;
            string title=Overview?(complete?"奖励已处理":pick?"选择 1 张":box.claimMode=="one"?"附赠奖励":box.kind=="small"&&box.cardIds.Count==1?"随机收获":"领取奖励"):(box.title??(pick?"选择收获":"搜刮完成"));
            var receipt=g.CurrentNodeReceipt;string source=(box.source??ChestLoot.Definition(box.kind)?.name??box.kind)+(receipt.chestQueue.Count>1?" · "+(receipt.chestIndex+1)+"/"+receipt.chestQueue.Count:"");
            string progress=CurrentRewardState.Summary(box.taken.Count,box.lost.Count,box.cardIds.Count,complete,box.claimMode=="one",pick?"从候选中选择 1 张":"");
            _view.Set(title,source,_error??(_leaveConfirm?"永久放弃剩余 "+pending+" 张卡牌？离开后无法找回。":!complete?"当前节点可整理后继续领取；前往下一节点后未领奖励作废。":""));
            var items=new List<CurrentRewardItem>();
            for(int i=0;i<box.cardIds.Count;i++)
            {
                int index=i;var card=CardLibrary.FindById(box.cardIds[i]);if(card==null)continue;
                items.Add(new CurrentRewardItem{Key=receipt.chestIndex+":"+i+":"+card.id,Index=i,Card=card,Choice=IsChoice(box,i),Bonus=box.claimMode=="one"&&!IsChoice(box,i),State=CurrentRewardState.CardState(box.taken,box.lost,i),Fits=g.CanReceiveCard(card),Claim=()=>Take(index),LiveState=()=>Current==null?"forfeited":CurrentRewardState.CardState(Current.taken,Current.lost,index)});
            }
            _view.Sync(items);
            CurrentNodeElements.Text(_view.Info,"reward-capacity","[[icon:bag]] "+g.UsedSlots()+"/"+g.BagCap+" 格",18,"#becbc9");
            if(!complete&&!_leaveConfirm)CurrentNodeElements.Button(_view.Info,"整理背包",()=>{if(Live&&!_busy)g.Bus.Emit(new BagOpened());});
            if(_leaveConfirm)
            {CurrentNodeElements.Button(_view.Actions,"继续领取",()=>{_leaveConfirm=false;Build();});CurrentNodeElements.Button(_view.Actions,"确认放弃",Forfeit);}
            else
            {
                if(!complete)CurrentNodeElements.Button(_view.Info,_more?"放弃剩余卡牌":"其他操作",()=>{if(!Live||_busy)return;if(_more)_leaveConfirm=true;else _more=true;Build();});
                if(!complete&&!pick&&pending>1)CurrentNodeElements.Button(_view.Actions,"全部收下",()=>Take(-1));
                if(!string.IsNullOrEmpty(_error))CurrentNodeElements.Button(_view.Actions,"重试保存",Present);
                CurrentNodeElements.Button(_view.Actions,complete?"继续探索":"返回地图",complete?(Action)Next:CloseFromEscape,true);
            }
        }
        void Take(int index)
        {
            if(!Live||_busy||_leaveConfirm)return;var box=Current;if(box==null)return;
            if(index>=0&&(index>=box.cardIds.Count||!Pending(box,index)))return;
            if(index<0&&Enumerable.Range(0,box.cardIds.Count).Any(i=>IsChoice(box,i)&&Pending(box,i)))return;
            _busy=true;var g=GameRuntime.I;int received=box.taken.Count;var beforeTaken=new HashSet<int>(box.taken);
            bool saved=g.TryClaimCurrentChest(_node,_seed,index,out _error);_busy=false;if(!saved){Build();return;}
            received=Current.taken.Count-received;if(received>0){_view.PlayAcquisition(Current.cardIds.Where((id,i)=>!beforeTaken.Contains(i)&&Current.taken.Contains(i)).ToArray());}
            if(Current.completed&&Overview){var parent=transform.parent;bool single=GameRuntime.I.CurrentNodeReceipt.chestQueue.Count==1&&Current.kind=="small"&&Current.cardIds.Count==1&&Current.claimMode!="one";Next();if(single&&parent!=null)CurrentRewardReceipt.Show(parent);}else Build();
        }
        void Forfeit()
        {
            if(!Live||_busy||!_leaveConfirm||Current==null)return;_busy=true;var g=GameRuntime.I;
            bool saved=g.TryForfeitCurrentChest(_node,_seed,out _error);
            _busy=false;if(!saved){Build();return;}_leaveConfirm=false;if(Overview)Next();else Build();
        }
        void Next()
        {
            if(!Live||_busy||Current==null||!Current.completed)return;_busy=true;var g=GameRuntime.I;
            bool saved=g.TryPersistMutation(()=>{var r=g.CurrentNodeReceipt;r.chestIndex++;while(r.chestIndex<r.chestQueue.Count&&r.chestQueue[r.chestIndex].completed)r.chestIndex++;},out _error);_busy=false;
            if(!saved){Build();return;}Present();
        }
        void Finish()
        {
            if(!Live||_busy)return;_busy=true;var g=GameRuntime.I;
            if(!g.TryPrepareCurrentRewardContinuation(_node,_seed,out _error)){_busy=false;Build();return;}
            try{_onDone?.Invoke();}
            catch(Exception error){_error="奖励进度已保留，继续流程尚未完成："+error.Message;_busy=false;Build();return;}
            if(!g.Saves.LastWriteSucceeded){_error="奖励进度已保留，继续流程尚未保存，请重试。";_busy=false;Build();return;}
            _onDone=null;_busy=false;Close();
        }
        public override void CloseFromEscape()
        {
            if(!Live||_busy)return;var g=GameRuntime.I;
            if(!g.TryPersistMutation(()=>g.State.Phase="idle",out _error)){Build();return;}Close();
        }
        internal override void OnClose(){_onDone=null;}
        sealed class RevealSfxTimer:MonoBehaviour
        {
            ChestVisitReceipt _box;Func<bool> _live;Action<int> _pop;float _time;int _index;
            public void Reset(ChestVisitReceipt box,Func<bool> live,Action<int> pop){_box=box;_live=live;_pop=pop;_time=0;_index=0;}
            void Update()
            {
                if(_box==null||!(_live?.Invoke()??false))return;_time+=Time.unscaledDeltaTime;
                while(_index<_box.cardIds.Count&&_time>=.14f+_index*.17f)
                {int i=_index++;if(_box.taken.Contains(i))continue;AudioService.I.PlaySfx("reveal");var rarity=CardLibrary.FindById(_box.cardIds[i])?.rarity;if(rarity=="传说"||rarity=="棱彩")AudioService.I.PlaySfx("legend");else if(rarity=="史诗")AudioService.I.PlaySfx("ding");else _pop?.Invoke(i);}
            }
        }
    }
}
