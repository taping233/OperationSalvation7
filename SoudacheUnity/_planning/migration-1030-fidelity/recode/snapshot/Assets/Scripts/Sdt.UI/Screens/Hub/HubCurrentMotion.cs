// Direct timings/travel/easing from base-page-motion-v7.js/navigation-motion.js.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Sdt.Run;
namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        static string _motionView,_motionRoom,_motionPerson,_motionPet;
        void ApplyCurrentMotion(GameObject root)
        {
            bool cold=_motionView==null,changed=_motionView!=ViewKey,detail=_motionRoom==_tab;
            int before=Array.IndexOf(new[]{"deploy","classes","stash","shop","ach","upgrade","courtyard"},_motionRoom);
            int after=Array.IndexOf(new[]{"deploy","classes","stash","shop","ach","upgrade","courtyard"},_tab);
            float x=(after>=before?1:-1)*(detail?64:112);string previousPerson=_motionPerson,previousPet=_motionPet;
            _motionView=ViewKey;_motionRoom=_tab;_motionPerson=_person;_motionPet=_pet;
            if(GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion")=="1")return;
            var motion=root.AddComponent<HubRegionMotion>();
            Transform Find(string name)=>root.GetComponentsInChildren<Transform>().FirstOrDefault(t=>t.name==name);
            if(_tab=="deploy"&&changed)
            {
                if(cold){motion.Add(Find("hub-head"),new Vector2(0,-8),.34f,0,true);motion.Add(Find("base-navigation-v7"),new Vector2(0,12),.34f,.04f,true);}
                motion.Add(Find("base-home-affairs"),new Vector2(cold?-52:x*.5f,0),cold ? .4f : .32f,cold ? .11f : 0,true);
                motion.Add(Find("base-home-preparation"),new Vector2(cold?72:x,0),cold ? .44f : .38f,cold ? .17f : .06f,true);return;
            }
            if(changed)
            {
                string[][] groups={new[]{"warehouse-categories-v7","pv12-agent-strip","trade-v5-modes","av12-directory","facility-map"},new[]{"warehouse-card-browser","pv12-agent-art","pv12-pool-catalog","av12-content","facility-v12-stage","trade-v5-rail","partner-display","courtyard-v3-scene"},new[]{"pv12-agent-data","trade-v5-desk","facility-details","partner-details","companion-hatch","courtyard-v3-controls"},new[]{"pv12-sections","person-roster"}};
                for(int i=0;i<groups.Length;i++)foreach(string name in groups[i])motion.Add(Find(name),new Vector2(x,0),detail ? .38f : .44f,Math.Min(i*.026f,.078f),false);return;
            }
            if(_tab=="classes"&&(previousPerson!=_person||previousPet!=_pet)){motion.Add(Find(_personGroup=="pets"?"partner-display":"pv12-agent-art"),new Vector2(64,0),.38f,0,false);motion.Add(Find(_personGroup=="pets"?"partner-details":"pv12-agent-data"),new Vector2(64,0),.38f,0,false);}
        }
    }
    sealed class HubRegionMotion : MonoBehaviour
    {
        sealed class Region {public RectTransform rect;public Vector3 origin;public Vector2 delta;public float duration,delay;public bool fade;public CanvasGroup group;}
        readonly List<Region> _regions=new List<Region>();float _start;bool _ready;
        public void Add(Transform target,Vector2 delta,float duration,float delay,bool fade)
        {if(target==null)return;var r=new Region{rect=(RectTransform)target,delta=delta,duration=duration,delay=delay,fade=fade};if(fade){r.group=Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(target);r.group.alpha=0;}_regions.Add(r);}
        static float Curve(float t)
        {float lo=0,hi=1,v=t;for(int n=0;n<9;n++){v=(lo+hi)*.5f;float u=1-v,x=3*u*u*v*.2f+3*u*v*v*.25f+v*v*v;if(x<t)lo=v;else hi=v;}float one=1-v;return 3*one*one*v*.65f+3*one*v*v+v*v*v;}
        void LateUpdate()
        {
            if(!_ready){Canvas.ForceUpdateCanvases();foreach(var r in _regions)r.origin=r.rect.localPosition;_start=Time.unscaledTime;_ready=true;}
            bool finish=Input.GetMouseButtonDown(0)||Input.GetKeyDown(KeyCode.Return)||Input.GetKeyDown(KeyCode.Space)||Input.GetKeyDown(KeyCode.Escape)||GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion")=="1";
            bool complete=true;
            foreach(var r in _regions)
            {float t=finish?1:Mathf.Clamp01((Time.unscaledTime-_start-r.delay)/r.duration);float ease=t>=1?1:Curve(t);r.rect.localPosition=r.origin+(Vector3)(r.delta*(1-ease));if(r.fade)r.group.alpha=ease;if(t<1)complete=false;}
            if(complete)enabled=false;
        }
    }
}
