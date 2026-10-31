// Production courtyardV3HTML + base-courtyard-v3.css, mounted inside the current base frame.
using System;
using System.Collections.Generic;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using H=Sdt.UI.Screens.Hub.HubScreen;
namespace Sdt.UI.Screens.Hub
{
    public sealed class CourtyardScreen : Panel
    {
        CourtyardPreferences _preferences;KoiPondGraphic _pond;CourtyardRainTableau _rain;
        Text _found,_eaten,_notice;Button _rainButton,_intensityButton,_soundButton,_pauseButton,_settingsButton;
        readonly List<Button> _swatches=new List<Button>();GameObject _settings;
        AudioSource _rainSound;AudioLowPassFilter _filter;AudioClip _noise;bool _paused,_active=true,_soundStarted;float _feedbackUntil;
        public static void Open()=>HubScreen.Open("courtyard");
        public static CourtyardScreen BuildCurrentRoom(Transform parent)
        {var host=UIKit.Panel("courtyard-current-room",parent);var view=host.AddComponent<CourtyardScreen>();view.Build();return view;}
        public override void Build()
        {
            try{_preferences=CourtyardPreferences.Read(GameRuntime.I.Saves);}catch{_preferences=new CourtyardPreferences();}
            _preferences.sound=_preferences.rain&&_preferences.sound;
            var root=H.Area(transform,"courtyard-v3 courtyard-zzz",Vector2.zero,Vector2.one);
            var scene=H.Area(root,"courtyard-v3-scene",Vector2.zero,Vector2.one,new Vector2(0,87),Vector2.zero);H.Surface(scene,1,14).material=null;scene.gameObject.AddComponent<Mask>().showMaskGraphic=false;
            var background=UIKit.Image(scene,Sdt.Res.Res.Scene("courtyard-pond-v4"));H.Fill(background.rectTransform);background.preserveAspect=true;
            if(background.sprite!=null){var cover=background.gameObject.AddComponent<AspectRatioFitter>();cover.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;cover.aspectRatio=background.sprite.rect.width/background.sprite.rect.height;}
            var shores=H.Area(scene,"courtyard-backdrop-shores",Vector2.zero,Vector2.one);shores.gameObject.AddComponent<CourtyardShoreGraphic>().raycastTarget=false;
            var foreground=H.Area(scene,"courtyard-v3-canvas",Vector2.zero,Vector2.one);_pond=foreground.gameObject.AddComponent<KoiPondGraphic>();_pond.Rain=false;_pond.raycastTarget=false;
            var rain=H.Area(scene,"courtyard-v3-rain-layer",Vector2.zero,Vector2.one);_rain=rain.gameObject.AddComponent<CourtyardRainTableau>();_rain.raycastTarget=false;
            var input=H.Area(scene,"courtyard-pond-input",Vector2.zero,Vector2.one);input.gameObject.AddComponent<Image>().color=Color.clear;
            var pointer=input.gameObject.AddComponent<CourtyardPointer>();pointer.Owner=this;pointer.Pond=_pond;pointer.targetGraphic=input.GetComponent<Image>();pointer.navigation=new Navigation{mode=Navigation.Mode.Automatic};
            _notice=UIKit.Label(scene,"",19,H.InkColor);_notice.alignment=TextAnchor.MiddleCenter;H.Set(_notice.transform,new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(-360,20),new Vector2(360,70));
            var controls=H.Area(root,"courtyard-v3-controls",Vector2.zero,new Vector2(1,0),Vector2.zero,new Vector2(0,75));H.Surface(controls,.74f,12);
            var row=H.Row(controls,"courtyard-controls-row",12,51);H.Fill((RectTransform)row,new Vector2(18,12),new Vector2(-18,-12));row.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleLeft;
            var info=H.Row(row,"courtyard-v3-info",24,29);H.Bounds(info.gameObject,240,29,1,0);info.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleLeft;var hint=H.Label(info,"轻点投喂 · 划过锦鲤发现它们",19,false,H.Muted);H.IntrinsicWidth(hint.transform,hint);
            var progress=H.Row(info,"courtyard-v3-progress",16,28);_found=H.Label(progress,"发现锦鲤 0 / 9",19);_eaten=H.Label(progress,"吃食 0 次",19);
            _rainButton=H.Command(row,"",()=>{_preferences.rain=!_preferences.rain;if(!_preferences.rain){_preferences.sound=false;_rainSound.Stop();_soundStarted=false;}Status(_preferences.rain?"雨落池塘":"雨已停 · 仍可投喂和寻找锦鲤");Apply();});H.Bounds(_rainButton.gameObject,0,51,0,0);H.IntrinsicWidth(_rainButton.transform,_rainButton.GetComponentInChildren<Text>(),34);
            var feed=H.Command(row,"投喂",()=>Interact(_pond.Model.Width*.5,_pond.Model.Height*.5),true);H.Bounds(feed.gameObject,0,51,0,0);H.IntrinsicWidth(feed.transform,feed.GetComponentInChildren<Text>(),34);feed.GetComponent<Image>().color=H.Ink("#E2C891");
            _settingsButton=H.Command(row,"＋ 环境设置",()=>{_settings.SetActive(!_settings.activeSelf);SetLabel(_settingsButton,_settings.activeSelf?"− 环境设置":"＋ 环境设置");});H.Bounds(_settingsButton.gameObject,0,51,0,0);H.IntrinsicWidth(_settingsButton.transform,_settingsButton.GetComponentInChildren<Text>(),34);
            _settings=H.Area(controls,"courtyard-v3-settings-content",new Vector2(1,1),Vector2.one,new Vector2(-340,12),new Vector2(0,430)).gameObject;H.Surface(_settings.transform,.98f,12);
            var settings=H.Column(_settings.transform,"environment-settings",8,new RectOffset(20,20,20,20));H.Fill((RectTransform)settings);H.Label(settings,"雨声与色调",19,false,H.Muted);
            _intensityButton=H.Command(settings,"",()=>{_preferences.intensity=_preferences.intensity==80?40:80;Apply();});
            _soundButton=H.Command(settings,"",()=>{_preferences.sound=_preferences.rain&&!_preferences.sound;Apply();});
            _pauseButton=H.Command(settings,"暂停",()=>{_paused=!_paused;Sync();});
            var swatches=H.Row(settings,"courtyard-v3-swatches",6,52);
            foreach(var pair in new[]{("slate","冷灰"),("moss","苔绿"),("clay","暖陶")}){string key=pair.Item1;var swatch=H.Command(swatches,pair.Item2,()=>{if(!_preferences.rain)return;_preferences.palette=key;Apply();});H.Bounds(swatch.gameObject,0,52,1,0);_swatches.Add(swatch);}
            _settings.SetActive(false);SetupSound();Apply(false);
        }
        static void SetLabel(Button button,string label){if(button!=null)button.GetComponentInChildren<Text>().text=label;}
        void Status(string text,bool transient=false){_notice.text=text;_feedbackUntil=transient?Time.unscaledTime+1.4f:0;}
        void Apply(bool save=true)
        {
            _rain.Rain=_preferences.rain;_rain.SetIntensity(_preferences.intensity);_rain.Palette=_preferences.palette;
            SetLabel(_rainButton,_preferences.rain?"关闭雨":"开启雨");SetLabel(_intensityButton,_preferences.intensity==80?"雨势：大雨":"雨势：细雨");SetLabel(_soundButton,_preferences.sound?"声音：开":"声音：关");
            _intensityButton.interactable=_soundButton.interactable=_preferences.rain;
            string[] palettes={"slate","moss","clay"};for(int i=0;i<_swatches.Count;i++){_swatches[i].interactable=_preferences.rain;H.SoftSelection(_swatches[i],_preferences.palette==palettes[i]);}
            if(save&&!_preferences.Save(GameRuntime.I.Saves,out var error))Status("环境设置本次生效，暂未保存到本机："+error);
            _filter.cutoffFrequency=_preferences.intensity==80?2200:1100;Sync();_rain.SetVerticesDirty();
        }
        void Sync()
        {
            bool reduced=GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion")=="1";
            _pond.Paused=_rain.Paused=_paused||!_active||reduced;_pauseButton.interactable=!reduced;SetLabel(_pauseButton,reduced?"静态":_paused?"继续":"暂停");
            var audio=AudioService.I;bool enabled=_active&&_preferences.rain&&_preferences.sound&&!_paused&&!audio.Muted&&!audio.SfxMuted;
            _rainSound.volume=(_preferences.intensity==80 ? .095f : .035f)*audio.SfxVolume;
            if(enabled){if(!_soundStarted){_rainSound.Play();_soundStarted=true;}else if(!_rainSound.isPlaying)_rainSound.UnPause();}else if(_rainSound.isPlaying)_rainSound.Pause();
        }
        internal void Interact(double x,double y)
        {
            if(!_active)return;bool accepted=!_preferences.rain||_rain.Tap(x,y);_pond.Model.Tap(x,y);_pond.Model.Pointer(x,y);_pond.SetVerticesDirty();
            Status(!accepted?"轻点水面投喂":_preferences.rain?"已投喂 · 雨圈散开":"已投喂 · 等锦鲤来吃",true);
        }
        void SetupSound()
        {
            const int rate=22050;var samples=new float[rate*2];var random=new System.Random(1707);float smooth=0;
            for(int i=0;i<samples.Length;i++){smooth=.97f*smooth+.03f*((float)random.NextDouble()*2-1);samples[i]=smooth*4;}
            _noise=AudioClip.Create("courtyard-rain",samples.Length,1,rate,false);_noise.SetData(samples,0);
            _rainSound=gameObject.AddComponent<AudioSource>();_rainSound.clip=_noise;_rainSound.loop=true;_rainSound.playOnAwake=false;_filter=gameObject.AddComponent<AudioLowPassFilter>();
        }
        void Update()
        {
            if(_pond==null)return;_found.text=_pond.Model.Found==9?"已找到全部 9 条锦鲤":"发现锦鲤 "+_pond.Model.Found+" / 9";_eaten.text="吃食 "+_pond.Model.Eaten+" 次";
            if(_feedbackUntil>0&&Time.unscaledTime>=_feedbackUntil){_feedbackUntil=0;_notice.text="";}Sync();
        }
        void OnApplicationFocus(bool focus){_active=focus;if(_pond!=null)Sync();}
        void OnDisable(){if(_rainSound!=null)_rainSound.Stop();if(_pond!=null)_pond.Paused=true;if(_rain!=null)_rain.Paused=true;}
        protected override void OnDestroy(){if(_rainSound!=null)_rainSound.Stop();if(_noise!=null)Destroy(_noise);base.OnDestroy();}
    }
    sealed class CourtyardPointer : Selectable,IPointerClickHandler,IPointerMoveHandler,IPointerExitHandler,ISubmitHandler,IUpdateSelectedHandler
    {
        public CourtyardScreen Owner;public KoiPondGraphic Pond;int _lastFeedFrame=-1;
        void Feed(double x,double y){if(_lastFeedFrame==Time.frameCount)return;_lastFeedFrame=Time.frameCount;Owner.Interact(x,y);}
        Vector2 Point(PointerEventData data){var rect=(RectTransform)transform;RectTransformUtility.ScreenPointToLocalPointInRectangle(rect,data.position,data.pressEventCamera,out var p);return new Vector2((p.x-rect.rect.xMin)/rect.rect.width*(float)Pond.Model.Width,(rect.rect.yMax-p.y)/rect.rect.height*(float)Pond.Model.Height);}
        public void OnPointerClick(PointerEventData data){if(data.button!=PointerEventData.InputButton.Left)return;EventSystem.current?.SetSelectedGameObject(gameObject);var p=Point(data);Feed(p.x,p.y);}
        public void OnPointerMove(PointerEventData data){var p=Point(data);Pond.Model.Pointer(p.x,p.y);Pond.SetVerticesDirty();}
        public override void OnPointerExit(PointerEventData data){base.OnPointerExit(data);Pond.Model.Pointer(null,null);}
        public void OnSubmit(BaseEventData data)=>Feed(Pond.Model.Width*.5,Pond.Model.Height*.5);
        public void OnUpdateSelected(BaseEventData data){if(Input.GetKeyDown(KeyCode.Space))Feed(Pond.Model.Width*.5,Pond.Model.Height*.5);}
    }

