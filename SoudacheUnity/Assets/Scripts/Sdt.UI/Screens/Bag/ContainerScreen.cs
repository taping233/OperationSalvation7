// Current container-store view; retain mounted controls and keep transactions in Sdt.Run.
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
    public sealed class ContainerScreen:Panel
    {
        sealed class ColumnView
        {
            public RectTransform root,content;
            public ScrollRect scroll;
            public GridLayoutGroup grid;
            public Text heading,empty;
        }
        sealed class Cell
        {
            public RectTransform root;
            public Button transfer,inspect;
            public Text caption,reason;
            public GameObject art;
            public string fingerprint;
        }
        string _kind,_notice;
        bool _help,_closed;
        int _generation;
        GameRuntime _runtime;
        RunState _run;
        BaseData _base;
        int? _slot,_seed;
        RectTransform _root,_columns,_footer;
        Text _title,_capacity,_summary,_noticeLabel,_helpText;
        Button _helpButton,_back;
        ColumnView _stored,_available;
        readonly float[] _scroll={1,1};
        readonly Dictionary<string,Cell> _cells=new Dictionary<string,Cell>();
        public static void Open(string kind)
        {
            if(kind!="pouch"&&kind!="pearl")return;
            var runtime=GameRuntime.I;
            var screen=ScreenMount.Show<ContainerScreen>("CardContainer");
            screen._kind=kind;screen._runtime=runtime;screen._run=runtime.State;screen._base=runtime.Base;
            screen._slot=runtime.ActiveSlot;screen._seed=runtime.State.seed;screen.Build();
        }
        bool Current(int generation)=>this!=null&&!_closed&&isActiveAndEnabled&&UiStack.Top==this
            &&generation==_generation&&GameRuntime.I==_runtime&&_runtime.State==_run&&_runtime.Base==_base
            &&_runtime.ActiveSlot==_slot&&_run.seed==_seed&&_run.runActive&&!_run.battleActive;
        List<BagScreen.Stack> Stored()
        {
            var result=new List<BagScreen.Stack>();var groups=new Dictionary<string,BagScreen.Stack>();
            foreach(var entry in CardContainerCommands.StoredCards(_runtime,_kind))
            {
                if(entry.card==null)continue;
                string key=BagScreen.Identity(entry.card);
                if(!groups.TryGetValue(key,out var stack))
                {
                    stack=new BagScreen.Stack{card=entry.card,zone="container",key=key};
                    groups.Add(key,stack);result.Add(stack);
                }
                stack.count++;stack.uids.Add(entry.uid);
            }
            return result;
        }
        public override void Build()
        {
            if(_kind==null||!Current(_generation))return;
            Capture();if(_root==null)BuildShell();
            int generation=++_generation;
            var selected=EventSystem.current?.currentSelectedGameObject;
            var stored=Stored();int count=stored.Sum(s=>s.count),cap=CardContainerCommands.Capacity(_runtime,_kind);
            var available=BagScreen.CardStacks(_run,false).Where(s=>s.card.type==(_kind=="pouch"?"法术":"资源")&&s.card.id!=CardContainerCommands.PouchId).ToList();
            var query=CardContainerCommands.Query(_runtime);var retained=new HashSet<string>();
            _title.text=_kind=="pouch"?"法师锦囊":"珍珠盒";
            _capacity.text="<size=38>"+count+"</size> / "+cap;
            _stored.heading.text=_title.text+"中";
            _helpText.text=_kind=="pouch"?"战斗中打出锦囊，从囊内选择 1 张法术直接释放；锦囊为空时无效果。":"当前珍珠盒共可存 "+cap+" 张卡牌。把珍珠盒放进安全格，盒中卡牌在撤离失败时也会被抢运回基地。";
            UpdateColumn(_stored,stored,true,count,cap,query,generation,retained);
            UpdateColumn(_available,available,false,count,cap,query,generation,retained);
            foreach(var key in _cells.Keys.Where(key=>!retained.Contains(key)).ToArray())
            {
                _cells[key].root.gameObject.SetActive(false);Destroy(_cells[key].root.gameObject);_cells.Remove(key);
            }
            Bind(_helpButton,generation,()=>{Capture();_help=!_help;Layout();RestoreScroll();});
            Bind(_back,generation,()=>Close());
            _noticeLabel.text=_notice??"";
            Layout();RestoreScroll();
            if(selected!=null&&selected.activeInHierarchy&&selected.GetComponent<Selectable>()?.IsInteractable()!=false)
                EventSystem.current?.SetSelectedGameObject(selected);
            else if(selected!=null)EventSystem.current?.SetSelectedGameObject(_back.gameObject);
        }
        void BuildShell()
        {
            _root=BagView.Rect("container-store collection-workspace",transform);BagView.Paint(_root,"#202a35fa");BagView.Border(_root,"#c2d2df33");
            _title=BagView.Text(_root,"container-store-title","",36,"#eef1ed");_title.fontStyle=FontStyle.Bold;
            _capacity=BagView.Text(_root,"container-store-capacity","",22,"#9eafc0");_capacity.alignment=TextAnchor.MiddleRight;
            _summary=BagView.Text(_root,"container-store-summary","整叠存取 · 存入后不占背包格",24,"#d1e1e5");
            _columns=BagView.Rect("collection-columns",_root);
            _stored=CreateColumn("container-stored",true);_available=CreateColumn("container-available",false);_available.heading.text="随身背包";
            _footer=BagView.Rect("battle-decision-actions",_root);BagView.Paint(_footer,"#0e1a2480");
            _noticeLabel=BagView.Text(_footer,"container-notice","",18,"#e4bea8");
            _helpButton=BagView.Button(_footer,"containerHelp","",null,22);
            _helpText=BagView.Text(_footer,"containerHelpText","",22,"#b9c9d2");
            _back=BagView.Button(_footer,_kind+"Back","返回背包",null,22);
            _back.GetComponent<Image>().color=Theme.Hex("#b6cbd7");foreach(var text in _back.GetComponentsInChildren<Text>())text.color=Theme.Hex("#17232b");
        }
        ColumnView CreateColumn(string name,bool stored)
        {
            var view=new ColumnView{root=BagView.Rect(name,_columns)};BagView.Paint(view.root,stored?"#ffffff02":"#0c121833");
            view.heading=BagView.Text(view.root,"container-column-head","",28,"#e4edf0");
            view.content=BagView.Scroll(view.root,stored?"stored-list":"available-list",out view.scroll);
            DestroyImmediate(view.content.GetComponent<VerticalLayoutGroup>());
            view.content.GetComponent<ContentSizeFitter>().verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            view.grid=view.content.gameObject.AddComponent<GridLayoutGroup>();view.grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;
            view.grid.cellSize=new Vector2(300,582);view.grid.spacing=new Vector2(24,24);
            view.empty=BagView.Text(view.content,"container-empty","",22,"#b9cbd4");
            return view;
        }
        void UpdateColumn(ColumnView view,List<BagScreen.Stack> stacks,bool take,int count,int cap,BagCapacityQuery query,int generation,HashSet<string> retained)
        {
            view.grid.enabled=stacks.Count>0;view.empty.gameObject.SetActive(stacks.Count==0);
            view.empty.text=take?(_kind=="pouch"?"法师锦囊":"珍珠盒")+"是空的":"背包里没有"+(_kind=="pouch"?"法术":"资源")+"卡";
            if(stacks.Count==0)view.content.sizeDelta=new Vector2(0,100);
            int index=0;
            foreach(var entry in stacks)
            {
                string key=(take?"take:":"put:")+string.Join("|",entry.uids);
                if(!_cells.TryGetValue(key,out var cell))
                {
                    cell=new Cell{root=BagView.Rect("container-slot-"+(take?"take-":"put-")+entry.uids[0],view.content)};
                    cell.transfer=BagView.Button(cell.root,_kind+(take?"Take-":"Put-")+entry.uids[0],"",null);
                    BagView.Place((RectTransform)cell.transfer.transform,0,0,300,502);
                    cell.caption=BagView.Text(cell.transfer.transform,"collection-label","",24,"#f0da9c");cell.caption.alignment=TextAnchor.MiddleCenter;
                    BagView.Place(cell.caption.rectTransform,8,456,284,38);
                    cell.inspect=BagView.Button(cell.root,_kind+"Inspect-"+entry.uids[0],"查看详情",null,22);
                    BagView.Place((RectTransform)cell.inspect.transform,0,512,300,44);
                    cell.reason=BagView.Text(cell.root,"container-store-blocked","",18,"#e4bea8");BagView.Place(cell.reason.rectTransform,0,558,300,48);
                    _cells.Add(key,cell);
                }
                string fingerprint=BagView.CardFingerprint(entry.card);
                if(cell.fingerprint!=fingerprint)
                {
                    if(cell.art!=null){cell.art.SetActive(false);Destroy(cell.art);}
                    cell.art=BagView.Card(cell.transfer.transform,entry.card,300);BagView.Place((RectTransform)cell.art.transform,0,0,300,450);
                    cell.art.transform.SetAsFirstSibling();cell.fingerprint=fingerprint;
                }
                string reason=take?(query.CanTakeFromContainer(entry.card,entry.count)?"":"背包空间不足，先腾出整叠所需空间")
                    :count+entry.count>cap?"剩余 "+Mathf.Max(0,cap-count)+" 张空间，放不下整叠":"";
                cell.caption.text=(take?"整叠取出":"整叠存入")+" · "+entry.count+" 张";
                cell.reason.text=reason;cell.reason.gameObject.SetActive(reason!="");cell.transfer.interactable=reason=="";
                Bind(cell.transfer,generation,()=>Transfer(take,entry));
                Bind(cell.inspect,generation,()=>BagCardDetail.ShowReadOnly(entry.card));
                cell.root.SetSiblingIndex(index++);retained.Add(key);
            }
        }
        void Bind(Button button,int generation,Action action)
        {
            // Replacing the event preserves an old captured event's expired generation.
            button.onClick=new Button.ButtonClickedEvent();
            button.onClick.AddListener(()=>{if(!Current(generation))return;AudioService.I.PlaySfx("click");action();});
        }
        void Layout()
        {
            if(_root==null||_back==null)return;
            float w=((RectTransform)transform).rect.width,h=((RectTransform)transform).rect.height;if(w<=0)w=1920;if(h<=0)h=1080;
            float width=Mathf.Min(1760,w-88),height=Mathf.Min(980,h-88),footerHeight=_help?180:124,contentHeight=height-160-footerHeight;
            BagView.Place(_root,(w-width)/2,(h-height)/2,width,height);BagView.Place(_title.rectTransform,32,24,width-240,62);BagView.Place(_capacity.rectTransform,width-208,24,176,62);
            BagView.Place(_summary.rectTransform,36,100,width-72,45);BagView.Place(_columns,0,160,width,contentHeight);
            LayoutColumn(_stored,0,width/2,contentHeight);LayoutColumn(_available,width/2,width/2,contentHeight);
            BagView.Place(_footer,0,height-footerHeight,width,footerHeight);BagView.Place(_noticeLabel.rectTransform,36,4,width-400,36);
            BagView.Place((RectTransform)_helpButton.transform,36,42,300,44);
            _helpButton.GetComponentInChildren<Text>().text=(_help?"▾":"▸")+" 收纳说明";
            _helpText.gameObject.SetActive(_help);BagView.Place(_helpText.rectTransform,36,96,width-400,70);BagView.Place((RectTransform)_back.transform,width-316,42,280,60);
        }
        static void LayoutColumn(ColumnView view,float x,float width,float height)
        {
            BagView.Place(view.root,x,0,width,height);BagView.Place(view.heading.rectTransform,30,26,width-60,44);
            BagView.Place((RectTransform)view.scroll.transform,30,94,width-60,height-110);
            view.grid.constraintCount=Mathf.Max(1,Mathf.FloorToInt((width-60+24)/324));
            BagView.Place(view.empty.rectTransform,0,18,width-60,52);
        }
        void Capture(){if(_stored==null)return;_scroll[0]=_stored.scroll.verticalNormalizedPosition;_scroll[1]=_available.scroll.verticalNormalizedPosition;}
        void RestoreScroll(){Canvas.ForceUpdateCanvases();_stored.scroll.verticalNormalizedPosition=_scroll[0];_available.scroll.verticalNormalizedPosition=_scroll[1];}
        void Transfer(bool take,BagScreen.Stack entry)
        {
            Capture();
            if(!CardContainerCommands.TryTransferStack(_runtime,_kind,take,entry.card.name,out var reason,entry.uids))_notice=reason;
            else _notice=take?"整叠已取回背包并保存。":"整叠已存入并保存。";
            BagScreen.Refresh();Build();
        }
        void OnRectTransformDimensionsChange(){if(_root!=null)Layout();}
        internal override void OnClose(){_closed=true;_generation++;BagScreen.Refresh();}
    }
}
