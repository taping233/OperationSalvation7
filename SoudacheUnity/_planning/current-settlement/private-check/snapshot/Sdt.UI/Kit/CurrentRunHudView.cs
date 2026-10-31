using System;
using UnityEngine;
using UnityEngine.UI;
namespace Sdt.UI.Kit
{
    internal static class CurrentRunHudView
    {
        public static RectTransform Box(Transform parent, string name, float x, float y, float width, float height, Vector2? anchor = null, Vector2? pivot = null)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform; rt.anchorMin = rt.anchorMax = anchor ?? new Vector2(0, 1); rt.pivot = pivot ?? new Vector2(0, 1);
            rt.anchoredPosition = new Vector2(x, -y); rt.sizeDelta = new Vector2(width, height); return rt;
        }
        public static Image Fill(Transform parent, string name, float x, float y, float w, float h, string color)
        { var rt = Box(parent, name, x, y, w, h); var image = UIKit.GetOrAdd<Image>(rt); image.color = Theme.Hex(color); image.raycastTarget = false; return image; }
        public static Text Text(Transform parent, string name, string text, float x, float y, float w, float h, int size, string color = "#edf2ef", bool number = false)
        {
            var rt = Box(parent, name, x, y, w, h); var t = UIKit.GetOrAdd<UnityEngine.UI.Text>(rt); t.font = number ? Sdt.Res.Res.Number : Sdt.Res.Res.Sans;
            t.text = text; t.fontSize = size; t.color = Theme.Hex(color); t.raycastTarget = false; t.supportRichText = true;
            t.alignment = TextAnchor.MiddleLeft; t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow; return t;
        }
        public static Button Button(Transform parent, string name, float x, float y, float w, float h, Action action, Vector2? anchor = null, Vector2? pivot = null)
        {
            var rt = Box(parent, name, x, y, w, h, anchor, pivot); var image = UIKit.GetOrAdd<Image>(rt); image.color = Color.clear;
            var b = UIKit.GetOrAdd<UnityEngine.UI.Button>(rt); b.targetGraphic = image; b.transition = Selectable.Transition.ColorTint;
            var colors = b.colors; colors.normalColor = Color.white; colors.highlightedColor = new Color(.7f, .9f, .9f, .12f); colors.pressedColor = new Color(.7f, .9f, .9f, .22f); b.colors = colors;
            b.onClick.AddListener(() => action?.Invoke()); return b;
        }
        public static Image Art(Transform parent, string name, Sprite sprite, float x, float y, float w, float h)
        { var rt = Box(parent, name, x, y, w, h); var image = UIKit.GetOrAdd<Image>(rt); image.sprite = sprite; image.preserveAspect = true; image.raycastTarget = false; return image; }
    }
    // Original index.html and battle-menu-icons.js paths on their 24 x 24 optical grid.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentRunControlGlyph : MaskableGraphic
    {
        public string Kind;
        public void SetKind(string value) { if (Kind == value) return; Kind = value; SetVerticesDirty(); }
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            if (Kind == "back") { Path(vh,9,4,18,4,19.5f,5.5f,19.5f,18.5f,18,20,9,20); Path(vh,4,12,14,12); Path(vh,8,8,4,12,8,16); }
            else if (Kind == "settings") { Path(vh,4,7,7,7);Path(vh,13,7,20,7);Path(vh,4,17,11,17);Path(vh,17,17,20,17); Circle(vh,10,7,3);Circle(vh,14,17,3); }
            else { Path(vh,3,8.5f,3,15.5f,7,15.5f,12,20,12,4,7,8.5f,3,8.5f); if (Kind == "muted") {Path(vh,16,9,21,15);Path(vh,21,9,16,15);} else {Arc(vh,11.53f,12,6,-42,42);Arc(vh,11.86f,12,10,-44.4f,44.4f);} }
        }
        Vector2 P(float x,float y) { var r=GetPixelAdjustedRect();return new Vector2(r.x+x*r.width/24,r.y+(24-y)*r.height/24); }
        void Path(VertexHelper vh, params float[] p) { for(int i=0;i+3<p.Length;i+=2) Line(vh,P(p[i],p[i+1]),P(p[i+2],p[i+3])); }
        void Line(VertexHelper vh, Vector2 a,Vector2 b) { var n=new Vector2(-(b-a).y,(b-a).x).normalized*(rectTransform.rect.width/24*1.1f); int i=vh.currentVertCount; vh.AddVert(a+n,color,Vector2.zero);vh.AddVert(b+n,color,Vector2.zero);vh.AddVert(b-n,color,Vector2.zero);vh.AddVert(a-n,color,Vector2.zero);vh.AddTriangle(i,i+1,i+2);vh.AddTriangle(i,i+2,i+3); }
        void Circle(VertexHelper vh,float x,float y,float r)=>Arc(vh,x,y,r,0,360);
        void Arc(VertexHelper vh,float x,float y,float r,float start,float end) {Vector2 before=P(x+r*Mathf.Cos(start*Mathf.Deg2Rad),y+r*Mathf.Sin(start*Mathf.Deg2Rad));for(int i=1;i<=24;i++){float a=Mathf.Lerp(start,end,i/24f)*Mathf.Deg2Rad;var next=P(x+r*Mathf.Cos(a),y+r*Mathf.Sin(a));Line(vh,before,next);before=next;} }
    }
}
