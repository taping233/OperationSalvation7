// node-scene-view.js + entry-events.css non-themed event-scene.
using System;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentNodeScene : MonoBehaviour
    {
        public RectTransform Body, Footer;
        RectTransform _story, _decisions, _viewport, _narrativeViewport;
        CurrentNodeShade _sceneShade,_decisionShade;Image _decisionEdge;bool _commission;
        Text _title, _copy, _context;
        Vector2 _layoutSize=new Vector2(-1,-1);float _bodyHeight=-1,_copyHeight=-1;int _footerCount=-1;
        public static CurrentNodeScene Create(Transform parent,string asset)
        {
            var root=CurrentNodeElements.Rect(parent,"event-scene source-node-scene");CurrentNodeElements.Stretch(root);
            var scene=UIKit.GetOrAdd<CurrentNodeScene>(root);scene.Build(asset);return scene;
        }
        void Build(string asset)
        {
            CurrentNodeElements.Background(transform,asset);_sceneShade=CurrentNodeShade.Create(transform,"generic-scene");
            var context=CurrentNodeElements.Fill(transform,"event-context","#07121880");CurrentNodeElements.Fixed(context.rectTransform,58,30,760,39);
            _context=CurrentNodeElements.Text(context.transform,"node-kicker","",16,"#ccd6d6");CurrentNodeElements.Fixed(_context.rectTransform,14,8,732,23);
            _story=CurrentNodeElements.Rect(transform,"event-story");CurrentNodeShade.Create(_story,"generic-story");
            var edge=CurrentNodeElements.Fill(_story,"story-edge","#99c6bb80");CurrentNodeElements.Stretch(edge.rectTransform);edge.rectTransform.anchorMax=new Vector2(0,1);edge.rectTransform.sizeDelta=new Vector2(2,0);
            _title=CurrentNodeElements.Text(_story,"pg-head","",26,"#9bd5ce");_title.font=Sdt.Res.Res.SansBold;_title.lineSpacing=SourceTextLayout.LineSpacing(_title,1.4f);
            var narrative=UIKit.Scroll(_story);narrative.name="event-narrative-content";
            var narrativeFlow=narrative.GetComponent<VerticalLayoutGroup>();narrativeFlow.padding=new RectOffset();narrativeFlow.spacing=0;
            var narrativeScroll=narrative.GetComponentInParent<ScrollRect>();narrativeScroll.movementType=ScrollRect.MovementType.Clamped;
            _narrativeViewport=narrativeScroll.GetComponent<RectTransform>();_narrativeViewport.name="event-narrative-scroll";
            _copy=CurrentNodeElements.Text(narrative.transform,"event-narrative","",22,"#e0e6e3");_copy.lineSpacing=SourceTextLayout.LineSpacing(_copy,1.65f);_copy.verticalOverflow=VerticalWrapMode.Overflow;
            SourceTextLayout.Cjk(_copy);
            _decisions=CurrentNodeElements.Rect(transform,"event-decisions");_decisionShade=CurrentNodeShade.Create(_decisions,"generic-decisions");
            var decisionEdge=CurrentNodeElements.Fill(_decisions,"decision-edge","#b3c7d54d");CurrentNodeElements.Stretch(decisionEdge.rectTransform);decisionEdge.rectTransform.anchorMax=new Vector2(0,1);decisionEdge.rectTransform.sizeDelta=new Vector2(1,0);
            _decisionEdge=decisionEdge;
            var scroll=UIKit.Scroll(_decisions);Body=(RectTransform)scroll.transform;Body.name="node-summary";
            _viewport=Body.GetComponentInParent<ScrollRect>().GetComponent<RectTransform>();
            var flow=UIKit.GetOrAdd<VerticalLayoutGroup>(Body);flow.spacing=14;flow.padding=new RectOffset();flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandHeight=false;flow.childForceExpandWidth=true;
            Footer=CurrentNodeElements.Rect(_decisions,"node-foot");var row=UIKit.GetOrAdd<HorizontalLayoutGroup>(Footer);row.spacing=12;row.childAlignment=TextAnchor.MiddleRight;row.childControlWidth=row.childControlHeight=true;row.childForceExpandWidth=row.childForceExpandHeight=false;
        }
        public void Set(string title,string copy)
        {
            _title.text=title??"";_copy.text=App.StripIcons(copy??"");
            var game=GameRuntime.I;int layer=game.State.layerIdx;
            string area=game.Map?.Layers!=null&&layer<game.Map.Layers.Count?game.Map.Layers[layer]:"远征节点";
            area=CurrentRunHudView.AreaName(area);
            _context.text=area+"   <size=15><color=#c4c8c9>第 "+(layer+1)+" 层</color></size>";
        }
        // event-dice.css .commission-story is a single centered scroll, not a two-column event.
        // This source root lacks .shop-pg, so it retains the existing node shop art and gradient.
        public void UseCommissionLayout()
        {
            _commission=true;_sceneShade.Kind="commission";_sceneShade.SetVerticesDirty();
            _context.transform.parent.gameObject.SetActive(false);_story.gameObject.SetActive(false);_decisionShade.gameObject.SetActive(false);
            UIKit.GetOrAdd<Image>(_decisions).color=Theme.Hex("#101a23ed");_decisionEdge.color=Theme.Hex("#f2d394");
            CurrentNodeElements.Stretch(_decisionEdge.rectTransform);_decisionEdge.rectTransform.anchorMax=new Vector2(0,1);_decisionEdge.rectTransform.sizeDelta=new Vector2(4,0);
            Body.GetComponent<VerticalLayoutGroup>().spacing=20;Body.GetComponentInParent<ScrollRect>().scrollSensitivity=36;Footer.gameObject.SetActive(false);Layout();
        }
        public Button AddChoice(Transform parent,string label,string detail,string tone,Action run)
        {
            var rect=CurrentNodeElements.Rect(parent,"node-choice "+label);
            var view=UIKit.GetOrAdd<CurrentNodeChoice>(rect);view.Build(label,detail,tone,run);return view.Button;
        }
        public void Complete()
        {
            foreach(var button in Footer.GetComponentsInChildren<Button>())
            {
                var le=UIKit.GetOrAdd<LayoutElement>(button);le.minHeight=le.preferredHeight=60;
                foreach(var text in button.GetComponentsInChildren<Text>()){text.font=Sdt.Res.Res.SansBold;text.fontSize=22;text.lineSpacing=SourceTextLayout.LineSpacing(text,1.4f);}
            }
            foreach(Transform child in Footer.Cast<Transform>().Where(t=>Regex.IsMatch(t.name,"返回|留下")).ToArray())child.SetAsLastSibling();
            _layoutSize=new Vector2(-1,-1);Layout();
        }
        void LateUpdate(){if(!_commission){var context=_context.transform.parent.gameObject;bool visible=!CurrentRunTopBar.Visible;if(context.activeSelf!=visible)context.SetActive(visible);}Layout();}
        void Layout()
        {
            var size=((RectTransform)transform).rect.size;
            if(_commission)
            {
                float width=Mathf.Min(660,Mathf.Max(100,size.x-48)),inner=width-64;
                if(size!=_layoutSize){Body.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,inner);LayoutRebuilder.ForceRebuildLayoutImmediate(Body);}
                float commissionContent=Mathf.Max(1,LayoutUtility.GetPreferredHeight(Body));
                if(size==_layoutSize&&Mathf.Abs(commissionContent-_bodyHeight)<.5f)return;
                _layoutSize=size;_bodyHeight=commissionContent;float height=Mathf.Min(size.y*.85f,commissionContent+64);
                CurrentNodeElements.Fixed(_decisions,(size.x-width)*.5f,size.y*.03f,width,height);CurrentNodeElements.Fixed(_viewport,32,32,inner,Mathf.Max(1,height-64));return;
            }
            float usable=Mathf.Max(1,size.x-116-62),left=usable*.54f,right=usable*.46f;
            float storyWidth=Mathf.Min(760,left),copyWidth=Mathf.Max(1,storyWidth-50);
            if(size!=_layoutSize)_copy.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,copyWidth);
            float content=LayoutUtility.GetPreferredHeight(Body),copyHeight=_copy.preferredHeight;
            if(size==_layoutSize&&Mathf.Abs(content-_bodyHeight)<.5f&&Mathf.Abs(copyHeight-_copyHeight)<.5f&&Footer.childCount==_footerCount)return;
            _layoutSize=size;_bodyHeight=content;_copyHeight=copyHeight;_footerCount=Footer.childCount;
            float storyHeight=Mathf.Min(Mathf.Max(90,copyHeight+96),(size.y-146)*.7f);
            CurrentNodeElements.Fixed(_story,58,42,storyWidth,storyHeight,new Vector2(0,0),new Vector2(0,0));_story.anchoredPosition=new Vector2(58,42);
            CurrentNodeElements.Fixed(_title.rectTransform,22,22,copyWidth,37);
            CurrentNodeElements.Fixed(_narrativeViewport,22,74,copyWidth,Mathf.Max(1,storyHeight-96));
            float foot=Footer.childCount>0?80:0;
            float available=Mathf.Max(100,size.y-146),bodyHeight=Mathf.Min(Mathf.Max(32,content),Mathf.Max(32,available-64-foot));
            float panelHeight=Mathf.Min(available,bodyHeight+64+foot);
            CurrentNodeElements.Fixed(_decisions,58+left+62,104+(available-panelHeight)*.5f,right,panelHeight);
            CurrentNodeElements.Fixed(_viewport,32,32,Mathf.Max(1,right-64),bodyHeight);
            CurrentNodeElements.Fixed(Footer,32,32+bodyHeight+20,Mathf.Max(1,right-64),60);
        }
    }
    public sealed class CurrentNodeChoice : MonoBehaviour,IPointerEnterHandler,IPointerExitHandler
    {
        public Button Button;Text _label,_detail,_arrow;Image _fill,_header;LayoutElement _layout;bool _primary,_hover;
        float _width=-1,_titleHeight=-1,_detailHeight=-1;bool? _interactable;
        public void Build(string label,string detail,string tone,Action run)
        {
            _primary=tone=="ok";_fill=UIKit.GetOrAdd<Image>(this);_fill.color=Color.clear;
            Button=UIKit.GetOrAdd<Button>(this);Button.targetGraphic=_fill;Button.transition=Selectable.Transition.None;Button.onClick.AddListener(()=>run?.Invoke());
            _layout=UIKit.GetOrAdd<LayoutElement>(this);_layout.minHeight=60;_layout.flexibleWidth=1;
            if(_primary)_header=CurrentNodeElements.Fill(transform,"choice-primary-header","#9bd5ce");
            _label=CurrentNodeElements.Text(transform,"choice-label",label,26,"#eff3ee");_label.font=Sdt.Res.Res.SansBold;_label.lineSpacing=SourceTextLayout.LineSpacing(_label,1.4f);
            _detail=CurrentNodeElements.Text(transform,"choice-detail",detail??"",22,"#bccdcc");_detail.lineSpacing=SourceTextLayout.LineSpacing(_detail,1.55f);
            SourceTextLayout.Cjk(_detail);
            _arrow=CurrentNodeElements.Text(transform,"choice-arrow","→",23,"#bec5c7");_arrow.alignment=TextAnchor.MiddleCenter;
            foreach(var text in new[]{_label,_detail,_arrow})if(text is InlineIconText inline)inline.DisabledOpacity=1;
            Layout();
        }
        void LateUpdate(){if(_interactable!=Button.interactable){_interactable=Button.interactable;_arrow.text=Button.interactable?"→":"不可选";_arrow.fontSize=Button.interactable?23:16;_arrow.color=Theme.Hex(!Button.interactable?"#a1a9ad":_primary?"#17392f":"#bec5c7");_label.color=Theme.Hex(!Button.interactable?"#a0a8ac":_primary?"#10282a":"#eff3ee");_detail.color=Theme.Hex(Button.interactable?"#bccdcc":"#a0a8ac");_width=-1;Paint();}Layout();}
        void Layout()
        {
            float width=Mathf.Max(80,((RectTransform)transform).rect.width);
            if(width!=_width){_label.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,width-96));_detail.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,width-40));}
            float title=Mathf.Max(60,_label.preferredHeight+20),detail=string.IsNullOrEmpty(_detail.text)?0:_detail.preferredHeight+22;
            if(width==_width&&Mathf.Abs(title-_titleHeight)<.5f&&Mathf.Abs(detail-_detailHeight)<.5f)return;
            _width=width;_titleHeight=title;_detailHeight=detail;
            _layout.preferredHeight=title+detail;CurrentNodeElements.Fixed(_label.rectTransform,20,10,width-96,title-20);
            CurrentNodeElements.Fixed(_detail.rectTransform,20,title+6,width-40,Mathf.Max(1,detail-22));_detail.gameObject.SetActive(detail>0);
            CurrentNodeElements.Fixed(_arrow.rectTransform,width-(Button.interactable?48:76),Button.interactable?16:19,Button.interactable?31:64,32);
            if(_header!=null)CurrentNodeElements.Fixed(_header.rectTransform,0,0,width,title);
        }
        void Paint(){_fill.color=Button.interactable&&_hover?Theme.HexA("#24434c",.91f):Color.clear;}
        public void OnPointerEnter(PointerEventData e){_hover=true;Paint();}
        public void OnPointerExit(PointerEventData e){_hover=false;Paint();}
    }
}
