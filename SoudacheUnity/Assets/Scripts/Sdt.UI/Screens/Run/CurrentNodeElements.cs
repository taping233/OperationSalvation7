using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public static class CurrentNodeElements
    {
        public static RectTransform Rect(Transform parent,string name)
        {var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
        public static void Fixed(RectTransform rect,float x,float y,float width,float height,Vector2? anchor=null,Vector2? pivot=null)
        {rect.anchorMin=rect.anchorMax=anchor??new Vector2(0,1);rect.pivot=pivot??new Vector2(0,1);rect.anchoredPosition=new Vector2(x,-y);rect.sizeDelta=new Vector2(width,height);}
        public static void Stretch(RectTransform rect,float left=0,float top=0,float right=0,float bottom=0)
        {rect.anchorMin=Vector2.zero;rect.anchorMax=Vector2.one;rect.offsetMin=new Vector2(left,bottom);rect.offsetMax=new Vector2(-right,-top);}
        public static Text Text(Transform parent,string name,string text,int size,string color="#eef1ed",bool bold=false)
        {var label=UIKit.Label(parent,text,size,Theme.Hex(color));label.name=name;label.fontStyle=bold?FontStyle.Bold:FontStyle.Normal;label.lineSpacing=1.2f;return label;}
        public static Image Fill(Transform parent,string name,string color)
        {var rt=Rect(parent,name);var image=UIKit.GetOrAdd<Image>(rt);image.color=Theme.Hex(color);image.raycastTarget=false;return image;}
        public static void Clear(Transform parent)
        {foreach(Transform child in parent){child.gameObject.SetActive(false);UnityEngine.Object.Destroy(child.gameObject);}}
        public static Button Button(Transform parent,string label,Action action,bool primary=false)
        {
            var button=UIKit.Btn(parent,label,action);button.name=label;
            var image=button.image;image.color=Theme.HexA(primary?"#b8dadd":"#ffffff",primary?.15f:.035f);
            var outline=UIKit.GetOrAdd<Outline>(button);outline.effectColor=Theme.HexA("#c1e3e6",.4f);outline.effectDistance=new Vector2(1,-1);
            var le=UIKit.GetOrAdd<LayoutElement>(button);le.minHeight=52;le.preferredHeight=52;le.minWidth=160;le.flexibleWidth=0;
            foreach(var text in button.GetComponentsInChildren<Text>()){text.fontSize=22;text.color=Theme.Hex("#edf6f3");}
            return button;
        }
        public static void Background(Transform parent,string key)
        {
            var root=Rect(parent,"source-background");Stretch(root);UIKit.GetOrAdd<RectMask2D>(root);
            var image=UIKit.Image(root,Sdt.Res.CurrentNodeAssets.Background(key));image.name=key;Stretch(image.rectTransform);
            var fit=UIKit.GetOrAdd<AspectRatioFitter>(image);fit.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;
            if(image.sprite!=null)fit.aspectRatio=image.sprite.rect.width/image.sprite.rect.height;
        }
    }
}
