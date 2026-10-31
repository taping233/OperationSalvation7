// home-polish.css fixed hit areas, independent text hover, option light, sheen and home-fx.js ripple.
using Sdt.Res;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentHomePlate : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler,
        ISelectHandler, IDeselectHandler, IPointerDownHandler
    {
        RectTransform _copy;
        Vector2 _copyPosition;
        Image _icon, _light, _ripple;
        RectTransform _rippleRect, _sheenRect;
        Image _sheen;
        TitleScreen _owner;
        CanvasGroup _system;
        bool _hover, _focus, _right, _start, _wasPicked;
        float _weight, _time, _rippleAge = 1;
        public void Setup(RectTransform copy, Image icon, string face, bool right, bool start)
        {
            _copy=copy; _copyPosition=copy.anchoredPosition; _icon=icon; _right=right; _start=start;
            _owner=GetComponentInParent<TitleScreen>();
            var rect=(RectTransform)transform;
            var light=CurrentHomeElements.Art(transform, "glow-"+face.Substring(6), 0, 0, rect.sizeDelta.x, rect.sizeDelta.y,"home-hover-glow");
            _light=light; _light.color=new Color(1,1,1,0); _light.transform.SetSiblingIndex(1);
            if(start)
            {
                var clip=CurrentHomeElements.Art(transform,face,0,0,rect.sizeDelta.x,rect.sizeDelta.y,"home-sheen-clip");
                clip.transform.SetSiblingIndex(2);clip.gameObject.AddComponent<Mask>().showMaskGraphic=false;
                _sheen=CurrentHomeElements.Art(clip.transform,"home-sheen",0,0,rect.sizeDelta.x*2.6f,rect.sizeDelta.y,"home-sheen");
                _sheenRect=_sheen.rectTransform;
            }
            if (name == "mSettings" || name == "mCredits" || name == "btnTitleExit") _system=transform.parent.GetComponent<CanvasGroup>();
        }
        public void OnPointerEnter(PointerEventData data) => _hover=true;
        public void OnPointerExit(PointerEventData data) => _hover=false;
        public void OnSelect(BaseEventData data) => _focus=true;
        public void OnDeselect(BaseEventData data) => _focus=false;
        public void OnPointerDown(PointerEventData data)
        {
            if (CurrentHomeMotion.Reduced) return;
            if (_ripple == null)
            {
                var rect=(RectTransform)transform;
                var clip=CurrentHomeElements.Art(transform, _start ? "plate-start" : _right ? "plate-collection" : "plate-guide",
                    0,0,rect.sizeDelta.x,rect.sizeDelta.y,"ripple-clip");
                clip.gameObject.AddComponent<Mask>().showMaskGraphic=false;
                _ripple=CurrentHomeElements.Art(clip.transform,"home-ripple",0,0,0,0,"home-ripple"); _rippleRect=_ripple.rectTransform;
                _rippleRect.pivot=new Vector2(.5f,.5f);
            }
            RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform,data.position,data.pressEventCamera,out var point);
            _rippleRect.anchoredPosition=point; _rippleAge=0;
        }
        void Update()
        {
            bool picked=_hover || _focus, reduced=CurrentHomeMotion.Reduced;
            if(!reduced && UiStack.Top==_owner)_time+=Time.unscaledDeltaTime;
            _weight=Mathf.MoveTowards(_weight,picked ? 1 : 0,Time.unscaledDeltaTime/(picked ? .6f : .8f));
            _copy.anchoredPosition=_copyPosition+new Vector2(reduced ? 0 : (_right ? -4 : 4)*_weight,0);
            float resting=_start ? .16f : .28f;
            if(!reduced && (name=="mAch" || name=="btnCardLib"))resting=Mathf.Lerp(.25f,.65f,Mathf.PingPong((_time+(name=="btnCardLib"?3:0))/3,1));
            _light.color=new Color(1,1,1,Mathf.Lerp(resting,1,_weight));
            if(_sheenRect!=null)
            {
                float cycle=Mathf.Repeat(_time/(picked?2.4f:7),1);
                float progress=CurrentHomeMotion.Ease(Mathf.InverseLerp(.55f,.88f,cycle),.42f,0,.58f,1);
                _sheenRect.anchoredPosition=new Vector2(Mathf.Lerp(-2.72f,1.12f,progress)*((RectTransform)transform).sizeDelta.x,0);
                _sheen.color=new Color(1,1,1,reduced?0:picked?.8f:.48f);
            }
            if (_system != null && picked!=_wasPicked) _system.alpha=picked ? 1 : .86f;
            _wasPicked=picked;
            if (_ripple != null)
            {
                _rippleAge+=Time.unscaledDeltaTime;
                float t=Mathf.Clamp01(_rippleAge/.62f);
                float radius=520*CurrentHomeMotion.Ease(t,.2f,.7f,.2f,1);
                _rippleRect.sizeDelta=Vector2.one*radius*2;
                _ripple.color=new Color(1,1,1,1-t);
            }
        }
    }
}
