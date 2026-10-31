// game.run.shop.js coinIconHTML + expedition-shop.css .shop-coin-icon.
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Run
{
    internal static class CurrentShopCoin
    {
        // The approved bitmap has transparent breathing room. Its layout box and
        // its painted image deliberately have different dimensions in the source.
        public static RectTransform Icon(Transform parent,float size)
        {
            var root=new GameObject("shop-coin-icon",typeof(RectTransform)).GetComponent<RectTransform>();root.SetParent(parent,false);root.sizeDelta=Vector2.one*size;
            var image=UIKit.Image(root,Sdt.Res.Res.Ui("coin"));image.name="ic";image.raycastTarget=false;image.preserveAspect=true;
            var art=image.rectTransform;art.anchorMin=art.anchorMax=art.pivot=Vector2.one*.5f;art.anchoredPosition=Vector2.zero;art.sizeDelta=Vector2.one*(size*1.7f);
            return root;
        }

        // Source coin consumers are nowrap flex rows. Keep each text run and the
        // coin box separate so a larger image never adds a text advance or wraps.
        internal sealed class Row
        {
            public readonly RectTransform Root;float _x;readonly float _height;
            public Row(Transform parent,string name,float height)
            {Root=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();Root.SetParent(parent,false);_height=height;Root.sizeDelta=new Vector2(0,height);}
            public void Space(float width){_x+=width;Root.sizeDelta=new Vector2(_x,_height);}
            public void Coin(float size){Add(Icon(Root,size),size,size);}
            public Text Text(string name,string value,int size,string ink,bool bold=false,float lineHeight=1.4f)
            {
                var label=UIKit.Label(Root,value,size,Theme.Hex(ink));label.name=name;label.font=bold?Sdt.Res.Res.SansBold:Sdt.Res.Res.Sans;
                label.alignment=TextAnchor.MiddleLeft;label.lineSpacing=SourceTextLayout.LineSpacing(label,lineHeight);label.horizontalOverflow=HorizontalWrapMode.Overflow;label.verticalOverflow=VerticalWrapMode.Overflow;label.raycastTarget=false;
                Add(label.rectTransform,Mathf.Ceil(label.preferredWidth),size*lineHeight);return label;
            }
            void Add(RectTransform item,float width,float height)
            {item.anchorMin=item.anchorMax=new Vector2(0,.5f);item.pivot=new Vector2(0,.5f);item.anchoredPosition=new Vector2(_x,0);item.sizeDelta=new Vector2(width,height);Space(width);}
        }

        public static void Right(RectTransform row,float right,float y)
        {row.anchorMin=row.anchorMax=new Vector2(1,.5f);row.pivot=new Vector2(1,.5f);row.anchoredPosition=new Vector2(-right,y);}
    }
}
