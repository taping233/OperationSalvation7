from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/CourtyardScreen.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('var foreground=H.Area(scene,"courtyard-v3-canvas"','var shores=H.Area(scene,"courtyard-backdrop-shores",Vector2.zero,Vector2.one);shores.gameObject.AddComponent<CourtyardShoreGraphic>().raycastTarget=false;\n            var foreground=H.Area(scene,"courtyard-v3-canvas"')
insert=s.index('    // sceneBackdrop=true branch')
s=s[:insert]+'''    // Static shoreline paths are drawn on the source backdrop canvas, below the Koi layer.
    sealed class CourtyardShoreGraphic : MaskableGraphic
    {
        Vector2 At(Vector2 point)=>new Vector2(rectTransform.rect.xMin+point.x,rectTransform.rect.yMax-point.y);
        static Vector2 Cubic(Vector2 a,Vector2 b,Vector2 c,Vector2 d,float t){float u=1-t;return a*u*u*u+b*3*u*u*t+c*3*u*t*t+d*t*t*t;}
        void Polygon(VertexHelper mesh,List<Vector2> points,Vector2 center,float angle,float size,Color color)
        {
            var mean=Vector2.zero;foreach(var p in points)mean+=p;mean/=points.Count;int start=mesh.currentVertCount;
            Vector2 Transform(Vector2 p)=>At(center+new Vector2((p.x*Mathf.Cos(angle)-p.y*Mathf.Sin(angle))*size,(p.x*Mathf.Sin(angle)+p.y*Mathf.Cos(angle))*size));
            mesh.AddVert(Transform(mean),color,Vector2.zero);foreach(var p in points)mesh.AddVert(Transform(p),color,Vector2.zero);
            for(int i=0;i<points.Count;i++)mesh.AddTriangle(start,start+1+i,start+1+(i+1)%points.Count);
        }
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();float width=rectTransform.rect.width,height=rectTransform.rect.height,size=Mathf.Min(width,height)*.025f;
            var moss=new List<Vector2>();for(int i=0;i<12;i++)moss.Add(Cubic(new Vector2(-1,0),new Vector2(-1,-.7f),new Vector2(.2f,-.8f),new Vector2(1,-.3f),i/12f));for(int i=0;i<12;i++)moss.Add(Cubic(new Vector2(1,-.3f),new Vector2(1.3f,.4f),new Vector2(-.5f,.8f),new Vector2(-1,0),i/12f));
            var leaf=new List<Vector2>();for(int i=0;i<12;i++){float t=i/12f,u=1-t;leaf.Add(new Vector2(-.6f*u*u+.6f*t*t,-u*t));}for(int i=0;i<12;i++){float t=i/12f,u=1-t;leaf.Add(new Vector2(.6f*u*u-.6f*t*t,.7f*u*t));}
            foreach(var shore in new[]{new Vector3(.025f,.18f,-.5f),new Vector3(.045f,.84f,.4f),new Vector3(.955f,.13f,.7f),new Vector3(.975f,.77f,-.3f)})
            {
                var center=new Vector2(width*shore.x,height*shore.y);Polygon(mesh,moss,center,shore.z,size,new Color(44/255f,67/255f,49/255f,.24f));
                var offset=new Vector2((.7f*Mathf.Cos(shore.z)-1.4f*Mathf.Sin(shore.z))*size,(.7f*Mathf.Sin(shore.z)+1.4f*Mathf.Cos(shore.z))*size);
                Polygon(mesh,leaf,center+offset,shore.z,size,new Color(163/255f,151/255f,96/255f,.58f));
            }
        }
    }

'''+s[insert:]
p.write_text(s,encoding='utf-8')
