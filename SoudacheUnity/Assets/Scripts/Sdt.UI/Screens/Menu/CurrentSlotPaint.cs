using System;
using System.Collections;
using System.Collections.Generic;
using Sdt.Res;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentSlotCardHover : MonoBehaviour,IPointerEnterHandler,IPointerExitHandler
    {
        RawImage _background;bool _filled,_hover;Material _material;Panel _owner;public Image Emblem;
        public void Bind(RawImage background,bool filled)
        {_background=background;_filled=filled;_owner=GetComponentInParent<Panel>();var shader=Resources.Load<Shader>("Art/CurrentArchive/SlotWallpaper");if(shader!=null){_material=new Material(shader){name="Slot wallpaper source saturation/brightness"};_material.SetFloat("_Saturation",filled?.85f:.4f);_material.SetFloat("_Brightness",filled?.9f:.6f);_material.SetFloat("_Empty",filled?0:1);background.material=_material;}}
        public void OnPointerEnter(PointerEventData e)=>_hover=true;public void OnPointerExit(PointerEventData e)=>_hover=false;
        void Update()
        {
            if(_background==null||(_owner!=null&&UiStack.Top!=_owner))return;
            var selectedObject=EventSystem.current!=null?EventSystem.current.currentSelectedGameObject:null;
            bool active=_hover||(selectedObject!=null&&selectedObject.transform.IsChildOf(transform));
            float blend=CurrentUiPreferences.ReducedMotion?1:Mathf.Clamp01(Time.unscaledDeltaTime/.38f);
            var tint=_background.color;float targetAlpha=active?.55f:_filled?.5f:.22f;
            if(tint.a!=targetAlpha){tint.a=Mathf.Lerp(tint.a,targetAlpha,blend);if(Mathf.Abs(tint.a-targetAlpha)<.0001f)tint.a=targetAlpha;_background.color=tint;}
            if(Emblem!=null)
            {
                var target=Vector3.one*(active?1.035f:1);var current=Emblem.transform.localScale;
                if(current!=target){var next=Vector3.Lerp(current,target,blend);if((next-target).sqrMagnitude<.00000001f)next=target;Emblem.transform.localScale=next;}
            }
        }
        void OnDestroy(){if(_material!=null)Destroy(_material);}
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentSlotRim : MaskableGraphic
    {
        public bool Recent;
        static readonly float[] Stops={0,.24f,.52f,.8f,1};
        static readonly Color[] RecentColors={A.Color("#efe0b1"),A.Color("#b69b60"),A.Color("#514a37"),A.Color("#b69b60"),A.Color("#efe0b1")};
        static readonly Color[] OtherColors={A.Color("#b5bec1"),A.Color("#626f76"),A.Color("#293238"),A.Color("#626f76"),A.Color("#b5bec1")};
        Color Tint(float x,float y)
        {
            var colors=Recent?RecentColors:OtherColors;
            float t=Mathf.Clamp01((x*.574f+y*.819f)/1.393f);for(int i=1;i<Stops.Length;i++)if(t<=Stops[i])return Color.Lerp(colors[i-1],colors[i],Mathf.InverseLerp(Stops[i-1],Stops[i],t));return colors[4];
        }
        void Quad(VertexHelper mesh,float x,float y,float width,float height,Color a,Color b,bool horizontal=true)
        {int n=mesh.currentVertCount;float left=rectTransform.rect.xMin+x,top=rectTransform.rect.yMax-y;mesh.AddVert(new Vector2(left,top),a,Vector2.zero);mesh.AddVert(new Vector2(left+width,top),horizontal?b:a,Vector2.zero);mesh.AddVert(new Vector2(left+width,top-height),b,Vector2.zero);mesh.AddVert(new Vector2(left,top-height),horizontal?a:b,Vector2.zero);mesh.AddTriangle(n,n+1,n+2);mesh.AddTriangle(n,n+2,n+3);}
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();float w=rectTransform.rect.width,h=rectTransform.rect.height;if(w<=0||h<=0)return;
            for(int i=0;i<64;i++){float t=i/64f,u=(i+1)/64f;Quad(mesh,w*t,0,w/64,2,Tint(t,0),Tint(u,0));Quad(mesh,w*t,h-2,w/64,2,Tint(t,1),Tint(u,1));Quad(mesh,0,h*t,2,h/64,Tint(0,t),Tint(0,u),false);Quad(mesh,w-2,h*t,2,h/64,Tint(1,t),Tint(1,u),false);}
            var inner=A.Color("#a4b2b329");Quad(mesh,7,7,w-14,1,inner,inner);Quad(mesh,7,h-8,w-14,1,inner,inner);Quad(mesh,7,7,1,h-14,inner,inner);Quad(mesh,w-8,7,1,h-14,inner,inner);
            var corner=A.Color(Recent?"#eed59b":"#c0b28b");corner.a=.72f;Quad(mesh,7,7,23,2,corner,corner);Quad(mesh,7,7,2,23,corner,corner);Quad(mesh,w-30,h-9,23,2,corner,corner);Quad(mesh,w-9,h-30,2,23,corner,corner);Quad(mesh,w-20,7,13,1,corner,corner);Quad(mesh,w-8,7,1,13,corner,corner);Quad(mesh,7,h-8,13,1,corner,corner);Quad(mesh,7,h-20,1,13,corner,corner);
        }
    }
    public sealed class CurrentSlotEntry : MonoBehaviour
    {
        public void Begin(RectTransform root){if(!CurrentUiPreferences.ReducedMotion)StartCoroutine(Enter(root));}
        IEnumerator Enter(RectTransform root)
        {
            float time=0;var group=UIKit.GetOrAdd<CanvasGroup>(root);var cards=new List<RectTransform>();foreach(Transform item in root)if(item.name.StartsWith("slot-card-",StringComparison.Ordinal))cards.Add((RectTransform)item);
            var origins=new List<Vector2>();var groups=new List<CanvasGroup>();foreach(var item in cards){origins.Add(item.anchoredPosition);groups.Add(UIKit.GetOrAdd<CanvasGroup>(item));}
            while(time<.86f){time+=Time.unscaledDeltaTime;float p=CurrentArchiveMotion.Ease(time/.42f);group.alpha=p;root.anchoredPosition=new Vector2(0,-8*(1-p));for(int i=0;i<cards.Count;i++){float t=Mathf.Clamp01((time-.22f-.05f*i)/.42f),e=CurrentArchiveMotion.Ease(t,.16f,1,.3f,1);groups[i].alpha=Mathf.Clamp01(e/.78f);float y=e<.78f?Mathf.Lerp(-18,2,e/.78f):Mathf.Lerp(2,0,(e-.78f)/.22f);cards[i].anchoredPosition=origins[i]+new Vector2((2-i)*22*(1-e),y);cards[i].localScale=Vector3.one*Mathf.Lerp(.97f,1,e);}yield return null;}
            group.alpha=1;root.anchoredPosition=Vector2.zero;for(int i=0;i<cards.Count;i++){cards[i].anchoredPosition=origins[i];cards[i].localScale=Vector3.one;groups[i].alpha=1;}
        }
    }
    public sealed class CurrentSlotAmbience : MonoBehaviour
    {
        static readonly float[] Delays={1,4,2.2f,6,3.1f,5,7.4f,2.7f};
        readonly List<CanvasGroup> _silhouettes=new List<CanvasGroup>(),_bokehAlpha=new List<CanvasGroup>();readonly List<RectTransform> _bokeh=new List<RectTransform>();readonly List<Vector2> _bokehOrigins=new List<Vector2>();RectTransform _birds,_mist;Vector2 _birdOrigin;CanvasGroup _mistAlpha;float _time;Panel _owner;bool _reducedApplied;
        public void Build(Transform parent,float width,float height)
        {
            _owner=GetComponentInParent<Panel>();
            _mist=A.Full(parent,"slot-page-mist");A.Fill(_mist,new Vector2(-width*.2f,-height*.2f),new Vector2(width*.2f,height*.2f));A.Paint(_mist,"slot-mist");_mistAlpha=UIKit.GetOrAdd<CanvasGroup>(_mist);
            foreach(var point in new[]{new Vector3(.08f,.16f,10),new Vector3(.20f,.64f,16),new Vector3(.31f,.28f,7),new Vector3(.46f,.74f,12),new Vector3(.62f,.20f,9),new Vector3(.74f,.58f,18),new Vector3(.85f,.34f,8),new Vector3(.93f,.70f,11)})
            {var rect=A.Box(parent,"slot-bokeh",point.x*width,point.y*height,point.z,point.z);A.Paint(rect,"slot-bokeh");_bokehAlpha.Add(UIKit.GetOrAdd<CanvasGroup>(rect));_bokeh.Add(rect);_bokehOrigins.Add(rect.anchoredPosition);}
            foreach(var pair in new[]{("horse",.18f,.13f,Mathf.Clamp(width*.1f,90,150),170f/200), ("deer",.6f,.08f,Mathf.Clamp(width*.12f,110,180),190f/220), ("birds",.34f,.09f,Mathf.Clamp(width*.24f,200,380),70f/420)})
            {
                var rect=A.Box(parent,"sil-"+pair.Item1,width*pair.Item2,height*pair.Item3,pair.Item4,pair.Item4*pair.Item5);var image=UIKit.Image(rect,CurrentArchiveAssets.Load("sil-"+pair.Item1));image.raycastTarget=false;A.Fill(image.rectTransform);if(pair.Item1=="horse")rect.localScale=new Vector3(-1,1,1);if(pair.Item1=="birds"){_birds=rect;_birdOrigin=rect.anchoredPosition;}_silhouettes.Add(UIKit.GetOrAdd<CanvasGroup>(rect));
            }
            var snow=A.Full(parent,"slot-background-snow");var paint=UIKit.GetOrAdd<CurrentSlotSnow>(snow);paint.raycastTarget=false;
        }
        void Update()
        {
            if(_owner!=null&&UiStack.Top!=_owner)return;
            bool reduced=CurrentUiPreferences.ReducedMotion;if(reduced&&_reducedApplied)return;_reducedApplied=reduced;if(!reduced)_time+=Time.unscaledDeltaTime;
            float mist=CurrentArchiveMotion.Ease((Mathf.Sin(_time/28*Mathf.PI*2-Mathf.PI/2)+1)/2,.42f,0,.58f,1);if(_mist!=null){_mist.anchoredPosition=new Vector2(Mathf.Lerp(-.04f,.05f,mist)*_mist.rect.width,Mathf.Lerp(.02f,-.03f,mist)*_mist.rect.height);_mist.localScale=Vector3.one*Mathf.Lerp(1,1.08f,mist);_mistAlpha.alpha=reduced?.22f:Mathf.Lerp(.45f,.85f,mist);}
            for(int i=0;i<_bokeh.Count;i++){float p=reduced?.5f:(Mathf.Sin((_time+Delays[i])/18*Mathf.PI*2-Mathf.PI/2)+1)/2;_bokeh[i].anchoredPosition=_bokehOrigins[i]+new Vector2(14*p,22*p);_bokehAlpha[i].alpha=Mathf.Lerp(.22f,.66f,p);}
            for(int i=0;i<_silhouettes.Count;i++)_silhouettes[i].alpha=reduced?.55f:i==2?.6f:Mathf.Lerp(.55f,.95f,(Mathf.Sin((_time+i*3.5f)/7*Mathf.PI-Mathf.PI/2)+1)/2);
            if(_birds!=null)_birds.anchoredPosition=_birdOrigin+new Vector2(Mathf.Sin(_time/60*Mathf.PI)*_birds.rect.width*.09f,Mathf.Sin(_time/60*Mathf.PI)*_birds.rect.height*.03f);
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentSlotSnow : MaskableGraphic
    {
        static readonly Vector3[] Points={new Vector3(24,38,1),new Vector3(168,142,1.5f),new Vector3(78,278,1)};
        static readonly Vector2[] Circle=BuildCircle();
        float _time;bool _reduced;Panel _owner;
        static Vector2[] BuildCircle(){var points=new Vector2[8];for(int k=0;k<points.Length;k++){float angle=k*Mathf.PI/4;points[k]=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle));}return points;}
        protected override void OnEnable(){base.OnEnable();_owner=GetComponentInParent<Panel>();_reduced=CurrentUiPreferences.ReducedMotion;}
        void Update()
        {
            if(_owner!=null&&UiStack.Top!=_owner)return;
            bool reduced=CurrentUiPreferences.ReducedMotion;
            if(reduced){if(!_reduced)SetVerticesDirty();_reduced=true;return;}
            _reduced=false;_time+=Time.unscaledDeltaTime;SetVerticesDirty();
        }
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();float w=rectTransform.rect.width,h=rectTransform.rect.height;
            for(int layer=0;layer<2;layer++)
            {
                float tw=layer==0?260:390,phase=CurrentUiPreferences.ReducedMotion?0:(_time/(layer==0?18:12)+(layer==0?0:.5f))%1,dx=Mathf.Sin(phase*Mathf.PI*2)*(layer==0?16:-26),dy=phase*360,alpha=(layer==0?.48f:.38f)*(CurrentUiPreferences.ReducedMotion?.22f:1);
                for(int cy=-1;cy<h/360+1;cy++)for(int cx=-1;cx<w/tw+1;cx++)foreach(var point in Points)
                {
                    var center=new Vector2(rectTransform.rect.xMin+cx*tw+point.x+dx,rectTransform.rect.yMax-(cy*360+point.y+dy));int start=mesh.currentVertCount;var tint=new Color(.9f,.94f,.95f,alpha*.55f);mesh.AddVert(center,tint,Vector2.zero);tint.a=0;for(int k=0;k<Circle.Length;k++)mesh.AddVert(center+Circle[k]*(point.z+1),tint,Vector2.zero);for(int k=0;k<Circle.Length;k++)mesh.AddTriangle(start,start+1+k,start+1+(k+1)%Circle.Length);
                }
            }
        }
    }
}
