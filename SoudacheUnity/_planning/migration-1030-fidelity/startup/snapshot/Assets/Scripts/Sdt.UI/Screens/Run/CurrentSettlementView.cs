using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    internal static class CurrentSettlementView
    {
        public static RectTransform Box(Transform p,string n,float x,float y,float w,float h)=>CurrentRunHudView.Box(p,n,x,y,w,h);
        public static Text Text(Transform p,string n,string value,float x,float y,float w,float h,int size=20,string color="#dce6e6")=>CurrentRunHudView.Text(p,n,value,x,y,w,h,size,color);
        public static Image Paint(RectTransform r,string color){var image=UIKit.GetOrAdd<Image>(r);image.color=Theme.Hex(color);image.raycastTarget=false;return image;}
        public static Button Button(Transform p,string name,string label,float x,float y,float w,float h,Action action,bool primary=false,bool danger=false)
        {
            var b=CurrentRunHudView.Button(p,name,x,y,w,h,action);b.GetComponent<Image>().color=Theme.Hex(primary?"#b6cbd7":danger?"#48332f":"#243540");
            var outline=UIKit.GetOrAdd<Outline>(b);outline.effectDistance=new Vector2(1,-1);outline.effectColor=Theme.HexA("#afc6c2",.36f);
            var t=Text(b.transform,"label",label,14,0,w-28,h,21,primary?"#17232b":danger?"#ebc7b7":"#e2eae6");t.alignment=TextAnchor.MiddleCenter;return b;
        }
        public static ScrollRect Scroll(Transform parent,string name,Vector2 min,Vector2 max,Vector2 low,Vector2 high)
        {
            var rt=Box(parent,name,0,0,0,0);rt.anchorMin=min;rt.anchorMax=max;rt.offsetMin=low;rt.offsetMax=high;
            var image=UIKit.GetOrAdd<Image>(rt);image.color=new Color(0,0,0,.002f);UIKit.GetOrAdd<RectMask2D>(rt);
            var scroll=UIKit.GetOrAdd<ScrollRect>(rt);scroll.horizontal=false;scroll.vertical=true;scroll.viewport=rt;scroll.movementType=ScrollRect.MovementType.Clamped;
            var content=Box(rt,"content",0,0,0,0);content.anchorMax=Vector2.one;content.anchorMin=new Vector2(0,1);content.pivot=new Vector2(0,1);scroll.content=content;return scroll;
        }
        public static string Memento(SettlementReceipt receipt,bool failed=false)
        {
            var m=receipt?.memento;if(m==null)return "";
            return "<b>本局纪念</b>\n"+string.Join("　",m.trail.Select(t=>"第 "+t.layer+" 层 · "+t.name+" · 探索 "+t.count+" 处"))+"\n"+string.Join("\n",m.moments)+(m.representative==null?"":"\n"+(failed?"抢运回基地":"本次入库")+"的一件纪念：<color=#c6b487>"+m.representative.name+" ×"+m.representative.count+"</color>");
        }
        public static void Background(Transform root)
        {
            var rt=Box(root,"extraction-background",0,0,0,0);UiStack.Stretch(rt);var image=UIKit.GetOrAdd<Image>(rt);image.sprite=Sdt.Res.Res.Scene("scene-extract-bg");image.color=Color.white;image.raycastTarget=false;
            var shade=Box(root,"extraction-shade",0,0,0,0);UiStack.Stretch(shade);Paint(shade,"#101d28e8");
        }
    }
    public sealed class CurrentSettlementCardZoom:Panel
    {
        CardDef _card;GameObject _focus;
        public static void Show(CardDef card){var screen=ScreenMount.Show<CurrentSettlementCardZoom>("CurrentSettlementCardZoom");screen._focus=EventSystem.current?.currentSelectedGameObject;screen._card=card;screen.Build();}
        public override void Build()
        {
            var root=CurrentSettlementView.Box(transform,"expedition-card-detail",0,0,0,0);UiStack.Stretch(root);CurrentSettlementView.Paint(root,"#080e16ed");
            var card=CardFace.Create(_card,CardSize.Xl,root);var rt=(RectTransform)card.transform;rt.anchorMin=rt.anchorMax=new Vector2(.5f,.5f);rt.anchoredPosition=new Vector2(-180,0);rt.localScale=Vector3.one*1.5f;
            CurrentSettlementView.Text(root,"card-title",_card.name,1120,340,460,60,36);
            CurrentSettlementView.Text(root,"card-rules",Sdt.Res.CurrentCardPresentation.Description(_card),1120,420,460,180,24);
            CurrentSettlementView.Button(root,"card-detail-back","返回",1120,640,220,62,Close,true);
        }
        internal override void OnClose(){if(_focus!=null)EventSystem.current?.SetSelectedGameObject(_focus);}
    }
}
