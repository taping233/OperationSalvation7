// Current node-scene-view.js + illustrated-node.css. Business owners supply actions.
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentIllustratedNode:MonoBehaviour
    {
        public RectTransform Body,Footer;
        RectTransform _story,_decisions;Text _title,_copy;
        readonly List<CurrentIllustratedChoice> _choices=new List<CurrentIllustratedChoice>();
        string _signature;int _selected=-1;bool _confirm,_executing;
        Panel _owner;
        public Action OnResume;bool _active=true;
        public static CurrentIllustratedNode Create(Transform parent,string asset,string title,string copy)
        {
            var root=CurrentNodeElements.Rect(parent,"event-themed illustrated-node");CurrentNodeElements.Stretch(root);
            var view=UIKit.GetOrAdd<CurrentIllustratedNode>(root);view.Build(asset);view.Set(title,copy);return view;
        }
        void Build(string asset)
        {
            _owner=GetComponentInParent<Panel>();CurrentNodeElements.Background(transform,asset);
            CurrentNodeShade.Create(transform,"scene");
            _story=CurrentNodeElements.Rect(transform,"event-story");
            CurrentNodeShade.Create(_story,"story");
            var emblem=UIKit.Image(_story,Sdt.Res.CurrentNodeAssets.Ghost("explore"));emblem.color=Theme.HexA("#b6cbd7",.7f);CurrentNodeElements.Fixed(emblem.rectTransform,10,8,72,90,new Vector2(0,0),new Vector2(0,0));emblem.rectTransform.anchoredPosition=new Vector2(10,8);
            _title=CurrentNodeElements.Text(_story,"pg-head","",25,"#b6cbd7");
            _copy=CurrentNodeElements.Text(_story,"event-narrative","",19,"#e0e5df");_copy.lineSpacing=1.35f;
            _decisions=CurrentNodeElements.Rect(transform,"event-decisions");
            var scroll=UIKit.Scroll(_decisions);Body=(RectTransform)scroll.transform;Body.name="node-summary";
            var layout=UIKit.GetOrAdd<VerticalLayoutGroup>(Body);layout.spacing=32;layout.padding=new RectOffset(8,8,8,8);layout.childControlHeight=layout.childControlWidth=true;layout.childForceExpandHeight=false;
            Footer=CurrentNodeElements.Rect(_decisions,"node-foot");var row=UIKit.GetOrAdd<HorizontalLayoutGroup>(Footer);row.spacing=12;row.childAlignment=TextAnchor.MiddleRight;row.childControlWidth=row.childControlHeight=true;row.childForceExpandWidth=row.childForceExpandHeight=false;
        }
        public void Set(string title,string copy)
        {
            string signature=title+"\n"+copy;if(_signature!=signature){_signature=signature;_selected=-1;}
            _title.text=title??"";_copy.text=App.StripIcons(copy??"");_choices.Clear();_executing=false;_size=new Vector2(-1,-1);
        }
        public void ClearContent(){CurrentNodeElements.Clear(Body);CurrentNodeElements.Clear(Footer);_choices.Clear();}
        public static string ChoiceArt(string text)
        {
            if(Regex.IsMatch(text??"","冒险|挖|深入|破拆|深处"))return "breach";
            if(Regex.IsMatch(text??"","战斗|应战|攻击|反击"))return "fight";
            if(Regex.IsMatch(text??"","离开|返回|放弃|绕行|逃"))return "leave";
            if(Regex.IsMatch(text??"","生命|治疗|休息|救助|回复"))return "heal";
            if(Regex.IsMatch(text??"","复原|卡牌|职业|法术|招式"))return "cards";
            if(Regex.IsMatch(text??"","箱|开启|储备|补给"))return "chest";
            if(Regex.IsMatch(text??"","币|搜寻|搜刮|支付|购买|交易"))return "search";return "explore";
        }
        public Button AddChoice(Transform parent,string label,string detail,string tone,Action run)
        {
            var rt=CurrentNodeElements.Rect(parent,"illustrated-choice "+label);var choice=UIKit.GetOrAdd<CurrentIllustratedChoice>(rt);
            choice.Build(this,label,detail,ChoiceArt(label+" "+detail),()=>Activate(choice),run);_choices.Add(choice);return choice.Button;
        }
        public void Complete(bool confirm)
        {
            _confirm=confirm&&_choices.Count>1;
            if(_selected>=_choices.Count||_selected>=0&&!_choices[_selected].Button.interactable)_selected=-1;
            Sync();Layout();
        }
        void Activate(CurrentIllustratedChoice choice)
        {
            if(_executing||UiStack.Top!=_owner||!choice.Button.interactable)return;
            if(_confirm){int index=_choices.IndexOf(choice);_selected=_selected==index?-1:index;Sync();}else Execute(choice);
        }
        internal void Execute(CurrentIllustratedChoice choice)
        {
            if(_executing||UiStack.Top!=_owner||!choice.Button.interactable)return;
            _executing=true;Sync();try{choice.Run?.Invoke();}finally{if(this!=null){_executing=false;Sync();}}
        }
        void Sync(){for(int i=0;i<_choices.Count;i++)_choices[i].Select(_confirm&&i==_selected,_executing);}
        void LateUpdate(){bool active=UiStack.Top==_owner;if(active&&!_active){_active=true;OnResume?.Invoke();}_active=active;Layout();}
        Vector2 _size;float _contentHeight=-1;
        void Layout()
        {
            var root=(RectTransform)transform;float content=LayoutUtility.GetPreferredHeight(Body);if(_size==root.rect.size&&Mathf.Abs(_contentHeight-content)<.5f)return;_size=root.rect.size;_contentHeight=content;
            float inner=Mathf.Max(0,_size.x-84-54),left=inner*.58f,right=inner*.42f;
            _copy.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,left-122));
            float storyHeight=string.IsNullOrEmpty(_copy.text)?58:Mathf.Min(430,_copy.preferredHeight+68);
            CurrentNodeElements.Fixed(_story,42,110+Mathf.Clamp(_size.y*.17f,100,180),left,storyHeight,new Vector2(0,0),new Vector2(0,0));
            _story.anchoredPosition=new Vector2(42,110+Mathf.Clamp(_size.y*.17f,100,180));
            CurrentNodeElements.Fixed(_title.rectTransform,102,12,Mathf.Max(0,left-122),40);
            CurrentNodeElements.Fixed(_copy.rectTransform,102,58,Mathf.Max(0,left-122),Mathf.Max(0,storyHeight-70));
            _decisions.anchorMin=Vector2.zero;_decisions.anchorMax=Vector2.one;
            _decisions.offsetMin=new Vector2(42+left+54,110);_decisions.offsetMax=new Vector2(-42,-118);
            var viewport=Body.GetComponentInParent<ScrollRect>().GetComponent<RectTransform>();float foot=Footer.childCount>0?76:0;float height=Mathf.Min(Mathf.Max(48,content),Mathf.Max(48,_size.y-228-foot));CurrentNodeElements.Fixed(viewport,0,0,right,height);
            CurrentNodeElements.Fixed(Footer,0,height+18,right,64);
        }
    }
    public sealed class CurrentIllustratedChoice:MonoBehaviour,IPointerEnterHandler,IPointerExitHandler
    {
        public Button Button;public Action Run;
        Button _confirm;Text _confirmCopy,_title,_detail;Image _ghost;LayoutElement _layout;RawImage _paper;RectTransform _rect;bool _selected,_hover;CurrentIllustratedNode _view;
        public void Build(CurrentIllustratedNode view,string label,string detail,string art,Action choose,Action run)
        {
            _view=view;Run=run;_rect=(RectTransform)transform;
            var le=UIKit.GetOrAdd<LayoutElement>(this);_layout=le;le.minHeight=174;le.preferredHeight=174;le.flexibleWidth=1;
            var hit=UIKit.GetOrAdd<Image>(this);hit.color=Color.clear;Button=UIKit.GetOrAdd<Button>(this);Button.targetGraphic=hit;Button.transition=Selectable.Transition.None;Button.onClick.AddListener(()=>choose());
            var paper=CurrentNodeElements.Rect(transform,"choice-winter-v1");_paper=UIKit.GetOrAdd<RawImage>(paper);
            _paper.texture=Sdt.Res.CurrentNodeAssets.Choice?.texture;_paper.raycastTarget=false;_paper.uvRect=new Rect(0,(1-1/1.45f)*.5f,1,1/1.45f);CurrentNodeElements.Stretch(paper,-8,-7,-8,-7);
            var title=CurrentNodeElements.Text(transform,"choice-label",label,23);_title=title;title.rectTransform.anchorMin=new Vector2(0,1);title.rectTransform.anchorMax=new Vector2(1,1);title.rectTransform.pivot=new Vector2(.5f,1);title.rectTransform.sizeDelta=new Vector2(-92,43);title.rectTransform.anchoredPosition=new Vector2(10,-8);title.rectTransform.offsetMin=new Vector2(56,-51);title.rectTransform.offsetMax=new Vector2(-36,-8);
            var copy=CurrentNodeElements.Text(transform,"choice-detail",App.StripIcons(detail??""),19,"#45545f");_detail=copy;CurrentNodeElements.Stretch(copy.rectTransform,56,76,148,24);copy.lineSpacing=1.25f;
            var ghost=UIKit.Image(transform,Sdt.Res.CurrentNodeAssets.Ghost(art));_ghost=ghost;ghost.color=Theme.HexA("#445d6d",.14f);CurrentNodeElements.Fixed(ghost.rectTransform,-24,18,122,98,new Vector2(1,0),new Vector2(1,0));ghost.rectTransform.anchoredPosition=new Vector2(-24,18);
            var confirmRect=CurrentNodeElements.Rect(transform,"event-inline-confirm");CurrentNodeElements.Fixed(confirmRect,-4,8,146,158,new Vector2(1,1),new Vector2(1,1));
            var shade=UIKit.GetOrAdd<Image>(confirmRect);shade.color=Color.clear;CurrentNodeShade.Create(confirmRect,"confirm");_confirm=UIKit.GetOrAdd<Button>(confirmRect);_confirm.targetGraphic=shade;_confirm.onClick.AddListener(()=>_view.Execute(this));
            _confirmCopy=CurrentNodeElements.Text(confirmRect,"confirm-copy","确认选择",15);CurrentNodeElements.Fixed(_confirmCopy.rectTransform,10,30,126,28);_confirmCopy.alignment=TextAnchor.MiddleCenter;
            var mark=CurrentNodeElements.Text(confirmRect,"confirm-mark","✓",30,"#b9d6e3",true);CurrentNodeElements.Fixed(mark.rectTransform,48,76,50,46);mark.alignment=TextAnchor.MiddleCenter;_confirm.gameObject.SetActive(false);
        }
        public void Select(bool selected,bool busy){_selected=selected;_confirm.gameObject.SetActive(selected);_confirm.interactable=!busy&&Button.interactable;_confirmCopy.text=busy?"正在处理…":"确认选择";Paint();}
        void Paint(){_paper.color=new Color(1,1,1,_selected||_hover?1:.96f);if(_ghost!=null)_ghost.color=Theme.HexA("#445d6d",_selected?.06f:.14f);}
        void LateUpdate(){if(_layout!=null){float title=Mathf.Max(43,_title.preferredHeight+10);float height=Mathf.Max(174,title+49+_detail.preferredHeight);if(Mathf.Abs(_layout.preferredHeight-height)>.5f)_layout.preferredHeight=height;}}
        public void OnPointerEnter(PointerEventData e){_hover=true;Paint();}
        public void OnPointerExit(PointerEventData e){_hover=false;Paint();}
    }
}
