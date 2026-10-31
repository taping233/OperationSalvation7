// Retained current-source run shell. Map choices preview without moving the camera; a second click confirms.
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.View;
namespace Sdt.UI.Kit
{
    public sealed class DesktopRunHud : MonoBehaviour
    {
        public static DesktopRunHud Current { get; private set; }
        CurrentRunTopBar _top;CurrentMapTools _tools;GameObject _notice,_banner;Text _message,_hint,_bannerText;
        MapModel _boundMap;string _selected,_lastNode;float _messageUntil,_bannerUntil;int _layer=-1;
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
            _hint=CurrentRunHudView.Text(App.UiRoot,"hintbar","",0,-34,800,26,13,"#91a3a7");_hint.rectTransform.anchorMin=_hint.rectTransform.anchorMax=new Vector2(.5f,0);_hint.rectTransform.pivot=new Vector2(.5f,0);
            _banner=CurrentRunHudView.Box(App.UiRoot,"layer-banner",0,144,600,72,new Vector2(.5f,1),new Vector2(.5f,1)).gameObject;
            _bannerText=CurrentRunHudView.Text(_banner.transform,"layer-title","",0,0,600,72,32);_bannerText.alignment=TextAnchor.MiddleCenter;_banner.SetActive(false);
            var bus=GameRuntime.I.Bus;bus.On<RunStarted>(_=>BindMap());bus.On<RunLoaded>(_=>BindMap());bus.On<NodeMovementCompleted>(_=>{ClearSelection();RefreshMap();});
            bus.On<ToastRequested>(message=>ShowMessage(message.Text,message.Tone=="warn"));bus.On<LogRequested>(message=>{if(message.Tone=="warn")ShowMessage(message.Text,true);});
            BoardViewHost.OnNodeClicked+=SelectOrMove;
            if(BoardViewHost.View!=null)BoardViewHost.View.InputBlocked=()=>UiStack.Blocked||CurrentInputBindings.SuppressGameplayInput||EventSystem.current!=null&&EventSystem.current.IsPointerOverGameObject();
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
            if(_layer!=s.layerIdx){_layer=s.layerIdx;_bannerText.text=GameRuntime.I.Map.Layers[s.layerIdx];_bannerUntil=Time.unscaledTime+3;}
        }
        public void SelectOrMove(string id)
        {
            var r=GameRuntime.I;if(UiStack.Blocked||!r.State.runActive||r.State.Phase!="idle"||r.Map.Nodes.All(n=>n.id!=id))return;
            if(_selected==id)ConfirmSelection();else{_selected=id;_tools.SetSelection(id);}
        }
        public void ChooseRoute(int direction)
        {
            var ids=GameRuntime.I.GetReachableNodeIds();if(ids.Count==0)return;int at=ids.IndexOf(_selected);at=(at<0?(direction<0?0:-1):at);_selected=ids[(at+direction+ids.Count)%ids.Count];_tools.SetSelection(_selected);
        }
        public void ConfirmSelection()
        {
            if(string.IsNullOrEmpty(_selected)||UiStack.Blocked)return;
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
            _message.text=plain;_message.color=warning?Theme.Hex("#f0b78d"):Theme.Txt;_messageUntil=Time.unscaledTime+4;_notice.SetActive(true);
        }
        void Update()
        {
            var r=GameRuntime.I;bool visible=r.State.runActive&&!UiStack.Blocked;
            if(_notice.activeSelf&&Time.unscaledTime>=_messageUntil)_notice.SetActive(false);
            if(r.State.runActive&&_boundMap!=r.Map)BindMap();
            if(visible&&_lastNode!=r.CurrentNodeId)RefreshMap();
            _tools.Refresh(visible);
            // Final expedition-map.css hides layerBanner. The current source contains no visible hintbar node/consumer.
            // Preserve source preference storage and layer update events without reviving retired HUD furniture.
            _hint.gameObject.SetActive(false);_banner.SetActive(false);
        }
        void OnDestroy(){BoardViewHost.OnNodeClicked-=SelectOrMove;if(Current==this)Current=null;}
    }
}

