// Pure presentation translated from game.bag.view2.js and the final bag CSS cascade.
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
    public partial class BagScreen
    {
        readonly Dictionary<string, Button> _railButtons = new Dictionary<string, Button>();
        readonly Dictionary<string, Button> _filters = new Dictionary<string, Button>();
        readonly Dictionary<string, BagCell> _cells = new Dictionary<string, BagCell>();
        RectTransform _col, _head, _tools, _board, _content, _grid;
        Text _title, _capacity, _counts, _receipt, _empty;
        Button _sort, _tidy, _showAll;
        ScrollRect _scroll;
        Image _fill;
        float _width, _height;
        Material _backdropMaterial;
        void BuildShell()
        {
            var root = UIKit.Panel("bag-view bag-v2 ui-design-system bag-art-v3", transform);
            BagView.Paint((RectTransform)root.transform, "#101b28");
            var scene = UIKit.Image(root.transform, Sdt.Res.Res.MapArt("atmosphere")); scene.name = "bag-bg"; UiExt.Stretch(scene.rectTransform);
            var shader=Resources.Load<Shader>("BagCurrentBackdrop");if(shader!=null){_backdropMaterial=new Material(shader);scene.material=_backdropMaterial;scene.color=Color.white;}else scene.color = new Color(.6f, .6f, .6f, .34f);
            if(scene.sprite!=null){var fit=scene.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;fit.aspectRatio=scene.sprite.rect.width/scene.sprite.rect.height;}
            var dim = BagView.Rect("bag-shell-shade", root.transform); UiExt.Stretch(dim); BagView.Paint(dim, "#101b2870", false);
            var shell = BagView.Rect("bag-shell", root.transform); UiExt.Stretch(shell); shell.offsetMin = new Vector2(34,28); shell.offsetMax = new Vector2(-34,-28);
            var rail = BagView.Rect("bag-rail", shell); rail.anchorMin = Vector2.zero; rail.anchorMax = new Vector2(0,1); rail.pivot = new Vector2(0,.5f); rail.offsetMin = Vector2.zero; rail.offsetMax = new Vector2(112,0);
            BagView.Paint(rail,"#101d2ae8"); BagView.Border(rail,"#a6bed52e");
            var close = BagView.Button(rail,"closeBag","",CloseBag,22); BagView.Place((RectTransform)close.transform,24,20,64,64); BagView.Paint((RectTransform)close.transform,"#ffffff00");BagView.Glyph(close.transform,"close",24,20,20);
            string[] zones = {"bag","safe","pocket"}; string[] names = {"背包","安全格","消耗区"}; string[] icons = {"bag","lock","pocket"};
            for(int i=0;i<zones.Length;i++)
            {
                string zone=zones[i]; var button=BagView.Button(rail,"bagZone-"+zone,"",()=>SelectZone(zone));
                BagView.Place((RectTransform)button.transform,12,124+i*106,88,90);
                BagView.Glyph(button.transform,zone,30,29,9);
                var label=BagView.Text(button.transform,"bag-rlabel",names[i],18,"#b5c4cf"); BagView.Place(label.rectTransform,0,47,88,28); label.alignment=TextAnchor.MiddleCenter;
                var badge=BagView.Text(button.transform,"bag-bdg","",16,"#edf2f3"); BagView.Place(badge.rectTransform,49,-6,44,28); badge.alignment=TextAnchor.MiddleCenter;
                if(zone!="pocket") button.gameObject.AddComponent<DropZone>().kind=zone=="safe"?DropZoneKind.Safe:DropZoneKind.BagArea;
                _railButtons.Add(zone,button);
            }
            _col=BagView.Rect("bag-col",shell); UiExt.Stretch(_col); _col.offsetMin=new Vector2(136,0);
            _head=BagView.Rect("bag-head2",_col);
            _title=BagView.Text(_head,"bag-title","随身背包",36,"#edf2f3"); _title.fontStyle=FontStyle.Bold;
            _capacity=BagView.Text(_head,"bag-capchip","",20,"#b5c4cf"); _capacity.alignment=TextAnchor.UpperRight;
            _counts=BagView.Text(_head,"bag-count-summary","",18,"#b5c4cf"); _counts.alignment=TextAnchor.UpperRight;
            var bar=BagView.Rect("bag-capbar",_head); bar.anchorMin=bar.anchorMax=new Vector2(1,0); bar.pivot=Vector2.one; bar.anchoredPosition=new Vector2(0,12); bar.sizeDelta=new Vector2(360,3); BagView.Paint(bar,"#91c2c62b",false);
            var fill=BagView.Rect("bag-capbar-fill",bar); UiExt.Stretch(fill); _fill=BagView.Paint(fill,"#c9b477",false);
            _tools=BagView.Rect("bag-tools",_col);
            var filters=new[]{("all","全部"),("move","招式"),("装备","装备"),("道具","道具"),("资源","资源")};
            for(int i=0;i<filters.Length;i++)
            {
                string filter=filters[i].Item1; var button=BagView.Button(_tools,"bagFilter-"+filter,filters[i].Item2,()=>{_filter=filter;RefreshView(true);});
                BagView.Place((RectTransform)button.transform,i*108,16,100,60); _filters.Add(filter,button);
            }
            _sort=BagView.Button(_tools,"bagSortCycle","",()=>Sort(false),26); _tidy=BagView.Button(_tools,"bagTidy","",()=>Sort(true),26);BagView.Glyph(_sort.transform,"sort",26,9,9);BagView.Glyph(_tidy.transform,"tidy",26,9,9);
            _content=BagView.Scroll(_col,"bag-board",out _scroll); _board=(RectTransform)_scroll.transform; BagView.Paint(_board,"#17283a8c"); BagView.Border(_board,"#a6bed522");
            _board.gameObject.AddComponent<DropZone>().kind=DropZoneKind.BagArea;
            var flow=_content.GetComponent<VerticalLayoutGroup>(); flow.padding=new RectOffset(20,20,24,24); flow.spacing=12;
            _receipt=BagView.Text(_content,"bag-receipt","",18,"#edf2f3"); _receipt.gameObject.AddComponent<LayoutElement>().preferredHeight=52;
            _grid=BagView.Rect("bag-grid",_content); var grid=_grid.gameObject.AddComponent<GridLayoutGroup>(); grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount=5; grid.spacing=new Vector2(16,16);
            _grid.gameObject.AddComponent<LayoutElement>();
            _empty=BagView.Text(_content,"bag-empty2","暂无物品",22,"#b5c4cf"); _empty.alignment=TextAnchor.MiddleCenter; _empty.gameObject.AddComponent<LayoutElement>().preferredHeight=280;
            _showAll=BagView.Button(_content,"bagFilter-showAll","显示全部",()=>{_filter="all";RefreshView(true);}); _showAll.GetComponent<LayoutElement>().preferredHeight=60;
        }
        void RefreshView(bool retain)
        {
            if (_run == null || _run != GameRuntime.I.State) return;
            CancelInteractions();
            var selected=EventSystem.current?.currentSelectedGameObject;
            float scroll=retain?_scroll.verticalNormalizedPosition:1;
            var query=CardContainerCommands.Query(GameRuntime.I);
            int pk=_run.usedPocket.Sum(p=>p.count),bagN=CardStacks(_run,false).Sum(s=>s.count),safeN=CardStacks(_run,true).Sum(s=>s.count),supplyN=_run.inventory.Sum(i=>Math.Max(1,i.count));
            _title.text=Zone=="safe"?"安全格":Zone=="pocket"?"消耗区":"随身背包";
            int used=Zone=="safe"?query.safeUsed:Zone=="pocket"?pk:query.used,cap=Zone=="safe"?GameRuntime.I.SafeCap:query.totalCap;
            _capacity.text=Zone=="pocket"?"卡牌  <size=38><b>"+pk+"</b></size>  张 · 不限容量":"占格  <size=38><b>"+used+"</b></size> /"+cap+" 格";
            _counts.text=Zone=="pocket"?"":"卡牌 <b>"+(Zone=="safe"?safeN:bagN)+"</b> 张"+(Zone=="bag"&&supplyN>0?" · 散装物资 "+supplyN+" 件":"");
            if(Zone=="bag"&&query.resourceBonus>0) _counts.text+="\n普通可用 "+Math.Max(0,query.baseCap-query.ordinarySlots)+" 格 · 资源可用 "+Math.Max(0,query.totalCap-query.used)+" 格 · 盒内 "+CardContainerCommands.StoredCards(GameRuntime.I,"pearl").Count+"/"+query.resourceBonus+" 张（不占格）";
            _fill.transform.parent.gameObject.SetActive(Zone!="pocket"); _fill.rectTransform.anchorMax=new Vector2(Mathf.Clamp01((float)used/Math.Max(1,cap)),1);
            foreach(var pair in _railButtons)
            {
                BagView.Selected(pair.Value, pair.Key==Zone);
                pair.Value.transform.Find("bag-bdg").GetComponent<Text>().text=pair.Key=="bag"?query.used.ToString():pair.Key=="safe"?query.safeUsed+"/"+GameRuntime.I.SafeCap:pk.ToString();
            }
            foreach(var pair in _filters)BagView.Selected(pair.Value,pair.Key==_filter);
            _tools.gameObject.SetActive(Zone=="bag"); _sort.interactable=_tidy.interactable=bagN+safeN>0;
            _receipt.text=_notice??"";_receipt.gameObject.SetActive(!string.IsNullOrEmpty(_notice));
            var entries=VisibleEntries(); var retained=new HashSet<string>();
            foreach(var entry in entries)
            {
                string key=entry.supply?entry.key:entry.pocketIndex>=0?entry.key:string.Join("|",entry.uids);
                if(!_cells.TryGetValue(key,out var cell)) {cell=BagCell.Create(_grid,this,entry,entry.zone=="safe");_cells[key]=cell;}
                else cell.Bind(entry);
                cell.transform.SetSiblingIndex(retained.Count);retained.Add(key);
            }
            foreach(var pair in _cells.Where(p=>!retained.Contains(p.Key)).ToArray()) {pair.Value.gameObject.SetActive(false);Destroy(pair.Value.gameObject);_cells.Remove(pair.Key);}
            _empty.gameObject.SetActive(entries.Count==0);_empty.text=Zone=="bag"&&_filter!="all"?"暂无此类卡牌":"暂无物品";
            _showAll.gameObject.SetActive(entries.Count==0&&Zone=="bag"&&_filter!="all");
            LayoutCurrent();Canvas.ForceUpdateCanvases();_scroll.verticalNormalizedPosition=scroll;
            if(selected!=null&&selected.activeInHierarchy)EventSystem.current?.SetSelectedGameObject(selected);
            else if(UiStack.Top==this&&selected!=null)EventSystem.current?.SetSelectedGameObject(_cells.Values.FirstOrDefault()?.gameObject??_railButtons[Zone].gameObject);
        }
        void LayoutCurrent()
        {
            if(_col==null)return;
            var bounds=((RectTransform)transform).rect;_width=bounds.width>0?bounds.width:1920;_height=bounds.height>0?bounds.height:1080;
            float colWidth=_width-204,headHeight=Zone=="bag"&&CardContainerCommands.Query(GameRuntime.I).resourceBonus>0?130:112,toolsHeight=Zone=="bag"?92:0;
            BagView.Place(_head,0,0,colWidth,headHeight);BagView.Place(_title.rectTransform,0,16,400,58);
            BagView.Place(_capacity.rectTransform,Mathf.Max(400,colWidth-760),8,Mathf.Min(760,colWidth-400),48);BagView.Place(_counts.rectTransform,420,62,colWidth-420,headHeight-64);
            BagView.Place(_tools,0,headHeight,colWidth,92);BagView.Place((RectTransform)_sort.transform,colWidth-96,24,44,44);BagView.Place((RectTransform)_tidy.transform,colWidth-44,24,44,44);
            BagView.Place(_board,0,headHeight+toolsHeight+16,colWidth,_height-56-headHeight-toolsHeight-16);
            float cellWidth=(colWidth-40-64)/5,cellHeight=cellWidth*7.4f/5;
            _grid.GetComponent<GridLayoutGroup>().cellSize=new Vector2(cellWidth,cellHeight);
            int rows=(_cells.Count+4)/5;_grid.GetComponent<LayoutElement>().preferredHeight=rows==0?0:rows*cellHeight+(rows-1)*16;
            foreach(var cell in _cells.Values)cell.SetSize(cellWidth,cellHeight,_width);
        }
        void OnRectTransformDimensionsChange(){if(_col!=null)LayoutCurrent();}
    }

    internal static class BagView
    {
        internal static RectTransform Rect(string name,Transform parent){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
        internal static void Place(RectTransform rt,float x,float y,float width,float height){rt.anchorMin=rt.anchorMax=new Vector2(0,1);rt.pivot=new Vector2(0,1);rt.anchoredPosition=new Vector2(x,-y);rt.sizeDelta=new Vector2(width,height);}
        internal static Image Paint(RectTransform rt,string hex,bool hit=true){var image=UIKit.GetOrAdd<Image>(rt);image.color=Theme.Hex(hex);image.raycastTarget=hit;return image;}
        internal static void Border(RectTransform rt,string hex){var line=UIKit.GetOrAdd<Outline>(rt);line.effectColor=Theme.Hex(hex);line.effectDistance=new Vector2(1,-1);}
        internal static Text Text(Transform parent,string name,string text,int size,string color){var label=UIKit.Label(parent,text,size,Theme.Hex(color));label.name=name;return label;}
        internal static Button Button(Transform parent,string name,string label,Action action,int size=22)
        {
            var button=UIKit.Btn(parent,label,action);button.name=name;Paint((RectTransform)button.transform,"#ffffff08");Border((RectTransform)button.transform,"#a6bed52e");
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=size;text.color=Theme.Hex("#b5c4cf");}
            var colors=button.colors;colors.normalColor=Color.white;colors.highlightedColor=new Color(1.2f,1.2f,1.2f,1);colors.pressedColor=Theme.Hex("#91c2c6");colors.disabledColor=new Color(.5f,.5f,.5f,.6f);button.colors=colors;return button;
        }
        internal static void Glyph(Transform parent,string kind,float size,float x,float y){var rt=Rect("bag-glyph-"+kind,parent);Place(rt,x,y,size,size);var glyph=rt.gameObject.AddComponent<BagCurrentGlyph>();glyph.kind=kind;glyph.color=Theme.Hex("#edf2f3");glyph.raycastTarget=false;}
        internal static void Selected(Button button,bool selected){button.GetComponent<Image>().color=Theme.Hex(selected?"#44607780":"#ffffff00");var outline=button.GetComponent<Outline>();if(outline!=null)outline.effectColor=Theme.Hex(selected?"#91c2c66b":"#91c2c61a");foreach(var text in button.GetComponentsInChildren<Text>())text.color=Theme.Hex(selected?"#edf2f3":"#b5c4cf");}
        internal static RectTransform Scroll(Transform parent,string name,out ScrollRect scroll){var content=UIKit.Scroll(parent);scroll=content.GetComponentInParent<ScrollRect>();scroll.name=name;return (RectTransform)content.transform;}
        internal static GameObject Card(Transform parent,CardDef card,float width)
        {
            var host=Rect("card-art",parent);var face=CardFace.Create(card,CardSize.Xl,host);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=new Vector2(.5f,.5f);rt.anchoredPosition=Vector2.zero;ScaleCard(rt,width);host.sizeDelta=new Vector2(width,width*1.5f);
            foreach(var graphic in host.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;return host.gameObject;
        }
        internal static void ScaleCard(Transform card,float width){var size=CardFace.SizeOf(CardSize.Xl);card.localScale=Vector3.one*(width/Mathf.Min(size.x,size.y*2f/3f));}
    }
}
