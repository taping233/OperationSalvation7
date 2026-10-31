using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>Source pointerdown600ms / pointerup-leave-cancel negative-photo easter egg.</summary>
    public sealed class PhotoNegativeGesture : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler, ICancelHandler
    {
        Image _pixels;
        Material _original, _negative;
        float _heldAt = -1;
        void Awake()
        {
            _pixels = transform.Find("PhotoPixels")?.GetComponent<Image>();
            UIKit.GetOrAdd<Image>(gameObject).color = new Color(0, 0, 0, .001f);
        }
        public void OnPointerDown(PointerEventData e) { Clear(); _heldAt = Time.unscaledTime; }
        public void OnPointerUp(PointerEventData e) { Clear(); }
        public void OnPointerExit(PointerEventData e) { Clear(); }
        public void OnCancel(BaseEventData e) { Clear(); }
        void Update()
        {
            if (_heldAt < 0 || _pixels == null || Time.unscaledTime - _heldAt < .6f) return;
            _heldAt = -1;
            if (_negative == null) { var shader = Resources.Load<Shader>("Art/CurrentPhoto/PhotoNegative"); if (shader == null) return; _negative = new Material(shader); }
            _original = _pixels.material; _pixels.material = _negative;
        }
        void Clear() { _heldAt = -1; if (_pixels != null && _negative != null && _pixels.material == _negative) _pixels.material = _original; }
        void OnDisable() { Clear(); }
        void OnApplicationFocus(bool focus) { if (!focus) Clear(); }
        void OnDestroy() { Clear(); if (_negative != null) Destroy(_negative); }
    }
}
