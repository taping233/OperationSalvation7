// game.run.shop.js playBuyCarry: 560ms arc; mystery collapse 240ms, reveal 720ms, then flight.
using System;
using Sdt.Core;
using Sdt.UI.Kit;
using UnityEngine;

namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentShopCarry:MonoBehaviour
    {
        RectTransform _host,_card,_back;CanvasGroup _alpha;Func<RectTransform> _target;Panel _owner;
        Vector2 _start,_size;float _time,_popTime;bool _mystery,_arrived;
        public static void Play(Transform parent,RectTransform source,Func<RectTransform> target,CardDef card,bool mystery)
        {
            if(CurrentUiPreferences.ReducedMotion||source==null||target?.Invoke()==null)return;
            var host=parent as RectTransform;var corners=new Vector3[4];source.GetWorldCorners(corners);var a=(Vector2)host.InverseTransformPoint(corners[0]);var b=(Vector2)host.InverseTransformPoint(corners[2]);
            var root=CurrentNodeElements.Rect(parent,"shop-purchase-carry");root.anchorMin=root.anchorMax=root.pivot=Vector2.one*.5f;root.sizeDelta=b-a;root.anchoredPosition=(a+b)*.5f;
            var effect=UIKit.GetOrAdd<CurrentShopCarry>(root);effect._host=host;effect._owner=root.GetComponentInParent<Panel>();effect._target=target;effect._start=root.anchoredPosition;effect._size=b-a;effect._mystery=mystery;
            effect._alpha=UIKit.GetOrAdd<CanvasGroup>(root);effect._alpha.blocksRaycasts=effect._alpha.interactable=false;
            effect._card=DepartureElements.Card(root,card,effect._size.x,"shop-carried-card",new CardFaceOptions{HideCost=false,ScrollDescription=false});effect._card.anchorMin=effect._card.anchorMax=effect._card.pivot=Vector2.one*.5f;effect._card.anchoredPosition=Vector2.zero;
            if(mystery){var image=UIKit.Image(root,CurrentShopAssets.Get("mystery-back"));image.raycastTarget=false;effect._back=image.rectTransform;UiStack.Stretch(effect._back);effect._card.gameObject.SetActive(false);}
        }
        void Update()
        {
            var target=_target?.Invoke();if(target==null||UiStack.Top!=_owner||CurrentUiPreferences.ReducedMotion){Destroy(gameObject);return;}
            _time+=Time.unscaledDeltaTime;float delay=_mystery?.96f:0;
            if(_arrived){_popTime+=Time.unscaledDeltaTime;target.localScale=Vector3.one*(1+BagPop(_popTime));if(_popTime>=.42f){target.localScale=Vector3.one;Destroy(gameObject);}return;}
            if(_mystery&&_time<.24f){_back.localScale=new Vector3(Mathf.Max(0,1-_time/.24f),1,1);return;}
            if(_mystery&&_back!=null){Destroy(_back.gameObject);_back=null;_card.gameObject.SetActive(true);}
            if(_time<delay){float reveal=RevealEase(Mathf.Clamp01((_time-.24f)/.32f));_card.localScale=Vector3.one*Mathf.LerpUnclamped(.4f,1,reveal);_alpha.alpha=Mathf.Clamp01(reveal);return;}
            _card.localScale=Vector3.one;
            float p=Mathf.Clamp01((_time-delay)/.56f),travel=p*p*p*(p*(p*6-15)+10);var end=(Vector2)_host.InverseTransformPoint(target.TransformPoint(target.rect.center));
            var rt=(RectTransform)transform;rt.anchoredPosition=Vector2.Lerp(_start,end,travel)+Vector2.up*(4*travel*(1-travel)*Mathf.Min(170,Mathf.Abs(end.x-_start.x)*.28f+80));rt.localScale=Vector3.one*(1-.78f*p);rt.localRotation=Quaternion.Euler(0,0,-9*p);_alpha.alpha=p<.85f?1:Mathf.Max(0,1-(p-.85f)/.15f);
            if(p>=1){_arrived=true;_alpha.alpha=0;}
        }
        // Invert the source cubic-bezier(.2,.9,.35,1.18), including its small overshoot.
        static float RevealEase(float p){if(p<=0||p>=1)return p;float lo=0,hi=1;for(int i=0;i<12;i++){float t=(lo+hi)*.5f,x=3*(1-t)*(1-t)*t*.2f+3*(1-t)*t*t*.35f+t*t*t;if(x<p)lo=t;else hi=t;}float u=(lo+hi)*.5f;return 3*(1-u)*(1-u)*u*.9f+3*(1-u)*u*u*1.18f+u*u*u;}
        static float PopSample(float t)=>t<=0?0:.16f*Mathf.Exp(-9*t)*Mathf.Sin(2*Mathf.PI*13*t);
        static float BagPop(float t){float frame=Mathf.Clamp01(t/.42f)*10;int index=Mathf.Min(9,Mathf.FloorToInt(frame));return Mathf.Lerp(PopSample(index*.042f),PopSample((index+1)*.042f),frame-index);}
        void OnDestroy(){if(_arrived){var target=_target?.Invoke();if(target!=null)target.localScale=Vector3.one;}}
    }
}
