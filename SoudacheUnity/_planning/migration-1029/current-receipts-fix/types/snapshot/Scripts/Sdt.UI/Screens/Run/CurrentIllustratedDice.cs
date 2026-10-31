// event-dice-visual.js cube poses, pip layouts and 1250ms saved-result-only motion.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentIllustratedDice:Graphic
    {
        static readonly Vector2[] Poses={new Vector2(0,0),new Vector2(-90,0),new Vector2(0,-90),new Vector2(0,90),new Vector2(90,0),new Vector2(0,180)};
        static readonly int[][] Pips={new[]{5},new[]{1,9},new[]{1,5,9},new[]{1,3,7,9},new[]{1,3,5,7,9},new[]{1,3,4,6,7,9}};
        static readonly Quaternion[] Faces={Quaternion.identity,Quaternion.Euler(90,0,0),Quaternion.Euler(0,90,0),Quaternion.Euler(0,-90,0),Quaternion.Euler(-90,0,0),Quaternion.Euler(0,180,0)};
        float _time;int _result=1;bool _rolling;Action _done;Panel _owner;
        public static CurrentIllustratedDice Create(Transform parent,int? result)
        {
            var root=CurrentNodeElements.Rect(parent,"event-dice-stage");UIKit.GetOrAdd<LayoutElement>(root).preferredHeight=233;
            var die=UIKit.GetOrAdd<CurrentIllustratedDice>(root);die._result=result??1;die._owner=root.GetComponentInParent<Panel>();die.raycastTarget=false;
            return die;
        }
        public void Roll(int result,Action done)
        {
            _result=Mathf.Clamp(result,1,6);_done=done;_time=0;_rolling=!CurrentUiPreferences.ReducedMotion;
            if(!_rolling){SetVerticesDirty();_done=null;done?.Invoke();}
        }
        void Update()
        {
            if(!_rolling)return;_time+=Time.unscaledDeltaTime;SetVerticesDirty();
            if(_time>=1.25f||UiStack.Top!=_owner){_rolling=false;var done=_done;_done=null;done?.Invoke();}
        }
        static Vector2 Point(Vector3 p,Vector2 center,float hop,float scale)
        {float f=650/(650-p.z);return center+new Vector2(p.x*f*scale,(p.y*f+hop)*scale);}
        void Quad(VertexHelper vh,Quaternion rotation,Quaternion face,float x,float y,float w,float h,Vector2 center,float hop,float scale,Color32 shade)
        {
            int start=vh.currentVertCount;var uv=Vector2.zero;
            foreach(var p in new[]{new Vector3(x,y,44),new Vector3(x+w,y,44),new Vector3(x+w,y+h,44),new Vector3(x,y+h,44)})vh.AddVert(Point(rotation*(face*p),center,hop,scale),shade,uv);
            vh.AddTriangle(start,start+1,start+2);vh.AddTriangle(start,start+2,start+3);
        }
        void Pip(VertexHelper vh,Quaternion rotation,Quaternion face,int index,Vector2 center,float hop,float scale,Color32 shade)
        {
            float cx=-25+(index-1)%3*25,cy=25-(index-1)/3*25;int start=vh.currentVertCount;
            vh.AddVert(Point(rotation*(face*new Vector3(cx,cy,44.3f)),center,hop,scale),shade,Vector2.zero);
            for(int i=0;i<=16;i++){float a=i*Mathf.PI/8;vh.AddVert(Point(rotation*(face*new Vector3(cx+5.8f*Mathf.Cos(a),cy+5.8f*Mathf.Sin(a),44.3f)),center,hop,scale),shade,Vector2.zero);if(i>0)vh.AddTriangle(start,start+i,start+i+1);}
        }
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();float p=_rolling?Mathf.Clamp01(_time/1.25f):1;var pose=Poses[_result-1];float extra=0,hop=0,x=0,scale=1;
            if(_rolling)
            {
                float eased=1-Mathf.Pow(1-p,3);extra=720*eased;var mid=Poses[3];pose=p<.55f?Vector2.Lerp(Poses[0],mid,p/.55f):Vector2.Lerp(mid,pose,(p-.55f)/.45f);
                float[] times={0,.28f,.65f,.78f,1},ys={0,72,0,18,0},xs={-65,-28,12,5,0},ss={.92f,1.08f,1.08f,.97f,1};int n=1;while(n<4&&p>times[n])n++;float t=Mathf.SmoothStep(0,1,Mathf.InverseLerp(times[n-1],times[n],p));hop=Mathf.Lerp(ys[n-1],ys[n],t);x=Mathf.Lerp(xs[n-1],xs[n],t);scale=Mathf.Lerp(ss[n-1],ss[n],t);
            }
            var rotation=Quaternion.Euler(-32,0,0)*Quaternion.Euler(0,-20,0)*Quaternion.Euler(90,0,0)*Quaternion.Euler(pose.x+extra,0,0)*Quaternion.Euler(0,pose.y+extra*1.5f,0);
            var center=new Vector2(rectTransform.rect.center.x+x,rectTransform.rect.center.y-8);
            for(int f=0;f<6;f++)
            {
                var face=Faces[f];var normal=rotation*(face*Vector3.forward);if(normal.z<=0)continue;
                var shade=Color.Lerp(Theme.Hex("#a99e86"),Theme.Hex("#fff8e7"),Mathf.Clamp01(normal.z*.7f+.3f));
                Quad(vh,rotation,face,-44,-44,88,88,center,hop,scale,Theme.Hex("#c6b995"));Quad(vh,rotation,face,-42,-42,84,84,center,hop,scale,shade);
                foreach(int pip in Pips[f])Pip(vh,rotation,face,pip,center,hop,scale,Theme.Hex(f==0?"#a74539":"#26313a"));
            }
        }
    }
}
