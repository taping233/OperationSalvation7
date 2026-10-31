using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    // scenes.css psSweep/psFill, presentation only; search completion stays in the page owner.
    public sealed class CurrentPickupSearch:MonoBehaviour
    {
        RectTransform _lantern,_fill;float _start;CanvasGroup _opacity;
        public void Bind(RectTransform lantern,RectTransform fill,float start){_lantern=lantern;_fill=fill;_start=start;_opacity=UIKit.GetOrAdd<CanvasGroup>(lantern);}
        void Update(){if(_fill==null||_lantern==null)return;float p=Mathf.Clamp01((Time.unscaledTime-_start)/.95f);_fill.anchorMax=new Vector2(1-Mathf.Pow(1-p,3),1);if(CurrentUiPreferences.ReducedMotion)return;float x=p<.55f?Mathf.Lerp(-76,0,p/.55f):Mathf.Lerp(0,76,(p-.55f)/.45f);_lantern.localRotation=Quaternion.Euler(0,0,p<.55f?Mathf.Lerp(8,-5,p/.55f):Mathf.Lerp(-5,5,(p-.55f)/.45f));_lantern.anchoredPosition=new Vector2(x,_lantern.anchoredPosition.y);_opacity.alpha=p<.55f?Mathf.Lerp(.3f,1,p/.55f):Mathf.Lerp(1,.75f,(p-.55f)/.45f);}
    }
}
