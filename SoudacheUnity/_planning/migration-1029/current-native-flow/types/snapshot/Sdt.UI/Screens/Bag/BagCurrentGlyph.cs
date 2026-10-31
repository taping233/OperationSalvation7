// Line geometry is translated from the existing rail SVG paths in game.bag.view2.js.
using UnityEngine;
using UnityEngine.UI;
namespace Sdt.UI.Screens.Bag
{
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class BagCurrentGlyph:Graphic
    {
        public string kind;
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            switch(kind)
            {
                case "bag":Path(mesh,5,8,19,8,17.8f,20,6.2f,20,5,8);Path(mesh,9,8,9,6,9.3f,4.5f,10.5f,3.3f,12,3,13.5f,3.3f,14.7f,4.5f,15,6,15,8);break;
                case "safe":Path(mesh,12,3,19,6,19,11,18.5f,14,17,17,14.5f,19.5f,12,21,9.5f,19.5f,7,17,5.5f,14,5,11,5,6,12,3);Path(mesh,12,8,12,14);Path(mesh,9,11,15,11);break;
                case "pocket":Path(mesh,6,4,18,4,18,10,17.5f,12.5f,16,14.5f,14,15.6f,12,16,10,15.6f,8,14.5f,6.5f,12.5f,6,10,6,4);Path(mesh,9,20,15,20);Path(mesh,12,16,12,20);break;
                case "sort":Path(mesh,4,7,14,7);Path(mesh,4,12,11,12);Path(mesh,4,17,8,17);Path(mesh,17,4,17,18,20.5f,14.5f);Path(mesh,17,18,13.5f,14.5f);break;
                case "tidy":Path(mesh,5,4,9,4,9,8,5,8,5,4);Path(mesh,15,4,19,4,19,8,15,8,15,4);Path(mesh,5,16,9,16,9,20,5,20,5,16);Path(mesh,15,16,19,16,19,20,15,20,15,16);Path(mesh,9,6,15,6);Path(mesh,7,9,7,16,15,16);Path(mesh,16,9,16,16);break;
                default:Path(mesh,9,4,18,4,19.5f,5.5f,19.5f,18.5f,18,20,9,20);Path(mesh,4,12,14,12);Path(mesh,4,12,8,8);Path(mesh,4,12,8,16);break;
            }
        }
        void Path(VertexHelper mesh,params float[] points)
        {
            for(int i=2;i<points.Length;i+=2)Line(mesh,new Vector2(points[i-2],points[i-1]),new Vector2(points[i],points[i+1]));
        }
        Vector2 Point(Vector2 p){var r=rectTransform.rect;return new Vector2(r.xMin+p.x/24*r.width,r.yMax-p.y/24*r.height);}
        void Line(VertexHelper mesh,Vector2 source,Vector2 target)
        {
            Vector2 a=Point(source),b=Point(target),normal=new Vector2(-(b-a).y,(b-a).x).normalized*(rectTransform.rect.width/24*.85f);
            int start=mesh.currentVertCount;mesh.AddVert(a-normal,color,Vector2.zero);mesh.AddVert(a+normal,color,Vector2.zero);mesh.AddVert(b+normal,color,Vector2.zero);mesh.AddVert(b-normal,color,Vector2.zero);mesh.AddTriangle(start,start+1,start+2);mesh.AddTriangle(start,start+2,start+3);
        }
    }
}
