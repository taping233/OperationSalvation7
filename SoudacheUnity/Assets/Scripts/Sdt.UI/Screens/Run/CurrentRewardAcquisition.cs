// reward-acquisition-motion.js: settled card lift and 340ms flight to the live bag anchor.
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentRewardAcquisition:MonoBehaviour
    {
        RectTransform _host,_target,_body;Vector2 _start;CanvasGroup _alpha;float _time;Panel _owner;
        public static void Play(Transform parent,RectTransform source,RectTransform target,CardDef card)
        {
            if(CurrentUiPreferences.ReducedMotion||source==null||target==null)return;
            var host=parent as RectTransform;var corners=new Vector3[4];source.GetWorldCorners(corners);
            var a=(Vector2)host.InverseTransformPoint(corners[0]);var b=(Vector2)host.InverseTransformPoint(corners[2]);
            var root=CurrentNodeElements.Rect(parent,"reward-acquisition-card");root.anchorMin=root.anchorMax=root.pivot=Vector2.one*.5f;root.sizeDelta=b-a;root.anchoredPosition=(a+b)*.5f;
            var flight=UIKit.GetOrAdd<CurrentRewardAcquisition>(root);flight._host=host;flight._target=target;flight._start=root.anchoredPosition;flight._owner=root.GetComponentInParent<Panel>();flight._alpha=UIKit.GetOrAdd<CanvasGroup>(root);flight._alpha.blocksRaycasts=flight._alpha.interactable=false;
            var body=CurrentNodeElements.Rect(root,"reward-acquisition-body");CurrentNodeElements.Stretch(body);flight._body=body;
            var face=CardFace.Create(card,CardSize.Xl,body);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=Vector2.one*.5f;rt.anchoredPosition=Vector2.zero;var paper=face.transform.Find("paper-card") as RectTransform;if(paper!=null)rt.localScale=Vector3.one*(root.sizeDelta.x/paper.sizeDelta.x);
        }
        void Update()
        {
            if(_target==null||UiStack.Top!=_owner||CurrentUiPreferences.ReducedMotion){Destroy(gameObject);return;}
            _time+=Time.unscaledDeltaTime;float p=Mathf.Clamp01(_time/.34f);var rt=(RectTransform)transform;float travel=Mathf.SmoothStep(0,1,p);
            var end=(Vector2)_host.InverseTransformPoint(_target.TransformPoint(_target.rect.center));rt.anchoredPosition=Vector2.Lerp(_start,end,travel);
            float scale,lift,alpha;if(p<.3f){float t=p/.3f;scale=Mathf.Lerp(1,.96f,t);lift=Mathf.Lerp(0,22,t);alpha=1;}else if(p<.65f){float t=(p-.3f)/.35f;scale=Mathf.Lerp(.96f,.58f,t);lift=Mathf.Lerp(22,14,t);alpha=Mathf.Lerp(1,.9f,t);}else{float t=(p-.65f)/.35f;scale=Mathf.Lerp(.58f,.12f,t);lift=Mathf.Lerp(14,0,t);alpha=Mathf.Lerp(.9f,.12f,t);}
            _body.localScale=Vector3.one*scale;_body.anchoredPosition=new Vector2(0,lift);_alpha.alpha=alpha;
            if(p>=1){var ring=CurrentNodeElements.Rect(_host,"reward-acquisition-arrival");ring.position=_target.position;ring.sizeDelta=_target.rect.size+Vector2.one*8;var image=UIKit.GetOrAdd<Image>(ring);image.color=Color.clear;image.raycastTarget=false;var border=UIKit.GetOrAdd<Outline>(ring);border.effectColor=Theme.HexA("#85cfc7",.65f);border.effectDistance=Vector2.one;Destroy(ring.gameObject,.16f);Destroy(gameObject);}
        }
    }
}
