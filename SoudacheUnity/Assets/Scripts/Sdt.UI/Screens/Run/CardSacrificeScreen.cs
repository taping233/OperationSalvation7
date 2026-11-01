using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    /// <summary>祭坛激活与紧急撤离复用同一献祭选择，最终费用由领域命令复检。</summary>
    public sealed class CardSacrificeScreen : NodeShellPanel
    {
        sealed class Candidate
        {
            public string Uid, Definition;
            public CardDef Card;
            public RectTransform Root;
            public Button Button;
            public GameObject Face, Mark;
            public Text State;
        }
        readonly HashSet<string> _selected = new HashSet<string>();
        readonly Dictionary<string,Candidate> _tiles = new Dictionary<string,Candidate>();
        readonly List<string> _removed = new List<string>();
        GameRuntime _runtime;
        RunState _run;
        MapModel _map;
        int? _slot, _seed;
        int _layer, _position, _revision;
        bool _emergency, _closed, _busy, _covered;
        RectTransform _grid;
        Text _count, _notice, _empty;
        Button _confirm;

        bool SameLocation => GameRuntime.I==_runtime&&_runtime.State==_run
            &&_runtime.ActiveSlot==_slot&&_run.seed==_seed&&_run.layerIdx==_layer&&_run.trackPos==_position
            &&_run.runActive&&!_run.battleActive;
        bool SamePlace => this!=null&&!_closed&&isActiveAndEnabled&&SameLocation;
        bool OwnsSource => SamePlace&&ReferenceEquals(_runtime.Map,_map);
        bool Current => OwnsSource&&UiStack.Top==this&&!Sdt.UI.Screens.Menu.SuggestionBox.IsOpen;

        public static void Open(bool emergency)
        {
            var runtime=GameRuntime.I;
            if(!runtime.State.runActive||runtime.State.battleActive||runtime.Map==null)return;
            string kind=runtime.CurLayer.logical[runtime.State.trackPos].type;
            if(emergency?(runtime.State.layerIdx!=2||kind!="emergencyExit"):kind!="altar")return;
            var screen = ScreenMount.Show<CardSacrificeScreen>("CardSacrifice");
            screen._runtime=runtime;screen._run=runtime.State;screen._map=runtime.Map;screen._slot=runtime.ActiveSlot;
            screen._seed=runtime.State.seed;screen._layer=runtime.State.layerIdx;screen._position=runtime.State.trackPos;
            screen._emergency = emergency;
            screen.Tone = emergency ? "exit" : "altar";
            screen.TitleIcon = emergency ? "[[icon:runner]]" : "[[icon:crystal]]";
            screen.Title = emergency ? "紧急撤离" : "激活祭坛";
            screen.Build();
            UiStack.Changed+=screen.StackChanged;
            runtime.State.Phase="modal";
        }

        protected override void OnPrepare() => Sub="选择 3 张随身卡牌献祭；安全格、仓库和容器内的卡牌不参与。";

        protected override void OnBody()
        {
            if(_grid!=null)return;
            _count=UIKit.Label(BodyRoot,"",22,Theme.Txt);_count.name="sacrificeCount";
            _notice=UIKit.Label(BodyRoot,"",17,UiPalette.Warn);_notice.name="sacrificeError";_notice.supportRichText=false;
            _empty=UIKit.Label(BodyRoot,"背包里没有符合条件的卡牌",20,Theme.Sub);_empty.name="sacrificeEmpty";
            _grid=(RectTransform)UIKit.Grid(BodyRoot,2,new Vector2(280,434),new Vector2(20,20)).transform;
            _grid.name="sacrificeGrid";_grid.GetComponent<GridLayoutGroup>().childAlignment=TextAnchor.UpperCenter;
            UIKit.GetOrAdd<LayoutElement>(_grid);
            _confirm=UIKit.BtnOk(FootRoot,_emergency?"确认献祭并撤离":"确认献祭并激活",Confirm);_confirm.name="sacrificeConfirm";
            var bag=UIKit.Btn(FootRoot,"整理背包",()=>{if(Current&&!_busy)_runtime.Bus.Emit(new BagOpened());});bag.name="sacrificeBag";
            var cancel=UIKit.Btn(FootRoot,_emergency?"返回撤离点":"取消",Cancel);cancel.name="sacrificeCancel";
            AlignCandidates();
        }

        Candidate Create(string uid)
        {
            var root=new GameObject("sacrificePick-"+uid,typeof(RectTransform));root.transform.SetParent(_grid,false);
            var tile=new Candidate{Uid=uid,Root=(RectTransform)root.transform};
            var hit=UIKit.GetOrAdd<Image>(root);hit.color=Color.clear;
            tile.Button=UIKit.GetOrAdd<Button>(root);tile.Button.targetGraphic=hit;
            tile.Mark=new GameObject("sacrificeSelection",typeof(RectTransform));tile.Mark.transform.SetParent(root.transform,false);UiExt.Stretch((RectTransform)tile.Mark.transform);
            void Edge(Vector2 min,Vector2 max,Vector2 low,Vector2 high)
            {
                var edge=new GameObject("selection-edge",typeof(RectTransform));edge.transform.SetParent(tile.Mark.transform,false);
                var rect=(RectTransform)edge.transform;rect.anchorMin=min;rect.anchorMax=max;rect.offsetMin=low;rect.offsetMax=high;
                var line=UIKit.GetOrAdd<Image>(edge);line.color=Theme.Hex("#d6b36d");line.raycastTarget=false;
            }
            Edge(Vector2.zero,new Vector2(1,0),Vector2.zero,new Vector2(0,3));
            Edge(new Vector2(0,1),Vector2.one,new Vector2(0,-3),Vector2.zero);
            Edge(Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(3,0));
            Edge(new Vector2(1,0),Vector2.one,new Vector2(-3,0),Vector2.zero);
            tile.State=UIKit.Label(root.transform,"",20,Theme.Txt);tile.State.name="sacrificeState-"+uid;tile.State.alignment=TextAnchor.MiddleCenter;
            var stateRect=tile.State.rectTransform;stateRect.anchorMin=new Vector2(0,0);stateRect.anchorMax=new Vector2(1,0);stateRect.pivot=new Vector2(.5f,0);stateRect.offsetMin=new Vector2(0,2);stateRect.offsetMax=new Vector2(0,40);tile.State.raycastTarget=false;
            return tile;
        }
        void Face(Candidate tile,CardDef card,string definition)
        {
            tile.Card=card;
            if(tile.Definition==definition)return;
            tile.Definition=definition;
            if(tile.Face!=null){tile.Face.SetActive(false);Destroy(tile.Face);}
            tile.Face=CardFace.Create(card,CardSize.Xl,tile.Root,options:new CardFaceOptions{HideCost=false,ScrollDescription=false});
            var rect=(RectTransform)tile.Face.transform;rect.anchorMin=rect.anchorMax=rect.pivot=new Vector2(.5f,1);rect.anchoredPosition=Vector2.zero;
            foreach(var graphic in tile.Face.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;
            tile.Mark.transform.SetAsLastSibling();tile.State.transform.SetAsLastSibling();
        }
        void Bind(Candidate tile)
        {
            int revision=_revision;
            tile.Button.onClick=new Button.ButtonClickedEvent();
            tile.Button.onClick.AddListener(()=>Toggle(tile,revision));
        }
        void AlignCandidates()
        {
            _revision++;
            var entries=_runtime.GetSacrificeCandidates();var allowed=new HashSet<string>(entries.Select(entry=>entry.uid));
            _selected.RemoveWhere(uid=>!allowed.Contains(uid));_removed.Clear();
            foreach(var uid in _tiles.Keys)if(!allowed.Contains(uid))_removed.Add(uid);
            foreach(var uid in _removed)
            {
                var tile=_tiles[uid];
                var events=EventSystem.current;if(events!=null&&events.currentSelectedGameObject==tile.Root.gameObject)events.SetSelectedGameObject(null);
                tile.Root.gameObject.SetActive(false);Destroy(tile.Root.gameObject);_tiles.Remove(uid);
            }
            int index=0;
            foreach(var entry in entries)
            {
                if(!_tiles.TryGetValue(entry.uid,out var tile)){tile=Create(entry.uid);_tiles.Add(entry.uid,tile);}
                Face(tile,entry.card,SaveJson.Stringify(entry.card));Bind(tile);tile.Root.SetSiblingIndex(index++);Selection(tile);
            }
            _grid.GetComponent<LayoutElement>().preferredHeight=entries.Count==0?0:Mathf.Ceil(entries.Count/2f)*454-20;
            int revision=_revision;_confirm.onClick=new Button.ButtonClickedEvent();_confirm.onClick.AddListener(()=>{if(revision==_revision)Confirm();});
            _empty.gameObject.SetActive(entries.Count==0);State();
        }
        void Selection(Candidate tile)
        {bool selected=_selected.Contains(tile.Uid);tile.Mark.SetActive(selected);tile.State.text=selected?"已选 · 再点撤回":"点击选择";}
        void State()
        {_count.text="已选 "+_selected.Count+" / 3";_confirm.interactable=_selected.Count==3;_notice.gameObject.SetActive(!string.IsNullOrEmpty(_notice.text));}
        void Toggle(Candidate tile,int revision)
        {
            if(!Current||_busy||revision!=_revision||!_tiles.TryGetValue(tile.Uid,out var active)||active!=tile)return;
            var entry=_runtime.GetSacrificeCandidates().FirstOrDefault(item=>item.uid==tile.Uid);
            if(entry==null||SaveJson.Stringify(entry.card)!=tile.Definition){AlignCandidates();return;}
            if(!_selected.Remove(tile.Uid)&&_selected.Count<3)_selected.Add(tile.Uid);
            _notice.text="";Selection(tile);State();AudioService.I.PlaySfx("click");
        }
        void Confirm()
        {
            if(!Current||_busy)return;
            AlignCandidates();if(_selected.Count!=3)return;
            var chosen=_runtime.GetSacrificeCandidates().Where(entry=>_selected.Contains(entry.uid)).Select(entry=>entry.uid).ToArray();
            _busy=true;
            string reason;bool success=_emergency?_runtime.TryEmergencyExtract(chosen,out reason):_runtime.TryActivateAltar(chosen,out reason);
            _busy=false;
            if(!success)
            {
                // Only this command's rollback receipt may replace the derived Map identity.
                if(!SamePlace||UiStack.Top!=this||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen)return;
                _map=_runtime.Map;_notice.text=reason;AlignCandidates();return;
            }
            bool returnAltar=!_emergency&&Current;var below=UiStack.CapturePanels().LastOrDefault(page=>page!=this);
            Close();
            if(returnAltar&&_runtime.State==_run&&_runtime.ActiveSlot==_slot&&_run.seed==_seed&&_run.layerIdx==_layer
                &&_run.trackPos==_position&&ReferenceEquals(_runtime.Map,_map)&&UiStack.Top==below)
            {AltarRitualScreen.Open();_runtime.State.Phase="modal";}
        }
        void Cancel()
        {
            if(!Current||_busy)return;
            bool emergency=_emergency;var below=UiStack.CapturePanels().LastOrDefault(page=>page!=this);Close();
            if(!SameLocation||!ReferenceEquals(_runtime.Map,_map)||UiStack.Top!=below)return;
            if(emergency)EmergencyModal.Open();else AltarRitualScreen.Open();
            _runtime.State.Phase="modal";
        }
        public override void CloseFromEscape()=>Cancel();
        internal override void OnClose()
        {bool samePlace=SamePlace;_closed=true;_revision++;UiStack.Changed-=StackChanged;if(samePlace&&UiStack.Top==null)base.OnClose();}
        void StackChanged()
        {
            if(_closed)return;
            bool covered=UiStack.Top!=this||Sdt.UI.Screens.Menu.SuggestionBox.IsOpen;
            if(!covered)
            {
                if(!OwnsSource){Close();return;}
                if(_covered){_runtime.State.Phase="modal";AlignCandidates();}
            }
            _covered=covered;
        }
        void Update()=>StackChanged();
    }
}
