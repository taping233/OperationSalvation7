// Source: ui/end-turn-hold.js. One physical Button owns click, pointer and keyboard activation.
using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    public sealed class CurrentEndTurnHold : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler, IDeselectHandler, ICancelHandler
    {
        public const float HoldSeconds = .650f;
        Button _button; Action _run; Image _progress;
        bool _holding, _keyboard; float _started; Panel _owner;
        public bool IsHolding => _holding;
        public float Progress => _holding ? Mathf.Clamp01((Time.unscaledTime - _started) / HoldSeconds) : 0;

        public static CurrentEndTurnHold Install(Button button, Action run)
        {
            var hold = UIKit.GetOrAdd<CurrentEndTurnHold>(button);
            hold._button = button; hold._run = run;
            button.onClick.RemoveAllListeners();
            button.onClick.AddListener(() => { if (!CurrentUiPreferences.EndTurnHold && hold.Available()) hold._run?.Invoke(); });
            if (hold._progress == null)
            {
                var go = new GameObject("end-turn-hold-progress", typeof(RectTransform)); go.transform.SetParent(button.transform, false);
                hold._progress = UIKit.GetOrAdd<Image>(go); hold._progress.color = Theme.Hex("#8fd3d0"); hold._progress.raycastTarget = false;
                var rt = hold._progress.rectTransform; rt.anchorMin = Vector2.zero; rt.anchorMax = new Vector2(0, 0); rt.pivot = Vector2.zero;
                rt.anchoredPosition = Vector2.zero; rt.sizeDelta = new Vector2(0, 4);
            }
            hold.Cancel(); return hold;
        }
        bool Available() => isActiveAndEnabled && _button != null && _button.IsActive() && _button.IsInteractable() && Application.isFocused;
        static bool Modified() => Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl) || Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt) || Input.GetKey(KeyCode.LeftCommand) || Input.GetKey(KeyCode.RightCommand);
        void Begin(bool keyboard)
        {
            if (_holding || !CurrentUiPreferences.EndTurnHold || !Available() || Modified() || CurrentInputBindings.SuppressGameplayInput || !string.IsNullOrEmpty(Input.compositionString)) return;
            _holding = true; _keyboard = keyboard; _started = Time.unscaledTime; _owner = UiStack.Top;
        }
        public void Cancel() { _holding = false; if (_progress != null) _progress.rectTransform.sizeDelta = new Vector2(0, 4); }
        void Update()
        {
            bool selected = EventSystem.current != null && EventSystem.current.currentSelectedGameObject == gameObject;
            if (selected && (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))) Begin(true);
            if (!_holding) return;
            bool held = _keyboard ? selected && (Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.Return) || Input.GetKey(KeyCode.KeypadEnter)) : Input.GetMouseButton(0);
            if (!held || !Available() || UiStack.Top != _owner || !CurrentUiPreferences.EndTurnHold || Modified() || CurrentInputBindings.SuppressGameplayInput) { Cancel(); return; }
            _progress.rectTransform.sizeDelta = new Vector2(((RectTransform)transform).rect.width * Progress, 4);
            if (Progress >= 1) { Cancel(); _run?.Invoke(); }
        }
        public void OnPointerDown(PointerEventData e) { if (e.button == PointerEventData.InputButton.Left) Begin(false); }
        public void OnPointerUp(PointerEventData e) => Cancel();
        public void OnPointerExit(PointerEventData e) => Cancel();
        public void OnDeselect(BaseEventData e) => Cancel();
        public void OnCancel(BaseEventData e) => Cancel();
        void OnDisable() => Cancel();
        void OnApplicationFocus(bool focus) { if (!focus) Cancel(); }
        void OnApplicationPause(bool pause) { if (pause) Cancel(); }
    }
}
