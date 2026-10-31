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
        RectTransform _story, _decisions, _viewport;
        Text _title, _copy;
        public static CurrentNodeScene Create(Transform parent,string asset)
        {
            var root=CurrentNodeElements.Rect(parent,"event-scene source-node-scene");CurrentNodeElements.Stretch(root);
            var scene=UIKit.GetOrAdd<CurrentNodeScene>(root);scene.Build(asset);return scene;
        }
        void Build(string asset)
        {
            CurrentNodeElements.Background(transform,asset);CurrentNodeShade.Create(transform,"generic-scene");
            _story=CurrentNodeElements.Rect(transform,"event-story");CurrentNodeShade.Create(_story,"generic-story");
            var edge=CurrentNodeElements.Fill(_story,"story-edge","#99c6bb80");CurrentNodeElements.Stretch(edge.rectTransform);edge.rectTransform.anchorMax=new Vector2(0,1);edge.rectTransform.sizeDelta=new Vector2(2,0);
            _title=CurrentNodeElements.Text(_story,"pg-head","",26,"#9bd5ce");_title.font=Sdt.Res.Res.SansBold;_title.lineSpacing=SourceTextLayout.LineSpacing(_title,1.4f);
            _copy=CurrentNodeElements.Text(_story,"event-narrative","",22,"#e0e6e3");_copy.lineSpacing=SourceTextLayout.LineSpacing(_copy,1.65f);
            _decisions=CurrentNodeElements.Rect(transform,"event-decisions");CurrentNodeShade.Create(_decisions,"generic-decisions");
            var decisionEdge=CurrentNodeElements.Fill(_decisions,"decision-edge","#b3c7d54d");CurrentNodeElements.Stretch(decisionEdge.rectTransform);decisionEdge.rectTransform.anchorMax=new Vector2(0,1);decisionEdge.rectTransform.sizeDelta=new Vector2(1,0);
            var scroll=UIKit.Scroll(_decisions);Body=(RectTransform)scroll.transform;Body.name="node-summary";
            _viewport=Body.GetComponentInParent<ScrollRect>().GetComponent<RectTransform>();
            var flow=UIKit.GetOrAdd<VerticalLayoutGroup>(Body);flow.spacing=14;flow.padding=new RectOffset();flow.childControlWidth=flow.childControlHeight=true;flow.childForceExpandHeight=false;flow.childForceExpandWidth=true;
            Footer=CurrentNodeElements.Rect(_decisions,"node-foot");var row=UIKit.GetOrAdd<HorizontalLayoutGroup>(Footer);row.spacing=12;row.childAlignment=TextAnchor.MiddleRight;row.childControlWidth=row.childControlHeight=true;row.childForceExpandWidth=row.childForceExpandHeight=false;
        }
        public void Set(string title,string copy)
        {
            _title.text=title??"";_copy.text=App.StripIcons(copy??"");
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
            Layout();
        }
        void LateUpdate()=>Layout();
        void Layout()
        {
            var size=((RectTransform)transform).rect.size;
            float usable=Mathf.Max(1,size.x-116-62),left=usable*.54f,right=usable*.46f;
            float storyWidth=Mathf.Min(760,left),copyWidth=Mathf.Max(1,storyWidth-50);
            _copy.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,copyWidth);
            float storyHeight=Mathf.Min(Mathf.Max(90,_copy.preferredHeight+96),(size.y-146)*.7f);
            CurrentNodeElements.Fixed(_story,58,42,storyWidth,storyHeight,new Vector2(0,0),new Vector2(0,0));_story.anchoredPosition=new Vector2(58,42);
            CurrentNodeElements.Fixed(_title.rectTransform,22,22,copyWidth,37);
            CurrentNodeElements.Fixed(_copy.rectTransform,22,74,copyWidth,Mathf.Max(1,storyHeight-96));
            float content=LayoutUtility.GetPreferredHeight(Body),foot=Footer.childCount>0?80:0;
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
        public void Build(string label,string detail,string tone,Action run)
        {
            _primary=tone=="ok";_fill=UIKit.GetOrAdd<Image>(this);_fill.color=Theme.HexA("#10212b",.7f);
            Button=UIKit.GetOrAdd<Button>(this);Button.targetGraphic=_fill;Button.transition=Selectable.Transition.None;Button.onClick.AddListener(()=>run?.Invoke());
            _layout=UIKit.GetOrAdd<LayoutElement>(this);_layout.minHeight=60;_layout.flexibleWidth=1;
            if(_primary)_header=CurrentNodeElements.Fill(transform,"choice-primary-header","#9bd5ce");
            _label=CurrentNodeElements.Text(transform,"choice-label",label,26,"#eff3ee");_label.font=Sdt.Res.Res.SansBold;_label.lineSpacing=SourceTextLayout.LineSpacing(_label,1.4f);
            _detail=CurrentNodeElements.Text(transform,"choice-detail",detail??"",22,"#bccdcc");_detail.lineSpacing=SourceTextLayout.LineSpacing(_detail,1.55f);
            _arrow=CurrentNodeElements.Text(transform,"choice-arrow","→",23,"#bec5c7");_arrow.alignment=TextAnchor.MiddleCenter;
            Layout();
        }
        void LateUpdate(){Layout();_fill.color=Theme.HexA(_hover&&Button.interactable?"#24434c":"#10212b",.91f);_label.color=Theme.Hex(!Button.interactable?"#a0a8ac":_primary?"#10282a":"#eff3ee");_detail.color=Theme.Hex(Button.interactable?"#bccdcc":"#a0a8ac");}
        void Layout()
        {
            float width=Mathf.Max(80,((RectTransform)transform).rect.width);
            _label.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,width-96));
            _detail.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,width-40));
            float title=Mathf.Max(60,_label.preferredHeight+20),detail=string.IsNullOrEmpty(_detail.text)?0:_detail.preferredHeight+22;
            _layout.preferredHeight=title+detail;CurrentNodeElements.Fixed(_label.rectTransform,20,10,width-96,title-20);
            CurrentNodeElements.Fixed(_detail.rectTransform,20,title+6,width-40,Mathf.Max(1,detail-22));_detail.gameObject.SetActive(detail>0);
            CurrentNodeElements.Fixed(_arrow.rectTransform,width-48,16,31,32);
            if(_header!=null)CurrentNodeElements.Fixed(_header.rectTransform,0,0,width,title);
        }
        public void OnPointerEnter(PointerEventData e)=>_hover=true;
        public void OnPointerExit(PointerEventData e)=>_hover=false;
    }
}
