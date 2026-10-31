using UnityEngine;
namespace Sdt.UI.Screens.Run
{
    public sealed partial class CurrentRunFilm
    {
        // CSS easing is evaluated once per native frame, rather than for every fragment.
        static float Curve(float t, float x1=0, float y1=0, float x2=.58f, float y2=1)
        {
            t=Mathf.Clamp01(t);float lo=0,hi=1,u=t;
            for(int i=0;i<16;i++){u=(lo+hi)*.5f;float v=1-u;float x=3*v*v*u*x1+3*v*u*u*x2+u*u*u;if(x<t)lo=u;else hi=u;}
            float w=1-u;return 3*w*w*u*y1+3*w*u*u*y2+u*u*u;
        }
        static float Segment(float t,float a,float b)=>Curve(Mathf.InverseLerp(a,b,t));
        internal static float SourceEaseOut(float t)=>Curve(t);
        void PaintSourceMotion(float t)
        {
            int motion=Mathf.RoundToInt(_material.GetFloat("_Motion"));float q=Curve(t),alpha=1,scale=1,brightness=1,blur=0,clip=1,skew=0;
            Vector2 offset=Vector2.zero;Vector4 gesture=new Vector4(1,1,0,0);float effect=0;
            switch(motion)
            {
                case 0: scale=Mathf.Lerp(.96f,1.025f,q);alpha=Segment(t,0,.6f);clip=alpha;break;
                case 1: scale=Mathf.Lerp(1.09f,1,q);effect=Curve(Mathf.InverseLerp(.12f,1,t),.65f,0,.2f,1);break;
                case 2:
                    alpha=t<.28f?Mathf.Lerp(0,.55f,Segment(t,0,.28f)):Mathf.Lerp(.55f,1,Segment(t,.28f,.7f));
                    brightness=t<.28f?Mathf.Lerp(1.5f,1.25f,Segment(t,0,.28f)):Mathf.Lerp(1.25f,1,Segment(t,.28f,.7f));
                    blur=t<.28f?Mathf.Lerp(12,5,Segment(t,0,.28f)):Mathf.Lerp(5,0,Segment(t,.28f,.7f));
                    effect=t<.16f?Mathf.Lerp(.1f,.23f,Segment(t,0,.16f)):Mathf.Lerp(.23f,0,Segment(t,.16f,.6f));break;
                case 3: alpha=Mathf.Lerp(.15f,1,q);clip=q;effect=Mathf.Lerp(-.9f,1,Curve(t,.42f,0,.58f,1));break;
                case 4:
                    alpha=t<.35f?Mathf.Lerp(0,.55f,Segment(t,.12f,.35f)):Mathf.Lerp(.55f,1,Segment(t,.35f,1));
                    scale=Mathf.Lerp(2f/3f,1.08f,Segment(t,.12f,1));effect=Mathf.Lerp(1,.2f,q);break;
                case 5:
                    alpha=t<.35f?Mathf.Lerp(0,.8f,Segment(t,0,.35f)):Mathf.Lerp(.8f,1,Segment(t,.35f,.65f));
                    blur=t<.35f?Mathf.Lerp(3,.5f,Segment(t,0,.35f)):Mathf.Lerp(.5f,0,Segment(t,.35f,.65f));
                    skew=t<.35f?Mathf.Lerp(-.7f,.4f,Segment(t,0,.35f)):Mathf.Lerp(.4f,0,Segment(t,.35f,.65f));
                    effect=t<.35f?Mathf.Lerp(0,.7f,Curve(Mathf.InverseLerp(.2f,.35f,t),.25f,.1f,.25f,1)):Mathf.Lerp(.7f,0,Curve(Mathf.InverseLerp(.35f,.75f,t),.25f,.1f,.25f,1));break;
                case 6:
                    q=Curve(t<.65f?t/.65f:(t-.65f)/.35f,.25f,.1f,.25f,1);
                    gesture=new Vector4(t<.65f?Mathf.Lerp(0,.55f,q):Mathf.Lerp(.55f,.2f,q),t<.65f?Mathf.Lerp(.1f,1,q):Mathf.Lerp(1,.7f,q),0,0);break;
                case 7:gesture=new Vector4(t<.2f?t/.2f*.6f:Mathf.Lerp(.6f,0,(t-.2f)/.8f),1,.76f*t,0);break;
                case 8:
                    gesture=new Vector4(t<.35f?Curve(t/.35f,.2f,.65f,.2f,1):1-Curve((t-.35f)/.65f,.2f,.65f,.2f,1),1,Mathf.Lerp(-.56f,.35f,Curve(t,.2f,.65f,.2f,1)),Mathf.Lerp(.24f,-.24f,Curve(t,.2f,.65f,.2f,1)));break;
                case 9:gesture=new Vector4(.65f*Segment(t,0,.75f),Mathf.Lerp(.1f,1,Segment(t,0,.75f)),0,0);break;
                case 10: q=Curve(t,.25f,.1f,.25f,1);gesture=new Vector4(t<.35f?Curve(t/.35f,.25f,.1f,.25f,1):1-Curve((t-.35f)/.65f,.25f,.1f,.25f,1),1,Mathf.Lerp(-1.12f,1.12f,q),0);break;
                case 11:case 12:gesture=new Vector4(1,Mathf.Lerp(.3f,1.6f,q),0,0);break;
                case 13:gesture=new Vector4(t<.6f?Mathf.Lerp(0,.8f,Segment(t,0,.6f)):Mathf.Lerp(.8f,.4f,Segment(t,.6f,1)),t<.6f?Mathf.Lerp(.1f,1,Segment(t,0,.6f)):Mathf.Lerp(1,.8f,Segment(t,.6f,1)),0,0);break;
                case 14:q=Curve(t,.42f,0,1,1);gesture=new Vector4(.65f*(1-q),500/(400+500*q),0,0);break;
                case 15:effect=1-Curve(Mathf.InverseLerp(.1f,.85f,t),.35f,0,.2f,1);break;
                case 16: q=Curve(t,.2f,.55f,.3f,1);alpha=Segment(t,0,.16f);scale=Mathf.Lerp(1,1.085f,q);break;
                case 17:alpha=Segment(t,0,.18f);scale=1.045f;offset.x=Mathf.Lerp(.024f,-.01f,q);effect=Mathf.Lerp(-.36f,.26f,q);break;
                case 18:q=Curve(t,.2f,.55f,.3f,1);alpha=Segment(t,0,.2f);scale=Mathf.Lerp(1.025f,1.075f,q);offset.y=Mathf.Lerp(.026f,-.014f,q);break;
                case 19:q=Curve(t,.25f,.1f,.5f,1);alpha=Segment(t,0,.24f);scale=Mathf.Lerp(.94f,1.065f,q);brightness=t<.24f?Mathf.Lerp(.45f,.65f,Segment(t,0,.24f)):t<.78f?Mathf.Lerp(.65f,1.06f,Segment(t,.24f,.78f)):Mathf.Lerp(1.06f,.9f,Segment(t,.78f,1));break;
            }
            _material.SetVector("_ImageState",new Vector4(scale,alpha,brightness,blur));
            _material.SetVector("_ImageOffset",new Vector4(offset.x,offset.y,skew,clip));
            _material.SetVector("_Gesture",gesture);_material.SetFloat("_Effect",effect);
        }
    }
}
