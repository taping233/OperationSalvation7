// battle.enemy-motion.js bandit sample and battle.vfx.js generic no-frame lunge.
using UnityEngine;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattleEnemyFrameMotion : MonoBehaviour
    {
        RectTransform _target;
        Vector2 _base;
        Quaternion _rotation;
        Vector3 _scale;
        float _time,_duration;
        string _action;
        bool _bandit;
        static readonly float[] AttackT={0,.24f,.48f,.66f,1},AttackX={0,7,-26,-8,0},AttackR={0,3,-5,-2,0};
        static readonly float[] HurtT={0,.18f,.55f,1},HurtX={0,12,4,0},HurtR={0,6,2,0};
        public static bool Play(RectTransform figure,string id,string action)
        {
            bool bandit=id=="bandit";
            if (CurrentUiPreferences.ReducedMotion || action=="hurt"&&!bandit) return false;
            var motion=UIKit.GetOrAdd<BattleEnemyFrameMotion>(figure);
            motion.Restore(); motion._action=action; motion._bandit=bandit;
            motion._target=bandit?figure.GetComponentInChildren<UnityEngine.UI.Image>()?.rectTransform:figure;
            if(motion._target==null)return false;
            motion._base=motion._target.anchoredPosition; motion._rotation=motion._target.localRotation; motion._scale=motion._target.localScale;
            motion._time=0; motion._duration=Mathf.Max(80,Mathf.Round((bandit?action=="attack"?360:300:260)/CurrentUiPreferences.BattlePace))/1000;
            motion.enabled=true; return true;
        }
        void Update()
        {
            if (CurrentUiPreferences.ReducedMotion) { Restore(); return; }
            var owner=GetComponentInParent<BattleScreen>(); if(owner!=null&&UiStack.Top!=owner)return;
            _time+=Time.unscaledDeltaTime; float p=Mathf.Clamp01(_time/_duration);
            p=Bezier(p,_bandit?0:.3f,_bandit?0:.7f,_bandit?.58f:.4f,1); float x,angle=0,scale=1;
            if(!_bandit){float k=p<.45f?p/.45f:(1-p)/.55f;x=-14*k;scale=1+.04f*k;}
            else if(_action=="attack")
            { x=Sample(p,AttackT,AttackX);angle=Sample(p,AttackT,AttackR); }
            else {x=Sample(p,HurtT,HurtX);angle=Sample(p,HurtT,HurtR);}
            _target.anchoredPosition=_base+new Vector2(x,0);_target.localRotation=_rotation*Quaternion.Euler(0,0,-angle);_target.localScale=_scale*scale;
            if(p>=1)Restore();
        }
        static float Sample(float p,float[] t,float[] v){for(int i=1;i<t.Length;i++)if(p<=t[i])return Mathf.Lerp(v[i-1],v[i],Mathf.InverseLerp(t[i-1],t[i],p));return v[v.Length-1];}
        static float Bezier(float p,float x1,float y1,float x2,float y2)
        {
            float lo=0,hi=1,t=p;
            for(int i=0;i<12;i++){t=(lo+hi)*.5f;float q=1-t,x=3*q*q*t*x1+3*q*t*t*x2+t*t*t;if(x<p)lo=t;else hi=t;}
            float s=1-t;return 3*s*s*t*y1+3*s*t*t*y2+t*t*t;
        }
        void Restore(){if(_target!=null){_target.anchoredPosition=_base;_target.localRotation=_rotation;_target.localScale=_scale;}enabled=false;}
        void OnDisable(){Restore();}
    }
}
