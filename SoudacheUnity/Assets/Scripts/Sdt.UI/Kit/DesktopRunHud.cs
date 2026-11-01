// Retained current-source run shell. Map choices preview without moving the camera; a second click confirms.
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.View;
using Sdt.UI.Screens.Run;
namespace Sdt.UI.Kit
{
    public sealed class DesktopRunHud : MonoBehaviour
    {
        public static DesktopRunHud Current { get; private set; }
        CurrentRunTopBar _top;CurrentMapTools _tools;GameObject _notice;Text _message;
        MapModel _boundMap;string _selected,_lastNode;float _messageUntil;
        public string SelectedNodeId=>_selected;
        public static void Install()
        {
            if(Current!=null)return;var go=new GameObject("DesktopRunHud");go.transform.SetParent(App.UiRoot,false);
            Current=UIKit.GetOrAdd<DesktopRunHud>(go);Current.Initialize();
        }
        void Initialize()
        {
            _tools=CurrentMapTools.Install(App.UiRoot,ConfirmSelection);_top=CurrentRunTopBar.Install(App.UiRoot);
            _notice=CurrentRunHudView.Box(App.UiRoot,"OperationNotice",0,116,650,46,new Vector2(.5f,1),new Vector2(.5f,1)).gameObject;
            UIKit.GetOrAdd<Image>(_notice).color=Theme.HexA("#101e27",.96f);_message=CurrentRunHudView.Text(_notice.transform,"message","",14,0,622,46,18);_message.alignment=TextAnchor.MiddleCenter;_notice.SetActive(false);
            var bus=GameRuntime.I.Bus;bus.On<RunStarted>(_=>BindMap());bus.On<RunLoaded>(_=>BindMap());bus.On<NodeMovementCompleted>(_=>{ClearSelection();RefreshMap();});
            bus.On<ToastRequested>(message=>ShowMessage(message.Text,message.Tone=="warn"));bus.On<LogRequested>(message=>{if(!message.SuppressNotice&&message.Tone=="warn")ShowMessage(message.Text,true);});
            BoardViewHost.OnNodeClicked+=SelectOrMove;
            UiStack.Changed+=SyncBoardVisibility;
            if(BoardViewHost.View!=null)BoardViewHost.View.InputBlocked=()=>UiStack.Blocked||CurrentRunFilm.Active||CurrentInputBindings.SuppressGameplayInput||EventSystem.current!=null&&EventSystem.current.IsPointerOverGameObject();
        }
        void BindMap()
        {
            ClearSelection();var r=GameRuntime.I;if(r.Map==null||BoardViewHost.View==null)return;
            _boundMap=r.Map;BoardViewHost.View.Build(_boundMap);RefreshMap();BoardViewHost.View.FrameExploration(false);
            if(!string.IsNullOrEmpty(r.State.myClass)&&!r.EntrySupplyComplete)Sdt.UI.Screens.Run.EntrySupplyScreen.Open();
        }
        void RefreshMap()
        {
            var s=GameRuntime.I.State;var view=BoardViewHost.View;if(view==null||!s.runActive)return;
            view.SetLayer(s.layerIdx);view.SetPlayerNode(s.layerIdx+","+s.trackPos);view.SetExploration(s.revealed);view.SetPlayerCharacter(s.characterId);
            view.SetNodeStates(s.explored,s.settled,GameRuntime.I.GetReachableNodeIds());_lastNode=GameRuntime.I.CurrentNodeId;
        }
        public void SelectOrMove(string id)
        {
            var r=GameRuntime.I;if(UiStack.Blocked||CurrentRunFilm.Active||!r.State.runActive||r.State.Phase!="idle"||r.Map.Nodes.All(n=>n.id!=id))return;
            if(_selected==id)ConfirmSelection();else{_selected=id;_tools.SetSelection(id);}
        }
        public void ChooseRoute(int direction)
        {
            var ids=GameRuntime.I.GetReachableNodeIds();if(ids.Count==0)return;int at=ids.IndexOf(_selected);at=(at<0?(direction<0?0:-1):at);_selected=ids[(at+direction+ids.Count)%ids.Count];_tools.SetSelection(_selected);
        }
        public void ConfirmSelection()
        {
            if(string.IsNullOrEmpty(_selected)||UiStack.Blocked||CurrentRunFilm.Active)return;
            var r=GameRuntime.I;string id=_selected;
            if(id==r.CurrentNodeId&&!r.EntrySupplyComplete){Sdt.UI.Screens.Run.EntrySupplyScreen.Open();return;}
            if(!r.TryMoveToNode(id,out var reason))ShowMessage(reason,true);else ClearSelection();
        }
        public void ClearSelection(){_selected=null;_tools?.SetSelection(null);}
        public bool CloseDetail()=>_top!=null&&_top.CloseDetailIfOpen();
        void ShowMessage(string text,bool warning)
        {
            if(string.IsNullOrWhiteSpace(text))return;string plain=App.StripIcons(text);
            if(plain.Contains("保存失败")||plain.Contains("未能保存")||plain.Contains("存档读取失败"))_top.SaveFailed(plain);
            var hub=HubOwner();
            if(hub!=null){_notice.SetActive(false);CurrentHubOperationNotice.Show(hub,plain,warning);return;}
            _message.text=plain;_message.color=warning?Theme.Hex("#f0b78d"):Theme.Txt;_messageUntil=Time.unscaledTime+4;_notice.SetActive(true);
        }
        static Panel HubOwner()
        {
            for(int i=0;i<UiStack.Count;i++)if(UiStack.PanelAt(i) is Sdt.UI.Screens.Hub.HubScreen hub)return hub;
            return null;
        }
        void Update()
        {
            var r=GameRuntime.I;bool visible=r.State.runActive&&!UiStack.Blocked;
            if(_notice.activeSelf&&(Time.unscaledTime>=_messageUntil||HubOwner()!=null))_notice.SetActive(false);
            if(r.State.runActive&&_boundMap!=r.Map)BindMap();
            if(visible&&_lastNode!=r.CurrentNodeId)RefreshMap();
            _tools.Refresh(visible);

        }
        static void SyncBoardVisibility()=>BoardViewHost.View?.SetPresentationVisible(!UiStack.CoversBoard);
        void OnDestroy(){BoardViewHost.OnNodeClicked-=SelectOrMove;UiStack.Changed-=SyncBoardVisibility;if(Current==this)Current=null;}
    }
}

