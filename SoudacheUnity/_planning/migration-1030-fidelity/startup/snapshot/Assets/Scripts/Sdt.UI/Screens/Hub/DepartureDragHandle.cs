// departure.drag.js: stash -> bag admits one; carried -> stash removes one; outside drops keep the draft.
using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    internal sealed class DepartureDragHandle : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public string Key;
        public bool Removing;
        public CardDef Card;
        public Func<bool> Allowed;
        public bool Dragging { get; private set; }
        GameObject _ghost;
        RectTransform _canvas;
        CanvasGroup _source;
        public void OnBeginDrag(PointerEventData data)
        {
            if (Allowed?.Invoke() != true || string.IsNullOrEmpty(Key)) return;
            Dragging = true;
            var canvas = GetComponentInParent<Canvas>().rootCanvas; _canvas = (RectTransform)canvas.transform;
            _ghost = new GameObject("departure-drag-card", typeof(RectTransform), typeof(CanvasGroup)); _ghost.transform.SetParent(_canvas, false);
            var ghostRect = (RectTransform)_ghost.transform; ghostRect.sizeDelta = new Vector2(160, 240);
            var group = _ghost.GetComponent<CanvasGroup>(); group.blocksRaycasts = false; group.alpha = .86f;
            var face = DepartureElements.Card(_ghost.transform, Card, 160); face.anchorMin = face.anchorMax = Vector2.one * .5f; face.pivot = Vector2.one * .5f;
            _source = Sdt.UI.Kit.UIKit.GetOrAdd<CanvasGroup>(gameObject); _source.alpha = .55f;
            OnDrag(data);
        }
        public void OnDrag(PointerEventData data)
        {
            if (!Dragging || _ghost == null) return;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_canvas, data.position, data.pressEventCamera, out var point);
            ((RectTransform)_ghost.transform).anchoredPosition = point;
        }
        public void OnEndDrag(PointerEventData data)
        {
            if (_ghost != null) Destroy(_ghost); _ghost = null;
            if (_source != null) _source.alpha = 1;
            // Button's click for this pointer is already cancelled by the EventSystem drag threshold.
            Dragging = false;
        }
        void OnDisable() { if (_ghost != null) Destroy(_ghost); _ghost = null; Dragging = false; if (_source != null) _source.alpha = 1; }
    }
    internal sealed class DepartureDropZone : MonoBehaviour, IDropHandler, IPointerEnterHandler, IPointerExitHandler
    {
        public Action<DepartureDragHandle> Receive;
        Outline _hint;
        public void OnDrop(PointerEventData data)
        {
            var source = data.pointerDrag != null ? data.pointerDrag.GetComponent<DepartureDragHandle>() : null;
            if (source != null && source.Dragging && source.Allowed?.Invoke() == true) Receive?.Invoke(source);
            SetHint(false);
        }
        public void OnPointerEnter(PointerEventData data) { if (data.pointerDrag?.GetComponent<DepartureDragHandle>()?.Dragging == true) SetHint(true); }
        public void OnPointerExit(PointerEventData data) => SetHint(false);
        void SetHint(bool value)
        {
            if (_hint == null) { _hint = gameObject.AddComponent<Outline>(); _hint.effectColor = new Color(.7f, .9f, .85f); _hint.effectDistance = new Vector2(2, -2); }
            _hint.enabled = value;
        }
    }
}
