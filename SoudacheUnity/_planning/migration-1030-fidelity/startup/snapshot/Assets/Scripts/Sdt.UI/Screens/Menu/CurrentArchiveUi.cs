using System;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
namespace Sdt.UI.Screens.Menu
{
    internal static class CurrentArchiveUi
    {
        public static Color Color(string hex)=>Theme.Hex(hex);
        public static RectTransform Area(Transform parent,string name,Vector2 min,Vector2 max,Vector2 low,Vector2 high)
        {var rect=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();rect.SetParent(parent,false);rect.anchorMin=min;rect.anchorMax=max;rect.offsetMin=low;rect.offsetMax=high;return rect;}
        public static RectTransform Full(Transform parent,string name)=>Area(parent,name,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);
        public static RectTransform Box(Transform parent,string name,float x,float y,float width,float height)
        {var rect=Area(parent,name,new Vector2(0,1),new Vector2(0,1),new Vector2(x,-y-height),new Vector2(x+width,-y));return rect;}
        public static void Fill(RectTransform rect,Vector2 low=default,Vector2 high=default){rect.anchorMin=Vector2.zero;rect.anchorMax=Vector2.one;rect.offsetMin=low;rect.offsetMax=high;}
        public static LayoutElement Size(Component node,float width,float height,float flexW=0,float flexH=0)
        {var le=UIKit.GetOrAdd<LayoutElement>(node);le.minWidth=le.preferredWidth=width;le.minHeight=le.preferredHeight=height;le.flexibleWidth=flexW;le.flexibleHeight=flexH;return le;}
        public static Image Paint(Transform parent,string key,string name=null)
        {var image=UIKit.Image(parent,CurrentArchiveAssets.Load(key));image.name=name??key;Fill(image.rectTransform);image.raycastTarget=false;return image;}
        public static Image Surface(Transform parent,string hex)
        {var image=UIKit.GetOrAdd<Image>(parent);image.color=Color(hex);return image;}
        public static void Border(Transform parent,string hex,float inset=0)
        {
            void Line(string name,Vector2 min,Vector2 max,Vector2 lo,Vector2 hi){var line=Area(parent,name,min,max,lo,hi);Surface(line,hex).raycastTarget=false;}
            Line("border-top",new Vector2(0,1),Vector2.one,new Vector2(inset,-inset-1),new Vector2(-inset,-inset));Line("border-bottom",Vector2.zero,new Vector2(1,0),new Vector2(inset,inset),new Vector2(-inset,inset+1));
            Line("border-left",Vector2.zero,new Vector2(0,1),new Vector2(inset,inset),new Vector2(inset+1,-inset));Line("border-right",new Vector2(1,0),Vector2.one,new Vector2(-inset-1,inset),new Vector2(-inset,-inset));
        }
        public static Text Text(Transform parent,string value,int size,string ink,bool bold=false)
        {var text=UIKit.Label(parent,value,size,Color(ink));text.fontStyle=bold?FontStyle.Bold:FontStyle.Normal;text.supportRichText=true;text.horizontalOverflow=HorizontalWrapMode.Wrap;text.verticalOverflow=VerticalWrapMode.Truncate;return text;}
        public static Text FlowText(Transform parent,string value,int size,string ink,float height,bool bold=false)
        {var text=Text(parent,value,size,ink,bold);Size(text,0,height,1);return text;}
        public static Button Button(Transform parent,string name,string caption,Action action,string background,string ink,int font=20)
        {var root=new GameObject(name,typeof(RectTransform));root.transform.SetParent(parent,false);var image=Surface(root.transform,background);var button=UIKit.GetOrAdd<Button>(root);button.targetGraphic=image;button.onClick.AddListener(()=>{AudioService.I.PlaySfx("click");action?.Invoke();});var label=Text(root.transform,caption,font,ink);label.alignment=TextAnchor.MiddleCenter;label.horizontalOverflow=HorizontalWrapMode.Overflow;Fill(label.rectTransform,new Vector2(8,0),new Vector2(-8,0));var colors=button.colors;colors.normalColor=UnityEngine.Color.white;colors.highlightedColor=new UnityEngine.Color(1.08f,1.08f,1.08f,1);colors.pressedColor=new UnityEngine.Color(.9f,.9f,.9f,1);colors.selectedColor=colors.normalColor;button.colors=colors;return button;}
        public static Transform Column(Transform parent,string name,float gap,RectOffset padding=null)
        {var root=new GameObject(name,typeof(RectTransform));root.transform.SetParent(parent,false);var group=UIKit.GetOrAdd<VerticalLayoutGroup>(root);group.spacing=gap;group.padding=padding??new RectOffset();group.childControlWidth=group.childControlHeight=true;group.childForceExpandWidth=true;group.childForceExpandHeight=false;return root.transform;}
        public static Transform Row(Transform parent,string name,float gap)
        {var root=new GameObject(name,typeof(RectTransform));root.transform.SetParent(parent,false);var group=UIKit.GetOrAdd<HorizontalLayoutGroup>(root);group.spacing=gap;group.childControlWidth=group.childControlHeight=true;group.childForceExpandWidth=group.childForceExpandHeight=false;group.childAlignment=TextAnchor.MiddleLeft;return root.transform;}
        public static Transform Scroll(Transform parent,string name,Vector2 min,Vector2 max,Vector2 low,Vector2 high)
        {var root=UIKit.Scroll(parent);root.transform.parent.name=name;var viewport=(RectTransform)root.transform.parent;viewport.anchorMin=min;viewport.anchorMax=max;viewport.offsetMin=low;viewport.offsetMax=high;viewport.GetComponent<Image>().color=UnityEngine.Color.clear;return root.transform;}
        public static InputField Search(Transform parent,string name,string hint,Action<string> changed)
        {
            var rect=Full(parent,name);Surface(rect,"#f7f8f5");Border(rect,"#bdc7bf");var mark=Text(rect,"⌕",20,"#637068");Fill(mark.rectTransform,new Vector2(12,8),new Vector2(-380,-8));mark.alignment=TextAnchor.MiddleLeft;var clip=Full(rect,"search-viewport");Fill(clip,new Vector2(40,8),new Vector2(-12,-8));UIKit.GetOrAdd<RectMask2D>(clip);
            var text=Text(clip,"",20,"#303735");Fill(text.rectTransform);text.horizontalOverflow=HorizontalWrapMode.Overflow;var placeholder=Text(clip,hint,20,"#637068");Fill(placeholder.rectTransform);placeholder.horizontalOverflow=HorizontalWrapMode.Overflow;
            var field=UIKit.GetOrAdd<InputField>(rect);field.textComponent=text;field.placeholder=placeholder;field.lineType=InputField.LineType.SingleLine;field.onValueChanged.AddListener(v=>changed(v));return field;
        }
    }
}
