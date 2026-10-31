using System;
using System.Collections.Generic;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>photo-studio-controls listbox: one open choice, keyboard focus, bounded menu.</summary>
    sealed class PhotoStudioChoice
    {
        readonly Transform _overlay;
        readonly Button _trigger;
        readonly string[] _values, _labels;
        readonly Action<string> _changed;
        readonly List<Button> _buttons = new List<Button>();
        RectTransform _layer, _content;
        ScrollRect _scroll;
        int _selected, _focus;
        string _typed = "";
        float _typedAt;
        public bool IsOpen => _layer != null;
        public PhotoStudioChoice(Transform overlay, Button trigger, string[] values, string[] labels, string selected, Action<string> changed)
        { _overlay = overlay; _trigger = trigger; _values = values; _labels = labels; _changed = changed; _selected = Mathf.Max(0, Array.IndexOf(values, selected)); }
        public void Toggle() { if (IsOpen) Close(); else Open(); }
        void Open()
        {
            _layer = PhotoStudioElements.Node(_overlay, "studio-choice-open-" + _trigger.name); PhotoStudioElements.Fill(_layer);
            var blocker = PhotoStudioElements.Button(_layer, "ChoiceDismiss", "", Close); PhotoStudioElements.Fill((RectTransform)blocker.transform);
            var bounds = new Vector3[4]; ((RectTransform)_trigger.transform).GetWorldCorners(bounds);
            var parent = (RectTransform)_overlay; var top = parent.InverseTransformPoint(bounds[1]); var bottom = parent.InverseTransformPoint(bounds[0]);
            float width = ((RectTransform)_trigger.transform).rect.width, height = Mathf.Min(300, _values.Length * 42 + 16);
            var menu = PhotoStudioElements.Node(_layer, "studio-choice-menu");
            bool upward = parent.rect.yMax - bottom.y + height + 8 > parent.rect.height;
            float y = parent.rect.yMax - (upward ? top.y + height + 7 : bottom.y - 7);
            PhotoStudioElements.Place(menu, top.x - parent.rect.xMin, y, width, height);
            PhotoStudioElements.Paint(menu, "MenuPaper", Theme.Hex("#1c2925"));
            _content = PhotoStudioElements.Scroll(menu, "Choices", out _scroll); PhotoStudioElements.Fill((RectTransform)_scroll.transform, 8, 8, 8, 8);
            _content.sizeDelta = new Vector2(0, _values.Length * 42);
            for (int i = 0; i < _values.Length; i++)
            {
                int index = i; var b = PhotoStudioElements.Button(_content, "Choice-" + i, _labels[i] + (i == _selected ? "  ✓" : ""), () => Pick(index));
                PhotoStudioElements.Place((RectTransform)b.transform, 0, i * 42, width - 16, 42);
                b.GetComponentInChildren<Text>().fontSize = 18; b.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleLeft;
                var nav = b.navigation; nav.mode = Navigation.Mode.None; b.navigation = nav; _buttons.Add(b);
            }
            _focus = _selected; Focus();
        }
        void Pick(int index) { var old = _selected; _selected = index; var value = _values[index]; Close(); if (old != index) _changed(value); }
        void Focus()
        {
            for (int i = 0; i < _buttons.Count; i++) _buttons[i].GetComponent<Image>().color = i == _focus ? Theme.HexA("#d0d8bc", .12f) : Color.clear;
            EventSystem.current?.SetSelectedGameObject(_buttons[_focus].gameObject);
            float top = _focus * 42, viewport = ((RectTransform)_scroll.transform).rect.height;
            _content.anchoredPosition = new Vector2(0, Mathf.Clamp(top - viewport / 2 + 21, 0, Mathf.Max(0, _values.Length * 42 - viewport)));
        }
        public void Keyboard()
        {
            if (!IsOpen || Input.compositionString.Length > 0) return;
            if (Input.GetKeyDown(KeyCode.Tab)) { Close(); return; }
            int next = _focus;
            if (Input.GetKeyDown(KeyCode.DownArrow)) next = (_focus + 1) % _values.Length;
            else if (Input.GetKeyDown(KeyCode.UpArrow)) next = (_focus - 1 + _values.Length) % _values.Length;
            else if (Input.GetKeyDown(KeyCode.Home)) next = 0;
            else if (Input.GetKeyDown(KeyCode.End)) next = _values.Length - 1;
            else
            {
                string typed = Input.inputString;
                if (!string.IsNullOrEmpty(typed) && !char.IsControl(typed[0]))
                {
                    _typed = (Time.unscaledTime - _typedAt < .7f ? _typed : "") + typed.ToLowerInvariant(); _typedAt = Time.unscaledTime;
                    for (int i = 0; i < _labels.Length; i++) if (_labels[i].ToLowerInvariant().StartsWith(_typed, StringComparison.Ordinal)) { next = i; break; }
                }
            }
            if (next != _focus) { _focus = next; Focus(); }
        }
        public void Close()
        {
            if (_layer == null) return;
            _layer.gameObject.SetActive(false); UnityEngine.Object.Destroy(_layer.gameObject); _layer = null; _buttons.Clear();
            if (_trigger != null) EventSystem.current?.SetSelectedGameObject(_trigger.gameObject);
        }
    }
}
