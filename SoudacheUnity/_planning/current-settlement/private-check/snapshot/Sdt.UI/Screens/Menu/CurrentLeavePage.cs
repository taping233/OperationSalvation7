// menu-leave.js. Native stack ownership retains the source scene, scroll positions and focused control.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.UI.Screens.Battle;
using V=Sdt.UI.Screens.Run.CurrentSettlementView;
namespace Sdt.UI.Screens.Menu
{
    internal static class CurrentLeaveNavigation
    {
        // Prepare the destination before releasing the retained source. A presentation failure leaves the run/result mounted.
        public static void OpenTitle()
        {
            var previous=UiStack.CapturePanels();var title=ScreenMount.Show<TitleScreen>("Title");
            try{title.Build();GameRuntime.I.ShowTitle();SuggestionBox.CloseIfOpen();foreach(var panel in previous)UiStack.Close(panel);}
            catch{UiStack.Close(title);throw;}
        }
    }
    public sealed class CurrentLeavePage:MonoBehaviour
    {
        LeaveMenuScreen _owner;RunState _run;int? _slot;GameObject _returnFocus;Text _status;bool _busy;Button _abandon;
        public static RectTransform Card(Transform host,string name,string title,float height)
        {
            var root=V.Box(host,name,0,0,760,height);root.anchorMin=root.anchorMax=new Vector2(.5f,.5f);root.pivot=new Vector2(.5f,.5f);root.anchoredPosition=Vector2.zero;V.Paint(root,"#122129f5");
            var border=UIKit.GetOrAdd<Outline>(root);border.effectColor=Theme.HexA("#b9d0c8",.25f);border.effectDistance=new Vector2(1,-1);
            V.Text(root,"ovTitle",title,42,28,676,42,30,"#f0f4ee");V.Paint(V.Box(root,"title-rule",0,94,760,1),"#d8e7e31f");return root;
        }
        public void Build(LeaveMenuScreen owner)
        {
            _owner=owner;_run=GameRuntime.I.State;_slot=GameRuntime.I.ActiveSlot;_returnFocus=EventSystem.current?.currentSelectedGameObject;
            var root=Card(transform,"leave-run-choice","系统菜单",430);string place=GameRuntime.I.Map?.Layers.ElementAtOrDefault(_run.layerIdx)??"本次远征";
            V.Text(root,"leave-run-context",(_slot.HasValue?"档位 "+_slot.Value.ToString("D2"):"临时对局")+"       "+place,42,122,676,30,16,"#a7b9b7");
            _status=V.Text(root,"leave-run-status",_slot.HasValue?"":"未选择档位，无法保存。",42,160,676,48,18,"#e5b4a4");
            var back=V.Button(root,"leaveCancel","继续游玩",42,218,331,62,Continue,true);V.Button(root,"leaveSettings","设置",387,218,331,62,()=>Child<SettingsScreen>("RunSettings"));
            V.Button(root,"leaveGuide","生存指南",42,294,331,62,()=>Child<GuideScreen>("RunGuide"));var save=V.Button(root,"leaveSave","[[icon:save]] 保存并退出",387,294,331,62,Save);save.interactable=_slot.HasValue;
            _abandon=V.Button(root,"leaveAbandon","放弃本次对局  →",430,380,288,32,()=>{if(Current())CurrentLeaveConfirmation.Open(this);},false,true);
            EventSystem.current?.SetSelectedGameObject(back.gameObject);
        }
        bool Current()=>!_busy&&_run==GameRuntime.I.State&&_slot==GameRuntime.I.ActiveSlot&&_run.runActive&&UiStack.Top==_owner;
        void Child<T>(string name)where T:Panel{if(Current())UiStack.Show<T>(name);}
        public void Continue(){if(!Current())return;UiStack.Close(_owner);if(_returnFocus!=null&&_returnFocus.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(_returnFocus);}
        public void FocusAbandon(){if(_abandon!=null)EventSystem.current?.SetSelectedGameObject(_abandon.gameObject);}
        void Save()
        {
            if(!Current()||!_slot.HasValue)return;_busy=true;
            try{GameRuntime.I.SaveCurrent();if(GameRuntime.I.Saves.LastWriteSucceeded)CurrentLeaveNavigation.OpenTitle();else _status.text="本次进度未能保存。当前对局仍在，可重试或继续游玩。";}
            catch(Exception error){Debug.LogException(error);_status.text="本次进度未能保存。当前对局仍在，可重试或继续游玩。";}
            finally{_busy=false;}
        }
    }
    public sealed class CurrentLeaveConfirmation:Panel
    {
        CurrentLeavePage _parent;RunState _run;int? _slot;Text _status;Button _confirm;bool _busy;
        public override bool CanCloseWithEscape=>!_busy;
        public static void Open(CurrentLeavePage parent){var page=ScreenMount.Show<CurrentLeaveConfirmation>("LeaveAbandonConfirmation");page._parent=parent;page._run=GameRuntime.I.State;page._slot=GameRuntime.I.ActiveSlot;page.Build();}
        public override void Build()
        {
            var root=CurrentLeavePage.Card(transform,"leave-run-abandon","确认放弃本次对局？",620);
            V.Text(root,"leave-run-warning","放弃后，本次远征将结束。",42,122,676,46,22,"#efb3a6");
            V.Text(root,"loss-label","将失去",42,202,86,40,18,"#e0a79b");V.Text(root,"loss-detail","带入的全部卡牌、未受安全格保护的本局所得，以及金币、物资和消耗区。",148,202,570,112,20,"#c5d1cd");
            V.Text(root,"keep-label","可带回",42,336,86,40,18,"#acd2c4");V.Text(root,"keep-detail","本局获得并受安全格保护的卡牌，含安全格珍珠盒内的资源。",148,336,570,112,20,"#c5d1cd");
            _status=V.Text(root,"leave-run-status","",42,452,676,62,18,"#e5b4a4");var back=V.Button(root,"leaveReviewBack","返回",42,526,331,62,Close,true);_confirm=V.Button(root,"leaveAbandonConfirm","确认放弃",387,526,331,62,Abandon,false,true);EventSystem.current?.SetSelectedGameObject(back.gameObject);
        }
        void Abandon()
        {
            var game=GameRuntime.I;if(_busy||UiStack.Top!=this||game.State!=_run||game.ActiveSlot!=_slot||!_run.runActive)return;
            IReadOnlyCollection<string> spent=null;if(_run.battleActive){var snapshot=GameSnapshotRef.Current;if(snapshot==null||snapshot.ConsumedPile==null||snapshot.Discard==null){_status.text="战斗卡牌清单暂不可用，本次尚未结算，请重试确认放弃。";return;}spent=snapshot.ConsumedPile.Concat(snapshot.Discard).Distinct().ToArray();}
            _busy=true;_confirm.interactable=false;var result=game.AbandonRun(spent);_busy=false;if(result==null){_confirm.interactable=true;_confirm.GetComponentInChildren<Text>().text="重试确认放弃";_status.text=game.SettlementError??"本次结算尚未保存，你的进度仍保留在本档位，请重试。";return;}
            while(UiStack.Count>0)UiStack.Pop();var page=ScreenMount.Show<AbandonResultScreen>("AbandonResult");page.Setup(result);
        }
        internal override void OnClose(){_parent?.FocusAbandon();}
    }
    public sealed class CurrentLeaveResult:MonoBehaviour
    {
        AbandonResultScreen _owner;Text _status;bool _busy;
        public void Build(AbandonResultScreen owner,AbandonResult result)
        {
            _owner=owner;var root=CurrentLeavePage.Card(transform,"leave-run-complete","已放弃对局",720);
            V.Text(root,"ov-stats","当前仍随身的带入卡 <b>"+result.BroughtN+"</b> 张全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；\n消耗区卡牌、物资与 <b>"+result.Coins+" 币</b>一并散失。",42,122,676,130,19,"#c5d1cd");
            V.Text(root,"doom-loot-h",result.KeptN>0?"[[icon:lock]] 宠物从安全格抢运回 "+result.KeptN+" 张对局中获得的卡牌":"安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。",42,280,676,68,18,"#acd2c4");
            for(int i=0;i<Math.Min(6,result.KeptStacks.Count);i++){var stack=result.KeptStacks[i];var b=V.Button(root,"rescued-card-"+i,"",42+i*114,372,96,134,()=>CurrentSettlementCardZoom.Show(stack.card));b.GetComponent<Image>().color=Color.clear;var face=CardFace.Create(stack.card,CardSize.Sm,b.transform);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=new Vector2(.5f,.5f);rt.anchoredPosition=Vector2.zero;foreach(var graphic in face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;V.Text(root,"rescued-count-"+i,"×"+stack.count,42+i*114,512,96,30,18);}
            if(result.KeptStacks.Count>6)V.Text(root,"doom-more","还有 "+result.KeptStacks.Skip(6).Sum(s=>s.count)+" 张",42,550,676,32,18,"#a7b9b7");
            V.Button(root,"goBase","回基地",42,606,331,62,()=>Navigate(()=>GameRuntime.I.OpenHub("deploy")),true);V.Button(root,"toTitle","回主菜单",387,606,331,62,()=>Navigate(CurrentLeaveNavigation.OpenTitle));_status=V.Text(root,"operation-notice","",42,674,676,40,18,"#e5b4a4");
        }
        void Navigate(Action open)
        {
            if(_busy||UiStack.Top!=_owner)return;_busy=true;var before=UiStack.CapturePanels();try{open();if(UiStack.Top==_owner)throw new InvalidOperationException("页面尚未打开");if(_owner!=null)UiStack.Close(_owner);}
            catch(Exception error){foreach(var page in UiStack.CapturePanels().Where(p=>!before.Contains(p)).ToArray())UiStack.Close(page);Debug.LogException(error);_status.text="结算已完成，暂时无法打开该页面，请重试。";}finally{_busy=false;}
        }
    }
}
