// Source-local uGUI projection of base-glass-tokens/base-framework-v7, not a second design system.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        internal static readonly Color InkColor = Theme.Hex("#F2F5F0"), Muted = Theme.Hex("#B5C2C8"), Accent = Theme.Hex("#9EDCE7");
        internal static Color Ink(string value) => Theme.Hex(value);
        internal static RectTransform Area(Transform parent,string name,Vector2 min,Vector2 max,Vector2? low=null,Vector2? high=null)
        {
            var node=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>(); node.SetParent(parent,false);
            node.anchorMin=min;node.anchorMax=max;node.offsetMin=low??Vector2.zero;node.offsetMax=high??Vector2.zero;return node;
        }
        internal static void Fill(RectTransform node,Vector2? low=null,Vector2? high=null) {node.anchorMin=Vector2.zero;node.anchorMax=Vector2.one;node.offsetMin=low??Vector2.zero;node.offsetMax=high??Vector2.zero;}
        internal static void Set(Transform node,Vector2 min,Vector2 max,Vector2 low,Vector2 high) {var r=(RectTransform)node;r.anchorMin=min;r.anchorMax=max;r.offsetMin=low;r.offsetMax=high;}
        internal static Text LabelAt(Transform parent,string value,int size,Vector2 low,Vector2 high,Color? color=null)
        {var text=UIKit.Label(parent,value,size,color??InkColor);Set(text.transform,Vector2.zero,Vector2.zero,low,high);text.alignment=TextAnchor.MiddleLeft;return text;}
        internal static LayoutElement Bounds(GameObject node,float width=0,float height=0,float flexWidth=0,float flexHeight=0)
        {var le=Sdt.UI.Kit.UIKit.GetOrAdd<LayoutElement>(node);le.minWidth=width;le.preferredWidth=width;le.minHeight=height;le.preferredHeight=height;le.flexibleWidth=flexWidth;le.flexibleHeight=flexHeight;return le;}
        static void Configure(HorizontalOrVerticalLayoutGroup layout,float gap,RectOffset padding,bool expand)
        {layout.spacing=gap;layout.padding=padding;layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandWidth=expand;layout.childForceExpandHeight=false;layout.childAlignment=TextAnchor.UpperLeft;}
        internal static Transform Column(Transform parent,string name,float gap=12,RectOffset padding=null,bool flexible=true)
        {
            var box=new GameObject(name,typeof(RectTransform));box.transform.SetParent(parent,false);Configure(box.AddComponent<VerticalLayoutGroup>(),gap,padding??new RectOffset(),true);
            Bounds(box,0,0,1,flexible?1:0);return box.transform;
        }
        internal static Transform Row(Transform parent,string name,float gap=16,float height=0)
        {
            var box=new GameObject(name,typeof(RectTransform));box.transform.SetParent(parent,false);Configure(box.AddComponent<HorizontalLayoutGroup>(),gap,new RectOffset(),true);Bounds(box,0,height,1,height>0?0:1);return box.transform;
        }
        internal static Text Label(Transform parent,string text,int size=22,bool bold=false,Color? color=null)
        {var t=UIKit.Label(parent,text,size,color??InkColor);t.fontStyle=bold?FontStyle.Bold:FontStyle.Normal;var bounds=Bounds(t.gameObject,0,Mathf.Ceil(size*1.5f),1,0);bounds.preferredHeight=-1;return t;}
        static readonly Dictionary<int,Sprite> RoundedShapes=new Dictionary<int,Sprite>();
        static Sprite Rounded(float requested)
        {
            int radius=Mathf.Clamp(Mathf.RoundToInt(requested),2,32);if(RoundedShapes.TryGetValue(radius,out var sprite))return sprite;
            const int side=64;var tex=new Texture2D(side,side,TextureFormat.RGBA32,false);tex.name="base-glass-rounded-"+radius;tex.wrapMode=TextureWrapMode.Clamp;
            for(int y=0;y<side;y++)for(int x=0;x<side;x++)
            {float dx=Mathf.Max(0,Mathf.Abs(x-31.5f)-(32-radius)),dy=Mathf.Max(0,Mathf.Abs(y-31.5f)-(32-radius));float a=Mathf.Clamp01(radius-Mathf.Sqrt(dx*dx+dy*dy));tex.SetPixel(x,y,new Color(1,1,1,a));}
            tex.Apply();sprite=Sprite.Create(tex,new Rect(0,0,side,side),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(radius,radius,radius,radius));RoundedShapes[radius]=sprite;return sprite;
        }
        internal static Image Surface(Transform node,float alpha=.74f,float radius=16)
        {var image=Sdt.UI.Kit.UIKit.GetOrAdd<Image>(node);image.sprite=radius>0?Rounded(radius):null;image.type=radius>0?Image.Type.Sliced:Image.Type.Simple;image.color=Theme.HexA("#132A35",alpha);image.raycastTarget=true;HubCurrentGlass.Apply(image);var line=Sdt.UI.Kit.UIKit.GetOrAdd<Outline>(node);line.effectColor=Theme.HexA("#D2E3E3",.18f);line.effectDistance=new Vector2(1,-1);return image;}
        internal static Button Command(Transform parent,string caption,Action action,bool selected=false)
        {
            var owner=parent.GetComponentInParent<HubScreen>();int revision=owner!=null?owner._renderVersion:0;
            var button=UIKit.Btn(parent,caption,()=>{if(owner!=null&&!owner.CurrentHub(revision))return;action?.Invoke();});button.name=caption;var image=Surface(button.transform,selected ? .95f : .50f);image.color=selected?Accent:Theme.HexA("#162A35",.55f);
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=22;text.color=selected?Ink("#14242D"):InkColor;}
            Bounds(button.gameObject,0,56,1,0);var colors=button.colors;colors.highlightedColor=new Color(.78f,.94f,.96f,1);colors.pressedColor=new Color(.57f,.75f,.80f,1);colors.disabledColor=new Color(.45f,.5f,.52f,.65f);button.colors=colors;return button;
        }
        internal static void SoftSelection(Button button,bool selected,float opacity=.11f)
        {button.GetComponent<Image>().material=null;button.GetComponent<Image>().color=selected?Theme.HexA("#9EDCE7",opacity):Color.clear;var line=button.GetComponent<Outline>();line.effectColor=selected?Accent:Theme.HexA("#D2E3E3",.18f);foreach(var text in button.GetComponentsInChildren<Text>())text.color=InkColor;}
        static void Resource(Transform parent,string key,string title,int value)
        {
            var capsule=new GameObject("base-resource-value "+title,typeof(RectTransform));capsule.transform.SetParent(parent,false);Surface(capsule.transform,.76f,30);Bounds(capsule,132,54,0,0);
            var number=UIKit.Label(capsule.transform,value.ToString(),28,InkColor);number.font=Sdt.Res.Res.NumberBold;number.fontStyle=FontStyle.Bold;number.alignment=TextAnchor.MiddleLeft;Fill(number.rectTransform,new Vector2(22,4),new Vector2(-50,-4));
            var icon=UIKit.Image(capsule.transform,Sdt.Res.Res.HubArt(key));icon.preserveAspect=true;Set(icon.transform,new Vector2(1,.5f),new Vector2(1,.5f),new Vector2(-51,-23),new Vector2(-5,23));
            // Tooltip uses the same accessible name as resourceValueHTML.
            capsule.name=title+" "+value;var focus=capsule.AddComponent<Button>();focus.targetGraphic=capsule.GetComponent<Image>();capsule.AddComponent<HubResourceHint>().Caption=title;
        }
        static Transform Scroll(Transform parent,string name)
        {var content=UIKit.Scroll(parent);content.transform.parent.name=name;return content.transform;}
        static void Rule(Transform parent)
        {var go=new GameObject("base-line",typeof(RectTransform),typeof(Image));go.transform.SetParent(parent,false);go.GetComponent<Image>().color=Theme.HexA("#D2E3E3",.18f);Bounds(go,0,1,1,0);}
        static void Progress(Transform parent,float value)
        {var bar=new GameObject("progress",typeof(RectTransform),typeof(Image));bar.transform.SetParent(parent,false);bar.GetComponent<Image>().color=Theme.HexA("#D2E3E3",.15f);Bounds(bar,0,9,1,0);var fill=Area(bar.transform,"fill",Vector2.zero,new Vector2(Mathf.Clamp01(value),1));fill.gameObject.AddComponent<Image>().color=Accent;}
        static void Fact(Transform parent,string term,string value)
        {var row=Row(parent,"fact",12,40);Label(row,term,20,false,Muted);var t=Label(row,value,22,true);t.alignment=TextAnchor.MiddleRight;}
        static void CardArt(Transform parent,CardDef card,float width=210,float height=410)
        {
            var host=new GameObject("card-art",typeof(RectTransform));host.transform.SetParent(parent,false);Bounds(host,0,height,1,0);
            if(card==null){var legacy=Label(host.transform,"旧收藏档案",20,false,Muted);Fill(legacy.rectTransform);return;}
            var face=CardFace.Create(card,CardSize.Xl,host.transform);var r=(RectTransform)face.transform;r.anchorMin=r.anchorMax=new Vector2(.5f,.5f);r.anchoredPosition=Vector2.zero;r.localScale=Vector3.one*(width/(392f*2f/3f));face.GetComponent<LayoutElement>().ignoreLayout=true;
        }
        static void SelectableCard(Transform parent,CardDef card,string label,bool selected,Action action,float width=260,float height=480)
        {
            var button=Command(parent,"",action,selected);SoftSelection(button,selected);Bounds(button.gameObject,width,height,0,0);var col=Column(button.transform,"collection-item",8,new RectOffset(10,10,10,10));Fill((RectTransform)col);
            CardArt(col,card,height<250?90:height>=560?285:210,height-70);var caption=Label(col,label,height<250?13:20,false,InkColor);caption.alignment=TextAnchor.MiddleCenter;
        }
        static void Input(Transform parent,string placeholder,string value,Action<string> changed)
        {
            var box=new GameObject(placeholder,typeof(RectTransform));box.transform.SetParent(parent,false);Surface(box.transform,.7f);Bounds(box,0,54,1,0);
            var text=UIKit.Label(box.transform,value,20,InkColor);Fill(text.rectTransform,new Vector2(14,6),new Vector2(-14,-6));
            var prompt=UIKit.Label(box.transform,placeholder,20,Muted);Fill(prompt.rectTransform,new Vector2(14,6),new Vector2(-14,-6));
            var field=box.AddComponent<InputField>();field.textComponent=text;field.placeholder=prompt;field.text=value;field.onValueChanged.AddListener(v=>changed(v));
        }
        static void Filter(Transform parent,string title,string current,IEnumerable<string> values,Action<string> changed)
        {
            var options=new List<string>{""};options.AddRange(values.Where(v=>!string.IsNullOrEmpty(v)).Distinct());
            var box=new GameObject(title,typeof(RectTransform));box.transform.SetParent(parent,false);Surface(box.transform,.65f);Bounds(box,190,54,0,0);
            var dropdown=box.AddComponent<Dropdown>();dropdown.targetGraphic=box.GetComponent<Image>();
            var caption=UIKit.Label(box.transform,"",20,InkColor);Fill(caption.rectTransform,new Vector2(12,6),new Vector2(-26,-6));dropdown.captionText=caption;
            var template=Area(box.transform,"Template",new Vector2(0,0),new Vector2(1,0),new Vector2(0,-240),Vector2.zero);Surface(template,.99f);var sr=template.gameObject.AddComponent<ScrollRect>();sr.horizontal=false;
            var viewport=Area(template,"Viewport",Vector2.zero,Vector2.one);viewport.gameObject.AddComponent<RectMask2D>();viewport.gameObject.AddComponent<Image>().color=Color.clear;
            var content=Area(viewport,"Content",new Vector2(0,1),Vector2.one,new Vector2(0,-54),Vector2.zero);content.pivot=new Vector2(.5f,1);
            var item=Area(content,"Item",new Vector2(0,.5f),new Vector2(1,.5f),new Vector2(0,-27),new Vector2(0,27));var image=item.gameObject.AddComponent<Image>();image.color=Theme.HexA("#44717D",.95f);var toggle=item.gameObject.AddComponent<Toggle>();toggle.targetGraphic=image;
            var itemLabel=UIKit.Label(item,"",20,InkColor);Fill(itemLabel.rectTransform,new Vector2(12,4),new Vector2(-6,-4));dropdown.itemText=itemLabel;dropdown.template=template;sr.viewport=viewport;sr.content=content;template.gameObject.SetActive(false);
            dropdown.AddOptions(options.Select(v=>v==""?title:v).ToList());dropdown.value=Mathf.Max(0,options.IndexOf(current));dropdown.onValueChanged.AddListener(i=>changed(options[i]));
        }
    }
}