    // Static shoreline paths are drawn on the source backdrop canvas, below the Koi layer.
    [RequireComponent(typeof(CanvasRenderer))]
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

    // sceneBackdrop=true branch of courtyard.rain-tableau.js. This owns only painted rainfall; Koi model is unchanged.
    [RequireComponent(typeof(CanvasRenderer))]
    sealed class CourtyardRainTableau : MaskableGraphic
    {
        sealed class Drop{public int cell;public double u,v,phase,speed,travel,length;}
        sealed class Ripple{public double u,v,age,life;public bool tap;}
        readonly List<Drop> _drops=new List<Drop>();readonly List<Ripple> _ripples=new List<Ripple>();uint _seed=1707;int _intensity=40;float _elapsed;
        public bool Rain=true,Paused;public string Palette="slate";
        double Width=>Math.Max(1,rectTransform.rect.width);double Height=>Math.Max(1,rectTransform.rect.height);double Scale=>Math.Max(.25,Math.Min(Width*.24,Height*.36));
        double Random(){_seed^=_seed<<13;_seed^=_seed>>17;_seed^=_seed<<5;return _seed/4294967296.0;}
        void ResetDrop(Drop d)
        {int rows=(int)Math.Ceiling(_intensity*.45/6);d.u=((d.cell%6+Random())/6*2-1)*.87;d.v=((Math.Floor(d.cell/6.0)%rows+Random())/rows*2-1)*.87;d.phase=0;d.speed=.65+Random()*.65;d.travel=.7+Random()*.65;d.length=.045+Random()*.045;}
        protected override void Awake(){base.Awake();SetIntensity(40);for(int i=0;i<6;i++)AddRipple((Random()*2-1)*.82,(Random()*2-1)*.82,false,.2+Random()*.65);}
        public void SetIntensity(int value)
        {if(value!=40&&value!=80)return;_intensity=value;int count=(int)Math.Round(value*.45);if(_drops.Count>count)_drops.RemoveRange(count,_drops.Count-count);while(_drops.Count<count){var d=new Drop{cell=_drops.Count};ResetDrop(d);d.phase=Random();_drops.Add(d);}SetVerticesDirty();}
        void AddRipple(double u,double v,bool tap,double age=0)
        {if(_ripples.Count>=64){int rain=_ripples.FindIndex(r=>!r.tap);_ripples.RemoveAt(rain<0?0:rain);}_ripples.Add(new Ripple{u=u,v=v,tap=tap,age=age,life=tap?2.2:1.1+Random()*.65});}
        public bool Tap(double x,double y){if(x<0||x>Width||y<0||y>Height)return false;AddRipple((x-Width*.5)/(Width*.43),(y-Height*.5)/(Height*.40),true);SetVerticesDirty();return true;}
        void Update()
        {
            if(Paused||!Rain)return;_elapsed+=Time.unscaledDeltaTime;if(_elapsed<1f/30)return;double dt=Math.Min(.05,_elapsed);_elapsed=0;
            for(int i=_ripples.Count-1;i>=0;i--){_ripples[i].age+=dt;if(_ripples[i].age>=_ripples[i].life)_ripples.RemoveAt(i);}
            foreach(var d in _drops){d.phase+=dt*d.speed;if(d.phase>=1){AddRipple(d.u,d.v,false);double overflow=d.phase-1;ResetDrop(d);d.phase=overflow;}}SetVerticesDirty();
        }
        Vector2 Project(double u,double v)=>new Vector2((float)(Width*.5+u*Width*.43),(float)(Height*.5+v*Height*.40));
        Vector2 At(Vector2 p)=>new Vector2(rectTransform.rect.xMin+p.x,rectTransform.rect.yMax-p.y);
        static Color ColorOf(string hex,double alpha=1){ColorUtility.TryParseHtmlString(hex,out var color);color.a=(float)alpha;return color;}
        void Line(VertexHelper mesh,Vector2 from,Vector2 to,float width,Color color)
        {var normal=new Vector2(-(to.y-from.y),to.x-from.x).normalized*(width*.5f);int n=mesh.currentVertCount;mesh.AddVert(At(from+normal),color,Vector2.zero);mesh.AddVert(At(to+normal),color,Vector2.zero);mesh.AddVert(At(to-normal),color,Vector2.zero);mesh.AddVert(At(from-normal),color,Vector2.zero);mesh.AddTriangle(n,n+1,n+2);mesh.AddTriangle(n,n+2,n+3);}
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();if(!Rain)return;string light=Palette=="moss"?"#E8E9D3":Palette=="clay"?"#F0DCC6":"#E0E6D8",ink=Palette=="moss"?"#58674B":Palette=="clay"?"#795B48":"#52645B";
            int first=mesh.currentVertCount;var wash=ColorOf("#11282F",.12);foreach(var p in new[]{new Vector2(0,0),new Vector2((float)Width,0),new Vector2((float)Width,(float)Height),new Vector2(0,(float)Height)})mesh.AddVert(At(p),wash,Vector2.zero);mesh.AddTriangle(first,first+1,first+2);mesh.AddTriangle(first,first+2,first+3);
            foreach(var r in _ripples)
            {
                double progress=Math.Max(0,Math.Min(1,r.age/r.life)),radius=.018+progress*(r.tap ? .43 : .20),opacity=Math.Pow(1-progress,1.3)*(r.tap ? .38 : .17);var center=Project(r.u,r.v);
                int echoes=r.tap?2:1;
                for(int i=0;i<echoes;i++)
                {double ring=Math.Max(.008,radius-i*(r.tap ? .05 : .022)),start=.10+i*.27,end=Math.PI*2-.08-i*.11;var color=ColorOf(i>0?ink:light,opacity*(1-i*.25));float rx=(float)(ring*Width*.11*Math.Sqrt(2)),ry=(float)(ring*Height*.14*Math.Sqrt(2));
                    for(int step=0;step<48;step++){double a=start+(end-start)*step/48,b=start+(end-start)*(step+1)/48;Line(mesh,center+new Vector2((float)Math.Cos(a)*rx,(float)Math.Sin(a)*ry),center+new Vector2((float)Math.Cos(b)*rx,(float)Math.Sin(b)*ry),(float)Math.Max(.75,Scale*.0042),color);}}
                if(r.tap&&r.age<.14){var color=ColorOf(light,opacity*.75);Line(mesh,center+new Vector2((float)(-Scale*.008),(float)(-Scale*.014)),center+new Vector2(0,(float)(-Scale*.04)),(float)Math.Max(.75,Scale*.0042),color);Line(mesh,center+new Vector2(0,(float)(-Scale*.04)),center+new Vector2((float)(Scale*.008),(float)(-Scale*.018)),(float)Math.Max(.75,Scale*.0042),color);}
            }
            bool heavy=_intensity==80;foreach(var d in _drops){var landing=Project(d.u,d.v);double distance=(1-d.phase)*d.travel*Scale,length=Math.Min(distance,d.length*Scale*(heavy?2.4:1.9));var end=landing-new Vector2((float)(distance*.055),(float)distance);var start=end-new Vector2((float)(length*.055),(float)length);Line(mesh,start,end,(float)Math.Max(heavy?1.25:1,Scale*.005),ColorOf(light,(heavy ? .4 : .32)+d.phase*.3));}
        }
    }
}
