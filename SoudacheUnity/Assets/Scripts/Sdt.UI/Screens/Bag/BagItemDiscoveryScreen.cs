// Source game.bag.rules.js openBagDiscovery: choose, then confirm; saved candidates survive cancellation.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace Sdt.UI.Screens.Bag
{
    public sealed class BagItemDiscoveryScreen:Panel
    {
        sealed class Candidate
        {public CardDef Card;public string Definition;public Button Button;public GameObject Face;public Text Caption;}
        readonly List<Candidate> _tiles=new List<Candidate>();
        GameRuntime _runtime;RunState _run;MapModel _map;BagScreen _bag;OwnedCard _source;
        int? _slot,_seed;int _layer,_position,_revision;string _uid,_definition,_receipt,_reason;
        int _selected=-1;bool _busy,_closed,_expired,_covered,_prepared;
        RectTransform _root;Text _notice;Button _confirm,_cancel;
        GameObject _bagFocus,_coveredFocus;
        bool SamePlace=>GameRuntime.I==_runtime&&_runtime.State==_run&&_runtime.ActiveSlot==_slot&&_run.seed==_seed
            &&_run.layerIdx==_layer&&_run.trackPos==_position&&_run.runActive&&!_run.battleActive
            &&BagScreen.Current==_bag&&_bag!=null&&_bag.IsCurrent(_bag.Generation);
        bool Current=>this!=null&&!_closed&&isActiveAndEnabled&&UiStack.Top==this&&SamePlace
            &&ReferenceEquals(_runtime.Map,_map)&&!Sdt.UI.Screens.Menu.SuggestionBox.IsOpen;
        OwnedCard FindSource()
        {
            OwnedCard found=null;
            foreach(var entry in _run.ownedCards)if(entry.uid==_uid&&!entry.stored&&entry.safe!=true&&string.IsNullOrEmpty(entry.pouchOf))
            {if(found!=null||entry.card?.type!="道具")return null;found=entry;}
            return found;
        }
        bool SourceMatches(OwnedCard source)=>source!=null&&SaveJson.Stringify(source.card)==_definition&&SaveJson.Stringify(source.bagDiscover)==_receipt;
        bool SourceCurrent()=>Current&&ReferenceEquals(FindSource(),_source)&&SourceMatches(_source);
        public static void Open(string uid)
        {
            var g=GameRuntime.I;var bag=BagScreen.Current;
            if(bag==null||UiStack.Top!=bag||!bag.IsCurrent(bag.Generation)||!g.State.runActive||g.State.battleActive)return;
            var sources=g.State.ownedCards.Where(entry=>entry.uid==uid&&!entry.stored&&entry.safe!=true&&string.IsNullOrEmpty(entry.pouchOf)).ToArray();
            if(sources.Length!=1||sources[0].card?.type!="道具"||!BagItemCommands.NeedsDiscovery(g,uid))return;
            var focus=EventSystem.current?.currentSelectedGameObject;var screen=ScreenMount.Show<BagItemDiscoveryScreen>("BagDiscovery");screen._bagFocus=focus;
            screen._runtime=g;screen._run=g.State;screen._map=g.Map;screen._bag=bag;screen._source=sources[0];
            screen._slot=g.ActiveSlot;screen._seed=g.State.seed;screen._layer=g.State.layerIdx;screen._position=g.State.trackPos;screen._uid=uid;
            screen._definition=SaveJson.Stringify(screen._source.card);screen._receipt=SaveJson.Stringify(screen._source.bagDiscover);
            screen.Build();UiStack.Changed+=screen.StackChanged;screen.Prepare();
            if(screen.Current)EventSystem.current?.SetSelectedGameObject(screen._tiles.Count>0?screen._tiles[0].Button.gameObject:screen._confirm.gameObject);
        }
        void Prepare()
        {
            if(_busy||!SourceCurrent())return;
            _busy=true;_prepared=false;Paint();
            try
            {
                bool ok=BagItemCommands.TryPrepareDiscovery(_runtime,_uid,out var candidates,out _reason);
                if(!SamePlace||_closed||UiStack.Top!=this)return;
                if(ok)
                {
                    if(!Current||!ReferenceEquals(FindSource(),_source)||SaveJson.Stringify(_source.card)!=_definition){Expire();return;}
                    _receipt=SaveJson.Stringify(_source.bagDiscover);SetCandidates(candidates);_prepared=true;
                }
                else if(!RebindFailedCommand())Expire();
            }
            finally{_busy=false;if(!_closed&&UiStack.Top==this){Bind();Paint();}}
        }
        // Populate preserves State but replaces owned entries and rebuilds Map on rollback.
        // Only this failed synchronous command may rebind an identical source at this exact place.
        bool RebindFailedCommand()
        {
            if(_closed||!SamePlace||UiStack.Top!=this)return false;
            var source=FindSource();if(!SourceMatches(source))return false;
            _source=source;_map=_runtime.Map;return true;
        }
        void Expire(){_expired=true;_reason="本次发现来源已变化，请返回背包重新打开。";_revision++;}
        public override void Build()
        {
            if(_runtime==null||_closed)return;
            if(_root==null)
            {
                _root=BagView.Rect("reward-v14 reward-standalone-picker bag-discover",transform);BagView.Paint(_root,"#15212cef");BagView.Border(_root,"#a8bbc238");
                BagView.Text(_root,"bagDiscoverTitle","发现卡牌",36,"#eef1ed");
                _notice=BagView.Text(_root,"bagDiscoverNotice","",22,"#e4bea8");
                _confirm=BagView.Button(_root,"bagDiscoverRetry","重试",null);
                _cancel=BagView.Button(_root,"bagDiscoverCancel","取消，返回背包",null);
            }
            Layout();Bind();Paint();
        }
        void SetCandidates(List<CardDef> cards)
        {
            string selected=_selected>=0&&_selected<_tiles.Count?_tiles[_selected].Card.id:null;
            for(int i=0;i<cards.Count;i++)
            {
                if(i==_tiles.Count)
                {
                    var button=BagView.Button(_root,"bagDiscoverPick-"+i,"",null);
                    var caption=BagView.Text(button.transform,"discover-selected","",22,"#edf2f3");caption.alignment=TextAnchor.MiddleCenter;
                    _tiles.Add(new Candidate{Button=button,Caption=caption});
                }
                var tile=_tiles[i];string definition=SaveJson.Stringify(cards[i]);tile.Card=cards[i];
                if(tile.Definition!=definition)
                {
                    if(tile.Face!=null){tile.Face.SetActive(false);Destroy(tile.Face);}
                    tile.Face=BagView.Card(tile.Button.transform,cards[i],340);tile.Face.transform.SetAsFirstSibling();tile.Definition=definition;
                }
            }
            while(_tiles.Count>cards.Count){var tile=_tiles[_tiles.Count-1];tile.Button.gameObject.SetActive(false);Destroy(tile.Button.gameObject);_tiles.RemoveAt(_tiles.Count-1);}
            _selected=selected==null?-1:_tiles.FindIndex(tile=>tile.Card.id==selected);Layout();
        }
        void Bind()
        {
            int revision=++_revision;
            for(int i=0;i<_tiles.Count;i++)
            {
                int index=i;var tile=_tiles[i];string id=tile.Card.id;
                tile.Button.onClick=new Button.ButtonClickedEvent();tile.Button.onClick.AddListener(()=>
                {
                    if(revision!=_revision||_busy||_expired||!SourceCurrent()||!tile.Button.IsInteractable()||tile.Card.id!=id)return;
                    AudioService.I.PlaySfx("click");
                    _selected=index;Bind();Paint();EventSystem.current?.SetSelectedGameObject(_confirm.gameObject);
                });
            }
            string chosen=_selected>=0&&_selected<_tiles.Count?_tiles[_selected].Card.id:null;
            _confirm.onClick=new Button.ButtonClickedEvent();_confirm.onClick.AddListener(()=>
            {
                if(revision!=_revision||_busy||_expired||!SourceCurrent()||!_confirm.IsInteractable())return;
                AudioService.I.PlaySfx("click");
                if(!_prepared){Prepare();return;}if(chosen==null)return;Confirm(chosen);
            });
            _cancel.onClick=new Button.ButtonClickedEvent();_cancel.onClick.AddListener(()=>
            {if(revision==_revision&&!_busy&&!_closed&&this!=null&&isActiveAndEnabled&&SamePlace&&UiStack.Top==this&&!Sdt.UI.Screens.Menu.SuggestionBox.IsOpen&&(_expired||SourceCurrent())){AudioService.I.PlaySfx("click");Close();}});
        }
        void Confirm(string id)
        {
            _busy=true;Paint();bool ok;
            try
            {
                ok=BagItemCommands.TryChooseDiscovery(_runtime,_uid,id,out _reason);
                if(_closed||!SamePlace||UiStack.Top!=this)return;
                if(ok)
                {
                    if(!Current)return;AudioService.I.PlaySfx("ding");Close();
                    if(BagScreen.Current==_bag&&UiStack.Top==_bag)BagScreen.Refresh();
                }
                else if(!RebindFailedCommand())Expire();
            }
            finally{_busy=false;if(!_closed&&UiStack.Top==this){Bind();Paint();}}
        }
        void Paint()
        {
            if(_root==null)return;
            _notice.text=_reason?.StartsWith("保存失败",StringComparison.Ordinal)==true?"保存未成功；通行证与候选已保留，请重试。":_reason??"确认后才消耗通行证；取消可保留候选。";
            for(int i=0;i<_tiles.Count;i++)
            {
                var tile=_tiles[i];bool selected=i==_selected;
                tile.Button.GetComponent<Image>().color=Theme.Hex(selected?"#44607780":"#ffffff00");
                tile.Button.GetComponent<Outline>().effectColor=Theme.Hex(selected?"#91c2c66b":"#91c2c61a");
                tile.Caption.text=selected?"已选中":"选择此牌";tile.Button.interactable=!_busy&&!_expired&&_prepared;
                var nav=new Navigation{mode=Navigation.Mode.Explicit,selectOnLeft=_tiles[(i+_tiles.Count-1)%_tiles.Count].Button,selectOnRight=_tiles[(i+1)%_tiles.Count].Button,selectOnDown=_confirm};tile.Button.navigation=nav;
            }
            _confirm.name=_prepared?"bagDiscoverConfirm":"bagDiscoverRetry";_confirm.GetComponentInChildren<Text>().text=_prepared?"确认选择":"重试";
            _confirm.interactable=!_busy&&!_expired&&(!_prepared||_selected>=0);_cancel.interactable=!_busy;
            var selectedButton=_selected>=0?_tiles[_selected].Button:_tiles.Count>0?_tiles[0].Button:null;
            _confirm.navigation=new Navigation{mode=Navigation.Mode.Explicit,selectOnUp=selectedButton,selectOnLeft=selectedButton,selectOnRight=_cancel};
            _cancel.navigation=new Navigation{mode=Navigation.Mode.Explicit,selectOnUp=selectedButton,selectOnLeft=_confirm};
        }
        void Layout()
        {
            if(_root==null)return;var bounds=((RectTransform)transform).rect;float width=bounds.width,height=bounds.height;
            BagView.Place(_root,44,44,width-88,height-88);
            BagView.Place(((RectTransform)_root.Find("bagDiscoverTitle")),36,26,width-160,60);BagView.Place(_notice.rectTransform,36,100,width-160,60);
            float cardWidth=Mathf.Min(340,(width-240)/3),gap=40,start=(width-88-(_tiles.Count*cardWidth+Math.Max(0,_tiles.Count-1)*gap))/2;
            for(int i=0;i<_tiles.Count;i++)
            {
                var tile=_tiles[i];BagView.Place((RectTransform)tile.Button.transform,start+i*(cardWidth+gap),190,cardWidth,cardWidth*1.5f+62);
                if(tile.Face!=null){BagView.Place((RectTransform)tile.Face.transform,0,0,cardWidth,cardWidth*1.5f);BagView.ScaleCard(tile.Face.transform.GetChild(0),cardWidth);}
                BagView.Place(tile.Caption.rectTransform,0,cardWidth*1.5f+12,cardWidth,40);
            }
            BagView.Place((RectTransform)_confirm.transform,width/2-324,height-192,280,60);BagView.Place((RectTransform)_cancel.transform,width/2+4,height-192,280,60);
        }
        void StackChanged()
        {
            if(_closed)return;
            if(UiStack.Top!=this)
            {
                var focus=EventSystem.current?.currentSelectedGameObject;
                if(!_covered&&focus!=null&&focus.transform.IsChildOf(transform))_coveredFocus=focus;
                _covered=true;_revision++;return;
            }
            if(!_covered)return;_covered=false;
            if(!SourceCurrent()){Expire();Bind();Paint();return;}Prepare();
            var selected=EventSystem.current?.currentSelectedGameObject;
            if(Current&&_coveredFocus!=null&&_coveredFocus.activeInHierarchy&&(selected==null||!selected.activeInHierarchy))EventSystem.current?.SetSelectedGameObject(_coveredFocus);
        }
        void OnRectTransformDimensionsChange(){if(_root!=null)Layout();}
        void OnDisable(){_revision++;_covered=true;}
        void OnEnable(){if(_runtime!=null&&!_closed)StackChanged();}
        public override void CloseFromEscape(){if(!_closed&&!_busy&&UiStack.Top==this)Close();}
        internal override void OnClose()
        {
            _closed=true;_revision++;UiStack.Changed-=StackChanged;
            if(SamePlace&&UiStack.Top==_bag&&_bagFocus!=null&&_bagFocus.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(_bagFocus);
        }
        protected override void OnDestroy(){_closed=true;_revision++;UiStack.Changed-=StackChanged;}
    }
}
