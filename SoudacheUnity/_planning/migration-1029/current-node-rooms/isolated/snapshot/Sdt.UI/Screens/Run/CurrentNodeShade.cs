// CSS gradients are UI geometry; no replacement illustration or runtime image asset.
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentNodeShade:Graphic
    {
        public string Kind;
        public static CurrentNodeShade Create(Transform parent,string kind)
        {var rt=CurrentNodeElements.Rect(parent,kind+"-source-gradient");CurrentNodeElements.Stretch(rt);var shade=UIKit.GetOrAdd<CurrentNodeShade>(rt);shade.Kind=kind;shade.raycastTarget=false;return shade;}
        Color Sample(float x,float y)
        {
            if(Kind=="story"){var c=Theme.Hex("#081217");c.a=x<.68f?Mathf.Lerp(.612f,.514f,x/.68f):Mathf.Lerp(.514f,0,(x-.68f)/.32f);return c;}
            if(Kind=="confirm"){float r=new Vector2((x-.5f)*2,(y-.5f)*2).magnitude/1.414214f;var c=Theme.Hex("#15212c");c.a=r<.43f?.922f:r<.54f?Mathf.Lerp(.922f,.549f,(r-.43f)/.11f):Mathf.Lerp(.549f,0,Mathf.Clamp01((r-.54f)/.16f));return c;}
            if(Kind=="reward"){float t=1-y;return t<.45f?Color.Lerp(Theme.HexA("#101e2b",.451f),Theme.HexA("#0b1825",.239f),t/.45f):Color.Lerp(Theme.HexA("#0b1825",.239f),Theme.HexA("#07131e",.761f),(t-.45f)/.55f);}
            if(Kind=="entry")return Color.Lerp(Theme.HexA("#132438",.929f),Theme.HexA("#101a2b",.878f),Mathf.Clamp01(x*.966f+(1-y)*.259f));
            var color=Theme.Hex("#071017");float a=x<.44f?0:x<.70f?Mathf.Lerp(0,.188f,(x-.44f)/.26f):Mathf.Lerp(.188f,.4f,(x-.70f)/.3f);float b=Mathf.Lerp(.788f,0,Mathf.Clamp01(y/.36f));color.a=1-(1-a)*(1-b);return color;
        }
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();var rect=rectTransform.rect;const int nx=24,ny=16;
            for(int y=0;y<=ny;y++)for(int x=0;x<=nx;x++){float u=x/(float)nx,v=y/(float)ny;vh.AddVert(new Vector2(rect.xMin+rect.width*u,rect.yMin+rect.height*v),Sample(u,v),Vector2.zero);}
            for(int y=0;y<ny;y++)for(int x=0;x<nx;x++){int i=y*(nx+1)+x;vh.AddTriangle(i,i+1,i+nx+2);vh.AddTriangle(i,i+nx+2,i+nx+1);}
        }
    }
}
