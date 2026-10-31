// Current inventory-zoom.js workspace, with UID-owned commands from game.bag.js.
using System;
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
    public sealed class BagCardDetail:Panel
    {
        BagScreen.Stack _entry;
        string _uid,_name;
        bool _safe,_confirm;
        GameObject _returnFocus;
        public static void Show(string name,bool fromSafe)=>Show(name,fromSafe,null);
        public static void Show(string name,bool fromSafe,string uid)
        {
            var stack=BagScreen.CardStacks(GameRuntime.I.State,fromSafe).FirstOrDefault(s=>uid!=null?s.uids.Contains(uid):s.card.name==name);
            if(stack!=null)ShowEntry(stack);
        }
        public static void ShowEntry(BagScreen.Stack entry)
        {
            if(entry?.card==null||entry.supply)return;
            var screen=ScreenMount.Show<BagCardDetail>("BagCardDetail");screen._returnFocus=EventSystem.current?.currentSelectedGameObject;screen._entry=entry;screen._uid=entry.uids.FirstOrDefault();screen._name=entry.card.name;screen._safe=entry.zone=="safe";screen.Build();
        }
        public static void ShowReadOnly(CardDef card){ShowEntry(new BagScreen.Stack{card=card,count=1,zone="container",key=BagScreen.Identity(card)});}
        public static void ShowDiscardConfirm(string name,bool fromSafe,string uid=null)
        {
            var screen=ScreenMount.Show<BagCardDetail>("DiscardConfirm");screen._name=name;screen._safe=fromSafe;screen._uid=uid;screen._confirm=true;screen.Build();
        }
        public override void Build()
        {
            var root=BagView.Rect(_confirm?"discard-confirm":"inventory-zoom",transform);UiExt.Stretch(root);BagView.Paint(root,"#080e16d9");
            if(_confirm){BuildConfirm(root);return;}
            if(_entry?.card==null)return;
            if(_uid!=null)
            {
                var current=BagScreen.CardStacks(GameRuntime.I.State,_safe).FirstOrDefault(s=>s.uids.Contains(_uid));
                if(current==null){Close();BagScreen.Refresh();return;}_entry=current;
            }
            float width=((RectTransform)transform).rect.width;if(width<=0)width=1920;float height=((RectTransform)transform).rect.height;if(height<=0)height=1080;
            var layout=BagView.Rect("inventory-zoom-layout",root);BagView.Place(layout,(width-1112)/2,(height-Mathf.Min(840,height-160))/2,1112,Mathf.Min(840,height-160));
            var art=BagView.Card(layout,_entry.card,400);BagView.Place((RectTransform)art.transform,0,(layout.rect.height-600)/2,400,600);
            var info=BagView.Rect("inventory-zoom-info",layout);BagView.Place(info,472,0,640,layout.rect.height);BagView.Paint(info,"#18232df2");BagView.Border(info,"#a9c8d629");
            var title=BagView.Text(info,"inventory-zoom-title",_entry.card.name,34,"#edf3f4");title.fontStyle=FontStyle.Bold;BagView.Place(title.rectTransform,36,36,490,56);
            var type=BagView.Text(info,"inventory-zoom-type",_entry.card.type+" · "+CardVisual.EffectiveRarity(_entry.card),20,"#9edce7");BagView.Place(type.rectTransform,36,104,530,32);
            var close=BagView.Button(info,"inventoryZoomClose","×",Close,22);BagView.Place((RectTransform)close.transform,556,24,60,60);
            var body=BagView.Scroll(info,"inventory-zoom-effect",out var scroll);BagView.Place((RectTransform)scroll.transform,36,160,568,230);var flow=body.GetComponent<VerticalLayoutGroup>();flow.padding=new RectOffset(0,0,0,0);flow.spacing=14;
            var label=BagView.Text(body,"inventory-zoom-effect-label","卡牌效果",18,"#91a6b0");label.gameObject.AddComponent<LayoutElement>().preferredHeight=28;
            var rules=BagView.Text(body,"inventory-zoom-rules",_entry.card.desc??"",24,"#edf3f4");rules.lineSpacing=1.3f;
            var foot=BagView.Rect("camp-card-actions",info);BagView.Place(foot,36,416,568,info.rect.height-452);
            var vl=foot.gameObject.AddComponent<VerticalLayoutGroup>();vl.spacing=14;vl.childControlWidth=vl.childControlHeight=true;vl.childForceExpandWidth=true;vl.childForceExpandHeight=false;
            BagView.Text(foot,"inspect-count","持有 <b>×"+_entry.count+"</b> 张   "+(_safe?"安全格押运中":_entry.zone=="pocket"?"消耗区":_entry.zone=="container"?"容器卡牌":"随身背包"),22,"#d4dee3");
            BuildActions(foot);
            if(_entry.zone!="container"&&BagScreen.Current!=null)
            {
                var previous=BagView.Button(root,"inventoryZoomPrevious","‹",()=>Browse(-1),32);BagView.Place((RectTransform)previous.transform,(width-1112)/2-72,height/2-30,56,60);
                var next=BagView.Button(root,"inventoryZoomNext","›",()=>Browse(1),32);BagView.Place((RectTransform)next.transform,(width+1112)/2+16,height/2-30,56,60);
                var entries=BagScreen.Current.VisibleEntries().Where(s=>s.card!=null&&!s.supply).ToList();int index=entries.FindIndex(s=>_uid!=null?s.uids.Contains(_uid):s.pocketIndex==_entry.pocketIndex);previous.interactable=index>0;next.interactable=index>=0&&index+1<entries.Count;
            }
        }
        void BuildActions(RectTransform foot)
        {
            var card=_entry.card;
            if(_entry.zone=="container")return;
            if(_entry.zone=="pocket")
            {
                BagView.Text(foot,"inspect-collection-hint","已消耗 "+_entry.count+" 张 · "+(card.type=="道具"||card.type=="装备"?"火堆不可复原；能源结晶可按顺序复原。":"可在火堆或使用复原道具取回。"),22,"#91a6b0");return;
            }
            bool initial=BaseData.IsSha(card);
            var hint=BagView.Text(foot,"inspect-collection-hint",_safe?"撤离失败也能带回基地。":card.type=="道具"?"治疗、复原与通行证B/C可在背包使用；其余道具依效果在战斗使用。":card.type=="资源"?"不计入散装物资估值；带回后在仓库使用，计入基地库存。":"",22,"#91a6b0");hint.gameObject.SetActive(!string.IsNullOrEmpty(hint.text));
            RectTransform actions=null;int actionCount=0;
            void Action(string name,string text,System.Action action,bool enabled=true){
                if(actions==null){actions=BagView.Rect("ov-btns",foot);var grid=actions.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=2;grid.cellSize=new Vector2(279,60);grid.spacing=new Vector2(10,10);actions.gameObject.AddComponent<LayoutElement>();}
                var b=BagView.Button(actions,name,text,action);b.interactable=enabled;actionCount++;actions.GetComponent<LayoutElement>().preferredHeight=((actionCount+1)/2)*70-10;
            }
            if(!_safe&&card.type=="道具"){
                var status=UseStatus(card,_uid);Action("useDetailCard",status.label,()=>{var id=_uid;Close();UseOwnedCard(id);},string.IsNullOrEmpty(status.reason));
                if(!string.IsNullOrEmpty(status.reason))BagView.Text(foot,"bag-use-reason",status.reason,18,"#91a6b0");
            }
            if(card.id==CardContainerCommands.PearlId)Action("pearlStoreZoom","打开珍珠盒",()=>{Close();ContainerScreen.Open("pearl");});
            if(card.id==CardContainerCommands.PouchId&&!_safe)Action("pouchStoreZoom","打开锦囊（存放法术 ×3）",()=>{Close();ContainerScreen.Open("pouch");});
            if(card.id=="tt-token-gold"||card.id=="tt-token-color")Action("craftColorToken",card.id=="tt-token-gold"?"合成员工通行证A（3 张 B → 1 张 A）":"合成员工通行证A（2 碎片 + 1 通行证A）",()=>{if(BagItemCommands.TryCraftTokens(GameRuntime.I,card.id=="tt-token-gold"?"gold":"fragments",out var reason)){Close();BagScreen.Refresh();}else RunLog.Log(reason,"warn");});
            if(_safe||!initial)Action(_safe?"zoomMoveToBag":"zoomMoveToSafe",_safe?"移回背包":"移入安全格",()=>{var ids=_entry.uids.ToArray();Close();BagScreen.MoveStackSafe(card.name,!_safe,ids);});
            if(!initial)Action("detailDiscard","丢弃 1 张",()=>{Close();ShowDiscardConfirm(card.name,_safe,_uid);});
        }
        void Browse(int delta)
        {
            if(BagScreen.Current==null)return;var entries=BagScreen.Current.VisibleEntries().Where(s=>s.card!=null&&!s.supply).ToList();int index=entries.FindIndex(s=>_uid!=null?s.uids.Contains(_uid):s.pocketIndex==_entry.pocketIndex);int next=index+delta;if(index<0||next<0||next>=entries.Count)return;var entry=entries[next];Close();ShowEntry(entry);
        }
        void BuildConfirm(RectTransform root)
        {
            var box=BagView.Rect("discard-dialog",root);box.anchorMin=box.anchorMax=Vector2.one*.5f;box.sizeDelta=new Vector2(800,360);BagView.Paint(box,"#18232df2");BagView.Border(box,"#a9c8d629");
            var title=BagView.Text(box,"discard-title","丢弃卡牌？",30,"#edf3f4");BagView.Place(title.rectTransform,36,30,720,50);
            var note=BagView.Text(box,"discard-note","确认丢弃【"+_name+"】1 张？\n确认后永久丢弃，无法从消耗区或墓地取回。",22,"#d4dee3");BagView.Place(note.rectTransform,36,100,720,100);
            var yes=BagView.Button(box,"confirmDiscard","确认丢弃",()=>{if(DiscardOwnedCard(_name,_safe,_uid)){Close();}else RunLog.Log("卡牌未丢弃，请检查原位置后重试。","warn");});BagView.Place((RectTransform)yes.transform,36,260,340,60);
            var cancel=BagView.Button(box,"cancelDiscard","取消，放回背包",Close);BagView.Place((RectTransform)cancel.transform,400,260,364,60);
        }
        public static string UseBadge(CardDef card)
        {
            var ops=card?.rules?.Get("bag")?.Operations("use").ToList();
            if(card?.id=="tt3-mystery-potion")return "战斗使用";
            return ops!=null&&ops.Any(o=>o.Text("op")=="heal"||o.Text("op")=="restoreConsumed"||(new[]{"acquire","discover"}.Contains(o.Text("op"))&&new[]{"classAbility","legendary"}.Contains(o.Get("pool")?.Text("kind"))))?"可用":ops!=null&&ops.Count>0?"战斗使用":"查看用法";
        }
        public static (string label,string badge,string reason) UseStatus(CardDef card,string uid)
        {
            if(UseBadge(card)=="战斗使用")return("仅战斗中使用","战斗使用",card.id=="tt3-mystery-potion"?"神秘药水仅能在战斗中使用":"该道具的效果需要在战斗中使用");
            var operations=card.rules?.Get("bag")?.Operations("use").ToList();
            if(operations==null||operations.Count==0||operations.Any(o=>o.Text("op")=="acquire"||o.Text("op")=="discover"))return("使用这张道具",UseBadge(card),"");
            var state=GameRuntime.I.State;var failures=new System.Collections.Generic.List<(string label,string badge,string reason)>();
            foreach(var operation in operations.Where(o=>o.Text("op")=="heal"||o.Text("op")=="restoreConsumed"))
            {
                if(operation.Text("op")=="heal"){
                    int amount=operation.Text("amountField")=="heal"?(card.heal??0):operation.Number("amount");
                    if(amount<=0)failures.Add(("治疗数值无效，无法使用","效果无效","道具卡的结构化治疗数值无效；卡牌未消耗"));
                    else if(state.hp>=state.maxHp)failures.Add(("生命值已满，无需治疗","生命已满","生命值已满，暂时不需要使用；卡牌未消耗"));else return("使用这张道具",UseBadge(card),"");
                }else{
                    if(operation.Number("amount")<=0)failures.Add(("复原数量无效，无法使用","效果无效","道具卡的结构化复原数量无效；卡牌未消耗"));
                    else if(!state.usedPocket.Any(p=>p.card!=null&&p.count>0))failures.Add(("消耗区为空，无法复原","无可复原卡","消耗区是空的，无需复原"));
                    else if(!state.usedPocket.Any(p=>p.card!=null&&p.count>0&&CardContainerCommands.CanReceive(GameRuntime.I,p.card,state.ownedCards.Where(o=>o.uid!=uid))))failures.Add(("背包空间不足，先腾位再复原","需腾位","背包空间不足，先腾位再复原；卡牌未消耗"));else return("使用这张道具",UseBadge(card),"");
                }
            }
            if(failures.Count==1)return failures[0];
            return failures.Count>0?("地图效果当前均无法生效","暂不可用",string.Join("；",failures.Select(f=>f.reason).Distinct())):("使用这张道具",UseBadge(card),"");
        }
        public static bool DiscardOwnedCard(string name,bool fromSafe,string uid=null)
        {
            var entry=GameRuntime.I.State.ownedCards.FirstOrDefault(o=>(uid!=null?o.uid==uid:o.card?.name==name)&&(o.safe==true)==fromSafe&&!o.stored&&string.IsNullOrEmpty(o.pouchOf));
            if(entry==null)return false;bool ok=CardContainerCommands.TryDiscard(GameRuntime.I,entry.uid,out var reason);if(!ok)RunLog.Log(reason,"warn");BagScreen.Refresh();return ok;
        }
        public static void UseOwnedCard(string uid)
        {
            if(BagItemCommands.NeedsDiscovery(GameRuntime.I,uid)){BagItemDiscoveryScreen.Open(uid);return;}
            if(!BagItemCommands.TryUse(GameRuntime.I,uid,out var reason))RunLog.Log(reason,"warn");else AudioService.I.PlaySfx("ding");BagScreen.Refresh();
        }
        internal override void OnClose(){if(_returnFocus!=null&&_returnFocus.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(_returnFocus);}
    }
}
