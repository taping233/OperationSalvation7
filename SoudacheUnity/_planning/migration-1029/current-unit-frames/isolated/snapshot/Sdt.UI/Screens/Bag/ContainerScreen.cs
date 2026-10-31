// Current game.container-store.view.js + container-store.css; commands remain in Sdt.Run.
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
        string _kind,_notice;
        bool _help;
        readonly float[] _scroll={1,1};
        readonly List<ScrollRect> _scrolls=new List<ScrollRect>();
        public static void Open(string kind)
        {
            if(kind!="pouch"&&kind!="pearl")return;
            var screen=ScreenMount.Show<ContainerScreen>("CardContainer");screen._kind=kind;screen.Build();
        }
        List<BagScreen.Stack> Stored()
        {
            return CardContainerCommands.StoredCards(GameRuntime.I,_kind).GroupBy(o=>BagScreen.Identity(o.card)).Select(group=>{
                var stack=new BagScreen.Stack{card=group.First().card,count=group.Count(),zone="container",key=group.Key};stack.uids.AddRange(group.Select(o=>o.uid));return stack;
            }).ToList();
        }
        public override void Build()
        {
            if(_kind==null)return;
            var runtime=GameRuntime.I;var stored=Stored();int count=stored.Sum(s=>s.count),cap=CardContainerCommands.Capacity(runtime,_kind);
            string title=_kind=="pouch"?"法师锦囊":"珍珠盒";
            var root=BagView.Rect("container-store collection-workspace",transform);float w=((RectTransform)transform).rect.width,h=((RectTransform)transform).rect.height;if(w<=0)w=1920;if(h<=0)h=1080;
            float width=Mathf.Min(1760,w-88),height=Mathf.Min(980,h-88);BagView.Place(root,(w-width)/2,(h-height)/2,width,height);BagView.Paint(root,"#202a35fa");BagView.Border(root,"#c2d2df33");
            var head=BagView.Text(root,"container-store-title",title,36,"#eef1ed");head.fontStyle=FontStyle.Bold;BagView.Place(head.rectTransform,32,24,width-240,62);
            var capacity=BagView.Text(root,"container-store-capacity","<size=38>"+count+"</size> / "+cap,22,"#9eafc0");capacity.alignment=TextAnchor.MiddleRight;BagView.Place(capacity.rectTransform,width-208,24,176,62);
            var summary=BagView.Text(root,"container-store-summary","整叠存取 · 存入后不占背包格",24,"#d1e1e5");BagView.Place(summary.rectTransform,36,100,width-72,45);
            float footerHeight=_help?180:124,contentHeight=height-160-footerHeight;
            var columns=BagView.Rect("collection-columns",root);BagView.Place(columns,0,160,width,contentHeight);_scrolls.Clear();
            var available=BagScreen.CardStacks(runtime.State,false).Where(s=>s.card.type==(_kind=="pouch"?"法术":"资源")&&s.card.id!=CardContainerCommands.PouchId).ToList();
            Column(columns,title+"中",stored,true,0,width/2,contentHeight,count,cap);
            Column(columns,"随身背包",available,false,width/2,width/2,contentHeight,count,cap);
            var footer=BagView.Rect("battle-decision-actions",root);BagView.Place(footer,0,height-footerHeight,width,footerHeight);BagView.Paint(footer,"#0e1a2480");
            var notice=BagView.Text(footer,"container-notice",_notice??"",18,"#e4bea8");BagView.Place(notice.rectTransform,36,4,width-400,36);
            var help=BagView.Button(footer,"containerHelp",(_help?"▾":"▸")+" 收纳说明",()=>{Capture();_help=!_help;Refresh();},22);BagView.Place((RectTransform)help.transform,36,42,300,44);
            if(_help){var copy=BagView.Text(footer,"containerHelpText",_kind=="pouch"?"战斗中打出锦囊，从囊内选择 1 张法术直接释放；锦囊为空时无效果。":"当前珍珠盒共可存 "+cap+" 张卡牌。把珍珠盒放进安全格，盒中卡牌在撤离失败时也会被抢运回基地。",22,"#b9c9d2");BagView.Place(copy.rectTransform,36,96,width-400,70);}
            var back=BagView.Button(footer,_kind+"Back","返回背包",()=>Close(),22);BagView.Place((RectTransform)back.transform,width-316,42,280,60);back.GetComponent<Image>().color=Theme.Hex("#b6cbd7");foreach(var t in back.GetComponentsInChildren<Text>())t.color=Theme.Hex("#17232b");
            Canvas.ForceUpdateCanvases();for(int i=0;i<_scrolls.Count;i++)_scrolls[i].verticalNormalizedPosition=_scroll[i];
        }
        void Column(RectTransform parent,string title,List<BagScreen.Stack> stacks,bool take,float x,float width,float height,int count,int cap)
        {
            var column=BagView.Rect(take?"container-stored":"container-available",parent);BagView.Place(column,x,0,width,height);BagView.Paint(column,take?"#ffffff02":"#0c121833");
            var head=BagView.Text(column,"container-column-head",title,28,"#e4edf0");BagView.Place(head.rectTransform,30,26,width-60,44);
            var content=BagView.Scroll(column,take?"stored-list":"available-list",out var scroll);BagView.Place((RectTransform)scroll.transform,30,94,width-60,height-110);_scrolls.Add(scroll);
            var flow=content.GetComponent<VerticalLayoutGroup>();DestroyImmediate(flow);content.GetComponent<ContentSizeFitter>().verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            var grid=content.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=Mathf.Max(1,Mathf.FloorToInt((width-60+24)/324));grid.cellSize=new Vector2(300,582);grid.spacing=new Vector2(24,24);
            foreach(var stack in stacks)
            {
                var entry=stack;string blocked=Reason(entry,take,count,cap);
                var slot=BagView.Rect("container-slot-"+(take?"take-":"put-")+entry.uids.FirstOrDefault(),content);
                var transfer=BagView.Button(slot,_kind+(take?"Take-":"Put-")+entry.uids.FirstOrDefault(),"",()=>Transfer(take,entry));BagView.Place((RectTransform)transfer.transform,0,0,300,502);transfer.interactable=blocked=="";
                var art=BagView.Card(transfer.transform,entry.card,300);BagView.Place((RectTransform)art.transform,0,0,300,450);
                var caption=BagView.Text(transfer.transform,"collection-label",(take?"整叠取出":"整叠存入")+" · "+entry.count+" 张",24,"#f0da9c");BagView.Place(caption.rectTransform,8,456,284,38);caption.alignment=TextAnchor.MiddleCenter;
                var inspect=BagView.Button(slot,_kind+"Inspect-"+entry.uids.FirstOrDefault(),"查看详情",()=>BagCardDetail.ShowReadOnly(entry.card),22);BagView.Place((RectTransform)inspect.transform,0,512,300,44);
                if(blocked!=""){var message=BagView.Text(slot,"container-store-blocked",blocked,18,"#e4bea8");BagView.Place(message.rectTransform,0,558,300,48);}
            }
            if(stacks.Count==0)
            {
                DestroyImmediate(grid);var label=BagView.Text(content,"container-empty",take?title+"是空的":"背包里没有"+(_kind=="pouch"?"法术":"资源")+"卡",22,"#b9cbd4");BagView.Place(label.rectTransform,0,18,width-60,52);content.sizeDelta=new Vector2(0,100);
            }
        }
        string Reason(BagScreen.Stack entry,bool take,int count,int cap)
        {
            if(!take)return count+entry.count>cap?"剩余 "+Mathf.Max(0,cap-count)+" 张空间，放不下整叠":"";
            var projection=GameRuntime.I.State.ownedCards.Select(o=>entry.uids.Contains(o.uid)?new OwnedCard{uid=o.uid,card=o.card,safe=false,stored=false}:o).ToList();
            return CardContainerCommands.Query(GameRuntime.I,projection).capacityOk?"":"背包空间不足，先腾出整叠所需空间";
        }
        void Capture(){for(int i=0;i<_scrolls.Count;i++)_scroll[i]=_scrolls[i].verticalNormalizedPosition;}
        void Refresh(){foreach(Transform child in transform){child.gameObject.SetActive(false);Destroy(child.gameObject);}Build();}
        void Transfer(bool take,BagScreen.Stack entry)
        {
            Capture();if(!CardContainerCommands.TryTransferStack(GameRuntime.I,_kind,take,entry.card.name,out var reason,entry.uids))_notice=reason;
            else _notice=take?"整叠已取回背包并保存。":"整叠已存入并保存。";
            BagScreen.Refresh();Refresh();
        }
        internal override void OnClose(){BagScreen.Refresh();}
    }
}
